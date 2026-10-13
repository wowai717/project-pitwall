export interface RaceLap {
  lap: number;
  dateStart?: string;
  lapTime: number | null;
  sector1: number | null;
  sector2: number | null;
  sector3: number | null;
  trapSpeed: number | null;
  pitOut: boolean;
}
export interface CarSample {
  date?: string;
  elapsed: number;
  speed: number;
  throttle: number;
  brake: number;
  rpm?: number;
  gear?: number;
  drs?: number;
}
export interface LocationSample {
  date?: string;
  x: number;
  y: number;
}
export interface TyreStint {
  compound: string;
  lapStart: number;
  lapEnd: number;
  stintNumber: number;
  tyreAgeAtStart: number | null;
}
export interface WeatherSample {
  date?: string;
  air_temperature?: number;
  track_temperature?: number;
  humidity?: number;
  wind_speed?: number;
  rainfall?: number;
}
export interface PitStop {
  lap: number;
  duration: number | null;
  date?: string;
}
export interface SessionData {
  sessionKey: number;
  circuitKey: number | null;
  laps: RaceLap[];
  stints: TyreStint[];
  weather: WeatherSample[];
  pits: PitStop[];
  missing: string[];
}
export interface LapData {
  cars: CarSample[];
  locations: LocationSample[];
}
export const validNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
export const positive = (value: unknown): value is number =>
  validNumber(value) && value > 0;
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
const numberOrNull = (value: unknown) => (positive(value) ? value : null);
type Raw = Record<string, unknown>;
export function formatLaps(rows: Raw[]): RaceLap[] {
  return rows
    .filter(
      (row) =>
        Number.isInteger(row.lap_number) &&
        Number(row.lap_number) > 0 &&
        Number(row.lap_number) <= 300,
    )
    .map((row) => ({
      lap: Number(row.lap_number),
      dateStart:
        typeof row.date_start === 'string' ? row.date_start : undefined,
      lapTime: numberOrNull(row.lap_duration),
      sector1: numberOrNull(row.duration_sector_1),
      sector2: numberOrNull(row.duration_sector_2),
      sector3: numberOrNull(row.duration_sector_3),
      trapSpeed: numberOrNull(row.st_speed),
      pitOut: row.is_pit_out_lap === true,
    }))
    .sort((a, b) => a.lap - b.lap);
}
export function eligibleLaps(laps: RaceLap[]) {
  return laps.filter((lap) => positive(lap.lapTime) && !lap.pitOut);
}
export function lapPlot(laps: RaceLap[], includePitOut: boolean) {
  if (!laps.length) return [];
  const byLap = new Map(laps.map((lap) => [lap.lap, lap]));
  const start = Math.min(...byLap.keys());
  const end = Math.max(...byLap.keys());
  return Array.from({ length: end - start + 1 }, (_, i) => {
    const record = byLap.get(start + i);
    return !record || (!includePitOut && record.pitOut)
      ? {
          lap: start + i,
          lapTime: null,
          sector1: null,
          sector2: null,
          sector3: null,
          trapSpeed: null,
        }
      : record;
  });
}
export function sensorPlot(cars: CarSample[]) {
  return cars.flatMap((car, i) => {
    const previous = cars[i - 1];
    const point = {
      ...car,
      throttle: validNumber(car.throttle) ? car.throttle : null,
      brake: validNumber(car.brake) ? car.brake : null,
    };
    return previous && car.elapsed - previous.elapsed > 1.5
      ? [
          {
            elapsed: (previous.elapsed + car.elapsed) / 2,
            speed: null,
            throttle: null,
            brake: null,
            rpm: null,
            gear: null,
          },
          point,
        ]
      : [point];
  });
}
export function bestLap(laps: RaceLap[]) {
  return eligibleLaps(laps).reduce<RaceLap | null>(
    (best, lap) => (!best || lap.lapTime! < best.lapTime! ? lap : best),
    null,
  );
}
export function lapSummary(laps: RaceLap[]) {
  const valid = eligibleLaps(laps);
  const times = valid.map((lap) => lap.lapTime!);
  const average = mean(times);
  const speeds = valid.map((lap) => lap.trapSpeed).filter(positive);
  return {
    best: bestLap(laps),
    average,
    count: valid.length,
    variation:
      average === null
        ? null
        : mean(times.map((time) => Math.abs(time - average))),
    trapMax: speeds.length ? Math.max(...speeds) : null,
  };
}
export function formatCars(rows: Raw[], lap: RaceLap): CarSample[] {
  const start = Date.parse(lap.dateStart ?? '');
  const end = start + (lap.lapTime ?? 0) * 1000;
  return rows
    .flatMap((row) => {
      const date = typeof row.date === 'string' ? row.date : '';
      const time = Date.parse(date);
      if (
        !Number.isFinite(time) ||
        time < start ||
        time > end ||
        !validNumber(row.speed) ||
        row.speed < 0
      )
        return [];
      return [
        {
          date,
          elapsed: (time - start) / 1000,
          speed: row.speed,
          throttle:
            validNumber(row.throttle) &&
            row.throttle >= 0 &&
            row.throttle <= 100
              ? row.throttle
              : Number.NaN,
          brake: validNumber(row.brake)
            ? row.brake > 0
              ? 100
              : 0
            : Number.NaN,
          rpm: validNumber(row.rpm) && row.rpm >= 0 ? row.rpm : undefined,
          gear:
            validNumber(row.n_gear) && row.n_gear >= 0 && row.n_gear <= 8
              ? row.n_gear
              : undefined,
          drs: validNumber(row.drs) ? row.drs : undefined,
        },
      ];
    })
    .sort((a, b) => a.elapsed - b.elapsed);
}
export function formatStints(rows: Raw[]): TyreStint[] {
  return rows
    .filter(
      (row) =>
        positive(row.lap_start) &&
        positive(row.lap_end) &&
        row.lap_end >= row.lap_start,
    )
    .map((row, i) => ({
      compound: typeof row.compound === 'string' ? row.compound : 'UNKNOWN',
      lapStart: Number(row.lap_start),
      lapEnd: Number(row.lap_end),
      stintNumber: positive(row.stint_number) ? row.stint_number : i + 1,
      tyreAgeAtStart:
        validNumber(row.tyre_age_at_start) && row.tyre_age_at_start >= 0
          ? row.tyre_age_at_start
          : null,
    }))
    .sort((a, b) => a.lapStart - b.lapStart);
}
export function weatherMetric(rows: WeatherSample[], key: keyof WeatherSample) {
  const values = rows.map((row) => row[key]).filter(validNumber);
  return values.length
    ? {
        average: mean(values)!,
        min: Math.min(...values),
        max: Math.max(...values),
        count: values.length,
      }
    : null;
}
