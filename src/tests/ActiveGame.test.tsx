/**
 * ActiveGame.test.tsx
 * Tests the ActiveGame component.
 * @version 2026.02.09
 */
import React from 'react';
import { render, screen, within } from '@testing-library/react';
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
        onBack: vi.fn(),
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

describe('ActiveGame - keyboard shortcuts', () => {
    const defaultProps = {
        targetSong: { name: 'Test Song' },
        snippetDuration: 1000,
        userGuess: '',
        setUserGuess: vi.fn(),
        onGuessSubmit: vi.fn(),
        onPlaySnippet: vi.fn(),
        onGiveUp: vi.fn(),
        onBack: vi.fn(),
        feedbackMessage: '',
        isPlaying: false,
        selectedPlaylistName: 'Test Playlist',
        songs: [{ track: { name: 'Test Song' } }, { track: { name: 'Another Song' } }],
        volume: 0.5,
        setVolume: vi.fn()
    };

    it('calls onBack when the header Back button is clicked', async () => {
        const user = userEvent.setup();
        const onBack = vi.fn();

        render(<ActiveGame {...defaultProps} onBack={onBack} />);
        await user.click(screen.getByRole('button', { name: 'Back to playlist selection' }));

        expect(onBack).toHaveBeenCalledTimes(1);
    });

    it('plays the snippet when Space is pressed outside editable controls', async () => {
        const user = userEvent.setup();
        const onPlaySnippet = vi.fn();

        render(<ActiveGame {...defaultProps} onPlaySnippet={onPlaySnippet} />);
        await user.keyboard(' ');

        expect(onPlaySnippet).toHaveBeenCalledTimes(1);
    });

    it('does not play when Space is pressed inside the guess input', async () => {
        const user = userEvent.setup();
        const onPlaySnippet = vi.fn();

        const GuessWrapper = () => {
            const [guess, setGuess] = React.useState('');
            return (
                <ActiveGame
                    {...defaultProps}
                    userGuess={guess}
                    setUserGuess={setGuess}
                    onPlaySnippet={onPlaySnippet}
                />
            );
        };
        render(<GuessWrapper />);

        const input = screen.getByLabelText('Enter song title...');
        await user.type(input, 'abc def');

        expect(onPlaySnippet).not.toHaveBeenCalled();
        expect(input).toHaveValue('abc def');
    });

    it('does not play on Space while a snippet is already playing', async () => {
        const user = userEvent.setup();
        const onPlaySnippet = vi.fn();

        render(<ActiveGame {...defaultProps} isPlaying onPlaySnippet={onPlaySnippet} />);
        await user.keyboard(' ');

        expect(onPlaySnippet).not.toHaveBeenCalled();
    });

    it('plays the snippet from the deck play button', async () => {
        const user = userEvent.setup();
        const onPlaySnippet = vi.fn();

        render(<ActiveGame {...defaultProps} onPlaySnippet={onPlaySnippet} />);
        await user.click(screen.getByRole('button', { name: 'Play snippet' }));

        expect(onPlaySnippet).toHaveBeenCalledTimes(1);
    });

    it('shows the empty-guess helper under the guess row', () => {
        render(<ActiveGame {...defaultProps} />);

        expect(screen.getByText(/Guess with nothing typed to hear 2 more seconds/)).toBeInTheDocument();
    });

    it('opens the give-up confirmation from the header Give up button', async () => {
        const user = userEvent.setup();
        const onGiveUp = vi.fn();

        render(<ActiveGame {...defaultProps} onGiveUp={onGiveUp} />);
        await user.click(screen.getByRole('button', { name: 'Give up' }));

        expect(screen.getByText('Give up this round?')).toBeInTheDocument();
        expect(onGiveUp).not.toHaveBeenCalled();

        const dialog = screen.getByRole('dialog');
        await user.click(within(dialog).getByRole('button', { name: /^give up$/i }));
        expect(onGiveUp).toHaveBeenCalledTimes(1);
    });

    it('does not give up when the header Give up confirmation is cancelled', async () => {
        const user = userEvent.setup();
        const onGiveUp = vi.fn();

        render(<ActiveGame {...defaultProps} onGiveUp={onGiveUp} />);
        await user.click(screen.getByRole('button', { name: 'Give up' }));
        await user.click(await screen.findByRole('button', { name: /cancel/i }));

        expect(onGiveUp).not.toHaveBeenCalled();
    });

    it('Esc opens give-up confirmation; cancel keeps the round, confirm gives up', async () => {
        const user = userEvent.setup();
        const onGiveUp = vi.fn();

        render(<ActiveGame {...defaultProps} onGiveUp={onGiveUp} />);

        await user.keyboard('{Escape}');
        expect(screen.getByText('Give up this round?')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: /cancel/i }));
        expect(onGiveUp).not.toHaveBeenCalled();

        await user.keyboard('{Escape}');
        const dialog = screen.getByRole('dialog');
        await user.click(within(dialog).getByRole('button', { name: /^give up$/i }));

        expect(onGiveUp).toHaveBeenCalledTimes(1);
    });
});
