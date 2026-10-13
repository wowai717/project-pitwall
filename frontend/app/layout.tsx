import type { Metadata } from "next";
import Navigation from './Navigation';
import "./globals.css";

export const metadata: Metadata = {
  title: "F1 PITWALL | Enterprise Dashboard",
  description: "F1 Telemetry & Community Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="bg-[#050505] text-white min-h-screen flex flex-col antialiased">
        {/* 🏁 글로벌 네비게이션 바 (GNB) */}
        <a href="#main-content" className="sr-only focus:not-sr-only focus:p-3">본문으로 이동</a>
        <Navigation />

        {/* 📄 각 페이지의 내용이 들어갈 자리 */}
        <main id="main-content" className="flex-1 w-full min-w-0">
          {children}
        </main>
      </body>
    </html>
  );
}
