import { createHash, randomBytes } from 'crypto';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { assertUidRateLimit, getAuthedUid, PUBLIC_CALLABLE_OPTIONS } from './callableUtils';
import { calculateLeaderboardPoints, isCorrectGuess, MIN_SNIPPET_DURATION_MS, MAX_SNIPPET_DURATION_MS } from './answerMatching';
import { shuffle } from './shuffle';
import { pickTrackWithPreview } from './itunesPreview';
import { getTrackArtworkUrl, getTrackName, getTrackArtistName, getTrackAlbumName, getPlayableTracks, loadPlaylistTracks } from './playlistTracks';

const SOLO_LOOKUP_ATTEMPTS = 12;
const SOLO_ROUND_TTL_MS = 30 * 60 * 1000;
const MIN_TRACKS_FOR_LEADERBOARD_POINTS = 10;
const DAILY_SOLO_POINTS_CAP = 1500;
const LEADERBOARD_SCORE_COOLDOWN_MS = 10 * 60 * 1000;
const DAILY_POINTS_DOC_TTL_MS = 2 * 24 * 60 * 60 * 1000;
const SOLO_START_RATE_LIMIT = 30;
const SOLO_GUESS_RATE_LIMIT = 90;
const SOLO_GIVE_UP_RATE_LIMIT = 30;

export type SoloRoundAnswer = {
    id: string;
    name: string;
    artists: { name: string }[];
    album: { name: string; images: { url: string }[] };
};

const getScoreCooldownId = (playlistId: string, songId: string) => {
    return createHash('sha256').update(`${playlistId}:${songId}`).digest('hex');
};

const getDailyPointsKey = (now: number) => new Date(now).toISOString().slice(0, 10);

const buildSoloRoundAnswer = (round: any): SoloRoundAnswer => ({
    id: round.trackId,
    name: round.title,
    artists: [{ name: round.artistName }],
    album: {
        name: round.albumName || '',
        images: round.artworkUrl ? [{ url: round.artworkUrl }] : []
    }
});

const getSoloPlaylistId = (value: unknown) => {
    const playlistId = typeof value === 'string' ? value.trim().slice(0, 128) : '';
    if (!playlistId) {
        throw new HttpsError('invalid-argument', 'Playlist ID is required.');
    }
    return playlistId;
};

const getSoloRoundId = (value: unknown) => {
    const roundId = typeof value === 'string' ? value.trim() : '';
    if (!roundId) {
        throw new HttpsError('invalid-argument', 'Round ID is required.');
    }
    return roundId;
};

const makeSoloRoundId = () => randomBytes(8).toString('hex');

const INACTIVE_ROUND_ERROR = 'This round is no longer active.';

