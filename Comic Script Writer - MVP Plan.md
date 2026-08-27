# Comic Script Writer — MVP Plan

Prepared for: Jordan Johnson
Purpose: hand-off spec for an MVP build
Reference sample analyzed: RENOWNED #2, Draft #2 (10-29-2025)

## 1. Summary

A private, single-user web app for writing comic scripts in Jordan's own format, with Final Draft–style auto-formatting, automatic panel/page numbering, a per-project cast list with autocomplete, Google Docs–style version history, and clean PDF export. Not for public release — no multi-user accounts — but it does need to be reachable remotely (see §6), so it carries a lightweight password gate rather than open access.

## 2. Reference format (derived from the submitted sample)

The sample script gives us a concrete, consistent structure to build the data model and auto-formatting rules around:

* Title page: script title (bold, underlined, centered), "Written by [Author]" beneath it, and a draft stamp at the bottom left — "Draft #2: 10-29-2025".
* Page heading: the comic page number spelled out as a word, bold and underlined, followed by the panel count in parentheses — e.g. `SEVENTEEN (5 Panels)`. This is generated, not typed by hand, and must stay in sync as panels are added or removed. This is the only page-numbering element in the app — no separate running physical page-number header is used anywhere (editor or export).
* Notes: occasional bold-italic notes to the artist or to self (e.g. "NOTE: Could we try a series of page-wide panels..."), appearing under a page heading or between panels. The same NOTES element also covers lettering notes and similar artist-facing asides — no separate element type needed for those.
* Panels: `Panel N:` in bold, followed by the panel description in regular weight. Panel numbering restarts at 1 on every page. Splash pages are written as regular panel description text (e.g. starting with "SPLASH:") rather than a distinct element type.
* Dialogue: character name in caps (optionally with a modifier like `(OFF)` or `(CAPTION)`), a colon, then the line tab-indented to the right. The same character can speak multiple consecutive lines within one panel.
* Captions: either anonymous (`CAPTION:`) or character-voiced (`BONE (CAPTION):`), tab-indented, often bold-italic when anonymous.
* SFX: `SFX:` tab-indented, sound effect in caps (e.g. `SKER-CHOONK`).
* "NO COPY": appears under any silent panel (no dialogue/caption/SFX). In the sample this looks templated rather than hand-typed each time — the MVP should generate it automatically rather than require the writer to type it.
* Inline emphasis: bold, italic, and bold-italic are used throughout dialogue and description for emphasis on specific words/phrases.

This element set (title page, page heading, notes, panels, dialogue, captions, SFX, NO COPY) is confirmed as the full set needed for MVP — no additional first-class element types required.

## 3. Core feature list (MVP)

### 3.1 Dashboard

* Home view listing all scripts, grouped by project, plus an "Unassigned" group for scripts not in a project.
* Create / rename / archive / delete projects.
* Create / rename / duplicate / archive / delete scripts.
* Deleted scripts and projects go to a recoverable **Trash** rather than being purged immediately — restorable until the writer empties the trash explicitly (or after a defined retention window; see build-time detail).
* Each script card shows: title, project, page count, last-edited (relative time), current draft label.
* Basic search/filter by title; sort by last edited.

### 3.2 Script editor with auto-formatting

* Structured, typed-block editor (not free-form text) — see data model in §4 and interaction rules in §5.
* Auto-numbering: panel numbers recalculate live within a page; page word-numbers (ONE, TWO, THREE…) recalculate live as pages are added, removed, or reordered.
* Auto panel count in the page heading, always in sync with actual panel content.
* Auto "NO COPY" insertion for silent panels.
* Character name autocomplete, scoped per-project (see §3.3).
* Inline bold / italic / bold-italic formatting.

### 3.3 Character memory

* Each project maintains its own cast list.
* Typing a character name in a dialogue/caption field autocompletes against that project's cast.
* New names typed into a character field get added to the project cast automatically (with a lightweight way to review/clean up the list later).
* Scripts with no project fall back to script-only memory.

### 3.4 Version history

