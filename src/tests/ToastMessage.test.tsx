import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ToastMessage from '../components/ToastMessage';

const ControlledToast = ({ message }: { message: string }) => {
    const [toastMessage, setToastMessage] = React.useState(message);

    return (
        <>
            <button type="button" onClick={() => setToastMessage(message)}>Show Toast</button>
            <ToastMessage message={toastMessage} type="error" onClose={() => setToastMessage('')} />
        </>
    );
};

describe('ToastMessage', () => {
    it('clears parent state on dismiss so the same message can be shown again', async () => {
        const user = userEvent.setup();
        render(<ControlledToast message="Enter a Spotify playlist URL." />);

        expect(screen.getByText(/enter a spotify playlist url/i)).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: /dismiss notification/i }));
        expect(screen.queryByText(/enter a spotify playlist url/i)).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: /show toast/i }));
        expect(screen.getByText(/enter a spotify playlist url/i)).toBeInTheDocument();
    });

    it('auto-dismisses through onClose', () => {
        vi.useFakeTimers();
        const onClose = vi.fn();

        render(<ToastMessage message="Saved playlist." type="success" durationMs={1000} onClose={onClose} />);

        vi.advanceTimersByTime(1000);

        expect(onClose).toHaveBeenCalledTimes(1);
        vi.useRealTimers();
    });
});
