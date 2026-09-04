// The API host differs per target: the Android emulator reaches the dev
// machine at 10.0.2.2, an iOS simulator at localhost. Set EXPO_PUBLIC_API_URL
// in .env.local to override; the fallback assumes the Android emulator.
const envApiUrl: unknown = process.env.EXPO_PUBLIC_API_URL;
export const apiURL =
  typeof envApiUrl === 'string' ? envApiUrl : 'http://10.0.2.2:3000';
