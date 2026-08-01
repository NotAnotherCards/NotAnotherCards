import { Database } from '@remelondb/core'
import { schema, UserDeck, UserCard, ReviewEvent } from '@repo/offline-db'

// Capture the open callback that lib/db.ts hands to createDatabaseManager,
// so we can assert what it would open without touching native sqlite.
let capturedOpen: (() => Promise<unknown>) | undefined

jest.mock('@remelondb/core', () => {
  const actual = jest.requireActual('@remelondb/core')
  return {
    ...actual,
    createDatabaseManager: jest.fn((options: { open: () => Promise<unknown> }) => {
      capturedOpen = options.open
      return {
        state: { status: 'idle', error: null },
        init: jest.fn(),
        subscribe: jest.fn(() => () => {}),
      }
    }),
    Database: { ...actual.Database, open: jest.fn().mockResolvedValue({}) },
  }
})

jest.mock('@remelondb/driver-rn', () => ({
  RnSqliteDriver: class {},
}))

describe('database manager configuration', () => {
  it('opens with the shared schema, model classes, and app database name', async () => {
    require('../lib/db') // runs createDatabaseManager, sets capturedOpen

    expect(capturedOpen).toBeDefined()
    await capturedOpen!()

    expect(Database.open).toHaveBeenCalledWith(
      expect.objectContaining({
        schema,
        modelClasses: [UserDeck, UserCard, ReviewEvent],
        name: 'notanothercards.db',
      }),
    )
  })
})
