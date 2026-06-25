import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PlaylistImportSpotify from '../pages/PlaylistImportSpotify';
import { importSpotifyPlaylist } from '../utils/spotifyPlaylistImporter';
import { searchPublicSpotifyPlaylists } from '../utils/spotifyPlaylistSearch';
import { fetchSpotifyUserPlaylists } from '../utils/spotifyUserPlaylists';

const mocks = vi.hoisted(() => ({
    addManualPlaylist: vi.fn(),
    signInAnonymously: vi.fn(),
    signOut: vi.fn(),
    authState: {
        user: { uid: 'user-1', isAnonymous: false },
        isLoadingUser: false
    },
    manualState: {
        manualPlaylists: [] as Array<Record<string, unknown>>,
        isLoadingManualPlaylists: false,
        manualPlaylistError: '',
        addManualPlaylist: vi.fn()
    }
}));

vi.mock('../components/NavBar', () => ({
    default: ({ statusBadge, actionButtons }: { statusBadge?: React.ReactNode; actionButtons?: React.ReactNode }) => (
        <nav>
            {statusBadge}
            {actionButtons}
        </nav>
    )
}));

vi.mock('../components/SignedInBadge', () => ({
    default: () => <span>Signed in</span>
}));

vi.mock('../hooks/useTuneTeaserAuth', () => ({
    useTuneTeaserAuth: () => mocks.authState
}));

vi.mock('../hooks/useManualPlaylists', () => ({
    useManualPlaylists: () => mocks.manualState
}));

vi.mock('../utils/spotifyPlaylistImporter', () => ({
    importSpotifyPlaylist: vi.fn()
}));

vi.mock('../utils/spotifyPlaylistSearch', () => ({
    searchPublicSpotifyPlaylists: vi.fn()
}));

vi.mock('../utils/spotifyUserPlaylists', async () => {
    const actual = await vi.importActual<typeof import('../utils/spotifyUserPlaylists')>('../utils/spotifyUserPlaylists');
    return {
        ...actual,
        fetchSpotifyUserPlaylists: vi.fn()
    };
});

vi.mock('firebase/auth', () => ({
    signInAnonymously: mocks.signInAnonymously,
    signOut: mocks.signOut
}));

vi.mock('../backend/FirebaseConfig', () => ({
    auth: {}
}));

const track = (id: string, name: string) => ({
    id,
    name,
    artists: [{ name: 'Artist' }],
    album: { name: '', images: [] }
});

const renderPage = (initialEntry = '/playlists/import') => {
    render(
        <MemoryRouter initialEntries={[initialEntry]}>
            <Routes>
                <Route path="/playlists/import" element={<PlaylistImportSpotify />} />
                <Route path="/playlists" element={<div>Playlists Route</div>} />
                <Route path="/home" element={<div>Home Route</div>} />
                <Route path="/" element={<div>Login Route</div>} />
            </Routes>
        </MemoryRouter>
    );
};

