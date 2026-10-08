import type { Metadata } from "next";
import type { ReactNode } from "react";
import { CodeLanguageProvider } from "@/components/code-language";
import { Toaster } from "@/components/ui/sonner";
import { siteUrl } from "@/lib/docs";
import { themeScript } from "@/lib/theme-script";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Seamlift Open Source",
    template: "%s | Seamlift Open Source",
  },
  description:
    "Open-source video tools from Seamlift: a player for every web framework and an adaptive HLS transcoder for your own compute.",
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
