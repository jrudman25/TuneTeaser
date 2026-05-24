import { useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../backend/FirebaseConfig';

export const useTuneTeaserAuth = () => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoadingUser, setIsLoadingUser] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, currentUser => {
            setUser(currentUser);
            setIsLoadingUser(false);
        });

        return unsubscribe;
    }, []);

    return { user, isLoadingUser };
};
