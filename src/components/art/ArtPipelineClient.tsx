"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createArtUploadUrl,
  finalizeArtVersion,
  setCurrentArtVersion,
  deleteArtVersion,
  getArtDownloadUrl,
  createArtComment,
  toggleArtCommentResolved,
  deleteArtComment,
} from "@/app/actions/art";

export type ArtVersionRow = {
  id: string;
  version: number;
  bytes: number | null;
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
  current: { versionId: string; version: number; mime: string | null; previewUrl: string | null } | null;
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
  const [openPage, setOpenPage] = useState<number | null>(null);
  const [toast, setToast] = useState<{ msg: string; busy?: boolean } | null>(null);
  const [confirm, setConfirm] = useState<null | { title: string; body: string; onYes: () => void }>(null);
  const [, startTransition] = useTransition();
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string, busy = false) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, busy });
    if (!busy) toastTimer.current = setTimeout(() => setToast(null), 2400);
  }, []);

  // Sync the open page to the URL hash so the browser back button closes it.
  useEffect(() => {
    const apply = () => {
      const m = /#page\/(\d+)/.exec(window.location.hash);
      setOpenPage(m ? Number(m[1]) : null);
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);
  const goPage = (n: number) => {
    window.location.hash = `#page/${n}`;
  };
  const goGrid = () => {
    if (window.location.hash) history.back();
    else setOpenPage(null);
  };

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
          onDownloadAll={() => showToast("Bulk download is coming soon")}
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
        {has && p.current!.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.current!.previewUrl} alt={`Page ${p.pageNumber} art`} />
        ) : has ? (
          <span className="art-empty art-empty--file">{(p.current!.mime ?? "file").split("/").pop()?.toUpperCase()}</span>
        ) : (
          <span className="art-empty">No art yet</span>
        )}
        <span className="art-droplay">Drop to upload<br />Page {p.pageNumber}</span>
      </span>
      <span className="art-cap">Page {p.pageNumber}</span>
    </button>
  );
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
              {cur?.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cur.previewUrl} alt={`Page ${data.pageNumber} art`} />
              ) : cur ? (
                <span className="art-canvas-empty">{(cur.mime ?? "file").split("/").pop()?.toUpperCase()} — no web preview</span>
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
                  <VersionCard key={v.id} v={v} pageNumber={data.pageNumber} isOwner={isOwner} onDownload={onDownload} onMakeCurrent={onMakeCurrent} onAskDelete={onAskDelete} />
                ))}
                {older.length > 0 && !showOlder && (
                  <button className="art-lnk" onClick={() => setShowOlder(true)}>
                    Show {older.length} older version{older.length === 1 ? "" : "s"}
                  </button>
                )}
                {showOlder &&
                  older.map((v) => (
                    <VersionCard key={v.id} v={v} pageNumber={data.pageNumber} isOwner={isOwner} onDownload={onDownload} onMakeCurrent={onMakeCurrent} onAskDelete={onAskDelete} />
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
}: {
  v: ArtVersionRow;
  pageNumber: number;
  isOwner: boolean;
  onDownload: (versionId: string) => void;
  onMakeCurrent: (versionId: string) => void;
  onAskDelete: (v: ArtVersionRow) => void;
}) {
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
        <div className="art-vactions">
          <button className="art-lnk" onClick={() => onDownload(v.id)}>
            ⤓ Download
          </button>
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
