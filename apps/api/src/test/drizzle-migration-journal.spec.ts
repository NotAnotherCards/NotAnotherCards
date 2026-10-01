import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type JournalEntry = {
  idx: number;
  tag: string;
  when: number;
};

describe('Drizzle migration journal', () => {
  it('keeps migration timestamps strictly increasing', () => {
    const journal = JSON.parse(
      readFileSync(
        resolve(process.cwd(), 'drizzle/meta/_journal.json'),
        'utf8',
      ),
    ) as { entries: JournalEntry[] };

    const outOfOrderEntries = journal.entries.flatMap((entry, index) => {
      const previous = journal.entries[index - 1];
      return previous && entry.when <= previous.when
        ? [{ previous, current: entry }]
        : [];
    });

    expect(outOfOrderEntries).toEqual([]);
  });
});
