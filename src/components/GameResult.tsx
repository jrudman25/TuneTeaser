/**
 * GameResult.tsx
 * Displays the result of the game (correct/incorrect) and options to play again.
 * @version 2026.06.05
 */
import React from 'react';

interface GameResultProps {
    targetSong: any;
    feedbackMessage: string;
    onPlayAgain: () => void;
    onSelectNewPlaylist: () => void;
    isLoading?: boolean;
    earnedPoints?: number | null;
    pointsNote?: string | null;
}

const GameResult: React.FC<GameResultProps> = ({
    targetSong,
    feedbackMessage,
    onPlayAgain,
    onSelectNewPlaylist,
    isLoading = false,
    earnedPoints = null,
    pointsNote = null
}) => {
    const artworkUrl = targetSong.album.images?.[0]?.url || '';
    const [loadedArtworkUrl, setLoadedArtworkUrl] = React.useState('');
    const [failedArtworkUrl, setFailedArtworkUrl] = React.useState('');
    const imageLoaded = !!artworkUrl && loadedArtworkUrl === artworkUrl && failedArtworkUrl !== artworkUrl;

    return (
        <section className="result-card">
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

            <div>
                <div className="result-header">
                    <span className="eyebrow">{feedbackMessage}</span>
                    {earnedPoints != null && earnedPoints > 0 && (
                        <span className="earned-points-badge">+{earnedPoints} pts</span>
                    )}
                    {pointsNote && <span className="points-note">{pointsNote}</span>}
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
