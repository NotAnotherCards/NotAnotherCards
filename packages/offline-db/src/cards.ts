import { z } from "zod";
import { ModelFor, type InferRecord } from "@remelondb/core";
import { zodTable } from "@remelondb/core/zod";

export const CardRow = z.object({
  type: z.string(), // word | comparison | phrase
  language_id: z.string(),
  status: z.string().default("active"),
  source: z.string().default("manual"),
  created_by_user_id: z.string().nullable(),
  created_at: z.number(),
  updated_at: z.number(),
  deleted_at: z.number().nullable(),
  version: z.number().int().default(1),
});

export const WordCardRow = z.object({
  card_id: z.string(),
  lemma: z.string().min(1),
  translation: z.string(),
  part_of_speech: z.string().nullable(),
  pronunciation: z.string().nullable(),
  frequency_rank: z.number().int().nullable(),
  frequency_label: z.string().nullable(),
  etymology: z.string().nullable(),
  mnemonic: z.string().nullable(),
  notes: z.string().nullable(),
  article: z.string().nullable(),
  gender: z.string().nullable(),
  plural_form: z.string().nullable(),
  countability: z.string().nullable(),
  verb_forms: z.string().nullable(),
});

export const PhraseCardRow = z.object({
  card_id: z.string(),
  phrase: z.string(),
  translation: z.string(),
  meaning: z.string().nullable(),
  is_fixed_expression: z.boolean().default(true),
  frequency_label: z.string().nullable(),
  notes: z.string().nullable(),
});

export const ComparisonCardRow = z.object({
  card_id: z.string(),
  term_a: z.string(),
  term_b: z.string(),
  translation_a: z.string().nullable(),
  translation_b: z.string().nullable(),
  difference_summary: z.string(),
  frequency_note: z.string().nullable(),
  style_note: z.string().nullable(),
  typical_situations: z.string().nullable(),
  notes: z.string().nullable(),
});

export const CardExampleRow = z.object({
  card_id: z.string(),
  example_text: z.string(),
  translation: z.string().nullable(),
  source: z.string().default("manual"),
  created_at: z.number(),
});

export const CardRelatedTermRow = z.object({
  card_id: z.string(),
  related_text: z.string(),
  relation_type: z.string(),
  translation: z.string().nullable(),
  created_at: z.number(),
});

export const CardTagRow = z.object({
  name: z.string(),
  created_at: z.number(),
});

export const CardTagAssignmentRow = z.object({
  card_id: z.string(),
  tag_id: z.string(),
});

export const DictionaryCollectionRow = z.object({
  language_id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  level: z.string().nullable(), // A1 | A2 | B1 | ...
  is_public: z.boolean().default(true),
  created_by_user_id: z.string().nullable(),
  created_at: z.number(),
  updated_at: z.number(),
});

export const DictionaryCollectionCardRow = z.object({
  collection_id: z.string(),
  card_id: z.string(),
  position: z.number().int(),
});

export const cards = zodTable("cards", CardRow, {
  indexed: ["language_id", "created_by_user_id"],
});

export const wordCards = zodTable("word_cards", WordCardRow, {
  indexed: ["card_id"],
});

export const phraseCards = zodTable("phrase_cards", PhraseCardRow, {
  indexed: ["card_id"],
});

export const comparisonCards = zodTable("comparison_cards", ComparisonCardRow, {
  indexed: ["card_id"],
});

export const cardExamples = zodTable("card_examples", CardExampleRow, {
  indexed: ["card_id"],
});

export const cardRelatedTerms = zodTable("card_related_terms", CardRelatedTermRow, {
  indexed: ["card_id"],
});

export const cardTags = zodTable("card_tags", CardTagRow, {
  indexed: ["name"],
});

export const cardTagAssignments = zodTable("card_tag_assignments", CardTagAssignmentRow, {
  indexed: ["card_id", "tag_id"],
});

export const dictionaryCollections = zodTable("dictionary_collections", DictionaryCollectionRow, {
  indexed: ["language_id"],
});

