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
        currentUser: null as { uid: string } | null,
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

        await expect(signInAsGuest()).rejects.toThrow('Guest sign-in is disabled');
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
        await expect(signInAsGuest()).rejects.toThrow('Guest sign-in is disabled');
    });

    it('allows guest sign-in again once a new session exists', async () => {
        const { signInAsGuest, signOutExplicitly } = await importModule();

        mocks.auth.currentUser = { uid: 'guest-1' };
        await signOutExplicitly();
        await expect(signInAsGuest()).rejects.toThrow();

        // A real sign-in (for example Play as Guest on Login) lifts suppression.
        mocks.auth.currentUser = { uid: 'user-2' };
        await expect(signInAsGuest()).resolves.toEqual({ uid: 'user-2' });

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
});
