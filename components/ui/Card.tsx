import Link from "next/link";
import { cn } from "@/lib/utils";
import { cardAccentClass, type BadgeColor } from "@/components/ui/Badge";

// shadcn-style primitive (data-slot attribute, cn() class merging) restyled
// against DESIGN_SYSTEM.md §5 tokens instead of shadcn's default oklch
// --card/--card-foreground variables. Three shapes cover everything a card
// took across the app: static (Card), a whole card that navigates
// (CardLink), a whole card that runs a click handler (CardButton, e.g.
// "open this sprint's board").
const BASE = "rounded-md glass-card shadow-sm";
const PADDING = { sm: "p-4", md: "p-6" } as const;
const INTERACTIVE = "text-left transition-shadow hover:shadow-md";

type CardProps = {
  color?: BadgeColor;
  padding?: keyof typeof PADDING;
  className?: string;
  children: React.ReactNode;
};

export function Card({ color, padding = "md", className, children }: CardProps) {
  return (
    <div data-slot="card" className={cn(BASE, PADDING[padding], color && cardAccentClass(color), className)}>
      {children}
    </div>
  );
}

export function CardLink({ href, color, padding = "md", className, children }: CardProps & { href: string }) {
  return (
    <Link
      data-slot="card"
      href={href}
      className={cn("block", BASE, PADDING[padding], INTERACTIVE, color && cardAccentClass(color), className)}
    >
      {children}
    </Link>
  );
}

export function CardButton({
  onClick,
  color,
  padding = "md",
  className,
  children,
}: CardProps & { onClick: () => void }) {
  return (
    <button
      data-slot="card"
      onClick={onClick}
      className={cn("w-full", BASE, PADDING[padding], INTERACTIVE, color && cardAccentClass(color), className)}
    >
      {children}
    </button>
  );
}
