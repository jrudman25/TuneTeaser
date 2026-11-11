import {
    RegExpMatcher,
    TextCensor,
    asteriskCensorStrategy,
    englishDataset,
    englishRecommendedTransformers
} from 'obscenity';

let matcher: RegExpMatcher | null = null;

const getMatcher = () => {
    if (!matcher) {
        matcher = new RegExpMatcher({
            ...englishDataset.build(),
            ...englishRecommendedTransformers
        });
    }
    return matcher;
};

let censor: TextCensor | null = null;

const getCensor = () => {
    if (!censor) {
        censor = new TextCensor().setStrategy(asteriskCensorStrategy());
    }
    return censor;
};

export const containsProfanity = (text: string): boolean => {
    return getMatcher().hasMatch(text);
};

export const censorProfanity = (text: string): string => {
    const matches = getMatcher().getAllMatches(text);
    return matches.length ? getCensor().applyTo(text, matches) : text;
};
