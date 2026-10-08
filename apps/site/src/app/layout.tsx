import type { Metadata } from "next";
import type { ReactNode } from "react";
import { CodeLanguageProvider } from "@/components/code-language";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Seamplayer | A video player for React",
  description:
    "Poster-first playback, a filmstrip timeline, chapters, captions, and familiar shortcuts. An open-source React video player.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <CodeLanguageProvider>{children}</CodeLanguageProvider>
        <Toaster offset={96} />
      </body>
    </html>
  );
}
