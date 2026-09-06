"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PreviewStatus } from "@/components/art/ArtPipelineClient";

export type ReaderPage = {
  pageNumber: number;
  previewUrl: string | null;
  mime: string | null;
  status: PreviewStatus | null;
};

// A distraction-free, full-screen read-through of a book's current art. Advance
// with a tap on the right (back on the left), a swipe, or the arrow keys; Escape
// returns to the art overview. Pages without a web preview show a placeholder so
// the sequence — and the page numbering — stays intact.
export function ArtReaderClient({
  scriptId,
  title,
  pages,
  startPage,
}: {
  scriptId: string;
  title: string;
  pages: ReaderPage[];
  startPage: number;
}) {
  const router = useRouter();
  const total = pages.length;
  const [idx, setIdx] = useState(() => Math.min(Math.max(0, startPage - 1), Math.max(0, total - 1)));
  const [chrome, setChrome] = useState(true);
  const chromeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const back = useCallback(() => router.push(`/scripts/${scriptId}/art`), [router, scriptId]);

  const go = useCallback(
    (delta: number) => {
      setIdx((i) => Math.min(Math.max(0, i + delta), Math.max(0, total - 1)));
    },
    [total],
  );

  // Auto-hide the top bar during reading; any interaction brings it back. The
  // page-turn handlers all call wake(), so changing pages reveals it too.
  const wake = useCallback(() => {
    setChrome(true);
    if (chromeTimer.current) clearTimeout(chromeTimer.current);
    chromeTimer.current = setTimeout(() => setChrome(false), 2600);
  }, []);
  // On mount, start the countdown to hide the chrome (setState fires later, in
  // the timer callback — not synchronously in the effect body).
  useEffect(() => {
    chromeTimer.current = setTimeout(() => setChrome(false), 2600);
    return () => {
      if (chromeTimer.current) clearTimeout(chromeTimer.current);
    };
  }, []);

  // Keep the URL's ?page in step so a refresh or share reopens the same page,
  // without pushing history entries per turn (replace, not push).
  useEffect(() => {
    const p = pages[idx]?.pageNumber;
    if (p) window.history.replaceState(null, "", `?page=${p}`);
  }, [idx, pages]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault();
        go(1);
        wake();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        go(-1);
        wake();
      } else if (e.key === "Escape") {
        back();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, wake, back]);

  // Horizontal swipe on touch. A short, mostly-horizontal drag turns the page.
  const touch = useRef<{ x: number; y: number } | null>(null);
  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY };
  }
  function onTouchEnd(e: React.TouchEvent) {
    const s = touch.current;
    touch.current = null;
    if (!s) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) {
      go(dx < 0 ? 1 : -1);
      wake();
    }
  }

  const cur = pages[idx];
  const atStart = idx <= 0;
  const atEnd = idx >= total - 1;

  return (
    <div className="reader" onMouseMove={wake} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className={`reader-bar${chrome ? "" : " reader-bar-hidden"}`}>
        <button className="reader-close" onClick={back} aria-label="Close reader">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Art pages
        </button>
        <span className="reader-title">{title}</span>
        <span className="reader-count">
          {total > 0 ? (
            <>
              {cur?.pageNumber ?? idx + 1} <span className="reader-of">/ {total}</span>
            </>
          ) : (
            "0 pages"
          )}
        </span>
      </div>

      {total === 0 ? (
        <div className="reader-stage">
          <div className="reader-empty">No pages to read yet.</div>
        </div>
      ) : (
        <>
          {/* Tap zones: left third goes back, the rest advances. They sit under
              the chrome and the nav buttons but over the page image. */}
          <button
            className="reader-zone reader-zone-prev"
            onClick={() => {
              go(-1);
              wake();
            }}
            aria-label="Previous page"
            disabled={atStart}
          />
          <button
            className="reader-zone reader-zone-next"
            onClick={() => {
              go(1);
              wake();
            }}
            aria-label="Next page"
            disabled={atEnd}
          />

          <div className="reader-stage">
            <ReaderPageView key={cur.pageNumber} page={cur} />
          </div>

          <button
            className={`reader-nav reader-nav-prev${chrome ? "" : " reader-bar-hidden"}`}
            onClick={() => {
              go(-1);
              wake();
            }}
            disabled={atStart}
            aria-label="Previous page"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button
            className={`reader-nav reader-nav-next${chrome ? "" : " reader-bar-hidden"}`}
            onClick={() => {
              go(1);
              wake();
            }}
            disabled={atEnd}
            aria-label="Next page"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}

function fmtType(mime: string | null) {
  return (mime ?? "file").split("/").pop()?.toUpperCase() ?? "FILE";
}

function ReaderPageView({ page }: { page: ReaderPage }) {
  if (page.previewUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="reader-img" src={page.previewUrl} alt={`Page ${page.pageNumber}`} draggable={false} />;
  }
  const label =
    page.status === "PENDING" || page.status === "PROCESSING"
      ? "Processing preview…"
      : page.status
        ? `${fmtType(page.mime)} — no web preview`
        : "No art yet";
  return (
    <div className="reader-blank">
      <span className="reader-blank-pg">Page {page.pageNumber}</span>
      <span className="reader-blank-msg">{label}</span>
    </div>
  );
}
