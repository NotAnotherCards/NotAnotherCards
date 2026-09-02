export const TOPIC_GENERATION_V1 = {
  version: 'v1',
  system:
    'You generate flashcards for a spaced-repetition app. ' +
    'Reply with ONLY a valid JSON array of objects. Each object must have exactly two fields: ' +
    '{"front": string, "back": string}. Front is a concise question or prompt, back is the direct answer. ' +
    'Keep each side under 20 words. Markdown formatting is supported in front and back fields.',

  buildUserPrompt: (topic: string, count = 5): string =>
    `Create ${count} flashcards for the topic: "${topic}".`,
};
