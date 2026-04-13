import Link from 'next/link';
// 기존 standings 폴더에 있는 텔레메트리 차트를 그대로 가져다 씁니다!
import TelemetryChart from '../../standings/TelemetryChart';

export default async function DriverDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ year?: string; round?: string }>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  const driverId = resolvedParams.id;
  const year = resolvedSearchParams.year || '2023';
  
  let results: any[] = [];

  try {
    // 백엔드에서 해당 선수의 1년 치 성적을 다 가져옵니다.
    const res = await fetch(`http://backend:3000/f1/results?year=${year}&driverId=${driverId}`, { cache: 'no-store' });
    if (res.ok) results = await res.json();
  } catch (error) {
    console.error('데이터 가져오기 실패:', error);
  }

  // 데이터가 아예 없으면 에러 화면 표시
  if (!results || results.length === 0) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center font-mono text-neutral-500">
        NO DATA FOUND FOR {driverId.toUpperCase()} IN {year}
      </div>
    );
  }

  // 선수 정보 추출 (첫 번째 결과에서 뽑아옴)
  const driverInfo = results[0]?.driver;
  const driverNumber = driverInfo?.permanentNumber || '0';

  // 현재 선택된 라운드 (URL 파라미터가 없으면 1라운드 또는 첫 번째 경기를 기본으로 설정)
  const selectedRound = resolvedSearchParams.round ? parseInt(resolvedSearchParams.round, 10) : results[0]?.race?.round;
  const currentResult = results.find((r) => r.race.round == selectedRound) || results[0];

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#050505] text-white p-4 md:p-8 font-sans selection:bg-red-600">
      <div className="max-w-7xl mx-auto">
        
        {/* 🏁 대시보드 헤더 */}
        <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-[#222] pb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Link href="/standings" className="text-xs font-mono text-neutral-500 hover:text-white transition-colors bg-[#111] px-3 py-1 rounded border border-[#333]">
                ← BACK TO STANDINGS
              </Link>
              <span className="text-[10px] font-mono text-red-500 bg-red-600/10 px-2 py-0.5 rounded border border-red-600/30 uppercase tracking-widest">
                Telemetry Dashboard
              </span>
            </div>
            <h1 className="text-5xl md:text-7xl font-black italic tracking-tighter uppercase text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
              {driverInfo.givenName} <span className="text-red-600">{driverInfo.familyName}</span>
            </h1>
          </div>
          <div className="text-right">
            <div className="text-4xl font-black italic text-neutral-300 font-mono tracking-tighter">#{driverNumber}</div>
            <div className="text-neutral-500 text-xs font-mono uppercase tracking-[0.2em] mt-1">{year} Season</div>
          </div>
        </header>

        {/* 💻 대시보드 메인 레이아웃 (2단 그리드) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* 좌측: 레이스 히스토리 (사이드바) */}
          <div className="lg:col-span-1 bg-[#0a0a0a] border border-[#222] rounded-xl p-4 flex flex-col h-[70vh]">
            <h2 className="text-xs font-mono text-neutral-500 tracking-widest mb-4 border-b border-[#222] pb-2">
              RACE HISTORY // {results.length} SESSIONS
            </h2>
            <div className="overflow-y-auto no-scrollbar flex-1 flex flex-col gap-2 pr-1">
              {results.map((res: any, index: number) => {
                const isSelected = res.race.round == selectedRound;
                
                // 순위 컬러링
                let posColor = 'text-neutral-500';
                if (res.position === 1) posColor = 'text-yellow-400';
                else if (res.position === 2) posColor = 'text-neutral-300';
                else if (res.position === 3) posColor = 'text-orange-400';

                return (
                  // 선택된 경기는 빨간색 네온 효과로 강조!
                  <Link 
                    key={index}
                    href={`/driver/${driverId}?year=${year}&round=${res.race.round}`}
                    className={`flex justify-between items-center p-3 rounded-lg border transition-all duration-300 ${
                      isSelected 
                        ? 'bg-red-600/10 border-red-600/50 shadow-[inset_4px_0_0_rgba(220,38,38,1)]' 
                        : 'bg-[#111] border-[#222] hover:bg-[#1a1a1a] hover:border-[#444]'
                    }`}
                  >
                    <div className="flex gap-3 items-center">
                      <span className={`text-[10px] font-mono tracking-wider w-6 text-center rounded py-1 ${isSelected ? 'bg-red-600 text-white' : 'bg-black/50 text-neutral-500'}`}>
                        R{res.race.round}
                      </span>
                      <span className={`font-bold text-sm tracking-wide ${isSelected ? 'text-white' : 'text-neutral-400'}`}>
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
          <div className="lg:col-span-2 flex flex-col gap-6">
            
            {/* 상단: 선택된 경기 요약 카드 */}
            <div className="bg-[#0a0a0a] border border-[#222] rounded-xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/5 blur-[50px] rounded-full pointer-events-none"></div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  <p className="text-green-500 font-mono text-[10px] tracking-[0.2em] uppercase">Session Active</p>
                </div>
                <h2 className="text-2xl font-black italic text-white tracking-tight">
                  {currentResult.race.raceName}
                </h2>
                <p className="text-neutral-500 text-xs font-mono mt-1">ROUND {currentResult.race.round} // {currentResult.race.date}</p>
              </div>
              
              <div className="mt-4 md:mt-0 flex gap-6 text-right">
                <div>
                  <p className="text-neutral-600 font-mono text-[10px] tracking-widest mb-1">FINISH</p>
                  <p className="text-2xl font-black italic text-white font-mono">P{currentResult.position}</p>
                </div>
                <div>
                  <p className="text-neutral-600 font-mono text-[10px] tracking-widest mb-1">POINTS</p>
                  <p className="text-2xl font-black italic text-red-500 font-mono">+{currentResult.points}</p>
                </div>
                <div>
                  <p className="text-neutral-600 font-mono text-[10px] tracking-widest mb-1">STATUS</p>
                  <p className="text-sm font-bold text-neutral-300 font-mono uppercase mt-1">{currentResult.status}</p>
                </div>
              </div>
            </div>

            {/* 하단: 거대한 텔레메트리 차트! */}
            <div className="flex-1 bg-[#0a0a0a] border border-[#222] rounded-xl p-2 relative min-h-[400px]">
              <TelemetryChart 
                year={parseInt(year, 10)} 
                round={currentResult.race.round} 
                driverNumber={driverNumber} 
              />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}