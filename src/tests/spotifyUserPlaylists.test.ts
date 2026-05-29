import { describe, it, expect, vi } from 'vitest';
import { fetchSpotifyUserPlaylists } from '../utils/spotifyUserPlaylists';
import { httpsCallable } from 'firebase/functions';

vi.mock('firebase/functions', () => ({
    httpsCallable: vi.fn(),
}));

vi.mock('../backend/FirebaseConfig', () => ({
    functions: {},
}));

describe('spotifyUserPlaylists', () => {
    describe('fetchSpotifyUserPlaylists', () => {
        it('calls the httpsCallable function and returns playlists', async () => {
            const mockData = { playlists: [{ id: 'p1', name: 'My Playlist', image: '', totalTracks: 10 }] };
            const mockCallable = vi.fn().mockResolvedValue({ data: mockData });
            vi.mocked(httpsCallable).mockReturnValue(mockCallable);

            const result = await fetchSpotifyUserPlaylists('https://open.spotify.com/user/12345');

            expect(httpsCallable).toHaveBeenCalledWith({}, 'getUserPlaylists');
            expect(mockCallable).toHaveBeenCalledWith({ profileUrl: 'https://open.spotify.com/user/12345' });
            expect(result).toEqual(mockData);
        });
    });
});
