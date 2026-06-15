import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Multiplayer from '../pages/Multiplayer';
import {
    createMultiplayerRoom,
    getMultiplayerRoundData,
    giveUpMultiplayerRound,
    joinMultiplayerRoom,
    kickMultiplayerPlayer,
    leaveMultiplayerRoom,
    playMultiplayerAgain,
    returnMultiplayerToLobby,
    startMultiplayerGame,
    subscribeToMultiplayerRoom,
    submitMultiplayerGuess,
    updateMultiplayerRoomSettings
} from '../utils/multiplayer';

const mocks = vi.hoisted(() => ({
    signInAnonymously: vi.fn(),
    signOut: vi.fn(),
    roomSnapshot: null as Record<string, unknown> | null,
    playersSnapshot: [] as Array<Record<string, unknown>>,
    authState: {
        user: { uid: 'host-1', isAnonymous: false },
        isLoadingUser: false
    },
    getIdToken: vi.fn(),
    manualState: {
        manualPlaylists: [] as Array<Record<string, unknown>>,
        isLoadingManualPlaylists: false,
        manualPlaylistError: ''
    },
    playlistState: {
        playlists: [
            { id: 'playlist-1', name: 'Party Mix', tracks: { total: 20 } },
            { id: 'playlist-2', name: 'Chill Mix', tracks: { total: 10 } }
        ],
        isLoadingPlaylists: false,
        playlistError: ''
    }
}));

vi.mock('../components/NavBar', () => ({
    default: ({ actionButtons }: { actionButtons?: React.ReactNode }) => <nav>{actionButtons}</nav>
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
        playPreview: vi.fn(),
        pause: vi.fn(),
        isPlaying: false,
        error: null,
        volume: 0.5,
        setVolume: vi.fn()
    })
}));

vi.mock('../utils/multiplayer', () => ({
    createMultiplayerRoom: vi.fn(),
    joinMultiplayerRoom: vi.fn(),
    updateMultiplayerRoomSettings: vi.fn(),
    startMultiplayerGame: vi.fn(),
    kickMultiplayerPlayer: vi.fn(),
    leaveMultiplayerRoom: vi.fn(),
    getMultiplayerRoundData: vi.fn(),
    submitMultiplayerGuess: vi.fn(),
    giveUpMultiplayerRound: vi.fn(),
    playMultiplayerAgain: vi.fn(),
    returnMultiplayerToLobby: vi.fn(),
    getFunctionsUrl: vi.fn(() => 'http://localhost:5001/tuneteaser/us-central1/leaveMultiplayerRoom'),
    subscribeToMultiplayerRoom: vi.fn((_roomId, onRoom) => {
        onRoom(mocks.roomSnapshot);
        return vi.fn();
    }),
    subscribeToMultiplayerPlayers: vi.fn((_roomId, onPlayers) => {
        onPlayers(mocks.playersSnapshot);
        return vi.fn();
    })
}));

vi.mock('firebase/auth', () => ({
    signInAnonymously: mocks.signInAnonymously,
    signOut: mocks.signOut
}));

vi.mock('../backend/FirebaseConfig', () => ({
    auth: { currentUser: { uid: 'host-1', getIdToken: mocks.getIdToken } }
}));

const room = {
    id: 'ABC123',
    roomName: 'Friday Party',
    hostUid: 'host-1',
    status: 'lobby',
    visibility: 'private',
    maxPlayers: 5,
    pointGoal: 100,
    playerCount: 2,
    playlistId: 'playlist-1',
    playlistName: 'Party Mix',
    createdAt: 1,
    updatedAt: 1,
    expiresAt: 1
};

const hostPlayer = {
    uid: 'host-1',
    displayName: 'Host User',
    isHost: true,
    score: 0,
    state: 'lobby',
    joinedAt: 1,
    updatedAt: 1
};

const guestPlayer = {
    uid: 'guest-1',
    displayName: 'Guest User',
    isHost: false,
    score: 15,
    state: 'lobby',
    joinedAt: 2,
    updatedAt: 2
};

const playingRoom = {
    ...room,
    status: 'playing',
    currentRound: {
        id: 'round-1',
        trackId: 'track-1',
        artistName: 'Artist One',
        albumName: 'Album One',
        artworkUrl: null,
        answerHash: 'hash',
        startedAt: 10,
        snippetDurationMs: 2000,
        state: 'playing',
        roundNumber: 1
    }
};

const guessingHostPlayer = {
    ...hostPlayer,
    state: 'guessing',
    currentRoundId: 'round-1',
    roundSnippetDurationMs: 2000
};

const correctGuestPlayer = {
    ...guestPlayer,
    score: 25,
    state: 'correct',
    currentRoundId: 'round-1',
    roundSnippetDurationMs: 2000,
    lastEarnedPoints: 25
};

const endedRoom = {
    ...room,
    status: 'ended',
    winnerUid: 'guest-1',
    winnerDisplayName: 'Guest User',
    revealedRound: {
        id: 'round-3',
        trackId: 'track-3',
        title: 'Winning Song',
        artistName: 'Winner Artist',
        albumName: 'Winner Album',
        artworkUrl: null
    }
};

