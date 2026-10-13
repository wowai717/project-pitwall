"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { clearSession, readSession } from './lib/auth';

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<ReturnType<typeof readSession>>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      clearTimeout(timer);
      const current = readSession();
      setSession(current);
      if (current) timer = setTimeout(() => { clearSession(); router.refresh(); }, Math.min(current.expiresAt - Date.now(), 2147483647));
    };
    update();
    window.addEventListener('storage', update);
    window.addEventListener('auth-change', update);
    return () => { clearTimeout(timer); window.removeEventListener('storage', update); window.removeEventListener('auth-change', update); };
  }, [pathname, router]);

  return (
    <nav aria-label="주 메뉴" className="sticky top-0 z-50 border-b border-neutral-800 bg-neutral-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-3 md:px-8">
        <Link href="/" className="text-xl font-black italic">PIT<span className="text-red-400">WALL.</span></Link>
        <div className="order-3 flex w-full gap-6 border-t border-neutral-800 pt-3 text-sm md:order-none md:w-auto md:border-0 md:pt-0">
          <Link href="/standings" aria-current={pathname === '/standings' || pathname.startsWith('/driver/') ? 'page' : undefined} className="text-neutral-300 aria-[current=page]:text-red-400">순위표</Link>
          <Link href="/community" aria-current={pathname === '/community' ? 'page' : undefined} className="text-neutral-300 aria-[current=page]:text-red-400">커뮤니티</Link>
        </div>
        <div className="flex min-w-0 items-center gap-3 text-sm">
          {session ? <><span className="max-w-28 truncate" title={session.username}>{session.username}</span><button type="button" onClick={() => { clearSession(); router.refresh(); }} className="min-h-10 text-neutral-300 hover:text-white">로그아웃</button></> : <><Link href="/login" className="py-2">로그인</Link><Link href="/register" className="rounded bg-white px-3 py-2 text-black">회원가입</Link></>}
        </div>
      </div>
    </nav>
  );
}
