import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Multiplayer from '../pages/Multiplayer';
import {
    createMultiplayerRoom,
    joinMultiplayerRoom,
    kickMultiplayerPlayer,
    leaveMultiplayerRoom,
    startMultiplayerGame,
    subscribeToMultiplayerRoom,
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

vi.mock('../utils/multiplayer', () => ({
    createMultiplayerRoom: vi.fn(),
    joinMultiplayerRoom: vi.fn(),
    updateMultiplayerRoomSettings: vi.fn(),
    startMultiplayerGame: vi.fn(),
    kickMultiplayerPlayer: vi.fn(),
    leaveMultiplayerRoom: vi.fn(),
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
    auth: { currentUser: { uid: 'host-1', getIdToken: vi.fn().mockResolvedValue('mock-token') } }
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
