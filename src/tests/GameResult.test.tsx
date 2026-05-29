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
