# Panelist — V2 Roadmap

Status: Draft · Updated 2026-08-30 · Owner: Jordan
Companion to `Comic Script Writer - MVP Plan.md` (the MVP spec). This doc covers what comes *after* the MVP.

Interactive mockup of the first V2 feature (reference library):
https://claude.ai/code/artifact/13acd7a6-bcf7-4acd-9e13-8a429ab6296a

---

## 1. Where V2 is going

The long-term endgame is **collaboration** — turning Panelist from a solo script editor into the place a whole team works a book (lead invites collaborators, everyone sees the page layout, art is uploaded per page with version history, the editor pulls finished pages out at the end). That vision and its backend/cost analysis (Cloudflare R2, direct-to-storage uploads, per-issue cost model) are captured in the published **V2 Roadmap artifact** and still stand as the destination.

But the *first* thing we build is smaller and useful to Jordan alone, before any of the heavy systems (multi-user auth, the R2 art pipeline) exist: a **reference library** with **panel-level pinning**. It replaces the current Milanote workflow and adds the one thing Milanote can't do — linking a reference to the exact place in the script where it's relevant.

This was deliberately scoped **down** from an earlier "annotation system" idea. We are **not** building:
- Google-Docs-style comment threads, replies, or resolve.
- Multi-author commentary / working-through-notes.
- Span/word-level highlighting (which would need editor-mark machinery).

The direction is one-way: **Jordan authors reference; the artist reads it.**

---

## 2. Feature: Reference Library (the first V2 build)

### 2.1 The model — three parts, nothing more

- **Reference** = an image + a caption/note.
- **Collection** = a named group (a character, a location, a historical/costume topic). This is the Milanote organizing model.
- **Placement (pin)** = an optional link from a reference to a specific **panel** (or page) in a script. A reference can be pinned to several panels; a panel can hold several references.

That's the whole "annotation": *a reference, a note, a place.*

### 2.2 Why panel-level (not span-level)

Pinning to a **panel** links to `Panel.id`, which already exists and is stable. This sidesteps the entire ProseMirror-marks / anchor-through-edits problem that span highlighting would require. Art is drawn per panel anyway, so panel granularity is the right grain for an artist.

### 2.3 Screens (see mockup)

1. **Library** — collections as shelves (Characters / Locations / Historical & costume / Unsorted), each showing a stacked thumbnail + counts. Reference is its own bottom-tab, peer to Scripts.
2. **Collection** — a grid of references, each with its caption. A reference already pinned somewhere shows a small **orange badge** with its placement count.
3. **Reference detail** — full image, note, tags, and a "Pinned in <script> · Page/Panel" chip. A **Pin to a panel** action starts a link.
4. **Pinning** — pick page + panel (from the reference, or from within the script).
5. **Artist reading view** — see below.

### 2.4 Artist reading view (locked design)

