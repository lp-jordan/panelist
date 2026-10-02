"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Menu } from "@/components/ui/Menu";
import { Portal } from "@/components/ui/Portal";
import { FormSheet } from "@/components/ui/FormSheet";
import { ActionSheet } from "@/components/ui/ActionSheet";
import {
  addReference,
  updateReferenceCaption,
  deleteReference,
  createFolder,
  renameFolder,
  deleteFolder,
  moveReference,
} from "@/app/actions/references";
import { RefOpenLink, RefVisual } from "./RefVisual";
import { downscaleImage } from "@/lib/downscaleImage";

// Marks a drag that started on one of our own cards, so the page-wide
// "drop to add" handler ignores it and only folder tiles act on it.
const CARD_DRAG = "application/x-panelist-reference";

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
  folderId: string | null;
};

export type ReferenceFolderTile = { id: string; name: string; count: number };

function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    </svg>
  );
}

/**
 * The per-issue reference library: a root with one level of folders. The root
 * shows the folders, then the unfiled references; opening a folder (?folder=
 * in the URL, so Back works) shows what's filed there. Cards drag onto a folder
 * to file them; "Move" in a card's menu does the same without dragging.
 */
export function ReferenceLibraryClient({
  scriptId,
  references,
  folders,
}: {
  scriptId: string;
  references: ReferenceCard[];
  folders: ReferenceFolderTile[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const requested = params.get("folder");
  const folder = folders.find((f) => f.id === requested) ?? null;
  const openFolder = (id: string | null) =>
    router.push(id ? `?folder=${encodeURIComponent(id)}` : "?", { scroll: false });

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ReferenceCard | null>(null);
  // Delete / Move act on one reference or on the whole multi-selection.
  const [deleting, setDeleting] = useState<string[] | null>(null);
  const [moving, setMoving] = useState<{ ids: string[]; folderId: string | null } | null>(null);
  // Ctrl/⌘-click selects several cards; cleared on Escape or leaving the view.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [viewing, setViewing] = useState<ReferenceCard | null>(null);
  const [newFolder, setNewFolder] = useState(false);
  const [renamingFolder, setRenamingFolder] = useState<ReferenceFolderTile | null>(null);
  const [deletingFolder, setDeletingFolder] = useState<ReferenceFolderTile | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [, startMove] = useTransition();

  const nameOf = useMemo(() => new Map(folders.map((f) => [f.id, f.name])), [folders]);
  const shown = useMemo(
    () => references.filter((r) => (folder ? r.folderId === folder.id : r.folderId === null)),
    [references, folder],
  );

  const fileInto = (refIds: string[], folderId: string | null) => {
    const fd = new FormData();
    refIds.forEach((id) => fd.append("id", id));
    fd.set("scriptId", scriptId);
    fd.set("folderId", folderId ?? "");
    setSelected(new Set());
    startMove(() => moveReference(fd));
  };

  const toggleSelected = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // A different folder is a different view: start with nothing selected.
  const [selectionView, setSelectionView] = useState(folder?.id ?? null);
  if (selectionView !== (folder?.id ?? null)) {
    setSelectionView(folder?.id ?? null);
    setSelected(new Set());
  }

  useEffect(() => {
    if (selected.size === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(new Set());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected.size]);

  // Paste or drop an image or a link anywhere on the page to add it straight
  // away, into the open folder; no sheet, no mode. The add sheet does the same
  // for a typed link or a picked file.
  const [quickStatus, setQuickStatus] = useState<string | null>(null);
  const [, startQuick] = useTransition();
  const sheetOpen =
    adding || editing !== null || moving !== null || deleting !== null || viewing !== null ||
    newFolder || renamingFolder !== null || deletingFolder !== null;
  const quickAdd = (payload: { file?: File; url?: string }) => {
    const fd = new FormData();
    fd.set("scriptId", scriptId);
    if (folder) fd.set("folderId", folder.id);
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
      if (!dt || dt.types.includes(CARD_DRAG)) return null;
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
      if (e.dataTransfer?.types.includes(CARD_DRAG)) return;
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

  const folderTarget = (id: string | null) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!e.dataTransfer.types.includes(CARD_DRAG)) return;
      e.preventDefault();
      setDropTarget(id ?? "root");
    },
    onDragLeave: () => setDropTarget(null),
    onDrop: (e: React.DragEvent) => {
      const refIds = e.dataTransfer.getData(CARD_DRAG).split(",").filter(Boolean);
      setDropTarget(null);
      if (refIds.length === 0) return;
      e.preventDefault();
      e.stopPropagation();
      fileInto(refIds, id);
    },
  });

  return (
    <>
      <div className="ref-toolbar">
        {folder ? (
          <nav className="ref-crumbs" aria-label="Folder">
            {/* Back to the root; also a drop target for filing cards back out. */}
            <button
              type="button"
              className="ref-crumb-back"
              data-drop={dropTarget === "root"}
              onClick={() => openFolder(null)}
              aria-label="Back to all references"
              title="All references"
              {...folderTarget(null)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 5l-7 7 7 7" />
              </svg>
            </button>
            <FolderIcon />
            <span className="ref-crumb-here">{folder.name}</span>
            <span className="ref-folder-menu">
              <Menu label="Folder actions">
                {(close) => (
                  <>
                    <button type="button" role="menuitem" onClick={() => { close(); setRenamingFolder(folder); }}>
                      Rename
                    </button>
                    <hr />
                    <button type="button" role="menuitem" className="danger" onClick={() => { close(); setDeletingFolder(folder); }}>
                      Delete folder
                    </button>
                  </>
                )}
              </Menu>
            </span>
          </nav>
        ) : (
          references.length > 0 && (
            <span className="ref-count">
              {references.length} reference{references.length === 1 ? "" : "s"}
            </span>
          )
        )}
        {!folder && (
          <button type="button" className="ref-newfolder" onClick={() => setNewFolder(true)}>
            <FolderIcon />
            New folder
          </button>
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

      {!folder && folders.length > 0 && (
        <div className="ref-folders">
          {folders.map((f) => (
            <button
              type="button"
              key={f.id}
              className="ref-folder"
              data-drop={dropTarget === f.id}
              onClick={() => openFolder(f.id)}
              {...folderTarget(f.id)}
            >
              <FolderIcon />
              <span className="ref-folder-name">{f.name}</span>
              <span className="ref-folder-count">{f.count}</span>
            </button>
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        folder ? (
          <div className="empty">
            <h4>This folder is empty</h4>
          </div>
        ) : folders.length === 0 ? (
          <div className="empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <circle cx="8.5" cy="9.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
            <h4>No reference yet</h4>
            <p>Add a reference image or link.</p>
          </div>
        ) : null
      ) : (
        <div className="ref-grid">
          {shown.map((ref) => (
            <figure
              className="ref-card"
              key={ref.id}
              data-selected={selected.has(ref.id)}
              draggable
              onDragStart={(e) => {
                // Dragging a selected card carries the whole selection.
                const ids = selected.has(ref.id) ? [...selected] : [ref.id];
                e.dataTransfer.setData(CARD_DRAG, ids.join(","));
                e.dataTransfer.effectAllowed = "move";
              }}
            >
              <div className="ref-thumb">
                {/* Tap to open the reference; Ctrl/⌘-click to select several. */}
                <button
                  type="button"
                  className="ref-open"
                  onClick={(e) => {
                    if (e.ctrlKey || e.metaKey) {
                      e.preventDefault();
                      toggleSelected(ref.id);
                      return;
                    }
                    setSelected(new Set());
                    setViewing(ref);
                  }}
                  aria-label={`Open ${ref.caption ?? "reference"}`}
                  aria-pressed={selected.size > 0 ? selected.has(ref.id) : undefined}
                >
                  <RefVisual source={ref} alt={ref.caption ?? "Reference"} lazy />
                </button>
                {selected.has(ref.id) && (
                  <span className="ref-check" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12.5l4.5 4.5L19 7.5" />
                    </svg>
                  </span>
                )}
                <span className="ref-card-menu">
                  <Menu label="Reference actions" contextSelector=".ref-card">
                    {(close) => (
                      <>
                        <button type="button" role="menuitem" onClick={() => { close(); setEditing(ref); }}>
                          Edit caption
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M4 20h4L20 8l-4-4L4 16z" />
                          </svg>
                        </button>
                        <button type="button" role="menuitem" onClick={() => { close(); setMoving({ ids: [ref.id], folderId: ref.folderId }); }}>
                          Move to…
                          <FolderIcon />
                        </button>
                        <hr />
                        <button type="button" role="menuitem" className="danger" onClick={() => { close(); setDeleting([ref.id]); }}>
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

      {selected.size > 0 && (
        <div className="ref-bulkbar" role="toolbar" aria-label="Selected references">
          <span className="ref-bulk-count">{selected.size} selected</span>
          <button type="button" onClick={() => setMoving({ ids: [...selected], folderId: folder?.id ?? null })}>
            Move to…
          </button>
          <button type="button" className="ref-bulk-danger" onClick={() => setDeleting([...selected])}>
            Delete
          </button>
          <button type="button" className="ref-bulk-clear" onClick={() => setSelected(new Set())} aria-label="Clear selection" title="Clear selection">
            ✕
          </button>
        </div>
      )}

      <FormSheet open={adding} onClose={() => setAdding(false)} title="Add reference" submitLabel="Add" action={addReference} transform={downscaleUpload}>
        <input type="hidden" name="scriptId" value={scriptId} />
        <input type="hidden" name="folderId" value={folder?.id ?? ""} />
        <AddSource key={adding ? "open" : "closed"} />
        <input className="field" name="caption" placeholder="Caption (optional)" aria-label="Caption" />
      </FormSheet>

      <FormSheet open={editing !== null} onClose={() => setEditing(null)} title="Edit caption" action={updateReferenceCaption}>
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

      <FormSheet
        key={moving?.ids.join(",") ?? "none"}
        open={moving !== null}
        onClose={() => setMoving(null)}
        title={moving && moving.ids.length > 1 ? `Move ${moving.ids.length} references` : "Move to"}
        submitLabel="Move"
        action={async (fd) => {
          await moveReference(fd);
          setSelected(new Set());
        }}
      >
        {(moving?.ids ?? []).map((id) => (
          <input key={id} type="hidden" name="id" value={id} />
        ))}
        <input type="hidden" name="scriptId" value={scriptId} />
        <select className="field" name="folderId" defaultValue={moving?.folderId ?? ""} aria-label="Folder">
          <option value="">All references (no folder)</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </FormSheet>

      <FormSheet open={newFolder} onClose={() => setNewFolder(false)} title="New folder" submitLabel="Create" action={createFolder}>
        <input type="hidden" name="scriptId" value={scriptId} />
        <input className="field" name="name" placeholder="Folder name" aria-label="Folder name" maxLength={60} required />
      </FormSheet>

      <FormSheet
        key={renamingFolder?.id ?? "none-rename"}
        open={renamingFolder !== null}
        onClose={() => setRenamingFolder(null)}
        title="Rename folder"
        action={renameFolder}
      >
        <input type="hidden" name="id" value={renamingFolder?.id ?? ""} />
        <input type="hidden" name="scriptId" value={scriptId} />
        <input className="field" name="name" defaultValue={renamingFolder?.name ?? ""} aria-label="Folder name" maxLength={60} required />
      </FormSheet>

      {viewing && (
        <ReferenceDetail
          reference={viewing}
          folderName={viewing.folderId ? nameOf.get(viewing.folderId) ?? null : null}
          onClose={() => setViewing(null)}
          onEditCaption={() => {
            setEditing(viewing);
            setViewing(null);
          }}
          onMove={() => {
            setMoving({ ids: [viewing.id], folderId: viewing.folderId });
            setViewing(null);
          }}
          onDelete={() => {
            setDeleting([viewing.id]);
            setViewing(null);
          }}
        />
      )}

      <ActionSheet
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={deleting && deleting.length > 1 ? `Delete ${deleting.length} references?` : "Delete this reference?"}
        description="Any pins in the script go too."
        confirmLabel="Delete"
        action={async (fd) => {
          await deleteReference(fd);
          setSelected(new Set());
          setDeleting(null);
        }}
        hidden={{ id: deleting ?? [], scriptId }}
      />

      <ActionSheet
        open={deletingFolder !== null}
        onClose={() => setDeletingFolder(null)}
        title={`Delete “${deletingFolder?.name ?? ""}”?`}
        confirmLabel="Delete"
        action={async (fd) => {
          await deleteFolder(fd);
          setDeletingFolder(null);
          openFolder(null);
        }}
        hidden={{ id: deletingFolder?.id ?? "", scriptId }}
        choiceName="contents"
        choices={
          deletingFolder && deletingFolder.count > 0
            ? [
                { label: "Move contents to root", value: "move", danger: false },
                { label: "Delete all", value: "delete" },
              ]
            : undefined
        }
      />
    </>
  );
}

/**
 * Reference detail: the full image (or link), its caption, its folder, and
 * whether it's pinned in the script. Opened by tapping a card; editing routes
 * back through the library's sheets.
 */
function ReferenceDetail({
  reference,
  folderName,
  onClose,
  onEditCaption,
  onMove,
  onDelete,
}: {
  reference: ReferenceCard;
  folderName: string | null;
  onClose: () => void;
  onEditCaption: () => void;
  onMove: () => void;
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

          {folderName && <p className="rd-folder">In {folderName}</p>}

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
            <button type="button" onClick={onMove}>Move</button>
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
