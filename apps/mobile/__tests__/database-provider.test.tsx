import React from 'react'
import { Text } from 'react-native'
import { act, render, waitFor } from '@testing-library/react-native'
import {
  SessionDatabaseProvider,
  useSessionDatabase,
} from '@/lib/database-provider'

type SessionState = {
  data: { user: { id: string } } | null
  isPending: boolean
}

type FakeManager = {
  owner: string
  init: jest.Mock
  close: jest.Mock
  state: { status: string; error: null }
  subscribe: jest.Mock
}

let mockSessionState: SessionState = { data: null, isPending: true }
const mockUseSession = jest.fn(() => mockSessionState)
const mockCreateUserDatabaseManager = jest.fn((userId: string) =>
  makeManager(userId),
)

jest.mock('../lib/auth-client', () => ({
  authClient: { useSession: () => mockUseSession() },
}))

jest.mock('../lib/db', () => ({
  createUserDatabaseManager: (userId: string) =>
    mockCreateUserDatabaseManager(userId),
}))

function makeManager(
  owner: string,
  init: Promise<unknown> = Promise.resolve({}),
): FakeManager {
  return {
    owner,
    init: jest.fn(() => init),
    close: jest.fn().mockResolvedValue(undefined),
    state: { status: 'idle', error: null },
    subscribe: jest.fn(() => () => {}),
  }
}

function ActiveOwner() {
  const { manager } = useSessionDatabase()
  return (
    <Text>{manager ? (manager as unknown as FakeManager).owner : 'none'}</Text>
  )
}

function renderProvider() {
  return render(
    <SessionDatabaseProvider>
      <ActiveOwner />
    </SessionDatabaseProvider>,
  )
}

describe('SessionDatabaseProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSessionState = { data: null, isPending: true }
    mockCreateUserDatabaseManager.mockImplementation((userId: string) =>
      makeManager(userId),
    )
  })

  it('waits for an authenticated session before creating a manager', () => {
    const { getByText } = renderProvider()

    expect(getByText('none')).toBeTruthy()
    expect(mockCreateUserDatabaseManager).not.toHaveBeenCalled()
  })

  it('creates no manager while the session check is still pending', () => {
    // useSession can keep the previous user while it refetches, so a user id
    // alone is not enough; only isPending === false means the check finished.
    mockSessionState = {
      data: { user: { id: 'user-a' } },
      isPending: true,
    }

    const { getByText } = renderProvider()

    expect(getByText('none')).toBeTruthy()
    expect(mockCreateUserDatabaseManager).not.toHaveBeenCalled()
  })

  it('mounts children on an authenticated first paint, before the manager exists', async () => {
    mockSessionState = {
      data: { user: { id: 'user-a' } },
      isPending: false,
    }
    // The manager is created in the provider's effect. If the tree blanked
    // while userId is set and the manager missing, children could only mount
    // after that effect ran; mounting before it proves the navigator is
    // never unmounted. Child effects run before parent effects, so mount
    // order is observable through invocationCallOrder.
    const childMounted = jest.fn()
    function MountProbe() {
      React.useEffect(() => childMounted(), [])
      return <Text>probe</Text>
    }

    const view = render(
      <SessionDatabaseProvider>
        <MountProbe />
      </SessionDatabaseProvider>,
    )

    await waitFor(() => expect(view.getByText('probe')).toBeTruthy())
    expect(childMounted).toHaveBeenCalled()
    expect(mockCreateUserDatabaseManager).toHaveBeenCalled()
    expect(childMounted.mock.invocationCallOrder[0]).toBeLessThan(
      mockCreateUserDatabaseManager.mock.invocationCallOrder[0],
    )
  })

  it('creates and initializes the authenticated user manager', async () => {
    mockSessionState = {
      data: { user: { id: 'user-a' } },
      isPending: false,
    }

    const { getByText } = renderProvider()

    await waitFor(() => expect(getByText('user-a')).toBeTruthy())
    const manager = mockCreateUserDatabaseManager.mock.results[0]
      .value as FakeManager
    expect(mockCreateUserDatabaseManager).toHaveBeenCalledWith('user-a')
    expect(manager.init).toHaveBeenCalled()
  })

  it('closes the old account and ignores its late initialization', async () => {
    let resolveFirstInit!: (value: unknown) => void
    const firstInit = new Promise((resolve) => {
      resolveFirstInit = resolve
    })
    const firstManager = makeManager('user-a', firstInit)
    const secondManager = makeManager('user-b')
    mockCreateUserDatabaseManager
      .mockReturnValueOnce(firstManager)
      .mockReturnValueOnce(secondManager)
    mockSessionState = {
      data: { user: { id: 'user-a' } },
      isPending: false,
    }

    const view = renderProvider()
    await waitFor(() => expect(view.getByText('user-a')).toBeTruthy())

    mockSessionState = {
      data: { user: { id: 'user-b' } },
      isPending: false,
    }
    view.rerender(
      <SessionDatabaseProvider>
        <ActiveOwner />
      </SessionDatabaseProvider>,
    )

    await waitFor(() => expect(view.getByText('user-b')).toBeTruthy())
    expect(firstManager.close).toHaveBeenCalled()
    expect(secondManager.init).toHaveBeenCalled()

    await act(async () => {
      resolveFirstInit({})
      await firstInit
    })
    expect(view.getByText('user-b')).toBeTruthy()
  })

  it('closes and clears the manager on logout', async () => {
    mockSessionState = {
      data: { user: { id: 'user-a' } },
      isPending: false,
    }

    const view = renderProvider()
    await waitFor(() => expect(view.getByText('user-a')).toBeTruthy())
    const manager = mockCreateUserDatabaseManager.mock.results[0]
      .value as FakeManager

    mockSessionState = { data: null, isPending: false }
    view.rerender(
      <SessionDatabaseProvider>
        <ActiveOwner />
      </SessionDatabaseProvider>,
    )

    await waitFor(() => expect(view.getByText('none')).toBeTruthy())
    expect(manager.close).toHaveBeenCalled()
  })

  it('creates a fresh manager when the same account signs in again', async () => {
    const firstManager = makeManager('first-user-a')
    const reopenedManager = makeManager('reopened-user-a')
    mockCreateUserDatabaseManager
      .mockReturnValueOnce(firstManager)
      .mockReturnValueOnce(reopenedManager)
    mockSessionState = {
      data: { user: { id: 'user-a' } },
      isPending: false,
    }

    const view = renderProvider()
    await waitFor(() => expect(view.getByText('first-user-a')).toBeTruthy())

    mockSessionState = { data: null, isPending: false }
    view.rerender(
      <SessionDatabaseProvider>
        <ActiveOwner />
      </SessionDatabaseProvider>,
    )
    await waitFor(() => expect(view.getByText('none')).toBeTruthy())

    mockSessionState = {
      data: { user: { id: 'user-a' } },
      isPending: false,
    }
    view.rerender(
      <SessionDatabaseProvider>
        <ActiveOwner />
      </SessionDatabaseProvider>,
    )

    await waitFor(() => expect(view.getByText('reopened-user-a')).toBeTruthy())
    expect(firstManager.close).toHaveBeenCalled()
    expect(mockCreateUserDatabaseManager).toHaveBeenNthCalledWith(2, 'user-a')
    expect(reopenedManager.init).toHaveBeenCalled()
  })
})
