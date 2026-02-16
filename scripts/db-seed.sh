#!/usr/bin/env bash
# Seed data and import standards (non-destructive — does NOT wipe tables).
# Usage:  pnpm db:seed          (dev)
#         pnpm db:seed:prod     (production)
set -euo pipefail

FLAG="${1:-}"

echo "=== Seeding test data ${FLAG:+(${FLAG})} ==="
npx convex run seed:seedAll $FLAG

echo ""
echo "=== Importing Common Core Standards ==="
npx convex run standardsImport:importCommonCoreMath $FLAG
npx convex run standardsImport:importCommonCoreELA $FLAG

echo ""
echo "Done. Seed data and standards imported."
