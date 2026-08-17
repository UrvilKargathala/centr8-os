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
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("centr8-theme");if(t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme:dark)").matches))document.documentElement.classList.add("dark")}catch(e){}})()`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
