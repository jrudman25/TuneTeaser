/**
 * ActiveGame.test.tsx
 * Tests the ActiveGame component.
 * @version 2026.02.09
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ActiveGame from '../components/ActiveGame';
import { vi, describe, it, expect } from 'vitest';

describe('ActiveGame - Enter Key Behavior', () => {
    const defaultProps = {
        targetSong: { name: 'Test Song' },
        snippetDuration: 1000,
        userGuess: '',
        setUserGuess: vi.fn(),
        onGuessSubmit: vi.fn(),
        onPlaySnippet: vi.fn(),
        onGiveUp: vi.fn(),
        feedbackMessage: '',
        isPlaying: false,
        selectedPlaylistName: 'Test Playlist',
        songs: [{ track: { name: 'Test Song' } }, { track: { name: 'Another Song' } }],
        volume: 0.5,
        setVolume: vi.fn()
    };

    it('populates input then submits when Enter is pressed on highlighted option', async () => {
        const user = userEvent.setup();
        const setUserGuess = vi.fn();
        const onGuessSubmit = vi.fn();

        render(<ActiveGame {...defaultProps} setUserGuess={setUserGuess} onGuessSubmit={onGuessSubmit} />);

        const input = screen.getByLabelText('Enter song title...');

        // Type to filter options
        await user.type(input, 'Test');
        // Arrow down to highlight "Test Song"
        await user.keyboard('{ArrowDown}');
        // Press Enter
        await user.keyboard('{Enter}');

        // Should NOT submit yet (just populated)
        expect(onGuessSubmit).not.toHaveBeenCalled();

        // Press Enter AGAIN. Now input matches highlighted option.
        await user.keyboard('{Enter}');

        // NOW it should submit
        expect(onGuessSubmit).toHaveBeenCalled();
    });

    it('submits guess when Enter is pressed without highlighted option', async () => {
        const user = userEvent.setup();
        const onGuessSubmit = vi.fn();

        render(<ActiveGame {...defaultProps} onGuessSubmit={onGuessSubmit} />);

        const input = screen.getByLabelText('Enter song title...');

        await user.type(input, 'My Guess');
        await user.keyboard('{Enter}');

        expect(onGuessSubmit).toHaveBeenCalled();
    });
});
