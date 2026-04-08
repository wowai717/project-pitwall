import Link from 'next/link';

interface DriverStanding {
  firstName: string;
  lastName: string;
  code: string;
  nationality: string;
  totalPoints: number;
}

export default async function StandingsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const searchParamsData = await searchParams;
  const years = ['2020', '2021', '2022', '2023', '2024', '2025'];
  const currentYear = searchParamsData.year || years[years.length - 1];

  let standings: DriverStanding[] = [];

  try {
    const res = await fetch(`http://backend:3000/f1/standings?year=${currentYear}`, {
      cache: 'no-store',
    });

    if (res.ok) {
      standings = await res.json();
    }
  } catch (error) {
    console.error('데이터 가져오기 실패:', error);
  }

  return (
    <div className="min-h-screen bg-neutral-900 text-white p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <h1 className="text-4xl font-black text-red-600 tracking-tighter mb-2">F1 PITWALL</h1>
          <p className="text-neutral-400">Championship Standings ({currentYear} Season)</p>
        </header>

        <div className="flex gap-2 mb-8 bg-neutral-800 p-2 rounded-lg w-fit">
          {years.map((year) => (
            <Link
              key={year}
              href={`/standings?year=${year}`}
              className={`px-6 py-2 rounded-md font-bold transition-all ${
                currentYear === year
                  ? 'bg-red-600 text-white shadow-lg'
                  : 'text-neutral-400 hover:bg-neutral-700 hover:text-white'
              }`}
            >
              {year}
            </Link>
          ))}
        </div>

        <div className="grid gap-4">
          {standings.length > 0 ? (
            standings.map((driver, index) => (
              <div
                key={index}
                className="flex items-center justify-between bg-neutral-800 p-4 rounded-lg border-l-4 border-transparent hover:border-red-600 transition-all group"
              >
                <div className="flex items-center gap-6">
                  <span className="text-2xl font-black w-8 text-center text-neutral-500 group-hover:text-white transition-colors">
                    {index + 1}
                  </span>
                  <div>
                    <h2 className="text-xl font-bold tracking-tight">
                      {driver.firstName} <span className="text-red-500">{driver.lastName.toUpperCase()}</span>
                    </h2>
                    <div className="flex gap-2 mt-1">
                      <span className="text-xs text-neutral-400 bg-neutral-900 px-2 py-0.5 rounded font-mono">
                        {driver.code}
                      </span>
                      <span className="text-xs text-neutral-500">{driver.nationality}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-3xl font-black text-white">{driver.totalPoints || 0}</div>
                  <div className="text-xs text-neutral-500 font-bold">PTS</div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center p-10 bg-neutral-800 rounded-lg border border-dashed border-neutral-600 text-neutral-400">
              해당 연도의 데이터가 없거나 로딩 중 에러가 발생했습니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}