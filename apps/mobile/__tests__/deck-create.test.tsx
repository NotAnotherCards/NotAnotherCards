/**
 * DeckCreate + DeckList together over a real in-memory database: a
 * deck created through the UI shows up in the list via the reactive
 * query, no reload involved.
 */
import React from 'react'
import { act, fireEvent, render } from '@testing-library/react-native'
import { View } from 'react-native'
import { Database } from '@remelondb/core'
import { NodeSqliteDriver } from '@remelondb/driver-node'
import { schema, UserDeck, UserCard, ReviewEvent } from '@repo/offline-db'
import { getDecksQuery } from '@/lib/queries'

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

import { DeckCreate } from '@/components/deck-create'
import { DeckList } from '@/components/deck-list'

describe('DeckCreate', () => {
  beforeEach(async () => {
    mockDb = await Database.open({
      driver: new NodeSqliteDriver(),
      schema,
      modelClasses: [UserDeck, UserCard, ReviewEvent],
      name: ':memory:',
    })
  })

  it('creates a deck that the list picks up reactively', async () => {
    const screen = render(
      <View>
        <DeckCreate />
        <DeckList />
      </View>,
    )
    expect(await screen.findByText(/no decks yet/i)).toBeTruthy()

    fireEvent.changeText(
      screen.getByPlaceholderText(/new deck/i),
      'Norwegian',
    )
    await act(async () => {
      fireEvent.press(screen.getByText('Add'))
    })

    expect(await screen.findByText('Norwegian')).toBeTruthy()
    const stored = await getDecksQuery(mockDb).fetch()
    expect(stored.map((d) => d.title)).toEqual(['Norwegian'])
  })

  it('ignores empty titles and clears the field after create', async () => {
    const screen = render(<DeckCreate />)

    await act(async () => {
      fireEvent.press(screen.getByText('Add'))
    })
    expect((await getDecksQuery(mockDb).fetch()).length).toBe(0)

    const input = screen.getByPlaceholderText(/new deck/i)
    fireEvent.changeText(input, '  Spanish  ')
    await act(async () => {
      fireEvent.press(screen.getByText('Add'))
    })

    const stored = await getDecksQuery(mockDb).fetch()
    expect(stored.map((d) => d.title)).toEqual(['Spanish'])
    expect(input.props.value).toBe('')
  })
})
