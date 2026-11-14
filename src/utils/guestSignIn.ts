import { signInAnonymously, signOut, type User } from 'firebase/auth';
import { auth } from '../backend/FirebaseConfig';

let pendingAnonymousSignIn: Promise<User> | null = null;
let guestAutoSignInSuppressed = false;
let explicitSignOutInProgress = false;
let signOutEpoch = 0;

// Explicit sign-outs are also recorded in localStorage so automatic guest
// sign-in stays suppressed in every tab, not just the one that ran
// signOutExplicitly. Firebase Auth syncs sessions across tabs through
// localStorage, so a session recreated by an unsuppressed tab would propagate
// back to the signed-out tab and bounce its Login page into guest mode.
const GUEST_SIGN_OUT_AT_KEY = 'tuneteaser:guestSignOutAt';
// Long enough to outlive cross-tab storage-event propagation, in-flight
// anonymous sign-ins, and a throttled background tab's delayed callbacks
// (Chrome can hold hidden-tab timers for ~a minute). Bounded so deliberate
// re-entry to a guest route (for example browser Back) is only briefly
// suppressed; Play as Guest clears the marker immediately regardless.
const GUEST_SIGN_OUT_SUPPRESSION_MS = 60 * 1000;

const readGuestSignOutAt = (): number => {
    try {
        return Number(localStorage.getItem(GUEST_SIGN_OUT_AT_KEY)) || 0;
    } catch {
        return 0;
    }
};

const guestSignOutSuppressed = (): boolean =>
    Date.now() - readGuestSignOutAt() < GUEST_SIGN_OUT_SUPPRESSION_MS;

// Rejection for signInAsGuest calls suppressed by an explicit sign-out. It is
// expected rather than a failure, so auto sign-in callers can swallow it
// instead of surfacing an authentication error.
export class GuestSignInSuppressedError extends Error {
    constructor(message = 'Guest sign-in is temporarily unavailable after signing out. Try again in a moment.') {
        super(message);
        this.name = 'GuestSignInSuppressedError';
    }
}

// Deliberate sign-ins (the Play as Guest button, which bypasses
// signInAsGuest) end the cross-tab suppression.
export const clearGuestSignOutMarker = (): void => {
    try {
        localStorage.removeItem(GUEST_SIGN_OUT_AT_KEY);
    } catch {
        // localStorage can be unavailable; suppression is best-effort.
    }
};

// Deduplicated anonymous sign-in: concurrent callers share one in-flight
// request instead of racing to create two anonymous accounts. Rejects with
// GuestSignInSuppressedError while an explicit sign-out is still suppressing
// automatic guest sign-in; callers needing a session regardless should use
// signInAnonymously directly after clearGuestSignOutMarker().
export const signInAsGuest = (): Promise<User> => {
    if (auth.currentUser) {
        // A real session exists again, so an earlier explicit sign-out no
        // longer needs to keep automatic guest sign-in off. While an explicit
        // sign-out is still in progress the visible user is the outgoing one,
        // not a new session, so suppression must stay on.
        if (!explicitSignOutInProgress) {
            guestAutoSignInSuppressed = false;
            // Only a session that began after the recorded sign-out counts as
            // a new sign-in; another tab can still hold the stale pre-sign-out
            // user object, and letting it clear the marker would disarm the
            // cross-tab suppression.
            const signedInAt = Date.parse(auth.currentUser.metadata?.lastSignInTime ?? '') || 0;
            if (readGuestSignOutAt() < signedInAt) clearGuestSignOutMarker();
        }
        return Promise.resolve(auth.currentUser);
    }
    if (guestAutoSignInSuppressed || guestSignOutSuppressed()) {
        return Promise.reject(new GuestSignInSuppressedError());
    }
    pendingAnonymousSignIn ??= (async () => {
        const startedAt = Date.now();
        const credential = await signInAnonymously(auth);
        // A sign-out in another tab may have landed while this sign-in was in
        // flight; do not let the late session resurrect the guest the user
        // just signed out of.
        if (readGuestSignOutAt() >= startedAt) {
            await signOut(auth).catch(() => {});
            throw new GuestSignInSuppressedError('Anonymous sign-in superseded by an explicit sign-out.');
        }
        return credential.user;
    })().finally(() => {
        pendingAnonymousSignIn = null;
    });
    return pendingAnonymousSignIn;
};

// Called once Login has mounted: the page that was signed out of is gone, so its
// auto-guest effects can no longer race the sign-out. A later guest page mount
// (for example browser Back to ?mode=guest) is a deliberate navigation and may
// start a fresh guest session. This clears only this tab's in-memory flag; the
// persisted guestSignOutAt marker keeps unsuppressed tabs and remounts from
// resurrecting the session, and expires on its own.
export const endGuestSignInSuppression = () => {
    if (!explicitSignOutInProgress) guestAutoSignInSuppressed = false;
};

// User-initiated sign-out (Sign Out / Exit Guest Mode). Suppresses automatic
// anonymous sign-in until a real session exists or Login calls
// endGuestSignInSuppression(): the auto-guest effects on the page being left,
// and in-flight callables retried through callWithAuthRetry, would otherwise
// recreate an anonymous session in the gap between signOut resolving and the
// router leaving the guest page, bouncing the user straight back into guest
// mode after they land on Login. The persisted marker extends that protection
// to other tabs, whose in-memory flags know nothing of this sign-out.
export const signOutExplicitly = async (): Promise<void> => {
    signOutEpoch++;
    guestAutoSignInSuppressed = true;
    explicitSignOutInProgress = true;
    try {
        localStorage.setItem(GUEST_SIGN_OUT_AT_KEY, String(Date.now()));
    } catch {
        // localStorage can be unavailable; in-memory suppression still applies.
    }
    try {
        await signOut(auth);
        // An anonymous sign-in already in flight survives sign-out and can
        // land during or after it, so wait for it to settle and then sign out
        // whatever session it created.
        await pendingAnonymousSignIn?.catch(() => {});
        if (auth.currentUser) await signOut(auth);
    } catch (error) {
        guestAutoSignInSuppressed = false;
        clearGuestSignOutMarker();
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
    const epoch = signOutEpoch;
    await ensureSignedIn();
    try {
        return await call();
    } catch (error) {
        if ((error as { code?: string })?.code !== 'functions/unauthenticated') throw error;
        if (signOutEpoch !== epoch) throw error;
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
