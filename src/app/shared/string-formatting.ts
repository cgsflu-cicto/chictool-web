export const TITLE_CASE_EXCEPTIONS = [
    'a',
    'an',
    'and',
    'as',
    'at',
    'but',
    'by',
    'for',
    'from',
    'in',
    'into',
    'of',
    'off',
    'on',
    'onto',
    'or',
    'over',
    'per',
    'the',
    'to',
    'upon',
    'via',
    'with',
] as const;

const sentenceEndingBeforeWord = /[.!?]["'’”»)\]]*\s*$/u;
const wordPattern = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;

/**
 * Formats text in title case while keeping common short words lowercase,
 * except when one begins a sentence. Punctuation and whitespace are preserved.
 */
export function formatTitleCase(
    value: string,
    exceptions: readonly string[] = TITLE_CASE_EXCEPTIONS,
): string {
    const exceptionSet = new Set(exceptions.map((word) => word.toLowerCase()));
    let result = '';
    let cursor = 0;
    let sentenceStart = true;

    for (const match of value.matchAll(wordPattern)) {
        const word = match[0];
        const start = match.index;
        const separator = value.slice(cursor, start);
        result += separator;

        if (sentenceEndingBeforeWord.test(separator)) sentenceStart = true;

        const normalized = word.toLowerCase();
        if (!sentenceStart && exceptionSet.has(normalized)) {
            result += normalized;
        } else {
            const [firstCharacter, ...remainingCharacters] = Array.from(normalized);
            result += firstCharacter.toUpperCase() + remainingCharacters.join('');
        }

        sentenceStart = false;
        cursor = start + word.length;
    }

    return result + value.slice(cursor);
}
