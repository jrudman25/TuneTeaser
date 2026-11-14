/**
 * useGuestAutoSignIn.ts
 * Signs the page in anonymously when it mounts without a session. Fires only
 * when the page never observed a signed-in user: a user -> null transition is
 * a sign-out (in this tab or another one, since Firebase Auth syncs sign state
 * across tabs via localStorage), and re-authing there would resurrect the
 * guest session the user just ended and bounce a signed-out tab's Login page
 * straight back into guest mode. signOutExplicitly's guestSignOutAt marker
 * only covers the first ~minute after a sign-out; this mount check is what
 * blocks resurrection from a sign-out delivered later than that.
 * @version 2026.11.13
 */
import { useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { GuestSignInSuppressedError, signInAsGuest } from '../utils/guestSignIn';
import { logger } from '../utils/logger';

export const useGuestAutoSignIn = (
    enabled: boolean,
    user: User | null,
    isLoadingUser: boolean,
    onError?: (error: unknown) => void
) => {
    const hadUserRef = useRef(false);
    const onErrorRef = useRef(onError);

    useEffect(() => {
        onErrorRef.current = onError;
    }, [onError]);

    useEffect(() => {
        if (user) hadUserRef.current = true;
    }, [user]);

    useEffect(() => {
        if (!enabled || isLoadingUser || user || hadUserRef.current) return;
        Promise.resolve(signInAsGuest()).catch(err => {
            // A sign-out (here or in another tab) is still suppressing
            // automatic guest sign-in; that is intended, not a failure.
            if (err instanceof GuestSignInSuppressedError) return;
            if (onErrorRef.current) {
                onErrorRef.current(err);
            } else {
                logger.error('Failed to sign in guest anonymously:', err);
            }
        });
    }, [enabled, isLoadingUser, user]);
};
