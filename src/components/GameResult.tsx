/**
 * GameResult.tsx
 * Displays the result of the game (correct/incorrect) and options to play again.
 * @version 2026.05.27
 */
import React from 'react';

interface GameResultProps {
    targetSong: any;
    feedbackMessage: string;
    onPlayAgain: () => void;
    onSelectNewPlaylist: () => void;
    isLoading?: boolean;
    earnedPoints?: number | null;
}

const GameResult: React.FC<GameResultProps> = ({
    targetSong,
    feedbackMessage,
    onPlayAgain,
    onSelectNewPlaylist,
    isLoading = false,
    earnedPoints = null
}) => {
    return (
        <section className="result-card">
            <div className="album-frame">
                {targetSong.album.images?.[0] ? (
                    <img src={targetSong.album.images[0].url} alt="Album Art" />
                ) : (
                    <div className="fallback-record">TuneTeaser</div>
                )}
            </div>

            <div>
                <div className="result-header">
                    <span className="eyebrow">{feedbackMessage}</span>
                    {earnedPoints != null && earnedPoints > 0 && (
                        <span className="earned-points-badge">+{earnedPoints} pts</span>
                    )}
                    <h2 className="song-title">{targetSong.name}</h2>
                    <p className="artist-copy">Artist: {targetSong.artists.map((a: any) => a.name).join(', ')}</p>
                </div>
                <div className="action-row">
                    <button className="button button-tertiary" onClick={onPlayAgain} disabled={isLoading}>
                        Play Again
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

