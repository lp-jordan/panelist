"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  createArtUploadUrl,
  finalizeArtVersion,
  setCurrentArtVersion,
  deleteArtVersion,
  getArtDownloadUrl,
  createArtComment,
  toggleArtCommentResolved,
  deleteArtComment,
  setArtVersionNote,
} from "@/app/actions/art";

export type PreviewStatus = "PENDING" | "PROCESSING" | "READY" | "FAILED";

export type ArtVersionRow = {
  id: string;
  version: number;
  bytes: number | null;
  note: string | null;
  previewStatus: PreviewStatus;
  isCurrent: boolean;
  uploaderName: string;
  createdLabel: string;
};
export type ArtCommentRow = {
  id: string;
  body: string;
  xPct: number;
  yPct: number;
  resolved: boolean;
  authorId: string | null;
  authorName: string;
  createdLabel: string;
};
export type ArtPageData = {
  pageNumber: number;
  versionCount: number;
  current: {
    versionId: string;
    version: number;
    mime: string | null;
    previewUrl: string | null;
    previewStatus: PreviewStatus;
  } | null;
  versions: ArtVersionRow[];
  comments: ArtCommentRow[];
};

function fmtBytes(b: number | null) {
  if (!b) return "";
  const mb = b / (1024 * 1024);
  if (mb >= 1000) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
}

const VER_SHOWN = 3;

