import { gendersFor, type WordNotePayload } from '@repo/schemas';

export const WORD_NOTE_V1 = {
  version: 'v1',
  system:
    'You complete a bilingual dictionary note for a spaced-repetition app. ' +
    'Reply with ONLY one valid JSON object with these fields: word, translation, part_of_speech, example, example_translation, pronunciation. ' +
    'Pronunciation must be IPA. Include gender only when the user prompt supplies allowed values. ' +
    'Do not include image, word_audio, notes, language ids, or any other fields.',

  // Each JSON field is tied to a language by name. "Complete the note in
  // those languages" was not enough: given an English word, the model put
  // it in both fields, since nothing said which key holds the Spanish.
  buildUserPrompt(payload: WordNotePayload): string {
    const { nativeLanguageName: native, targetLanguageName: target } = payload;
    const given = JSON.stringify(payload.word);
    const fields =
      payload.direction === 'target'
        ? `"word" is the ${target} word ${given}, given. ` +
          `Put its ${native} translation in "translation". `
        : `"translation" is the ${native} word ${given}, given. ` +
          `Put its ${target} translation in "word". `;
    const genders = gendersFor(payload.targetLanguageId);
    const genderInstruction =
      genders.length > 0
        ? `If applicable, gender must be one of: ${genders.join(', ')}.`
        : 'Do not include gender.';

    return (
      `Native language: ${native}. Target language: ${target}. ` +
      fields +
      `"part_of_speech" and "pronunciation" describe "word". ` +
      `"example" is a ${target} sentence using "word"; ` +
      `"example_translation" is that sentence in ${native}. ` +
      genderInstruction
    );
  },
};