describe('PlaylistImportSpotify page', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.authState.user = { uid: 'user-1', isAnonymous: false };
        mocks.authState.isLoadingUser = false;
        mocks.manualState.manualPlaylists = [];
        mocks.manualState.addManualPlaylist = mocks.addManualPlaylist;
    });

    it('imports one playlist, auto-fills the name, and saves background-import metadata', async () => {
        const user = userEvent.setup();
        vi.mocked(importSpotifyPlaylist).mockResolvedValue({
            name: 'Imported Road Trip',
            tracks: [track('t1', 'Song One'), track('t2', 'Song Two')],
            total: 5,
            errors: ['Skipped one unavailable track.']
        });

        renderPage();

        await user.type(
            screen.getByLabelText(/spotify playlist url/i),
            'https://open.spotify.com/playlist/1234567890123456789012'
        );
        await user.click(screen.getByRole('button', { name: /import tracks from playlist/i }));

        await waitFor(() => {
            expect(importSpotifyPlaylist).toHaveBeenCalledWith('1234567890123456789012', 0, 100);
        });

        expect(screen.getByDisplayValue('Imported Road Trip')).toBeInTheDocument();
        expect(screen.getByText(/5 tracks found/i)).toBeInTheDocument();
        expect(screen.getByText('Skipped one unavailable track.')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: /save playlist/i }));

        await waitFor(() => {
            expect(mocks.addManualPlaylist).toHaveBeenCalledWith(
                'Imported Road Trip',
                'https://open.spotify.com/playlist/1234567890123456789012',
                expect.arrayContaining([expect.objectContaining({ id: 't1' })]),
                'importing',
                2,
                5
            );
        });
        expect(screen.getByText(/saved "imported road trip"/i)).toBeInTheDocument();
    });

    it('searches public playlists and imports selected search results', async () => {
        const user = userEvent.setup();
        vi.mocked(searchPublicSpotifyPlaylists).mockResolvedValue({
            total: 1,
            playlists: [
                {
                    id: 'search-a',
                    name: 'Road Trip',
                    ownerName: 'Jamie',
                    trackCount: 14,
                    imageUrl: 'https://image.example/cover.jpg',
                    externalUrl: 'https://open.spotify.com/playlist/search-a'
                }
            ]
        });
        vi.mocked(importSpotifyPlaylist).mockResolvedValue({
            name: 'Road Trip',
            tracks: [track('sa1', 'Search Song One'), track('sa2', 'Search Song Two')],
            total: 2,
            errors: []
        });

        renderPage();

        await user.type(screen.getByLabelText(/^playlist name$/i), 'Road Trip');
        await user.type(screen.getByLabelText(/owner name or username/i), 'Jamie');
        await user.click(screen.getByRole('button', { name: /search spotify/i }));

        await waitFor(() => {
            expect(searchPublicSpotifyPlaylists).toHaveBeenCalledWith('Road Trip', 'Jamie');
        });

        const resultRow = screen.getByText('Road Trip').closest('label');
        expect(resultRow).not.toBeNull();
        await user.click(within(resultRow as HTMLElement).getByRole('checkbox'));
        await user.click(screen.getByRole('button', { name: /import 1 selected/i }));

        await waitFor(() => {
            expect(importSpotifyPlaylist).toHaveBeenCalledWith('search-a', 0, 100);
            expect(mocks.addManualPlaylist).toHaveBeenCalledWith(
                'Road Trip',
                'https://open.spotify.com/playlist/search-a',
                expect.arrayContaining([expect.objectContaining({ id: 'sa1' })]),
                'ready',
                2,
                2
            );
        });
        expect(screen.getByText(/imported road trip/i)).toBeInTheDocument();
    });

    it('loads profile playlists, enforces the playlist limit, and imports the remaining selected playlist', async () => {
        const user = userEvent.setup();
        mocks.manualState.manualPlaylists = Array.from({ length: 29 }, (_, index) => ({ id: `existing-${index}` }));
        vi.mocked(fetchSpotifyUserPlaylists).mockResolvedValue({
            userId: 'test-user',
            playlists: [
                { id: 'profile-a', name: 'Profile A', trackCount: 12, externalUrl: 'https://spotify/profile-a' },
                { id: 'profile-b', name: 'Profile B', trackCount: 18, externalUrl: 'https://spotify/profile-b' }
            ]
        });
        vi.mocked(importSpotifyPlaylist).mockResolvedValue({
            name: 'Profile A',
            tracks: [track('pa1', 'Profile Song One'), track('pa2', 'Profile Song Two')],
            total: 2,
            errors: []
        });

        renderPage();

        await user.type(screen.getByLabelText(/spotify profile url/i), 'https://open.spotify.com/user/test-user');
        await user.click(screen.getByRole('button', { name: /load public playlists/i }));

        await waitFor(() => {
            expect(screen.getByText('Profile A')).toBeInTheDocument();
            expect(screen.getByText('Profile B')).toBeInTheDocument();
        });

        expect(screen.getByText(/limit exceeded/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /import 2 selected/i })).toBeDisabled();

        const profileBRow = screen.getByText('Profile B').closest('label');
        expect(profileBRow).not.toBeNull();
        await user.click(within(profileBRow as HTMLElement).getByRole('checkbox'));

        await user.click(screen.getByRole('button', { name: /import 1 selected/i }));

        await waitFor(() => {
            expect(importSpotifyPlaylist).toHaveBeenCalledWith('profile-a', 0, 100);
            expect(mocks.addManualPlaylist).toHaveBeenCalledWith(
                'Profile A',
                'https://spotify/profile-a',
                expect.arrayContaining([expect.objectContaining({ id: 'pa1' })]),
                'ready',
                2,
                2
            );
        });
        expect(screen.getByText(/imported profile a/i)).toBeInTheDocument();
    });
});
