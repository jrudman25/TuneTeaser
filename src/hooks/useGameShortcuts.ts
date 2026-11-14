/**
 * useGameShortcuts.ts
 * Keyboard shortcuts for the active guessing round:
 * Space plays the snippet, Esc requests give-up, N takes the solo result
 * screen's Next Track action, Enter focuses the guess field. Once the
 * field has focus, Enter submits guesses via the input's own handler.
 * @version 2026.11.13
 */
import { useEffect } from 'react';

interface GameShortcutHandlers {
    enabled: boolean;
    onPlay?: () => void;
    onGiveUpRequest?: () => void;
    onNext?: () => void;
    onFocusGuess?: () => void;
}

const isEditableTarget = (target: EventTarget | null): boolean => {
    if (!(target instanceof HTMLElement)) return false;
    if (target.isContentEditable) return true;
    return !!target.closest('input, textarea, select');
};

const isInteractiveTarget = (target: EventTarget | null): boolean => {
    if (!(target instanceof HTMLElement)) return false;
    return !!target.closest('button, a, [role="button"], [role="slider"], [role="option"]');
};

export const useGameShortcuts = ({ enabled, onPlay, onGiveUpRequest, onNext, onFocusGuess }: GameShortcutHandlers) => {
    useEffect(() => {
        if (!enabled) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.defaultPrevented || event.repeat || event.ctrlKey || event.metaKey || event.altKey) {
                return;
            }

            if (event.key === ' ') {
                if (isEditableTarget(event.target) || isInteractiveTarget(event.target)) {
                    return;
                }
                event.preventDefault();
                onPlay?.();
                return;
            }

            if (event.key.toLowerCase() === 'n') {
                if (isEditableTarget(event.target) || isInteractiveTarget(event.target)) {
                    return;
                }
                onNext?.();
                return;
            }

            if (event.key === 'Enter') {
                if (isEditableTarget(event.target) || isInteractiveTarget(event.target)) {
                    return;
                }
                onFocusGuess?.();
                return;
            }

            if (event.key === 'Escape') {
                onGiveUpRequest?.();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [enabled, onPlay, onGiveUpRequest, onNext, onFocusGuess]);
};
