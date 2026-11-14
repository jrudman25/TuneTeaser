/**
 * Home.page.test.tsx
 * Tests the Home page navigation behavior while a solo round is active:
 * the Home nav control returns to playlist selection instead of dead-ending.
 * @version 2026.06.05
 */
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Home from '../pages/Home';
import { ManualPlaylist } from '../utils/manualPlaylists';

const mocks = vi.hoisted(() => ({
    authState: {
        user: { uid: 'user-1', isAnonymous: false },
        isLoadingUser: false
    },
    manualState: {
        manualPlaylists: [] as ManualPlaylist[],
        isLoadingManualPlaylists: false,
        manualPlaylistError: ''
    },
    playlistState: {
        playlists: [] as Array<{ id: string; name: string }>,
        isLoadingPlaylists: false,
        playlistError: ''
    },
    playPreview: vi.fn()
}));

const mockStartSoloRound = vi.fn();
const mockSubmitSoloGuess = vi.fn();
const mockGiveUpSoloRound = vi.fn();

vi.mock('../utils/soloRounds', () => ({
    startSoloRound: (...args: unknown[]) => mockStartSoloRound(...args),
    submitSoloGuess: (...args: unknown[]) => mockSubmitSoloGuess(...args),
    giveUpSoloRound: (...args: unknown[]) => mockGiveUpSoloRound(...args)
}));

vi.mock('../utils/spotifyPlaylistImporter', () => ({
    getManualPlaylistTracks: vi.fn(async () => [])
}));

vi.mock('../backend/FirebaseConfig', () => ({
    auth: { currentUser: { uid: 'user-1' } }
}));

vi.mock('firebase/auth', () => ({
    signOut: vi.fn()
}));

vi.mock('../utils/guestSignIn', () => ({
    signInAsGuest: vi.fn(),
    signOutExplicitly: vi.fn()
}));

vi.mock('../utils/analytics', () => ({
    initAnalytics: vi.fn(),
    trackEvent: vi.fn()
}));

vi.mock('../hooks/useTuneTeaserAuth', () => ({
    useTuneTeaserAuth: () => mocks.authState
}));

vi.mock('../hooks/useManualPlaylists', () => ({
    useManualPlaylists: () => mocks.manualState
}));

vi.mock('../hooks/usePlaylists', () => ({
    usePlaylists: () => mocks.playlistState
}));

vi.mock('../hooks/usePreviewPlayer', () => ({
    default: () => ({
        playPreview: mocks.playPreview,
        pause: vi.fn(),
        isPlaying: false,
        error: null,
        volume: 0.5,
        setVolume: vi.fn(),
        positionMs: 0,
        playbackDurationMs: 0,
        preloadPreview: vi.fn()
    })
}));

const makeTrack = (id: string, name: string) => ({
    id,
    name,
    artists: [{ name: 'Artist' }],
    album: { name: 'Album', images: [] }
});

const manualPlaylist: ManualPlaylist = {
    id: 'manual1',
    name: 'My Mix',
    sourceUrl: '',
    sourceType: 'spotify-url',
    tracks: [makeTrack('t1', 'Song One'), makeTrack('t2', 'Song Two')]
};

const ROUND = {
    roundId: 'round-1',
    previewUrl: 'https://preview.example/x.m4a',
    snippetDurationMs: 2000,
    eligibleForPoints: true,
    playableTrackCount: 2
};

const ANSWER = {
    id: 't1',
    name: 'Song One',
    artists: [{ name: 'Artist' }],
    album: { name: 'Album', images: [] }
};

const renderHome = () => render(
    <MemoryRouter initialEntries={['/home']}>
        <Routes>
            <Route path="/home" element={<Home />} />
            <Route path="/multiplayer" element={<div>Multiplayer</div>} />
            <Route path="/leaderboard" element={<div>Leaderboard Page</div>} />
            <Route path="/settings" element={<div>Settings Page</div>} />
            <Route path="/playlists" element={<div>Playlists Page</div>} />
        </Routes>
    </MemoryRouter>
);

const startRound = async (user: ReturnType<typeof userEvent.setup>) => {
    await act(async () => {
        await user.click(await screen.findByRole('button', { name: /My Mix/ }));
    });
    await screen.findByRole('button', { name: 'Play snippet' });
};

const endRound = async (user: ReturnType<typeof userEvent.setup>) => {
    mockSubmitSoloGuess.mockResolvedValue({
        result: 'correct',
        snippetDurationMs: 2000,
        pointsAwarded: 10,
        answer: ANSWER
    });
    const guessInput = screen.getByLabelText('Enter song title...');
    await user.type(guessInput, 'Song One');
    await act(async () => {
        await user.click(screen.getByRole('button', { name: 'Guess' }));
    });
    await screen.findByRole('button', { name: 'Next Track (N)' });
};

