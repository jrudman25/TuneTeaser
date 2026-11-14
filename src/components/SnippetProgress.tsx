/**
 * SnippetProgress.tsx
 * Shows a progress bar for the currently playing snippet.
 * Always rendered at a fixed height so it does not shift the layout.
 * @version 2026.11.13
 */
import React from 'react';

interface SnippetProgressProps {
    isPlaying: boolean;
    isAdvancing?: boolean;
    positionMs: number;
    durationMs: number;
    idleText?: string;
    hint?: string;
}

const SnippetProgress: React.FC<SnippetProgressProps> = ({ isPlaying, isAdvancing, positionMs, durationMs, idleText = 'Ready', hint }) => {
    const clampedPositionMs = Math.min(Math.max(positionMs, 0), Math.max(durationMs, 0));
    const positionSeconds = clampedPositionMs / 1000;
    const durationSeconds = Math.max(durationMs, 0) / 1000;
    const remainingSeconds = Math.max(0, durationSeconds - positionSeconds);
    const fillPercent = durationMs > 0 ? Math.min(100, (clampedPositionMs / durationMs) * 100) : 0;
    const reducedMotion = typeof window !== 'undefined'
        && typeof window.matchMedia === 'function'
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // positionMs only advances on timeupdate ticks (~4 Hz). While audio is
    // actually advancing, sweep the fill to 100% over the *remaining* time with
    // the Web Animations API, recreating the animation on every tick so the bar
    // stays synced to audio position: it freezes during buffering stalls and
    // cannot run ahead of the snippet. Stepped updates under
    // prefers-reduced-motion.
    const fillRef = React.useRef<HTMLDivElement | null>(null);
    const lastRenderedWidthRef = React.useRef<string | null>(null);
    const advancing = (isAdvancing ?? isPlaying) && !reducedMotion && durationMs > 0 && clampedPositionMs < durationMs;

    React.useLayoutEffect(() => {
        const fill = fillRef.current;
        if (!fill) return;
        const canAnimate = typeof fill.animate === 'function';
        if (!advancing || !canAnimate) {
            const from = lastRenderedWidthRef.current;
            lastRenderedWidthRef.current = null;
            fill.style.width = `${fillPercent}%`;
            // Settle to the new width (e.g. the reset to empty after a snippet
            // ends) with a short animation instead of snapping. fill:forwards
            // keeps it applied so the next cleanup still reads its held width.
            if (canAnimate && !reducedMotion && from && from !== `${fillPercent}%`) {
                const reset = fill.animate(
                    [{ width: from }, { width: `${fillPercent}%` }],
                    { duration: 250, easing: 'linear', fill: 'forwards' }
                );
                return () => {
                    lastRenderedWidthRef.current = getComputedStyle(fill).width;
                    reset.cancel();
                };
            }
            return;
        }
        const animation = fill.animate(
            [{ width: `${fillPercent}%` }, { width: '100%' }],
            { duration: durationMs - clampedPositionMs, easing: 'linear', fill: 'forwards' }
        );
        return () => {
            lastRenderedWidthRef.current = getComputedStyle(fill).width;
            animation.cancel();
        };
    }, [advancing, clampedPositionMs, durationMs, fillPercent, reducedMotion]);

    return (
        <div className="snippet-progress">
            <div
                className="snippet-progress-bar"
                role="progressbar"
                aria-label="Snippet progress"
                aria-valuemin={0}
                aria-valuemax={Number(durationSeconds.toFixed(1))}
                aria-valuenow={Number(positionSeconds.toFixed(1))}
            >
                <div
                    ref={fillRef}
                    className="snippet-progress-fill"
                    style={{ width: `${fillPercent}%` }}
                />
            </div>
            <span className={`snippet-progress-text${hint ? ' snippet-progress-text-split' : ''}`}>
                <span>{isPlaying ? `Playing: ${remainingSeconds.toFixed(1)}s left` : idleText}</span>
                {hint && <span className="snippet-progress-hint">{hint}</span>}
            </span>
        </div>
    );
};

export default SnippetProgress;
