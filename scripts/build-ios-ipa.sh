#!/bin/bash

# Build iOS IPA Script
# This script builds an IPA file for iOS distribution
# Note: Requires Xcode, valid provisioning profile, and signing certificates

set -e  # Exit on error

echo "🔨 Building iOS IPA..."

# Navigate to project root
cd "$(dirname "$0")/.."

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "❌ Error: iOS builds can only be done on macOS"
    exit 1
fi

# Check if Xcode is installed
if ! command -v xcodebuild &> /dev/null; then
    echo "❌ Error: Xcode is not installed or xcodebuild is not in PATH"
    exit 1
fi

# Install pods if needed
echo "📦 Installing CocoaPods dependencies..."
cd ios
if [ ! -d "Pods" ]; then
    pod install
else
    pod install --repo-update
fi

# Clean previous builds
echo "🧹 Cleaning previous builds..."
xcodebuild clean -workspace colabclient.xcworkspace -scheme colabclient

# Build archive
echo "📦 Building archive..."
xcodebuild archive \
    -workspace colabclient.xcworkspace \
    -scheme colabclient \
    -configuration Release \
    -archivePath build/colabclient.xcarchive \
    CODE_SIGN_IDENTITY="" \
    CODE_SIGNING_REQUIRED=NO \
    CODE_SIGNING_ALLOWED=NO

# Export IPA
echo "📱 Exporting IPA..."
# Note: You may need to adjust the export options plist based on your distribution method
# For Ad Hoc distribution, use ExportOptionsAdHoc.plist
# For App Store, use ExportOptionsAppStore.plist
# For Enterprise, use ExportOptionsEnterprise.plist

# Create export options plist if it doesn't exist
EXPORT_OPTIONS_PLIST="build/ExportOptions.plist"
if [ ! -f "$EXPORT_OPTIONS_PLIST" ]; then
    echo "⚠️  Warning: ExportOptions.plist not found. Creating default..."
    cat > "$EXPORT_OPTIONS_PLIST" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>development</string>
    <key>teamID</key>
    <string>YOUR_TEAM_ID</string>
    <key>compileBitcode</key>
    <false/>
    <key>uploadSymbols</key>
    <true/>
</dict>
</plist>
EOF
    echo "⚠️  Please update $EXPORT_OPTIONS_PLIST with your Team ID and distribution method"
fi

xcodebuild -exportArchive \
    -archivePath build/colabclient.xcarchive \
    -exportPath build/ipa \
    -exportOptionsPlist "$EXPORT_OPTIONS_PLIST"

# Find the IPA file
IPA_PATH=$(find build/ipa -name "*.ipa" | head -1)

if [ -z "$IPA_PATH" ]; then
    echo "❌ Error: IPA not found!"
    exit 1
fi

echo "✅ IPA built successfully!"
echo "📱 IPA location: $IPA_PATH"
echo ""
echo "Upload this IPA to App Store Connect or distribute via TestFlight/Ad Hoc."

cd ..

