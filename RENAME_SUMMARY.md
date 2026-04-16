# Seed.ts → SeedData.ts Rename Summary

**Date:** April 15, 2026

**Issue:** Two similarly-named files caused confusion:
- `convex/seed.ts` - Database initialization/seeding (1000+ lines)
- `convex/seeds.ts` - Seeds feature module (exploration suggestions) (200+ lines)

**Solution:** Renamed `seed.ts` → `seedData.ts` for clarity

---

## Files Changed

### Core Files
- ✅ `convex/seed.ts` → `convex/seedData.ts` (renamed)

### Scripts Updated
- ✅ `scripts/db-seed.sh` - Updated `seed:seedAll` → `seedData:seedAll`
- ✅ `scripts/db-reset.sh` - Updated `seed:seedAll` → `seedData:seedAll`
- ✅ `scripts/seed-video-units.js` - Updated `seed:seedVideoReflection` and `seed:seedVideoUnits` → `seedData:*`

### Documentation Updated
- ✅ `README.md` - Updated file listing
- ✅ `CLAUDE.md` - Updated convex backend table
- ✅ `HOUSEKEEPING_PLAN.md` - Marked issue #4 as completed

### Internal Documentation Updated
All JSDoc comments in `seedData.ts` itself:
- ✅ `seedUnitsAndTopics` - `seed:seedUnitsAndTopics` → `seedData:seedUnitsAndTopics`
- ✅ `seedProcesses` - `seed:seedProcesses` → `seedData:seedProcesses`
- ✅ `seedWeekendNews` - `seed:seedWeekendNews` → `seedData:seedWeekendNews`
- ✅ `seedDemocracy` - `seed:seedDemocracy` → `seedData:seedDemocracy`
- ✅ `seedVideoReflection` - `seed:seedVideoReflection` → `seedData:seedVideoReflection`
- ✅ `seedPCMProcesses` - `seed:seedPCMProcesses` → `seedData:seedPCMProcesses`

---

## Commands to Run Seed Functions

**Development:**
```bash
# Full seed (data + standards)
pnpm db:seed

# Wipe and re-seed
pnpm db:reset

# Individual seed functions
npx convex run seedData:seedAll
npx convex run seedData:seedUnitsAndTopics
npx convex run seedData:seedProcesses
npx convex run seedData:seedWeekendNews
npx convex run seedData:seedDemocracy
npx convex run seedData:seedVideoReflection
npx convex run seedData:seedPCMProcesses
```

**Production:**
```bash
# Full seed (data + standards)
pnpm db:seed:prod

# Wipe and re-seed
pnpm db:reset:prod

# Individual seed functions
npx convex run seedData:seedAll --prod
```

---

## Verification

✅ All type checks pass:
```bash
npx tsc --noEmit --project convex/tsconfig.json  # No errors
```

✅ Files verified:
```bash
ls -la convex/seed*.ts
# -rw-r--r--  1 andys  staff  180605 Apr 15 22:33 convex/seedData.ts
# -rw-r--r--  1 andys  staff    4967 Mar  1 00:20 convex/seeds.ts
```

✅ No remaining references to `seed:seed*` pattern found in codebase

---

## Impact

- **Breaking Change:** None - Convex functions are namespaced by filename, so all `seed:*` calls now become `seedData:*`
- **Migration:** Scripts and documentation already updated - no manual steps needed
- **Next Deployment:** When Andy next runs `npx convex dev` or `npx convex deploy`, the renamed file will be picked up automatically