- The script reads **clean** — the only addition is a **small orange numbered circle** next to any panel that has references.
- **Click/tap a circle → the full reference opens on demand:**
  - **Desktop:** in a **right gutter** beside the script (Google-Docs-style).
  - **Mobile:** in a **bottom sheet** (same content; the reveal adapts to screen width — a gutter can't work at phone width).
- A **References toggle** in the app bar hides the markers entirely, so the script reads exactly as it does today. This is a per-reader view preference (remembered per person), not a change to the script itself.

One set of markers/pins; the reveal (gutter vs sheet) is the only thing that differs by device.

### 2.5 Design vocabulary

- **Blue** = navigation / actions (Panelist accent).
- **Orange** = *placement* everywhere (pin badges, panel markers, gutter highlight) — so "this is a pinned reference, here" reads at a glance.

---

## 3. Data model deltas

Additive only — no rebuild of existing tables. Reference images ride the existing `Asset` table.

```
Reference              id, projectId, assetId, caption?, createdAt
Collection             id, projectId, name          // "Bone", "The Cathedral", "1890s streetwear"
ReferenceInCollection  referenceId, collectionId    // many-to-many (see open question on folders vs tags)
ReferencePlacement     id, referenceId, panelId (or pageId), createdAt

Asset (extend)         + kind: 'reference' | 'art', mime, bytes, originalName, thumbKey
```

Placements link to `Panel.id` (stable). A panel's references = its `ReferencePlacement` rows.

Reference images are small (screenshots, photo grabs — MBs, not the 20–250 MB layered PSDs the future art pipeline handles), so they do **not** need the heavy R2 direct-upload/worker pipeline to launch. A simple upload path is fine for v1.

---

## 4. Reassessed build sequence (easiest / no-rebuild first)

**Phase 0 — MVP status: complete**
Autosave, version history/restore, character memory, and PDF export (via the `/print` route + `window.print()`) are all built. The only deferred piece is the headless-Chromium/Playwright PDF, intentionally held until hosting setup — not a blocker for anything in V2.

**Phase A — Reference foundations (additive migrations)**
- `Reference`, `Collection`, `ReferenceInCollection`, `ReferencePlacement` tables.
- `Asset` extended (`kind`, `mime`, `bytes`, `originalName`, `thumbKey`).
- Lightweight image upload path.
- **Constraint (keeps Phase D cheap):** hang everything off `projectId`, and route any ownership / "current user" logic through the app's existing current-user accessor — do **not** add new single-owner (`isOwner`-style) checks in A–C. Auth in Phase D replaces the single-owner gate; the fewer places that assumption is hardcoded now, the smaller that rebuild is.

**Phase B — Reference library (single-user; the Milanote replacement)**
- Upload image + caption; group into collections; browse/filter.

**Phase C — Script placement**
- Pin a reference to a panel/page.
- Artist reading view: numbered markers → gutter (desktop) / sheet (mobile); References toggle.

**Phase D — accounts + collaboration (the one real "rebuild")**
- Multi-tenant auth: email + password, sign-up *and* login (login/session already exist; sign-up + per-user ownership are new). Replaces the single-owner gate.
- Access via project membership (reuse the existing `ProjectMember` seam) + a `Script.ownerId` for the owner. Every list/read/write scoped to the current user's access.
- **Email-keyed invites:** the owner invites an email → a shareable invite link (token). Whether the invitee opens the link (email prefilled) or just signs up directly at the site, using the invited email grants access — pending invites for an email are applied on sign-up. Real email *sending* deferred (no mail service wired yet); an invite is a link you share manually for now.
- Roles: OWNER edits scripts / locks-unlocks / invites; COLLABORATOR (the artist) gets the read-only locked view + references. (Confirms the earlier "only the owner edits/locks" note.)
- Slices: **D1** = multi-tenant foundation (sign-up, ownership, scoped queries; backfill existing data to Jordan). **D2** = invites + roles + the read-only artist view.

**Phase E — art pipeline (R2), separate from auth**
- Page-grid art uploads + versions per issue (Cloudflare R2 direct-to-storage upload + preview worker) — the 20–250 MB layered PSDs that can't ride the DB (unlike reference images; see §3).
- Download-all for final packaging.
- Later: role-gated uploads; comments anchored to a specific art version; Milanote-style all-images board.
- Dig in once D is settled; R2 is its own body of work (storage infra, worker, direct upload) independent of the auth rebuild.

The key resequencing vs. the original artifact: the **reference library (B/C) comes before auth**, because it's useful to Jordan alone, needs only small-image storage, and reuses no fragile machinery.

---

## 5. Decisions (resolved 2026-08-30)

1. **Organization = free-form tags, not fixed folders.** A reference can carry several tags, so one image can live under more than one grouping (e.g. "Bone" *and* "1890s costume") without duplicating it. Groupings are user-defined and created per issue as you go — no fixed taxonomy. The "shelves" in the library UI are just views of a tag. (`ReferenceInCollection` many-to-many in §3 already supports this; read "Collection" as "tag".)
2. **Collections/tags are free-form, not linked to `CastMember`.** They change per issue; Jordan sets them as he goes.
3. **Markers: one circle per reference, numbered sequentially per script** (footnote-style stable id). Multiple refs on a panel render as multiple circles, so the count is visible by glance and each ref keeps a stable id — no separate per-panel count needed.
4. **Marker placement: start of the panel** (next to `Panel N:`) — to try first; revisit if it crowds the panel label.
