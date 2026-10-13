export interface Lap {
  lap: number;
  dateStart?: string;
  lapTime: number;
  sector1: number | null;
  sector2: number | null;
  sector3: number | null;
  trapSpeed: number | null;
}

export interface RawLap {
  lap_number: number;
  date_start?: string;
  lap_duration?: number | null;
  duration_sector_1?: number | null;
  duration_sector_2?: number | null;
  duration_sector_3?: number | null;
  st_speed?: number | null;
  is_pit_out_lap?: boolean;
}

export const positive = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;
export const mean = (values: number[]) =>
  values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;
export const seconds = (value: number | null) =>
  value === null ? '--' : value.toFixed(3);
export function lapClock(value: number | null) {
  if (value === null) return '--';
  const ms = Math.round(value * 1000);
  return `${Math.floor(ms / 60000)}:${((ms % 60000) / 1000).toFixed(3).padStart(6, '0')}`;
}

export function formatLaps(laps: RawLap[]): Lap[] {
  return laps
    .filter(
      (lap) =>
        !lap.is_pit_out_lap &&
        positive(lap.lap_duration) &&
        Number.isInteger(lap.lap_number) &&
        lap.lap_number > 0 &&
        lap.lap_number <= 1000,
    )
    .map((lap) => ({
      lap: lap.lap_number,
      dateStart: lap.date_start,
      lapTime: lap.lap_duration as number,
      sector1: positive(lap.duration_sector_1) ? lap.duration_sector_1 : null,
      sector2: positive(lap.duration_sector_2) ? lap.duration_sector_2 : null,
      sector3: positive(lap.duration_sector_3) ? lap.duration_sector_3 : null,
      trapSpeed: positive(lap.st_speed) ? lap.st_speed : null,
    }))
    .sort((a, b) => a.lap - b.lap);
}

export function fillLapGaps(laps: Lap[]) {
  if (!laps.length) return [];
  const byLap = new Map(laps.map((lap) => [lap.lap, lap]));
  const start = Math.min(...byLap.keys());
  const end = Math.max(...byLap.keys());
  return Array.from(
    { length: end - start + 1 },
    (_, i) =>
      byLap.get(start + i) ?? {
        lap: start + i,
        lapTime: null,
        sector1: null,
        sector2: null,
        sector3: null,
        trapSpeed: null,
      },
  );
}

export function summarizeLaps(laps: Lap[]) {
  const times = laps.map((lap) => lap.lapTime).filter(positive);
  const average = mean(times);
  const speeds = laps.map((lap) => lap.trapSpeed).filter(positive);
  return {
    best: times.length ? Math.min(...times) : null,
    average,
    variation:
      average === null
        ? null
        : mean(times.map((time) => Math.abs(time - average))),
    trapMax: speeds.length ? Math.max(...speeds) : null,
    count: times.length,
  };
}

export interface Point {
  x: number;
  y: number;
}

export function normalizeCoordinates(
  points: Point[],
  geographic = false,
): Point[] {
  const valid = points.filter(
    (p) => Number.isFinite(p.x) && Number.isFinite(p.y),
  );
  if (valid.length < 2) return [];
  const latitude = mean(valid.map((p) => p.y)) ?? 0;
  const xFactor = geographic ? Math.cos((latitude * Math.PI) / 180) : 1;
  const minX = Math.min(...valid.map((p) => p.x));
  const maxY = Math.max(...valid.map((p) => p.y));
  const shifted = valid.map((p) => ({
    x: (p.x - minX) * xFactor,
    y: maxY - p.y,
  }));
  const width = Math.max(...shifted.map((p) => p.x));
  const height = Math.max(...shifted.map((p) => p.y));
  if (Math.max(width, height) <= Number.EPSILON) return [];
  const scale = Math.min(
    width ? 560 / width : Infinity,
    height ? 350 / height : Infinity,
  );
  return shifted.map((p) => ({
    x: 40 + (560 - width * scale) / 2 + p.x * scale,
    y: 35 + (350 - height * scale) / 2 + p.y * scale,
  }));
}

export function weatherMetric(data: Record<string, unknown>[], field: string) {
  const values = data
    .map((row) => row[field])
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  return values.length
    ? {
        average: mean(values)!,
        min: Math.min(...values),
        max: Math.max(...values),
      }
    : null;
}
