import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ManualTrack } from '../utils/manualPlaylists';
import { useManualPlaylists } from '../hooks/useManualPlaylists';
import { useTuneTeaserAuth } from '../hooks/useTuneTeaserAuth';
import { extractSpotifyPlaylistId } from '../utils/spotifyPlaylistName';
import { importSpotifyPlaylist } from '../utils/spotifyPlaylistImporter';
import { extractSpotifyUserId, fetchSpotifyUserPlaylists, SpotifyUserPlaylist } from '../utils/spotifyUserPlaylists';
import SignedInBadge from '../components/SignedInBadge';

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
    const { user, isLoadingUser } = useTuneTeaserAuth();
    const { addManualPlaylist } = useManualPlaylists(user);

    const [playlistUrl, setPlaylistUrl] = useState('');
    const [profileUrl, setProfileUrl] = useState('');
    const [playlistName, setPlaylistName] = useState('');
    const nameWasAutoFilled = useRef(false);
    const [isImporting, setIsImporting] = useState(false);
    const [importedTracks, setImportedTracks] = useState<ManualTrack[]>([]);
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

    const sourcePlaylistId = extractSpotifyPlaylistId(playlistUrl);
    const sourceUserId = extractSpotifyUserId(profileUrl);
    const importIsCurrent = importedForUrl === playlistUrl.trim();
    const currentTracks = importIsCurrent ? importedTracks : [];
    const profilePlaylistsAreCurrent = profilePlaylistsForUrl === profileUrl.trim();
    const currentProfilePlaylists = profilePlaylistsAreCurrent ? profilePlaylists : [];
    const allProfilePlaylistIds = currentProfilePlaylists.map(playlist => playlist.id);
    const selectedProfilePlaylists = currentProfilePlaylists.filter(playlist => selectedPlaylistIds.includes(playlist.id));
    const allProfilePlaylistsSelected = currentProfilePlaylists.length > 0 && selectedProfilePlaylists.length === currentProfilePlaylists.length;
    const profilePlaylistPageCount = Math.ceil(currentProfilePlaylists.length / PROFILE_PLAYLISTS_PER_PAGE);
    const paginatedProfilePlaylists = currentProfilePlaylists.slice(
        profilePlaylistPage * PROFILE_PLAYLISTS_PER_PAGE,
        (profilePlaylistPage + 1) * PROFILE_PLAYLISTS_PER_PAGE
    );
    const playlistsPath = `/playlists${isOnboarding ? '?onboarding=1' : ''}`;

    useEffect(() => {
        if (!isLoadingUser && !user) {
            navigate('/');
        }
    }, [isLoadingUser, navigate, user]);

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
        if (value.trim() !== profilePlaylistsForUrl) {
            setSelectedPlaylistIds([]);
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
            const result = await importSpotifyPlaylist(sourcePlaylistId);
            setImportedTracks(result.tracks);
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

    const handleTogglePlaylist = (playlistId: string) => {
        setSelectedPlaylistIds(currentSelection => (
            currentSelection.includes(playlistId)
                ? currentSelection.filter(id => id !== playlistId)
                : [...currentSelection, playlistId]
        ));
    };

    const handleToggleAllPlaylists = () => {
        setSelectedPlaylistIds(allProfilePlaylistsSelected ? [] : allProfilePlaylistIds);
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
                const importedPlaylist = await importSpotifyPlaylist(playlist.id);
                if (importedPlaylist.tracks.length < 2) {
                    throw new Error('At least 2 tracks are required.');
                }

                await addManualPlaylist(importedPlaylist.name || playlist.name, playlist.externalUrl, importedPlaylist.tracks);
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
            if (isOnboarding) {
                navigate('/home');
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
            await addManualPlaylist(playlistName, playlistUrl, currentTracks);
            setSaveSuccessMessage(`Saved "${playlistName.trim()}". Paste another playlist URL to import another.`);
            setPlaylistUrl('');
            setPlaylistName('');
            setImportedTracks([]);
            setImportedForUrl('');
            setImportErrors([]);
            nameWasAutoFilled.current = false;
        } catch (error: any) {
            setFormError(error.message || 'Could not save playlist.');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoadingUser) {
        return (
            <main className="page home-page">
                <div className="loading-card">Checking account...</div>
            </main>
        );
    }

    return (
        <main className="page home-page">
            <section className="top-strip">
                <div className="status-stack">
                    <span className="status-badge">Import from Spotify</span>
                    <SignedInBadge user={user} />
                </div>
                <Link className="button button-secondary" to={playlistsPath}>
                    Back to Playlists
                </Link>
            </section>

            <section className="record-bin">
                <div>
                    <span className="eyebrow">Spotify imports</span>
                    <h2 className="section-title">Import Playlists</h2>
                    <p className="body-copy">
                        Import one public playlist directly, or paste a Spotify profile URL to choose from that user's public playlists.
                    </p>
                </div>

                <form className="playlist-form" onSubmit={handleSubmit}>
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

                        {sourceUserId && (
                            <div className="action-row">
                                <button
                                    className="button button-tertiary"
                                    type="button"
                                    onClick={handleLoadProfilePlaylists}
                                    disabled={isLoadingProfilePlaylists || isBatchImporting}
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
                                        {allProfilePlaylistsSelected ? 'Clear All' : 'Select All'}
                                    </button>
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

                                <div className="action-row">
                                    <button
                                        className="button button-large"
                                        type="button"
                                        onClick={handleImportSelectedPlaylists}
                                        disabled={isBatchImporting || selectedProfilePlaylists.length === 0}
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

                        {sourcePlaylistId && (
                            <div className="action-row">
                                <button
                                    className="button button-tertiary"
                                    type="button"
                                    onClick={handleImport}
                                    disabled={isImporting}
                                >
                                    {isImporting ? 'Importing...' : 'Import Tracks from Playlist'}
                                </button>
                                {importIsCurrent && currentTracks.length > 0 && (
                                    <span className="snippet-meter">{currentTracks.length} tracks imported</span>
                                )}
                            </div>
                        )}

                        {importIsCurrent && currentTracks.length > 0 && (
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
                            <button className="button button-large" type="submit" disabled={isSaving}>
                                {isSaving ? 'Saving...' : 'Save Playlist'}
                            </button>
                        )}
                    </section>

                    {formError && <div className="error-banner">{formError}</div>}
                    {saveSuccessMessage && <div className="success-banner">{saveSuccessMessage}</div>}
                </form>
            </section>
        </main>
    );
};

export default PlaylistImportSpotify;
