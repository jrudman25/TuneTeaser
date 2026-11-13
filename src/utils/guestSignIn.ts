import { signInAnonymously, signOut, type User } from 'firebase/auth';
import { auth } from '../backend/FirebaseConfig';

let pendingAnonymousSignIn: Promise<User> | null = null;

// Deduplicated anonymous sign-in: concurrent callers share one in-flight
// request instead of racing to create two anonymous accounts.
export const signInAsGuest = (): Promise<User> => {
    if (auth.currentUser) return Promise.resolve(auth.currentUser);
    pendingAnonymousSignIn ??= signInAnonymously(auth)
        .then(credential => credential.user)
        .finally(() => {
            pendingAnonymousSignIn = null;
        });
    return pendingAnonymousSignIn;
};

// Waits for the initial auth state to resolve, then guarantees a signed-in
// user by falling back to anonymous (guest) sign-in.
export const ensureSignedIn = async (): Promise<User> => {
    await auth.authStateReady();
    return signInAsGuest();
};

// Drops the current session and signs in anonymously. Used to recover from
// persisted credentials the backend rejects, e.g. a production session
// while running against the emulators.
export const resetToGuest = async (): Promise<User> => {
    await signOut(auth).catch(() => {});
    return signInAsGuest();
};

// Waits for a signed-in user (anonymous for guests), then runs the callable.
// On 'unauthenticated', re-authenticates once and retries: a persisted session
// can hold a token the backend rejects, e.g. a production session while
// running against the emulators, or a call that raced the guest sign-in.
export const callWithAuthRetry = async <T>(call: () => Promise<T>): Promise<T> => {
    await ensureSignedIn();
    try {
        return await call();
    } catch (error) {
        if ((error as { code?: string })?.code !== 'functions/unauthenticated') throw error;
        const user = auth.currentUser;
        if (user) {
            try {
                await user.getIdToken(true);
            } catch {
                await resetToGuest();
            }
        } else {
            await signInAsGuest();
        }
        return call();
    }
};
