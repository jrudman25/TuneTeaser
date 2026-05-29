import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useTuneTeaserAuth } from '../hooks/useTuneTeaserAuth';
import { onAuthStateChanged } from 'firebase/auth';

vi.mock('firebase/auth', () => ({
    onAuthStateChanged: vi.fn(),
}));

vi.mock('../backend/FirebaseConfig', () => ({
    auth: {},
}));

describe('useTuneTeaserAuth hook', () => {
    it('initializes with loading state true and null user', () => {
        vi.mocked(onAuthStateChanged).mockReturnValue(vi.fn());

        const { result } = renderHook(() => useTuneTeaserAuth());

        expect(result.current.isLoadingUser).toBe(true);
        expect(result.current.user).toBeNull();
    });

    it('updates state when a user signs in', () => {
        let callback: any;
        vi.mocked(onAuthStateChanged).mockImplementation((auth, cb) => {
            callback = cb;
            return vi.fn();
        });

        const { result } = renderHook(() => useTuneTeaserAuth());

        const mockUser = { uid: 'user123' };
        
        act(() => {
            callback(mockUser);
        });

        expect(result.current.isLoadingUser).toBe(false);
        expect(result.current.user).toEqual(mockUser);
    });

    it('updates state when no user is found', () => {
        let callback: any;
        vi.mocked(onAuthStateChanged).mockImplementation((auth, cb) => {
            callback = cb;
            return vi.fn();
        });

        const { result } = renderHook(() => useTuneTeaserAuth());

        act(() => {
            callback(null);
        });

        expect(result.current.isLoadingUser).toBe(false);
        expect(result.current.user).toBeNull();
    });
});
