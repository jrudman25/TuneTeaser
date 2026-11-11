export const MIN_SNIPPET_DURATION_MS = 2000;
export const MAX_SNIPPET_DURATION_MS = 30000;

export const normalizeAnswer = (value: unknown) => {
    if (typeof value !== 'string') return '';
    return value
        .normalize('NFKD')
        .replace(/\p{M}/gu, '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]/gu, '');
};

const songVersionKeywordPattern = /(remaster(?:ed)?|version|edit|mix|live|demo|mono|stereo|anniversary|deluxe|radio)/i;

export const normalizeSongTitleForGuess = (value: unknown) => {
    const title = typeof value === 'string' ? value.trim() : '';
    const withoutBracketedVersion = title.replace(/\s*[[(][^\])]*(remaster(?:ed)?|version|edit|mix|live|demo|mono|stereo|anniversary|deluxe|radio)[^\])]*[\])]\s*$/i, '').trim();
    const bracketCleaned = withoutBracketedVersion || title;
    const withoutDashVersion = bracketCleaned.replace(/\s+-\s+.*(remaster(?:ed)?|version|edit|mix|live|demo|mono|stereo|anniversary|deluxe|radio).*$/i, '').trim();
    const cleaned = songVersionKeywordPattern.test(bracketCleaned) ? withoutDashVersion || bracketCleaned : bracketCleaned;
    return normalizeAnswer(cleaned);
};

export const calculateLeaderboardPoints = (snippetDurationMs: number) => {
    const base = 10;
    const maxBonus = 15;
    const clamped = Math.max(MIN_SNIPPET_DURATION_MS, Math.min(MAX_SNIPPET_DURATION_MS, snippetDurationMs));
    const fraction = 1 - (clamped - MIN_SNIPPET_DURATION_MS) / (MAX_SNIPPET_DURATION_MS - MIN_SNIPPET_DURATION_MS);
    return base + Math.round(maxBonus * fraction);
};

export const isCorrectGuess = (guess: string, title: string, artistName: string) => {
    const checkGuess = normalizeAnswer(guess);
    if (!checkGuess) return false;

    const checkTitle = normalizeSongTitleForGuess(title);
    const targetOption = artistName ? `${title} - ${artistName}` : title;
    const checkTargetOption = normalizeAnswer(targetOption);
    const isExactOptionMatch = checkTargetOption === checkGuess;
    const guessCoversEnoughOfTitle = checkTitle.length > 0 && checkGuess.length / checkTitle.length >= 0.5;
    const isTitleMatch = checkTitle === checkGuess || (
        checkGuess.length > 2
        && guessCoversEnoughOfTitle
        && checkTitle.includes(checkGuess)
    );

    return isExactOptionMatch || isTitleMatch;
};
