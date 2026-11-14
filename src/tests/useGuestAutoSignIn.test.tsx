/**
 * useGuestAutoSignIn.test.tsx
 * Tests that auto guest sign-in only fires when the page never observed a
 * signed-in user: a user -> null transition is a sign-out (possibly synced
 * from another tab) and must not resurrect the guest session.
 * @version 2026.11.13
 */
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGuestAutoSignIn } from '../hooks/useGuestAutoSignIn';

const mocks = vi.hoisted(() => ({
    signInAsGuest: vi.fn(),
    GuestSignInSuppressedError: class extends Error {}
}));

vi.mock('../utils/guestSignIn', () => ({
    signInAsGuest: (...args: unknown[]) => mocks.signInAsGuest(...args),
    GuestSignInSuppressedError: mocks.GuestSignInSuppressedError
}));

vi.mock('../backend/FirebaseConfig', () => ({
    auth: {}
}));

const anonUser = { uid: 'guest-1', isAnonymous: true };

describe('useGuestAutoSignIn', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('signs in anonymously when auth resolves to no user on mount', () => {
        mocks.signInAsGuest.mockResolvedValue(anonUser);

        renderHook(() => useGuestAutoSignIn(true, null, false));

        expect(mocks.signInAsGuest).toHaveBeenCalledTimes(1);
    });

    it('waits for the initial auth state before signing in', () => {
        mocks.signInAsGuest.mockResolvedValue(anonUser);

        const { rerender } = renderHook(
            ({ user, isLoadingUser }: { user: null; isLoadingUser: boolean }) =>
                useGuestAutoSignIn(true, user, isLoadingUser),
            { initialProps: { user: null, isLoadingUser: true } }
        );
        expect(mocks.signInAsGuest).not.toHaveBeenCalled();

        rerender({ user: null, isLoadingUser: false });
        expect(mocks.signInAsGuest).toHaveBeenCalledTimes(1);
    });

    it('does not sign in when a user already exists', () => {
        renderHook(() => useGuestAutoSignIn(true, anonUser as never, false));

        expect(mocks.signInAsGuest).not.toHaveBeenCalled();
    });

    it('does not re-sign in after the user signs out', () => {
        mocks.signInAsGuest.mockResolvedValue(anonUser);

        const { rerender } = renderHook(
            ({ user }: { user: typeof anonUser | null }) =>
                useGuestAutoSignIn(true, user as never, false),
            { initialProps: { user: anonUser as typeof anonUser | null } }
        );

        rerender({ user: null });

        expect(mocks.signInAsGuest).not.toHaveBeenCalled();
    });

    it('does not sign in when disabled', () => {
        renderHook(() => useGuestAutoSignIn(false, null, false));

        expect(mocks.signInAsGuest).not.toHaveBeenCalled();
    });

    it('reports a failed guest sign-in through onError', async () => {
        const failure = new Error('disabled');
        mocks.signInAsGuest.mockRejectedValue(failure);
        const onError = vi.fn();

        renderHook(() => useGuestAutoSignIn(true, null, false, onError));

        await vi.waitFor(() => expect(onError).toHaveBeenCalledWith(failure));
    });

    it('swallows sign-out suppression without reporting an error', async () => {
        mocks.signInAsGuest.mockRejectedValue(new mocks.GuestSignInSuppressedError());
        const onError = vi.fn();

        renderHook(() => useGuestAutoSignIn(true, null, false, onError));

        await vi.waitFor(() => expect(mocks.signInAsGuest).toHaveBeenCalled());
        expect(onError).not.toHaveBeenCalled();
    });
});
