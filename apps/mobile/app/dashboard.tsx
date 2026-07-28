import { Redirect, useRouter } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'
import { authClient } from '../lib/auth-client'
import { apiErrorMessage } from '../lib/errors'
import { Button } from '../components/ui/button'
import { Text } from '../components/ui/text'

export default function Dashboard() {
  const router = useRouter()
  const { data: session, isPending, error, refetch } = authClient.useSession()

  const onLogout = async () => {
    try {
      await authClient.signOut()
    } catch {
      // Server unreachable - still drop back to the login screen.
    }
    router.replace('/login')
  }

  if (isPending) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    )
  }

  // A failed session fetch (server down) is not the same as "not logged in" -
  // offer a retry instead of bouncing to /login.
  if (error) {
    return (
      <View className="flex-1 items-center justify-center gap-4 p-6">
        <Text className="text-center text-red-600">
          {apiErrorMessage(error)}
        </Text>
        <Button label="Retry" onPress={() => refetch()} />
      </View>
    )
  }

  // Only authenticated users may see the dashboard.
  if (!session) {
    return <Redirect href="/login" />
  }

  return (
    <View className="flex-1 justify-center gap-2 p-6">
      <Text className="text-2xl font-semibold">Dashboard</Text>
      <Text className="mt-2 text-base">
        Welcome, <Text className="font-semibold">{session.user.name}</Text>!
      </Text>
      <Text className="mb-4 text-zinc-500">
        Logged in as {session.user.email}
      </Text>
      <Button label="Log out" onPress={onLogout} />
    </View>
  )
}
