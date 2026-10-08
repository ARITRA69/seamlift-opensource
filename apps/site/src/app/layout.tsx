import type { Metadata } from "next";
import type { ReactNode } from "react";
import { CodeLanguageProvider } from "@/components/code-language";
import { Toaster } from "@/components/ui/sonner";
import { themeScript } from "@/lib/theme-script";
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <CodeLanguageProvider>{children}</CodeLanguageProvider>
        <Toaster />
      </body>
    </html>
  );
}
