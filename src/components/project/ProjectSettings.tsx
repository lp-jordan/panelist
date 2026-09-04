"use client";

import { useEffect, useState } from "react";
import { MembersPanel } from "@/components/project/MembersPanel";

type Member = { id: string; name: string; email: string; role: "OWNER" | "COLLABORATOR"; isSelf: boolean };
type Invite = { id: string; email: string; role: "OWNER" | "COLLABORATOR"; token: string };

// The gear in the project nav opens a settings modal; the team/invite management
// lives inside it rather than out on the hub (V2 D3). Reuses the app's shared
// scrim + form-sheet chrome (see ShortcutsSheet).
export function ProjectSettings({
  projectId,
  isOwner,
  members,
  invites,
}: {
  projectId: string;
  isOwner: boolean;
  members: Member[];
  invites: Invite[];
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="icon-btn"
        aria-label="Project settings"
        onClick={() => setOpen(true)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      <div className="scrim" data-open={open} onClick={() => setOpen(false)} />
      <div
        className="form-sheet"
        data-open={open}
        role="dialog"
        aria-label="Project settings"
        inert={!open}
      >
        <div className="form-sheet-card">
          <div className="form-sheet-head">
            <span />
            <strong>Team</strong>
            <button type="button" onClick={() => setOpen(false)}>Done</button>
          </div>
          <div className="members-body">
            {!isOwner && members.length <= 1 ? (
              <p className="invite-hint">You&apos;re the only person on this book.</p>
            ) : (
              <MembersPanel
                projectId={projectId}
                isOwner={isOwner}
                members={members}
                invites={invites}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
