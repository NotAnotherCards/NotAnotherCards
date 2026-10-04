# Android dev build in two steps, so the memory-heavy Gradle build never
# runs next to the emulator (docs/mobile.md):
#
#   make build   # build the debug APK; no emulator needed or started
#   make start   # boot the emulator, install the APK, start Metro
#
# Day to day only `make start` is needed; rebuild when a native dependency
# changes.

ROOT := $(abspath ../..)
ANDROID_HOME ?= /goinfre/$(USER)/android-sdk
export ANDROID_HOME
export ANDROID_SDK_ROOT := $(ANDROID_HOME)
export PATH := $(ANDROID_HOME)/platform-tools:$(ANDROID_HOME)/emulator:$(PATH)

# x86_64 is the emulator's ABI; use arm64-v8a for a phone.
ABI ?= x86_64
APK := android/app/build/outputs/apk/debug/app-debug.apk
# The backend when neither the environment nor .env.local names one.
API_URL ?= https://app.notanothercards.com

.PHONY: build start packages api-url emulator install stop clean

build: $(ROOT)/node_modules/.modules.yaml $(ANDROID_HOME)/env.sh
	npx expo prebuild --platform android
	cd android && ./gradlew assembleDebug -PreactNativeArchitectures=$(ABI)
	cd android && ./gradlew --stop

start: packages api-url install
	npx expo start --dev-client --android

# Metro reads the workspace packages from their dist/, which tsc writes.
packages: $(ROOT)/node_modules/.modules.yaml
	cd $(ROOT) && pnpm --filter "mobile^..." build

# Metro inlines EXPO_PUBLIC_API_URL when it starts, so it is settled first.
api-url:
	@if [ -n "$$EXPO_PUBLIC_API_URL" ]; then \
		echo "backend: $$EXPO_PUBLIC_API_URL (from the environment)"; \
	elif grep -qs '^EXPO_PUBLIC_API_URL=.' .env.local; then \
		echo "backend: $$(sed -n 's/^EXPO_PUBLIC_API_URL=//p' .env.local) (from .env.local)"; \
	else \
		echo 'EXPO_PUBLIC_API_URL=$(API_URL)' >> .env.local; \
		echo "backend: $(API_URL) (none was set; written to .env.local)"; \
	fi

# Expo opens the app on the first device adb lists, usable or not.
emulator:
	@if adb devices | grep -Eq 'no permissions|unauthorized'; then \
		echo "adb lists a device it cannot use; unplug or authorize it first:"; \
		adb devices | grep -E 'no permissions|unauthorized'; exit 1; \
	fi
	@adb devices | grep -q 'device$$' || $(ROOT)/scripts/android-emulator.sh

install: emulator
	@test -f $(APK) || { echo "no APK yet: run 'make build' first"; exit 1; }
	adb -s $$(adb devices | awk '$$2 == "device" { print $$1; exit }') install -r $(APK)

stop:
	-adb emu kill
	-cd android && ./gradlew --stop

clean:
	rm -rf android

$(ROOT)/node_modules/.modules.yaml:
	cd $(ROOT) && pnpm install

$(ANDROID_HOME)/env.sh:
	$(ROOT)/scripts/android-emulator.sh --setup