export const dictionaryCollectionCards = zodTable("dictionary_collection_cards", DictionaryCollectionCardRow, {
  indexed: ["collection_id", "card_id"],
});

export class Card extends ModelFor(cards) {
  static associations = {
    word_cards: { type: "has_many" as const, foreignKey: "card_id" },
    phrase_cards: { type: "has_many" as const, foreignKey: "card_id" },
    comparison_cards: { type: "has_many" as const, foreignKey: "card_id" },
    examples: { type: "has_many" as const, foreignKey: "card_id" },
    related_terms: { type: "has_many" as const, foreignKey: "card_id" },
    tag_assignments: { type: "has_many" as const, foreignKey: "card_id" },
    collection_cards: { type: "has_many" as const, foreignKey: "card_id" },
  };
}

export class WordCard extends ModelFor(wordCards) {
  static associations = {
    card: { type: "belongs_to" as const, key: "card_id" },
  };
}

export class PhraseCard extends ModelFor(phraseCards) {
  static associations = {
    card: { type: "belongs_to" as const, key: "card_id" },
  };
}

export class ComparisonCard extends ModelFor(comparisonCards) {
  static associations = {
    card: { type: "belongs_to" as const, key: "card_id" },
  };
}

export class CardExample extends ModelFor(cardExamples) {
  static associations = {
    card: { type: "belongs_to" as const, key: "card_id" },
  };
}

export class CardRelatedTerm extends ModelFor(cardRelatedTerms) {
  static associations = {
    card: { type: "belongs_to" as const, key: "card_id" },
  };
}

export class CardTag extends ModelFor(cardTags) {
  static associations = {
    tag_assignments: { type: "has_many" as const, foreignKey: "tag_id" },
  };
}

export class CardTagAssignment extends ModelFor(cardTagAssignments) {
  static associations = {
    card: { type: "belongs_to" as const, key: "card_id" },
    tag: { type: "belongs_to" as const, key: "tag_id" },
  };
}

export class DictionaryCollection extends ModelFor(dictionaryCollections) {
  static associations = {
    collection_cards: { type: "has_many" as const, foreignKey: "collection_id" },
  };
}

export class DictionaryCollectionCard extends ModelFor(dictionaryCollectionCards) {
  static associations = {
    collection: { type: "belongs_to" as const, key: "collection_id" },
    card: { type: "belongs_to" as const, key: "card_id" },
  };
}

export type CardRowType = z.infer<typeof CardRow>;
export type WordCardRowType = z.infer<typeof WordCardRow>;
export type PhraseCardRowType = z.infer<typeof PhraseCardRow>;
export type ComparisonCardRowType = z.infer<typeof ComparisonCardRow>;
export type CardExampleRowType = z.infer<typeof CardExampleRow>;
export type CardRelatedTermRowType = z.infer<typeof CardRelatedTermRow>;
export type CardTagRowType = z.infer<typeof CardTagRow>;
export type CardTagAssignmentRowType = z.infer<typeof CardTagAssignmentRow>;
export type DictionaryCollectionRowType = z.infer<typeof DictionaryCollectionRow>;
export type DictionaryCollectionCardRowType = z.infer<typeof DictionaryCollectionCardRow>;

export type CardRecord = InferRecord<typeof cards>;
export type WordCardRecord = InferRecord<typeof wordCards>;
export type PhraseCardRecord = InferRecord<typeof phraseCards>;
export type ComparisonCardRecord = InferRecord<typeof comparisonCards>;
export type CardExampleRecord = InferRecord<typeof cardExamples>;
export type CardRelatedTermRecord = InferRecord<typeof cardRelatedTerms>;
export type CardTagRecord = InferRecord<typeof cardTags>;
export type CardTagAssignmentRecord = InferRecord<typeof cardTagAssignments>;
export type DictionaryCollectionRecord = InferRecord<typeof dictionaryCollections>;
export type DictionaryCollectionCardRecord = InferRecord<typeof dictionaryCollectionCards>;
