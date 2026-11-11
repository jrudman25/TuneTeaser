/**
 * useGameShortcuts.ts
 * Keyboard shortcuts for the active guessing round:
 * Space plays the snippet, Esc requests give-up. Enter submits guesses
 * and is handled by the existing inputs.
 * @version 2026.06.02
 */
import { useEffect } from 'react';

interface GameShortcutHandlers {
    enabled: boolean;
    onPlay: () => void;
    onGiveUpRequest: () => void;
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

export const useGameShortcuts = ({ enabled, onPlay, onGiveUpRequest }: GameShortcutHandlers) => {
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
                onPlay();
                return;
            }

            if (event.key === 'Escape') {
                onGiveUpRequest();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [enabled, onPlay, onGiveUpRequest]);
};
