import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
    assertFails,
    assertSucceeds,
    initializeTestEnvironment,
    type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';

let testEnv: RulesTestEnvironment;

const unauthedStorage = () => testEnv.unauthenticatedContext().storage();
const authedStorage = (uid: string) => testEnv.authenticatedContext(uid).storage();
const playlistPath = 'users/alice/playlists/abc_1-X.json';
const smallJsonBody = new Uint8Array([123, 34, 116, 114, 97, 99, 107, 115, 34, 58, 91, 93, 125]);

const seedPlaylist = () => testEnv.withSecurityRulesDisabled(async (context) => {
    await context.storage().ref(playlistPath).put(smallJsonBody, { contentType: 'application/json' });
});

beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
        projectId: 'demo-tuneteaser',
        firestore: { rules: readFileSync('firestore.rules', 'utf8') },
        storage: { rules: readFileSync('storage.rules', 'utf8') },
    });
});

beforeEach(async () => {
    await testEnv.clearStorage();
});

afterAll(async () => {
    await testEnv.cleanup();
});

describe('playlist JSON files', () => {
    it('allows the owner to create, read, and delete', async () => {
        const file = authedStorage('alice').ref(playlistPath);
        await assertSucceeds(file.put(smallJsonBody, { contentType: 'application/json' }));
        await assertSucceeds(file.getMetadata());
        await assertSucceeds(file.delete());
    });

    it('denies other users', async () => {
        await seedPlaylist();
        const file = authedStorage('bob').ref(playlistPath);
        await assertFails(file.getMetadata());
        await assertFails(file.put(smallJsonBody, { contentType: 'application/json' }));
        await assertFails(file.delete());
    });

    it('denies signed-out clients', async () => {
        await seedPlaylist();
        const file = unauthedStorage().ref(playlistPath);
        await assertFails(file.getMetadata());
        await assertFails(file.put(smallJsonBody, { contentType: 'application/json' }));
        await assertFails(file.delete());
    });

    it('denies non-JSON content types', async () => {
        const file = authedStorage('alice').ref(playlistPath);
        await assertFails(file.put(smallJsonBody, { contentType: 'text/plain' }));
    });

    it('denies bad file names', async () => {
        const storage = authedStorage('alice');
        await assertFails(storage.ref('users/alice/playlists/abc.txt').put(smallJsonBody, { contentType: 'application/json' }));
        await assertFails(storage.ref('users/alice/playlists/a b.json').put(smallJsonBody, { contentType: 'application/json' }));
    });

    it('denies files over 5MB', async () => {
        const file = authedStorage('alice').ref(playlistPath);
        const bigBody = new Uint8Array(5 * 1024 * 1024 + 1);
        await assertFails(file.put(bigBody, { contentType: 'application/json' }));
    });

    it('denies writes outside the playlists folder', async () => {
        const storage = authedStorage('alice');
        await assertFails(storage.ref('public/x.json').put(smallJsonBody, { contentType: 'application/json' }));
        await assertFails(storage.ref('users/alice/other.json').put(smallJsonBody, { contentType: 'application/json' }));
    });
});
