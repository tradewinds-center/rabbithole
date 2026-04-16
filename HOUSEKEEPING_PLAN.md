# Makawulu Housekeeping Plan

Low-hanging fruit refactoring opportunities identified from codebase scan.
**Risk level: LOW** - No functional changes, just cleanup and organization.

---

## High Priority (Quick Wins)

### 1. Remove Duplicate Type Definition ✅

**File:** `components/ProjectInterface.tsx` (line 48)

**Issue:** `DimensionOption` interface is defined twice:
- Exported from `DimensionPicker.tsx` (line 7)
- Duplicated locally in `ProjectInterface.tsx` (line 48)

**Solution:** ✅ COMPLETED
- ✅ Removed local interface definition from ProjectInterface.tsx
- ✅ Added import: `import { DimensionOption } from "./DimensionPicker"`
- ✅ All 4 usages now reference the imported type
- ✅ Type checks pass

**Benefit:** Single source of truth, prevents type drift

---

### 2. Extract Repeated Dialog Configuration ✅

**Issue:** Dialog.Content props repeated in 5+ files:
- SetPasswordDialog.tsx
- ParentAccessDialog.tsx
- ProfileEditModal.tsx
- UnitPickerDialog.tsx
- TimeLimitModal.tsx

**Solution:** ✅ COMPLETED
- ✅ Created `components/ui/StyledDialogContent.tsx` wrapper component
- ✅ Updated 7 dialog components (found more than expected):
  - SetPasswordDialog.tsx
  - ParentAccessDialog.tsx
  - ProfileEditModal.tsx
  - UnitPickerDialog.tsx
  - ScholarProfile.tsx (2 dialogs)
  - app/teacher/TeacherDashboard.tsx (2 dialogs)
- ✅ Type checks pass
- ℹ️ TimeLimitModal not updated (uses custom Box-based modal, not Dialog.Content)

**Benefit:** Consistent dialog styling, easier to update globally

---

### 3. Create Role Constants ✅

**Issue:** String literals `"scholar"`, `"teacher"`, `"admin"` appear 98+ times across convex files

**Solution:** ✅ COMPLETED
- ✅ Created `convex/lib/roles.ts` with ROLES constant and Role type
- ✅ Replaced 98+ string literals in 30+ convex files including:
  - schema.ts, lib/auth.ts, users.ts, projects.ts
  - focus.ts, tokens.ts, masteryObservations.ts
  - perspectives.ts, personas.ts, scholars.ts, units.ts
  - reports.ts, dossier.ts, crossDomainConnections.ts
  - artifacts.ts, seeds.ts, observations.ts, messages.ts
  - standardsTree.ts, processes.ts, sessionSignals.ts
  - http.ts, curriculumAssistant.ts, seedData.ts, auth.ts
- ✅ Type checks pass
- ℹ️ Remaining string literals are for data fields (intentional)

**Benefit:** Typo-proof, easier refactoring, better autocomplete

---

### 4. Clarify Naming: `seed.ts` vs `seeds.ts` ✅

**Issue:** Two similarly-named files with different purposes:
- `convex/seed.ts` - Database initialization/seeding (1000+ lines)
- `convex/seeds.ts` - Seeds feature (exploration suggestions) (200+ lines)

**Solution:** ✅ COMPLETED
- ✅ Renamed `seed.ts` → `seedData.ts`
- ✅ Updated all script references (db-seed.sh, db-reset.sh, seed-video-units.js)
- ✅ Updated documentation (README.md, CLAUDE.md)
- ✅ Updated all command comments in seedData.ts itself
- ✅ Kept `seeds.ts` as-is

---

## Medium Priority (DRY Improvements)

### 5. Extract Common CSS Patterns (Via Chakra Theming)

**Issue:** Repeated Chakra UI style patterns across components

