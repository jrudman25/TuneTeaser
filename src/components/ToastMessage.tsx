import React, { useEffect, useRef, useState } from 'react';

type ToastMessageProps = {
    message: string;
    type: 'error' | 'success';
    title?: string;
    durationMs?: number;
    onClose?: () => void;
};

const ToastMessage = ({ message, type, title, durationMs = 5000, onClose }: ToastMessageProps) => {
    const [isVisible, setIsVisible] = useState(false);
    const onCloseRef = useRef(onClose);

    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        if (!message) {
            setIsVisible(false);
            return;
        }

        setIsVisible(true);
        const timeoutId = window.setTimeout(() => {
            setIsVisible(false);
            onCloseRef.current?.();
        }, durationMs);

        return () => window.clearTimeout(timeoutId);
    }, [durationMs, message]);

    if (!message || !isVisible) return null;

    const label = title || (type === 'error' ? 'Error' : 'Success');

    return (
        <div className={`toast-message toast-message-${type}`} role={type === 'error' ? 'alert' : 'status'} aria-live={type === 'error' ? 'assertive' : 'polite'}>
            <div>
                <strong>{label}:</strong> {message}
            </div>
            <button type="button" className="toast-close" aria-label="Dismiss notification" onClick={() => {
                setIsVisible(false);
                onCloseRef.current?.();
            }}>
                X
            </button>
        </div>
    );
};

export default ToastMessage;
