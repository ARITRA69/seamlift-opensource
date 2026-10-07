import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "seamplayer/styles.css";

export const metadata: Metadata = {
  title: "Seamplayer | A video player for React",
  description:
    "Poster-first playback, a filmstrip timeline, chapters, captions, and familiar shortcuts. An open-source React video player.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
