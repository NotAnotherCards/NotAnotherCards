export interface BackupDeck {
  source_id: string;
  title: string;
  description: string | null;
}

export interface BackupCard {
  source_id: string;
  template_key: string;
  active: boolean;
  due_at: number;
  scheduled_interval_minutes: number;
}

export interface BackupNote {
  source_id: string;
  note_type: string;
  fields_version: number;
  fields: Record<string, string>;
  additional_content: string | null;
  decks: string[];
  cards: BackupCard[];
}

export interface BackupReviewEvent {
  source_card_id: string;
  rating: number;
  reviewed_at: number;
}

export interface BackupJsonFormat {
  format: number;
  exported_at: string;
  decks: BackupDeck[];
  notes: BackupNote[];
  review_events: BackupReviewEvent[];
  media: unknown[];
}
