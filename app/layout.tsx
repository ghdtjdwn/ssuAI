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

const SITE_URL = "https://ssuai.vercel.app";
const DESCRIPTION =
  "숭실대 공개 캠퍼스 정보와 개인 학사·LMS·도서관 데이터를 대시보드와 승인 기반 AI 챗봇으로 연결하는 비공식 웹 앱. " +
  "Unofficial Soongsil University campus dashboard with approval-gated AI chat.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "ssuAI",
    template: "%s · ssuAI",
  },
  description: DESCRIPTION,
  applicationName: "ssuAI",
  openGraph: {
    type: "website",
    siteName: "ssuAI",
    locale: "ko_KR",
    url: "/",
    title: "ssuAI",
    description: DESCRIPTION,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "ssuAI 홈 — 오늘의 브리핑과 위젯 대시보드" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "ssuAI",
    description: DESCRIPTION,
    images: ["/og.png"],
  },
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
