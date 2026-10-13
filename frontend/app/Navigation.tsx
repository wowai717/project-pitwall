'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BarChart3, LogOut } from 'lucide-react';
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
      if (current)
        timer = setTimeout(
          () => {
            clearSession();
            router.refresh();
          },
          Math.min(current.expiresAt - Date.now(), 2147483647),
        );
    };
    update();
    window.addEventListener('storage', update);
    window.addEventListener('auth-change', update);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('storage', update);
      window.removeEventListener('auth-change', update);
    };
  }, [pathname, router]);

  return (
    <nav
      aria-label="주 메뉴"
      className="sticky top-0 z-50 border-b border-neutral-800 bg-[#101114]/95 backdrop-blur"
    >
      <div className="mx-auto flex max-w-[1664px] flex-wrap items-center justify-between gap-x-3 px-4 py-2 md:px-8">
        <Link
          href="/"
          className="flex min-h-11 items-center text-xl font-semibold"
        >
          PITWALL<span className="text-red-400">.</span>
        </Link>
        <div className="order-3 flex w-full gap-6 border-t border-neutral-800 text-sm md:order-none md:w-auto md:border-0">
          <Link
            href="/standings"
            aria-current={
              pathname === '/' ||
              pathname === '/standings' ||
              pathname.startsWith('/driver/')
                ? 'page'
                : undefined
            }
            className="flex min-h-11 items-center gap-2 text-neutral-300 hover:text-white aria-[current=page]:text-red-400"
          >
            <BarChart3 size={16} aria-hidden="true" />
            순위표
          </Link>
          <Link
            href="/community"
            aria-current={pathname === '/community' ? 'page' : undefined}
            className="flex min-h-11 items-center text-xs text-neutral-500 hover:text-neutral-200 aria-[current=page]:text-neutral-200"
          >
            커뮤니티
          </Link>
        </div>
        <div className="flex min-w-0 items-center gap-3 text-xs md:text-sm">
          {session ? (
            <>
              <span
                className="max-w-20 truncate text-neutral-400 md:max-w-28"
                title={session.username}
              >
                {session.username}
              </span>
              <button
                type="button"
                onClick={() => {
                  clearSession();
                  router.refresh();
                }}
                className="flex min-h-11 items-center gap-1.5 text-neutral-300 hover:text-white"
              >
                <LogOut size={15} aria-hidden="true" />
                로그아웃
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="flex min-h-11 items-center text-neutral-300 hover:text-white"
              >
                로그인
              </Link>
              <Link
                href="/register"
                className="flex min-h-11 items-center rounded border border-neutral-700 px-3 text-neutral-300 hover:border-neutral-500 hover:text-white"
              >
                회원가입
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
