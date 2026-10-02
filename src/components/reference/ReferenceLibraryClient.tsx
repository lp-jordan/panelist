"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Menu } from "@/components/ui/Menu";
import { Portal } from "@/components/ui/Portal";
import { FormSheet } from "@/components/ui/FormSheet";
import { ActionSheet } from "@/components/ui/ActionSheet";
import { addReference, updateReferenceCaption, deleteReference, updateReferenceTags } from "@/app/actions/references";
import { RefOpenLink, RefVisual } from "./RefVisual";
import { downscaleImage } from "@/lib/downscaleImage";

const UNSORTED = "__unsorted__";

// Shrink the picked image in the browser before it's uploaded, so a large
// original never reaches the server or the DB blob store.
async function downscaleUpload(formData: FormData): Promise<FormData> {
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    formData.set("file", await downscaleImage(file));
  }
  return formData;
}

export type ReferenceCard = {
  id: string;
  assetId: string | null;
  url: string | null;
  caption: string | null;
  placementCount: number;
  collectionIds: string[];
};

export type CollectionChip = { id: string; name: string; count: number };

/**
 * The per-issue reference grid — the Milanote replacement (V2 §2.3). One image
 * + a caption per card, grouped by free-form collections/tags (§5): the filter
 * chips are views of a tag, "Unsorted" is the untagged ones. An orange badge
 * marks a reference pinned somewhere in the script (Phase C).
 */
