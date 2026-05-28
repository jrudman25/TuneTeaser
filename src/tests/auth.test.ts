import { describe, it, expect, vi } from 'vitest';
import { redirectToAuthCodeFlow, getAccessToken, refreshAccessToken } from '../utils/auth';

// Mock crypto
const mockGetRandomValues = vi.fn((arr: Uint8Array) => {
    for (let i = 0; i < arr.length; i++) {
        arr[i] = i % 256;
    }
    return arr;
});

global.window = {
    crypto: {
        getRandomValues: mockGetRandomValues,
        subtle: {
            digest: vi.fn().mockResolvedValue(new ArrayBuffer(32))
        }
    },
    location: {
        assign: vi.fn()
    }
} as any;

describe('Auth Utilities', () => {
    it('redirectToAuthCodeFlow generates verifier and redirects', async () => {
        // Mock window.location.assign
        const originalAssign = window.location.assign;
        const assignMock = vi.fn();
        window.location.assign = assignMock;

        const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

        await redirectToAuthCodeFlow('test-client-id', 'http://localhost:3000/callback');

        expect(setItemSpy).toHaveBeenCalledWith('verifier', expect.any(String));
        expect(assignMock).toHaveBeenCalledWith(expect.stringContaining('https://accounts.spotify.com/authorize'));
        expect(assignMock).toHaveBeenCalledWith(expect.stringContaining('client_id=test-client-id'));
        expect(assignMock).toHaveBeenCalledWith(expect.stringContaining('response_type=code'));

        setItemSpy.mockRestore();
        window.location.assign = originalAssign;
    });

    it('getAccessToken exchanges code for tokens', async () => {
        const mockResponse = { access_token: 'access-123', refresh_token: 'refresh-456', expires_in: 3600 };
        global.fetch = vi.fn().mockResolvedValue({
            json: () => Promise.resolve(mockResponse)
        });

        const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('mock-verifier');

        const data = await getAccessToken('test-client-id', 'auth-code', 'http://localhost:3000/callback');

        expect(getItemSpy).toHaveBeenCalledWith('verifier');
        expect(global.fetch).toHaveBeenCalledWith('https://accounts.spotify.com/api/token', expect.objectContaining({
            method: 'POST',
            body: expect.any(URLSearchParams)
        }));
        expect(data).toEqual(mockResponse);

        getItemSpy.mockRestore();
    });

    it('refreshAccessToken exchanges refresh token for new access token', async () => {
        const mockResponse = { access_token: 'new-access-123', expires_in: 3600 };
        global.fetch = vi.fn().mockResolvedValue({
            json: () => Promise.resolve(mockResponse)
        });

        const data = await refreshAccessToken('test-client-id', 'refresh-456');

        expect(global.fetch).toHaveBeenCalledWith('https://accounts.spotify.com/api/token', expect.objectContaining({
            method: 'POST',
            body: expect.any(URLSearchParams)
        }));

        // Assert body contains correct params
        const fetchCall = vi.mocked(global.fetch).mock.calls[0];
        const params = fetchCall[1]?.body as URLSearchParams;
        expect(params.get('grant_type')).toBe('refresh_token');
        expect(params.get('refresh_token')).toBe('refresh-456');

        expect(data).toEqual(mockResponse);
    });
});
