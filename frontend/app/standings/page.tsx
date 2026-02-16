interface DriverStanding {
  firstName: string;
  lastName: string;
  code: string;
  nationality: string;
  totalPoints: string;
}

async function getStandings(): Promise<DriverStanding[]> {
  const res = await fetch('http://backend:3000/f1/standings', {
    cache: 'no-store', 
  });

  if (!res.ok) {
    throw new Error('Failed to fetch data');
  }

  return res.json();
}

// 메인 컴포넌트
export default async function StandingsPage() {
  let standings: DriverStanding[] = [];
  
  try {
    standings = await getStandings();
  } catch (error) {
    console.error(error);
  }

  return (
    <div className="min-h-screen bg-neutral-900 text-white p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        <header className="mb-10">
          <h1 className="text-3xl font-bold text-red-500 mb-2">DRIVER STANDINGS</h1>
          <p className="text-neutral-400">Server Side Rendering (SSR) Mode</p>
        </header>

        <div className="grid gap-4">
          {standings.map((driver, index) => (
            <div 
              key={index}
              className="flex items-center justify-between bg-neutral-800 p-4 rounded-lg border-l-4 border-transparent hover:border-red-600 transition-all"
            >
              <div className="flex items-center gap-6">
                <span className="text-2xl font-bold w-8 text-center">{index + 1}</span>
                <div>
                  <h2 className="text-xl font-bold">
                    {driver.firstName} {driver.lastName}
                  </h2>
                  <span className="text-sm text-neutral-500 bg-neutral-900 px-2 py-1 rounded">
                    {driver.nationality}
                  </span>
                </div>
              </div>
              
              <div className="text-right">
                <div className="text-2xl font-bold text-white">{driver.totalPoints}</div>
                <div className="text-xs text-neutral-500">PTS</div>
              </div>
            </div>
          ))}

          {standings.length === 0 && (
            <div className="text-center p-10 text-red-400">
              데이터를 불러오지 못했습니다. 백엔드 주소를 확인해주세요.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}