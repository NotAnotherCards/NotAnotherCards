import { z } from 'zod';
import {
  aiWordNoteCandidateSchema,
  gendersFor,
  type AiWordNoteCandidate,
  type WordNotePayload,
} from '@repo/schemas';
import {
  WordNoteFieldsV1,
  WORD_NOTE_FIELDS_VERSION,
  WORD_NOTE_TYPE,
} from '@repo/offline-db';

const generatedText = (max: number) => z.string().trim().min(1).max(max);

export const wordNoteModelOutputSchema = z.object({
  word: generatedText(100).optional(),
  translation: generatedText(1000).optional(),
  part_of_speech: generatedText(100),
  example: generatedText(1000),
  example_translation: generatedText(1000),
  pronunciation: generatedText(200),
  gender: z.string().nullish(),
});

export function assembleWordNoteCandidate(
  payload: WordNotePayload,
  output: unknown,
): AiWordNoteCandidate {
  const generated = wordNoteModelOutputSchema.parse(output);
  // A gender the target language does not have (or a null for a language
  // without genders) is dropped, not fatal: the candidate is still useful.
  const wanted = generated.gender?.trim().toLowerCase();
  const gender = gendersFor(payload.targetLanguageId).find((g) => g === wanted);
  const fields = WordNoteFieldsV1.parse({
    word: payload.direction === 'target' ? payload.word : generated.word,
    translation:
      payload.direction === 'native' ? payload.word : generated.translation,
    native_language_id: payload.nativeLanguageId,
    target_language_id: payload.targetLanguageId,
    part_of_speech: generated.part_of_speech,
    example: generated.example,
    example_translation: generated.example_translation,
    pronunciation: generated.pronunciation,
    ...(gender ? { gender } : {}),
  });

  return aiWordNoteCandidateSchema.parse({
    noteType: WORD_NOTE_TYPE,
    fieldsVersion: WORD_NOTE_FIELDS_VERSION,
    fields,
  });
}
