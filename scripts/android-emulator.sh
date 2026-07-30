#!/usr/bin/env bash
#
# Set up the Android SDK and start an emulator on a 42 school computer.
#
# Everything lands in /goinfre (fast local disk, survives neither wipes nor
# machine changes) - just re-run this script after a wipe; downloads are
# cached in /sgoinfre so re-provisioning skips the big fetches.
#
# Usage:
#   ./scripts/android-emulator.sh            # set up if needed, then start
#   ./scripts/android-emulator.sh --setup    # set up only, don't start
#   ./scripts/android-emulator.sh --headless # start without a window (CI/tests)
#
# Overridable via environment:
#   AVD_NAME (default pixel8), API_LEVEL (default 35)

set -euo pipefail

SDK_ROOT="${ANDROID_HOME:-/goinfre/$USER/android-sdk}"
CACHE_DIR="/sgoinfre/goinfre/Perso/$USER/android-cache"
AVD_NAME="${AVD_NAME:-pixel8}"
API_LEVEL="${API_LEVEL:-35}"
SYSTEM_IMAGE="system-images;android-${API_LEVEL};google_apis;x86_64"
CMDLINE_TOOLS_VERSION="11076708"
CMDLINE_TOOLS_ZIP="commandlinetools-linux-${CMDLINE_TOOLS_VERSION}_latest.zip"

SETUP_ONLY=false
HEADLESS=false
for arg in "$@"; do
  case "$arg" in
    --setup) SETUP_ONLY=true ;;
    --headless) HEADLESS=true ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done

log() { printf '\033[1;34m[emulator]\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m[emulator]\033[0m %s\n' "$*" >&2; exit 1; }

# ---------- preflight ----------

command -v java >/dev/null || die "java not found - the SDK tools need Java 17+"
command -v curl >/dev/null || die "curl not found"
command -v unzip >/dev/null || die "unzip not found"

if [ -r /dev/kvm ] && [ -w /dev/kvm ]; then
  ACCEL_ARGS=()
else
  log "WARNING: no access to /dev/kvm - emulator will run WITHOUT hardware"
  log "acceleration and be very slow. Ask staff about the kvm group."
  ACCEL_ARGS=(-accel off)
fi

export ANDROID_HOME="$SDK_ROOT"
export ANDROID_SDK_ROOT="$SDK_ROOT"
# Keep AVDs on the same fast disk as the SDK, not in the quota'd home.
export ANDROID_AVD_HOME="$SDK_ROOT/avd"
export PATH="$SDK_ROOT/cmdline-tools/latest/bin:$SDK_ROOT/platform-tools:$SDK_ROOT/emulator:$PATH"

# ---------- sdk ----------

if [ ! -x "$SDK_ROOT/cmdline-tools/latest/bin/sdkmanager" ]; then
  log "installing Android command-line tools into $SDK_ROOT"
  mkdir -p "$SDK_ROOT" "$CACHE_DIR"
  if [ ! -f "$CACHE_DIR/$CMDLINE_TOOLS_ZIP" ]; then
    log "downloading $CMDLINE_TOOLS_ZIP (cached in $CACHE_DIR for next time)"
    curl -fL --progress-bar -o "$CACHE_DIR/$CMDLINE_TOOLS_ZIP.tmp" \
      "https://dl.google.com/android/repository/$CMDLINE_TOOLS_ZIP"
    mv "$CACHE_DIR/$CMDLINE_TOOLS_ZIP.tmp" "$CACHE_DIR/$CMDLINE_TOOLS_ZIP"
  fi
  unzip -q -o "$CACHE_DIR/$CMDLINE_TOOLS_ZIP" -d "$SDK_ROOT/cmdline-tools-tmp"
  mkdir -p "$SDK_ROOT/cmdline-tools"
  rm -rf "$SDK_ROOT/cmdline-tools/latest"
  mv "$SDK_ROOT/cmdline-tools-tmp/cmdline-tools" "$SDK_ROOT/cmdline-tools/latest"
  rm -rf "$SDK_ROOT/cmdline-tools-tmp"
fi

if [ ! -x "$SDK_ROOT/emulator/emulator" ] || [ ! -d "$SDK_ROOT/system-images/android-${API_LEVEL}" ]; then
  log "installing platform-tools, emulator and the android-${API_LEVEL} system image"
  log "(the system image is ~1.5 GB - first run takes a few minutes)"
  # pipefail would turn yes's harmless SIGPIPE (141) into a script abort;
  # sdkmanager's own failures still stop the script via set -e.
  set +o pipefail
  yes | sdkmanager --licenses >/dev/null
  set -o pipefail
  sdkmanager "platform-tools" "emulator" "platforms;android-${API_LEVEL}" "$SYSTEM_IMAGE"
