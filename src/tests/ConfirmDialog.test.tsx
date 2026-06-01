import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfirmDialog from '../components/ConfirmDialog';
import { vi, describe, it, expect } from 'vitest';

describe('ConfirmDialog', () => {
    const defaultProps = {
        open: true,
        title: 'Confirm Action',
        message: 'Are you sure you want to do this?',
        onConfirm: vi.fn(),
        onCancel: vi.fn(),
    };

    it('renders nothing when open is false', () => {
        render(<ConfirmDialog {...defaultProps} open={false} />);
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('renders title, message, and default buttons when open is true', () => {
        render(<ConfirmDialog {...defaultProps} />);
        
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Confirm Action')).toBeInTheDocument();
        expect(screen.getByText('Are you sure you want to do this?')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
    });

    it('calls onConfirm when confirm button is clicked', async () => {
        const onConfirm = vi.fn();
        render(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} />);
        
        const confirmBtn = screen.getByRole('button', { name: 'Confirm' });
        await userEvent.click(confirmBtn);
        
        expect(onConfirm).toHaveBeenCalled();
    });

    it('calls onCancel when cancel button is clicked', async () => {
        const onCancel = vi.fn();
        render(<ConfirmDialog {...defaultProps} onCancel={onCancel} />);
        
        const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
        await userEvent.click(cancelBtn);
        
        expect(onCancel).toHaveBeenCalled();
    });

    it('calls onCancel when Escape is pressed', async () => {
        const onCancel = vi.fn();
        render(<ConfirmDialog {...defaultProps} onCancel={onCancel} />);
        
        fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
        
        expect(onCancel).toHaveBeenCalled();
    });

    it('shows loading state and disables buttons when isLoading is true', () => {
        render(<ConfirmDialog {...defaultProps} isLoading={true} loadingLabel="Processing..." />);
        
        const confirmBtn = screen.getByRole('button', { name: 'Processing...' });
        const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
        
        expect(confirmBtn).toBeDisabled();
        expect(cancelBtn).toBeDisabled();
    });
});
