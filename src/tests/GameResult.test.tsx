import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import GameResult from '../components/GameResult';

const mockSong = {
    name: 'Test Song',
    artists: [{ name: 'Artist 1' }, { name: 'Artist 2' }],
    album: {
        images: [{ url: 'http://example.com/image.jpg' }]
    }
};

describe('GameResult Component', () => {
    it('renders song details and album art', () => {
        render(
            <GameResult 
                targetSong={mockSong}
                feedbackMessage="Correct!"
                onPlayAgain={vi.fn()}
                onSelectNewPlaylist={vi.fn()}
            />
        );

        expect(screen.getByText('Correct!')).toBeInTheDocument();
        expect(screen.getByText('Test Song')).toBeInTheDocument();
        expect(screen.getByText('Artist: Artist 1, Artist 2')).toBeInTheDocument();
        const img = screen.getByRole('img');
        expect(img).toHaveAttribute('src', 'http://example.com/image.jpg');
    });

    it('reveals album art once the image loads', () => {
        render(
            <GameResult
                targetSong={mockSong}
                feedbackMessage="Correct!"
                onPlayAgain={vi.fn()}
                onSelectNewPlaylist={vi.fn()}
            />
        );

        const img = screen.getByRole('img');
        expect(img).not.toHaveClass('album-art-loaded');
        expect(screen.getByText('TuneTeaser')).toBeInTheDocument();

        fireEvent.load(img);

        expect(img).toHaveClass('album-art-loaded');
        expect(screen.getByText('TuneTeaser')).toBeInTheDocument();
    });

    it('keeps the fallback record when album art fails to load', () => {
        render(
            <GameResult
                targetSong={mockSong}
                feedbackMessage="Correct!"
                onPlayAgain={vi.fn()}
                onSelectNewPlaylist={vi.fn()}
            />
        );

        fireEvent.error(screen.getByRole('img'));

        expect(screen.queryByRole('img')).not.toBeInTheDocument();
        expect(screen.getByText('TuneTeaser')).toBeInTheDocument();
    });

    it('renders fallback record when album art is missing', () => {
        const songWithoutImage = { ...mockSong, album: { images: [] } };
        render(
            <GameResult 
                targetSong={songWithoutImage}
                feedbackMessage="Correct!"
                onPlayAgain={vi.fn()}
                onSelectNewPlaylist={vi.fn()}
            />
        );

        expect(screen.getByText('TuneTeaser')).toBeInTheDocument();
        expect(screen.queryByRole('img')).toBeNull();
    });

    it('displays earned points badge if points are greater than 0', () => {
        const { rerender } = render(
            <GameResult 
                targetSong={mockSong}
                feedbackMessage="Correct!"
                onPlayAgain={vi.fn()}
                onSelectNewPlaylist={vi.fn()}
                earnedPoints={15}
            />
        );

        expect(screen.getByText('+15 pts')).toBeInTheDocument();

        rerender(
            <GameResult 
                targetSong={mockSong}
                feedbackMessage="Correct!"
                onPlayAgain={vi.fn()}
                onSelectNewPlaylist={vi.fn()}
                earnedPoints={0}
            />
        );

        expect(screen.queryByText('+0 pts')).toBeNull();
    });

    it('calls appropriate callbacks when buttons are clicked', () => {
        const playAgainMock = vi.fn();
        const newPlaylistMock = vi.fn();

        render(
            <GameResult 
                targetSong={mockSong}
                feedbackMessage="Incorrect!"
                onPlayAgain={playAgainMock}
                onSelectNewPlaylist={newPlaylistMock}
            />
        );

        fireEvent.click(screen.getByText('Next Track'));
        expect(playAgainMock).toHaveBeenCalledTimes(1);

        fireEvent.click(screen.getByText('Select New Playlist'));
        expect(newPlaylistMock).toHaveBeenCalledTimes(1);
    });

    it('renders the preview toggle and calls onTogglePreview', () => {
        const toggleMock = vi.fn();
        render(
            <GameResult
                targetSong={mockSong}
                feedbackMessage="Correct!"
                onPlayAgain={vi.fn()}
                onSelectNewPlaylist={vi.fn()}
                previewDurationMs={30000}
                onTogglePreview={toggleMock}
            />
        );

        const toggle = screen.getByRole('button', { name: 'Play preview' });
        expect(screen.getByText('30s preview')).toBeInTheDocument();

        fireEvent.click(toggle);
        expect(toggleMock).toHaveBeenCalledTimes(1);
    });

    it('shows a stop control while the preview is playing', () => {
        render(
            <GameResult
                targetSong={mockSong}
                feedbackMessage="Correct!"
                onPlayAgain={vi.fn()}
                onSelectNewPlaylist={vi.fn()}
                isPlaying={true}
                isAdvancing={true}
                positionMs={5000}
                previewDurationMs={30000}
                onTogglePreview={vi.fn()}
            />
        );

        expect(screen.getByRole('button', { name: 'Stop preview' })).toBeInTheDocument();
        expect(screen.getByRole('progressbar', { name: 'Snippet progress' })).toHaveAttribute('aria-valuenow', '5');
    });

    it('hides the preview row when no toggle handler is provided', () => {
        render(
            <GameResult
                targetSong={mockSong}
                feedbackMessage="Correct!"
                onPlayAgain={vi.fn()}
                onSelectNewPlaylist={vi.fn()}
            />
        );

        expect(screen.queryByRole('button', { name: 'Play preview' })).not.toBeInTheDocument();
    });

    it('disables buttons and shows loading text when isLoading is true', () => {
        render(
            <GameResult 
                targetSong={mockSong}
                feedbackMessage="Correct!"
                onPlayAgain={vi.fn()}
                onSelectNewPlaylist={vi.fn()}
                isLoading={true}
            />
        );

        expect(screen.getByText('Next Track')).toBeDisabled();
        expect(screen.getByText('Select New Playlist')).toBeDisabled();
        expect(screen.getByText('Loading next track...')).toBeInTheDocument();
    });
});
