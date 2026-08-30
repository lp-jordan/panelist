"use client";

import { useState } from "react";
import { Menu } from "@/components/ui/Menu";
import { ActionSheet } from "@/components/ui/ActionSheet";

/**
 * A row in the trash. Restore is the safe, one-click action; deleting forever
 * is behind a menu and then a sheet, because it is the only thing in the app
 * that cannot be undone.
 */
export function TrashRow({
  id,
  title,
  sublabel,
  kind,
  restoreAction,
  deleteAction,
  deleteDescription,
}: {
  id: string;
  title: string;
  sublabel: string;
  kind: "script" | "project";
  restoreAction: (formData: FormData) => void | Promise<void>;
  deleteAction: (formData: FormData) => void | Promise<void>;
  deleteDescription: string;
}) {
  const [deleting, setDeleting] = useState(false);

  return (
    <>
      <div className="row">
        <span className="row-main">
          <span className="row-title">{title}</span>
          <span className="row-sub">{sublabel}</span>
        </span>

        <form action={restoreAction}>
          <input type="hidden" name="id" value={id} />
          <button type="submit" className="btn-plain">
            Restore
          </button>
        </form>

        <Menu label={`More actions for ${title}`} contextSelector=".row">
          {(close) => (
            <button
              type="button"
              role="menuitem"
              className="danger"
              onClick={() => {
                close();
                setDeleting(true);
              }}
            >
              Delete forever
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
              </svg>
            </button>
          )}
        </Menu>
      </div>

      <ActionSheet
        open={deleting}
        onClose={() => setDeleting(false)}
        title={`Delete “${title}” forever?`}
        description={deleteDescription}
        confirmLabel={`Delete ${kind} forever`}
        action={deleteAction}
        hidden={{ id }}
      />
    </>
  );
}
