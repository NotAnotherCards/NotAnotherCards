import { execFileSync } from 'node:child_process';

describe('@repo/offline-db wiring on API', () => {
  it('imports and validates offline db schemas', () => {
    const output = execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        `
          import { UserCardRow, CardRow, WordCardRow, syncWireSchemas, schema, UserRow, SessionRow } from '@repo/offline-db';

          const result = {
            schemaVersion: schema.version,
            userCardsTableDefined: !!schema.tables.user_cards,
            usersTableDefined: !!schema.tables.users,
            sessionsTableDefined: !!schema.tables.sessions,
            userValidate: UserRow.safeParse({
              email: 'test@example.com',
              email_verified: true,
              name: 'Test User',
              username: 'testuser',
              image: null,
              created_at: 0,
              updated_at: 0,
              deleted_at: null,
            }).success,
            sessionValidate: SessionRow.safeParse({
              user_id: 'user123',
              token: 'token123',
              expires_at: 3600000,
              ip_address: '127.0.0.1',
              user_agent: 'Mozilla',
              created_at: 0,
              updated_at: 0,
            }).success,
            cardValidate: UserCardRow.safeParse({
              user_id: 'user123',
              card_id: 'card123',
              status: 'learning',
              source: 'manual',
              offline_enabled: false,
              added_at: 0,
              updated_at: 0,
            }).success,
            globalCardValidate: CardRow.safeParse({
              type: 'word',
              language_id: 'lang123',
              status: 'active',
              source: 'manual',
              created_by_user_id: null,
              created_at: 0,
              updated_at: 0,
              deleted_at: null,
              version: 1,
            }).success,
            wordCardValidate: WordCardRow.safeParse({
              card_id: 'card123',
              lemma: 'gehen',
              translation: 'to go',
              part_of_speech: 'verb',
              pronunciation: null,
              frequency_rank: null,
              frequency_label: null,
              etymology: null,
              mnemonic: null,
              notes: null,
              article: null,
              gender: null,
              plural_form: null,
              countability: null,
              verb_forms: null,
            }).success,
            syncSchemaDefined: !!syncWireSchemas.rows.user_cards,
            usersSyncSchemaDefined: !!syncWireSchemas.rows.users,
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
      usersTableDefined: true,
      sessionsTableDefined: true,
      userValidate: true,
      sessionValidate: true,
      cardValidate: true,
      globalCardValidate: true,
      wordCardValidate: true,
      syncSchemaDefined: true,
      usersSyncSchemaDefined: true,
    });
  });
});

