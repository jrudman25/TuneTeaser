/**
 * FirebaseConfig.ts
 * Connects the app to Firebase for hosting, storage, and user auth.
 * @version 2026.02.23
 */
import { initializeApp } from "firebase/app";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

declare global {
    interface Window {
        __TUNETEASER_FIREBASE_EMULATORS_CONNECTED__?: boolean;
    }
}

if (
    import.meta.env.DEV
    && import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true'
    && typeof window !== 'undefined'
    && !window.__TUNETEASER_FIREBASE_EMULATORS_CONNECTED__
) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    connectFunctionsEmulator(functions, '127.0.0.1', 5001);
    window.__TUNETEASER_FIREBASE_EMULATORS_CONNECTED__ = true;
}