export const startSoloRound = onCall(PUBLIC_CALLABLE_OPTIONS, async (request) => {
    const requestedAtMillis = Date.now();
    const uid = getAuthedUid(request);
    const signInProvider = request.auth?.token?.firebase?.sign_in_provider;
    const playlistId = getSoloPlaylistId(request.data?.playlistId);

    await assertUidRateLimit(uid, 'startSoloRound', SOLO_START_RATE_LIMIT);

    const { tracks, source } = await loadPlaylistTracks(uid, playlistId);
    const playableTracks = getPlayableTracks(tracks);

    if (playableTracks.length === 0) {
        throw new HttpsError('failed-precondition', 'No playable tracks found in this playlist.');
    }

    const db = getFirestore();
    const stateRef = db.collection('soloRounds').doc(uid);
    const stateSnap = await stateRef.get();
    const previous = stateSnap.exists ? stateSnap.data() : null;
    const recentTrackIds = previous?.recentPlaylistId === playlistId && Array.isArray(previous?.recentTrackIds)
        ? previous.recentTrackIds.filter((id: any) => typeof id === 'string')
        : [];

    let candidates = playableTracks.filter(track => !recentTrackIds.includes(track.id));
    let nextRecentTrackIds = recentTrackIds;
    if (candidates.length === 0) {
        nextRecentTrackIds = [];
        candidates = playableTracks;
    }

    const pick = await pickTrackWithPreview(shuffle(candidates), SOLO_LOOKUP_ATTEMPTS);
    if (!pick) {
        throw new HttpsError('failed-precondition', 'Could not find a playable preview for this playlist. Try again or pick another playlist.');
    }

    const eligibleForPoints = signInProvider !== 'anonymous'
        && source !== 'storage-only'
        && playableTracks.length >= MIN_TRACKS_FOR_LEADERBOARD_POINTS;

    const recentLimit = Math.min(500, Math.max(0, playableTracks.length - 1));
    nextRecentTrackIds = [...nextRecentTrackIds, pick.track.id].slice(-recentLimit);

    const now = Date.now();
    const roundId = makeSoloRoundId();
    const artworkUrl = pick.artworkUrl || getTrackArtworkUrl(pick.track) || '';

    // A slower, earlier-issued start (for example an abandoned prefetch) must
    // not clobber a round created by a newer request: writes are ordered by
    // request time, not commit time.
    const superseded = await db.runTransaction(async transaction => {
        const liveSnap = await transaction.get(stateRef);
        const live = liveSnap.exists ? liveSnap.data() : null;
        const liveRequestedAt = typeof live?.requestedAtMillis === 'number'
            ? live.requestedAtMillis
            : (typeof live?.startedAtMillis === 'number' ? live.startedAtMillis : 0);

        if (live && liveRequestedAt > requestedAtMillis) {
            return live;
        }

        transaction.set(stateRef, {
            roundId,
            playlistId,
            trackId: pick.track.id,
            title: getTrackName(pick.track),
            artistName: getTrackArtistName(pick.track),
            albumName: getTrackAlbumName(pick.track),
            artworkUrl,
            previewUrl: pick.previewUrl,
            snippetDurationMs: MIN_SNIPPET_DURATION_MS,
            state: 'playing',
            eligibleForPoints,
            playableTrackCount: playableTracks.length,
            requestedAtMillis,
            startedAtMillis: now,
            expiresAtMillis: now + SOLO_ROUND_TTL_MS,
            recentPlaylistId: playlistId,
            recentTrackIds: nextRecentTrackIds,
            updatedAtMillis: now
        });
        return null;
    });

    if (superseded) {
        if (superseded.state === 'playing' && typeof superseded.previewUrl === 'string') {
            return {
                roundId: superseded.roundId,
                previewUrl: superseded.previewUrl,
                snippetDurationMs: typeof superseded.snippetDurationMs === 'number'
                    ? superseded.snippetDurationMs
                    : MIN_SNIPPET_DURATION_MS,
                eligibleForPoints: superseded.eligibleForPoints === true,
                playableTrackCount: typeof superseded.playableTrackCount === 'number'
                    ? superseded.playableTrackCount
                    : playableTracks.length
            };
        }
        throw new HttpsError('failed-precondition', 'A newer round has already started.');
    }

    return {
        roundId,
        previewUrl: pick.previewUrl,
        snippetDurationMs: MIN_SNIPPET_DURATION_MS,
        eligibleForPoints,
        playableTrackCount: playableTracks.length
    };
});

