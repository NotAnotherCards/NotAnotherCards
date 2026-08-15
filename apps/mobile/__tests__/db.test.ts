import { Database } from '@remelondb/core'
import { schema } from '@repo/offline-db'

// Capture the open callback that lib/db.ts hands to createDatabaseManager,
// so we can inspect what it would open without touching native sqlite.
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

type OpenOptions = {
  schema: typeof schema
  modelClasses: Array<{ table: string }>
  name: string
}

async function openOptions(): Promise<OpenOptions> {
  require('../lib/db') // runs createDatabaseManager, sets capturedOpen
  expect(capturedOpen).toBeDefined()
  await capturedOpen!()
  return (Database.open as jest.Mock).mock.calls[0][0] as OpenOptions
}

describe('database bootstrap', () => {
  it('opens the app database with the shared schema', async () => {
    const options = await openOptions()

    expect(options.schema).toBe(schema)
    expect(options.name).toBe('notanothercards.db')
  })

  // Registering models is manual, so a table added to @repo/offline-db is easy
  // to miss here: its records would come back untyped and without associations.
  it('registers a model class for every table in the shared schema', async () => {
    const options = await openOptions()

    const registered = options.modelClasses.map((model) => model.table).sort()
    expect(registered).toEqual(Object.keys(schema.tables).sort())
  })
})
