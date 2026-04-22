# Rabbithole TODO

From Amber & Carl meeting — April 15, 2026

---

## Bugs

- [x] _P0_ **TTS broken in prod** — Network call returns data fine but audio never plays. Likely MediaSource streaming issue. WIP fix on `tts-playback` branch.
- [ ] _P1_ **Wherever possible, Cmd-clicking links should open things in new tabs**, as per standard browser behavior

## Scholar Experience

- [ ] _P3_ **Scholar avatars** — Kid wants an avatar. Add avatar selection or generation for scholars
- [x] ~~**Students shouldn't be able to change own Reading Level**~~ — `ea4f8e2` Locked to teacher-only; parent view shows read-only with disabled controls
- [ ] **Profile setup: name required** — Make display name required (photo + grade optional). Currently skippable, which leaves name = username and triggers ugly AI greeting. Also: don't auto-copy username into name field in `registerWithCode`.
- [ ] **Profile setup: DOB context** — Add helper text "Helps us match you to the right reading level" below the date-of-birth field.
- [ ] **Project card title truncation** — Auto-generated titles are too long. Generate a short phrase title server-side (4–6 words) instead of truncating the first message.
- [ ] **Sign-out flakiness** — Sidebar sign-out icon sometimes does nothing on first click; occasionally lands back on `/scholar` instead of `/sign-in`. Likely `signOut()` racing the router push. Trace and fix both entry points.

## AI Tutor Behavior (Prompt Tuning)

- [x] **Keep it concise** — Prompt was updated but still producing long multi-paragraph responses. Needs stronger enforcement — possibly max_tokens cap or more aggressive prompt wording.
- [x] **One question at a time** — Related to above. Still stacking multiple bolded questions in one response despite prompt update.
- [ ] **Loved the feedback comments** — (positive signal, keep this) Amber loved when the AI commented on how she was doing. Make sure this stays prominent
- [ ] **Silly mode guardrails** — Amber can be silly at times. Tune how the AI handles silly/off-task moments (gentle redirect vs. playing along briefly then refocusing)

## Teacher Dashboard

- [ ] **Password reset for scholars** — Amber forgets passwords. Teachers need a "reset password" button on their dashboard (no reset-password flow for kids)
- [ ] **Make unit/template association clearer** — Too hard to tell when a lesson is based on a given unit template. Surface this more visibly in the project list or header
- [ ] **Require unit title before saving** — Curriculum grid shows "New Unit" tiles that were never named. Block save/create until a title is entered.
- [ ] **Teacher whisper "takes effect next turn" label** — `ProjectViewer.tsx` whisper field says "Guidance injected into AI system prompt" but doesn't say when. Add helper text: "Takes effect on the scholar's next message."
- [ ] **Duplicate empty-state on teacher activity tab** — Left panel says "Click Start to begin an activity" and main panel says "Start an activity to begin." Remove one.

## Reading Level & Accessibility

