import { signInAnonymously, signOut, type User } from 'firebase/auth';
import { auth } from '../backend/FirebaseConfig';

let pendingAnonymousSignIn: Promise<User> | null = null;
let guestAutoSignInSuppressed = false;
let explicitSignOutInProgress = false;

// Deduplicated anonymous sign-in: concurrent callers share one in-flight
// request instead of racing to create two anonymous accounts.
export const signInAsGuest = (): Promise<User> => {
    if (auth.currentUser) {
        // A real session exists again, so an earlier explicit sign-out no
        // longer needs to keep automatic guest sign-in off. While an explicit
        // sign-out is still in progress the visible user is the outgoing one,
        // not a new session, so suppression must stay on.
        if (!explicitSignOutInProgress) guestAutoSignInSuppressed = false;
        return Promise.resolve(auth.currentUser);
    }
    if (guestAutoSignInSuppressed) {
        return Promise.reject(new Error('Guest sign-in is disabled until the next sign-in.'));
    }
    pendingAnonymousSignIn ??= signInAnonymously(auth)
        .then(credential => credential.user)
        .finally(() => {
            pendingAnonymousSignIn = null;
        });
    return pendingAnonymousSignIn;
};

// User-initiated sign-out (Sign Out / Exit Guest Mode). Suppresses automatic
// anonymous sign-in until a real session exists: the auto-guest effects on the
// page being left, and in-flight callables retried through callWithAuthRetry,
// would otherwise recreate an anonymous session in the gap between signOut
// resolving and the router leaving the guest page, bouncing the user straight
// back into guest mode after they land on Login.
export const signOutExplicitly = async (): Promise<void> => {
    guestAutoSignInSuppressed = true;
    explicitSignOutInProgress = true;
    try {
        await signOut(auth);
        // An anonymous sign-in already in flight survives sign-out and can
        // land during or after it, so wait for it to settle and then sign out
        // whatever session it created.
        await pendingAnonymousSignIn?.catch(() => {});
        if (auth.currentUser) await signOut(auth);
    } catch (error) {
        guestAutoSignInSuppressed = false;
        throw error;
    } finally {
        explicitSignOutInProgress = false;
    }
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