* Continuous autosave in the background (debounced, e.g. a couple seconds after the last keystroke) — this is the safety net and should be effectively invisible and foolproof.
* Ctrl/Cmd+S forces an immediate save and gives a brief "Saved" confirmation, for peace of mind.
* Automatic snapshots at natural checkpoints — at minimum, once per editing session (e.g., on meaningful inactivity or when the script is closed/navigated away from after edits).
* Manual checkpoints — a "Save Version" action that lets Jordan label a snapshot (e.g. "Sent to editor"), separate from autosave. The draft label/date on the title page (`Draft #2: 10-29-2025`) is a manually-typed field in the script's title-page settings — it does not auto-increment on save. Jordan updates it deliberately when he wants a new draft number to appear.
* A version history panel listing all snapshots (auto and manual, visually distinguished), newest first, each previewable read-only.
* "Restore" from a snapshot creates a new current version rather than destructively overwriting history — nothing is ever lost.

### 3.5 PDF export

* On-demand export from a script, styled to match the on-screen editor formatting (not a rigid industry-Courier template).
* Includes a generated title page (title, author, draft label + date).
* Uses the same generated page heading (`SEVENTEEN (5 Panels)`) as the only page-numbering element — no separate running "Page N" header/footer in the export.

## 4. Data model (suggested)

```
User
  id, name, email, passwordHash, role: 'owner' | 'collaborator', createdAt
  // MVP ships with exactly one 'owner' row (Jordan). The shape exists now so
  // attribution (uploadedBy, createdBy) and the owner/collaborator split
  // don't require a data migration when collaborators are actually added.

Project
  id, name, createdAt, deletedAt?          // deletedAt set = in trash

ProjectMember                              // future: which users can see/touch a project
  id, projectId, userId, role: 'owner' | 'collaborator'

CastMember
  id, projectId, name, notes?

Script
  id, projectId (nullable), title, author, draftLabel, draftDate,
  createdAt, updatedAt, deletedAt?          // deletedAt set = in trash
  // Script text is writable only by the 'owner' user. Collaborators get
  // read-only access, enforced the same way a locked PDF would be — no
  // per-field or per-section permission logic needed since it's a single
  // binary (owner writes / everyone else reads).

Page
  id, scriptId, order            // order drives the word-number label
  // Assets (below) anchor to this stable id, never to the computed
  // word-number label, so reordering pages never orphans uploaded art.

PageItem                         // a page is an ordered list of these
  id, pageId, order, type: 'note' | 'panel'
  noteText?                      // when type = 'note' (covers artist notes, lettering notes, etc.)

Panel                            // when a PageItem.type = 'panel'
  id, pageItemId, description    // panel number is computed from order among panels on the page
                                  // splash pages are just description text (e.g. "SPLASH: ...")

PanelTextElement                 // ordered children of a panel
  id, panelId, order,
  type: 'dialogue' | 'caption' | 'sfx',
  character?, modifier?          // e.g. "OFF", "CAPTION", "O.S." — for dialogue/caption
  text (rich text: bold/italic spans)

Snapshot
  id, scriptId, label, isManual (bool), createdAt, content (full serialized script state)

Asset                             // future: uploaded art pages, out of scope for MVP UI/logic
  id, pageId, uploadedBy (userId), storageKey, note?, createdAt
  // No stage/pipeline enum and no controlled vocabulary. An asset stack for
  // a page is just all its Asset rows ordered by createdAt (newest first) —
  // artists upload as many dated versions of a page as they want, and
  // everything older stays visible underneath. `note` is a free-text field
  // if someone wants to caption a version ("inks v2"), never structured.

Event                             // future: append-only activity log
  id, type, subjectId, actorId (userId), meta, createdAt
  // Not read anywhere in the MVP, but written to from day one where cheap
  // (e.g. snapshot created, script restored) — history that isn't logged
  // from the start can never be reconstructed later.
```

Panel numbering, page word-numbers, panel counts, and "NO COPY" are all computed at render time from this structure, never stored as literal text — that's what keeps them reliably auto-updating.

