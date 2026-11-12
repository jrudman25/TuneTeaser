import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
    assertFails,
    assertSucceeds,
    initializeTestEnvironment,
    type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';

let testEnv: RulesTestEnvironment;

const unauthedDb = () => testEnv.unauthenticatedContext().firestore();
const authedDb = (uid: string) => testEnv.authenticatedContext(uid).firestore();

beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
        projectId: 'demo-tuneteaser',
        firestore: { rules: readFileSync('firestore.rules', 'utf8') },
        storage: { rules: readFileSync('storage.rules', 'utf8') },
    });
});

beforeEach(async () => {
    await testEnv.clearFirestore();
});

afterAll(async () => {
    await testEnv.cleanup();
});

describe('leaderboard', () => {
    it('allows public reads', async () => {
        await assertSucceeds(unauthedDb().doc('leaderboard/user1').get());
        await assertSucceeds(authedDb('user2').doc('leaderboard/user1').get());
    });

    it('denies writes even to the owner', async () => {
        const db = authedDb('user1');
        await assertFails(db.doc('leaderboard/user1').set({ totalPoints: 10 }));
        await assertFails(db.doc('leaderboard/user1').update({ totalPoints: 10 }));
        await assertFails(db.doc('leaderboard/user1').delete());
    });

    it('denies owner access to recentScores and dailyPoints', async () => {
        const db = authedDb('user1');
        await assertFails(db.doc('leaderboard/user1/recentScores/score1').get());
        await assertFails(db.doc('leaderboard/user1/recentScores/score1').set({ points: 1 }));
        await assertFails(db.doc('leaderboard/user1/dailyPoints/2026-01-01').get());
        await assertFails(db.doc('leaderboard/user1/dailyPoints/2026-01-01').set({ points: 1 }));
    });
});

describe('usernames', () => {
    it('denies all reads and writes', async () => {
        await assertFails(authedDb('user1').doc('usernames/playerone').get());
        await assertFails(authedDb('user1').doc('usernames/playerone').set({ uid: 'user1' }));
        await assertFails(unauthedDb().doc('usernames/playerone').get());
        await assertFails(unauthedDb().doc('usernames/playerone').set({ uid: 'user1' }));
    });
});

describe('users', () => {
    it('allows the owner to read and write', async () => {
        const db = authedDb('alice');
        await assertSucceeds(db.doc('users/alice').get());
        await assertSucceeds(db.doc('users/alice').set({ displayName: 'Alice' }));
    });

    it('denies other users and signed-out clients', async () => {
        await assertFails(authedDb('bob').doc('users/alice').get());
        await assertFails(authedDb('bob').doc('users/alice').set({ displayName: 'Bob' }));
        await assertFails(unauthedDb().doc('users/alice').get());
        await assertFails(unauthedDb().doc('users/alice').set({ displayName: 'Anon' }));
    });

    it('allows the owner to manage their playlists', async () => {
        const db = authedDb('alice');
        const playlist = db.doc('users/alice/playlists/pl1');
        await assertSucceeds(playlist.set({ name: 'Mix', tracks: [] }));
        await assertSucceeds(playlist.get());
        await assertSucceeds(playlist.delete());
    });

    it('denies playlist access to other users and signed-out clients', async () => {
        await testEnv.withSecurityRulesDisabled(async (context) => {
            await context.firestore().doc('users/alice/playlists/pl1').set({ name: 'Mix' });
        });

        await assertFails(authedDb('bob').doc('users/alice/playlists/pl1').get());
        await assertFails(authedDb('bob').doc('users/alice/playlists/pl1').set({ name: 'X' }));
        await assertFails(unauthedDb().doc('users/alice/playlists/pl1').get());
        await assertFails(unauthedDb().doc('users/alice/playlists/pl1').set({ name: 'X' }));
    });
});

describe('multiplayerRooms', () => {
    it('allows signed-in gets but not list queries', async () => {
        const db = authedDb('alice');
        await assertSucceeds(db.doc('multiplayerRooms/ROOM1').get());
        await assertFails(db.collection('multiplayerRooms').get());
    });

    it('denies gets to signed-out clients', async () => {
        await assertFails(unauthedDb().doc('multiplayerRooms/ROOM1').get());
    });

    it('denies all writes', async () => {
        const db = authedDb('alice');
        await assertFails(db.doc('multiplayerRooms/ROOM2').set({ status: 'lobby' }));
        await assertFails(db.doc('multiplayerRooms/ROOM2').update({ status: 'playing' }));
        await assertFails(db.doc('multiplayerRooms/ROOM2').delete());
    });

    it('allows signed-in reads of players but denies writes', async () => {
        const db = authedDb('alice');
        await assertSucceeds(db.doc('multiplayerRooms/ROOM1/players/alice').get());
        await assertSucceeds(db.collection('multiplayerRooms/ROOM1/players').get());
        await assertFails(unauthedDb().doc('multiplayerRooms/ROOM1/players/alice').get());
        await assertFails(db.doc('multiplayerRooms/ROOM1/players/alice').set({ score: 0 }));
    });

    it('denies reads of rounds which contain answers', async () => {
        await assertFails(authedDb('alice').doc('multiplayerRooms/ROOM1/rounds/round1').get());
        await assertFails(authedDb('alice').collection('multiplayerRooms/ROOM1/rounds').get());
    });
});

describe('soloRounds', () => {
    it('denies the owner reads and writes', async () => {
        const db = authedDb('alice');
        await assertFails(db.doc('soloRounds/alice').get());
        await assertFails(db.doc('soloRounds/alice').set({ answer: 'x' }));
    });
});

describe('internal collections', () => {
    it('denies callableRateLimits reads and writes', async () => {
        const db = authedDb('alice');
        await assertFails(db.doc('callableRateLimits/limit1').get());
        await assertFails(db.doc('callableRateLimits/limit1').set({ count: 1 }));
    });

    it('denies itunesPreviewCache reads and writes', async () => {
        const db = authedDb('alice');
        await assertFails(db.doc('itunesPreviewCache/track1').get());
        await assertFails(db.doc('itunesPreviewCache/track1').set({ previewUrl: 'x' }));
    });
});
