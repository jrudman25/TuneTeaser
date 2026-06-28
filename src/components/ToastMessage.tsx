import React, { useEffect } from 'react';

type ToastMessageProps = {
    message: string;
    type: 'error' | 'success';
    title?: string;
    durationMs?: number;
    onClose?: () => void;
};

const ToastMessage = ({ message, type, title, durationMs = 5000, onClose }: ToastMessageProps) => {
    useEffect(() => {
        if (!message) return;

        const timeoutId = window.setTimeout(() => {
            onClose?.();
        }, durationMs);

        return () => window.clearTimeout(timeoutId);
    }, [durationMs, message, onClose]);

    if (!message) return null;

    const label = title || (type === 'error' ? 'Error' : 'Success');

    return (
        <div className={`toast-message toast-message-${type}`} role={type === 'error' ? 'alert' : 'status'} aria-live={type === 'error' ? 'assertive' : 'polite'}>
            <div>
                <strong>{label}:</strong> {message}
            </div>
            <button type="button" className="toast-close" aria-label="Dismiss notification" onClick={() => onClose?.()}>
                X
            </button>
        </div>
    );
};

export default ToastMessage;
