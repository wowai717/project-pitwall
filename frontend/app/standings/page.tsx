import Link from 'next/link';

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
  const resolvedParams = await searchParams;
  const currentYear = resolvedParams.year || '2023';
  const currentType = resolvedParams.type || 'driver';
  const years = ['2020', '2021', '2022', '2023', '2024', '2025'];

  let standings: StandingData[] = [];
  
  try {
    const endpoint = currentType === 'driver' ? 'standings' : 'constructors';
    const res = await fetch(`http://backend:3000/f1/${endpoint}?year=${currentYear}`, { cache: 'no-store' });
    if (res.ok) standings = await res.json();
  } catch (error) {
    console.error('데이터 가져오기 실패:', error);
  }

  return (
    // 🏎️ 배경: 피트월 모니터 느낌의 다크 그리드 패턴
    <div className="min-h-screen bg-[#0a0a0a] bg-[radial-gradient(#2a2a2a_1px,transparent_1px)] [background-size:24px_24px] text-white p-4 md:p-12 font-sans selection:bg-red-600 selection:text-white relative">
      <div className="max-w-5xl mx-auto relative z-10">
        
        {/* 🏁 헤더: 모터스포츠 특유의 기울어진(Italic) 날렵한 타이포그래피 */}
        <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-neutral-800 pb-8 relative">
          <div className="absolute bottom-0 left-0 w-32 h-[1px] bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.8)]"></div>
          <div>
            <h1 className="text-6xl md:text-8xl font-black tracking-tighter uppercase italic flex items-center">
              <span className="text-red-600 pr-1">PIT</span>
              <span className="text-transparent bg-clip-text bg-gradient-to-br from-white to-neutral-600">WALL</span>
            </h1>
            <div className="flex items-center gap-3 mt-3">
              <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
              <p className="text-neutral-400 font-mono text-sm tracking-[0.2em] uppercase">Championship Data</p>
            </div>
          </div>
          <div className="text-left md:text-right">
            <div className="text-5xl font-black italic text-white font-mono tracking-tighter">{currentYear}</div>
            <div className="text-neutral-500 text-xs font-mono uppercase tracking-[0.2em] mt-1">Season</div>
          </div>
        </header>

        {/* 🎛️ 컨트롤 패널: 투명한 글래스 대시보드 느낌 */}
        <div className="sticky top-4 z-40 flex flex-col md:flex-row gap-4 justify-between items-center bg-black/40 backdrop-blur-xl p-2.5 rounded-xl border border-white/5 mb-12 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)]">
          <div className="flex bg-neutral-900/80 p-1 rounded-lg w-full md:w-auto border border-neutral-800">
            <Link href={`/standings?year=${currentYear}&type=driver`} className={`flex-1 md:w-32 text-center py-2 rounded-md text-xs font-bold uppercase tracking-widest transition-all duration-300 ${currentType === 'driver' ? 'bg-white text-black shadow-sm' : 'text-neutral-500 hover:text-white'}`}>Drivers</Link>
            <Link href={`/standings?year=${currentYear}&type=constructor`} className={`flex-1 md:w-32 text-center py-2 rounded-md text-xs font-bold uppercase tracking-widest transition-all duration-300 ${currentType === 'constructor' ? 'bg-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.3)]' : 'text-neutral-500 hover:text-white'}`}>Teams</Link>
          </div>
          
          <div className="flex gap-1 overflow-x-auto w-full md:w-auto no-scrollbar">
            {years.map((year) => (
              <Link key={year} href={`/standings?year=${year}&type=${currentType}`} className={`px-5 py-2 rounded-md text-sm font-mono transition-all duration-300 flex-shrink-0 ${currentYear === year ? 'bg-neutral-800/80 text-white border border-neutral-600' : 'text-neutral-500 hover:bg-neutral-800/50 hover:text-white border border-transparent'}`}>{year}</Link>
            ))}
          </div>
        </div>

        {/* 🏎️ 랭킹 리스트: 주행 궤적(레이싱 라인)을 모티브로 한 호버 이펙트 */}
        <div className="grid gap-3">
          {standings.map((item, index) => {
            // 👇 [핵심 변경 포인트!] 모달 대신 새로운 상세 페이지 라우팅으로 연결
            const linkHref = currentType === 'driver' 
              ? `/driver/${item.id}?year=${currentYear}` 
              : '#';
            
            return (
              <Link href={linkHref} key={index} className="group flex items-center justify-between bg-gradient-to-r from-neutral-900/60 to-black/40 hover:from-neutral-800/80 hover:to-neutral-900/60 p-4 md:p-5 rounded-lg border border-neutral-800/50 hover:border-neutral-600 transition-all duration-500 cursor-pointer overflow-hidden relative">
                {/* 왼쪽 레이싱 라인 (RPM 게이지 오르듯 차오르는 효과) */}
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-red-600 scale-y-0 group-hover:scale-y-100 transition-transform duration-300 origin-bottom"></div>
                
                <div className="flex items-center gap-6 md:gap-8 z-10 pl-2">
                  <span className="text-4xl font-black w-12 text-left text-neutral-800 group-hover:text-white transition-colors duration-500 italic font-mono">{index + 1}</span>
                  <div>
                    {currentType === 'driver' ? (
                      <>
                        <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white group-hover:translate-x-2 transition-transform duration-300 italic">
                          {item.firstName} <span className="text-neutral-400 group-hover:text-white transition-colors duration-300">{item.lastName?.toUpperCase()}</span>
                        </h2>
                        <div className="flex items-center gap-3 mt-1.5 opacity-60 group-hover:opacity-100 transition-all duration-300 group-hover:translate-x-2">
                          <span className="text-[10px] font-mono bg-neutral-800 border border-neutral-700 px-2 py-0.5 rounded-sm text-white tracking-widest">{item.code}</span>
                          <span className="text-xs text-neutral-400 font-medium tracking-wide uppercase">{item.nationality}</span>
                        </div>
                      </>
                    ) : (
                      <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white group-hover:translate-x-2 transition-transform duration-300 italic">{item.name}</h2>
                    )}
                  </div>
                </div>
                <div className="text-right z-10">
                  <div className="text-3xl md:text-4xl font-black text-white tracking-tighter font-mono group-hover:text-red-500 transition-colors duration-300">{item.totalPoints || 0}</div>
                  <div className="text-[10px] text-neutral-500 font-mono tracking-[0.2em] mt-0.5">PTS</div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  );
}