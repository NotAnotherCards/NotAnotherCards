# Mobile

Expo (SDK 57) React Native app in `apps/mobile`, using expo-router. Mirrors the
web frontend: login, register and a protected dashboard, sharing the API and the
`@repo/schemas` validation. Screens are built and auth works end to end (see
Auth below).

Layout:

- `app/` - expo-router routes (`login`, `register`, `dashboard`, `index`, `_layout`)
- `components/ui/` - reusable primitives (React Native Reusables style)
- `components/auth/` - feature components (`AuthCard`)
- `lib/` - `auth-client.ts` and the `cn()` helper

## Prerequisites

- Node and pnpm (`pnpm install` at the root).
- The API running locally: follow the Setup section in the root README (env
  files, `docker compose up -d`, `pnpm --filter api db:migrate`). Without it,
  login and signup fail with "Can't reach the server". You don't need to start
  it by hand: `pnpm turbo dev:mobile` (from `apps/mobile`) starts the API
  together with Metro. `pnpm --filter api dev` still works if you want it in
  its own terminal.
- For Android: the Android SDK with an emulator (AVD) and `adb` on your PATH,
  plus **Java 17–21** for the build; it fails on newer JDKs (Java 26). Set
  `JAVA_HOME`, e.g. `/usr/lib/jvm/java-21-openjdk` or
  `/usr/lib/jvm/java-17-openjdk-amd64`.
- For iOS: a Mac with full Xcode installed. CocoaPods is installed
  automatically by `expo run:ios` on first build if missing.

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

### Setting up the emulator

The easiest path is Android Studio: **Tools → Device Manager → Create Virtual
Device**, pick a phone (e.g. Pixel 8) and a recent system image (API 35+),
then start it from the Device Manager. Without Android Studio, the SDK
command-line tools work too:

```sh
sdkmanager "platform-tools" "emulator" "system-images;android-35;google_apis;x86_64"
avdmanager create avd -n pixel8 -d pixel_8 -k "system-images;android-35;google_apis;x86_64"
emulator -avd pixel8
```

AVDs created with `avdmanager` default to `hw.keyboard = no`, which makes the
emulator ignore your physical keyboard. Flip it to `yes` in
`~/.android/avd/<name>.avd/config.ini` and restart the emulator. (Android
Studio's Device Manager and `scripts/android-emulator.sh` both set it for you.)

Either way, `adb devices` should list the running emulator before you continue.

### On a 42 school computer

`scripts/android-emulator.sh` automates all of the above: it installs the SDK
into `/goinfre` (fast local disk), creates a Pixel 8 AVD (API 35) and starts
it. Because goinfre is wiped regularly, just re-run the script after a wipe —
the big downloads are cached in `/sgoinfre`, so re-provisioning is quick.

```sh
./scripts/android-emulator.sh            # set up if needed, then start
./scripts/android-emulator.sh --setup    # set up only, don't start
./scripts/android-emulator.sh --headless # start without a window (CI/tests)
```

To use `adb` or `emulator` manually in your own shell, source the env file
the script writes:

```sh
source /goinfre/$USER/android-sdk/env.sh
```

(The script exports `ANDROID_AVD_HOME` to keep AVDs on goinfre, but
`avdmanager` ignores it and creates them in `~/.android/avd` anyway — keep
`~/.android` symlinked into goinfre so they stay off the home quota.)

The script also points pnpm's global package store at
`/goinfre/$USER/pnpm-store` — it grows to ~1 GB and eats the home quota
otherwise. After a goinfre wipe pnpm recreates it on the next `pnpm install`;
nothing else to redo.

Finally, keep the repo itself on goinfre: a native Android build needs a few
GB of scratch space inside the repo (`node_modules`, `android/`), which does
not fit next to everything else in the ~10 GB home quota. Clone it there
directly, or move an existing checkout and symlink it back:

```sh
mv ~/Code/NotAnotherCards /goinfre/$USER/NotAnotherCards
ln -s /goinfre/$USER/NotAnotherCards ~/Code/NotAnotherCards
```

goinfre is wiped regularly and never leaves the machine, so commit and push
early and often — after a wipe, re-clone and re-run the script.

### Building and starting

Start the emulator, then from `apps/mobile`:

```sh
JAVA_HOME=/path/to/jdk-21 pnpm android
```

JDK paths differ by distribution, so check `ls /usr/lib/jvm` and point
`JAVA_HOME` at what you actually have (`/usr/lib/jvm/java-21-openjdk` on Arch,
`/usr/lib/jvm/java-17-openjdk-amd64` on Debian/Ubuntu). Gradle auto-provisions
its own toolchain under `~/.gradle/jdks` regardless, so this variable only
decides which JVM launches the build. JDK 26 fails; use 17 or 21.

Build times, so nobody is surprised:

- First build: ~10 minutes. It generates `android/`, downloads the Gradle
  toolchain and compiles every native module.
- Later `pnpm android` runs: a minute or two (warm Gradle caches). Only needed
  when a native dependency changes.
- Day to day: no rebuild at all. `pnpm turbo dev:mobile` (starts Metro and the
  API together) and press `a`; JS changes hot-reload in about a second.

Metro defaults to port 8081. If that's already in use, add `--port 8082` (or any
free port) to the commands above.

