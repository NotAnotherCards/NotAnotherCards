import { Redirect } from 'expo-router';

// Dashboard bounces unauthenticated users back to /login.
export default function Index() {
  return <Redirect href="/dashboard" />;
}
