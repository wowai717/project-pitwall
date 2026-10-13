'use client';

import { useRouter } from 'next/navigation';

interface Props {
  driverId: string;
  year: string;
  round: number;
  drivers: Array<{ id: string; firstName: string; lastName: string }>;
  races: Array<{ round: number; raceName: string }>;
}

export default function DashboardSelection({
  driverId,
  year,
  round,
  drivers,
  races,
}: Props) {
  const router = useRouter();
  const selectClass =
    'mt-1 h-11 w-full min-w-0 rounded border border-neutral-700 bg-[#17191d] px-3 text-sm text-neutral-100 outline-offset-2';
  return (
    <div className="grid grid-cols-[100px_minmax(0,1fr)] gap-3 border-b border-neutral-800 py-4 md:grid-cols-[120px_minmax(0,1fr)_minmax(0,1.4fr)] md:gap-4">
      <label className="min-w-0 text-xs text-neutral-400">
        시즌
        <select
          aria-label="시즌"
          value={year}
          className={selectClass}
          onChange={(event) =>
            router.push(`/driver/${driverId}?year=${event.target.value}`)
          }
        >
          {['2020', '2021', '2022', '2023', '2024', '2025'].map((season) => (
            <option key={season} value={season}>
              {season}
            </option>
          ))}
        </select>
      </label>
      <label className="min-w-0 text-xs text-neutral-400">
        선수
        <select
          aria-label="선수"
          value={driverId}
          className={selectClass}
          onChange={(event) =>
            router.push(
              `/driver/${event.target.value}?year=${year}&round=${round}`,
            )
          }
        >
          {drivers.map((driver) => (
            <option key={driver.id} value={driver.id}>
              {driver.firstName} {driver.lastName}
            </option>
          ))}
        </select>
      </label>
      <label className="col-span-2 min-w-0 text-xs text-neutral-400 md:col-span-1">
        경기
        <select
          aria-label="경기"
          value={round}
          className={selectClass}
          onChange={(event) =>
            router.push(
              `/driver/${driverId}?year=${year}&round=${event.target.value}`,
            )
          }
        >
          {races.map((race) => (
            <option key={race.round} value={race.round}>
              R{race.round} · {race.raceName}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
