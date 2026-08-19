import { forwardRef, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

// Same "rounded-md border border-neutral-300 bg-neutral-50 px-3 py-2
// text-body focus:outline focus:outline-2 focus:outline-primary-600" string
// was hand-typed at every form field across login/settings/task-detail/AI
// draft — Prompt 0.6 flagged it as the other missing shared primitive.
const FIELD_CLASSES =
  "w-full rounded-md glass-input px-3 py-2 text-body focus:border-primary-600 focus:outline-none";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = "", ...props }, ref) {
    return <input ref={ref} className={`${FIELD_CLASSES} ${className}`} {...props} />;
  },
);

export function Textarea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${FIELD_CLASSES} ${className}`} {...props} />;
}

export function Select({ className = "", children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${FIELD_CLASSES} ${className}`} {...props}>
      {children}
    </select>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-body-medium font-medium text-neutral-800">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}