- [ ] **Break down reading level granularly** — Instead of whole numbers, use 7.1–7.9 scale
- [ ] **Track audio vs visual preference** — Track % of time scholar clicks the speaker button. Surface this to teachers
- [x] ~~**Toggle: speech-to-text**~~ — `ea4f8e2` Per-scholar STT toggle on Reading & Audio tab
- [x] ~~**Toggle: text-to-speech**~~ — `ea4f8e2` Per-scholar TTS toggle on Reading & Audio tab
- [ ] **Password field helper text** — No hint that password must be ≥4 chars until after a failed submit. Add `helperText` below the field (Chakra `Field` pattern).
- [ ] **Flesch-Kincaid readability scoring** — Use [flesch-kincaid](https://github.com/words/flesch-kincaid?tab=readme-ov-file) to measure/target response reading level
- [ ] _P0_ **Font toggle: Andika / OpenDyslexic** — Accessibility font options in Account Details for scholars who need them. this should only impact their own view, not when teachers are remoting in

## Structured AI Responses

- [ ] **Introduce structured text formatting** — AI responses should use more structured text:
  - Questions in callout boxes
  - Numbered lists when sequential
  - Bullet lists for options/items
  - Tip boxes for hints/encouragement
  - Intentional bold usage for key terms

## New Artifact Types & Tools

- [ ] **Graphic organizer artifact** — Teachers can have kids create graphic organizers as a new artifact type (Carl shared a file example)
- [ ] **"Highlight the verbs" app** — Teacher-created interactive exercises: highlight all verbs, remove all adjectives, etc. New artifact/tool type
- [ ] **AI image generation from reference photos** — Generate images based on a series of reference photos (style transfer / composition)
- [ ] **"Describe this picture" similarity game** — Scholar describes a picture, AI generates from description, compare similarity to original
- [ ] **Labeling artifact** — Draw/display a picture, scholar labels elements ("piano, wall, garbage"). New artifact type

---

## Done (April 15, 2026)

- [x] **Engagement bar: color only** — `6cf99f7` Removed numeric score, replaced with discrete colored blocks and "Current Status" label
- [x] **Scrolling hides TTS button** — `866f7f2` TTS button now in a sticky side track column
- [x] **Redirect emotional questions** — `0da4b3f` Prompt updated: warm acknowledgment + redirect to trusted adult
- [x] **Stop saying "You're right"** — `0da4b3f` Prompt updated: build on thinking instead of hollow validation
- [x] **Keep it concise (prompt)** — `0da4b3f` Prompt updated, but not sufficient alone (moved back to open items)
- [x] **One question at a time (prompt)** — `0da4b3f` Prompt updated, but not sufficient alone (moved back to open items)

---

## Back Burner (from roadmap)

- [ ] Google Classroom Integration
- [ ] Kupuna/Parent Mode (read-only for grandparents/parents)
- [ ] Best Quote of the Day -> FB
- [ ] Teacher Supervision Enhancements
- [ ] Claude Agent SDK Migration
- [ ] Volume Control (mic level monitoring)
- [ ] Self-Serve Guest Mode
- [ ] Time Limit Mode
- [ ] Generate Images loading indicator (bug verification)

---

## Future Work — Scaling (from UX audit 2026-04-19)

- [ ] **Scholar scoping for teachers** — Currently any teacher sees every scholar in the system (Scholars tab + clicking into a profile). Fine for one-teacher school but becomes a privacy issue when onboarding more staff. Need a class/assignment model so teachers only see their own scholars (with explicit admin override).
- [ ] **ScholarProfile tab density** — 9 tabs (Activity / Mastery / Seeds / Standards / Strengths / Documents / Notes / Dossier / Reading & Audio) wrap oddly on smaller laptops. Consider super-tabs (e.g. "Now" / "Progress" / "Library") or prioritize by usage frequency.
- [ ] **Forced password-reset escape hatch** — `SetPasswordDialog` in forced mode has no Cancel / "Contact teacher" link. If a scholar hits it and forgot their temp PIN, they're stuck. Owned by teacher workflow.

---

## Housekeeping (carried over from old HOUSEKEEPING_PLAN.md)

Phase 1 cleanups (DimensionOption import, StyledDialogContent, role constants, seed.ts rename) are all done. These are the stragglers:

- [ ] **Chakra theme recipes for repeated style props** — `borderRadius="full"` (35+ occurrences), `color="charcoal.500"`, Menu item patterns all repeated inline. Move into `lib/theme.ts` component recipes. Lowers surface for brand tweaks. (Medium effort — touch a lot of files, easy to get wrong with Chakra v3's slot recipe merging quirks — see `MEMORY.md` notes.)
- [ ] **`components/index.ts` barrel exports** — Currently exports 6 of 33 components. Either export all public components or add a comment explaining the "primary feature only" convention.
- [ ] **Remove deprecated `projects.status` field** — `convex/schema.ts:58-59` still has `status: v.optional(v.union(v.literal("green"), v.literal("yellow"), v.literal("red")))` with a "remove after migration" comment. No `removeStatusField` migration exists in the repo. Needs a migration pass to clear the field on existing prod docs *before* removing from schema, otherwise validation errors.
- [ ] **Wrapper components for recurring compositions** — Only pursue if a pattern shows up 5+ times and the abstraction is obvious (message bubbles, card layouts, status-orb containers). Don't over-abstract.