**Examples:**
- `borderRadius="full"` - 35+ occurrences (Avatar, Badge, etc.)
- `color="charcoal.500"` - many files
- Menu item CSS patterns duplicated
- Dialog.Content props repeated (see #2)

**Idiomatic Chakra v3 Approach:** Use theme recipes to set component defaults

**Fix:** Update `lib/theme.ts` to add component recipes with default props:

```typescript
const config = defineConfig({
  theme: {
    // ... existing tokens, semanticTokens ...

    recipes: {
      // Set defaults for simple components
      avatar: {
        base: {
          borderRadius: "full",
        },
      },
      badge: {
        base: {
          borderRadius: "full",
        },
      },
    },

    slotRecipes: {
      // Customize dialog defaults
      dialog: {
        base: {
          content: {
            borderRadius: "xl",
            maxW: "sm",
            mx: 4,
            overflow: "hidden",
          },
        },
      },

      // Customize menu item styles (from memory notes about Menu.Content bg)
      menu: {
        base: {
          item: {
            color: "charcoal.500",
            fontFamily: "heading",
            "&[data-highlighted]": {
              bg: "gray.100",
            },
          },
        },
      },
    },
  },
  globalCss: {
    // ... existing global styles ...
  },
});
```

**Benefit:**
- Eliminates need for repeated inline props
- Changes propagate automatically to all instances
- Still allows per-instance overrides when needed
- More maintainable than importing style constants

**Note:** After implementing theme defaults:
- Remove repeated `borderRadius="full"` props (35+ locations)
- Simplify Dialog.Content usage throughout (complements #2)
- May still need style constants for one-off shared patterns not suitable for theming

---

### 6. Component Index Exports

**Issue:** Only 7 components exported from `components/index.ts`, but 33 .tsx files exist

**Currently exported:** ProjectInterface, ProjectHeader, ProjectViewer, ScholarProfile, EntityManager, ProcessPanel

**Not exported:** Avatar, AppHeader, AuthForm, CodeArtifactViewer, etc.

**Options:**

**Option A (full barrel export):**
```typescript
// Export all public components
export { Avatar } from "./Avatar";
export { AppHeader } from "./AppHeader";
export { AuthForm } from "./AuthForm";
// ... etc
```

**Option B (document intent):**
Add comment to `index.ts`:
```typescript
// Only primary feature components are exported here.
// UI components (Avatar, StatusOrb, etc.) should be imported directly.
```

**Recommendation:** Option A for consistency, or Option B to document current pattern

---

### 7. Remove Deprecated Field (If Ready)

**File:** `convex/schema.ts` (line 57-58)

**Issue:** Deprecated `status` field still in schema:
```typescript
// DEPRECATED — kept optional for migration, remove after running migrations:removeStatusField
status: v.optional(v.union(v.literal("green"), v.literal("yellow"), v.literal("red"))),
```

**Action needed:**
1. Verify if `removeStatusField` migration was run
2. If yes, remove these lines
3. If no, document deadline in CLAUDE.md

---

## Low Priority (Nice to Have)

### 8. Extract Common String Constants

**Pattern:** Other repeated string literals that could become constants:
- Model names (e.g., `"claude-sonnet-4-20250514"`)
- Default values
- Error messages

**Example:**
```typescript
// lib/constants.ts
export const MODELS = {
  CLAUDE_SONNET: "claude-sonnet-4-20250514",
} as const;

export const DEFAULT_READING_LEVEL = 5;
```

---

### 9. Wrapper Components for Common Patterns

**Pattern:** Create higher-level wrapper components for frequently-used combinations

**Examples:**
- StatusOrb container patterns
- Message bubble variants
- Card layouts

**Only pursue if:**
- Pattern appears 5+ times
- Abstraction is clear and not forced
- Reduces cognitive load

---

## Implementation Status

**✅ Phase 1 Complete (April 15, 2026):**
1. ✅ Fix #1 - Remove duplicate DimensionOption type
2. ✅ Fix #2 - Extract StyledDialogContent component (7 dialogs)
3. ✅ Fix #3 - Create role constants (30+ files, 98+ replacements)
4. ✅ Fix #4 - Rename seed.ts → seedData.ts

**🔜 Phase 2 (Future - Optional DRY improvements):**
5. Fix #5 - Add Chakra theme recipes for common patterns
6. Fix #6 - Complete or document component index exports

**🔜 Phase 3 (Future - Cleanup):**
7. Fix #7 - Remove deprecated status field (after verification)

**Total estimated time:** 4-6 hours for all high + medium priority items

---

## Not Issues (False Positives)

These files appeared potentially unused but are actually in use:
- ✅ `convex/youtubeActions.ts` - used in DimensionEditModal
- ✅ `convex/tokens.ts` - used in ParentAccessDialog and http.ts
- ✅ `convex/reports.ts` - used in ScholarProfile
- ✅ `convex/prompts.ts` - used in projectHelpers.ts

---

## Testing Strategy

After each fix:
1. Run `npx tsc --noEmit` to verify type safety
2. Run `npx tsc --noEmit --project convex/tsconfig.json` for Convex functions
3. Test affected pages in browser (if UI-related)
4. Check that no errors appear in Convex dashboard logs

**No functional behavior changes expected** - all fixes are refactoring only.
