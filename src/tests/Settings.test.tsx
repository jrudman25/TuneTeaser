import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Settings from '../pages/Settings';

const mocks = vi.hoisted(() => ({
    deleteUser: vi.fn(),
    signOut: vi.fn(),
    authState: {
        user: { uid: 'u1', isAnonymous: false, displayName: 'Tester', email: 'tester@example.com' },
        isLoadingUser: false
    }
}));

vi.mock('../backend/FirebaseConfig', () => ({
    auth: {},
    functions: {}
}));

vi.mock('firebase/auth', () => ({
    deleteUser: mocks.deleteUser,
    signInAnonymously: vi.fn(),
    signOut: mocks.signOut
}));

vi.mock('firebase/functions', () => ({
    httpsCallable: vi.fn(() => vi.fn())
}));

vi.mock('../hooks/useTuneTeaserAuth', () => ({
    useTuneTeaserAuth: () => mocks.authState
}));

vi.mock('../hooks/useDarkMode', () => ({
    useDarkMode: () => ({ isDarkMode: false, toggleTheme: vi.fn() })
}));

vi.mock('../components/NavBar', () => ({
    default: () => <nav />
}));

describe('Settings account deletion', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    it('shows an error toast instead of alert when deletion requires recent login', async () => {
        const user = userEvent.setup();
        const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => { });
        mocks.deleteUser.mockRejectedValue(
            Object.assign(new Error('reauth required'), { code: 'auth/requires-recent-login' })
        );

        render(
            <MemoryRouter>
                <Settings />
            </MemoryRouter>
        );

        await user.click(screen.getByText(/danger zone/i));
        await user.click(screen.getAllByRole('button', { name: /delete my account/i })[0]);
        await user.click(screen.getAllByRole('button', { name: /delete my account/i }).pop()!);

        await waitFor(() => {
            expect(screen.getByText(/sign out and sign back in before deleting your account/i)).toBeInTheDocument();
        });
        expect(alertSpy).not.toHaveBeenCalled();
        alertSpy.mockRestore();
    });
});
