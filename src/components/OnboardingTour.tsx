/**
 * OnboardingTour.tsx
 * A multi-step guided overlay for new users.
 * Walks through adding playlists, the leaderboard, and the help page.
 * @version 2026.05.31
 */
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Link } from 'react-router-dom';

interface OnboardingTourProps {
    open: boolean;
    isGuest: boolean;
    onComplete: () => void;
}

interface TourStep {
    title: string;
    body: React.ReactNode;
}

const OnboardingTour: React.FC<OnboardingTourProps> = ({ open, isGuest, onComplete }) => {
    const [step, setStep] = useState(0);

    useEffect(() => {
        if (!open) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onComplete();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        document.body.style.overflow = 'hidden';

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
        };
    }, [open, onComplete]);

    if (!open) return null;

    const playlistsPath = isGuest ? '/playlists?mode=guest' : '/playlists';
    const importPath = isGuest ? '/playlists/import?mode=guest' : '/playlists/import';

    const steps: TourStep[] = [
        {
            title: 'Welcome to TuneTeaser',
            body: (
                <>
                    <p className="confirm-body">
                        Test your music knowledge by guessing songs from short audio snippets.
                        The faster you guess, the more points you earn.
                    </p>
                    <p className="confirm-body" style={{ marginTop: '12px' }}>
                        Let us walk you through the basics to get you started.
                    </p>
                </>
            )
        },
        {
            title: 'Build Your Library',
            body: (
                <>
                    <p className="confirm-body">
                        TuneTeaser plays songs from playlists you import. There are three ways to add music:
                    </p>
                    <ul className="onboarding-feature-list">
                        <li>
                            <span className="number-chip">1</span>
                            <span>Paste a <strong>Spotify playlist URL</strong> to import any public playlist.</span>
                        </li>
                        <li>
                            <span className="number-chip">2</span>
                            <span>Paste a <strong>Spotify profile URL</strong> to browse and pick from public playlists.</span>
                        </li>
                        {!isGuest && (
                            <li>
                                <span className="number-chip">3</span>
                                <span>Build a <strong>custom mix</strong> from individual track URLs or song lines.</span>
                            </li>
                        )}
                    </ul>
                    <div className="onboarding-cta-row">
                        <Link
                            className="button button-secondary"
                            to={importPath}
                            onClick={onComplete}
                        >
                            Import a Playlist Now
                        </Link>
                        <Link
                            className="button button-quiet"
                            to={playlistsPath}
                            onClick={onComplete}
                        >
                            Browse Library
                        </Link>
                    </div>
                </>
            )
        },
        {
            title: 'Climb the Leaderboard',
            body: (
                <>
                    <p className="confirm-body">
                        Every correct guess earns points based on how fast you answer.
                        Consecutive correct guesses build a score multiplier.
                    </p>
                    {isGuest ? (
                        <p className="confirm-body" style={{ marginTop: '12px' }}>
                            Guest scores are not uploaded to the leaderboard.
                            Create an account to compete for the top spot.
                        </p>
                    ) : (
                        <p className="confirm-body" style={{ marginTop: '12px' }}>
                            Your scores are saved to the global leaderboard.
                            Play on playlists with 10 or more tracks to earn eligible points.
                        </p>
                    )}
                    <div className="onboarding-cta-row">
                        <Link
                            className="button button-secondary"
                            to="/leaderboard"
                            onClick={onComplete}
                        >
                            View Leaderboard
                        </Link>
                    </div>
                </>
            )
        },
        {
            title: 'Need Help?',
            body: (
                <>
                    <p className="confirm-body">
                        Our Help & FAQ page covers everything: how to find Spotify links,
                        playlist limits, scoring rules, and account modes.
                    </p>
                    <p className="confirm-body" style={{ marginTop: '12px' }}>
                        You can always find it in the navigation menu.
                    </p>
                    <div className="onboarding-cta-row">
                        <Link
                            className="button button-secondary"
                            to={isGuest ? '/help?mode=guest' : '/help'}
                            onClick={onComplete}
                        >
                            Open Help & FAQ
                        </Link>
                    </div>
                </>
            )
        }
    ];

    const isLastStep = step === steps.length - 1;
    const currentStep = steps[step];

    return ReactDOM.createPortal(
        <div
            className="confirm-overlay"
            onClick={onComplete}
            role="dialog"
            aria-modal="true"
            aria-label="Onboarding tour"
        >
            <div
                className="confirm-card onboarding-card"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="onboarding-step-indicator">
                    {steps.map((_, i) => (
                        <span
                            key={i}
                            className={`onboarding-dot${i === step ? ' onboarding-dot-active' : ''}`}
                        />
                    ))}
                </div>

                <h2 className="confirm-title">{currentStep.title}</h2>
                <div className="onboarding-step-body">
                    {currentStep.body}
                </div>

                <div className="confirm-actions">
                    <button
                        className="button button-quiet"
                        type="button"
                        onClick={onComplete}
                    >
                        Skip
                    </button>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        {step > 0 && (
                            <button
                                className="button button-quiet"
                                type="button"
                                onClick={() => setStep(step - 1)}
                            >
                                Back
                            </button>
                        )}
                        <button
                            className="button button-tertiary"
                            type="button"
                            onClick={() => {
                                if (isLastStep) {
                                    onComplete();
                                } else {
                                    setStep(step + 1);
                                }
                            }}
                        >
                            {isLastStep ? "Let's Play" : 'Next'}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default OnboardingTour;