Trash behavior: setting `deletedAt` on a `Project` or `Script` removes it from normal dashboard views and surfaces it in a Trash view; restoring clears `deletedAt`. Purging (hard delete) only happens from within the Trash view as an explicit, separately-confirmed action.

**On the `User`/`ProjectMember`/`Asset`/`Event` tables above:** these exist in the schema starting with the MVP so that adding team/production features later (§ out of scope) is additive — new tables get populated and new UI gets built, but nothing already shipped needs a backfill or migration. None of them are exercised by MVP features or UI; the MVP creates exactly one `User` row (`role: 'owner'`) and otherwise ignores them.

## 5. Editor interaction model

1. Element flow: pressing Enter should intelligently suggest the next likely element type based on context (e.g., after a panel description, prompt for a character name; after a dialogue line, offer another dialogue line for the same or a new character), similar to how Final Draft anticipates the next script element.
2. Explicit inserts: a lightweight menu, slash-command, or hotkey set for inserting New Page, New Panel, New Note, New SFX Line, New Caption — so the writer isn't fighting the auto-flow when they want something else.
3. Character field autocomplete: as described in §3.3, sourced from the project cast.
4. Reordering: drag-and-drop or keyboard-based reordering of panels within a page and pages within a script, with numbering recalculating immediately.
5. Inline formatting: standard bold/italic hotkeys (Cmd/Ctrl+B, Cmd/Ctrl+I) plus a way to combine both.
6. NO COPY: rendered automatically, not editable text — if a panel gains a dialogue/caption/SFX child, it should disappear automatically.

## 6. Technical recommendations

Since the ask is "lightweight but powerful," here's a sensible default — the dev should feel free to substitute equivalents they're faster in, the important part is the shape:

* Frontend / editor: React, with a structured rich-text framework (e.g. Tiptap, built on ProseMirror) rather than a plain contenteditable — this gives you custom node types matching the element model above (panel, dialogue, caption, SFX, note), solid undo/redo, and a clean path to richer collaboration features later if that's ever wanted.
* Backend: a simple Node service (can live inside the same app, e.g. Next.js server routes/actions) — no need for a separate service given single-user scale.
* Database: SQLite via an ORM like Prisma or Drizzle. Zero external dependencies to run, and plenty powerful for one user's scripts. Because the app needs to be reachable remotely (see below), make sure the SQLite file lives on persistent storage at the host and is backed up regularly.
* PDF export: render the script through headless Chromium (Puppeteer or Playwright) using the same CSS as the editor, so the export is a faithful "print" of what's on screen rather than a separately-maintained template.
* Hosting & auth: this needs to be reachable remotely (Jordan wants to write from a phone or another computer), not just localhost. Deploy to a small always-on host (e.g. a lightweight VPS or a platform like Fly.io/Railway) and put a basic shared-password gate in front of it (at the reverse-proxy level, or a simple app-level login) since it will be reachable over the open internet. No multi-user accounts or permissions system — just the one gate to keep it private.

## 7. Out of scope for MVP (explicitly deferred)

* Multi-user accounts, permissions, or real-time collaboration.
* True inline track-changes (per-edit accept/reject) — MVP uses snapshot-based version history instead.
* Comment threads on specific lines/panels.
* Offline mode or a dedicated mobile app.
* Industry-standard (Courier/submission-format) export as an alternate mode.
* Reference image boards / moodboards attached to scripts.
* Tags or advanced cross-script search.
* Auto-incrementing draft numbers (draft label stays manually edited).
* Any running physical page-number header, in editor or export.
* Team/production features: collaborator accounts, per-page art upload stacks, activity feed, approve/needs-revision states. The `User`, `ProjectMember`, `Asset`, and `Event` tables are seeded into the schema now (§4) precisely so this can be built additively later without a migration — but no upload UI, no per-collaborator login, and no enforcement of the owner/collaborator split ships in the MVP.

These are all reasonable v2 candidates once the MVP is in daily use and its rough edges are known.

---

## 9. Build checklist (MVP)

Tracking scaffolding and build progress against this spec. Check items off as they land.

