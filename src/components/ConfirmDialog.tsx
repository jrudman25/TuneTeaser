/**
 * ConfirmDialog.tsx
 * A themed confirmation modal that replaces the browser's native window.confirm().
 * Renders via portal into document.body so it layers above all page content.
 * @version 2026.05.31
 */
import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';

interface ConfirmDialogProps {
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'default';
    onConfirm: () => void;
    onCancel: () => void;
    isLoading?: boolean;
    loadingLabel?: string;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    open,
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    variant = 'default',
    onConfirm,
    onCancel,
    isLoading = false,
    loadingLabel = 'Processing...'
}) => {
    const cancelRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!open) return;

        // Focus the cancel button when the dialog opens
        cancelRef.current?.focus();

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !isLoading) {
                onCancel();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        // Prevent body scrolling while dialog is open
        document.body.style.overflow = 'hidden';

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
        };
    }, [open, onCancel, isLoading]);

    if (!open) return null;

    const confirmButtonClass = variant === 'danger'
        ? 'button button-danger'
        : 'button button-primary';

    return ReactDOM.createPortal(
        <div
            className="confirm-overlay"
            onClick={isLoading ? undefined : onCancel}
            role="dialog"
            aria-modal="true"
            aria-label={title}
        >
            <div
                className="confirm-card"
                onClick={(e) => e.stopPropagation()}
            >
                <h2 className="confirm-title">{title}</h2>
                <p className="confirm-body">{message}</p>
                <div className="confirm-actions">
                    <button
                        ref={cancelRef}
                        className="button button-quiet"
                        type="button"
                        onClick={onCancel}
                        disabled={isLoading}
                    >
                        {cancelLabel}
                    </button>
                    <button
                        className={confirmButtonClass}
                        type="button"
                        onClick={onConfirm}
                        disabled={isLoading}
                    >
                        {isLoading ? loadingLabel : confirmLabel}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ConfirmDialog;
