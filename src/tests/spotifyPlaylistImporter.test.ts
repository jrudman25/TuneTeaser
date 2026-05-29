import { describe, it, expect, vi } from 'vitest';
import { importSpotifyPlaylist, getManualPlaylistTracks } from '../utils/spotifyPlaylistImporter';
import { httpsCallable } from 'firebase/functions';

vi.mock('firebase/functions', () => ({
    httpsCallable: vi.fn(),
}));

vi.mock('../backend/FirebaseConfig', () => ({
    functions: {},
}));

describe('spotifyPlaylistImporter', () => {
    describe('importSpotifyPlaylist', () => {
        it('calls the httpsCallable function with correct arguments', async () => {
            const mockData = { name: 'Test', tracks: [], total: 0, errors: [] };
            const mockCallable = vi.fn().mockResolvedValue({ data: mockData });
            vi.mocked(httpsCallable).mockReturnValue(mockCallable);

            const result = await importSpotifyPlaylist('1234567890123456789012', 0, 50);

            expect(httpsCallable).toHaveBeenCalledWith({}, 'importSpotifyPlaylist');
            expect(mockCallable).toHaveBeenCalledWith({
                playlistId: '1234567890123456789012',
                offset: 0,
                limit: 50
            });
            expect(result).toEqual(mockData);
        });
    });

    describe('getManualPlaylistTracks', () => {
        it('calls the httpsCallable function and returns tracks', async () => {
            const mockTracks = [{ id: 't1', name: 'T1', artists: [], album: { name: '', images: [] } }];
            const mockCallable = vi.fn().mockResolvedValue({ data: { tracks: mockTracks } });
            vi.mocked(httpsCallable).mockReturnValue(mockCallable);

            const result = await getManualPlaylistTracks('my-playlist-id');

            expect(httpsCallable).toHaveBeenCalledWith({}, 'getManualPlaylistTracks');
            expect(mockCallable).toHaveBeenCalledWith({ playlistId: 'my-playlist-id' });
            expect(result).toEqual(mockTracks);
        });
    });
});
