// The API host differs per target: the Android emulator reaches the dev
// machine at 10.0.2.2, an iOS simulator at localhost. Set EXPO_PUBLIC_API_URL
// in .env.local to override; the fallback assumes the Android emulator.
export const apiURL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:3000'