### Reducing build disk I/O

An Android build plus a running emulator can saturate the disk rather than the
CPU, especially on an encrypted volume. The symptom is a load average in the
tens while `vmstat` reports the CPU mostly idle with 25%+ under `wa`, and every
blocked process being `kcryptd` or `dmcrypt_write`. Killing browsers and chat
apps does nothing for this; only the writers matter.

In order of effect:

1. **Build one ABI.** `reactNativeArchitectures` defaults to all four, so every
   native library is compiled and packaged four times. `x86_64` covers the
   emulator, `arm64-v8a` a physical device. Keep all four for release builds
   only. Set it in `android/gradle.properties`, or per-run with
   `-PreactNativeArchitectures=x86_64`.

   `expo run:android` appears to narrow this to the target device's ABI on its
   own, so the explicit setting mainly matters for direct `./gradlew`
   invocations. Check the build output before assuming it changed anything.
2. **Don't rebuild for JS.** As above: `pnpm turbo dev:mobile` and hot reload.
   A Gradle run is only needed when a native dependency changes. Most work is
   pure TypeScript — screens, hooks, database and sync wiring — and needs no
   build at all.
3. **Run the tests instead.** `pnpm --filter mobile test` needs no emulator at
   all, and covers most acceptance criteria. Reserve the emulator for the
   checks that genuinely need a device.
4. **Skip the emulator snapshot.** Quick boot writes a multi-gigabyte snapshot
   every time the emulator closes. Launch with `-no-snapshot-save` when you
   don't need the state to persist.

`android/` is generated by `expo prebuild` and gitignored, so any
`gradle.properties` edit there is lost on the next prebuild. Settings that
should survive belong in `~/.gradle/gradle.properties`, which is per-machine
and applies to every Gradle build:

```properties
org.gradle.caching=true      # reuse task outputs instead of regenerating them
org.gradle.workers.max=4     # fewer concurrent writers on a saturated disk
```

Note that `android/gradle.properties` ships `org.gradle.parallel=true`, which
pulls the other way: parallel project execution is a throughput win when the
CPU is the limit and extra write pressure when the disk is. If a build is
I/O-bound, capping workers while leaving parallel execution on is a compromise;
turning parallel off is the stronger version of the same trade. Neither is
free, so measure `wa` in `vmstat` rather than assuming.

Caching helps only when matching task outputs already exist in Gradle's cache.
It does not reduce a cache-cold build, which is usually the expensive one.

`org.gradle.configuration-cache=true` may help further, but React Native and
Expo plugin compatibility varies by version, so verify it against a real build
before adopting it.

To stop a runaway build and emulator: `adb -s emulator-5554 emu kill`, then
terminate the `gradlew` wrapper process before the daemons so the build does
not simply respawn workers.

### On a real Android phone

The only device path from Linux/Windows (an iOS device needs a Mac). Enable
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

## Running on iOS

Needs a Mac with Xcode; there is no Linux path to a native iOS build.

### Setting up the simulator