export function ReferenceLibraryClient({
  scriptId,
  references,
  collections,
}: {
  scriptId: string;
  references: ReferenceCard[];
  collections: CollectionChip[];
}) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ReferenceCard | null>(null);
  const [deleting, setDeleting] = useState<ReferenceCard | null>(null);
  const [tagging, setTagging] = useState<ReferenceCard | null>(null);
  const [viewing, setViewing] = useState<ReferenceCard | null>(null);
  const [filter, setFilter] = useState<string | null>(null);

  const nameOf = useMemo(() => new Map(collections.map((c) => [c.id, c.name])), [collections]);

  // Paste or drop an image or a link anywhere on the page to add it straight
  // away; no sheet, no mode. The add sheet does the same for a typed link or
  // a picked file.
  const [quickStatus, setQuickStatus] = useState<string | null>(null);
  const [, startQuick] = useTransition();
  const sheetOpen = adding || editing !== null || tagging !== null || deleting !== null || viewing !== null;
  const quickAdd = (payload: { file?: File; url?: string }) => {
    const fd = new FormData();
    fd.set("scriptId", scriptId);
    if (payload.file) fd.set("file", payload.file);
    if (payload.url) fd.set("url", payload.url);
    setQuickStatus("Adding reference…");
    startQuick(async () => {
      const result = await addReference(await downscaleUpload(fd));
      setQuickStatus(result?.error ?? null);
    });
  };
  // The window listeners below read the latest quickAdd through this ref.
  const quickAddRef = useRef(quickAdd);
  useEffect(() => {
    quickAddRef.current = quickAdd;
  });

  useEffect(() => {
    if (sheetOpen) return;
    const isEditable = (el: EventTarget | null) =>
      el instanceof HTMLElement && (el.isContentEditable || el.closest("input, textarea, select") !== null);
    const fromTransfer = (dt: DataTransfer | null) => {
      if (!dt) return null;
      const file = [...dt.files].find((f) => f.type.startsWith("image/"));
      if (file) return { file };
      const text = (dt.getData("text/uri-list") || dt.getData("text/plain")).trim().split("\n")[0];
      return /^https?:\/\/\S+$/i.test(text) ? { url: text } : null;
    };
    const onPaste = (e: ClipboardEvent) => {
      if (isEditable(e.target)) return;
      const payload = fromTransfer(e.clipboardData);
      if (!payload) return;
      e.preventDefault();
      quickAddRef.current(payload);
    };
    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.some((t) => t === "Files" || t === "text/uri-list")) e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      const payload = fromTransfer(e.dataTransfer);
      if (!payload) return;
      e.preventDefault();
      quickAddRef.current(payload);
    };
    window.addEventListener("paste", onPaste);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("paste", onPaste);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
  }, [sheetOpen]);

  const untaggedCount = useMemo(() => references.filter((r) => r.collectionIds.length === 0).length, [references]);
  const shown = useMemo(() => {
    if (filter === null) return references;
    if (filter === UNSORTED) return references.filter((r) => r.collectionIds.length === 0);
    return references.filter((r) => r.collectionIds.includes(filter));
  }, [references, filter]);

  return (
    <>
      <div className="ref-toolbar">
        {references.length > 0 && (
          <span className="ref-count">
            {references.length} reference{references.length === 1 ? "" : "s"}
          </span>
        )}
        <button type="button" className="ref-add" onClick={() => setAdding(true)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add reference
        </button>
      </div>
      {quickStatus && (
        <p className="ref-quick" role="status">
          {quickStatus}
        </p>
      )}

      {(collections.length > 0 || untaggedCount !== references.length) && references.length > 0 && (
        <div className="ref-filters">
          <button type="button" className={`ref-chip${filter === null ? " ref-chip--on" : ""}`} onClick={() => setFilter(null)}>
            All <span className="ref-chip-n">{references.length}</span>
          </button>
          {collections.map((c) => (
            <button
              type="button"
              key={c.id}
              className={`ref-chip${filter === c.id ? " ref-chip--on" : ""}`}
              onClick={() => setFilter(c.id)}
            >
              {c.name} <span className="ref-chip-n">{c.count}</span>
            </button>
          ))}
          {untaggedCount > 0 && (
            <button
              type="button"
              className={`ref-chip${filter === UNSORTED ? " ref-chip--on" : ""}`}
              onClick={() => setFilter(UNSORTED)}
            >
              Unsorted <span className="ref-chip-n">{untaggedCount}</span>
            </button>
          )}
        </div>
      )}

      {references.length === 0 ? (
        <div className="empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <circle cx="8.5" cy="9.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
          <h4>No reference yet</h4>
          <p>Add a reference image or link.</p>
        </div>
      ) : shown.length === 0 ? (
        <div className="empty">
          <h4>Nothing here yet</h4>
          <p>No references in this view.</p>
        </div>
      ) : (
        <div className="ref-grid">
          {shown.map((ref) => (
            <figure className="ref-card" key={ref.id}>
              <div className="ref-thumb">
                {/* Tap the card to open the reference detail. */}
                <button type="button" className="ref-open" onClick={() => setViewing(ref)} aria-label={`Open ${ref.caption ?? "reference"}`}>
                  <RefVisual source={ref} alt={ref.caption ?? "Reference"} lazy />
                </button>
                {ref.placementCount > 0 && (
                  <span className="ref-pin" title={`Pinned in ${ref.placementCount} place${ref.placementCount === 1 ? "" : "s"}`}>
                    {ref.placementCount}
                  </span>
                )}
                <span className="ref-card-menu">
                  <Menu label="Reference actions" contextSelector=".ref-card">
                    {(close) => (
                      <>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            close();
                            setEditing(ref);
                          }}
                        >
                          Edit caption
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M4 20h4L20 8l-4-4L4 16z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            close();
                            setTagging(ref);
                          }}
                        >
                          Tags…
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M20.6 13.4L12 22l-8-8V4h10l6.6 6.6a2 2 0 010 2.8z" />
                            <circle cx="7.5" cy="7.5" r="1.5" />
                          </svg>
                        </button>
                        <hr />
                        <button
                          type="button"
                          role="menuitem"
                          className="danger"
                          onClick={() => {
                            close();
                            setDeleting(ref);
                          }}
                        >
                          Delete
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                          </svg>
                        </button>
                      </>
                    )}
                  </Menu>
                </span>
              </div>
              {ref.caption && <figcaption className="ref-cap">{ref.caption}</figcaption>}
            </figure>
          ))}
        </div>
      )}

      <FormSheet open={adding} onClose={() => setAdding(false)} title="Add reference" submitLabel="Add" action={addReference} transform={downscaleUpload}>
        <input type="hidden" name="scriptId" value={scriptId} />
        <AddSource key={adding ? "open" : "closed"} />
        <input className="field" name="caption" placeholder="Caption (optional)" aria-label="Caption" />
      </FormSheet>

      <FormSheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Edit caption"
        action={updateReferenceCaption}
      >
        <input type="hidden" name="id" value={editing?.id ?? ""} />
        <input type="hidden" name="scriptId" value={scriptId} />
        <input
          className="field"
          name="caption"
          defaultValue={editing?.caption ?? ""}
          placeholder="Caption"
          aria-label="Caption"
          // Remount per reference so defaultValue tracks the selected card.
          key={editing?.id ?? "none"}
        />
      </FormSheet>

      {viewing && (
        <ReferenceDetail
          reference={viewing}
          tagNames={viewing.collectionIds.map((id) => nameOf.get(id)).filter((n): n is string => Boolean(n))}
          onClose={() => setViewing(null)}
          onEditCaption={() => {
            setEditing(viewing);
            setViewing(null);
          }}
          onTags={() => {
            setTagging(viewing);
            setViewing(null);
          }}
          onDelete={() => {
            setDeleting(viewing);
            setViewing(null);
          }}
        />
      )}

      <FormSheet
        key={tagging?.id ?? "none"}
        open={tagging !== null}
        onClose={() => setTagging(null)}
        title="Collections"
        action={updateReferenceTags}
      >
        <input type="hidden" name="referenceId" value={tagging?.id ?? ""} />
        <input type="hidden" name="scriptId" value={scriptId} />
        {collections.length > 0 && (
          <div className="tag-list">
            {collections.map((c) => (
              <label className="tag-row" key={c.id}>
                <input
                  type="checkbox"
                  name="collectionIds"
                  value={c.id}
                  defaultChecked={tagging?.collectionIds.includes(c.id)}
                />
                <span>{c.name}</span>
              </label>
            ))}
          </div>
        )}
        <input className="field" name="newCollection" placeholder="New collection…" aria-label="New collection" />
      </FormSheet>

      <ActionSheet
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Delete this reference?"
        description="It's removed along with any pins in the script."
        confirmLabel="Delete"
        action={deleteReference}
        hidden={{ id: deleting?.id ?? "", scriptId }}
      />
    </>
  );
}

