# Rabbithole TODO

From Amber & Carl meeting — April 15, 2026

---

## Bugs

- [ ] _P0_ TTS is broken
- [ ] _P0_ **Scrolling hides TTS button** — Scrolling down causes the text-to-speech "speaker" button to disappear above the fold. It should be sticky within a "track" that is along the right side of the chat bubble
- [ ] _P1_ **Wherever possible, Cmd-clicking links should open things in new tabs, as per standard browser behavior

## Scholar Experience

- [ ] _P0_ **Engagement bar: color only** — Amber was hyperfixated on getting 5/5. Remove the number, keep just the color indicator so it's less gamified/anxiety-inducing. Inside the dropdown just show e.g. "Pulse Score - Idle" with the rainbow but make it discretized so that it only shows the integer value
- [ ] _P3_ **Scholar avatars** — Kid wants an avatar. Add avatar selection or generation for scholars
- [ ] _P0_ **Students shouldn't be able to change own Reading Level** — Lock reading level to teacher-only control

## AI Tutor Behavior (Prompt Tuning)

- [ ] **Redirect emotional questions** — When asked about emotional issues, redirect warmly instead of "I'm only an AI" / "does not compute." Something like acknowledging the feeling and suggesting they talk to a trusted adult
- [ ] **Stop saying "You're right"** — AI shouldn't validate with "you're right." Rephrase to keep the scholar thinking
- [ ] **Keep it concise** — Responses should be shorter by default. The student can always ask for more. This is a dialogue, not a monologue
- [ ] **One question at a time** — Don't stack multiple questions. Ask one, wait for a response
- [ ] **Loved the feedback comments** — (positive signal, keep this) Amber loved when the AI commented on how she was doing. Make sure this stays prominent
- [ ] **Silly mode guardrails** — Amber can be silly at times. Tune how the AI handles silly/off-task moments (gentle redirect vs. playing along briefly then refocusing)

## Teacher Dashboard

- [ ] **Password reset for scholars** — Amber forgets passwords. Teachers need a "reset password" button on their dashboard (no reset-password flow for kids)
- [ ] **Make unit/template association clearer** — Too hard to tell when a lesson is based on a given unit template. Surface this more visibly in the project list or header

## Reading Level & Accessibility

- [ ] **Break down reading level granularly** — Instead of whole numbers, use 7.1–7.9 scale
- [ ] **Track audio vs visual preference** — Track % of time scholar clicks the speaker button. Surface this to teachers
- [ ] **Toggle: speech-to-text** — Per-scholar toggle for voice input
- [ ] **Toggle: text-to-speech** — Per-scholar toggle for auto-read responses
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
