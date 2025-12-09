#!/bin/bash

# Build Android App Bundle (AAB) Script
# This script builds a release AAB for Google Play Store

set -e  # Exit on error

echo "🔨 Building Android App Bundle (AAB)..."

# Navigate to project root
cd "$(dirname "$0")/.."

# Clean previous builds
echo "🧹 Cleaning previous builds..."
cd android
./gradlew clean

# Build release AAB
echo "📦 Building release AAB..."
./gradlew bundleRelease

# Find the AAB file
AAB_PATH=$(find app/build/outputs/bundle/release -name "*.aab" | head -1)

if [ -z "$AAB_PATH" ]; then
    echo "❌ Error: AAB not found!"
    exit 1
fi

echo "✅ AAB built successfully!"
echo "📱 AAB location: $AAB_PATH"
echo ""
echo "Upload this AAB to Google Play Console for distribution."

cd ..

