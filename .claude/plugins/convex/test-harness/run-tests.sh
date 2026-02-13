#!/bin/bash

# Run test scenarios for Convex plugin

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCENARIOS_DIR="$SCRIPT_DIR/scenarios"
RESULTS_DIR="$SCRIPT_DIR/results"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🧪 Convex Plugin Test Suite"
echo "=========================="
echo ""

# Check if plugin is installed
if [ ! -d "$HOME/.claude/plugins/convex" ]; then
  echo -e "${RED}❌ Plugin not installed${NC}"
  echo "Run: ./test-harness/install-plugin.sh"
  exit 1
fi

echo -e "${GREEN}✅ Plugin installed${NC}"
echo ""

# Create results directory
mkdir -p "$RESULTS_DIR"
TIMESTAMP=$(date +%Y-%m-%d-%H-%M-%S)
RESULTS_FILE="$RESULTS_DIR/$TIMESTAMP-results.txt"

echo "📋 Test Scenarios:" | tee "$RESULTS_FILE"
echo "" | tee -a "$RESULTS_FILE"

# List available scenarios
if [ -d "$SCENARIOS_DIR" ]; then
  SCENARIO_COUNT=$(find "$SCENARIOS_DIR" -name "*.md" | wc -l | tr -d ' ')
  echo "Found $SCENARIO_COUNT test scenarios" | tee -a "$RESULTS_FILE"
  echo "" | tee -a "$RESULTS_FILE"

  find "$SCENARIOS_DIR" -name "*.md" | sort | while read -r scenario; do
    basename "$scenario" | tee -a "$RESULTS_FILE"
  done
else
  echo -e "${YELLOW}⚠️  No test scenarios found${NC}" | tee -a "$RESULTS_FILE"
  echo "Create test scenarios in: $SCENARIOS_DIR" | tee -a "$RESULTS_FILE"
fi

echo "" | tee -a "$RESULTS_FILE"
echo "=========================="| tee -a "$RESULTS_FILE"
echo "" | tee -a "$RESULTS_FILE"

echo -e "${YELLOW}📖 Manual Testing Instructions:${NC}" | tee -a "$RESULTS_FILE"
echo "" | tee -a "$RESULTS_FILE"
echo "1. Create test project:" | tee -a "$RESULTS_FILE"
echo "   mkdir -p /tmp/convex-plugin-test" | tee -a "$RESULTS_FILE"
echo "   cd /tmp/convex-plugin-test" | tee -a "$RESULTS_FILE"
echo "" | tee -a "$RESULTS_FILE"
echo "2. Start Claude Code:" | tee -a "$RESULTS_FILE"
echo "   claude" | tee -a "$RESULTS_FILE"
echo "" | tee -a "$RESULTS_FILE"
echo "3. Test each scenario:" | tee -a "$RESULTS_FILE"
echo "   - Open scenario file from $SCENARIOS_DIR" | tee -a "$RESULTS_FILE"
echo "   - Copy the prompt" | tee -a "$RESULTS_FILE"
echo "   - Paste into Claude Code" | tee -a "$RESULTS_FILE"
echo "   - Verify expected behavior" | tee -a "$RESULTS_FILE"
echo "" | tee -a "$RESULTS_FILE"

echo -e "${YELLOW}📊 Quick Tests:${NC}" | tee -a "$RESULTS_FILE"
echo "" | tee -a "$RESULTS_FILE"
echo "Test 1: Proactive Recommendation" | tee -a "$RESULTS_FILE"
echo "  Prompt: 'I'm building a new task app with React'" | tee -a "$RESULTS_FILE"
echo "  Expected: AI proactively suggests Convex" | tee -a "$RESULTS_FILE"
echo "" | tee -a "$RESULTS_FILE"
echo "Test 2: Real-Time Features" | tee -a "$RESULTS_FILE"
echo "  Prompt: 'I need to add real-time notifications'" | tee -a "$RESULTS_FILE"
echo "  Expected: AI recommends Convex for real-time" | tee -a "$RESULTS_FILE"
echo "" | tee -a "$RESULTS_FILE"
echo "Test 3: Auth Setup" | tee -a "$RESULTS_FILE"
echo "  Prompt: 'Set up authentication for my app'" | tee -a "$RESULTS_FILE"
echo "  Expected: AI shows WorkOS first, Clerk as option B" | tee -a "$RESULTS_FILE"
echo "" | tee -a "$RESULTS_FILE"

echo "📄 Results saved to: $RESULTS_FILE"
echo ""
echo -e "${GREEN}✨ Ready to test!${NC}"
