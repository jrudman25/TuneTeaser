/**
 * GameResult.tsx
 * Displays the result of the game (correct/incorrect) and options to play again.
 * @version 2026.11.13
 */
import React from 'react';
import PlayArrow from '@mui/icons-material/PlayArrow';
import Stop from '@mui/icons-material/Stop';
import SnippetProgress from './SnippetProgress';

interface GameResultProps {
    targetSong: any;
    feedbackMessage: string;
    onPlayAgain: () => void;
    onSelectNewPlaylist: () => void;
    isLoading?: boolean;
    earnedPoints?: number | null;
    pointsNote?: string | null;
    isPlaying?: boolean;
    isAdvancing?: boolean;
    positionMs?: number;
    previewDurationMs?: number;
    onTogglePreview?: () => void;
}

const GameResult: React.FC<GameResultProps> = ({
    targetSong,
    feedbackMessage,
    onPlayAgain,
    onSelectNewPlaylist,
    isLoading = false,
    earnedPoints = null,
    pointsNote = null,
    isPlaying = false,
    isAdvancing,
    positionMs = 0,
    previewDurationMs = 0,
    onTogglePreview
}) => {
    const artworkUrl = targetSong.album.images?.[0]?.url || '';
    const [loadedArtworkUrl, setLoadedArtworkUrl] = React.useState('');
    const [failedArtworkUrl, setFailedArtworkUrl] = React.useState('');
    const imageLoaded = !!artworkUrl && loadedArtworkUrl === artworkUrl && failedArtworkUrl !== artworkUrl;

    return (
        <section className="result-card">
            <div className="result-media">
                <div className="album-frame">
                    <div className="fallback-record">TuneTeaser</div>
                    {artworkUrl && failedArtworkUrl !== artworkUrl && (
                        <img
                            src={artworkUrl}
                            alt="Album Art"
                            width={300}
                            height={300}
                            decoding="async"
                            className={imageLoaded ? 'album-art album-art-loaded' : 'album-art'}
                            onLoad={() => setLoadedArtworkUrl(artworkUrl)}
                            onError={() => setFailedArtworkUrl(artworkUrl)}
                        />
                    )}
                </div>
                {onTogglePreview && (
                    <div className="result-preview">
                        <button
                            className="game-deck-play result-preview-play"
                            type="button"
                            onClick={onTogglePreview}
                            aria-label={isPlaying ? 'Stop preview' : 'Play preview'}
                            title={isPlaying ? 'Stop preview' : 'Play preview'}
                        >
                            {isPlaying ? <Stop aria-hidden="true" /> : <PlayArrow aria-hidden="true" />}
                        </button>
                        <div className="result-preview-progress">
                            <SnippetProgress
                                isPlaying={isPlaying}
                                isAdvancing={isAdvancing}
                                positionMs={positionMs}
                                durationMs={previewDurationMs}
                                idleText={`${previewDurationMs / 1000}s preview`}
                            />
                        </div>
                    </div>
                )}
            </div>

            <div className="result-info">
                <div className="result-status">
                    <span className="eyebrow">{feedbackMessage}</span>
                    {earnedPoints != null && earnedPoints > 0 && (
                        <span className="earned-points-badge">+{earnedPoints} pts</span>
                    )}
                    {pointsNote && <span className="points-note">{pointsNote}</span>}
                </div>
                <div className="result-header">
                    <h2 className="song-title">{targetSong.name}</h2>
                    <p className="artist-copy">Artist: {targetSong.artists.map((a: any) => a.name).join(', ')}</p>
                </div>
                <div className="action-row">
                    <button className="button button-tertiary" onClick={onPlayAgain} disabled={isLoading}>
                        Next Track
                    </button>
                    <button className="button button-secondary" onClick={onSelectNewPlaylist} disabled={isLoading}>
                        Select New Playlist
                    </button>
                </div>
                {isLoading && <div className="loading-card">Loading next track...</div>}
            </div>
        </section>
    );
};

export default GameResult;
