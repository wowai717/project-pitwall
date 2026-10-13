import Link from 'next/link';
import {
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { notFound } from 'next/navigation';
import TelemetryChart from '../../standings/TelemetryChart';
import DashboardSelection from '../DashboardSelection';

interface DriverResult {
  race: { round: number; raceName: string; date?: string };
  driver: { givenName: string; familyName: string; permanentNumber?: string };
  constructor?: { name?: string };
  position: number;
  points: number;
  grid?: number | null;
  laps?: number | null;
  status: string;
}

interface DriverOption {
  id: string;
  firstName: string;
  lastName: string;
}

export default async function DriverDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ year?: string; round?: string }>;
}) {
  const apiBase =
    process.env.API_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:4000';
  const { id: driverId } = await params;
  const resolvedSearchParams = await searchParams;
  const year = resolvedSearchParams.year || '2023';
  if (!/^202[0-5]$/.test(year) || !/^[a-z0-9_-]{1,64}$/.test(driverId))
    notFound();
  if (
    resolvedSearchParams.round &&
    (!/^\d{1,2}$/.test(resolvedSearchParams.round) ||
      Number(resolvedSearchParams.round) < 1)
  )
    notFound();

  const driversRequest: Promise<DriverOption[]> = fetch(
    `${apiBase}/f1/standings?year=${year}`,
    { cache: 'no-store', signal: AbortSignal.timeout(12000) },
  )
    .then(async (response) => (response.ok ? await response.json() : []))
    .catch(() => []);
  let results: DriverResult[] = [];
  let failed = false;
  try {
    const response = await fetch(
      `${apiBase}/f1/results?year=${year}&driverId=${encodeURIComponent(driverId)}`,
      { cache: 'no-store', signal: AbortSignal.timeout(12000) },
    );
    if (!response.ok) throw new Error('Results request failed');
    results = await response.json();
  } catch (error) {
    console.error('경기 기록 조회 실패:', error);
    failed = true;
  }
  const drivers = await driversRequest;

  if (!results.length)
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-[#0b0c0e] p-6 text-center">
        <div className="space-y-4 text-sm text-neutral-300">
          <p role={failed ? 'alert' : 'status'}>
            {failed
              ? '경기 기록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'
              : `${year} 시즌의 선수 기록이 없습니다.`}
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              className="inline-flex min-h-11 items-center text-cyan-300 underline"
              href={`/standings?year=${year}`}
            >
              순위표로 돌아가기
            </Link>
            {failed && (
              <Link
                className="inline-flex min-h-11 items-center text-white underline"
                href={`/driver/${driverId}?year=${year}`}
              >
                다시 시도
              </Link>
            )}
          </div>
        </div>
      </div>
    );

  const selectedRound = resolvedSearchParams.round
    ? Number(resolvedSearchParams.round)
    : results[0].race.round;
  const currentResult =
    results.find((result) => result.race.round === selectedRound) || results[0];
  const driverInfo = currentResult.driver;
  const driverNumber = driverInfo.permanentNumber || '0';
  const driverName = `${driverInfo.givenName} ${driverInfo.familyName}`;
  if (!drivers.some((driver) => driver.id === driverId))
    drivers.unshift({
      id: driverId,
      firstName: driverInfo.givenName,
      lastName: driverInfo.familyName,
    });
  const currentIndex = results.indexOf(currentResult);

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#0b0c0e] px-4 py-5 text-white md:px-8 md:py-6">
      <div className="mx-auto max-w-[1600px]">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-800 pb-4">
          <div className="min-w-0">
            <Link
              href={`/standings?year=${year}`}
              className="mb-1 inline-flex min-h-11 items-center gap-1.5 text-xs text-neutral-400 hover:text-white"
            >
              <ArrowLeft size={14} aria-hidden="true" />
              순위표로 돌아가기
            </Link>
            <h1 className="text-2xl font-semibold md:text-3xl">
              {driverName}{' '}
              <span className="ml-1 text-lg font-normal tabular-nums text-neutral-500">
                #{driverNumber}
              </span>
            </h1>
            <p className="mt-1 text-sm text-neutral-400">
              {currentResult.constructor?.name || '레이스 분석'}
              <span className="mx-2 text-neutral-700">/</span>
              {year}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {results[currentIndex - 1] ? (
              <Link
                href={`/driver/${driverId}?year=${year}&round=${results[currentIndex - 1].race.round}`}
                aria-label="이전 경기"
                title="이전 경기"
                className="flex h-11 w-11 items-center justify-center rounded border border-neutral-700 text-neutral-300 hover:bg-neutral-800"
              >
                <ChevronLeft size={18} aria-hidden="true" />
              </Link>
            ) : (
              <button
                type="button"
                aria-label="이전 경기"
                title="이전 경기"
                disabled
                className="flex h-11 w-11 items-center justify-center rounded border border-neutral-800 text-neutral-700"
              >
                <ChevronLeft size={18} aria-hidden="true" />
              </button>
            )}
            {results[currentIndex + 1] ? (
              <Link
                href={`/driver/${driverId}?year=${year}&round=${results[currentIndex + 1].race.round}`}
                aria-label="다음 경기"
                title="다음 경기"
                className="flex h-11 w-11 items-center justify-center rounded border border-neutral-700 text-neutral-300 hover:bg-neutral-800"
              >
                <ChevronRight size={18} aria-hidden="true" />
              </Link>
            ) : (
              <button
                type="button"
                aria-label="다음 경기"
                title="다음 경기"
                disabled
                className="flex h-11 w-11 items-center justify-center rounded border border-neutral-800 text-neutral-700"
              >
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            )}
          </div>
        </header>

        <DashboardSelection
          driverId={driverId}
          year={year}
          round={currentResult.race.round}
          drivers={drivers}
          races={results.map((result) => result.race)}
        />

        <section
          aria-label="경기 결과"
          className="border-b border-neutral-800 py-5"
        >
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold md:text-xl">
              {currentResult.race.raceName}
            </h2>
            <span className="text-xs tabular-nums text-neutral-500">
              R{currentResult.race.round}
              {currentResult.race.date ? ` · ${currentResult.race.date}` : ''}
            </span>
          </div>
          <dl className="grid grid-cols-3 gap-x-4 gap-y-4 md:grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.4fr)]">
            <div>
              <dt className="text-xs text-neutral-500">결승 순위</dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums">
                P{currentResult.position}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-500">포인트</dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums text-red-400">
                {currentResult.points}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-500">출발 순위</dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums">
                {currentResult.grid != null
                  ? currentResult.grid > 0
                    ? `P${currentResult.grid}`
                    : currentResult.grid
                  : '-'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-500">주행 랩</dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums">
                {currentResult.laps ?? '-'}
              </dd>
            </div>
            <div className="col-span-2 md:col-span-1">
              <dt className="text-xs text-neutral-500">상태</dt>
              <dd className="mt-1 break-words text-sm font-medium leading-7 text-neutral-300">
                {currentResult.status === 'Finished'
                  ? '완주'
                  : currentResult.status}
              </dd>
            </div>
          </dl>
        </section>

        <div className="min-w-0 py-5">
          <TelemetryChart
            key={`${driverId}-${year}-${currentResult.race.round}`}
            year={Number(year)}
            round={currentResult.race.round}
            raceName={currentResult.race.raceName}
            raceDate={currentResult.race.date}
            driverNumber={driverNumber}
          />
        </div>

        <details className="border-y border-neutral-800 text-sm">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 py-3 text-neutral-300">
            {year} 시즌 경기 기록 · {results.length}경기
            <ChevronDown size={16} aria-hidden="true" />
          </summary>
          <ol className="grid divide-y divide-neutral-800 border-t border-neutral-800 md:grid-cols-2 md:gap-x-8">
            {results.map((result) => (
              <li key={result.race.round}>
                <Link
                  href={`/driver/${driverId}?year=${year}&round=${result.race.round}`}
                  aria-current={
                    result.race.round === currentResult.race.round
                      ? 'page'
                      : undefined
                  }
                  className="flex min-h-12 items-center justify-between gap-3 py-2 text-neutral-400 hover:text-white aria-[current=page]:text-red-400"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="w-7 shrink-0 text-xs tabular-nums text-neutral-500">
                      R{result.race.round}
                    </span>
                    <span className="text-sm">
                      {result.race.raceName.replace('Grand Prix', 'GP')}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm tabular-nums">
                    P{result.position}
                    <span className="ml-4 text-xs text-neutral-500">
                      {result.points} pts
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </details>
        <footer className="py-5 text-xs text-neutral-500">
          경기 결과 · Jolpica / F1DB
        </footer>
      </div>
    </div>
  );
}
