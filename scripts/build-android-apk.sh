#!/bin/bash

# Build Android APK Script
# This script builds a release APK for Android

set -e  # Exit on error

echo "🔨 Building Android APK..."

# Navigate to project root
cd "$(dirname "$0")/.."

# Clean previous builds
echo "🧹 Cleaning previous builds..."
cd android
./gradlew clean

# Build release APK
echo "📦 Building release APK..."
./gradlew assembleRelease

# Find the APK file
APK_PATH=$(find app/build/outputs/apk/release -name "*.apk" | head -1)

if [ -z "$APK_PATH" ]; then
    echo "❌ Error: APK not found!"
    exit 1
fi

echo "✅ APK built successfully!"
echo "📱 APK location: $APK_PATH"
echo ""
echo "To install on connected device:"
echo "  adb install -r $APK_PATH"
echo ""
echo "To install on device manually, copy the APK to your device and install it."

cd ..

