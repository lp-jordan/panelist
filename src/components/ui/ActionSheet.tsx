"use client";

import { useEffect } from "react";
import { useFormStatus } from "react-dom";
import { Portal } from "./Portal";

/**
 * Confirmation for anything irreversible. Replaces `window.confirm`, which
 * couldn't name the object, state the consequence, or colour the dangerous
 * verb differently from the safe one.
 *
 * The action is a server action; `hidden` carries whatever it needs.
 */
export function ActionSheet({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  action,
  hidden,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  confirmLabel: string;
  action: (formData: FormData) => void | Promise<void>;
  hidden: Record<string, string>;
}) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  return (
    <Portal>
      <div className="scrim" data-open={open} onClick={onClose} />
      <div className="sheet" data-open={open} role="alertdialog" aria-label={title} inert={!open}>
        <form action={action} className="sheet-card">
          {Object.entries(hidden).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <div className="sheet-head">
            <strong>{title}</strong>
            {description && <span>{description}</span>}
          </div>
          <ConfirmButton label={confirmLabel} />
        </form>
        <div className="sheet-card sheet-card--cancel">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </Portal>
  );
}

// Server actions give no feedback on their own, so the button reports its own
// pending state rather than sitting there looking unpressed.
function ConfirmButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="danger" disabled={pending}>
      {pending ? "Working…" : label}
    </button>
  );
}
