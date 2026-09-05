"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createImportedScript } from "@/app/actions/import";

// Render each page to roughly this width (px). The read view sheet is 816px
// wide; a touch more keeps text crisp on high-DPI screens without bloating the
// stored PNG.
const TARGET_WIDTH = 1400;

type ParsedPage = {
  order: number;
  previewUrl: string; // object URL for the grid thumbnail
  blob: Blob; // full-res PNG uploaded on import
  text: string | null;
  included: boolean;
};

type Phase = "idle" | "parsing" | "review" | "uploading";

function stripExt(name: string) {
  return name.replace(/\.pdf$/i, "").trim();
}

export function PdfImporter({ projectId }: { projectId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [pages, setPages] = useState<ParsedPage[]>([]);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  const parse = useCallback(async (file: File) => {
    setError(null);
    setPhase("parsing");
    setTitle(stripExt(file.name) || "Imported script");

    try {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

      const data = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data }).promise;
      setProgress({ done: 0, total: pdf.numPages });

      const parsed: ParsedPage[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const base = page.getViewport({ scale: 1 });
        const scale = Math.min(3, TARGET_WIDTH / base.width);
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas unavailable.");
        // PDFs are transparent where unpainted; paint white so the sheet reads
        // as paper, not a checkerboard.
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport }).promise;

        const blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Render failed."))), "image/png"),
        );

        let text: string | null = null;
        try {
          const content = await page.getTextContent();
          const joined = content.items
            .map((item) => ("str" in item ? item.str : ""))
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();
          text = joined.length > 0 ? joined : null;
        } catch {
          text = null; // scanned page, no text layer — fine
        }

        parsed.push({ order: i - 1, previewUrl: URL.createObjectURL(blob), blob, text, included: true });
        page.cleanup();
        setProgress({ done: i, total: pdf.numPages });
      }

      setPages(parsed);
      setPhase("review");
    } catch (err) {
      console.error(err);
      setError("Couldn't read that PDF. Make sure it's a valid, unlocked PDF file.");
      setPhase("idle");
    }
  }, []);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void parse(file);
    e.target.value = ""; // allow re-picking the same file
  }

  function toggle(order: number) {
    setPages((prev) => prev.map((p) => (p.order === order ? { ...p, included: !p.included } : p)));
  }

  const includedCount = pages.filter((p) => p.included).length;

  async function submit() {
    if (includedCount === 0) {
      setError("Keep at least one page.");
      return;
    }
    setError(null);
    setPhase("uploading");

    const form = new FormData();
    form.set("projectId", projectId);
    form.set("title", title.trim() || "Imported script");
    form.set("meta", JSON.stringify(pages.map((p) => ({ included: p.included, text: p.text }))));
    pages.forEach((p) => form.append("image", new File([p.blob], `p${p.order}.png`, { type: "image/png" })));

    const result = await createImportedScript(form);
    if (result.error || !result.scriptId) {
      setError(result.error ?? "Import failed. Please try again.");
      setPhase("review");
      return;
    }
    router.push(`/scripts/${result.scriptId}`);
  }

  // --- render ---------------------------------------------------------------

  if (phase === "idle" || phase === "parsing") {
    return (
      <div className="import-drop">
        <input ref={inputRef} type="file" accept="application/pdf" hidden onChange={onPick} />
        {phase === "parsing" ? (
          <div className="import-parsing">
            <div className="import-spinner" aria-hidden="true" />
            <p>
              Reading your PDF{progress.total ? ` — page ${progress.done} of ${progress.total}` : "…"}
            </p>
          </div>
        ) : (
          <button type="button" className="import-dropzone" onClick={() => inputRef.current?.click()}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 3v5h5" />
              <path d="M6 3h8l5 5v11a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
              <path d="M12 11v6M9.5 13.5L12 11l2.5 2.5" />
            </svg>
            <strong>Choose a PDF</strong>
            <span>Its pages become an image-backed script — references and art work on top, but it can&apos;t be edited in the panel editor.</span>
          </button>
        )}
        {error && <p className="import-error">{error}</p>}
      </div>
    );
  }

  // review / uploading
  let running = 0;
  return (
    <div className="import-review">
      <div className="import-toolbar">
        <label className="import-title-field">
          <span>Title</span>
          <input
            className="field"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Script title"
            disabled={phase === "uploading"}
          />
        </label>
        <div className="import-count">
          <b>{includedCount}</b> page{includedCount === 1 ? "" : "s"} → <b>{includedCount}</b> art slot{includedCount === 1 ? "" : "s"}
        </div>
      </div>

      <p className="import-hint">Tap a page to exclude it from numbering — title pages, credits, anything that shouldn&apos;t count.</p>

      <div className="import-grid">
        {pages.map((p) => {
          const pageNo = p.included ? ++running : null;
          return (
            <button
              key={p.order}
              type="button"
              className="import-thumb"
              data-included={p.included}
              aria-pressed={p.included}
              aria-label={`PDF page ${p.order + 1}${p.included ? `, script page ${pageNo}, included` : ", excluded"}`}
              onClick={() => toggle(p.order)}
              disabled={phase === "uploading"}
            >
              <span className="import-toggle" aria-hidden="true">
                {p.included ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round"><path d="M6 12h12" /></svg>
                )}
              </span>
              <span className="import-chip">{p.included ? `PAGE ${pageNo}` : "SKIP"}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.previewUrl} alt="" className="import-sheet" draggable={false} />
            </button>
          );
        })}
      </div>

      {error && <p className="import-error">{error}</p>}

      <div className="import-actions">
        <button type="submit" className="btn-primary" onClick={submit} disabled={phase === "uploading" || includedCount === 0}>
          {phase === "uploading" ? "Importing…" : `Import ${includedCount} page${includedCount === 1 ? "" : "s"}`}
        </button>
      </div>
    </div>
  );
}
