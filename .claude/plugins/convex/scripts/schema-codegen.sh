#!/bin/bash

# Run Convex codegen after schema changes
# Usage: ./schema-codegen.sh

echo "🔄 Running Convex codegen..."

if [ -f "package.json" ] && grep -q "\"convex\":" package.json; then
  npx convex codegen --dev
  echo "✅ Convex codegen complete"
else
  echo "⚠️  Not a Convex project (no convex dependency found)"
fi

exit 0
