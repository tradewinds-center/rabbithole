#!/usr/bin/env bash
# Wipe all Convex tables and re-seed.
# Usage:  npm run db:reset          (dev)
#         npm run db:reset:prod     (production — be careful!)
set -euo pipefail

FLAG="${1:-}"

TABLES=(
  analyses observations masteryObservations teacherMasteryOverrides
  seeds sessionSignals crossDomainConnections
  standardsDocuments standards
  focusSettings processState artifacts messages projects
  personas perspectives units processes users scholarDossiers
)

echo "=== Wiping ${#TABLES[@]} tables ${FLAG:+(${FLAG})} ==="
for table in "${TABLES[@]}"; do
  printf "  %-20s" "$table"
  npx convex import --table "$table" --replace --format jsonLines -y $FLAG /dev/null 2>&1 | tail -1
done

echo ""
echo "=== Re-seeding ==="
npx convex run seed:seedAll $FLAG

echo ""
echo "=== Importing Common Core Standards ==="
npx convex run standardsImport:importCommonCoreMath $FLAG
npx convex run standardsImport:importCommonCoreELA $FLAG

echo ""
echo "Done. All tables wiped, re-seeded, and standards imported."
