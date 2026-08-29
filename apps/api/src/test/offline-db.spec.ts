import { execFileSync } from 'node:child_process';

describe('@repo/offline-db wiring on API', () => {
  it('imports and validates offline db schemas', () => {
    const output = execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        `
          import {
            UserCard,
            UserCardRow,
            UserNote,
            UserNoteRow,
            UserNoteDeck,
            UserNoteDeckRow,
            syncWireSchemas,
            schema,
            UserDeckRow,
            ReviewEventRow,
            UserProfileRow,
          } from '@repo/offline-db';

          const result = {
            schemaVersion: schema.version,
            userCardsTableDefined: !!schema.tables.user_cards,
            userDecksTableDefined: !!schema.tables.user_decks,
            userNotesTableDefined: !!schema.tables.user_notes,
            userNoteDecksTableDefined: !!schema.tables.user_note_decks,
                reviewEventsTableDefined: !!schema.tables.review_events,
                userProfilesTableDefined: !!schema.tables.user_profiles,
            cardValidate: UserCardRow.safeParse({
               note_id: 'note123',
               template_key: 'front-back',
               active: true,
               front: 'front side',
               back: 'back side',
               due_at: 0,
               scheduled_interval_minutes: 0,
               created_at: 0,
               updated_at: 0,
             }).success,
            noteValidate: UserNoteRow.safeParse({
              note_type: 'basic',
              fields_version: 1,
              fields_json: JSON.stringify({ front: 'front', back: 'back' }),
              additional_content: null,
              created_at: 0,
              updated_at: 0,
            }).success,
            noteDeckValidate: UserNoteDeckRow.safeParse({
              note_id: 'note123',
              deck_id: 'deck123',
              active: true,
              created_at: 0,
              updated_at: 0,
            }).success,
            modelTables: [UserNote.table, UserNoteDeck.table, UserCard.table],
            userDeckValidate: UserDeckRow.safeParse({
              title: 'Test Deck',
              description: 'Deck description',
              created_at: 0,
              updated_at: 0,
            }).success,
            reviewEventValidate: ReviewEventRow.safeParse({
              user_card_id: 'usercard123',
              rating: 3,
              reviewed_at: 0,
            }).success,
            syncSchemaDefined: !!syncWireSchemas.rows.user_cards,
            userDecksSyncSchemaDefined: !!syncWireSchemas.rows.user_decks,
            userNotesSyncSchemaDefined: !!syncWireSchemas.rows.user_notes,
            userNoteDecksSyncSchemaDefined: !!syncWireSchemas.rows.user_note_decks,
                reviewEventsSyncSchemaDefined: !!syncWireSchemas.rows.review_events,
                userProfilesSyncSchemaDefined: !!syncWireSchemas.rows.user_profiles,
                userProfileValidate: UserProfileRow.safeParse({
                  username: null,
                  bio: null,
                  avatar_file_id: null,
                  native_language_id: null,
                  target_language_id: null,
                  created_at: 0,
                  updated_at: 0,
                }).success,
          };

          console.log(JSON.stringify(result));
        `,
      ],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
      },
    );

    expect(JSON.parse(output)).toEqual({
      schemaVersion: 3,
      userCardsTableDefined: true,
      userDecksTableDefined: true,
      userNotesTableDefined: true,
      userNoteDecksTableDefined: true,
      reviewEventsTableDefined: true,
      userProfilesTableDefined: true,
      cardValidate: true,
      noteValidate: true,
      noteDeckValidate: true,
      modelTables: ['user_notes', 'user_note_decks', 'user_cards'],
      userDeckValidate: true,
      reviewEventValidate: true,
      syncSchemaDefined: true,
      userDecksSyncSchemaDefined: true,
      userNotesSyncSchemaDefined: true,
      userNoteDecksSyncSchemaDefined: true,
      reviewEventsSyncSchemaDefined: true,
      userProfilesSyncSchemaDefined: true,
      userProfileValidate: true,
    });
  });
});
