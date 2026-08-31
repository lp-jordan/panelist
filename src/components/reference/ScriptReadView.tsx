"use client";

import { useMemo, useState, useTransition, type MouseEvent } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { LockToggle } from "@/components/reference/LockToggle";
import { ScriptSheets, type TitlePageMeta } from "@/components/print/ScriptSheets";
import { createPlacement, deletePlacement } from "@/app/actions/references";
import type { JSONNode } from "@/lib/editor/serialize";

export type PinReference = { id: string; assetId: string; caption: string | null };
export type Placement = {
  id: string;
  pageNumber: number;
  xPct: number;
  yPct: number;
  reference: PinReference;
};

/**
 * The locked read view (V2 C, slice 2). Renders the script's printed sheets and
 * overlays reference pins on them by x/y. Placing a pin: pick a reference, then
 * click a spot on a page. Reading a pin: click its orange dot → the reference
 * opens in the right gutter (desktop) or a bottom sheet (mobile). A References
 * toggle hides every marker so the script reads exactly as it prints.
 */
export function ScriptReadView({
  scriptId,
  projectId,
  projectName,
  doc,
  meta,
  pageCount,
  placements,
  references,
}: {
  scriptId: string;
  projectId: string | null;
  projectName: string | null;
  doc: JSONNode;
  meta: TitlePageMeta;
  pageCount: number;
  placements: Placement[];
  references: PinReference[];
}) {
  const backHref = projectId ? `/projects/${projectId}` : "/";
  const backLabel = projectName ?? "Library";

  const [showRefs, setShowRefs] = useState(true);
  const [placingRef, setPlacingRef] = useState<PinReference | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Footnote-style numbering: stable order across the whole script.
  const placed = useMemo(
    () =>
      placements
        .filter((p) => p.pageNumber <= pageCount)
        .sort((a, b) => a.pageNumber - b.pageNumber || a.yPct - b.yPct || a.xPct - b.xPct),
    [placements, pageCount],
  );
  const numberOf = useMemo(() => {
    const map = new Map<string, number>();
    placed.forEach((p, i) => map.set(p.id, i + 1));
    return map;
  }, [placed]);
  const byPage = useMemo(() => {
    const map = new Map<number, Placement[]>();
    for (const p of placed) {
      const list = map.get(p.pageNumber) ?? [];
      list.push(p);
      map.set(p.pageNumber, list);
    }
    return map;
  }, [placed]);
  const orphans = useMemo(() => placements.filter((p) => p.pageNumber > pageCount), [placements, pageCount]);

  const active = placed.find((p) => p.id === activeId) ?? null;

  function placeOnPage(pageNumber: number, event: MouseEvent<HTMLDivElement>) {
    if (!placingRef) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const xPct = (event.clientX - rect.left) / rect.width;
    const yPct = (event.clientY - rect.top) / rect.height;
    const ref = placingRef;
    setPlacingRef(null);
    startTransition(() => {
      createPlacement({ referenceId: ref.id, scriptId, pageNumber, xPct, yPct });
    });
  }

  function removePin(id: string) {
    setActiveId(null);
    startTransition(() => deletePlacement({ id, scriptId }));
  }

  const renderPageOverlay = (pageNo: number) => (
    <div
      className={`pin-layer${placingRef ? " pin-layer--placing" : ""}`}
      onClick={placingRef ? (e) => placeOnPage(pageNo, e) : undefined}
    >
      {showRefs &&
        (byPage.get(pageNo) ?? []).map((p) => (
          <button
            key={p.id}
            type="button"
            className={`pin-dot${activeId === p.id ? " pin-dot--active" : ""}`}
            style={{ left: `${p.xPct * 100}%`, top: `${p.yPct * 100}%` }}
            onClick={(e) => {
              e.stopPropagation();
              if (!placingRef) setActiveId(p.id);
            }}
            aria-label={`Reference ${numberOf.get(p.id)}${p.reference.caption ? ` — ${p.reference.caption}` : ""}`}
          >
            {numberOf.get(p.id)}
          </button>
        ))}
    </div>
  );

  return (
    <div className="shell rv-shell">
      <nav className="nav">
        <Link href={backHref} className="nav-back" aria-label={`Back to ${backLabel}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
          <span className="nav-back-label">{backLabel}</span>
        </Link>
        <span className="nav-spacer" />
        <span className="nav-title">{meta.title}</span>
        <span className="nav-spacer" />
        <button
          type="button"
          className={`ref-switch${showRefs ? " ref-switch--on" : ""}`}
          onClick={() => setShowRefs((v) => !v)}
          aria-pressed={showRefs}
          title={showRefs ? "Hide reference markers" : "Show reference markers"}
        >
          <span className="ref-switch-track"><span className="ref-switch-knob" /></span>
          References
        </button>
        <ThemeToggle />
        <LockToggle id={scriptId} locked />
      </nav>

      {/* Placement affordance / mode banner. */}
      <div className="rc-toolbar">
        {placingRef ? (
          <div className="place-banner">
            <span className="place-thumb" style={{ backgroundImage: `url(/api/assets/${placingRef.assetId})` }} />
            <span className="place-text">
              Click a spot on a page to place{placingRef.caption ? ` “${placingRef.caption}”` : " this reference"}.
            </span>
            <button type="button" className="place-cancel" onClick={() => setPlacingRef(null)}>
              Cancel
            </button>
          </div>
        ) : (
          <>
            <button type="button" className="ref-add" onClick={() => setPickerOpen(true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Pin a reference
            </button>
            {orphans.length > 0 && (
              <button type="button" className="orphan-chip" onClick={() => setActiveId("__orphans__")}>
                {orphans.length} unplaced
              </button>
            )}
          </>
        )}
      </div>

      <div className="rc-body">
        <div className="rc-stage">
          <ScriptSheets doc={doc} meta={meta} renderPageOverlay={renderPageOverlay} />
        </div>

        {/* Desktop gutter. On mobile it's hidden and the sheet below is used. */}
        <aside className="rc-gutter">
          {activeId === "__orphans__" ? (
            <OrphanList orphans={orphans} onRemove={removePin} />
          ) : active ? (
            <PinDetail placement={active} number={numberOf.get(active.id) ?? 0} onRemove={removePin} />
          ) : (
            <p className="rc-hint">Click a marker to see its reference.</p>
          )}
        </aside>
      </div>

      {/* Mobile bottom sheet: the same detail, revealed on demand. */}
      <div className={`rc-scrim${active || activeId === "__orphans__" ? " open" : ""}`} onClick={() => setActiveId(null)} />
      <div className={`rc-sheet${active || activeId === "__orphans__" ? " open" : ""}`} role="dialog" aria-hidden={!active && activeId !== "__orphans__"}>
        <div className="rc-sheet-grab" />
        {activeId === "__orphans__" ? (
          <OrphanList orphans={orphans} onRemove={removePin} />
        ) : active ? (
          <PinDetail placement={active} number={numberOf.get(active.id) ?? 0} onRemove={removePin} />
        ) : null}
      </div>

      {pickerOpen && (
        <ReferencePicker
          scriptId={scriptId}
          references={references}
          onPick={(ref) => {
            setPickerOpen(false);
            setActiveId(null);
            setPlacingRef(ref);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}

function PinDetail({ placement, number, onRemove }: { placement: Placement; number: number; onRemove: (id: string) => void }) {
  return (
    <div className="pin-detail">
      <div className="pin-detail-img" style={{ backgroundImage: `url(/api/assets/${placement.reference.assetId})` }} />
      <div className="pin-detail-head">
        <span className="pin-detail-num">{number}</span>
        <span className="pin-detail-where">Page {placement.pageNumber}</span>
      </div>
      {placement.reference.caption && <p className="pin-detail-cap">{placement.reference.caption}</p>}
      <button type="button" className="pin-detail-remove" onClick={() => onRemove(placement.id)}>
        Remove pin
      </button>
    </div>
  );
}

function OrphanList({ orphans, onRemove }: { orphans: Placement[]; onRemove: (id: string) => void }) {
  return (
    <div className="orphan-list">
      <h4>Unplaced references</h4>
      <p className="rc-hint">Their page was removed. The reference is kept — remove the pin or re-pin it.</p>
      {orphans.map((p) => (
        <div className="orphan-row" key={p.id}>
          <span className="orphan-thumb" style={{ backgroundImage: `url(/api/assets/${p.reference.assetId})` }} />
          <span className="orphan-cap">{p.reference.caption ?? "Reference"}</span>
          <button type="button" className="orphan-remove" onClick={() => onRemove(p.id)} aria-label="Remove pin">
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

function ReferencePicker({
  scriptId,
  references,
  onPick,
  onClose,
}: {
  scriptId: string;
  references: PinReference[];
  onPick: (ref: PinReference) => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="rc-scrim open" onClick={onClose} />
      <div className="picker" role="dialog" aria-label="Pick a reference to pin">
        <div className="picker-head">
          <strong>Pin a reference</strong>
          <button type="button" onClick={onClose}>Cancel</button>
        </div>
        {references.length === 0 ? (
          <div className="empty">
            <h4>No references yet</h4>
            <p>
              Add images in this issue’s <Link href={`/scripts/${scriptId}/reference`}>reference library</Link> first.
            </p>
          </div>
        ) : (
          <div className="picker-grid">
            {references.map((ref) => (
              <button key={ref.id} type="button" className="picker-card" onClick={() => onPick(ref)}>
                <span className="picker-img" style={{ backgroundImage: `url(/api/assets/${ref.assetId})` }} />
                {ref.caption && <span className="picker-cap">{ref.caption}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
