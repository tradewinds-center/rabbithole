# Rabbithole TODO

From Amber & Carl meeting — April 15, 2026

---

## Bugs

- [x] _P0_ **TTS broken in prod** — Network call returns data fine but audio never plays. Likely MediaSource streaming issue. WIP fix on `tts-playback` branch.
- [ ] _P1_ **Wherever possible, Cmd-clicking links should open things in new tabs**, as per standard browser behavior

## Scholar Experience

- [ ] _P3_ **Scholar avatars** — Kid wants an avatar. Add avatar selection or generation for scholars
- [x] ~~**Students shouldn't be able to change own Reading Level**~~ — `ea4f8e2` Locked to teacher-only; parent view shows read-only with disabled controls

## AI Tutor Behavior (Prompt Tuning)

- [x] **Keep it concise** — Prompt was updated but still producing long multi-paragraph responses. Needs stronger enforcement — possibly max_tokens cap or more aggressive prompt wording.
- [x] **One question at a time** — Related to above. Still stacking multiple bolded questions in one response despite prompt update.
- [ ] **Loved the feedback comments** — (positive signal, keep this) Amber loved when the AI commented on how she was doing. Make sure this stays prominent
- [ ] **Silly mode guardrails** — Amber can be silly at times. Tune how the AI handles silly/off-task moments (gentle redirect vs. playing along briefly then refocusing)

## Teacher Dashboard

- [ ] **Password reset for scholars** — Amber forgets passwords. Teachers need a "reset password" button on their dashboard (no reset-password flow for kids)
- [ ] **Make unit/template association clearer** — Too hard to tell when a lesson is based on a given unit template. Surface this more visibly in the project list or header

## Reading Level & Accessibility

- [ ] **Break down reading level granularly** — Instead of whole numbers, use 7.1–7.9 scale
- [ ] **Track audio vs visual preference** — Track % of time scholar clicks the speaker button. Surface this to teachers
- [x] ~~**Toggle: speech-to-text**~~ — `ea4f8e2` Per-scholar STT toggle on Reading & Audio tab
- [x] ~~**Toggle: text-to-speech**~~ — `ea4f8e2` Per-scholar TTS toggle on Reading & Audio tab
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
