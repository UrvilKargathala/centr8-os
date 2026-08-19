// Segmented control — first use is the Preferences panel (Theme/Density/
// Time format/Week starts on). Small enough that a fresh primitive beats
// pulling in a segmented-tab shadcn variant. Kept controlled + accessible
// (radiogroup semantics) so consumers just pass value + onChange.
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className = "",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      className={`inline-flex overflow-hidden glass rounded-md p-0.5 ${className}`}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`px-3 py-1.5 text-small font-medium transition ${
              active
                ? "rounded-sm bg-neutral-50 text-neutral-950 shadow-sm"
                : "text-neutral-600 hover:text-neutral-950"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
