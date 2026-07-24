# Mobile

Expo (SDK 57) React Native app in `apps/mobile`, using expo-router. Mirrors the
web frontend: login, register and a protected dashboard, sharing the API and the
`@repo/schemas` validation. Screens are built; auth works end to end once the
API enables Better Auth's Expo plugin (see Auth below).

Layout:

- `app/` - expo-router routes (`login`, `register`, `dashboard`, `index`, `_layout`)
- `components/ui/` - reusable primitives (React Native Reusables style)
- `components/auth/` - feature components (`AuthCard`)
- `lib/` - `auth-client.ts` and the `cn()` helper

## Prerequisites

- Node and pnpm (`pnpm install` at the root).
- Android SDK with an emulator (AVD) and `adb` on your PATH.
- **Java 21** for the Android build; it fails on newer JDKs (Java 26). Set
  `JAVA_HOME`, e.g. `/usr/lib/jvm/java-21-openjdk`.

Runs as a native dev build (`expo-dev-client`), not Expo Go.

## Environment

```sh
cd apps/mobile
cp .env.example .env.local
```

`.env.local` is gitignored, `.env.example` the committed template.
`EXPO_PUBLIC_API_URL` is the API base URL: `http://10.0.2.2:3000` for the
Android emulator, `http://localhost:3000` for an iOS simulator. Defaults to the
Android value if unset.

## Running on Android

Start an emulator, then from `apps/mobile`:

```sh
JAVA_HOME=/usr/lib/jvm/java-21-openjdk npx expo run:android
```

First build takes a few minutes (compiles native modules, generates `android/`,
installs on the emulator). After that, `npx expo start` and press `a`; JS changes
hot-reload, only native dependency changes need another `run:android`.

Metro defaults to port 8081. If that's already in use, add `--port 8082` (or any
free port) to the commands above.

### On a real phone

Android only from Linux/Windows (an iOS device needs a Mac with Xcode). Enable
developer options and USB debugging on the phone, plug it in, and check
`adb devices` lists it. The same `expo run:android` then builds and installs on
the phone; Metro is reached over USB automatically.

The default API URL (`10.0.2.2`) only works on the emulator. For a phone either
tunnel the API over USB:

```sh
adb reverse tcp:3000 tcp:3000
```

and set `EXPO_PUBLIC_API_URL=http://localhost:3000` in `.env.local`, or set it
to your machine's LAN IP with phone and machine on the same Wi-Fi. Restart
Metro after changing `.env.local` (values are inlined at bundle time).

### On an iPhone

There is no Linux path to a native iOS build; `expo run:ios` needs a Mac with
Xcode. Without a Mac:

- **EAS Build**: `eas build --profile development --platform ios` builds the
  dev client in Expo's cloud. Installing it on a phone requires an Apple
  Developer membership (ad-hoc provisioning, device registered by UDID).
- **Expo Go** from the App Store can run the app without any Apple account —
  every native module we use ships in the Expo SDK — but only once Expo Go's
  SDK 57 update is released there. Then: `npx expo start --go` and scan the
  QR code from the phone.

iPhones can't use `adb reverse`, so the API is reached over shared Wi-Fi: set
`EXPO_PUBLIC_API_URL` to your machine's LAN IP.

## Testing

Uses `jest-expo` with `@testing-library/react-native`. Run from `apps/mobile`:

```sh
pnpm test
```

Tests live in `__tests__/`. They render a screen and assert on it, mocking
`expo-router` and `lib/auth-client` (the real client pulls in native modules).
This mirrors the web tests, with two RN-specific version pins that matter:

- `jest` is on 29 (jest-expo 57 is built on jest 29; jest 30 breaks it).
- `@testing-library/react-native` is on 13 (v14 changed its renderer peer and
  `render()` silently returns nothing with the version jest-expo ships).

The web app uses Vitest; mobile and the API use Jest.

## Styling

Styling is Tailwind via **NativeWind**, with components in the **React Native
Reusables** style (the RN counterpart to web's shadcn). If you know the web
app's Tailwind classes, the same class names work here.

- Utility classes go in `className` on `View` / `Text` / `TextInput`, e.g.
  `className="flex-1 justify-center bg-zinc-100 p-6"`.
- `cn()` in `lib/utils.ts` merges classes, same as web.
- Reusable primitives live in `components/ui/` (`text`, `label`, `input`,
  `button`, `card`); copy the pattern to add more.

Differences from web Tailwind: no DOM, so no CSS file or pseudo-selectors;
React Native defaults to `flex-direction: column`; use `gap-*` for spacing.

Config is wired once and rarely touched: `babel.config.js`
(`jsxImportSource: nativewind`), `metro.config.js` (`withNativeWind`),
`tailwind.config.js`, and `global.css` imported in `app/_layout.tsx`. The
NativeWind transform is skipped under jest (it clashes with `jest.mock`
hoisting, and tests assert on text, not styles).

Docs: https://www.nativewind.dev and https://reactnativereusables.com.

## Auth

Follows https://better-auth.com/docs/integrations/expo.

Client is done: `lib/auth-client.ts` uses the `expoClient` plugin with the
session in `expo-secure-store` (no browser cookie on a device) and base URL from
`EXPO_PUBLIC_API_URL`. Packages pinned to `better-auth` 1.6.23 to match the API.

Server side is still open (tracked separately): the API needs the `expo()`
plugin in `apps/api/src/auth/auth.service.ts` and the app scheme
(`notanothercards://`, plus `exp://` / `exp://**` in dev) in `trustedOrigins`.

### Why we patch @better-auth/expo

`@better-auth/expo`'s client does a runtime `import("expo-network")` when it
initialises (in `ExpoOnlineManager.setup`). On an Expo SDK 56+ Hermes dev build
that dynamic import trips a broken lazy-module path and crashes the app at
startup with a native SIGSEGV, before any screen renders. It's a known upstream
bug (better-auth#10028, expo#46806) and is still unfixed as of 1.6.25 and the
1.7 release candidates, so bumping the version doesn't help.

The fix is `patches/@better-auth__expo@1.6.23.patch` (pinned via
`patchedDependencies` in `pnpm-workspace.yaml`, applied automatically on
install). It changes that one dynamic import to a static
`import * as ExpoNetwork from "expo-network"`, which Hermes handles fine. The
patch is intentionally minimal: it leaves the separate `import("expo-web-browser")`
call alone, since that only runs during OAuth social sign-in, which we don't use.
Revisit and drop the patch once upstream ships a fix.
