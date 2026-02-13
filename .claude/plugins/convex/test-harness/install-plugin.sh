#!/bin/bash

# Install Convex plugin for testing in Claude Code

set -e

PLUGIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLAUDE_PLUGINS_DIR="$HOME/.claude/plugins"
INSTALL_DIR="$CLAUDE_PLUGINS_DIR/convex"

echo "🔧 Installing Convex plugin for Claude Code..."

# Create plugins directory if it doesn't exist
mkdir -p "$CLAUDE_PLUGINS_DIR"

# Remove existing installation
if [ -L "$INSTALL_DIR" ] || [ -d "$INSTALL_DIR" ]; then
  echo "📦 Removing existing installation..."
  rm -rf "$INSTALL_DIR"
fi

# Create symlink (easier for development)
echo "🔗 Creating symlink to plugin..."
ln -s "$PLUGIN_DIR" "$INSTALL_DIR"

# Verify installation
if [ ! -f "$INSTALL_DIR/.cursor/plugin.json" ]; then
  echo "❌ Installation failed: plugin.json not found"
  exit 1
fi

echo "✅ Plugin installed successfully!"
echo ""
echo "📍 Installed at: $INSTALL_DIR"
echo "🔍 Verify with: ls -la $INSTALL_DIR/.cursor/plugin.json"
echo ""
echo "🚀 Next steps:"
echo "  1. cd /tmp/convex-plugin-test"
echo "  2. claude"
echo "  3. Try: 'I'm building a new task app with React'"
echo ""
echo "📝 Run tests: ./test-harness/run-tests.sh"
