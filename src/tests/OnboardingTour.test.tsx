import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OnboardingTour from '../components/OnboardingTour';
import { vi, describe, it, expect } from 'vitest';

describe('OnboardingTour', () => {
    const defaultProps = {
        open: true,
        isGuest: false,
        onComplete: vi.fn(),
    };

    it('renders nothing when open is false', () => {
        render(<OnboardingTour {...defaultProps} open={false} />);
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('renders the first step when open is true', () => {
        render(<OnboardingTour {...defaultProps} />);
        
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Welcome to TuneTeaser')).toBeInTheDocument();
        expect(screen.getByText('Skip')).toBeInTheDocument();
        expect(screen.getByText('Next')).toBeInTheDocument();
        // Back button shouldn't be visible on the first step
        expect(screen.queryByText('Back')).toBeNull();
    });

    it('advances through steps with Next and Back buttons', async () => {
        const user = userEvent.setup();
        render(<OnboardingTour {...defaultProps} />);
        
        const nextBtn = screen.getByText('Next');
        
        // Go to step 2
        await user.click(nextBtn);
        expect(screen.getByText('Build Your Library')).toBeInTheDocument();
        expect(screen.getByText('Back')).toBeInTheDocument();
        
        // Go to step 3
        await user.click(nextBtn);
        expect(screen.getByText('Climb the Leaderboard')).toBeInTheDocument();
        
        // Go back to step 2
        const backBtn = screen.getByText('Back');
        await user.click(backBtn);
        expect(screen.getByText('Build Your Library')).toBeInTheDocument();
    });

    it('shows different text for guests vs registered users on the Build Your Library step', async () => {
        const user = userEvent.setup();
        const { unmount } = render(<OnboardingTour {...defaultProps} isGuest={false} />);
        
        await user.click(screen.getByText('Next'));
        expect(screen.getByText(/There are four ways to add music/)).toBeInTheDocument();
        expect(screen.getByText(/custom mix/)).toBeInTheDocument();
        
        unmount();
        
        render(<OnboardingTour {...defaultProps} isGuest={true} />);
        await user.click(screen.getByText('Next'));
        expect(screen.getByText(/There are three ways to add music/)).toBeInTheDocument();
        expect(screen.queryByText(/custom mix/)).toBeNull();
    });

    it('calls onComplete when Skip is clicked', async () => {
        const onComplete = vi.fn();
        const user = userEvent.setup();
        render(<OnboardingTour {...defaultProps} onComplete={onComplete} />);
        
        await user.click(screen.getByText('Skip'));
        expect(onComplete).toHaveBeenCalled();
    });

    it('calls onComplete when the last step finishes', async () => {
        const onComplete = vi.fn();
        const user = userEvent.setup();
        render(<OnboardingTour {...defaultProps} onComplete={onComplete} />);
        
        // Skip through first 4 steps
        for (let i = 0; i < 4; i++) {
            await user.click(screen.getByText('Next'));
        }
        
        // Now on step 5
        expect(screen.getByText('Need Help?')).toBeInTheDocument();
        
        const finishBtn = screen.getByText("Let's Play");
        await user.click(finishBtn);
        
        expect(onComplete).toHaveBeenCalled();
    });

    it('calls onComplete when Escape is pressed', () => {
        const onComplete = vi.fn();
        render(<OnboardingTour {...defaultProps} onComplete={onComplete} />);
        
        fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
        expect(onComplete).toHaveBeenCalled();
    });
});
