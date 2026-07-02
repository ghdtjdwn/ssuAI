import type { Metadata, Viewport } from "next";
import { JetBrains_Mono } from "next/font/google";

import { AppShell } from "@/components/shell/AppShell";

import { Providers } from "./providers";
import "./globals.css";

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-jetbrains",
});

export const metadata: Metadata = {
  title: "ssuAI",
  description: "Soongsil University student assistant dashboard",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Pinch-to-zoom stays enabled (no maximumScale / userScalable lock) so the
  // page stays accessible. The auto-zoom-on-input behavior on iOS Safari is
  // killed by sizing every input ≥ 16px on mobile, not by disabling zoom.
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={jetbrains.variable}>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
