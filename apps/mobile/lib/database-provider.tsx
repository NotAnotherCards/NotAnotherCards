import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { DatabaseManager } from '@remelondb/core'
import { DatabaseProvider } from '@remelondb/core/react'
import { authClient } from './auth-client'
import { createUserDatabaseManager } from './db'

type OwnedManager = {
  userId: string
  manager: DatabaseManager
}

type SessionDatabase = {
  manager: DatabaseManager | null
  closeActiveDatabase: () => Promise<void>
}

const SessionDatabaseContext = createContext<SessionDatabase | null>(null)

export function SessionDatabaseProvider({ children }: { children: ReactNode }) {
  const { data: session, isPending } = authClient.useSession()
  const userId = isPending ? null : (session?.user.id ?? null)
  const [ownedManager, setOwnedManager] = useState<OwnedManager | null>(null)
  const ownedManagerRef = useRef<OwnedManager | null>(null)

  const closeActiveDatabase = useCallback(async () => {
    const owned = ownedManagerRef.current
    ownedManagerRef.current = null
    setOwnedManager(null)
    await owned?.manager.close()
  }, [])

  useEffect(() => {
    if (!userId) {
      void closeActiveDatabase()
      return
    }

    const manager = createUserDatabaseManager(userId)
    const owned = { userId, manager }
    ownedManagerRef.current = owned
    setOwnedManager(owned)

    manager.init().catch((error: unknown) => {
      if (ownedManagerRef.current === owned) {
        console.error('opening the offline database failed', error)
      }
    })

    return () => {
      if (ownedManagerRef.current === owned) {
        ownedManagerRef.current = null
      }
      void manager.close()
    }
  }, [closeActiveDatabase, userId])

  const activeManager =
    ownedManager?.userId === userId ? ownedManager.manager : null
  // Render the tree either way. The manager is created in an effect, so an
  // authenticated first paint has no manager yet; blanking here would unmount
  // the navigator, including the unauthenticated screens. Consumers reach the
  // manager through useSessionDatabase, which is null-safe.
  const content = activeManager ? (
    <DatabaseProvider manager={activeManager}>{children}</DatabaseProvider>
  ) : (
    children
  )

  return (
    <SessionDatabaseContext.Provider
      value={{ manager: activeManager, closeActiveDatabase }}
    >
      {content}
    </SessionDatabaseContext.Provider>
  )
}

export function useSessionDatabase(): SessionDatabase {
  const value = useContext(SessionDatabaseContext)
  if (!value) {
    throw new Error('useSessionDatabase requires SessionDatabaseProvider')
  }
  return value
}
