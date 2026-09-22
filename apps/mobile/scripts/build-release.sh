#!/usr/bin/env bash
# Builds a release-signed APK for apps/mobile. See issue #365.
#
# Needs in the environment:
#   EXPO_PUBLIC_API_URL      https:// url of the server the app talks to
#   NAC_KEYSTORE_PASSWORD    password of the release keystore
# Optional:
#   NAC_KEYSTORE             path to the keystore (default ~/.local/share/nac-mobile/release.keystore)
#   NAC_KEY_ALIAS            key alias (default nac-release)
#   JAVA_HOME                defaults to /usr/lib/jvm/java-21-openjdk
#   NAC_ARCHS                gradle reactNativeArchitectures (default arm64-v8a; x86_64 for the emulator)
set -euo pipefail

cd "$(dirname "$0")/.."

case "${EXPO_PUBLIC_API_URL:-}" in
  https://*) ;;
  *) echo "EXPO_PUBLIC_API_URL must be an https:// url" >&2; exit 1 ;;
esac
: "${NAC_KEYSTORE_PASSWORD:?NAC_KEYSTORE_PASSWORD is not set}"
keystore="${NAC_KEYSTORE:-$HOME/.local/share/nac-mobile/release.keystore}"
alias="${NAC_KEY_ALIAS:-nac-release}"
export JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/java-21-openjdk}"

version="$(node -p 'require("./app.json").expo.version')"
IFS=. read -r major minor patch <<<"$version"
if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || ((minor > 999 || patch > 999)); then
  echo "version $version must be major.minor.patch with minor and patch at most 999" >&2
  exit 1
fi
version_code=$((major * 1000000 + minor * 1000 + patch))
((version_code >= 1)) || { echo "version $version gives versionCode 0" >&2; exit 1; }
echo "building $version (versionCode $version_code) against $EXPO_PUBLIC_API_URL"

npx expo prebuild --platform android --clean --no-install
# prebuild copies the version but not a code, so set it in the generated file
sed -i "s/^\(\s*\)versionCode .*/\1versionCode $version_code/" android/app/build.gradle

(cd android && ./gradlew --quiet assembleRelease \
  -PreactNativeArchitectures="${NAC_ARCHS:-arm64-v8a}" \
  -Pandroid.injected.signing.store.file="$keystore" \
  -Pandroid.injected.signing.store.password="$NAC_KEYSTORE_PASSWORD" \
  -Pandroid.injected.signing.key.alias="$alias" \
  -Pandroid.injected.signing.key.password="$NAC_KEYSTORE_PASSWORD")

apk="android/app/build/outputs/apk/release/app-release.apk"
build_tools="$(ls -d "${ANDROID_HOME:-$HOME/Android/Sdk}"/build-tools/[0-9]*.[0-9]*.[0-9] | sort -V | tail -1)"
certs="$("$build_tools/apksigner" verify --print-certs "$apk")"
if grep -q "CN=Android Debug" <<<"$certs"; then
  echo "APK is signed with the debug key" >&2
  exit 1
fi
echo "$certs" | grep 'certificate DN'
sha256sum "$apk"
