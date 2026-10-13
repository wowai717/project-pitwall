import Link from 'next/link';
// 기존 standings 폴더에 있는 텔레메트리 차트를 그대로 가져다 씁니다!
import TelemetryChart from '../../standings/TelemetryChart';
import { notFound } from 'next/navigation';

interface DriverResult {
  race: {
    round: number;
    raceName: string;
    date?: string;
  };
  driver: {
    givenName: string;
    familyName: string;
    permanentNumber?: string;
  };
  position: number;
  points: number;
  status: string;
}

export default async function DriverDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ year?: string; round?: string }>;
}) {
  const API_BASE_URL = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  const driverId = resolvedParams.id;
  const year = resolvedSearchParams.year || '2023';
  if (!/^202[0-5]$/.test(year) || !/^[a-z0-9_-]{1,64}$/.test(driverId)) notFound();

  let results: DriverResult[] = [];
  let failed = false;

  try {
    // 백엔드에서 해당 선수의 1년 치 성적을 다 가져옵니다.
    const res = await fetch(`${API_BASE_URL}/f1/results?year=${year}&driverId=${encodeURIComponent(driverId)}`, { cache: 'no-store', signal: AbortSignal.timeout(12000) });
    if (!res.ok) throw new Error('Results request failed');
    results = await res.json();
  } catch (error) {
    console.error('데이터 가져오기 실패:', error);
    failed = true;
  }

  // 데이터가 아예 없으면 에러 화면 표시
  if (!results || results.length === 0) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center font-mono text-neutral-500">
        <div className="space-y-4 p-6 text-center"><p role={failed ? 'alert' : 'status'}>{failed ? '경기 기록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.' : `${year} 시즌의 선수 기록이 없습니다.`}</p><Link className="inline-block text-cyan-300 underline" href={`/standings?year=${year}`}>순위표로 돌아가기</Link>{failed && <Link className="ml-4 inline-block text-white underline" href={`/driver/${driverId}?year=${year}`}>다시 시도</Link>}</div>
      </div>
    );
  }

  // 선수 정보 추출 (첫 번째 결과에서 뽑아옴)
  const driverInfo = results[0]?.driver;

  // 현재 선택된 라운드 (URL 파라미터가 없으면 1라운드 또는 첫 번째 경기를 기본으로 설정)
  const selectedRound = resolvedSearchParams.round ? parseInt(resolvedSearchParams.round, 10) : results[0]?.race?.round;
  const currentResult = results.find((r) => r.race.round == selectedRound) || results[0];
  const driverNumber = currentResult.driver?.permanentNumber || '0';

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#050505] text-white p-4 md:p-8 font-sans selection:bg-red-600">
      <div className="max-w-[1800px] mx-auto">
        
        {/* 🏁 대시보드 헤더 */}
        <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-[#222] pb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Link href={`/standings?year=${year}`} className="text-xs font-mono text-neutral-300 hover:text-white transition-colors bg-[#111] px-3 py-2 rounded border border-[#333]">
                ← 순위표로 돌아가기
              </Link>
              <span className="text-[10px] font-mono text-red-500 bg-red-600/10 px-2 py-0.5 rounded border border-red-600/30 uppercase tracking-widest">
                레이스 분석 대시보드
              </span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black italic uppercase text-white">
              {driverInfo.givenName} <span className="text-red-600">{driverInfo.familyName}</span>
            </h1>
          </div>
          <div className="text-right">
            <div className="text-4xl font-black italic text-neutral-300 font-mono tracking-tighter">#{driverNumber}</div>
            <div className="text-neutral-500 text-xs font-mono uppercase tracking-[0.2em] mt-1">{year} Season</div>
          </div>
        </header>

        {/* 💻 대시보드 메인 레이아웃 (2단 그리드) */}
        <div className="grid grid-cols-1 xl:grid-cols-[240px_minmax(0,1fr)] gap-6">
          
          {/* 좌측: 레이스 히스토리 (사이드바) */}
          <div className="border-b xl:border-b-0 xl:border-r border-[#222] pb-4 xl:pr-4 flex flex-col h-40 xl:h-[72vh] min-w-0">
            <h2 className="text-sm font-medium text-neutral-400 tracking-[0.18em] mb-4 border-b border-[#222] pb-2 uppercase">
              레이스 기록 | {results.length}경기
            </h2>
            <div className="overflow-y-auto no-scrollbar flex-1 flex flex-col gap-2 pr-1">
              {results.map((res, index: number) => {
                const isSelected = res.race.round === currentResult.race.round;
                
                // 순위 컬러링
                let posColor = 'text-neutral-500';
                if (res.position === 1) posColor = 'text-yellow-400';
                else if (res.position === 2) posColor = 'text-neutral-300';
                else if (res.position === 3) posColor = 'text-orange-400';

                return (
                  <Link 
                    key={index}
                    href={`/driver/${driverId}?year=${year}&round=${res.race.round}`}
                    aria-current={isSelected ? 'page' : undefined}
                    className={`flex justify-between items-center p-3 rounded-lg border transition-all duration-300 ${
                      isSelected 
                        ? 'bg-red-600/10 border-red-600/50 shadow-[inset_4px_0_0_rgba(220,38,38,1)]' 
                        : 'bg-[#111] border-[#222] hover:bg-[#1a1a1a] hover:border-[#444]'
                    }`}
                  >
                    <div className="flex gap-3 items-center">
                      <span className={`text-[10px] font-mono tracking-wider w-7 text-center rounded py-1 ${isSelected ? 'bg-red-600 text-white' : 'bg-black/50 text-neutral-500'}`}>
                        R{res.race.round}
                      </span>
                      <span className={`font-medium text-sm ${isSelected ? 'text-white' : 'text-neutral-400'}`}>
                        {res.race.raceName.replace('Grand Prix', 'GP')}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`text-lg font-black italic font-mono ${posColor}`}>P{res.position}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* 우측: 텔레메트리 모니터 (메인 뷰) */}
          <div className="min-w-0 flex flex-col gap-6">
            
            {/* 상단: 선택된 경기 요약 카드 */}
            <div className="border-b border-[#222] pb-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  <p className="text-green-500 font-medium text-[11px] tracking-[0.18em] uppercase">현재 선택 경기</p>
                </div>
                <h2 className="text-xl font-semibold text-white">
                  {currentResult.race.raceName}
                </h2>
                <p className="text-neutral-400 text-sm mt-1">라운드 {currentResult.race.round} | {currentResult.race.date}</p>
              </div>
              
              <div className="mt-4 md:mt-0 flex gap-6 text-right">
                <div>
                  <p className="text-neutral-600 text-[11px] tracking-[0.18em] mb-1 uppercase">결승 순위</p>
                  <p className="text-2xl font-black italic text-white font-mono">P{currentResult.position}</p>
                </div>
                <div>
                  <p className="text-neutral-600 text-[11px] tracking-[0.18em] mb-1 uppercase">포인트</p>
                  <p className="text-2xl font-black italic text-red-500 font-mono">+{currentResult.points}</p>
                </div>
                <div>
                  <p className="text-neutral-600 text-[11px] tracking-[0.18em] mb-1 uppercase">상태</p>
                  <p className="text-sm font-bold text-neutral-300 uppercase mt-1">{currentResult.status}</p>
                </div>
              </div>
            </div>

            {/* 하단: 거대한 텔레메트리 차트! */}
            <div className="flex-1 min-w-0">
              <TelemetryChart 
                key={`${driverId}-${year}-${currentResult.race.round}`}
                year={parseInt(year, 10)} 
                round={currentResult.race.round} 
                raceName={currentResult.race.raceName}
                raceDate={currentResult.race.date}
                driverNumber={driverNumber} 
              />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
