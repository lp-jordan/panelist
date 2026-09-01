"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import { Portal } from "@/components/ui/Portal";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useTheme } from "@/components/ui/useTheme";
import { LockToggle } from "@/components/reference/LockToggle";
import { ScriptSheets, type TitlePageMeta } from "@/components/print/ScriptSheets";
import { toPageWordNumber } from "@/lib/editor/numberToWords";
import { createPlacement, deletePlacement } from "@/app/actions/references";
import type { Theme } from "@/lib/theme";
import type { JSONNode } from "@/lib/editor/serialize";

export type PinReference = { id: string; assetId: string; caption: string | null };
export type Placement = {
  id: string;
  pageNumber: number;
  xPct: number;
  yPct: number;
  reference: PinReference;
};

const SHEET_PX = 816; // 8.5in at 96dpi — the fixed sheet width to fit on mobile.

const THEME_OPTIONS: { value: Theme; label: string; icon: ReactNode }[] = [
  {
    value: "light",
    label: "Light",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4.2" />
        <path d="M12 2.5v2.2M12 19.3v2.2M4.2 12H2M22 12h-2.2M6.3 6.3L4.8 4.8M19.2 19.2l-1.5-1.5M17.7 6.3l1.5-1.5M4.8 19.2l1.5-1.5" />
      </svg>
    ),
  },
  {
    value: "dark",
    label: "Dark",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z" />
      </svg>
    ),
  },
  {
    value: "system",
    label: "Auto",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="18" height="12" rx="2" />
        <path d="M8 20h8M12 16v4" />
      </svg>
    ),
  },
];

