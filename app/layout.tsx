import type { Metadata } from "next";
import { Geom, Cabin, Roboto_Mono } from "next/font/google";
import "./globals.css";

// Explicit standing font choice (overrides DESIGN_SYSTEM.md §1's Google
// Sans/Inter guidance per direct instruction): Geom for headings, Cabin for
// body text everywhere. Keep using these two for any future typography
// work in this app unless told otherwise.
const fontHeading = Geom({
  variable: "--font-heading-family",
  subsets: ["latin"],
  weight: ["600", "700"],
});

const fontBody = Cabin({
  variable: "--font-primary",
  subsets: ["latin"],
});

const fontMono = Roboto_Mono({
  variable: "--font-mono-family",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Centr8 OS",
  description: "The AI-native operating system for work.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fontHeading.variable} ${fontBody.variable} ${fontMono.variable} h-full antialiased`}
    >
      {/* Dark mode is temporarily disabled (removed the theme-init script,
          the AppShell toggle, and the Settings theme selector) — it hit a
          known, currently-open React 19 + Next.js issue where any <script>
          rendered in the root layout (needed to apply the class before
          hydration, avoiding a flash of the wrong theme) logs a false-positive
          "Encountered a script tag" console warning with no real fix short of
          a cookie-based SSR theme read (see shadcn-ui/ui#10104). The
          `.dark` CSS in globals.css is left in place — re-adding dark mode
          later means restoring the toggle/script, not rebuilding the styles. */}
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
