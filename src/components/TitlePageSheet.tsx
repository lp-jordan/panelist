"use client";

import { useEffect, useRef, useState } from "react";

export type TitlePageValues = {
  title: string;
  author: string;
  draftLabel: string;
  /** yyyy-mm-dd, as taken by a native date field. */
  draftDate: string;
};

/**
 * The title page, opened in isolation over the editor. It shows the cover as it
 * reads on paper — title centered near the top, the "written by" credit beneath
 * it, the draft label and date in the bottom-left corner — with each of those
 * pieces an editable field in place. Editing here never touches the script's
 * pages; Done commits the four fields, Cancel/Escape discards them.
 */
export function TitlePageSheet({
  open,
  values,
  onClose,
  onSave,
}: {
  open: boolean;
  values: TitlePageValues;
  onClose: () => void;
  onSave: (next: TitlePageValues) => void;
}) {
  const [draft, setDraft] = useState<TitlePageValues>(values);
  const titleRef = useRef<HTMLInputElement>(null);

  // Reseed from the source of truth each time it opens, so a cancelled edit
  // never lingers into the next open.
  useEffect(() => {
    if (open) setDraft(values);
  }, [open, values]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    const timer = window.setTimeout(() => titleRef.current?.focus(), 260);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.clearTimeout(timer);
    };
  }, [open, onClose]);

  const set = <K extends keyof TitlePageValues>(key: K, value: TitlePageValues[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const commit = () => {
    onSave(draft);
    onClose();
  };

  return (
    <>
      <div className="scrim" data-open={open} onClick={onClose} />
      <div className="tp-dialog" data-open={open} role="dialog" aria-label="Title page" inert={!open}>
        <div className="tp-bar">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <strong>Title page</strong>
          <button type="button" className="tp-done" onClick={commit}>
            Done
          </button>
        </div>

        <div className="tp-sheet">
          <div className="tp-titleblock">
            <input
              ref={titleRef}
              className="tp-title"
              value={draft.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="TITLE"
              aria-label="Title"
            />
            <div className="tp-writtenby">
              <span>Written by</span>
              <input
                className="tp-author"
                value={draft.author}
                onChange={(e) => set("author", e.target.value)}
                placeholder="your name"
                aria-label="Written by"
              />
            </div>
          </div>

          <div className="tp-draft">
            <input
              className="tp-draft-label"
              value={draft.draftLabel}
              onChange={(e) => set("draftLabel", e.target.value)}
              placeholder="Draft #1"
              aria-label="Draft label"
            />
            <span className="tp-draft-colon">:</span>
            <input
              type="date"
              className="tp-draft-date"
              value={draft.draftDate}
              onChange={(e) => set("draftDate", e.target.value)}
              aria-label="Draft date"
            />
          </div>
        </div>
      </div>
    </>
  );
}