export const submitSoloGuess = onCall(PUBLIC_CALLABLE_OPTIONS, async (request) => {
    const uid = getAuthedUid(request);
    const roundId = getSoloRoundId(request.data?.roundId);
    const guess = typeof request.data?.guess === 'string' ? request.data.guess.trim().slice(0, 200) : '';

    await assertUidRateLimit(uid, 'submitSoloGuess', SOLO_GUESS_RATE_LIMIT);

    const userRecord = await getAuth().getUser(uid);
    const displayName = userRecord.displayName
        || userRecord.email?.split('@')[0]
        || 'Anonymous';

    const db = getFirestore();
    const stateRef = db.collection('soloRounds').doc(uid);
    const now = Date.now();

    let response: {
        result: 'correct' | 'incorrect' | 'out-of-snippet';
        snippetDurationMs: number;
        pointsAwarded: number | null;
        pointsNote?: 'cooldown' | 'daily-cap' | 'ineligible';
        answer?: SoloRoundAnswer;
    } = { result: 'incorrect', snippetDurationMs: MIN_SNIPPET_DURATION_MS, pointsAwarded: null };

    await db.runTransaction(async transaction => {
        const stateSnap = await transaction.get(stateRef);
        const round = stateSnap.exists ? stateSnap.data() : null;

        if (!round
            || round.roundId !== roundId
            || round.state !== 'playing'
            || typeof round.expiresAtMillis !== 'number'
            || now > round.expiresAtMillis) {
            throw new HttpsError('failed-precondition', INACTIVE_ROUND_ERROR);
        }

        const snippetDurationMs = typeof round.snippetDurationMs === 'number'
            ? round.snippetDurationMs
            : MIN_SNIPPET_DURATION_MS;

        if (isCorrectGuess(guess, round.title || '', round.artistName || '')) {
            const points = calculateLeaderboardPoints(snippetDurationMs);
            let pointsAwarded: number | null = null;
            let pointsNote: 'cooldown' | 'daily-cap' | 'ineligible' | undefined;

            if (round.eligibleForPoints) {
                const leaderboardRef = db.collection('leaderboard').doc(uid);
                const cooldownRef = leaderboardRef.collection('recentScores').doc(getScoreCooldownId(round.playlistId, round.trackId));
                const dateKey = getDailyPointsKey(now);
                const dailyRef = leaderboardRef.collection('dailyPoints').doc(dateKey);

                const cooldownSnap = await transaction.get(cooldownRef);
                const dailySnap = await transaction.get(dailyRef);
                const lastScoredAt = cooldownSnap.exists ? cooldownSnap.data()?.scoredAtMillis : null;
                const dailyPoints = dailySnap.exists && typeof dailySnap.data()?.points === 'number'
                    ? dailySnap.data()?.points
                    : 0;

                if (typeof lastScoredAt === 'number' && now - lastScoredAt < LEADERBOARD_SCORE_COOLDOWN_MS) {
                    pointsNote = 'cooldown';
                } else if (dailyPoints + points > DAILY_SOLO_POINTS_CAP) {
                    pointsNote = 'daily-cap';
                } else {
                    transaction.set(leaderboardRef, {
                        displayName,
                        totalPoints: FieldValue.increment(points),
                        gamesWon: FieldValue.increment(1),
                        lastUpdated: FieldValue.serverTimestamp()
                    }, { merge: true });
                    transaction.set(cooldownRef, {
                        playlistId: round.playlistId,
                        songId: round.trackId,
                        scoredAtMillis: now,
                        expiresAt: Timestamp.fromMillis(now + LEADERBOARD_SCORE_COOLDOWN_MS),
                        expiresAtMillis: FieldValue.delete()
                    }, { merge: true });
                    transaction.set(dailyRef, {
                        points: FieldValue.increment(points),
                        dateKey,
                        expiresAt: Timestamp.fromMillis(now + DAILY_POINTS_DOC_TTL_MS)
                    }, { merge: true });
                    pointsAwarded = points;
                }
            } else {
                pointsNote = 'ineligible';
            }

            transaction.update(stateRef, { state: 'correct', updatedAtMillis: now });
            response = {
                result: 'correct',
                snippetDurationMs,
                pointsAwarded,
                ...(pointsNote ? { pointsNote } : {}),
                answer: buildSoloRoundAnswer(round)
            };
            return;
        }

        if (snippetDurationMs >= MAX_SNIPPET_DURATION_MS) {
            transaction.update(stateRef, { state: 'out-of-snippet', updatedAtMillis: now });
            response = {
                result: 'out-of-snippet',
                snippetDurationMs,
                pointsAwarded: null,
                answer: buildSoloRoundAnswer(round)
            };
            return;
        }

        const nextSnippetDurationMs = Math.min(snippetDurationMs + 2000, MAX_SNIPPET_DURATION_MS);
        transaction.update(stateRef, {
            snippetDurationMs: nextSnippetDurationMs,
            updatedAtMillis: now
        });
        response = { result: 'incorrect', snippetDurationMs: nextSnippetDurationMs, pointsAwarded: null };
    });

    return response;
});

export const giveUpSoloRound = onCall(PUBLIC_CALLABLE_OPTIONS, async (request) => {
    const uid = getAuthedUid(request);
    const roundId = getSoloRoundId(request.data?.roundId);

    await assertUidRateLimit(uid, 'giveUpSoloRound', SOLO_GIVE_UP_RATE_LIMIT);

    const db = getFirestore();
    const stateRef = db.collection('soloRounds').doc(uid);
    const stateSnap = await stateRef.get();
    const round = stateSnap.exists ? stateSnap.data() : null;
    const now = Date.now();

    if (!round || round.roundId !== roundId) {
        throw new HttpsError('failed-precondition', INACTIVE_ROUND_ERROR);
    }

    if (round.state === 'playing' && typeof round.expiresAtMillis === 'number' && now <= round.expiresAtMillis) {
        await stateRef.update({ state: 'gave-up', updatedAtMillis: now });
    }

    return { answer: buildSoloRoundAnswer(round) };
});
