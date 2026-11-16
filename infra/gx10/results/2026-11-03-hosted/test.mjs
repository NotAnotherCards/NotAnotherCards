// Unit checks for the extraction logic (run with: node test.mjs).
import assert from 'node:assert/strict';
import { stripThinking, parseCards, THINK_TAG } from './lib.mjs';

const THINK_OPEN = '\u003cthinking\u003e';
const THINK_CLOSE = '\u003c/thinking\u003e';

// Plain JSON
assert.deepEqual(parseCards('[{"front":"a","back":"b"}]'), [
  { front: 'a', back: 'b' },
]);

// think block stripped (reasoning before the array)
assert.deepEqual(
  parseCards(
    `${THINK_OPEN}let me consider the topic deeply…${THINK_CLOSE}\n[{"front":"a","back":"b"}]`,
  ),
  [{ front: 'a', back: 'b' }],
);

// think block with brackets inside
assert.deepEqual(
  parseCards(
    `${THINK_OPEN}I weighed [3 options] carefully.${THINK_CLOSE}[{"front":"a","back":"b"}]`,
  ),
  [{ front: 'a', back: 'b' }],
);

// prose leading into the array
assert.deepEqual(
  parseCards('Here are your cards:\n[{"front":"a","back":"b"}]'),
  [{ front: 'a', back: 'b' }],
);

// string containing brackets survives depth counting
assert.deepEqual(parseCards('[{"front":"- [ ] items","back":"todo"}]'), [
  { front: '- [ ] items', back: 'todo' },
]);

// escapes
assert.deepEqual(parseCards('[{"front":"a \\"quote\\"","back":"b"}]'), [
  { front: 'a "quote"', back: 'b' },
]);

// failures
assert.throws(() => parseCards('no json here'));
assert.throws(() => parseCards('[{"front":"unclosed'));
assert.throws(() => parseCards('{"front":"object not array"}'));

// trailing think tag without closing tag (empty content, safety net path)
assert.equal(stripThinking(THINK_OPEN + '…'), '');
assert.equal(THINK_TAG.test(THINK_OPEN), true);
assert.equal(THINK_TAG.test('plain answer'), false);

console.log('lib.mjs tests passed');
