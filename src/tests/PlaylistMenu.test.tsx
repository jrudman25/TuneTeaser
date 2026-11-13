import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PlaylistMenu from '../components/PlaylistMenu';
import FilterChipRow from '../components/FilterChipRow';

const makePlaylist = (id: string, name: string, total: number, extra: Record<string, unknown> = {}) => ({
    id,
    name,
    tracks: { total },
    ...extra
});

const renderMenu = (props: Partial<React.ComponentProps<typeof PlaylistMenu>> = {}) => {
    const onSelectPlaylist = vi.fn();
    const playlists = [
        makePlaylist('guest_top_hits', 'Top Hits', 50, { genres: ['Pop'] }),
        makePlaylist('manual_1', 'Road Trip', 12, { createdAt: { seconds: 1700000000 } }),
        makePlaylist('manual_2', 'Acoustic Night', 5),
        makePlaylist('manual_3', 'Workout', 30)
    ];

    render(
        <MemoryRouter>
            <PlaylistMenu
                playlists={props.playlists ?? playlists}
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

    it('shows playlist startup feedback when selection fails', () => {
        renderMenu({ feedbackMessage: 'No playable tracks found in this playlist.' });

        expect(screen.getByRole('alert')).toHaveTextContent('No playable tracks found in this playlist.');
    });

    it('does not offer Liked Songs', () => {
        renderMenu();

        expect(screen.queryByRole('button', { name: /liked songs/i })).not.toBeInTheDocument();
    });

    it('splits playlists into source tabs and persists the choice', async () => {
        const user = userEvent.setup();
        renderMenu();

        const mineTab = screen.getByRole('tab', { name: /your playlists/i });
        const premadeTab = screen.getByRole('tab', { name: /premade/i });
        expect(mineTab).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByRole('button', { name: /road trip/i })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /top hits/i })).not.toBeInTheDocument();

        await user.click(premadeTab);

        expect(premadeTab).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByRole('button', { name: /top hits/i })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /road trip/i })).not.toBeInTheDocument();
        expect(localStorage.getItem('playlistMenuSource')).toBe('premade');
    });

    it('restores the persisted tab choice', () => {
        localStorage.setItem('playlistMenuSource', 'premade');
        renderMenu();

        expect(screen.getByRole('tab', { name: /premade/i })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByRole('button', { name: /top hits/i })).toBeInTheDocument();
    });

    it('defaults to the Premade tab when the user has no own playlists', () => {
        renderMenu({
            playlists: [makePlaylist('guest_top_hits', 'Top Hits', 50)]
        });

        expect(screen.getByRole('tab', { name: /premade/i })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByRole('button', { name: /top hits/i })).toBeInTheDocument();
    });

    it('searches only within the selected source and resets on tab switch', async () => {
        const user = userEvent.setup();
        renderMenu({ isGuest: true });

        await user.type(screen.getByPlaceholderText(/search playlists/i), 'acoustic');

        expect(screen.getByRole('button', { name: /acoustic night/i })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /road trip/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /top hits/i })).not.toBeInTheDocument();

        await user.click(screen.getByRole('tab', { name: /premade/i }));

        expect(screen.getByPlaceholderText(/search playlists/i)).toHaveValue('');
        expect(screen.getByRole('button', { name: /top hits/i })).toBeInTheDocument();
    });

    it('shows the no-results state when a search matches nothing', async () => {
        const user = userEvent.setup();
        renderMenu({ isGuest: true });

        await user.type(screen.getByPlaceholderText(/search playlists/i), 'missing');

        expect(screen.getByText(/no playlists found matching/i)).toBeInTheDocument();
    });

    it('filters premade playlists by genre chip', async () => {
        const user = userEvent.setup();
        renderMenu({
            playlists: [
                makePlaylist('guest_pop', 'Pop Mix', 10, { genres: ['Pop'] }),
                makePlaylist('guest_rock', 'Rock Mix', 10, { genres: ['Rock'] }),
                makePlaylist('guest_indie', 'Indie Mix', 10, { genres: ['Indie'] }),
                makePlaylist('manual_1', 'Mine', 5)
            ]
        });

        await user.click(screen.getByRole('tab', { name: /premade/i }));
        await user.click(screen.getByRole('button', { name: /^rock$/i }));

        expect(screen.getByRole('button', { name: /rock mix/i })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /pop mix/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /indie mix/i })).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: /^all$/i }));
        expect(screen.getByRole('button', { name: /pop mix/i })).toBeInTheDocument();
    });

    it('filters premade playlists by decade chip', async () => {
        const user = userEvent.setup();
        renderMenu({
            playlists: [
                makePlaylist('guest_80s', 'Eighties Mix', 10, { genres: ['Pop'], decades: ['80s'] }),
                makePlaylist('guest_90s', 'Nineties Mix', 10, { genres: ['Pop'], decades: ['90s'] }),
                makePlaylist('guest_blend', 'Blend Mix', 10, { genres: ['Pop'], decades: ['80s', '90s'] }),
                makePlaylist('manual_1', 'Mine', 5)
            ]
        });

        await user.click(screen.getByRole('tab', { name: /premade/i }));
        await user.click(screen.getByRole('button', { name: /^80s$/i }));

        expect(screen.getByRole('button', { name: /eighties mix/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /blend mix/i })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /nineties mix/i })).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: /^90s$/i }));

        expect(screen.getByRole('button', { name: /nineties mix/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /blend mix/i })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /eighties mix/i })).not.toBeInTheDocument();
    });

    it('shows an empty state with a Manage Playlists link and a browse button on the Your playlists tab', async () => {
        const user = userEvent.setup();
        renderMenu({
            isGuest: true,
            playlists: [makePlaylist('guest_top_hits', 'Top Hits', 50)]
        });

        await user.click(screen.getByRole('tab', { name: /your playlists/i }));

        expect(screen.getByText(/you don't have any playlists yet/i)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /manage playlists/i })).toHaveAttribute('href', '/playlists?mode=guest');

        await user.click(screen.getByRole('button', { name: /browse premade playlists/i }));
        expect(screen.getByRole('tab', { name: /premade/i })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByRole('button', { name: /top hits/i })).toBeInTheDocument();
    });

    it('sorts by track count and flips direction', async () => {
        const user = userEvent.setup();
        renderMenu({ isGuest: true });

        await user.selectOptions(screen.getByRole('combobox'), 'tracks');

        const cardsAscending = screen.getAllByRole('button', { name: /tracks/i });
        expect(within(cardsAscending[0]).getByText('Acoustic Night')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: /sort descending/i }));

        const cardsDescending = screen.getAllByRole('button', { name: /tracks/i });
        expect(within(cardsDescending[0]).getByText('Workout')).toBeInTheDocument();
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

describe('FilterChipRow', () => {
    const options = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta'];

    const ChipHarness = ({ onSelect }: { onSelect: (value: string | null) => void }) => {
        const [selected, setSelected] = React.useState<string | null>(null);
        return (
            <FilterChipRow
                label="Genre"
                options={options}
                selected={selected}
                onSelect={value => {
                    setSelected(value);
                    onSelect(value);
                }}
            />
        );
    };

    it('renders the All chip plus up to maxVisible options and a More chip', () => {
        render(<FilterChipRow label="Genre" options={options} selected={null} onSelect={vi.fn()} />);

        expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', { name: 'Alpha' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Delta' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Epsilon' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'More' })).toBeInTheDocument();
    });

    it('hides the More chip when options fit within maxVisible', () => {
        render(<FilterChipRow label="Genre" options={options.slice(0, 4)} selected={null} onSelect={vi.fn()} />);

        expect(screen.queryByRole('button', { name: 'More' })).not.toBeInTheDocument();
    });

    it('opens the sheet from More, selects a hidden option, and shows it as selected', async () => {
        const user = userEvent.setup();
        const onSelect = vi.fn();
        render(<ChipHarness onSelect={onSelect} />);

        await user.click(screen.getByRole('button', { name: 'More' }));

        const sheet = await screen.findByRole('dialog');
        await user.click(within(sheet).getByRole('button', { name: 'Zeta' }));

        expect(onSelect).toHaveBeenCalledWith('Zeta');
        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });

        const moreChip = screen.getByRole('button', { name: 'Zeta' });
        expect(moreChip).toHaveClass('filter-chip-selected');
        expect(moreChip).toHaveAttribute('aria-pressed', 'true');
    });
});
