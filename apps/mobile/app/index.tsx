import { Redirect } from 'expo-router'

// Entry point. Session-aware redirect comes with the auth step; for now
// the app opens on the login screen.
export default function Index() {
  return <Redirect href="/login" />
}
