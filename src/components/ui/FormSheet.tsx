"use client";

import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Portal } from "./Portal";

/**
 * A small panel for naming things — rename, create. It comes down from the
 * top so it doesn't read as the same kind of event as the destructive sheet
 * rising from the bottom.
 *
 * Editing in a sheet rather than in place is deliberate: an always-visible
 * text input per row is what made the old library look like a form.
 */
export function FormSheet({
  open,
  onClose,
  title,
  submitLabel = "Save",
  action,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  submitLabel?: string;
  action: (formData: FormData) => void | Promise<void>;
  children: React.ReactNode;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);

    // Land in the field with its text selected, so renaming is type-and-enter.
    const timer = window.setTimeout(() => {
      const field = bodyRef.current?.querySelector<HTMLInputElement>("input:not([type=hidden])");
      field?.focus();
      field?.select();
    }, 260);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.clearTimeout(timer);
    };
  }, [open, onClose]);

  return (
    <Portal>
      <div className="scrim" data-open={open} onClick={onClose} />
      <div className="form-sheet" data-open={open} role="dialog" aria-label={title} inert={!open}>
        <form
          className="form-sheet-card"
          action={async (formData) => {
            await action(formData);
            onClose();
          }}
        >
          <div className="form-sheet-head">
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <strong>{title}</strong>
            <SubmitButton label={submitLabel} />
          </div>
          <div className="form-sheet-body" ref={bodyRef}>
            {children}
          </div>
        </form>
      </div>
    </Portal>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}>
      {pending ? "Saving…" : label}
    </button>
  );
}
