import { gendersFor, type WordNotePayload } from '@repo/schemas';

export const WORD_NOTE_V1 = {
  version: 'v1',
  system:
    'You complete a bilingual dictionary note for a spaced-repetition app. ' +
    'Reply with ONLY one valid JSON object with these fields: word, translation, part_of_speech, example, example_translation, pronunciation. ' +
    'Pronunciation must be IPA. Include gender only when the user prompt supplies allowed values. ' +
    'Do not include image, word_audio, notes, language ids, or any other fields.',

  buildUserPrompt(payload: WordNotePayload): string {
    const inputSide =
      payload.direction === 'target'
        ? 'target-language word'
        : 'native-language translation';
    const genders = gendersFor(payload.targetLanguageId);
    const genderInstruction =
      genders.length > 0
        ? `If applicable, gender must be one of: ${genders.join(', ')}.`
        : 'Do not include gender.';

    return (
      `Native language: ${payload.nativeLanguageName}. ` +
      `Target language: ${payload.targetLanguageName}. ` +
      `The authoritative ${inputSide} is ${JSON.stringify(payload.word)}. ` +
      `Complete the note in those languages. ${genderInstruction}`
    );
  },
};
