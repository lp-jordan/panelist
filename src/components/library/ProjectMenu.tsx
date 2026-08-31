"use client";

import { useState } from "react";
import { Menu } from "@/components/ui/Menu";
import { FormSheet } from "@/components/ui/FormSheet";
import { ActionSheet } from "@/components/ui/ActionSheet";
import { archiveProject, renameProject } from "@/app/actions/projects";

export function ProjectMenu({
  id,
  name,
  scriptCount,
  contextSelector = ".group-head",
}: {
  id: string;
  name: string;
  scriptCount: number;
  /* The element the menu anchors within — a group header on the old library,
     a row on the project-list home. */
  contextSelector?: string;
}) {
  const [renaming, setRenaming] = useState(false);
  const [archiving, setArchiving] = useState(false);

  return (
    <>
      <Menu label={`Actions for ${name}`} contextSelector={contextSelector}>
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
              Rename project
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 20h4L20 8l-4-4L4 16z" />
              </svg>
            </button>
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

      <FormSheet open={renaming} onClose={() => setRenaming(false)} title="Rename project" action={renameProject}>
        <input type="hidden" name="id" value={id} />
        <input className="field" name="name" defaultValue={name} aria-label="Project name" required />
      </FormSheet>

      {/* Archiving a project takes its scripts with it, which is exactly the
          kind of thing window.confirm was too small to say. */}
      <ActionSheet
        open={archiving}
        onClose={() => setArchiving(false)}
        title={`Move “${name}” to Trash?`}
        description={
          scriptCount > 0
            ? `Its ${scriptCount} script${scriptCount === 1 ? "" : "s"} go to Trash too. You can restore them together.`
            : "You can restore it from Trash."
        }
        confirmLabel="Move to Trash"
        action={archiveProject}
        hidden={{ id }}
      />
    </>
  );
}
