/**
 * usePreviewPlayer.ts
 * Handles playing 30-second song previews using HTML5 Audio.
 * @version 2026.01.28
 */
import { useState, useRef, useCallback, useEffect } from 'react';

interface UsePreviewPlayerReturn {
    playPreview: (previewUrl: string, durationMs: number) => void;
    pause: () => void;
    isPlaying: boolean;
    error: string | null;
}

const usePreviewPlayer = (): UsePreviewPlayerReturn => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    const pause = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        setIsPlaying(false);
    }, []);

    const playPreview = useCallback((previewUrl: string, durationMs: number) => {
        setError(null);

        // Stop any existing playback
        pause();

        if (!previewUrl) {
            setError("No preview URL available for this track.");
            return;
        }

        try {
            const audio = new Audio(previewUrl);
            audioRef.current = audio;

            audio.addEventListener('canplay', () => {
                if (audioRef.current === audio) {
                    audio.play()
                        .then(() => {
                            setIsPlaying(true);

                            // Schedule pause after duration
                            timeoutRef.current = setTimeout(() => {
                                pause();
                            }, durationMs);
                        })
                        .catch((err) => {
                            console.error("Audio playback failed:", err);
                            setError("Failed to play preview. Please try again.");
                            setIsPlaying(false);
                        });
                }
            }, { once: true });

            audio.addEventListener('error', (e) => {
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

    return { playPreview, pause, isPlaying, error };
};

export default usePreviewPlayer;
