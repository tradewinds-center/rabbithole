# Implementation Progress - Feb 16, 2026

## 1. Scholar Dossier Completion
**Goal:** Close the loop — observer data flows into dossier + reading level auto-inference

### What was done:
- [x] `getProjectContext` now fetches current mastery observations + aggregated session signals
- [x] `buildSystemPrompt` has new OBSERVER MASTERY CONTEXT section (grouped by domain, Bloom's levels)
- [x] `buildSystemPrompt` has new LEARNER PROFILE section (aggregated signal tendencies)
- [x] Observer now outputs `inferredReadingLevel` from scholar's actual messages
- [x] After observer runs, stores suggestion on user record (`readingLevelSuggestion`)
- [x] Teacher can accept/dismiss reading level suggestion (`acceptReadingLevelSuggestion`, `dismissReadingLevelSuggestion`)
- [x] Schema updated: `readingLevelSuggestion` field on users table

### Status: COMPLETE

### Manual Testing Needed:
- [ ] **Have a scholar chat for 5+ messages, then trigger observer analysis** — verify that mastery observations and signals appear in the system prompt for the next conversation
- [ ] **Check reading level suggestion** — after observer runs, check if `readingLevelSuggestion` is set on the user (teacher dashboard doesn't show this yet — needs UI)
- [ ] **Verify no performance regression** — the additional DB queries in `getProjectContext` shouldn't noticeably slow down the stream

---

## 2. Upload Image
**Goal:** Scholars can upload images into chat

### What was done:
- [x] Schema: `imageId` field added to messages table
- [x] `convex/files.ts`: generateUploadUrl mutation, getUrl query, getUrlInternal internalQuery
- [x] `projects.sendMessage` accepts optional `imageId`
- [x] `projectHelpers.getProjectContext` includes `imageId` in chatHistory
- [x] `http.ts` fetches images from storage, converts to base64, sends to Claude as vision content
- [x] Frontend: Image upload button (camera icon) in chat input
- [x] Frontend: Pending image preview with remove button
- [x] Frontend: Images displayed in user message bubbles
- [x] Frontend: Empty text + image sends "What do you see in this image?" as default text

### Status: COMPLETE

### Manual Testing Needed:
- [ ] **Upload an image and send** — verify it appears in the chat bubble
- [ ] **Verify Claude can see the image** — send a photo and ask about it
- [ ] **Test with large images** — make sure upload doesn't time out
- [ ] **Test with no text + image** — should send with default question

---

## 3. Text-to-Speech
**Goal:** Click to have Makawulu read responses aloud

### What was done:
- [x] TTS button (speaker icon) on assistant message bubbles — appears on hover
- [x] Uses browser SpeechSynthesis API (free, no API cost)
- [x] Strips markdown before speaking
- [x] Toggle play/stop on click
- [x] Cancels speech on component unmount

### Status: COMPLETE

### Manual Testing Needed:
- [ ] **Hover over an assistant message** — speaker icon should appear top-right
- [ ] **Click speaker** — should read the message aloud
- [ ] **Click again while speaking** — should stop
- [ ] **Test on Safari** — SpeechSynthesis works differently on Safari, may need testing

---

## 4. Code Artifacts (was already done)
**Already fully implemented:**
- `create_code` tool in http.ts
- `CodeArtifactViewer` with live iframe preview + code editor
- Schema supports `type: "code"` and `language` on artifacts

### Status: ALREADY COMPLETE (just updated roadmap)

---

## Schema Changes (require `npx convex dev` or `npx convex deploy`):
- `users.readingLevelSuggestion` (optional string) — observer-inferred reading level
- `messages.imageId` (optional storage ID) — image attachment

## Type-Check Results:
- [x] `npx tsc --noEmit --project convex/tsconfig.json` — PASS
- [x] `npx tsc --noEmit` — PASS
- [x] `CONVEX_DEPLOYMENT=perceptive-husky-735 npx convex codegen` — PASS

## Files Modified:
- `convex/schema.ts` — readingLevelSuggestion, imageId fields
- `convex/projectHelpers.ts` — mastery/signal context in getProjectContext + buildSystemPrompt
- `convex/observer.ts` — inferredReadingLevel output + storage
- `convex/scholars.ts` — getInternal, setReadingLevelSuggestion, accept/dismiss mutations
- `convex/http.ts` — image handling in Claude API messages, mastery context in buildSystemPrompt call
- `convex/projects.ts` — imageId in sendMessage
- `convex/files.ts` — NEW: file upload/URL mutations
- `components/ProjectInterface.tsx` — TTS, image upload UI, image display
- `CLAUDE.md` — updated roadmap
