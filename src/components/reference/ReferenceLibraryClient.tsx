"use client";

import { useState } from "react";
import { Menu } from "@/components/ui/Menu";
import { FormSheet } from "@/components/ui/FormSheet";
import { ActionSheet } from "@/components/ui/ActionSheet";
import { uploadReference, updateReferenceCaption, deleteReference } from "@/app/actions/references";
import { downscaleImage } from "@/lib/downscaleImage";

// Shrink the picked image in the browser before it's uploaded, so a large
// original never reaches the server or the DB blob store.
async function downscaleUpload(formData: FormData): Promise<FormData> {
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    formData.set("file", await downscaleImage(file));
  }
  return formData;
}

export type ReferenceCard = {
  id: string;
  assetId: string;
  caption: string | null;
  placementCount: number;
};

/**
 * The per-issue reference grid — the Milanote replacement (V2 §2.3, screen
 * 2). One image + a caption per card; an orange badge marks a reference already
 * pinned to a panel (placement lands in Phase C, so it only shows once count > 0).
 */
export function ReferenceLibraryClient({
  scriptId,
  references,
}: {
  scriptId: string;
  references: ReferenceCard[];
}) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ReferenceCard | null>(null);
  const [deleting, setDeleting] = useState<ReferenceCard | null>(null);

  return (
    <>
      <div className="ref-toolbar">
        <span className="ref-count">
          {references.length} reference{references.length === 1 ? "" : "s"}
        </span>
        <button type="button" className="ref-add" onClick={() => setAdding(true)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add reference
        </button>
      </div>

      {references.length === 0 ? (
        <div className="empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <circle cx="8.5" cy="9.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
          <h4>No reference yet</h4>
          <p>Add an image — a character, a location, a costume grab — and give it a note.</p>
        </div>
      ) : (
        <div className="ref-grid">
          {references.map((ref) => (
            <figure className="ref-card" key={ref.id}>
              <div className="ref-thumb">
                {/* Plain <img>: bytes come from the session-gated /api/assets
                    route, so Next's image optimizer would only add a hop. */}
                <img src={`/api/assets/${ref.assetId}`} alt={ref.caption ?? "Reference image"} loading="lazy" />
                {ref.placementCount > 0 && (
                  <span className="ref-pin" title={`Pinned in ${ref.placementCount} place${ref.placementCount === 1 ? "" : "s"}`}>
                    {ref.placementCount}
                  </span>
                )}
                <span className="ref-card-menu">
                  <Menu label="Reference actions" contextSelector=".ref-card">
                    {(close) => (
                      <>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            close();
                            setEditing(ref);
                          }}
                        >
                          Edit caption
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
                            setDeleting(ref);
                          }}
                        >
                          Delete
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                          </svg>
                        </button>
                      </>
                    )}
                  </Menu>
                </span>
              </div>
              {ref.caption && <figcaption className="ref-cap">{ref.caption}</figcaption>}
            </figure>
          ))}
        </div>
      )}

      <FormSheet open={adding} onClose={() => setAdding(false)} title="Add reference" submitLabel="Add" action={uploadReference} transform={downscaleUpload}>
        <input type="hidden" name="scriptId" value={scriptId} />
        <input className="field" type="file" name="file" accept="image/*" aria-label="Reference image" required />
        <input className="field" name="caption" placeholder="Caption (optional)" aria-label="Caption" />
      </FormSheet>

      <FormSheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Edit caption"
        action={updateReferenceCaption}
      >
        <input type="hidden" name="id" value={editing?.id ?? ""} />
        <input type="hidden" name="scriptId" value={scriptId} />
        <input
          className="field"
          name="caption"
          defaultValue={editing?.caption ?? ""}
          placeholder="Caption"
          aria-label="Caption"
          // Remount per reference so defaultValue tracks the selected card.
          key={editing?.id ?? "none"}
        />
      </FormSheet>

      <ActionSheet
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Delete this reference?"
        description="The image and its caption are removed. Any panel pins to it go too."
        confirmLabel="Delete"
        action={deleteReference}
        hidden={{ id: deleting?.id ?? "", scriptId }}
      />
    </>
  );
}