/**
 * Reference detail (V2 §2.3, screen 3): the full image, its note, the
 * collections it's in, and whether it's pinned in the script — opened by
 * tapping a card. Editing routes back through the library's existing sheets.
 */
function ReferenceDetail({
  reference,
  tagNames,
  onClose,
  onEditCaption,
  onTags,
  onDelete,
}: {
  reference: ReferenceCard;
  tagNames: string[];
  onClose: () => void;
  onEditCaption: () => void;
  onTags: () => void;
  onDelete: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <Portal>
      <div className="scrim" data-open onClick={onClose} />
      <div className="rd-modal" role="dialog" aria-modal="true" aria-label="Reference detail">
        <button type="button" className="rd-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <RefVisual source={reference} alt={reference.caption ?? "Reference"} className="rd-img" />
        <div className="rd-body">
          <RefOpenLink source={reference} className="rd-link" />
          <p className="rd-cap">{reference.caption || <span className="rd-cap-empty">No caption</span>}</p>

          {tagNames.length > 0 && (
            <div className="rd-tags">
              {tagNames.map((name) => (
                <span className="rd-tag" key={name}>
                  {name}
                </span>
              ))}
            </div>
          )}

          {reference.placementCount > 0 && (
            <div className="rd-placed">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 21s-7-5.5-7-11a7 7 0 0114 0c0 5.5-7 11-7 11z" />
                <circle cx="12" cy="10" r="2.5" />
              </svg>
              Pinned in {reference.placementCount} place{reference.placementCount === 1 ? "" : "s"} in this script
            </div>
          )}

          <div className="rd-actions">
            <button type="button" onClick={onEditCaption}>Edit caption</button>
            <button type="button" onClick={onTags}>Collections</button>
            <button type="button" className="rd-danger" onClick={onDelete}>Delete</button>
          </div>
        </div>
      </div>
    </Portal>
  );
}

/**
 * The add sheet's source: paste a link, or choose (or drop) an image. Whichever
 * is given is what gets added; the server tells them apart.
 */
function AddSource() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [over, setOver] = useState(false);

  const takeFiles = (files: FileList | null) => {
    const image = files && [...files].find((f) => f.type.startsWith("image/"));
    if (!image || !fileRef.current) return;
    const dt = new DataTransfer();
    dt.items.add(image);
    fileRef.current.files = dt.files;
    setFileName(image.name || "Pasted image");
  };

  return (
    <div
      className="ref-add-zone"
      data-over={over}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        takeFiles(e.dataTransfer.files);
      }}
    >
      {fileName ? (
        <div className="ref-add-picked">
          <span>{fileName}</span>
          <button
            type="button"
            className="ref-add-clear"
            onClick={() => {
              if (fileRef.current) fileRef.current.value = "";
              setFileName(null);
            }}
            aria-label="Remove image"
          >
            ✕
          </button>
        </div>
      ) : (
        <>
          <input
            className="field"
            name="url"
            placeholder="Paste a link or image"
            aria-label="Link"
            autoComplete="off"
            inputMode="url"
            onPaste={(e) => {
              if ([...e.clipboardData.files].some((f) => f.type.startsWith("image/"))) {
                e.preventDefault();
                takeFiles(e.clipboardData.files);
              }
            }}
          />
          <button type="button" className="ref-add-choose" onClick={() => fileRef.current?.click()}>
            or choose an image
          </button>
        </>
      )}
      <input
        ref={fileRef}
        type="file"
        name="file"
        accept="image/*"
        hidden
        onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
      />
    </div>
  );
}
