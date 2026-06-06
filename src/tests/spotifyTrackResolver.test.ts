import { describe, expect, it, vi } from 'vitest';
import { httpsCallable } from 'firebase/functions';
import { resolveSpotifyTracks } from '../utils/spotifyTrackResolver';

vi.mock('firebase/functions', () => ({
    httpsCallable: vi.fn()
}));

vi.mock('../backend/FirebaseConfig', () => ({
    functions: {}
}));

describe('resolveSpotifyTracks', () => {
    it('calls the resolveSpotifyTracks callable and returns its data', async () => {
        const response = {
            tracks: [{ id: 'track-1', name: 'Song', artists: [{ name: 'Artist' }], album: { name: '', images: [] } }],
            errors: ['one skipped']
        };
        const callable = vi.fn().mockResolvedValue({ data: response });
        vi.mocked(httpsCallable).mockReturnValue(callable);

        const result = await resolveSpotifyTracks(['abc123']);

        expect(httpsCallable).toHaveBeenCalledWith({}, 'resolveSpotifyTracks');
        expect(callable).toHaveBeenCalledWith({ trackIds: ['abc123'] });
        expect(result).toEqual(response);
    });
});