/**
 * The locked read view (V2 C). The script's printed sheets on a desk with the
 * same page-outline the editor uses (reused .sx-outline classes), reference
 * pins overlaid by x/y, and References/lock/appearance folded into one settings
 * menu so the bar stays clean. On phones the sheets scale to fit the screen.
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
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [outlineCollapsed, setOutlineCollapsed] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [, startTransition] = useTransition();
  const stageRef = useRef<HTMLDivElement>(null);
  const fitRef = useRef<HTMLDivElement>(null);
  const scalerRef = useRef<HTMLDivElement>(null);

  // TEMPORARY diagnostic: prints the real layout numbers so we can tell why the
  // sheet text is oversized in the iOS Home-Screen app but not in a tab. Remove
  // once diagnosed.
  const [diag, setDiag] = useState("measuring…");
  useEffect(() => {
    const measure = () => {
      const cw = document.documentElement.clientWidth;
      const iw = window.innerWidth;
      const vv = Math.round(window.visualViewport?.width ?? 0);
      const fit = Math.min(1, (cw - 32) / SHEET_PX);
      const page = stageRef.current?.querySelector<HTMLElement>(".px-page");
      const line = stageRef.current?.querySelector<HTMLElement>(".px-panel-description, .px-panel-label, .px-text-element-content");
      const pageW = page ? Math.round(page.getBoundingClientRect().width) : 0;
      const fontPx = line ? getComputedStyle(line).fontSize : "?";
      const lineRect = line ? Math.round(line.getBoundingClientRect().height) : 0;
      const sa =
        window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone
          ? "STANDALONE"
          : "tab";
      setDiag(`${sa} dpr${window.devicePixelRatio} cw${cw} iw${iw} vv${vv} fit${fit.toFixed(2)} pageW${pageW} font${fontPx} lineH${lineRect}`);
    };
    const t = window.setTimeout(measure, 500);
    window.addEventListener("resize", measure);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", measure);
    };
  }, []);

  // Page list for the outline (script pages only; freeform pages are unnumbered).
  const pages = useMemo(() => {
    const out: { n: number; panelCount: number }[] = [];
    let n = 0;
    for (const node of doc.content ?? []) {
      if (node.type === "freeformPage") continue;
      n += 1;
      out.push({ n, panelCount: (node.content ?? []).filter((c) => c.type === "panel").length });
    }
    return out;
  }, [doc]);

  // Fit the fixed-width sheets to the screen (phones especially). min(1, …)
  // leaves desktop untouched. Measured off the document width so the element's
  // own zoom can't feed back into the measurement.
  useEffect(() => {
    const stage = stageRef.current;
    const fit = fitRef.current;
    const scaler = scalerRef.current;
    if (!stage || !fit || !scaler) return;
    const apply = () => {
      const avail = stage.clientWidth - 32;
      const k = Math.min(1, avail / SHEET_PX);
      // transform (not zoom): a purely visual scale of the whole subtree, so an
      // iOS-boosted font is scaled back down along with everything else. The
      // outer wrapper is sized to the scaled footprint so scrolling/centering
      // stay correct (transform alone leaves the layout box full-size).
      scaler.style.transform = `scale(${k})`;
      fit.style.width = `${SHEET_PX * k}px`;
      fit.style.height = `${scaler.offsetHeight * k}px`;
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(scaler);
    window.addEventListener("resize", apply);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", apply);
    };
  }, []);

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
  const showingOrphans = activeId === "__orphans__";
  const panelOpen = active !== null || showingOrphans;

  function scrollToPage(pageNo: number) {
    const sheets = stageRef.current?.querySelectorAll<HTMLElement>(".px-page");
    sheets?.[pageNo - 1]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

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
    <div className="sx-shell rv-shell">
      <nav className="nav">
        <Link href={backHref} className="nav-back" aria-label={`Back to ${backLabel}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
          <span className="nav-back-label">{backLabel}</span>
        </Link>
        <button
          type="button"
          className="icon-btn nav-pages-btn"
          onClick={() => setOutlineOpen((v) => !v)}
          aria-label="Pages"
          aria-expanded={outlineOpen}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <span className="nav-spacer" />
        <span className="nav-title">{meta.title}</span>
        <span className="nav-spacer" />

        {/* Desktop: inline. Below 640px these collapse into the actions sheet. */}
        <span className="nav-actions-inline">
          <button type="button" className="ref-add ref-add--bar" onClick={() => setPickerOpen(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Pin
          </button>
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
          {orphans.length > 0 && (
            <button type="button" className="orphan-chip" onClick={() => setActiveId("__orphans__")}>
              {orphans.length} unplaced
            </button>
          )}
        </span>
        <span className="nav-theme">
          <ThemeToggle />
        </span>

        {/* Unlock stays a standalone control in the bar, outside the menu. */}
        <LockToggle id={scriptId} locked />

        {/* Phones: the same sliders icon the editor uses for its actions sheet. */}
        <button
          type="button"
          className="icon-btn nav-actions-menu"
          onClick={() => setSheetOpen(true)}
          aria-label="Actions"
          aria-haspopup="dialog"
          aria-expanded={sheetOpen}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 8h11M5 8a2 2 0 104 0 2 2 0 10-4 0M8 16h11M19 16a2 2 0 10-4 0 2 2 0 104 0" />
          </svg>
        </button>
      </nav>

      {/* TEMPORARY diagnostic badge — remove once the mobile sizing is solved. */}
      <div
        style={{
          position: "fixed",
          left: 0,
          bottom: 0,
          zIndex: 9999,
          background: "#000",
          color: "#0f0",
          font: "10px/1.3 monospace",
          padding: "3px 5px",
          maxWidth: "100vw",
          whiteSpace: "normal",
          wordBreak: "break-all",
        }}
      >
        {diag}
      </div>

      <div className="sx-body">
        {/* Backs the mobile drawer; inert on desktop where the outline is a
            persistent floating card (same as the editor). */}
        <div className="sx-outline-scrim" data-open={outlineOpen} onClick={() => setOutlineOpen(false)} />
        <aside className="sx-outline" data-open={outlineOpen} data-collapsed={outlineCollapsed} aria-label="Pages">
          <div className="sx-outline-head">
            <button
              type="button"
              className="sx-outline-collapse"
              onClick={() => setOutlineCollapsed((v) => !v)}
              aria-expanded={!outlineCollapsed}
              aria-label={outlineCollapsed ? "Show pages" : "Collapse pages"}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="sx-outline-title">Pages</span>
            <span className="sx-outline-count">{pages.length}</span>
          </div>
          <ol className="sx-outline-list">
            {pages.map((page) => (
              <li key={page.n}>
                <button
                  type="button"
                  className="sx-outline-item"
                  onClick={() => {
                    scrollToPage(page.n);
                    setOutlineOpen(false);
                  }}
                >
                  <span className="sx-outline-num">{page.n}</span>
                  <span className="sx-outline-label">
                    {toPageWordNumber(page.n)}
                    <span className="sx-outline-sub">
                      {page.panelCount} panel{page.panelCount === 1 ? "" : "s"}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </aside>

        <div className="rc-stage" ref={stageRef}>
          <div className="rc-fit" ref={fitRef}>
            <div className="rc-scaler" ref={scalerRef}>
              <ScriptSheets doc={doc} meta={meta} renderPageOverlay={renderPageOverlay} />
            </div>
          </div>
        </div>
      </div>

      {placingRef && (
        <div className="place-float">
          <span className="place-thumb" style={{ backgroundImage: `url(/api/assets/${placingRef.assetId})` }} />
          <span className="place-text">
            Click a spot on a page to place{placingRef.caption ? ` “${placingRef.caption}”` : " this reference"}.
          </span>
          <button type="button" className="place-cancel" onClick={() => setPlacingRef(null)}>
            Cancel
          </button>
        </div>
      )}

      {panelOpen && (
        <aside className="rc-float">
          <button type="button" className="rc-float-close" onClick={() => setActiveId(null)} aria-label="Close">
            ✕
          </button>
          {showingOrphans ? (
            <OrphanList orphans={orphans} onRemove={removePin} />
          ) : active ? (
            <PinDetail placement={active} number={numberOf.get(active.id) ?? 0} onRemove={removePin} />
          ) : null}
        </aside>
      )}

      <div className={`rc-scrim${panelOpen ? " open" : ""}`} onClick={() => setActiveId(null)} />
      <div className={`rc-sheet${panelOpen ? " open" : ""}`} role="dialog" aria-hidden={!panelOpen}>
        <div className="rc-sheet-grab" />
        {showingOrphans ? (
          <OrphanList orphans={orphans} onRemove={removePin} />
        ) : active ? (
          <PinDetail placement={active} number={numberOf.get(active.id) ?? 0} onRemove={removePin} />
        ) : null}
      </div>

      <ReadSettingsSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        showRefs={showRefs}
        onToggleRefs={() => setShowRefs((v) => !v)}
        onPin={() => setPickerOpen(true)}
        orphanCount={orphans.length}
        onShowOrphans={() => setActiveId("__orphans__")}
      />

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
      {/* The whole image, uncropped — an artist needs to see all of it. */}
      <img className="pin-detail-img" src={`/api/assets/${placement.reference.assetId}`} alt={placement.reference.caption ?? "Reference"} />
      {placement.reference.caption && <p className="pin-detail-cap">{placement.reference.caption}</p>}
      <div className="pin-detail-foot">
        <span className="pin-detail-where">
          <span className="pin-detail-num">{number}</span>Page {placement.pageNumber}
        </span>
        <button type="button" className="pin-detail-remove" onClick={() => onRemove(placement.id)}>
          Remove
        </button>
      </div>
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

/**
 * The mobile actions sheet — same look as the editor's FormatSheet (reused
 * .sx-format-* classes), holding the read view's actions: pin a reference,
 * show/hide markers, and appearance. Unlock lives in the bar, not here.
 */
function ReadSettingsSheet({
  open,
  onClose,
  showRefs,
  onToggleRefs,
  onPin,
  orphanCount,
  onShowOrphans,
}: {
  open: boolean;
  onClose: () => void;
  showRefs: boolean;
  onToggleRefs: () => void;
  onPin: () => void;
  orphanCount: number;
  onShowOrphans: () => void;
}) {
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <Portal>
      <div className="scrim" data-open={open} onClick={onClose} />
      <div className="sx-format-sheet" data-open={open} role="dialog" aria-modal="true" aria-label="Actions">
        <div className="sx-format-card">
          <div className="sx-format-grip" aria-hidden="true">
            <span />
          </div>
          <div className="sx-format-body">
            <p className="sx-format-label">Reference</p>
            <div className="sx-format-grid">
              <button type="button" className="sx-format-btn" onClick={() => { onPin(); onClose(); }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Pin a reference
              </button>
              <button type="button" className="sx-format-btn" onClick={onToggleRefs}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {showRefs ? (
                    <>
                      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
                      <circle cx="12" cy="12" r="3" />
                    </>
                  ) : (
                    <path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.4 5.2A9.7 9.7 0 0112 5c6.5 0 10 7 10 7a17 17 0 01-3 3.8M6.1 6.1A17 17 0 002 12s3.5 7 10 7a9.7 9.7 0 003-.5" />
                  )}
                </svg>
                {showRefs ? "Hide markers" : "Show markers"}
              </button>
              {orphanCount > 0 && (
                <button type="button" className="sx-format-btn" onClick={() => { onShowOrphans(); onClose(); }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 9v4M12 17h.01M10.3 3.9L2 18a2 2 0 001.7 3h16.6a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
                  </svg>
                  Unplaced ({orphanCount})
                </button>
              )}
            </div>

            <p className="sx-format-label">Appearance</p>
            <div className="sx-format-seg" role="radiogroup" aria-label="Appearance">
              {THEME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={theme === opt.value}
                  className="sx-format-seg-btn"
                  data-active={theme === opt.value}
                  onClick={() => setTheme(opt.value)}
                >
                  {opt.icon}
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Portal>
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
