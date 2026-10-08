import type { Metadata } from "next";
import type { ReactNode } from "react";
import { CodeLanguageProvider } from "@/components/code-language";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://opensource.seamlift.com"),
  title: {
    default: "Seamlift Open Source",
    template: "%s | Seamlift Open Source",
  },
  description:
    "Open-source tools from Seamlift, starting with Seamplayer, a video player for React.",
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
