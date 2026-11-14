/**
 * SnippetProgress.test.tsx
 * Tests the snippet progress fill animations (WAAPI sweep + reset).
 * jsdom does not implement element.animate, so it is stubbed and
 * getComputedStyle is stubbed to return px like a real browser.
 * @version 2026.11.13
 */
import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SnippetProgress from '../components/SnippetProgress';

type AnimateCall = { keyframes: Keyframe[]; opts: KeyframeAnimationOptions };

const fakeAnimate = (animateCalls: AnimateCall[]) => (
    (keyframes: unknown, opts: unknown): Animation => {
        animateCalls.push({ keyframes: keyframes as Keyframe[], opts: opts as KeyframeAnimationOptions });
        return { cancel: () => undefined } as unknown as Animation;
    }
);

describe('SnippetProgress fill animation', () => {
    const animateCalls: AnimateCall[] = [];
    const realAnimate = Element.prototype.animate;

    beforeEach(() => {
        animateCalls.length = 0;
        Element.prototype.animate = fakeAnimate(animateCalls) as unknown as typeof Element.prototype.animate;
        // Real browsers resolve a percentage width to px in getComputedStyle;
        // jsdom returns the authored value, which hides the reset animation.
        vi.stubGlobal('getComputedStyle', () => ({ width: '260px' }));
    });

    afterEach(() => {
        Element.prototype.animate = realAnimate;
        vi.unstubAllGlobals();
    });

    it('sweeps the fill to 100% over the remaining time while advancing', () => {
        render(<SnippetProgress isPlaying isAdvancing positionMs={500} durationMs={2000} />);

        expect(animateCalls).toHaveLength(1);
        expect(animateCalls[0].keyframes).toEqual([{ width: '25%' }, { width: '100%' }]);
        expect(animateCalls[0].opts).toMatchObject({ duration: 1500, fill: 'forwards' });
    });

    it('animates the fill back to empty when playback ends', () => {
        const { rerender } = render(
            <SnippetProgress isPlaying isAdvancing positionMs={500} durationMs={2000} />
        );
        // Snippet reaches its duration: bar holds at full during the end-hold.
        rerender(<SnippetProgress isPlaying isAdvancing={false} positionMs={2000} durationMs={2000} />);
        // End-hold expires: position resets to 0.
        rerender(<SnippetProgress isPlaying={false} isAdvancing={false} positionMs={0} durationMs={2000} />);

        const last = animateCalls[animateCalls.length - 1];
        expect(last.keyframes).toEqual([{ width: '260px' }, { width: '0%' }]);
        // fill:forwards keeps a finished reset applied so the next effect
        // cleanup still measures the held width (React mutates the base
        // style before cleanup runs, so without it the capture reads 0px).
        expect(last.opts).toMatchObject({ duration: 250, fill: 'forwards' });
    });

    it('snaps instead of animating when the browser cannot animate', () => {
        delete (Element.prototype as { animate?: unknown }).animate;

        const { container, rerender } = render(
            <SnippetProgress isPlaying isAdvancing positionMs={500} durationMs={2000} />
        );
        rerender(<SnippetProgress isPlaying={false} isAdvancing={false} positionMs={0} durationMs={2000} />);

        const fill = container.querySelector('.snippet-progress-fill') as HTMLElement;
        expect(fill.style.width).toBe('0%');
    });
});
