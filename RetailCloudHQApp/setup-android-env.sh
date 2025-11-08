#!/bin/bash

# Android Environment Setup Script
# Run this script to set up Android development environment

echo "🔧 Setting up Android development environment..."

# Find Android SDK location
if [ -d "$HOME/Library/Android/sdk" ]; then
    ANDROID_SDK="$HOME/Library/Android/sdk"
elif [ -d "/Applications/Android Studio.app/Contents" ]; then
    # Try to find SDK in Android Studio
    ANDROID_SDK="$HOME/Library/Android/sdk"
else
    echo "⚠️  Android SDK not found in default location"
    echo "Please open Android Studio → SDK Manager and note the SDK Location"
    read -p "Enter Android SDK path: " ANDROID_SDK
fi

# Check if SDK exists
if [ ! -d "$ANDROID_SDK" ]; then
    echo "❌ Android SDK not found at: $ANDROID_SDK"
    echo "Please install Android SDK through Android Studio first"
    exit 1
fi

echo "✅ Found Android SDK at: $ANDROID_SDK"

# Add to shell profile
SHELL_PROFILE=""
if [ -f "$HOME/.zshrc" ]; then
    SHELL_PROFILE="$HOME/.zshrc"
elif [ -f "$HOME/.bash_profile" ]; then
    SHELL_PROFILE="$HOME/.bash_profile"
else
    SHELL_PROFILE="$HOME/.zshrc"
    touch "$SHELL_PROFILE"
fi

echo "📝 Adding to: $SHELL_PROFILE"

# Check if already configured
if grep -q "ANDROID_HOME" "$SHELL_PROFILE"; then
    echo "⚠️  Android environment already configured in $SHELL_PROFILE"
    read -p "Update existing configuration? (y/n): " update
    if [ "$update" != "y" ]; then
        echo "Skipping configuration update"
        exit 0
    fi
    # Remove old configuration
    sed -i.bak '/ANDROID_HOME/d' "$SHELL_PROFILE"
    sed -i.bak '/Android SDK/d' "$SHELL_PROFILE"
fi

# Add configuration
cat >> "$SHELL_PROFILE" << EOF

# Android SDK Configuration
export ANDROID_HOME="$ANDROID_SDK"
export PATH=\$PATH:\$ANDROID_HOME/emulator
export PATH=\$PATH:\$ANDROID_HOME/platform-tools
export PATH=\$PATH:\$ANDROID_HOME/tools
export PATH=\$PATH:\$ANDROID_HOME/tools/bin

# Java Home (if not set)
if [ -z "\$JAVA_HOME" ]; then
    export JAVA_HOME=\$(/usr/libexec/java_home 2>/dev/null)
fi
EOF

echo "✅ Configuration added to $SHELL_PROFILE"
echo ""
echo "📋 Next steps:"
echo "1. Reload your shell: source $SHELL_PROFILE"
echo "2. Or restart your terminal"
echo "3. Verify: echo \$ANDROID_HOME"
echo "4. Verify: adb version"
echo ""
echo "Then run: cd android/app && keytool -genkey -v -keystore debug.keystore -storepass android -alias androiddebugkey -keypass android -keyalg RSA -keysize 2048 -validity 10000 -dname \"CN=Android Debug,O=Android,C=US\""

