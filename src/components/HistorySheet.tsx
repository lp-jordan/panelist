"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatRelativeTime } from "@/lib/format";
import {
  listSnapshots,
  createManualSnapshot,
  restoreSnapshot,
  deleteSnapshot,
  type SnapshotListItem,
  type SnapshotMeta,
} from "@/app/actions/snapshots";
import type { JSONNode } from "@/lib/editor/serialize";

// The version-history panel. Lists snapshots newest-first, distinguishing manual
// "saved versions" (labelled) from automatic session checkpoints. Each is
// previewable read-only in a new tab and restorable — restore is non-destructive
// (see restoreSnapshot), so it needs only a light confirm, not a danger sheet.
export function HistorySheet({
  scriptId,
  open,
  onClose,
  getLiveState,
}: {
  scriptId: string;
  open: boolean;
  onClose: () => void;
  getLiveState: () => { doc: JSONNode; meta: SnapshotMeta };
}) {
  const [items, setItems] = useState<SnapshotListItem[] | null>(null);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setItems(await listSnapshots(scriptId));
  }, [scriptId]);

  useEffect(() => {
    if (!open) return;
    setItems(null);
    setConfirmRestore(null);
    refresh().catch((err) => console.error("load history failed", err));

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, refresh]);

  const saveVersion = async () => {
    setBusy(true);
    try {
      const { doc, meta } = getLiveState();
      await createManualSnapshot(scriptId, doc, meta, label);
      setLabel("");
      await refresh();
    } catch (err) {
      console.error("save version failed", err);
    } finally {
      setBusy(false);
    }
  };

  const doRestore = async (id: string) => {
    setBusy(true);
    try {
      await restoreSnapshot(scriptId, id);
      // The editor's initial doc is server-rendered, so a reload is the simplest
      // way to bring the restored content into the live editor intact.
      window.location.reload();
    } catch (err) {
      console.error("restore failed", err);
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    try {
      await deleteSnapshot(scriptId, id);
      await refresh();
    } catch (err) {
      console.error("delete snapshot failed", err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="scrim" data-open={open} onClick={onClose} />
      <div
        className="form-sheet sx-history"
        data-open={open}
        role="dialog"
        aria-label="Version history"
        inert={!open}
      >
        <div className="form-sheet-card">
          <div className="form-sheet-head">
            <span />
            <strong>Version history</strong>
            <button type="button" onClick={onClose}>
              Done
            </button>
          </div>

          <div className="sx-history-save">
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Name this version (e.g. Sent to editor)"
              onKeyDown={(e) => {
                if (e.key === "Enter") saveVersion();
              }}
              disabled={busy}
            />
            <button type="button" className="sx-history-save-btn" onClick={saveVersion} disabled={busy}>
              Save version
            </button>
          </div>

          <div className="sx-history-body">
            {items === null && <p className="sx-history-empty">Loading…</p>}
            {items !== null && items.length === 0 && (
              <p className="sx-history-empty">
                No saved versions yet. Autosave keeps your work; checkpoints appear here as you write, and
                &ldquo;Save version&rdquo; adds a labelled one.
              </p>
            )}
            {items !== null && items.length > 0 && (
              <ul className="sx-history-list">
                {items.map((item) => (
                  <li key={item.id} className="sx-history-item" data-manual={item.isManual}>
                    <span className="sx-history-icon" aria-hidden="true">
                      {item.isManual ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="9" />
                          <path d="M12 7v5l3 2" />
                        </svg>
                      )}
                    </span>
                    <span className="sx-history-meta">
                      <span className="sx-history-label">
                        {item.isManual ? item.label || "Saved version" : item.label || "Autosave checkpoint"}
                      </span>
                      <span className="sx-history-time">{formatRelativeTime(new Date(item.createdAt))}</span>
                    </span>
                    <span className="sx-history-actions">
                      {confirmRestore === item.id ? (
                        <>
                          <button type="button" className="sx-history-confirm" onClick={() => doRestore(item.id)} disabled={busy}>
                            Restore
                          </button>
                          <button type="button" className="sx-history-cancel" onClick={() => setConfirmRestore(null)} disabled={busy}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <Link
                            className="sx-history-preview"
                            href={`/scripts/${scriptId}/history/${item.id}`}
                            target="_blank"
                            rel="noopener"
                          >
                            Preview
                          </Link>
                          <button type="button" className="sx-history-restore" onClick={() => setConfirmRestore(item.id)} disabled={busy}>
                            Restore
                          </button>
                          <button type="button" className="sx-history-delete" aria-label="Delete version" onClick={() => remove(item.id)} disabled={busy}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                          </button>
                        </>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
