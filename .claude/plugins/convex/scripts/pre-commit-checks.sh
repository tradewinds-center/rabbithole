#!/bin/bash

# Pre-commit checks for Convex functions
# Usage: ./pre-commit-checks.sh

echo "🔍 Running pre-commit checks for Convex..."

# Check if convex directory exists
if [ ! -d "convex" ]; then
  echo "✅ No convex directory, skipping checks"
  exit 0
fi

# Run ESLint on Convex functions if ESLint is configured
if [ -f ".eslintrc.json" ] || [ -f ".eslintrc.js" ] || [ -f "eslint.config.js" ]; then
  echo "📝 Running ESLint on Convex functions..."
  npx eslint convex/ --quiet
  if [ $? -ne 0 ]; then
    echo "❌ ESLint found issues in Convex functions"
    exit 1
  fi
  echo "✅ ESLint passed"
fi

# Run TypeScript type checking if tsconfig exists
if [ -f "tsconfig.json" ]; then
  echo "🔎 Running TypeScript type check..."
  npx tsc --noEmit
  if [ $? -ne 0 ]; then
    echo "❌ TypeScript type check failed"
    exit 1
  fi
  echo "✅ Type check passed"
fi

# Check for common issues
echo "🔍 Checking for common Convex issues..."

# Check for Date.now() in query functions
DATE_NOW_IN_QUERIES=$(grep -r "Date\.now()" convex/ --include="*.ts" --include="*.js" | grep -B 5 "query({" | grep "Date\.now()")
if [ -n "$DATE_NOW_IN_QUERIES" ]; then
  echo "⚠️  Warning: Found Date.now() near query functions. This may break reactivity."
  echo "$DATE_NOW_IN_QUERIES"
fi

# Check for .filter() on queries
FILTER_ON_QUERIES=$(grep -r "\.query(.*)\s*\.filter(" convex/ --include="*.ts" --include="*.js")
if [ -n "$FILTER_ON_QUERIES" ]; then
  echo "⚠️  Warning: Found .filter() on database queries. Consider using .withIndex() instead."
  echo "$FILTER_ON_QUERIES"
fi

echo "✅ Pre-commit checks complete"
exit 0
