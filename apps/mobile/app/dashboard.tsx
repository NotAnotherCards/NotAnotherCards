import { Redirect, useRouter } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'
import { authClient } from '../lib/auth-client'
import { Button } from '../components/ui/button'
import { Text } from '../components/ui/text'

export default function Dashboard() {
  const router = useRouter()
  const { data: session, isPending } = authClient.useSession()

  const onLogout = async () => {
    await authClient.signOut()
    router.replace('/login')
  }

  if (isPending) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
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
