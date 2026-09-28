#!/usr/bin/env bash
# Builds a release-signed APK for apps/mobile. See issue #365.
#
# Needs in the environment:
#   EXPO_PUBLIC_API_URL      https:// url of the server the app talks to
#   NAC_KEYSTORE             path to the release keystore, kept outside the repository
#   NAC_KEYSTORE_PASSWORD    its password (passed to gradle through the environment, not argv)
# Optional:
#   NAC_KEY_ALIAS            key alias (default nac-release)
#   JAVA_HOME                defaults to /usr/lib/jvm/java-21-openjdk
#   NAC_ARCHS                gradle reactNativeArchitectures (default arm64-v8a; x86_64 for the emulator)
#   NAC_EXPECTED_CERT_SHA256 signing certificate the APK must carry (default: the published releases')
set -euo pipefail

cd "$(dirname "$0")/.."

if ! node -e '
  try {
    const url = new URL(process.argv[1]);
    if (url.protocol !== "https:" || !url.hostname) process.exit(1);
  } catch {
    process.exit(1);
  }
' "${EXPO_PUBLIC_API_URL:-}"; then
  echo "EXPO_PUBLIC_API_URL must be a valid HTTPS URL with a host" >&2
  exit 1
fi
# Android only updates an installed app in place when the new APK carries the
# same signing certificate, so a build signed with any other key is refused.
expected_cert="${NAC_EXPECTED_CERT_SHA256:-d04b0db8f7053d6f77eee2a1809dda8dba6dd86ceb95eb060fa9c7d6d1a28a3f}"
: "${NAC_KEYSTORE:?NAC_KEYSTORE is not set}"
: "${NAC_KEYSTORE_PASSWORD:?NAC_KEYSTORE_PASSWORD is not set}"
keystore="$NAC_KEYSTORE"
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

(cd android && env \
  ORG_GRADLE_PROJECT_android.injected.signing.store.file="$keystore" \
  ORG_GRADLE_PROJECT_android.injected.signing.store.password="$NAC_KEYSTORE_PASSWORD" \
  ORG_GRADLE_PROJECT_android.injected.signing.key.alias="$alias" \
  ORG_GRADLE_PROJECT_android.injected.signing.key.password="$NAC_KEYSTORE_PASSWORD" \
  ./gradlew --quiet assembleRelease -PreactNativeArchitectures="${NAC_ARCHS:-arm64-v8a}")

apk="android/app/build/outputs/apk/release/app-release.apk"
build_tools="$(ls -d "${ANDROID_HOME:-$HOME/Android/Sdk}"/build-tools/[0-9]*.[0-9]*.[0-9] | sort -V | tail -1)"
certs="$("$build_tools/apksigner" verify --print-certs "$apk")"
if grep -q "CN=Android Debug" <<<"$certs"; then
  echo "APK is signed with the debug key" >&2
  exit 1
fi
actual_cert="$(sed -n 's/^Signer #1 certificate SHA-256 digest: //p' <<<"$certs")"
if [[ "$actual_cert" != "$expected_cert" ]]; then
  echo "APK is signed with $actual_cert, the published releases with $expected_cert: installed apps could not update" >&2
  exit 1
fi
echo "$certs" | grep 'certificate DN'
sha256sum "$apk"