fi

# ---------- avd ----------

if ! avdmanager list avd -c | grep -qx "$AVD_NAME"; then
  # The bundled device list varies by cmdline-tools version - take the first
  # profile that exists. Override with DEVICE_PROFILE=... if you care.
  if [ -z "${DEVICE_PROFILE:-}" ]; then
    AVAILABLE_DEVICES="$(avdmanager list device -c)"
    for candidate in pixel_8 pixel_7 pixel_6 medium_phone; do
      if grep -qx "$candidate" <<<"$AVAILABLE_DEVICES"; then
        DEVICE_PROFILE="$candidate"
        break
      fi
    done
    [ -n "${DEVICE_PROFILE:-}" ] || die "no known device profile found (avdmanager list device -c)"
  fi
  log "creating AVD '$AVD_NAME' ($DEVICE_PROFILE, API $API_LEVEL)"
  echo no | avdmanager create avd -n "$AVD_NAME" -d "$DEVICE_PROFILE" -k "$SYSTEM_IMAGE" >/dev/null
  # avdmanager defaults to hw.keyboard=no, which ignores the host keyboard.
  # Ask avdmanager where the AVD landed - it doesn't reliably honor
  # ANDROID_AVD_HOME and may create it under .android/avd instead.
  AVD_PATH="$(avdmanager list avd | awk -v n="$AVD_NAME" \
    '$1 == "Name:" { cur = $2 } $1 == "Path:" && cur == n { print $2; exit }')"
  if [ -n "$AVD_PATH" ] && [ -f "$AVD_PATH/config.ini" ]; then
    if grep -q '^hw\.keyboard' "$AVD_PATH/config.ini"; then
      sed -i 's/^hw\.keyboard = .*/hw.keyboard = yes/' "$AVD_PATH/config.ini"
    else
      echo "hw.keyboard = yes" >>"$AVD_PATH/config.ini"
    fi
  else
    log "WARNING: could not locate $AVD_NAME's config.ini - host keyboard stays disabled"
  fi
fi

# ---------- pnpm store ----------

# Keep pnpm's global package store on goinfre too - it grows to ~1 GB and
# eats the home quota otherwise. Recreated on the next install after a wipe.
if command -v pnpm >/dev/null 2>&1; then
  if [ "$(pnpm config get store-dir 2>/dev/null)" != "/goinfre/$USER/pnpm-store" ]; then
    log "pointing pnpm's global store at /goinfre/$USER/pnpm-store"
    pnpm config set --global store-dir "/goinfre/$USER/pnpm-store" \
      || log "WARNING: could not set pnpm store-dir - run: pnpm config set --global store-dir /goinfre/\$USER/pnpm-store"
  fi
fi

# ---------- env file ----------

ENV_FILE="$SDK_ROOT/env.sh"
cat > "$ENV_FILE" <<EOF
export ANDROID_HOME="$SDK_ROOT"
export ANDROID_SDK_ROOT="$SDK_ROOT"
export ANDROID_AVD_HOME="$SDK_ROOT/avd"
export PATH="\$ANDROID_HOME/cmdline-tools/latest/bin:\$ANDROID_HOME/platform-tools:\$ANDROID_HOME/emulator:\$PATH"
EOF
log "setup complete. For adb/emulator in your own shell:  source $ENV_FILE"

if $SETUP_ONLY; then
  exit 0
fi

# ---------- start ----------

if adb devices 2>/dev/null | grep -q '^emulator-.*device$'; then
  log "an emulator is already running:"
  adb devices | grep '^emulator-'
  exit 0
fi

WINDOW_ARGS=()
if $HEADLESS; then
  WINDOW_ARGS=(-no-window -no-audio)
fi

log "starting emulator '$AVD_NAME' (first boot takes a minute or two)"
emulator -avd "$AVD_NAME" -gpu auto -no-snapshot-save \
  "${ACCEL_ARGS[@]}" "${WINDOW_ARGS[@]}" &
EMULATOR_PID=$!

log "waiting for the device to boot..."
adb wait-for-device
until [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do
  kill -0 "$EMULATOR_PID" 2>/dev/null || die "emulator exited during boot"
  sleep 2
done

log "emulator is up:"
adb devices | grep '^emulator-'
log "next: cd apps/mobile && npx expo run:android (see docs/mobile.md)"