export function ArtPipelineClient({
  scriptId,
  pages,
  isOwner,
  currentUserId,
  locked,
  storageReady,
  latestUploadLabel,
}: {
  scriptId: string;
  pages: ArtPageData[];
  isOwner: boolean;
  currentUserId: string;
  locked: boolean;
  storageReady: boolean;
  latestUploadLabel: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [toast, setToast] = useState<{ msg: string; busy?: boolean } | null>(null);
  const [confirm, setConfirm] = useState<null | { title: string; body: string; onYes: () => void }>(null);
  const [, startTransition] = useTransition();
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string, busy = false) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, busy });
    if (!busy) toastTimer.current = setTimeout(() => setToast(null), 2400);
  }, []);

  // The open page lives in the `?page=N` query param so the browser's own back
  // button closes the detail. We drive it with the native History API, which Next
  // syncs into `useSearchParams` — unlike a raw `location.hash` write, this stays
  // in step with the App Router, so back returns to the grid instead of leaving
  // the art view entirely.
  const pageParam = searchParams.get("page");
  const openPage = pageParam && /^\d+$/.test(pageParam) ? Number(pageParam) : null;
  // Tracks whether *we* pushed the current detail entry, so the in-app back
  // button pops it (symmetric with browser back) rather than trapping a
  // deep-linked visitor who has no grid entry behind them.
  const pushedRef = useRef(false);
  const goPage = (n: number) => {
    window.history.pushState(null, "", `?page=${n}`);
    pushedRef.current = true;
  };
  const goGrid = () => {
    if (pushedRef.current) {
      pushedRef.current = false;
      window.history.back();
    } else {
      // Deep-linked straight into a page: no entry to pop, so drop the param.
      window.history.pushState(null, "", window.location.pathname);
    }
  };

  // While any current preview is still rendering, poll the server so the tile
  // flips from "Processing…" to the real thumbnail on its own. Stops as soon as
  // nothing is pending, and gives up after a few minutes so an idle tab doesn't
  // refresh forever.
  const anyPending = pages.some(
    (p) => p.current && (p.current.previewStatus === "PENDING" || p.current.previewStatus === "PROCESSING"),
  );
  useEffect(() => {
    if (!anyPending) return;
    const started = Date.now();
    const t = setInterval(() => {
      if (Date.now() - started > 5 * 60 * 1000) {
        clearInterval(t);
        return;
      }
      router.refresh();
    }, 5000);
    return () => clearInterval(t);
  }, [anyPending, router]);

  const uploadingRef = useRef(false);
  async function upload(pageNumber: number, file: File) {
    if (uploadingRef.current) return;
    if (!storageReady) {
      showToast("Art storage isn’t configured yet");
      return;
    }
    if (file.size > 250 * 1024 * 1024) {
      showToast("That file is over the 250 MB limit");
      return;
    }
    uploadingRef.current = true;
    showToast("Uploading new version…", true);
    try {
      const contentType = file.type || "application/octet-stream";
      const { artPageId, version, key, uploadUrl } = await createArtUploadUrl({
        scriptId,
        pageNumber,
        fileName: file.name,
        contentType,
        bytes: file.size,
      });
      const res = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: file,
      });
      if (!res.ok) throw new Error(`upload failed (${res.status})`);
      await finalizeArtVersion({
        scriptId,
        artPageId,
        version,
        key,
        fileName: file.name,
        contentType,
        bytes: file.size,
      });
      showToast(`✓ Page ${pageNumber} is now on version ${version}`);
      router.refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Upload failed");
    } finally {
      uploadingRef.current = false;
    }
  }

  async function download(versionId: string) {
    try {
      const url = await getArtDownloadUrl({ scriptId, versionId });
      window.location.href = url;
    } catch {
      showToast("Couldn’t start the download");
    }
  }

  const openPageData = openPage != null ? pages.find((p) => p.pageNumber === openPage) ?? null : null;

  return (
    <>
      {openPageData == null ? (
        <GridView
          pages={pages}
          locked={locked}
          latestUploadLabel={latestUploadLabel}
          onOpen={goPage}
          onDrop={upload}
          onDownloadAll={() => {
            // A file-download endpoint (returns a zip attachment), not a page —
            // a full navigation is correct here, not router.push.
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination
            window.location.href = `/scripts/${scriptId}/art/download`;
          }}
        />
      ) : (
        <PageView
          key={openPageData.pageNumber}
          data={openPageData}
          scriptId={scriptId}
          isOwner={isOwner}
          currentUserId={currentUserId}
          onBack={goGrid}
          onUpload={upload}
          onDownload={download}
          onMakeCurrent={(versionId) =>
            startTransition(async () => {
              await setCurrentArtVersion({ scriptId, versionId });
              showToast("Current version updated");
              router.refresh();
            })
          }
          onAskDelete={(v) =>
            setConfirm({
              title: `Delete version ${v.version}?`,
              body: `Version ${v.version} of Page ${openPageData.pageNumber} (${fmtBytes(v.bytes)}) will be permanently removed from storage. This can’t be undone.`,
              onYes: () =>
                startTransition(async () => {
                  await deleteArtVersion({ scriptId, versionId: v.id });
                  showToast(`Version ${v.version} deleted`);
                  router.refresh();
                }),
            })
          }
          onAddComment={(body, xPct, yPct) =>
            startTransition(async () => {
              await createArtComment({ scriptId, pageNumber: openPageData.pageNumber, body, xPct, yPct });
              showToast("Note added");
              router.refresh();
            })
          }
          onToggleResolve={(commentId) =>
            startTransition(async () => {
              await toggleArtCommentResolved({ scriptId, commentId });
              router.refresh();
            })
          }
          onDeleteComment={(commentId) =>
            startTransition(async () => {
              await deleteArtComment({ scriptId, commentId });
              showToast("Note deleted");
              router.refresh();
            })
          }
          onSetVersionNote={(versionId, note) =>
            startTransition(async () => {
              await setArtVersionNote({ scriptId, versionId, note });
              showToast(note.trim() ? "Note saved" : "Note cleared");
              router.refresh();
            })
          }
        />
      )}

      {confirm && (
        <div className="art-modal-scrim" onClick={(e) => e.target === e.currentTarget && setConfirm(null)}>
          <div className="art-modal" role="alertdialog" aria-modal="true">
            <h3>{confirm.title}</h3>
            <p>{confirm.body}</p>
            <div className="art-modal-act">
              <button className="art-btn art-btn-plain" onClick={() => setConfirm(null)}>
                Cancel
              </button>
              <button
                className="art-btn art-btn-danger"
                onClick={() => {
                  const yes = confirm.onYes;
                  setConfirm(null);
                  yes();
                }}
              >
                Delete version
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="art-toast" role="status">
          {toast.busy && <span className="art-spin" aria-hidden="true" />}
          {toast.msg}
        </div>
      )}
    </>
  );
}