### Project setup
- [x] Git repo initialized
- [x] Next.js (App Router) + TypeScript scaffolded (Next.js 16 — note: Middleware was renamed to Proxy, `src/proxy.ts` not `middleware.ts`)
- [x] Prisma + SQLite configured, schema from §4 applied (including the unused `ProjectMember`/`Asset`/`Event` seams; `User` is used now, by the password gate)
- [x] Tiptap dependencies installed
- [x] Password-gate middleware stubbed (§6) — implemented as a real single-owner login: seeded `User` row, bcrypt password check, signed session cookie (`jose`), `src/proxy.ts` doing the optimistic redirect. Run `npx prisma db seed` (reads `OWNER_NAME`/`OWNER_EMAIL`/`OWNER_PASSWORD` from `.env`) once before first login.
- [x] Initial commit

### Dashboard (§3.1)
- [x] List scripts grouped by project + "Unassigned" group
- [x] Create / rename / archive projects (archiving a project cascades to archive its own scripts too, so nothing goes missing from both dashboard and trash at once); permanent delete lives in Trash only
- [x] Create / rename / duplicate / archive scripts; permanent delete lives in Trash only
- [x] Trash view with restore (restoring a project does not auto-restore its scripts — restore those individually)
- [x] Script card metadata (title, project, page count, last-edited, draft label)
- [x] Search by title / sort by last edited

### Editor core (§3.2, §4, §5)
- [x] Tiptap schema: page, note, panel, panelDescription, textElement (dialogue/caption/sfx) node types
- [x] Live panel numbering + page word-numbers (computed at render time from document position, never stored as text)
- [x] Live panel count in page heading
- [x] Auto "NO COPY" insertion/removal
- [x] Inline bold/italic/bold-italic
- [x] Enter-key contextual element flow (panel description → dialogue; dialogue/caption/sfx → same kind+character; note → new panel). Also `Mod-Enter` to jump straight to a new dialogue line in the current panel from anywhere in it.
- [x] Explicit inserts — implemented as toolbar buttons (+Page/+Panel/+Note/+Dialogue/+Caption/+SFX) rather than a slash-command menu; same functionality, simpler MVP scope.
- [x] Reordering — implemented as ↑/↓ buttons on pages/panels/textElements rather than drag-and-drop (the doc allows either); numbering recalculates immediately since it's computed, not stored.
- [x] Character autocomplete (HTML `<datalist>` sourced from the project's cast) + auto-add new names to the project's `CastMember` table on blur.
- [x] Manual Save button + Ctrl/Cmd+S (full round-trip verified: editor → relational tables → reload reconstructs identically, including bold/italic runs). This is the "forced save" half of §3.4 — debounced autosave and version snapshots are still their own separate checklist section below, not built yet.

Known gaps from this pass, not blocking: (1) `CastMember` requires a `projectId`, so unassigned scripts don't yet get the "script-only memory" fallback described in §3.3 — would need a schema change to support. (2) The last-page delete-guard button initially went stale when a *different* page was deleted (fixed with `useEditorState` so it re-renders on any document change, not just position shifts of that specific node) — mentioning since it's the kind of bug worth knowing about if similar computed-UI-state bugs show up elsewhere in the editor.

### Character memory (§3.3)
- [ ] Per-project cast list
- [ ] Autocomplete on character fields
- [ ] Auto-add new names typed into character fields
- [ ] Script-only fallback memory for unassigned scripts

### Version history (§3.4)
- [ ] Debounced autosave
- [ ] Ctrl/Cmd+S forced save + confirmation
- [ ] Automatic session-checkpoint snapshots
- [ ] Manual "Save Version" with label
- [ ] Version history panel (auto vs. manual distinguished)
- [ ] Restore-as-new-version behavior

### PDF export (§3.5)
- [ ] Playwright-based export using editor CSS
- [ ] Generated title page
- [ ] Generated page heading as the only page-numbering element

---

This document reflects the structure and formatting conventions observed in the "RENOWNED #2" sample script provided by Jordan Johnson, plus decisions made in discovery conversations on 2026-08-27.
