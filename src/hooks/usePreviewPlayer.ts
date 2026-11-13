/**
 * usePreviewPlayer.ts
 * Handles playing 30-second song previews using HTML5 Audio.
 * The stop timer is based on audio position, not wall clock, so a
 * buffering stall does not eat into the scored snippet duration.
 * @version 2026.06.05
 */
import { useState, useRef, useCallback, useEffect } from 'react';

interface UsePreviewPlayerReturn {
    playPreview: (previewUrl: string, durationMs: number) => void;
    pause: () => void;
    isPlaying: boolean;
    error: string | null;
    volume: number;
    setVolume: (volume: number) => void;
    positionMs: number;
    playbackDurationMs: number;
    preloadPreview: (url: string) => void;
}

const usePreviewPlayer = (): UsePreviewPlayerReturn => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [volume, setVolume] = useState(0.5);
    const [positionMs, setPositionMs] = useState(0);
    const [playbackDurationMs, setPlaybackDurationMs] = useState(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
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
        setPositionMs(0);
        setIsPlaying(false);
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

            const scheduleStop = () => {
                if (audioRef.current !== audio) return;
                clearStopTimer();
                const remainingMs = durationMs - audio.currentTime * 1000;
                timeoutRef.current = setTimeout(() => {
                    if (audioRef.current !== audio) return;
                    if (audio.currentTime * 1000 >= durationMs - 20) {
                        pause();
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
                        console.error("Audio playback failed:", err);
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
                    scheduleStop();
                }
            });

            audio.addEventListener('waiting', () => {
                if (audioRef.current === audio) {
                    clearStopTimer();
                }
            });

            audio.addEventListener('timeupdate', () => {
                if (audioRef.current !== audio) return;
                const position = audio.currentTime * 1000;
                setPositionMs(Math.min(position, durationMs));
                if (position >= durationMs) {
                    pause();
                }
            });

            audio.addEventListener('error', () => {
                if (audioRef.current !== audio || isStoppingRef.current) return;
                setError("Failed to load preview audio.");
                setIsPlaying(false);
            });

            audio.addEventListener('ended', () => {
                if (audioRef.current !== audio) return;
                setIsPlaying(false);
                clearStopTimer();
            });

            if (!isReusedPreload) {
                audio.load();
            }

        } catch (err) {
            console.error("Error creating audio:", err);
            setError("Failed to initialize audio playback.");
        }
    }, [pause]);

    return { playPreview, pause, isPlaying, error, volume, setVolume, positionMs, playbackDurationMs, preloadPreview };
};

export default usePreviewPlayer;
