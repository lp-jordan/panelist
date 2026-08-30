"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "@/components/ui/Menu";
import { FormSheet } from "@/components/ui/FormSheet";
import { ActionSheet } from "@/components/ui/ActionSheet";
import { archiveScript, duplicateScript, renameScript } from "@/app/actions/scripts";

export function ScriptRow({
  id,
  title,
  draftLabel,
  pageCount,
  editedLabel,
}: {
  id: string;
  title: string;
  draftLabel: string;
  pageCount: number;
  /* Formatted on the server so the row doesn't shift after hydration. */
  editedLabel: string;
}) {
  const [renaming, setRenaming] = useState(false);
  const [archiving, setArchiving] = useState(false);

  return (
    <>
      {/* The row is a div, not a link: it contains a menu button and a form,
          and neither may sit inside an anchor. The title's stretched ::after
          makes the whole row clickable instead. */}
      <div className="row">
        <span className="row-main">
          <Link href={`/scripts/${id}`} className="row-title row-link">
            {title}
          </Link>
          <span className="row-sub">
            {draftLabel}
            <span className="dot">·</span>
            {pageCount} page{pageCount === 1 ? "" : "s"}
            <span className="dot">·</span>
            edited {editedLabel}
          </span>
        </span>

        <Menu label={`Actions for ${title}`} contextSelector=".row">
          {(close) => (
            <>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  close();
                  setRenaming(true);
                }}
              >
                Rename
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 20h4L20 8l-4-4L4 16z" />
                </svg>
              </button>

              <form action={duplicateScript}>
                <input type="hidden" name="id" value={id} />
                <button type="submit" role="menuitem" onClick={close}>
                  Duplicate
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="9" y="9" width="11" height="11" rx="2" />
                    <path d="M5 15V5h10" />
                  </svg>
                </button>
              </form>

              <hr />

              <button
                type="button"
                role="menuitem"
                className="danger"
                onClick={() => {
                  close();
                  setArchiving(true);
                }}
              >
                Move to Trash
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                </svg>
              </button>
            </>
          )}
        </Menu>

        <svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 5l7 7-7 7" />
        </svg>
      </div>

      <FormSheet open={renaming} onClose={() => setRenaming(false)} title="Rename script" action={renameScript}>
        <input type="hidden" name="id" value={id} />
        <input className="field" name="title" defaultValue={title} aria-label="Script title" required />
      </FormSheet>

      <ActionSheet
        open={archiving}
        onClose={() => setArchiving(false)}
        title={`Move “${title}” to Trash?`}
        description="You can restore it from Trash."
        confirmLabel="Move to Trash"
        action={archiveScript}
        hidden={{ id }}
      />
    </>
  );
}
