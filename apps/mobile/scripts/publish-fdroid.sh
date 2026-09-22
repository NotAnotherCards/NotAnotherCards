#!/usr/bin/env bash
# Adds the release APK to the F-Droid repository and uploads it. See issue #366.
# Run build-release.sh first. Needs fdroidserver (pipx install fdroidserver)
# and the repository checkout with its keystore, kept outside this repo.
#
#   NAC_FDROID_DIR   fdroid repository (default ~/.local/share/nac-fdroid)
#   NAC_FDROID_HOST  rsync target (default Hel:nac-fdroid/repo/)
set -euo pipefail

cd "$(dirname "$0")/.."
apk="android/app/build/outputs/apk/release/app-release.apk"
fdroid_dir="${NAC_FDROID_DIR:-$HOME/.local/share/nac-fdroid}"
target="${NAC_FDROID_HOST:-Hel:nac-fdroid/repo/}"

package="$(node -p 'require("./app.json").expo.android.package')"
version_code="$(sed -n 's/^\s*versionCode \([0-9]*\).*/\1/p' android/app/build.gradle)"
cp "$apk" "$fdroid_dir/repo/${package}_${version_code}.apk"

(cd "$fdroid_dir" && fdroid update)
rsync -az --delete "$fdroid_dir/repo/" "$target"
echo "published ${package}_${version_code}.apk"