const renderPage = (initialEntry = '/multiplayer') => {
    render(
        <MemoryRouter initialEntries={[initialEntry]}>
            <Routes>
                <Route path="/multiplayer" element={<Multiplayer />} />
                <Route path="/multiplayer/:roomCode" element={<Multiplayer />} />
                <Route path="/home" element={<div>Home Route</div>} />
            </Routes>
        </MemoryRouter>
    );
};

describe('Multiplayer page', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        mocks.authState.user = { uid: 'host-1', isAnonymous: false };
        mocks.authState.isLoadingUser = false;
        mocks.roomSnapshot = null;
        mocks.playersSnapshot = [];
        mocks.getIdToken.mockResolvedValue('mock-token');
        mocks.playlistState.playlists = [
            { id: 'playlist-1', name: 'Party Mix', tracks: { total: 20 } },
            { id: 'playlist-2', name: 'Chill Mix', tracks: { total: 10 } }
        ];
        vi.mocked(createMultiplayerRoom).mockResolvedValue({ roomId: 'XYZ789' });
        vi.mocked(joinMultiplayerRoom).mockResolvedValue({ roomId: 'ABC123' });
        vi.mocked(updateMultiplayerRoomSettings).mockResolvedValue({ roomId: 'ABC123' });
        vi.mocked(startMultiplayerGame).mockResolvedValue({ roomId: 'ABC123' });
        vi.mocked(kickMultiplayerPlayer).mockResolvedValue({ roomId: 'ABC123' });
        vi.mocked(leaveMultiplayerRoom).mockResolvedValue({ roomId: 'ABC123' });
        vi.mocked(getMultiplayerRoundData).mockResolvedValue({
            roundId: 'round-1',
            previewUrl: 'https://example.com/preview.m4a',
            choices: [{ id: 'track-1', name: 'First Song', artistName: 'Artist One' }],
            artworkUrl: null,
            artistName: 'Artist One',
            albumName: 'Album One'
        });
        vi.mocked(submitMultiplayerGuess).mockResolvedValue({
            correct: true,
            points: 25,
            snippetDurationMs: 2000,
            done: true
        });
        vi.mocked(giveUpMultiplayerRound).mockResolvedValue({ roomId: 'ABC123' });
        vi.mocked(playMultiplayerAgain).mockResolvedValue({ roomId: 'ABC123' });
        vi.mocked(returnMultiplayerToLobby).mockResolvedValue({ roomId: 'ABC123' });
    });

    it('creates a room, stores the room name, and navigates into the lobby route', async () => {
        const user = userEvent.setup();
        renderPage();

        await user.click(screen.getByRole('button', { name: /create room/i }));
        expect(screen.getByText(/enter a room name first/i)).toBeInTheDocument();

        await user.type(screen.getByLabelText(/room name/i), 'Friday Party');
        await user.click(screen.getByRole('button', { name: /create room/i }));

        await waitFor(() => {
            expect(createMultiplayerRoom).toHaveBeenCalledWith('Friday Party');
        });
        expect(mocks.getIdToken).toHaveBeenCalled();
        expect(mocks.getIdToken.mock.invocationCallOrder[0]).toBeLessThan(
            vi.mocked(createMultiplayerRoom).mock.invocationCallOrder[0]
        );
        expect(localStorage.getItem('multiplayerRoomName')).toBe('Friday Party');
        expect(screen.getByText(/room created/i)).toBeInTheDocument();
        expect(subscribeToMultiplayerRoom).toHaveBeenCalledWith('XYZ789', expect.any(Function), expect.any(Function));
    });

    it('renders host controls and updates settings from playlist selection, save, start, and kick actions', async () => {
        const user = userEvent.setup();
        mocks.roomSnapshot = room;
        mocks.playersSnapshot = [hostPlayer, guestPlayer];

        renderPage('/multiplayer/ABC123');

        await waitFor(() => {
            expect(screen.getByText('Friday Party')).toBeInTheDocument();
            expect(screen.getByText('Guest User')).toBeInTheDocument();
        });
        expect(screen.getByRole('link', { name: /manage playlists/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
        expect(screen.getAllByRole('button', { name: /close room/i }).length).toBeGreaterThan(0);

        await user.click(screen.getByRole('button', { name: /chill mix/i }));
        await waitFor(() => {
            expect(updateMultiplayerRoomSettings).toHaveBeenCalledWith('ABC123', 'playlist-2', 'Chill Mix', 100);
        });

        await user.clear(screen.getByLabelText(/point goal/i));
        await user.type(screen.getByLabelText(/point goal/i), '250');
        await user.click(screen.getByRole('button', { name: /save settings/i }));
        await user.click(screen.getByRole('button', { name: /start game/i }));

        await waitFor(() => {
            expect(updateMultiplayerRoomSettings).toHaveBeenCalledWith('ABC123', 'playlist-2', 'Chill Mix', 250);
            expect(startMultiplayerGame).toHaveBeenCalledWith('ABC123');
        });

        const guestRow = screen.getByText('Guest User').closest('li');
        expect(guestRow).not.toBeNull();
        await user.click(within(guestRow as HTMLElement).getByRole('button', { name: /kick/i }));

        await waitFor(() => {
            expect(kickMultiplayerPlayer).toHaveBeenCalledWith('ABC123', 'guest-1');
        });
    });

    it('lets a viewer join an active room before host-only controls are shown', async () => {
        const user = userEvent.setup();
        mocks.authState.user = { uid: 'viewer-1', isAnonymous: true };
        mocks.roomSnapshot = room;
        mocks.playersSnapshot = [hostPlayer];

        renderPage('/multiplayer/ABC123?mode=guest');

        await waitFor(() => {
            expect(screen.getByText(/you are viewing this room/i)).toBeInTheDocument();
        });
        expect(screen.queryByText('Choose your playlist')).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: /join room/i }));

        await waitFor(() => {
            expect(joinMultiplayerRoom).toHaveBeenCalledWith('ABC123');
        });
        expect(screen.getByText(/joined room/i)).toBeInTheDocument();
    });

    it('renders active gameplay and submits a round guess', async () => {
        const user = userEvent.setup();
        mocks.roomSnapshot = playingRoom;
        mocks.playersSnapshot = [guessingHostPlayer, correctGuestPlayer];

        renderPage('/multiplayer/ABC123');

        await waitFor(() => {
            expect(getMultiplayerRoundData).toHaveBeenCalledWith('ABC123', 'round-1');
            expect(screen.getByText(/first to 100/i)).toBeInTheDocument();
        });

        expect(screen.getByText(/correct/i)).toBeInTheDocument();
        await user.type(screen.getByPlaceholderText(/enter song title/i), 'First Song');
        await user.click(screen.getByRole('button', { name: /^guess$/i }));

        await waitFor(() => {
            expect(submitMultiplayerGuess).toHaveBeenCalledWith('ABC123', 'round-1', 'First Song', 2000);
            expect(screen.getByText(/correct! \+25 pts/i)).toBeInTheDocument();
        });
    });

    it('renders the win screen and host end-game controls', async () => {
        const user = userEvent.setup();
        mocks.roomSnapshot = endedRoom;
        mocks.playersSnapshot = [hostPlayer, { ...guestPlayer, score: 100 }];

        renderPage('/multiplayer/ABC123');

        await waitFor(() => {
            expect(screen.getByText(/guest user wins/i)).toBeInTheDocument();
        });

        await user.click(screen.getByRole('button', { name: /play again/i }));
        await user.click(screen.getByRole('button', { name: /return to lobby/i }));

        await waitFor(() => {
            expect(playMultiplayerAgain).toHaveBeenCalledWith('ABC123');
            expect(returnMultiplayerToLobby).toHaveBeenCalledWith('ABC123');
        });
    });

    it('lets a player leave a lobby room', async () => {
        const user = userEvent.setup();
        mocks.authState.user = { uid: 'guest-1', isAnonymous: false };
        mocks.roomSnapshot = room;
        mocks.playersSnapshot = [hostPlayer, guestPlayer];

        renderPage('/multiplayer/ABC123');

        await waitFor(() => {
            expect(screen.getByText('Friday Party')).toBeInTheDocument();
        });

        await user.click(screen.getAllByRole('button', { name: /leave room/i })[0]);

        await waitFor(() => {
            expect(leaveMultiplayerRoom).toHaveBeenCalledWith('ABC123');
        });
        expect(screen.getByText(/you left the room/i)).toBeInTheDocument();
    });

    it('leaves the lobby before navigating home from a room', async () => {
        const user = userEvent.setup();
        mocks.authState.user = { uid: 'guest-1', isAnonymous: false };
        mocks.roomSnapshot = room;
        mocks.playersSnapshot = [hostPlayer, guestPlayer];

        renderPage('/multiplayer/ABC123');

        await waitFor(() => {
            expect(screen.getByText('Friday Party')).toBeInTheDocument();
        });

        await user.click(screen.getByRole('link', { name: /back home/i }));

        await waitFor(() => {
            expect(leaveMultiplayerRoom).toHaveBeenCalledWith('ABC123');
            expect(screen.getByText('Home Route')).toBeInTheDocument();
        });
    });

    it('removes a joined lobby player when navigating away', async () => {
        mocks.authState.user = { uid: 'guest-1', isAnonymous: false };
        mocks.roomSnapshot = room;
        mocks.playersSnapshot = [hostPlayer, guestPlayer];

        const { unmount } = render(
            <MemoryRouter initialEntries={['/multiplayer/ABC123']}>
                <Routes>
                    <Route path="/multiplayer/:roomCode" element={<Multiplayer />} />
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Friday Party')).toBeInTheDocument();
        });

        unmount();

        expect(leaveMultiplayerRoom).toHaveBeenCalledWith('ABC123');
    });
});
