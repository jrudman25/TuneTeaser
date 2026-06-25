import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ManualTrack } from '../utils/manualPlaylists';
import { useManualPlaylists } from '../hooks/useManualPlaylists';
import { useTuneTeaserAuth } from '../hooks/useTuneTeaserAuth';
import { signInAnonymously, signOut } from 'firebase/auth';
import { auth } from '../backend/FirebaseConfig';
import { extractSpotifyPlaylistId } from '../utils/spotifyPlaylistName';
import { importSpotifyPlaylist } from '../utils/spotifyPlaylistImporter';
import { searchPublicSpotifyPlaylists, SpotifyPlaylistSearchResult } from '../utils/spotifyPlaylistSearch';
import { extractSpotifyUserId, fetchSpotifyUserPlaylists, SpotifyUserPlaylist } from '../utils/spotifyUserPlaylists';
import SignedInBadge from '../components/SignedInBadge';
import NavBar from '../components/NavBar';

type BatchImportResult = {
    playlistId: string;
    message: string;
    status: 'success' | 'error';
};

const PROFILE_PLAYLISTS_PER_PAGE = 8;

const PlaylistImportSpotify = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const isOnboarding = searchParams.get('onboarding') === '1';
    const isGuest = searchParams.get('mode') === 'guest';
    const { user, isLoadingUser } = useTuneTeaserAuth();
    const { addManualPlaylist, manualPlaylists } = useManualPlaylists(user, isGuest);
    const currentCount = manualPlaylists.length;
    const playlistsRemaining = Math.max(0, 30 - currentCount);

    const [playlistUrl, setPlaylistUrl] = useState('');
    const [profileUrl, setProfileUrl] = useState('');
    const [playlistName, setPlaylistName] = useState('');
    const nameWasAutoFilled = useRef(false);
    const [isImporting, setIsImporting] = useState(false);
    const [importedTracks, setImportedTracks] = useState<ManualTrack[]>([]);
    const [importedTotal, setImportedTotal] = useState(0);
    const [importedForUrl, setImportedForUrl] = useState('');
    const [formError, setFormError] = useState('');
    const [importErrors, setImportErrors] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [profilePlaylists, setProfilePlaylists] = useState<SpotifyUserPlaylist[]>([]);
    const [profilePlaylistsForUrl, setProfilePlaylistsForUrl] = useState('');
    const [selectedPlaylistIds, setSelectedPlaylistIds] = useState<string[]>([]);
    const [isLoadingProfilePlaylists, setIsLoadingProfilePlaylists] = useState(false);
    const [isBatchImporting, setIsBatchImporting] = useState(false);
    const [batchImportResults, setBatchImportResults] = useState<BatchImportResult[]>([]);
    const [profilePlaylistPage, setProfilePlaylistPage] = useState(0);
    const [saveSuccessMessage, setSaveSuccessMessage] = useState('');
    const [authError, setAuthError] = useState('');
    const [profileSearchQuery, setProfileSearchQuery] = useState('');
    const [showLinkInstructions, setShowLinkInstructions] = useState(false);
    const [publicSearchQuery, setPublicSearchQuery] = useState('');
    const [publicSearchOwnerHint, setPublicSearchOwnerHint] = useState('');
    const [publicSearchResults, setPublicSearchResults] = useState<SpotifyPlaylistSearchResult[]>([]);
    const [publicSearchTotal, setPublicSearchTotal] = useState(0);
    const [publicSearchPerformedFor, setPublicSearchPerformedFor] = useState('');
    const [selectedSearchPlaylistIds, setSelectedSearchPlaylistIds] = useState<string[]>([]);
    const [isSearchingPublicPlaylists, setIsSearchingPublicPlaylists] = useState(false);

    const sourcePlaylistId = extractSpotifyPlaylistId(playlistUrl);
    const sourceUserId = extractSpotifyUserId(profileUrl);
    const importIsCurrent = importedForUrl === playlistUrl.trim();
    const currentTracks = importIsCurrent ? importedTracks : [];
    const profilePlaylistsAreCurrent = profilePlaylistsForUrl === profileUrl.trim();
    const currentProfilePlaylists = profilePlaylistsAreCurrent ? profilePlaylists : [];

    const filteredProfilePlaylists = React.useMemo(() => {
        if (!profileSearchQuery.trim()) return currentProfilePlaylists;
        const query = profileSearchQuery.toLowerCase();
        return currentProfilePlaylists.filter(p => p.name?.toLowerCase().includes(query));
    }, [currentProfilePlaylists, profileSearchQuery]);

    const filteredProfilePlaylistIds = filteredProfilePlaylists.map(playlist => playlist.id);
    const selectedProfilePlaylists = currentProfilePlaylists.filter(playlist => selectedPlaylistIds.includes(playlist.id));
    const selectedSearchPlaylists = publicSearchResults.filter(playlist => selectedSearchPlaylistIds.includes(playlist.id));
    const allFilteredPlaylistsSelected = filteredProfilePlaylists.length > 0 && filteredProfilePlaylists.every(p => selectedPlaylistIds.includes(p.id));
    const publicSearchHasRun = publicSearchPerformedFor === `${publicSearchQuery.trim()}|${publicSearchOwnerHint.trim()}`;

    const profilePlaylistPageCount = Math.ceil(filteredProfilePlaylists.length / PROFILE_PLAYLISTS_PER_PAGE);
    const paginatedProfilePlaylists = filteredProfilePlaylists.slice(
        profilePlaylistPage * PROFILE_PLAYLISTS_PER_PAGE,
        (profilePlaylistPage + 1) * PROFILE_PLAYLISTS_PER_PAGE
    );
    const playlistsPath = isGuest ? '/playlists?mode=guest' : `/playlists${isOnboarding ? '?onboarding=1' : ''}`;

    useEffect(() => {
        if (!isLoadingUser && !user && !isGuest) {
            navigate('/');
        }
    }, [isLoadingUser, navigate, user, isGuest]);

    useEffect(() => {
        if (isGuest && !isLoadingUser && !user) {
            signInAnonymously(auth).catch(err => {
                console.error("Failed to sign in guest anonymously in PlaylistImportSpotify:", err);
                setAuthError("Guest Mode authentication failed. Please ensure 'Anonymous sign-in' is enabled in your Firebase console.");
            });
        }
    }, [isGuest, isLoadingUser, user]);

    const validatePlaylistUrl = (url: string): string | null => {
        if (!url.trim()) return 'Enter a Spotify playlist URL.';
        try {
            const parsed = new URL(url.trim());
            if (!parsed.hostname.endsWith('spotify.com')) return 'This must be a spotify.com link.';
            const pathParts = parsed.pathname.split('/').filter(Boolean);
            if (pathParts[0] === 'user') return 'You entered a user profile link. Please use the "Import from profile" section above.';
            if (pathParts[0] === 'track') return 'This is a single track link. Please enter a playlist URL.';
            if (pathParts[0] === 'album') return 'This is an album link. Only playlists are supported.';
            if (pathParts[0] !== 'playlist') return 'This link doesn\'t look like a valid Spotify playlist.';
            if (!pathParts[1] || !/^[A-Za-z0-9]{22}$/.test(pathParts[1])) return 'The playlist ID in this URL is invalid or malformed.';
        } catch {
            return 'This doesn\'t look like a valid URL. Did you forget https://?';
        }
        return null;
    };

    const validateProfileUrl = (url: string): string | null => {
        if (!url.trim()) return 'Enter a Spotify profile URL.';
        try {
            const parsed = new URL(url.trim());
            if (!parsed.hostname.endsWith('spotify.com')) return 'This must be a spotify.com link.';
            const pathParts = parsed.pathname.split('/').filter(Boolean);
            if (pathParts[0] === 'playlist') return 'You entered a playlist link. Please use the "Import one playlist" section below.';
            if (pathParts[0] === 'track' || pathParts[0] === 'album') return 'Please enter a Spotify user profile URL, not a track or album.';
            if (pathParts[0] !== 'user') return 'This link doesn\'t look like a valid Spotify user profile.';
            if (!pathParts[1]) return 'The user ID in this URL is missing.';
        } catch {
            return 'This doesn\'t look like a valid URL. Did you forget https://?';
        }
        return null;
    };

    const handlePlaylistUrlChange = (value: string) => {
        setPlaylistUrl(value);
        setFormError('');
        setImportErrors([]);
        setSaveSuccessMessage('');
    };

    const handleProfileUrlChange = (value: string) => {
        setProfileUrl(value);
        setBatchImportResults([]);
        setFormError('');
        setProfilePlaylistPage(0);
        setProfileSearchQuery('');
        if (value.trim() !== profilePlaylistsForUrl) {
            setSelectedPlaylistIds([]);
        }
    };

    const handlePublicSearchChange = (value: string) => {
        setPublicSearchQuery(value);
        setFormError('');
        setBatchImportResults([]);
        setSaveSuccessMessage('');
        setSelectedSearchPlaylistIds([]);
        setPublicSearchResults([]);
        setPublicSearchTotal(0);
        setPublicSearchPerformedFor('');
    };

    const handlePublicSearchOwnerHintChange = (value: string) => {
        setPublicSearchOwnerHint(value);
        setFormError('');
        setBatchImportResults([]);
        setSelectedSearchPlaylistIds([]);
        setPublicSearchResults([]);
        setPublicSearchTotal(0);
        setPublicSearchPerformedFor('');
    };

    const handleSearchPublicPlaylists = async () => {
        const query = publicSearchQuery.trim();
        const ownerHint = publicSearchOwnerHint.trim();
        if (query.length < 2) {
            setFormError('Search for at least 2 characters.');
            return;
        }

        setFormError('');
        setImportErrors([]);
        setBatchImportResults([]);
        setSaveSuccessMessage('');
        setSelectedSearchPlaylistIds([]);
        setIsSearchingPublicPlaylists(true);
        try {
            const result = await searchPublicSpotifyPlaylists(query, ownerHint);
            setPublicSearchResults(result.playlists);
            setPublicSearchTotal(result.total || result.playlists.length);
            setPublicSearchPerformedFor(`${query}|${ownerHint}`);
            if (result.playlists.length === 0) {
                setFormError(ownerHint
                    ? 'No public playlist results matched that name and owner hint.'
                    : 'No public playlist results matched that search.');
            }
        } catch (error: any) {
            setFormError(error.message || 'Could not search Spotify playlists.');
        } finally {
            setIsSearchingPublicPlaylists(false);
        }
    };

    const handleImport = async () => {
        const urlError = validatePlaylistUrl(playlistUrl);
        if (urlError || !sourcePlaylistId) {
            setFormError(urlError || 'Enter a valid Spotify playlist URL first.');
            return;
        }

        setFormError('');
        setImportErrors([]);
        setSaveSuccessMessage('');
        setIsImporting(true);
        try {
            const result = await importSpotifyPlaylist(sourcePlaylistId, 0, 100);
            setImportedTracks(result.tracks);
            setImportedTotal(result.total || result.tracks.length);
            setImportedForUrl(playlistUrl.trim());
            setImportErrors(result.errors || []);

            if (result.name && (!playlistName.trim() || nameWasAutoFilled.current)) {
                setPlaylistName(result.name);
                nameWasAutoFilled.current = true;
            }
        } catch (error: any) {
            setFormError(error.message || 'Could not import playlist.');
        } finally {
            setIsImporting(false);
        }
    };

    const handleLoadProfilePlaylists = async () => {
        const urlError = validateProfileUrl(profileUrl);
        if (urlError || !sourceUserId) {
            setFormError(urlError || 'Enter a valid Spotify profile URL first.');
            return;
        }

        setFormError('');
        setImportErrors([]);
        setBatchImportResults([]);
        setProfilePlaylistPage(0);
        setProfileSearchQuery('');
        setIsLoadingProfilePlaylists(true);
        try {
            const result = await fetchSpotifyUserPlaylists(profileUrl);
            setProfilePlaylists(result.playlists);
            setProfilePlaylistsForUrl(profileUrl.trim());
            setSelectedPlaylistIds(result.playlists.map(playlist => playlist.id));
            if (result.playlists.length === 0) {
                setFormError('No public playlists were found for this Spotify profile.');
            }
        } catch (error: any) {
            setFormError(error.message || 'Could not load Spotify profile playlists.');
        } finally {
            setIsLoadingProfilePlaylists(false);
        }
    };

    const handleToggleSearchPlaylist = (playlistId: string) => {
        setSelectedSearchPlaylistIds(currentSelection => (
            currentSelection.includes(playlistId)
                ? currentSelection.filter(id => id !== playlistId)
                : [...currentSelection, playlistId]
        ));
    };

    const handleImportSearchPlaylists = async () => {
        if (selectedSearchPlaylists.length === 0) {
            setFormError('Select at least one playlist to import.');
            return;
        }

        setFormError('');
        setImportErrors([]);
        setBatchImportResults([]);
        setSaveSuccessMessage('');
        setIsBatchImporting(true);

        const results: BatchImportResult[] = [];
        for (const playlist of selectedSearchPlaylists) {
            try {
                const importedPlaylist = await importSpotifyPlaylist(playlist.id, 0, 100);
                if (importedPlaylist.tracks.length < 2) {
                    throw new Error('At least 2 tracks are required.');
                }

                const total = importedPlaylist.total || importedPlaylist.tracks.length;
                const status = total > importedPlaylist.tracks.length ? 'importing' : 'ready';

                await addManualPlaylist(
                    importedPlaylist.name || playlist.name,
                    playlist.externalUrl,
                    importedPlaylist.tracks,
                    status,
                    importedPlaylist.tracks.length,
                    total
                );
                const warningSuffix = importedPlaylist.errors?.length ? ` ${importedPlaylist.errors.join(' ')}` : '';
                results.push({
                    playlistId: playlist.id,
                    message: `Imported ${playlist.name}.${warningSuffix}`,
                    status: 'success'
                });
            } catch (error: any) {
                results.push({
                    playlistId: playlist.id,
                    message: `${playlist.name}: ${error.message || 'Could not import playlist.'}`,
                    status: 'error'
                });
            }

            setBatchImportResults([...results]);
        }

        setIsBatchImporting(false);
        if (results.some(result => result.status === 'success')) {
            setSelectedSearchPlaylistIds(currentSelection => currentSelection.filter(id => !results.some(result => result.playlistId === id && result.status === 'success')));
            if (isOnboarding || isGuest) {
                navigate(isGuest ? '/home?mode=guest' : '/home');
            }
        }
    };

    const handleTogglePlaylist = (playlistId: string) => {
        setSelectedPlaylistIds(currentSelection => (
            currentSelection.includes(playlistId)
                ? currentSelection.filter(id => id !== playlistId)
                : [...currentSelection, playlistId]
        ));
    };

    const handleToggleAllPlaylists = () => {
        if (allFilteredPlaylistsSelected) {
            setSelectedPlaylistIds(currentSelection => currentSelection.filter(id => !filteredProfilePlaylistIds.includes(id)));
        } else {
            setSelectedPlaylistIds(currentSelection => {
                const union = new Set([...currentSelection, ...filteredProfilePlaylistIds]);
                return Array.from(union);
            });
        }
    };

    const handleImportSelectedPlaylists = async () => {
        if (selectedProfilePlaylists.length === 0) {
            setFormError('Select at least one playlist to import.');
            return;
        }

        setFormError('');
        setImportErrors([]);
        setBatchImportResults([]);
        setSaveSuccessMessage('');
        setIsBatchImporting(true);

        const results: BatchImportResult[] = [];
        for (const playlist of selectedProfilePlaylists) {
            try {
                const importedPlaylist = await importSpotifyPlaylist(playlist.id, 0, 100);
                if (importedPlaylist.tracks.length < 2) {
                    throw new Error('At least 2 tracks are required.');
                }

                const total = importedPlaylist.total || importedPlaylist.tracks.length;
                const status = total > importedPlaylist.tracks.length ? 'importing' : 'ready';

                await addManualPlaylist(
                    importedPlaylist.name || playlist.name,
                    playlist.externalUrl,
                    importedPlaylist.tracks,
                    status,
                    importedPlaylist.tracks.length,
                    total
                );
                const warningSuffix = importedPlaylist.errors?.length ? ` ${importedPlaylist.errors.join(' ')}` : '';
                results.push({
                    playlistId: playlist.id,
                    message: `Imported ${playlist.name}.${warningSuffix}`,
                    status: 'success'
                });
            } catch (error: any) {
                results.push({
                    playlistId: playlist.id,
                    message: `${playlist.name}: ${error.message || 'Could not import playlist.'}`,
                    status: 'error'
                });
            }

            setBatchImportResults([...results]);
        }

        setIsBatchImporting(false);
        if (results.some(result => result.status === 'success')) {
            setSelectedPlaylistIds(currentSelection => currentSelection.filter(id => !results.some(result => result.playlistId === id && result.status === 'success')));
            if (isOnboarding || isGuest) {
                navigate(isGuest ? '/home?mode=guest' : '/home');
            }
        }
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setFormError('');
        setSaveSuccessMessage('');

        if (!playlistName.trim()) {
            setFormError('Playlist name is required.');
            return;
        }

        if (!playlistUrl.trim()) {
            setFormError('Spotify playlist URL is required.');
            return;
        }

        const urlError = validatePlaylistUrl(playlistUrl);
        if (urlError) {
            setFormError(urlError);
            return;
        }

        if (currentTracks.length < 2) {
            setFormError('Import the playlist first (at least 2 tracks required).');
            return;
        }

        setIsSaving(true);
        try {
            const total = importedTotal || currentTracks.length;
            const status = total > currentTracks.length ? 'importing' : 'ready';

            await addManualPlaylist(
                playlistName,
                playlistUrl,
                currentTracks,
                status,
                currentTracks.length,
                total
            );
            setSaveSuccessMessage(`Saved "${playlistName.trim()}". Paste another playlist URL to import another.`);
            setPlaylistUrl('');
            setPlaylistName('');
            setImportedTracks([]);
            setImportedTotal(0);
            setImportedForUrl('');
            setImportErrors([]);
            nameWasAutoFilled.current = false;
        } catch (error: any) {
            setFormError(error.message || 'Could not save playlist.');
        } finally {
            setIsSaving(false);
        }
    };

    const statusBadge = (
        <div className="status-stack">
            {isGuest ? (
                <span className="account-badge">Signed in as Guest</span>
            ) : (
                <SignedInBadge user={user} />
            )}
        </div>
    );

    const handleLogout = async () => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('tokenExpiry');
        localStorage.removeItem('verifier');
        sessionStorage.removeItem('accessToken');

        try {
            await signOut(auth);
        } catch { /* no active Firebase session */ }

        navigate('/');
    };

    const actionButtons = (
        <div className="action-row">
            <Link className="button button-secondary" to={playlistsPath}>
                Manage Playlists
            </Link>
            {(user || isLoadingUser) && (
                <button className="button button-danger" onClick={handleLogout}>
                    {isGuest ? 'Exit Guest Mode' : 'Sign Out'}
                </button>
            )}
        </div>
    );

    if (isLoadingUser) {
        return (
            <>
                <NavBar statusBadge={statusBadge} actionButtons={actionButtons} />
                <main className="page home-page">
                    <div className="loading-card">Checking account...</div>
                </main>
            </>
        );
    }

    return (
        <>
            <NavBar statusBadge={statusBadge} actionButtons={actionButtons} />
            <main className="page home-page">

                {authError && (
                    <div className="error-banner">
                        <strong>Authentication Error:</strong> {authError}
                    </div>
                )}

                <section className="record-bin">
                    <div>
                        <span className="eyebrow">{isGuest ? 'Spotify imports' : 'Your Spotify imports'}</span>
                        <h2 className="section-title">Import Playlists</h2>
                        <p className="body-copy" style={{ marginBottom: '16px' }}>
                            Search public Spotify playlists, import one playlist directly, or paste a Spotify profile URL to choose from that user's public playlists.
                        </p>
                    </div>

                    <div className="limit-status-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', width: 'fit-content', border: '2px solid var(--ink)', borderRadius: '999px', padding: '7px 12px', color: 'var(--ink)', fontSize: '0.85rem', fontWeight: 900, background: currentCount >= 30 ? 'rgba(215, 67, 50, 0.14)' : 'rgba(244, 185, 66, 0.22)', boxShadow: '3px 3px 0 rgba(33, 23, 15, 0.18)', marginBottom: '16px' }}>
                        <span className="dot" style={{ width: '8px', height: '8px', borderRadius: '50%', background: currentCount >= 30 ? 'var(--red)' : 'var(--teal)' }} />
                        <span>{currentCount} of 30 playlists used ({playlistsRemaining} remaining)</span>
                    </div>

                    <div className="inline-help-toggle" style={{ margin: '0 0 20px 0' }}>
                        <button
                            type="button"
                            className="text-link"
                            onClick={() => setShowLinkInstructions(!showLinkInstructions)}
                            style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.9rem', color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                        >
                            {showLinkInstructions ? 'Hide Instructions' : 'Need help finding Spotify playlist or profile links?'}
                        </button>

                        {showLinkInstructions && (
                            <div className="inline-help-drawer" style={{ marginTop: '12px', background: 'rgba(255, 248, 232, 0.58)', padding: '16px', borderRadius: '12px', border: '2px solid var(--ink)', fontSize: '0.85rem', color: 'var(--ink-soft)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div>
                                    <strong style={{ color: 'var(--teal)', display: 'block', marginBottom: '4px' }}>To find a Spotify Playlist URL:</strong>
                                    <ul style={{ margin: 0, paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <li><strong>On Desktop:</strong> Right-click the playlist title in your sidebar &rarr; Share &rarr; Copy link to playlist.</li>
                                        <li><strong>On Mobile:</strong> Tap the three dots under the playlist banner &rarr; Share &rarr; Copy link.</li>
                                    </ul>
                                </div>
                                <div>
                                    <strong style={{ color: 'var(--teal)', display: 'block', marginBottom: '4px' }}>To find a Spotify Profile URL:</strong>
                                    <ul style={{ margin: 0, paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <li><strong>On Desktop:</strong> Click your profile icon in the top right &rarr; Profile &rarr; Click the three dots under your name &rarr; Share &rarr; Copy link to profile.</li>
                                        <li><strong>On Mobile:</strong> Tap your profile picture &rarr; View Profile &rarr; Tap the three dots in the top right corner &rarr; Share &rarr; Copy link.</li>
                                    </ul>
                                </div>
                                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--ink-soft)' }}>
                                    You can also read our full <Link to="/help" style={{ color: 'var(--red)', textDecoration: 'underline' }}>Help & FAQ Page</Link> for detailed instructions on scoring, limits, and privacy.
                                </p>
                            </div>
                        )}
                    </div>

                    <form className="playlist-form" onSubmit={handleSubmit}>
                        <section className="import-flow-card">
                            <div>
                                <h3 className="subsection-title">Search public playlists</h3>
                                <p className="helper-text">Find public Spotify playlists by name or Spotify username. Add an owner name if you need to narrow down common playlist titles.</p>
                            </div>
                            <label className="form-label">
                                Playlist name
                                <input
                                    className="text-input"
                                    value={publicSearchQuery}
                                    onChange={(event) => handlePublicSearchChange(event.target.value)}
                                    placeholder="Road Trip, Workout, spotify-user..."
                                />
                            </label>
                            <label className="form-label">
                                Owner name or username (optional)
                                <input
                                    className="text-input"
                                    value={publicSearchOwnerHint}
                                    onChange={(event) => handlePublicSearchOwnerHintChange(event.target.value)}
                                    placeholder="Display name or Spotify username"
                                />
                            </label>
                            <div className="action-row">
                                <button
                                    className="button button-tertiary"
                                    type="button"
                                    onClick={handleSearchPublicPlaylists}
                                    disabled={isSearchingPublicPlaylists || isBatchImporting || publicSearchQuery.trim().length < 2 || (isGuest && !user)}
                                >
                                    {isSearchingPublicPlaylists ? 'Searching...' : 'Search Spotify'}
                                </button>
                                {publicSearchHasRun && publicSearchResults.length > 0 && (
                                    <span className="snippet-meter">
                                        {publicSearchResults.length} results shown{publicSearchTotal > publicSearchResults.length ? ` from ${publicSearchTotal.toLocaleString()} matches` : ''}
                                    </span>
                                )}
                            </div>

                            {publicSearchResults.length > 0 && (
                                <section className="profile-playlist-picker" aria-label="Spotify playlist search results">
                                    <div className="profile-playlist-picker-header">
                                        <div>
                                            <h3 className="subsection-title">Choose search results</h3>
                                            <p className="helper-text">Only public playlists can be found without Spotify login.</p>
                                        </div>
                                    </div>

                                    <ul className="profile-playlist-list">
                                        {publicSearchResults.map(playlist => (
                                            <li key={playlist.id}>
                                                <label className="profile-playlist-option search-playlist-option">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedSearchPlaylistIds.includes(playlist.id)}
                                                        onChange={() => handleToggleSearchPlaylist(playlist.id)}
                                                        disabled={isBatchImporting}
                                                    />
                                                    {playlist.imageUrl ? (
                                                        <img src={playlist.imageUrl} alt="" className="playlist-search-cover" />
                                                    ) : (
                                                        <div className="playlist-search-cover playlist-search-cover-fallback" aria-hidden="true" />
                                                    )}
                                                    <span>
                                                        <strong>{playlist.name}</strong>
                                                        <small>{playlist.ownerName} - {playlist.trackCount} tracks</small>
                                                    </span>
                                                </label>
                                            </li>
                                        ))}
                                    </ul>

                                    {currentCount + selectedSearchPlaylistIds.length > 30 && (
                                        <div className="error-banner" style={{ marginTop: '16px', marginBottom: '16px' }}>
                                            <strong>Limit Exceeded:</strong> Selecting these playlists would put you over your 30 playlist limit (You currently have {currentCount} playlists, and selected {selectedSearchPlaylistIds.length}. Limit is 30). Please deselect some playlists to continue.
                                        </div>
                                    )}

                                    <div className="action-row">
                                        <button
                                            className="button button-large"
                                            type="button"
                                            onClick={handleImportSearchPlaylists}
                                            disabled={isBatchImporting || selectedSearchPlaylists.length === 0 || (isGuest && !user) || (currentCount + selectedSearchPlaylistIds.length > 30)}
                                        >
                                            {isBatchImporting ? 'Importing Selected...' : `Import ${selectedSearchPlaylists.length} Selected`}
                                        </button>
                                    </div>
                                </section>
                            )}
                        </section>

                        <section className="import-flow-card">
                            <div>
                                <h3 className="subsection-title">Import from profile</h3>
                                <p className="helper-text">Paste a Spotify profile URL, then choose which public playlists to import.</p>
                            </div>
                            <label className="form-label">
                                Spotify profile URL
                                <input
                                    className="text-input"
                                    value={profileUrl}
                                    onChange={(event) => handleProfileUrlChange(event.target.value)}
                                    placeholder="https://open.spotify.com/user/..."
                                />
                            </label>

                            {profileUrl.trim() && !sourceUserId && (
                                <div className="inline-error">{validateProfileUrl(profileUrl) || 'This link does not contain a valid Spotify user ID.'}</div>
                            )}

                            {sourceUserId && (
                                <div className="action-row">
                                    <button
                                        className="button button-tertiary"
                                        type="button"
                                        onClick={handleLoadProfilePlaylists}
                                        disabled={isLoadingProfilePlaylists || isBatchImporting || (isGuest && !user)}
                                    >
                                        {isLoadingProfilePlaylists ? 'Loading...' : 'Load Public Playlists'}
                                    </button>
                                    {profilePlaylistsAreCurrent && currentProfilePlaylists.length > 0 && (
                                        <span className="snippet-meter">{currentProfilePlaylists.length} public playlists found</span>
                                    )}
                                </div>
                            )}

                            {currentProfilePlaylists.length > 0 && (
                                <section className="profile-playlist-picker" aria-label="Spotify profile playlists">
                                    <div className="profile-playlist-picker-header">
                                        <div>
                                            <h3 className="subsection-title">Choose playlists</h3>
                                            <p className="helper-text">Only public playlists are available without Spotify login.</p>
                                        </div>
                                        <button
                                            className="button button-secondary"
                                            type="button"
                                            onClick={handleToggleAllPlaylists}
                                            disabled={isBatchImporting}
                                        >
                                            {allFilteredPlaylistsSelected ? 'Clear All' : 'Select All'}
                                        </button>
                                    </div>

                                    <div className="filter-controls" style={{ marginTop: '12px', marginBottom: '16px' }}>
                                        <input
                                            type="text"
                                            className="text-input"
                                            placeholder="Search playlists..."
                                            value={profileSearchQuery}
                                            onChange={(e) => {
                                                setProfileSearchQuery(e.target.value);
                                                setProfilePlaylistPage(0);
                                            }}
                                            disabled={isBatchImporting}
                                        />
                                    </div>

                                    <ul className="profile-playlist-list">
                                        {paginatedProfilePlaylists.map(playlist => (
                                            <li key={playlist.id}>
                                                <label className="profile-playlist-option">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedPlaylistIds.includes(playlist.id)}
                                                        onChange={() => handleTogglePlaylist(playlist.id)}
                                                        disabled={isBatchImporting}
                                                    />
                                                    <span>
                                                        <strong>{playlist.name}</strong>
                                                        <small>{playlist.trackCount} tracks</small>
                                                    </span>
                                                </label>
                                            </li>
                                        ))}
                                    </ul>

                                    {profilePlaylistPageCount > 1 && (
                                        <div className="pagination-row">
                                            <button
                                                className="button button-quiet"
                                                type="button"
                                                disabled={profilePlaylistPage === 0 || isBatchImporting}
                                                onClick={() => setProfilePlaylistPage(page => page - 1)}
                                            >
                                                Previous
                                            </button>
                                            <span className="snippet-meter">Page {profilePlaylistPage + 1} of {profilePlaylistPageCount}</span>
                                            <button
                                                className="button button-quiet"
                                                type="button"
                                                disabled={profilePlaylistPage + 1 >= profilePlaylistPageCount || isBatchImporting}
                                                onClick={() => setProfilePlaylistPage(page => page + 1)}
                                            >
                                                Next
                                            </button>
                                        </div>
                                    )}

                                    {currentCount + selectedPlaylistIds.length > 30 && (
                                        <div className="error-banner" style={{ marginTop: '16px', marginBottom: '16px' }}>
                                            <strong>Limit Exceeded:</strong> Selecting these playlists would put you over your 30 playlist limit (You currently have {currentCount} playlists, and selected {selectedPlaylistIds.length}. Limit is 30). Please deselect some playlists to continue.
                                        </div>
                                    )}

                                    <div className="action-row">
                                        <button
                                            className="button button-large"
                                            type="button"
                                            onClick={handleImportSelectedPlaylists}
                                            disabled={isBatchImporting || selectedProfilePlaylists.length === 0 || (isGuest && !user) || (currentCount + selectedPlaylistIds.length > 30)}
                                        >
                                            {isBatchImporting ? 'Importing Selected...' : `Import ${selectedProfilePlaylists.length} Selected`}
                                        </button>
                                    </div>
                                </section>
                            )}

                            {batchImportResults.length > 0 && (
                                <ul className="compact-list import-result-list">
                                    {batchImportResults.map(result => (
                                        <li className={`import-result-${result.status}`} key={result.playlistId}>
                                            {result.message}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>

                        <section className="import-flow-card">
                            <div>
                                <h3 className="subsection-title">Import one playlist</h3>
                                <p className="helper-text">Paste a public Spotify playlist URL to import its tracks.</p>
                            </div>
                            <label className="form-label">
                                Spotify playlist URL
                                <input
                                    className="text-input"
                                    value={playlistUrl}
                                    onChange={(event) => handlePlaylistUrlChange(event.target.value)}
                                    placeholder="https://open.spotify.com/playlist/..."
                                />
                            </label>

                            {playlistUrl.trim() && !sourcePlaylistId && (
                                <div className="inline-error">{validatePlaylistUrl(playlistUrl) || 'This link does not contain a valid Spotify playlist ID.'}</div>
                            )}

                            {sourcePlaylistId && (
                                <div className="action-row">
                                    <button
                                        className="button button-tertiary"
                                        type="button"
                                        onClick={handleImport}
                                        disabled={isImporting || (isGuest && !user)}
                                    >
                                        {isImporting ? 'Importing...' : 'Import Tracks from Playlist'}
                                    </button>
                                    {importIsCurrent && currentTracks.length > 0 && (
                                        <span className="snippet-meter">
                                            {importedTotal > currentTracks.length
                                                ? `${importedTotal.toLocaleString()} tracks found (first 100 loaded, remainder will import in background)`
                                                : `${currentTracks.length} tracks imported`}
                                        </span>
                                    )}
                                </div>
                            )}

                            {importIsCurrent && currentTracks.length > 0 && (
                                <>
                                    <label className="form-label">
                                        Playlist name
                                        <input
                                            className="text-input"
                                            value={playlistName}
                                            onChange={(event) => {
                                                setPlaylistName(event.target.value);
                                                nameWasAutoFilled.current = false;
                                            }}
                                            placeholder="Road Trip Mix"
                                            required
                                        />
                                    </label>
                                    {currentCount >= 30 && (
                                        <div className="error-banner" style={{ marginTop: '16px', marginBottom: '16px' }}>
                                            <strong>Library Full:</strong> You have reached your limit of 30 playlists. Please delete some existing playlists from your Library to import more.
                                        </div>
                                    )}

                                </>
                            )}

                            {importErrors.length > 0 && (
                                <ul className="error-list compact-list">
                                    {importErrors.map(error => <li key={error}>{error}</li>)}
                                </ul>
                            )}

                            {currentTracks.length > 0 && (
                                <ul className="resolved-track-list">
                                    {currentTracks.slice(0, 12).map(track => (
                                        <li key={track.id}>
                                            <span>{track.name}</span>
                                            <span>{track.artists.map(artist => artist.name).join(', ')}</span>
                                        </li>
                                    ))}
                                    {currentTracks.length > 12 && <li>+ {currentTracks.length - 12} more tracks</li>}
                                </ul>
                            )}

                            {importIsCurrent && currentTracks.length >= 2 && (
                                <button className="button button-large" type="submit" disabled={isSaving || currentCount >= 30}>
                                    {isSaving ? 'Saving...' : 'Save Playlist'}
                                </button>
                            )}
                        </section>

                        {formError && <div className="error-banner">{formError}</div>}
                        {saveSuccessMessage && <div className="success-banner">{saveSuccessMessage}</div>}
                    </form>
                </section>
            </main>
        </>
    );
};

export default PlaylistImportSpotify;
