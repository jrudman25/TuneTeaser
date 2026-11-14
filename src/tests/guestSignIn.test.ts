/**
 * guestSignIn.test.ts
 * Tests the explicit sign-out suppression that keeps the auto guest sign-in
 * effects and in-flight callables from recreating an anonymous session while
 * the router is still leaving a guest page.
 * @version 2026.11.13
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    auth: {
        currentUser: null as { uid: string; metadata?: { lastSignInTime?: string } } | null,
        authStateReady: () => Promise.resolve()
    },
    signInAnonymously: vi.fn(),
    signOut: vi.fn()
}));

vi.mock('firebase/auth', () => ({
    signInAnonymously: (...args: unknown[]) => mocks.signInAnonymously(...args),
    signOut: (...args: unknown[]) => mocks.signOut(...args)
}));

vi.mock('../backend/FirebaseConfig', () => ({
    auth: mocks.auth
}));

const importModule = () => import('../utils/guestSignIn');

describe('guestSignIn explicit sign-out', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
        localStorage.clear();
        mocks.auth.currentUser = null;
        mocks.signOut.mockImplementation(async () => {
            mocks.auth.currentUser = null;
        });
        mocks.signInAnonymously.mockImplementation(async () => {
            const user = { uid: 'new-guest' };
            mocks.auth.currentUser = user;
            return { user };
        });
    });

    it('blocks automatic guest sign-in after an explicit sign-out', async () => {
        const { signInAsGuest, signOutExplicitly } = await importModule();

        mocks.auth.currentUser = { uid: 'guest-1' };
        await signOutExplicitly();

        await expect(signInAsGuest()).rejects.toThrow('Guest sign-in is temporarily unavailable');
        expect(mocks.signInAnonymously).not.toHaveBeenCalled();
    });

    it('signs out an anonymous session that lands during an explicit sign-out', async () => {
        const { signInAsGuest, signOutExplicitly } = await importModule();

        mocks.auth.currentUser = { uid: 'guest-1' };

        let resolveSignIn: (credential: { user: { uid: string } }) => void = () => {};
        mocks.signInAnonymously.mockReturnValue(new Promise(resolve => {
            resolveSignIn = credential => {
                mocks.auth.currentUser = credential.user;
                resolve(credential);
            };
        }));
        const pending = signInAsGuest();
        const done = signOutExplicitly();

        // The in-flight sign-in lands after signOut already resolved.
        resolveSignIn({ user: { uid: 'guest-2' } });
        await pending;
        await done;

        expect(mocks.signOut).toHaveBeenCalledTimes(2);
        expect(mocks.auth.currentUser).toBeNull();
        await expect(signInAsGuest()).rejects.toThrow('Guest sign-in is temporarily unavailable');
    });

    it('allows guest sign-in again once a new session exists', async () => {
        const { signInAsGuest, signOutExplicitly } = await importModule();

        mocks.auth.currentUser = { uid: 'guest-1' };
        await signOutExplicitly();
        await expect(signInAsGuest()).rejects.toThrow();

        // A real sign-in (for example Play as Guest on Login) lifts suppression.
        mocks.auth.currentUser = {
            uid: 'user-2',
            metadata: { lastSignInTime: new Date(Date.now() + 1000).toUTCString() }
        };
        await expect(signInAsGuest()).resolves.toMatchObject({ uid: 'user-2' });

        mocks.auth.currentUser = null;
        mocks.signInAnonymously.mockResolvedValue({ user: { uid: 'guest-3' } });
        await expect(signInAsGuest()).resolves.toEqual({ uid: 'guest-3' });
    });

    it('re-enables guest sign-in if the sign-out itself fails', async () => {
        const { signInAsGuest, signOutExplicitly } = await importModule();

        mocks.auth.currentUser = { uid: 'guest-1' };
        mocks.signOut.mockRejectedValueOnce(new Error('network failure'));
        await expect(signOutExplicitly()).rejects.toThrow('network failure');

        mocks.auth.currentUser = null;
        mocks.signInAnonymously.mockResolvedValue({ user: { uid: 'guest-4' } });
        await expect(signInAsGuest()).resolves.toEqual({ uid: 'guest-4' });
    });

    it('keeps suppressing after Login mounts until a deliberate sign-in', async () => {
        const { signInAsGuest, signOutExplicitly, endGuestSignInSuppression, clearGuestSignOutMarker } = await importModule();

        mocks.auth.currentUser = { uid: 'guest-1' };
        await signOutExplicitly();
        endGuestSignInSuppression();

        // The in-memory flag is lifted, but the persisted marker keeps a
        // remount (or another tab) from resurrecting the session.
        await expect(signInAsGuest()).rejects.toThrow('Guest sign-in is temporarily unavailable');
        expect(mocks.signInAnonymously).not.toHaveBeenCalled();

        // A deliberate guest sign-in (Play as Guest) clears the marker.
        clearGuestSignOutMarker();
        await expect(signInAsGuest()).resolves.toEqual({ uid: 'new-guest' });
        expect(mocks.signInAnonymously).toHaveBeenCalledTimes(1);
    });

    it('suppresses guest sign-in in another tab after an explicit sign-out', async () => {
        const tab1 = await importModule();
        mocks.auth.currentUser = { uid: 'guest-1' };
        await tab1.signOutExplicitly();

        // A second tab has fresh module state but shares localStorage.
        vi.resetModules();
        const tab2 = await importModule();
        await expect(tab2.signInAsGuest()).rejects.toThrow('Guest sign-in is temporarily unavailable');
        expect(mocks.signInAnonymously).not.toHaveBeenCalled();
    });

    it('lets a guest page sign in again once the sign-out marker expires', async () => {
        const tab1 = await importModule();

        mocks.auth.currentUser = { uid: 'guest-1' };
        await tab1.signOutExplicitly();

        // A remount or second tab has fresh module state; once the marker
        // ages out, auto guest sign-in is allowed again.
        vi.useFakeTimers();
        vi.setSystemTime(Date.now() + 90 * 1000);
        try {
            vi.resetModules();
            const tab2 = await importModule();
            await expect(tab2.signInAsGuest()).resolves.toEqual({ uid: 'new-guest' });
        } finally {
            vi.useRealTimers();
        }
        expect(mocks.signInAnonymously).toHaveBeenCalledTimes(1);
    });

    it('undoes an anonymous sign-in that lands after a sign-out in another tab', async () => {
        const tab1 = await importModule();

        let resolveSignIn: (credential: { user: { uid: string } }) => void = () => {};
        mocks.signInAnonymously.mockReturnValue(new Promise(resolve => {
            resolveSignIn = credential => {
                mocks.auth.currentUser = credential.user;
                resolve(credential);
            };
        }));
        const pending = tab1.signInAsGuest();

        // A second tab signs out while the first tab's sign-in is in flight.
        vi.resetModules();
        const tab2 = await importModule();
        mocks.auth.currentUser = { uid: 'guest-1' };
        await tab2.signOutExplicitly();

        resolveSignIn({ user: { uid: 'guest-2' } });
        await expect(pending).rejects.toThrow('superseded');
        expect(mocks.auth.currentUser).toBeNull();
    });

    it('keeps suppression if Login mounts while the sign-out is still running', async () => {
        const { signInAsGuest, signOutExplicitly, endGuestSignInSuppression } = await importModule();

        mocks.auth.currentUser = { uid: 'guest-1' };

        let resolveSignOut: () => void = () => {};
        mocks.signOut.mockReturnValue(new Promise<void>(resolve => {
            resolveSignOut = () => {
                mocks.auth.currentUser = null;
                resolve();
            };
        }));
        const done = signOutExplicitly();

        // Login mounts before the sign-out finishes: suppression must stay on
        // until it completes.
        endGuestSignInSuppression();
        resolveSignOut();
        await done;

        await expect(signInAsGuest()).rejects.toThrow('Guest sign-in is temporarily unavailable');
        expect(mocks.signInAnonymously).not.toHaveBeenCalled();
    });

    it('does not re-authenticate a call that was in flight across an explicit sign-out', async () => {
        const { callWithAuthRetry, signOutExplicitly, endGuestSignInSuppression } = await importModule();

        mocks.auth.currentUser = { uid: 'guest-1' };

        let rejectCall: (error: unknown) => void = () => {};
        const call = vi.fn()
            .mockImplementationOnce(() => new Promise((_resolve, reject) => {
                rejectCall = reject;
            }))
            .mockResolvedValue('retried-result');

        const retried = callWithAuthRetry(call);
        await vi.waitFor(() => expect(call).toHaveBeenCalled());

        await signOutExplicitly();
        endGuestSignInSuppression();

        const authError = { code: 'functions/unauthenticated' };
        rejectCall(authError);

        await expect(retried).rejects.toBe(authError);
        expect(call).toHaveBeenCalledTimes(1);
        expect(mocks.signInAnonymously).not.toHaveBeenCalled();
    });
});