Install full Xcode (App Store or developer.apple.com), then let it finish its
first-run setup and fetch an iOS simulator runtime:

```sh
xcode-select --install                          # command line tools, if missing
sudo xcodebuild -license accept
xcodebuild -runFirstLaunch
xcodebuild -downloadPlatform iOS                # simulator runtime (large download)
```

The runtime can also be installed from **Xcode → Settings → Components**.
`xcrun simctl list devices available` should then list simulators (iPhone 17
Pro etc.); `expo run:ios` boots one automatically, no need to start it by hand.

### Building and starting

Set
`EXPO_PUBLIC_API_URL=http://localhost:3000` in `.env.local` (the simulator
shares the host's loopback), then from `apps/mobile`:

```sh
pnpm ios
```

This picks a default simulator; add `--device "iPhone 17 Pro"` to choose one.
First build takes a few minutes (installs CocoaPods if missing, compiles the
pods, installs on the simulator). After that, `pnpm turbo dev:mobile` and press
`i`; JS changes hot-reload, only native dependency changes need another
`pnpm ios`.
Verified working with Xcode 26.6 and the iOS 26.5 simulator runtime.

### On a real iPhone

The same `pnpm ios` builds and installs the dev build on a plugged-in
iPhone, and a free Apple ID is enough to sign it onto your own phone.

Without a Mac there is currently no iPhone test path for this project. Expo Go
on the App Store hasn't been updated to SDK 57 yet; once it is, the app runs in
it without any Apple account (every native module we use ships in the Expo
SDK): `pnpm start --go`, then scan the QR code from the phone.

iPhones can't use `adb reverse`, so the API is reached over shared Wi-Fi: set
`EXPO_PUBLIC_API_URL` to your machine's LAN IP.

## Simulator/emulator log noise

Both the iOS Simulator and the Android emulator spam harmless errors that are
**not** coming from our app. They only appear on the virtual devices and vanish
on a real phone; you can safely ignore them.

On the iOS Simulator you'll see, repeated once per keystroke in a text field:

```
[CoreHaptics] CHHapticPattern.mm:487 … Failed to read pattern library data:
The file "hapticpatternlibrary.plist" couldn't be opened because there is no
such file.
```

Haptics hardware is the phone's Taptic Engine — the component that produces the
physical tap you feel when typing or on a notification. The Simulator has no
such hardware and doesn't ship the haptic pattern file, so when iOS tries to
play keyboard feedback it logs this miss and moves on. It's a known Apple issue
([forum thread](https://developer.apple.com/forums/thread/812392),
[Expo #40310](https://github.com/expo/expo/issues/40310), labeled "Upstream:
iOS"), our code never touches CoreHaptics.

The Android emulator has its own equivalents — `EGL_emulation: eglMakeCurrent`
firing constantly (a graphics-driver quirk) and `Choreographer: Skipped N
frames!` (the emulator being slower than hardware). Also harmless.

To silence the iOS noise, either filter it:

```sh
pnpm ios 2>&1 | grep -v -E 'CHHapticPattern|hapticpatternlibrary|_UIKBFeedbackGenerator'
```

or set `OS_ACTIVITY_MODE=disable` in the Xcode scheme's run arguments (mutes
system logs, keeps the app's). If the app itself fails to launch, that's a
separate problem — these log lines are not the cause.

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

### The @better-auth/expo startup crash (fixed upstream)

`@better-auth/expo`'s client does a runtime `import("expo-network")` when it
initialises (in `ExpoOnlineManager.setup`). On Expo SDK 56 that dynamic import
tripped a broken lazy-module path and crashed the app at startup with a native
SIGSEGV, before any screen rendered (better-auth#10028). We carried a pnpm patch
making the import static.

Expo fixed it in `expo@56.0.12` (expo/expo#46870), and we have been on SDK 57
since. Verified on the Android emulator without the patch: the bundle boots and
the app runs, so the patch is gone. better-auth itself never shipped a fix
(their PR #10069 was closed unmerged), so if the crash ever returns on a new
SDK, the workaround is that same one-line change from dynamic to
`import * as ExpoNetwork from "expo-network"`.
