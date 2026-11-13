/**
 * SnippetProgress.tsx
 * Shows a progress bar for the currently playing snippet.
 * Always rendered at a fixed height so it does not shift the layout.
 * @version 2026.06.05
 */
import React from 'react';

interface SnippetProgressProps {
    isPlaying: boolean;
    positionMs: number;
    durationMs: number;
}

const SnippetProgress: React.FC<SnippetProgressProps> = ({ isPlaying, positionMs, durationMs }) => {
    const clampedPositionMs = Math.min(Math.max(positionMs, 0), Math.max(durationMs, 0));
    const positionSeconds = clampedPositionMs / 1000;
    const durationSeconds = Math.max(durationMs, 0) / 1000;
    const remainingSeconds = Math.max(0, durationSeconds - positionSeconds);
    const fillPercent = durationMs > 0 ? Math.min(100, (clampedPositionMs / durationMs) * 100) : 0;
    const reducedMotion = typeof window !== 'undefined'
        && typeof window.matchMedia === 'function'
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // positionMs only advances on timeupdate ticks (~4 Hz). While playing, sweep
    // the fill to 100% with a transition matched to the snippet duration so the
    // bar moves continuously and reaches full; keep stepped updates under
    // prefers-reduced-motion.
    const sweep = isPlaying && !reducedMotion && durationMs > 0;

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
                    className="snippet-progress-fill"
                    style={{
                        width: sweep ? '100%' : `${fillPercent}%`,
                        transitionDuration: sweep ? `${durationMs}ms` : '0ms'
                    }}
                />
            </div>
            <span className="snippet-progress-text">
                {isPlaying ? `Playing: ${remainingSeconds.toFixed(1)}s left` : 'Ready'}
            </span>
        </div>
    );
};

export default SnippetProgress;
