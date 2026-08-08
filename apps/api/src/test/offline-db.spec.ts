import { execFileSync } from 'node:child_process';

describe('@repo/offline-db wiring on API', () => {
  it('imports and validates offline db schemas', () => {
    const output = execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        `
          import { UserCardRow, syncWireSchemas, schema, UserDeckRow, ReviewEventRow } from '@repo/offline-db';

          const result = {
            schemaVersion: schema.version,
            userCardsTableDefined: !!schema.tables.user_cards,
            userDecksTableDefined: !!schema.tables.user_decks,
            reviewEventsTableDefined: !!schema.tables.review_events,
            cardValidate: UserCardRow.safeParse({
               deck_id: 'deck123',
               front: 'front side',
               back: 'back side',
               due_at: 0,
               created_at: 0,
               updated_at: 0,
             }).success,
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
            reviewEventsSyncSchemaDefined: !!syncWireSchemas.rows.review_events,
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
      schemaVersion: 1,
      userCardsTableDefined: true,
      userDecksTableDefined: true,
      reviewEventsTableDefined: true,
      cardValidate: true,
      userDeckValidate: true,
      reviewEventValidate: true,
      syncSchemaDefined: true,
      userDecksSyncSchemaDefined: true,
      reviewEventsSyncSchemaDefined: true,
    });
  });
});
