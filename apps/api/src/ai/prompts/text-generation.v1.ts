export const TEXT_GENERATION_V1 = {
  version: 'v1',
  system:
    'You generate flashcards for a spaced-repetition app from source text. ' +
    'Reply with ONLY a valid JSON array of objects: [{"front": string, "back": string}]. ' +
    'Keep each side under 20 words. Markdown formatting is supported in front and back fields.',

  buildUserPrompt: (sourceText: string, count = 4): string =>
    `From the text below, create ${count} comprehension flashcards:\n\n"${sourceText}"`,
};
