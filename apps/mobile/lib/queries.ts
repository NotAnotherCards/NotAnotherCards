import { Database, Q } from '@remelondb/core'
import { UserDeck } from '@repo/offline-db'

export function getDecksQuery(db: Database) {
  return db.get(UserDeck).query(Q.sortBy('created_at', Q.desc))
}

export async function createDeck(
  db: Database,
  title: string,
  description: string | null = null,
  now: number = Date.now(),
) {
  return db.write(async () =>
    db.get(UserDeck).create({
      // user_id and deleted_at exist in the current row schema and leave
      // with the reworked shapes; no query filters on either.
      user_id: 'local',
      deleted_at: null,
      title,
      description,
      created_at: now,
      updated_at: now,
    }),
  )
}
