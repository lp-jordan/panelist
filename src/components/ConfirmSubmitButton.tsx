"use client";

export function ConfirmSubmitButton({
  confirmMessage,
  children,
}: {
  confirmMessage: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      onClick={(event) => {
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      {children}
    </button>
  );
}
