// Shared initials-circle avatar — extracted from the Team directory's
// inline pattern (app/(app)/team/page.tsx) so every "name + avatar" list
// row across the app (CRM tables included) looks the same.
export function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function Avatar({ name, size = 8 }: { name: string; size?: 8 | 9 }) {
  const dim = size === 9 ? "h-9 w-9" : "h-8 w-8";
  return (
    <span className={`flex ${dim} shrink-0 items-center justify-center rounded-full bg-neutral-100 text-caption font-semibold text-neutral-800`}>
      {initials(name || "?")}
    </span>
  );
}

// Rounded pill for multi-value cells (roles, tags) — same styling as the
// Team directory's role chips.
export function Pill({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-caption text-neutral-700">{children}</span>;
}

// Icon action buttons — same eye/pencil/trash SVGs as the Team directory's
// row actions, so every list's row-action column matches.
export function ViewIconLink({ href }: { href: string }) {
  return (
    <a href={href} title="View" aria-label="View" className="rounded-md p-1.5 text-neutral-600 hover:bg-primary-100 hover:text-primary-700 inline-flex">
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    </a>
  );
}

export function EditIconButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="rounded-md p-1.5 text-neutral-600 hover:bg-neutral-200" aria-label="Edit">
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21H3v-3.5L15.732 3.732z" />
      </svg>
    </button>
  );
}

export function DeleteIconButton({ onClick, label = "Delete" }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} className="rounded-md p-1.5 text-neutral-600 hover:bg-danger-100 hover:text-danger-600" aria-label={label}>
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a2 2 0 012-2h2a2 2 0 012 2v3" />
      </svg>
    </button>
  );
}
