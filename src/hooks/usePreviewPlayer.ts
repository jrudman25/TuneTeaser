/**
 * usePreviewPlayer.ts
 * Handles playing 30-second song previews using HTML5 Audio.
 * The stop timer is based on audio position, not wall clock, so a
 * buffering stall does not eat into the scored snippet duration.
 * @version 2026.11.13
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { logger } from '../utils/logger';

interface UsePreviewPlayerReturn {
    playPreview: (previewUrl: string, durationMs: number) => void;
    pause: () => void;
    isPlaying: boolean;
    isAdvancing: boolean;
    error: string | null;
    volume: number;
    setVolume: (volume: number) => void;
    positionMs: number;
    playbackDurationMs: number;
    preloadPreview: (url: string) => void;
}

// How long the UI stays at a full bar / "0.0s left" after a snippet finishes
// before resetting to idle.
const END_HOLD_MS = 300;

const usePreviewPlayer = (): UsePreviewPlayerReturn => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isAdvancing, setIsAdvancing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [volume, setVolume] = useState(0.5);
    const [positionMs, setPositionMs] = useState(0);
    const [playbackDurationMs, setPlaybackDurationMs] = useState(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const endHoldRef = useRef<NodeJS.Timeout | null>(null);
    const isStoppingRef = useRef(false);
    const volumeRef = useRef(volume);
    const preloadRef = useRef<{ url: string; audio: HTMLAudioElement } | null>(null);

    useEffect(() => {
        volumeRef.current = volume;
        if (audioRef.current) {
            audioRef.current.volume = volume;
        }
    }, [volume]);

    useEffect(() => {
        return () => {
            isStoppingRef.current = true;
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
            if (preloadRef.current) {
                const preloaded = preloadRef.current.audio;
                preloaded.src = '';
                preloaded.load();
                preloadRef.current = null;
            }
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            if (endHoldRef.current) {
                clearTimeout(endHoldRef.current);
            }
        };
    }, []);

    const pause = useCallback(() => {
        isStoppingRef.current = true;
        if (audioRef.current) {
            const audio = audioRef.current;
            audio.pause();
            audio.src = '';
            audio.load();
            audioRef.current = null;
        }
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        if (endHoldRef.current) {
            clearTimeout(endHoldRef.current);
            endHoldRef.current = null;
        }
        setPositionMs(0);
        setIsPlaying(false);
        setIsAdvancing(false);
    }, []);

    const preloadPreview = useCallback((url: string) => {
        if (!url || preloadRef.current?.url === url) return;
        if (preloadRef.current) {
            const previous = preloadRef.current.audio;
            previous.src = '';
            previous.load();
            preloadRef.current = null;
        }
        try {
            const audio = new Audio();
            audio.preload = 'auto';
            audio.src = url;
            audio.load();
            preloadRef.current = { url, audio };
        } catch {
            preloadRef.current = null;
        }
    }, []);

    const playPreview = useCallback((previewUrl: string, durationMs: number) => {
        setError(null);
        pause();
        isStoppingRef.current = false;

        if (!previewUrl) {
            setError("No preview URL available for this track.");
            return;
        }

        setPositionMs(0);
        setPlaybackDurationMs(durationMs);

        try {
            let audio: HTMLAudioElement;
            let isReusedPreload = false;
            if (preloadRef.current?.url === previewUrl) {
                audio = preloadRef.current.audio;
                preloadRef.current = null;
                isReusedPreload = true;
            } else {
                audio = new Audio(previewUrl);
            }
            audio.volume = volumeRef.current;
            audioRef.current = audio;

            const clearStopTimer = () => {
                if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                    timeoutRef.current = null;
                }
            };

            // The snippet reached its scored duration: release the audio but
            // keep the UI pinned at 100% / "0.0s left" for END_HOLD_MS before
            // resetting to idle.
            const completePlayback = () => {
                if (audioRef.current !== audio) return;
                isStoppingRef.current = true;
                audio.pause();
                audio.src = '';
                audio.load();
                audioRef.current = null;
                clearStopTimer();
                setIsAdvancing(false);
                setPositionMs(durationMs);
                endHoldRef.current = setTimeout(() => {
                    endHoldRef.current = null;
                    setPositionMs(0);
                    setIsPlaying(false);
                }, END_HOLD_MS);
            };

            const scheduleStop = () => {
                if (audioRef.current !== audio) return;
                clearStopTimer();
                const remainingMs = durationMs - audio.currentTime * 1000;
                timeoutRef.current = setTimeout(() => {
                    if (audioRef.current !== audio) return;
                    if (audio.currentTime * 1000 >= durationMs - 20) {
                        completePlayback();
                    } else {
                        scheduleStop();
                    }
                }, Math.max(50, remainingMs));
            };

            const startPlayback = () => {
                if (audioRef.current !== audio) return;
                audio.volume = volumeRef.current;
                audio.play()
                    .then(() => {
                        if (audioRef.current === audio) {
                            setIsPlaying(true);
                        }
                    })
                    .catch((err) => {
                        if (isStoppingRef.current) return;
                        // Autoplay policy blocked the play (e.g. the result
                        // screen replay without a recent gesture). Not a real
                        // failure: stay silent so the play control can retry.
                        if (err?.name === 'NotAllowedError') {
                            setIsPlaying(false);
                            return;
                        }
                        logger.error("Audio playback failed:", err);
                        setError("Failed to play preview. Please try again.");
                        setIsPlaying(false);
                    });
            };

            if (audio.readyState >= 3) {
                startPlayback();
            } else {
                audio.addEventListener('canplay', startPlayback, { once: true });
            }

            audio.addEventListener('playing', () => {
                if (audioRef.current === audio) {
                    // 'playing' can fire before the position starts moving
                    // (buffer priming, output latency). Treat it as advancing
                    // only when resuming mid-snippet; the first real position
                    // advance is confirmed by timeupdate below.
                    if (audio.currentTime * 1000 > 0) {
                        setIsAdvancing(true);
                    }
                    scheduleStop();
                }
            });

            audio.addEventListener('waiting', () => {
                if (audioRef.current === audio) {
                    setIsAdvancing(false);
                    clearStopTimer();
                }
            });

            audio.addEventListener('timeupdate', () => {
                if (audioRef.current !== audio) return;
                const position = audio.currentTime * 1000;
                setPositionMs(Math.min(position, durationMs));
                if (position > 0) {
                    setIsAdvancing(true);
                }
                if (position >= durationMs) {
                    completePlayback();
                }
            });

            audio.addEventListener('error', () => {
                if (audioRef.current !== audio || isStoppingRef.current) return;
                setError("Failed to load preview audio.");
                setIsPlaying(false);
                setIsAdvancing(false);
            });

            audio.addEventListener('ended', () => {
                completePlayback();
            });

            if (!isReusedPreload) {
                audio.load();
            }

        } catch (err) {
            logger.error("Error creating audio:", err);
            setError("Failed to initialize audio playback.");
        }
    }, [pause]);

    return { playPreview, pause, isPlaying, isAdvancing, error, volume, setVolume, positionMs, playbackDurationMs, preloadPreview };
};

export default usePreviewPlayer;
