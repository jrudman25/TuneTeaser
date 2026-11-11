import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';
import { HttpsError, type CallableOptions } from 'firebase-functions/v2/https';

const RATE_LIMIT_WINDOW_MS = 60 * 1000;

export const shouldEnforceAppCheck = () => process.env.FUNCTIONS_EMULATOR !== 'true';

export const PUBLIC_CALLABLE_OPTIONS = {
    timeoutSeconds: 30,
    memory: '256MiB',
    invoker: 'public',
    enforceAppCheck: shouldEnforceAppCheck()
} satisfies CallableOptions;

export const getAuthedUid = (request: any) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'You must be signed in.');
    }
    return request.auth.uid;
};

export const assertUidRateLimit = async (uid: string, action: string, maxRequests: number) => {
    const db = getFirestore();
    const now = Date.now();
    const limitRef = db.collection('callableRateLimits').doc(`${uid}_${action}`);

    await db.runTransaction(async transaction => {
        const limitSnap = await transaction.get(limitRef);
        const limit = limitSnap.exists ? limitSnap.data() : null;
        const windowStartedAtMillis = typeof limit?.windowStartedAtMillis === 'number'
            ? limit.windowStartedAtMillis
            : 0;
        const count = typeof limit?.count === 'number' ? limit.count : 0;
        const isCurrentWindow = now - windowStartedAtMillis < RATE_LIMIT_WINDOW_MS;

        if (isCurrentWindow && count >= maxRequests) {
            throw new HttpsError('resource-exhausted', 'Too many requests. Try again in a minute.');
        }

        if (isCurrentWindow) {
            transaction.update(limitRef, {
                count: FieldValue.increment(1),
                updatedAtMillis: now,
                expiresAt: Timestamp.fromMillis(now + RATE_LIMIT_WINDOW_MS),
                expiresAtMillis: FieldValue.delete()
            });
            return;
        }

        transaction.set(limitRef, {
            uid,
            action,
            count: 1,
            windowStartedAtMillis: now,
            updatedAtMillis: now,
            expiresAt: Timestamp.fromMillis(now + RATE_LIMIT_WINDOW_MS),
            expiresAtMillis: FieldValue.delete()
        }, { merge: true });
    });
};
