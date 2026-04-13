import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

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
      <body className={`${inter.className} bg-[#050505] text-white min-h-screen flex flex-col`}>
        {/* 🏁 글로벌 네비게이션 바 (GNB) */}
        <nav className="sticky top-0 z-50 w-full bg-[#0a0a0a]/80 backdrop-blur-md border-b border-[#222]">
          <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
            {/* 로고 영역 */}
            <Link href="/" className="flex items-center gap-2 group">
              <span className="w-3 h-3 bg-red-600 rounded-sm group-hover:animate-pulse"></span>
              <span className="text-xl font-black italic tracking-tighter">
                PIT<span className="text-neutral-500">WALL.</span>
              </span>
            </Link>

            {/* 메인 메뉴 */}
            <div className="hidden md:flex items-center gap-8 text-sm font-mono tracking-widest text-neutral-400">
              <Link href="/standings" className="hover:text-white transition-colors">STANDINGS</Link>
              <Link href="/community" className="hover:text-white transition-colors relative">
                COMMUNITY <span className="absolute -top-2 -right-3 text-[8px] bg-red-600 text-white px-1 rounded">NEW</span>
              </Link>
            </div>

            {/* 로그인 / 유저 메뉴 */}
            <div className="flex items-center gap-4">
              <Link href="/login" className="text-xs font-mono tracking-widest text-neutral-400 hover:text-white transition-colors">
                LOGIN
              </Link>
              <Link href="/register" className="text-xs font-mono tracking-widest bg-white text-black px-4 py-2 rounded hover:bg-red-600 hover:text-white transition-all font-bold">
                JOIN
              </Link>
            </div>
          </div>
        </nav>

        {/* 📄 각 페이지의 내용이 들어갈 자리 */}
        <main className="flex-1 w-full">
          {children}
        </main>
      </body>
    </html>
  );
}