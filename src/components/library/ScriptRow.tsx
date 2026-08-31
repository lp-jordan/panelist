"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "@/components/ui/Menu";
import { FormSheet } from "@/components/ui/FormSheet";
import { ActionSheet } from "@/components/ui/ActionSheet";
import { archiveScript, duplicateScript, moveScript, renameScript, setScriptLock } from "@/app/actions/scripts";
import { SCRIPT_DND_TYPE } from "./ScriptDropZone";

export function ScriptRow({
  id,
  projectId,
  title,
  draftLabel,
  pageCount,
  editedLabel,
  projects,
  locked = false,
}: {
  id: string;
  /* The group this row currently lives in; null for Unassigned. Lets a drop
     target ignore a drop back into the same group. */
  projectId: string | null;
  title: string;
  draftLabel: string;
  pageCount: number;
  /* Formatted on the server so the row doesn't shift after hydration. */
  editedLabel: string;
  /* Every project the script could be moved into, for the "Move to…" sheet. */
  projects: { id: string; name: string }[];
  /* Whether the script is in the locked reference read view. */
  locked?: boolean;
}) {
  const [renaming, setRenaming] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [moving, setMoving] = useState(false);
  const [dragging, setDragging] = useState(false);

  return (
    <>
      {/* The row is a div, not a link: it contains a menu button and a form,
          and neither may sit inside an anchor. The title's stretched ::after
          makes the whole row clickable instead. */}
      <div
        className={`row${dragging ? " row-dragging" : ""}`}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData(SCRIPT_DND_TYPE, id);
          e.dataTransfer.setData(`${SCRIPT_DND_TYPE}+project`, projectId ?? "");
          setDragging(true);
        }}
        onDragEnd={() => setDragging(false)}
      >
        <span className="row-main">
          <Link href={`/scripts/${id}`} className="row-title row-link" draggable={false}>
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

        {/* The two other destinations for this issue, beside the script: its
            reference set, and (soon) its art page layout. They sit above the
            title's stretched hit area via .row-act's z-index. */}
        <Link
          href={`/scripts/${id}/reference`}
          className="row-act"
          aria-label={`References for ${title}`}
          title="References"
          draggable={false}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <circle cx="8.5" cy="9.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
        </Link>
        <span className="row-act row-act--soon" role="img" aria-label="Art page layout — coming soon" title="Art page layout — coming soon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18M9 21V9" />
          </svg>
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

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  close();
                  setMoving(true);
                }}
              >
                Move to…
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 7h6l2 2h10v10H3z" />
                </svg>
              </button>

              <form action={setScriptLock}>
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="projectId" value={projectId ?? ""} />
                <input type="hidden" name="locked" value={locked ? "false" : "true"} />
                <button type="submit" role="menuitem" onClick={close}>
                  {locked ? "Unlock to edit" : "Lock for references"}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {locked ? <path d="M8 11V7a4 4 0 018 0" /> : <path d="M8 11V7a4 4 0 018 0v4" />}
                    <rect x="5" y="11" width="14" height="9" rx="2" />
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

      <FormSheet
        open={moving}
        onClose={() => setMoving(false)}
        title="Move script"
        submitLabel="Move"
        action={async (formData) => {
          const to = formData.get("projectId");
          await moveScript(id, typeof to === "string" && to.length > 0 ? to : null);
        }}
      >
        <select className="field" name="projectId" defaultValue={projectId ?? ""} aria-label="Project">
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
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
