/**
 * usePreviewPlayer.ts
 * Handles playing 30-second song previews using HTML5 Audio.
 * @version 2026.02.05
 */
import { useState, useRef, useCallback, useEffect } from 'react';

interface UsePreviewPlayerReturn {
    playPreview: (previewUrl: string, durationMs: number) => void;
    pause: () => void;
    isPlaying: boolean;
    error: string | null;
    volume: number;
    setVolume: (volume: number) => void;
}

const usePreviewPlayer = (): UsePreviewPlayerReturn => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [volume, setVolume] = useState(0.5);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isStoppingRef = useRef(false);
    const volumeRef = useRef(volume);

    useEffect(() => {
        volumeRef.current = volume;
        if (audioRef.current) {
            audioRef.current.volume = volume;
        }
    }, [volume]);

    useEffect(() => {
        return () => {
            if (audioRef.current) {
                isStoppingRef.current = true;
                audioRef.current.pause();
                audioRef.current = null;
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
        setIsPlaying(false);
    }, []);

    const playPreview = useCallback((previewUrl: string, durationMs: number) => {
        setError(null);
        pause();
        isStoppingRef.current = false;

        if (!previewUrl) {
            setError("No preview URL available for this track.");
            return;
        }

        try {
            const audio = new Audio(previewUrl);
            audio.volume = volumeRef.current;
            audioRef.current = audio;

            audio.addEventListener('canplay', () => {
                if (audioRef.current === audio) {
                    audio.volume = volumeRef.current;

                    audio.play()
                        .then(() => {
                            setIsPlaying(true);
                            timeoutRef.current = setTimeout(() => {
                                pause();
                            }, durationMs);
                        })
                        .catch((err) => {
                            if (isStoppingRef.current) return;
                            console.error("Audio playback failed:", err);
                            setError("Failed to play preview. Please try again.");
                            setIsPlaying(false);
                        });
                }
            }, { once: true });

            audio.addEventListener('error', (e) => {
                if (isStoppingRef.current) return;
                setError("Failed to load preview audio.");
                setIsPlaying(false);
            });

            audio.addEventListener('ended', () => {
                setIsPlaying(false);
                if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                    timeoutRef.current = null;
                }
            });

            audio.load();

        } catch (err) {
            console.error("Error creating audio:", err);
            setError("Failed to initialize audio playback.");
        }
    }, [pause]);

    return { playPreview, pause, isPlaying, error, volume, setVolume };
};

export default usePreviewPlayer;
