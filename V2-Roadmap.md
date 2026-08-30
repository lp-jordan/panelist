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

**Phase 0 — MVP safety net (prerequisite, not V2)**
Finish debounced autosave + version snapshots/restore before inviting any real collaborator into a project. (PDF export & character memory can trail.)

**Phase A — Reference foundations (additive migrations)**
- `Reference`, `Collection`, `ReferenceInCollection`, `ReferencePlacement` tables.
- `Asset` extended (`kind`, `mime`, `bytes`, `originalName`, `thumbKey`).
- Lightweight image upload path.

**Phase B — Reference library (single-user; the Milanote replacement)**
- Upload image + caption; group into collections; browse/filter.

**Phase C — Script placement**
- Pin a reference to a panel/page.
- Artist reading view: numbered markers → gutter (desktop) / sheet (mobile); References toggle.

**Phase D+ — collaboration (the original roadmap's back half, when the team stuff matters)**
- Accounts + invites (per-user auth replacing the single-owner gate) — the one real "rebuild."
- Read-only shared script view for the artist.
- Page-grid art uploads + versions (R2 direct-upload + preview worker).
- Download-all for final packaging.
- Later: role-gated uploads; comments anchored to a specific art version; Milanote-style all-images board.

The key resequencing vs. the original artifact: the **reference library (B/C) comes before auth**, because it's useful to Jordan alone, needs only small-image storage, and reuses no fragile machinery.

---

## 5. Open decisions (small; recommended defaults noted)

1. **Folders or tags for collections?** — *Leaning tags.* A costume ref that's both "Bone" and "1890s" is the case that pushes past one-shelf folders. (Data model above already supports many-to-many.)
2. **Do "character" collections tie into the existing `CastMember` cast, or stay free-form?** — *Leaning free-form* named collections for simplicity, matching Milanote.
3. **Marker numbering** — *Leaning count-per-panel* (a panel with two refs shows a **2**) over global sequential ids; more intuitive for the artist.
4. **Marker placement** — *Leaning start-of-panel* (next to `Panel N:`) for scannability, vs. end-of-line to keep the description uninterrupted.
