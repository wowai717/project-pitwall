import Link from 'next/link';
import { ChevronRight, Flag } from 'lucide-react';
import { notFound } from 'next/navigation';

interface StandingData {
  id?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  code?: string;
  nationality: string;
  totalPoints: string | number;
  wins?: string | number;
}

export default async function StandingsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; type?: string }>;
}) {
  const apiBase =
    process.env.API_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:4000';
  const resolvedParams = await searchParams;
  const currentYear = resolvedParams.year || '2023';
  const currentType = resolvedParams.type || 'driver';
  const years = ['2020', '2021', '2022', '2023', '2024', '2025'];
  if (
    !years.includes(currentYear) ||
    !['driver', 'constructor'].includes(currentType)
  )
    notFound();

  let standings: StandingData[] = [];
  let failed = false;
  try {
    const endpoint = currentType === 'driver' ? 'standings' : 'constructors';
    const response = await fetch(
      `${apiBase}/f1/${endpoint}?year=${currentYear}`,
      { cache: 'no-store', signal: AbortSignal.timeout(12000) },
    );
    if (!response.ok) throw new Error('Standings request failed');
    standings = await response.json();
  } catch (error) {
    console.error('순위 조회 실패:', error);
    failed = true;
  }

  const rowClass =
    'grid grid-cols-[22px_minmax(0,1fr)_30px_52px_14px] items-center gap-2 px-3 md:grid-cols-[44px_minmax(0,1fr)_80px_110px_24px] md:gap-4 md:px-5';

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#0b0c0e] px-4 py-6 text-white md:px-8 md:py-8">
      <div className="mx-auto max-w-[1440px]">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-800 pb-5">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs text-neutral-400">
              <Flag size={14} className="text-red-400" aria-hidden="true" />
              F1 CHAMPIONSHIP
            </div>
            <h1 className="text-2xl font-semibold md:text-3xl">
              {currentYear} 시즌
            </h1>
          </div>
          <div className="self-end text-right text-sm text-neutral-400">
            <span className="block font-medium text-neutral-200">
              {currentType === 'driver' ? '드라이버 순위' : '컨스트럭터 순위'}
            </span>
            <span className="text-xs">
              {standings.length}
              {currentType === 'driver' ? '명' : '팀'}
            </span>
          </div>
        </header>

        <div className="flex flex-col gap-4 border-b border-neutral-800 py-4 lg:flex-row lg:items-center lg:justify-between">
          <nav
            aria-label="순위 종류"
            className="flex w-fit border-b border-neutral-700"
          >
            <Link
              href={`/standings?year=${currentYear}&type=driver`}
              aria-current={currentType === 'driver' ? 'page' : undefined}
              className={`flex min-h-11 items-center border-b-2 px-5 text-sm font-medium ${currentType === 'driver' ? 'border-red-400 text-white' : 'border-transparent text-neutral-400 hover:text-white'}`}
            >
              드라이버
            </Link>
            <Link
              href={`/standings?year=${currentYear}&type=constructor`}
              aria-current={currentType === 'constructor' ? 'page' : undefined}
              className={`flex min-h-11 items-center border-b-2 px-5 text-sm font-medium ${currentType === 'constructor' ? 'border-red-400 text-white' : 'border-transparent text-neutral-400 hover:text-white'}`}
            >
              팀
            </Link>
          </nav>
          <nav aria-label="시즌 선택" className="grid grid-cols-6 gap-1">
            {years.map((year) => (
              <Link
                key={year}
                href={`/standings?year=${year}&type=${currentType}`}
                aria-current={currentYear === year ? 'page' : undefined}
                className={`flex min-h-11 min-w-0 items-center justify-center rounded px-2 text-sm tabular-nums md:px-4 ${currentYear === year ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:bg-neutral-900 hover:text-white'}`}
              >
                {year}
              </Link>
            ))}
          </nav>
        </div>

        <div
          className={`${rowClass} min-h-11 border-b border-neutral-800 text-xs text-neutral-500`}
          aria-hidden="true"
        >
          <span>#</span>
          <span>{currentType === 'driver' ? '선수' : '팀'}</span>
          <span className="text-right">승수</span>
          <span className="text-right">포인트</span>
          <span />
        </div>
        {standings.length === 0 && (
          <div
            role={failed ? 'alert' : 'status'}
            className="py-12 text-center text-sm text-neutral-300"
          >
            <p>
              {failed
                ? '순위를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'
                : '이 시즌의 순위 기록이 없습니다.'}
            </p>
            {failed && (
              <Link
                className="mt-4 inline-flex min-h-11 items-center text-cyan-300 underline"
                href={`/standings?year=${currentYear}&type=${currentType}`}
              >
                다시 시도
              </Link>
            )}
          </div>
        )}
        <ol className="divide-y divide-neutral-800/80">
          {standings.map((item, index) => {
            const name =
              currentType === 'driver'
                ? `${item.firstName} ${item.lastName}`
                : item.name;
            const content = (
              <>
                <span
                  className={`text-sm tabular-nums ${index < 3 ? 'text-white' : 'text-neutral-500'}`}
                >
                  {index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block break-words text-sm font-semibold text-neutral-100 md:text-base">
                    {name}
                  </span>
                  <span className="mt-0.5 block text-xs text-neutral-500">
                    {item.code && (
                      <span className="mr-2 font-mono text-neutral-400">
                        {item.code}
                      </span>
                    )}
                    {item.nationality}
                  </span>
                </span>
                <span className="text-right text-sm tabular-nums text-neutral-400">
                  {item.wins ?? '-'}
                </span>
                <span className="text-right text-base font-semibold tabular-nums text-white">
                  {item.totalPoints ?? '-'}
                </span>
                <span>
                  {currentType === 'driver' && (
                    <ChevronRight
                      size={16}
                      className="text-neutral-600 group-hover:text-red-400"
                      aria-hidden="true"
                    />
                  )}
                </span>
              </>
            );
            return (
              <li key={item.id || item.name || index}>
                {currentType === 'driver' ? (
                  <Link
                    href={`/driver/${item.id}?year=${currentYear}`}
                    aria-label={`${name} 경기 기록`}
                    className={`${rowClass} group min-h-[68px] py-2 transition-colors hover:bg-neutral-900 focus-visible:bg-neutral-900 md:min-h-[64px]`}
                  >
                    {content}
                  </Link>
                ) : (
                  <div
                    className={`${rowClass} min-h-[68px] py-2 md:min-h-[64px]`}
                  >
                    {content}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
        <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-800 py-5 text-xs text-neutral-500">
          <span>시즌 순위 · Jolpica / F1DB</span>
          <Link
            href="/community"
            className="flex min-h-11 items-center hover:text-neutral-200"
          >
            커뮤니티
            <ChevronRight size={14} aria-hidden="true" />
          </Link>
        </footer>
      </div>
    </div>
  );
}
