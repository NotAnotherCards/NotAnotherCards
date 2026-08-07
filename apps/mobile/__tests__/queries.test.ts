/**
 * Deck queries against a real in-memory SQLite database (node driver).
 * Same schema and models the app uses; no emulator involved.
 */
import { Database } from '@remelondb/core'
import { NodeSqliteDriver } from '@remelondb/driver-node'
import { schema, UserDeck, UserCard, ReviewEvent } from '@repo/offline-db'
import { createDeck, getDecksQuery } from '@/lib/queries'

const openDb = () =>
  Database.open({
    driver: new NodeSqliteDriver(),
    schema,
    modelClasses: [UserDeck, UserCard, ReviewEvent],
    name: ':memory:',
  })

describe('deck queries', () => {
  it('lists created decks newest first', async () => {
    const db = await openDb()

    await createDeck(db, 'Spanish', null, 1_000)
    await createDeck(db, 'Biology', null, 2_000)

    const decks = await getDecksQuery(db).fetch()
    expect(decks.map((d) => d.title)).toEqual(['Biology', 'Spanish'])
  })
})
