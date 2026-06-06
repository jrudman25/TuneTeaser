import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PlaylistCreateCustom from '../pages/PlaylistCreateCustom';
import { resolveSpotifyTracks } from '../utils/spotifyTrackResolver';

const mocks = vi.hoisted(() => ({
    addManualPlaylist: vi.fn(),
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

vi.mock('../utils/spotifyTrackResolver', () => ({
    resolveSpotifyTracks: vi.fn()
}));

vi.mock('firebase/auth', () => ({
    signOut: mocks.signOut
}));

vi.mock('../backend/FirebaseConfig', () => ({
    auth: {}
}));

const renderPage = (initialEntry = '/playlists/custom') => {
    render(
        <MemoryRouter initialEntries={[initialEntry]}>
            <Routes>
                <Route path="/playlists/custom" element={<PlaylistCreateCustom />} />
                <Route path="/playlists" element={<div>Playlists Route</div>} />
                <Route path="/home" element={<div>Home Route</div>} />
                <Route path="/" element={<div>Login Route</div>} />
            </Routes>
        </MemoryRouter>
    );
};

describe('PlaylistCreateCustom', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.authState.user = { uid: 'user-1', isAnonymous: false };
        mocks.authState.isLoadingUser = false;
        mocks.manualState.manualPlaylists = [];
        mocks.manualState.addManualPlaylist = mocks.addManualPlaylist;
    });

    it('requires Spotify track links to be resolved before saving, then saves resolved and manual tracks', async () => {
        const user = userEvent.setup();
        vi.mocked(resolveSpotifyTracks).mockResolvedValue({
            tracks: [
                { id: 'spotify-1', name: 'Resolved Song', artists: [{ name: 'Resolved Artist' }], album: { name: '', images: [] } }
            ],
            errors: []
        });

        renderPage();

        await user.type(screen.getByLabelText(/playlist name/i), 'Road Trip');
        await user.type(
            screen.getByLabelText(/^tracks$/i),
            'https://open.spotify.com/track/1234567890123456789012\nManual Song - Manual Artist'
        );

        await user.click(screen.getByRole('button', { name: /save playlist/i }));
        expect(screen.getByText(/resolve the spotify track links before saving/i)).toBeInTheDocument();
        expect(mocks.addManualPlaylist).not.toHaveBeenCalled();

        await user.click(screen.getByRole('button', { name: /resolve tracks/i }));

        await waitFor(() => {
            expect(resolveSpotifyTracks).toHaveBeenCalledWith(['1234567890123456789012']);
        });
        expect(screen.getByText('Resolved Song')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: /save playlist/i }));

        await waitFor(() => {
            expect(mocks.addManualPlaylist).toHaveBeenCalledWith(
                'Road Trip',
                '',
                expect.arrayContaining([
                    expect.objectContaining({ name: 'Manual Song' }),
                    expect.objectContaining({ name: 'Resolved Song' })
                ])
            );
        });
        expect(screen.getByText('Playlists Route')).toBeInTheDocument();
    });

    it('blocks creation when the playlist limit is reached', () => {
        mocks.manualState.manualPlaylists = Array.from({ length: 30 }, (_, index) => ({ id: `p-${index}` }));

        renderPage();

        expect(screen.getByText(/you have reached your limit of 30 playlists/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /save playlist/i })).toBeDisabled();
    });

    it('returns onboarding users to home after a successful save', async () => {
        const user = userEvent.setup();
        renderPage('/playlists/custom?onboarding=1');

        await user.type(screen.getByLabelText(/playlist name/i), 'Starter Mix');
        await user.type(screen.getByLabelText(/^tracks$/i), 'Song One - Artist One\nSong Two - Artist Two');
        await user.click(screen.getByRole('button', { name: /save playlist/i }));

        await waitFor(() => {
            expect(mocks.addManualPlaylist).toHaveBeenCalled();
        });
        expect(screen.getByText('Home Route')).toBeInTheDocument();
    });
});
