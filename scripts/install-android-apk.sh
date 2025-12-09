#!/bin/bash

# Install Android APK Script
# This script builds and installs the APK on a connected Android device

set -e  # Exit on error

echo "📱 Building and installing Android APK..."

# Navigate to project root
cd "$(dirname "$0")/.."

# Check if adb is available
if ! command -v adb &> /dev/null; then
    echo "❌ Error: adb (Android Debug Bridge) is not installed or not in PATH"
    echo "   Please install Android SDK Platform Tools"
    exit 1
fi

# Check if device is connected
DEVICES=$(adb devices | grep -v "List" | grep "device" | wc -l)
if [ "$DEVICES" -eq 0 ]; then
    echo "❌ Error: No Android device connected"
    echo "   Please connect a device via USB and enable USB debugging"
    exit 1
fi

echo "✅ Found $DEVICES connected device(s)"

# Build release APK
echo "🔨 Building release APK..."
cd android
./gradlew assembleRelease

# Find the APK file
APK_PATH=$(find app/build/outputs/apk/release -name "*.apk" | head -1)

if [ -z "$APK_PATH" ]; then
    echo "❌ Error: APK not found!"
    exit 1
fi

echo "📦 Installing APK on device..."
adb install -r "$APK_PATH"

echo "✅ APK installed successfully!"
echo "📱 APK location: $APK_PATH"

cd ..

