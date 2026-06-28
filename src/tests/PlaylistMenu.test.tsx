import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PlaylistMenu from '../components/PlaylistMenu';

const makePlaylist = (id: string, name: string, total: number, extra: Record<string, unknown> = {}) => ({
    id,
    name,
    tracks: { total },
    ...extra
});

const renderMenu = (props: Partial<React.ComponentProps<typeof PlaylistMenu>> = {}) => {
    const onSelectPlaylist = vi.fn();
    const playlists = [
        makePlaylist('guest_top_hits', 'Top Hits', 50),
        makePlaylist('manual_1', 'Road Trip', 12, { createdAt: { seconds: 1700000000 } }),
        makePlaylist('manual_2', 'Acoustic Night', 5),
        makePlaylist('manual_3', 'Workout', 30)
    ];

    render(
        <MemoryRouter>
            <PlaylistMenu
                playlists={playlists}
                onSelectPlaylist={onSelectPlaylist}
                isLoading={false}
                {...props}
            />
        </MemoryRouter>
    );

    return { onSelectPlaylist, playlists };
};

describe('PlaylistMenu', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('shows Liked Songs for signed-in users and calls the selection callback', async () => {
        const user = userEvent.setup();
        const { onSelectPlaylist } = renderMenu();

        await user.click(screen.getByRole('button', { name: /liked songs/i }));

        expect(onSelectPlaylist).toHaveBeenCalledWith('LIKED_SONGS');
    });

    it('filters premade playlists and persists the toggle preference', async () => {
        const user = userEvent.setup();
        renderMenu({ isGuest: true });

        expect(screen.getByRole('button', { name: /top hits/i })).toBeInTheDocument();

        await user.click(screen.getByRole('checkbox', { name: /include premades/i }));

        expect(screen.queryByRole('button', { name: /top hits/i })).not.toBeInTheDocument();
        expect(localStorage.getItem('showPremadePlaylists')).toBe('false');
    });

    it('searches playlists and shows the no-results state', async () => {
        const user = userEvent.setup();
        renderMenu({ isGuest: true });

        await user.type(screen.getByPlaceholderText(/search playlists/i), 'acoustic');

        expect(screen.getByRole('button', { name: /acoustic night/i })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /road trip/i })).not.toBeInTheDocument();

        await user.clear(screen.getByPlaceholderText(/search playlists/i));
        await user.type(screen.getByPlaceholderText(/search playlists/i), 'missing');

        expect(screen.getByText(/no playlists found matching/i)).toBeInTheDocument();
    });

    it('sorts by track count and flips direction', async () => {
        const user = userEvent.setup();
        renderMenu({ isGuest: true });

        await user.selectOptions(screen.getByRole('combobox'), 'tracks');

        const cardsAscending = screen.getAllByRole('button', { name: /playlist/i });
        expect(within(cardsAscending[0]).getByText('Acoustic Night')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: /sort descending/i }));

        const cardsDescending = screen.getAllByRole('button', { name: /playlist/i });
        expect(within(cardsDescending[0]).getByText('Top Hits')).toBeInTheDocument();
    });

    it('disables importing playlists and does not select them', async () => {
        const user = userEvent.setup();
        const { onSelectPlaylist } = renderMenu({
            isGuest: true,
            playlists: [
                makePlaylist('manual_importing', 'Almost Ready', 10, {
                    status: 'importing',
                    importedCount: 4,
                    totalCount: 10
                })
            ]
        });

        const importingButton = screen.getByRole('button', { name: /almost ready/i });
        expect(importingButton).toBeDisabled();
        expect(screen.getByText('4 / 10 tracks')).toBeInTheDocument();

        await user.click(importingButton);
        expect(onSelectPlaylist).not.toHaveBeenCalled();
    });

    it('disables playlists with import errors and shows the failure message', async () => {
        const user = userEvent.setup();
        const { onSelectPlaylist } = renderMenu({
            isGuest: true,
            playlists: [
                makePlaylist('manual_error', 'Partial Import', 10, {
                    status: 'error',
                    importError: 'Spotify returned an error.'
                })
            ]
        });

        const errorButton = screen.getByRole('button', { name: /partial import/i });
        expect(errorButton).toBeDisabled();
        expect(screen.getByText('Import Error')).toBeInTheDocument();
        expect(screen.getByText('Spotify returned an error.')).toBeInTheDocument();

        await user.click(errorButton);
        expect(onSelectPlaylist).not.toHaveBeenCalled();
    });
});
