/**
 * The DeckList component over a real in-memory database: the library
 * hooks (useDatabase/useQuery) against the app's schema, with the
 * module-level manager mocked to a ready state. No emulator involved.
 */
import React from 'react'
import { act, render } from '@testing-library/react-native'
import { Database } from '@remelondb/core'
import { NodeSqliteDriver } from '@remelondb/driver-node'
import { schema, UserDeck, UserCard, ReviewEvent } from '@repo/offline-db'
import { createDeck } from '@/lib/queries'

let mockDb: Database

jest.mock('../lib/db', () => ({
  manager: {
    get state() {
      return { status: 'ready' }
    },
    get database() {
      return mockDb
    },
    init: jest.fn(),
    subscribe(listener: (s: unknown) => void) {
      listener({ status: 'ready' })
      return () => {}
    },
  },
}))

import { DeckList } from '@/components/deck-list'

describe('DeckList', () => {
  beforeEach(async () => {
    mockDb = await Database.open({
      driver: new NodeSqliteDriver(),
      schema,
      modelClasses: [UserDeck, UserCard, ReviewEvent],
      name: ':memory:',
    })
  })

  it('shows an empty state when there are no decks', async () => {
    const { findByText } = render(<DeckList />)
    expect(await findByText(/no decks yet/i)).toBeTruthy()
  })

  it('renders decks newest first and updates live on writes', async () => {
    await createDeck(mockDb, 'Spanish', null, 1_000)

    const { findByText, getAllByTestId } = render(<DeckList />)
    expect(await findByText('Spanish')).toBeTruthy()

    await act(async () => {
      await createDeck(mockDb, 'Biology', null, 2_000)
    })

    const titles = getAllByTestId('deck-title').map(
      (node) => node.props.children,
    )
    expect(titles).toEqual(['Biology', 'Spanish'])
  })
})
