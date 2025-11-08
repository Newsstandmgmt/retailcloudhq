#!/bin/bash
# Fix "too many open files" error for Metro bundler

echo "🔧 Fixing file watcher limit..."

# Check current limit
CURRENT_LIMIT=$(ulimit -n)
echo "Current limit: $CURRENT_LIMIT"

# Increase limit for current session
ulimit -n 4096
echo "✅ Increased to 4096 for this session"

# Make permanent (add to ~/.zshrc)
if ! grep -q "ulimit -n 4096" ~/.zshrc 2>/dev/null; then
    echo "" >> ~/.zshrc
    echo "# Increase file watcher limit for React Native" >> ~/.zshrc
    echo "ulimit -n 4096" >> ~/.zshrc
    echo "✅ Added to ~/.zshrc (will apply after restart)"
fi

echo ""
echo "📝 To apply immediately, run: source ~/.zshrc"
echo "   Or restart your terminal"