function GridView({
  pages,
  locked,
  latestUploadLabel,
  onOpen,
  onDrop,
  onDownloadAll,
}: {
  pages: ArtPageData[];
  locked: boolean;
  latestUploadLabel: string | null;
  onOpen: (n: number) => void;
  onDrop: (pageNumber: number, file: File) => void;
  onDownloadAll: () => void;
}) {
  return (
    <>
      {!locked && (
        <p className="art-lockhint">
          This script isn’t locked. Page numbers can still shift as it’s edited, which moves art out from under its page. Lock it once the page count is final.
        </p>
      )}
      <div className="art-headrow">
        <p className="art-meta">
          <b>{pages.length}</b> page{pages.length === 1 ? "" : "s"}
          {latestUploadLabel && (
            <>
              <span className="art-dot">·</span> Latest upload <b>{latestUploadLabel}</b>
            </>
          )}
        </p>
        <button className="art-btn art-btn-plain" onClick={onDownloadAll}>
          Download all (current)
        </button>
      </div>

      <div className="art-grid">
        {pages.map((p) => (
          <GridTile key={p.pageNumber} p={p} onOpen={onOpen} onDrop={onDrop} />
        ))}
      </div>
    </>
  );
}

function GridTile({
  p,
  onOpen,
  onDrop,
}: {
  p: ArtPageData;
  onOpen: (n: number) => void;
  onDrop: (pageNumber: number, file: File) => void;
}) {
  const [hot, setHot] = useState(false);
  const has = p.current != null;
  return (
    <button
      className={`art-tile${hot ? " art-drop-hot" : ""}`}
      onClick={() => onOpen(p.pageNumber)}
      onDragEnter={(e) => {
        e.preventDefault();
        setHot(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setHot(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setHot(false);
        const file = e.dataTransfer.files?.[0];
        if (file) onDrop(p.pageNumber, file);
      }}
    >
      <span className="art-thumb">
        {has && <span className="art-vbadge">v{p.current!.version}</span>}
        {has ? <ThumbInner cur={p.current!} pageNumber={p.pageNumber} /> : <span className="art-empty">No art yet</span>}
        <span className="art-droplay">Drop to upload<br />Page {p.pageNumber}</span>
      </span>
      <span className="art-cap">Page {p.pageNumber}</span>
    </button>
  );
}

function fmtType(mime: string | null) {
  return (mime ?? "file").split("/").pop()?.toUpperCase() ?? "FILE";
}

// Shared thumbnail body: real preview when READY, a "Processing…" state while the
// worker rasterizes a PSD/TIFF/PDF, and a format placeholder if it couldn't.
function ThumbInner({
  cur,
  pageNumber,
}: {
  cur: NonNullable<ArtPageData["current"]>;
  pageNumber: number;
}) {
  if (cur.previewStatus === "PENDING" || cur.previewStatus === "PROCESSING") {
    return (
      <span className="art-empty art-processing">
        <span className="art-spin art-spin-dark" aria-hidden="true" />
        Processing preview…
      </span>
    );
  }
  if (cur.previewUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={cur.previewUrl} alt={`Page ${pageNumber} art`} />;
  }
  return <span className="art-empty art-empty--file">{fmtType(cur.mime)}</span>;
}

function PageView({
  data,
  isOwner,
  currentUserId,
  onBack,
  onUpload,
  onDownload,
  onMakeCurrent,
  onAskDelete,
  onAddComment,
  onToggleResolve,
  onDeleteComment,
  onSetVersionNote,
}: {
  data: ArtPageData;
  scriptId: string;
  isOwner: boolean;
  currentUserId: string;
  onBack: () => void;
  onUpload: (pageNumber: number, file: File) => void;
  onDownload: (versionId: string) => void;
  onMakeCurrent: (versionId: string) => void;
  onAskDelete: (v: ArtVersionRow) => void;
  onAddComment: (body: string, xPct: number, yPct: number) => void;
  onToggleResolve: (commentId: string) => void;
  onDeleteComment: (commentId: string) => void;
  onSetVersionNote: (versionId: string, note: string) => void;
}) {
  const [showOlder, setShowOlder] = useState(false);
  const [hotStage, setHotStage] = useState(false);
  const [hotDrop, setHotDrop] = useState(false);
  const [composer, setComposer] = useState<null | { x: number; y: number; text: string }>(null);
  const [hotId, setHotId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const cur = data.current;
  const shown = data.versions.slice(0, VER_SHOWN);
  const older = data.versions.slice(VER_SHOWN);

  // open notes first (insertion order), resolved sink to the bottom
  const orderedComments = [...data.comments].sort((a, b) => Number(a.resolved) - Number(b.resolved));

  function pickFile() {
    fileRef.current?.click();
  }

  function onStageClick(e: React.MouseEvent) {
    if (!cur) return;
    const r = (stageRef.current as HTMLElement).getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    setComposer({ x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)), text: "" });
  }

  return (
    <>
      <button className="art-back" onClick={onBack}>
        ‹ Pages
      </button>

      <div className="art-detail">
        <div className="art-leftcol">
          <div
            ref={stageRef}
            className={`art-stage${hotStage ? " art-drop-hot" : ""}`}
            onClick={onStageClick}
            onDragEnter={(e) => {
              e.preventDefault();
              setHotStage(true);
            }}
            onDragOver={(e) => e.preventDefault()}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setHotStage(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setHotStage(false);
              const file = e.dataTransfer.files?.[0];
              if (file) onUpload(data.pageNumber, file);
            }}
          >
            <div className="art-canvas" title={cur ? "Click the art to leave a note" : undefined}>
              {cur && (cur.previewStatus === "PENDING" || cur.previewStatus === "PROCESSING") ? (
                <span className="art-canvas-empty">
                  <span className="art-spin art-spin-dark" aria-hidden="true" /> Processing preview…
                </span>
              ) : cur?.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cur.previewUrl} alt={`Page ${data.pageNumber} art`} />
              ) : cur ? (
                <span className="art-canvas-empty">{fmtType(cur.mime)} — no web preview</span>
              ) : (
                <span className="art-canvas-empty">No art yet</span>
              )}
              {cur &&
                orderedComments.map((c, i) => (
                  <span
                    key={c.id}
                    className={`art-pin${c.resolved ? " art-pin-done" : ""}${hotId === c.id ? " art-pin-hot" : ""}`}
                    style={{ left: `${c.xPct * 100}%`, top: `${c.yPct * 100}%` }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setHotId(c.id);
                    }}
                  >
                    {i + 1}
                  </span>
                ))}
              {composer && (
                <span className="art-pin art-pin-ghost" style={{ left: `${composer.x * 100}%`, top: `${composer.y * 100}%` }}>
                  +
                </span>
              )}
            </div>
          </div>

          <div className="art-comments">
            <div className="art-clabel">
              <span>Notes on the art</span>
              <span className="art-chint">Click the page to pin a note</span>
            </div>

            {composer && (
              <div className="art-composer" onClick={(e) => e.stopPropagation()}>
                <span className="art-pinnum">+</span>
                <textarea
                  autoFocus
                  rows={2}
                  placeholder="Add a note here…"
                  value={composer.text}
                  onChange={(e) => setComposer({ ...composer, text: e.target.value })}
                />
                <div className="art-composer-act">
                  <button className="art-lnk" onClick={() => setComposer(null)}>
                    Cancel
                  </button>
                  <button
                    className="art-btn art-btn-tint"
                    onClick={() => {
                      const t = composer.text.trim();
                      if (!t) return;
                      onAddComment(t, composer.x, composer.y);
                      setComposer(null);
                    }}
                  >
                    Post note
                  </button>
                </div>
              </div>
            )}

            <div className="art-commentlist">
              {orderedComments.length === 0 ? (
                <div className="art-cempty">No notes yet — click anywhere on the art to leave one.</div>
              ) : (
                orderedComments.map((c, i) => {
                  const mine = c.authorId === currentUserId;
                  return (
                    <div
                      key={c.id}
                      className={`art-cmt${c.resolved ? " art-resolved" : ""}${hotId === c.id ? " art-hot" : ""}`}
                      onClick={() => setHotId(c.id)}
                    >
                      <span className="art-num">{i + 1}</span>
                      <div className="art-cbody">
                        <div className="art-chead">
                          <span className="art-cname">{c.authorName}</span>
                          <span className="art-cwhen">{c.createdLabel}</span>
                          {c.resolved && <span className="art-donetag">Resolved</span>}
                          <span className="art-cactions">
                            <button
                              className="art-lnk"
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleResolve(c.id);
                              }}
                            >
                              {c.resolved ? "Reopen" : "Resolve"}
                            </button>
                            {(mine || isOwner) && (
                              <button
                                className="art-lnk art-del"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteComment(c.id);
                                }}
                              >
                                Delete
                              </button>
                            )}
                          </span>
                        </div>
                        <div className="art-ctext">{c.body}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="art-side">
          <h2 className="art-dtitle">Page {data.pageNumber}</h2>
          <p className="art-dsub">
            {data.versionCount > 0 ? `${data.versionCount} version${data.versionCount === 1 ? "" : "s"}` : "No art yet"}
          </p>

          {cur && (
            <div className="art-curcard">
              <div className="art-curtop">
                <span className="art-vt">Version {cur.version}</span>
                <span className="art-curr-pill">Current</span>
              </div>
              <button className="art-btn art-btn-plain art-dl" onClick={() => onDownload(cur.versionId)}>
                ⤓ Download current
              </button>
            </div>
          )}

          <input
            ref={fileRef}
            type="file"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUpload(data.pageNumber, file);
              e.target.value = "";
            }}
          />
          <div
            className={`art-drop${hotDrop ? " art-hot" : ""}`}
            onClick={pickFile}
            onDragEnter={(e) => {
              e.preventDefault();
              setHotDrop(true);
            }}
            onDragOver={(e) => e.preventDefault()}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setHotDrop(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setHotDrop(false);
              const file = e.dataTransfer.files?.[0];
              if (file) onUpload(data.pageNumber, file);
            }}
          >
            <div className="art-drop-big">Drop a new version</div>
            PSD, TIFF or PNG · up to 250 MB
            <small>Becomes the new current version</small>
          </div>

          <div className="art-vlabel">Version history</div>
          <div className="art-timeline">
            {data.versions.length === 0 ? (
              <div className="art-vcard">
                <div className="art-vn">Nothing uploaded yet</div>
              </div>
            ) : (
              <>
                {shown.map((v) => (
                  <VersionCard key={v.id} v={v} pageNumber={data.pageNumber} isOwner={isOwner} onDownload={onDownload} onMakeCurrent={onMakeCurrent} onAskDelete={onAskDelete} onSetNote={onSetVersionNote} />
                ))}
                {older.length > 0 && !showOlder && (
                  <button className="art-lnk" onClick={() => setShowOlder(true)}>
                    Show {older.length} older version{older.length === 1 ? "" : "s"}
                  </button>
                )}
                {showOlder &&
                  older.map((v) => (
                    <VersionCard key={v.id} v={v} pageNumber={data.pageNumber} isOwner={isOwner} onDownload={onDownload} onMakeCurrent={onMakeCurrent} onAskDelete={onAskDelete} onSetNote={onSetVersionNote} />
                  ))}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function VersionCard({
  v,
  isOwner,
  onDownload,
  onMakeCurrent,
  onAskDelete,
  onSetNote,
}: {
  v: ArtVersionRow;
  pageNumber: number;
  isOwner: boolean;
  onDownload: (versionId: string) => void;
  onMakeCurrent: (versionId: string) => void;
  onAskDelete: (v: ArtVersionRow) => void;
  onSetNote: (versionId: string, note: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(v.note ?? "");

  return (
    <div className={`art-ver${v.isCurrent ? " art-is-cur" : ""}`}>
      <div className="art-vcard">
        <div className="art-vtop">
          <span className="art-vn">Version {v.version}</span>
          <span className="art-when">{v.createdLabel}</span>
        </div>
        <div className="art-vrow2">
          <span>{v.uploaderName}</span>
          {v.bytes ? (
            <>
              <span>·</span>
              <span className="art-sz">{fmtBytes(v.bytes)}</span>
            </>
          ) : null}
          {v.isCurrent && (
            <>
              <span>·</span>
              <span className="art-cur-tag">Current</span>
            </>
          )}
        </div>

        {editing ? (
          <div className="art-noteedit">
            <textarea
              autoFocus
              rows={2}
              placeholder="What changed in this version?"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <div className="art-noteedit-act">
              <button
                className="art-lnk"
                onClick={() => {
                  setDraft(v.note ?? "");
                  setEditing(false);
                }}
              >
                Cancel
              </button>
              <button
                className="art-lnk"
                onClick={() => {
                  onSetNote(v.id, draft);
                  setEditing(false);
                }}
              >
                Save
              </button>
            </div>
          </div>
        ) : v.note ? (
          <div className="art-vnote" onClick={() => setEditing(true)} title="Edit note">
            {v.note}
          </div>
        ) : null}

        <div className="art-vactions">
          <button className="art-lnk" onClick={() => onDownload(v.id)}>
            ⤓ Download
          </button>
          {!editing && !v.note && (
            <button className="art-lnk art-restore" onClick={() => setEditing(true)}>
              + Add note
            </button>
          )}
          {!v.isCurrent && (
            <button className="art-lnk art-restore" onClick={() => onMakeCurrent(v.id)}>
              ↩ Make current
            </button>
          )}
          {!v.isCurrent && isOwner && (
            <button className="art-lnk art-del" onClick={() => onAskDelete(v)}>
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
