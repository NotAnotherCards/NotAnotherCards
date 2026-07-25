import { execFileSync } from 'node:child_process';

describe('@repo/offline-db wiring on API', () => {
  it('imports and validates offline db schemas', () => {
    const output = execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        `
          import { UserCardRow, CardRow, WordCardRow, syncWireSchemas, schema } from '@repo/offline-db';

          const result = {
            schemaVersion: schema.version,
            userCardsTableDefined: !!schema.tables.user_cards,
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
      cardValidate: true,
      globalCardValidate: true,
      wordCardValidate: true,
      syncSchemaDefined: true,
    });
  });
});