describe('Home page navigation during solo play', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        window.scrollTo = vi.fn();
        mockStartSoloRound.mockResolvedValue(ROUND);
        mocks.manualState.manualPlaylists = [manualPlaylist];
        mocks.playlistState.playlists = [
            { id: 'manual1', name: 'My Mix' }
        ];
    });

    it('asks for confirmation before leaving an active round', async () => {
        const user = userEvent.setup();
        renderHome();
        await startRound(user);

        await user.click(screen.getByRole('link', { name: 'Home' }));

        expect(await screen.findByText('Leave this round?')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Play snippet' })).toBeInTheDocument();
    });

    it('returns to the playlist picker when leaving is confirmed', async () => {
        const user = userEvent.setup();
        renderHome();
        await startRound(user);

        await user.click(screen.getByRole('link', { name: 'Home' }));
        await user.click(await screen.findByRole('button', { name: 'Leave Round' }));

        expect(await screen.findByText('Choose your playlist')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Play snippet' })).not.toBeInTheDocument();
    });

    it('keeps the round when leaving is cancelled', async () => {
        const user = userEvent.setup();
        renderHome();
        await startRound(user);

        await user.click(screen.getByRole('link', { name: 'Home' }));
        await user.click(await screen.findByRole('button', { name: 'Cancel' }));

        expect(screen.queryByText('Leave this round?')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Play snippet' })).toBeInTheDocument();
    });

    it('returns to the playlist picker without confirming once the round has ended', async () => {
        const user = userEvent.setup();
        renderHome();
        await startRound(user);
        await endRound(user);

        await user.click(screen.getByRole('link', { name: 'Home' }));

        expect(await screen.findByText('Choose your playlist')).toBeInTheDocument();
        expect(screen.queryByText('Leave this round?')).not.toBeInTheDocument();
    });

    it('asks for confirmation via the in-game Back button and returns to the playlist picker', async () => {
        const user = userEvent.setup();
        renderHome();
        await startRound(user);

        await user.click(screen.getByRole('button', { name: 'Back to playlist selection' }));

        expect(await screen.findByText('Leave this round?')).toBeInTheDocument();
        expect(screen.getByText('You will go back to playlist selection and this round will not score.')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Leave Round' }));

        expect(await screen.findByText('Choose your playlist')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Play snippet' })).not.toBeInTheDocument();
    });

    it('starts the next track when N is pressed on the result screen', async () => {
        const user = userEvent.setup();
        renderHome();
        await startRound(user);
        await endRound(user);

        await act(async () => {
            await user.keyboard('n');
        });

        expect(await screen.findByRole('button', { name: 'Play snippet' })).toBeInTheDocument();

        await user.keyboard('{Enter}');
        expect(screen.getByLabelText('Enter song title...')).toHaveFocus();
    });

    it('navigates to other pages without confirming once the round has ended', async () => {
        const user = userEvent.setup();
        renderHome();
        await startRound(user);
        await endRound(user);

        await user.click(screen.getByRole('link', { name: 'Leaderboard' }));

        expect(await screen.findByText('Leaderboard Page')).toBeInTheDocument();
        expect(screen.queryByText('Leave this round?')).not.toBeInTheDocument();
    });

    it('confirms before navigating to another page during an active round', async () => {
        const user = userEvent.setup();
        renderHome();
        await startRound(user);

        await user.click(screen.getByRole('link', { name: 'Leaderboard' }));

        expect(await screen.findByText('Leave this round?')).toBeInTheDocument();
        expect(screen.getByText('This round will not score if you leave now.')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Leave Round' }));

        expect(await screen.findByText('Leaderboard Page')).toBeInTheDocument();
    });

    it('keeps the round when navigating to another page is cancelled', async () => {
        const user = userEvent.setup();
        renderHome();
        await startRound(user);

        await user.click(screen.getByRole('link', { name: 'Leaderboard' }));
        await user.click(await screen.findByRole('button', { name: 'Cancel' }));

        expect(screen.queryByText('Leave this round?')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Play snippet' })).toBeInTheDocument();
    });

    it('confirms before navigating to Settings during an active round', async () => {
        const user = userEvent.setup();
        renderHome();
        await startRound(user);

        await user.click(screen.getByRole('button', { name: 'Open profile menu' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Settings' }));

        expect(await screen.findByText('Leave this round?')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Play snippet' })).toBeInTheDocument();
    });

    it('confirms before navigating to Manage Playlists during an active round', async () => {
        const user = userEvent.setup();
        renderHome();
        await startRound(user);

        await user.click(screen.getByRole('button', { name: 'Open profile menu' }));
        await user.click(await screen.findByRole('link', { name: 'Manage Playlists' }));

        expect(await screen.findByText('Leave this round?')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Play snippet' })).toBeInTheDocument();
    });

    it('confirms before navigating to Multiplayer during an active round', async () => {
        const user = userEvent.setup();
        renderHome();
        await startRound(user);

        await user.click(screen.getByRole('link', { name: 'Multiplayer' }));

        expect(await screen.findByText('Leave this round?')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Leave Round' }));

        expect(await screen.findByText('Multiplayer')).toBeInTheDocument();
    });

    it('Escape closes the leave dialog without opening the give-up dialog', async () => {
        const user = userEvent.setup();
        renderHome();
        await startRound(user);

        await user.click(screen.getByRole('link', { name: 'Leaderboard' }));
        expect(await screen.findByText('Leave this round?')).toBeInTheDocument();

        await user.keyboard('{Escape}');

        await waitFor(() => expect(screen.queryByText('Leave this round?')).not.toBeInTheDocument());
        expect(screen.queryByText('Give up this round?')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Play snippet' })).toBeInTheDocument();
    });

    it('does not play the snippet on Space while the leave dialog is open', async () => {
        const user = userEvent.setup();
        renderHome();
        await startRound(user);

        await user.click(screen.getByRole('link', { name: 'Leaderboard' }));
        await screen.findByText('Leave this round?');

        fireEvent.keyDown(document.body, { key: ' ' });
        expect(mocks.playPreview).not.toHaveBeenCalled();

        await user.keyboard('{Escape}');
        await waitFor(() => expect(screen.queryByText('Leave this round?')).not.toBeInTheDocument());

        fireEvent.keyDown(document.body, { key: ' ' });
        expect(mocks.playPreview).toHaveBeenCalled();
    });
});
