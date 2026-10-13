'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, LoaderCircle, RotateCcw } from 'lucide-react';
import circuits from './data/f1-circuits.json';
import hints from './data/trackCircuitHints.json';
import IntegratedAnalysis from './IntegratedAnalysis';
import {
  bestLap,
  formatCars,
  formatLaps,
  formatStints,
  positive,
  validNumber,
  type LapData,
  type LocationSample,
  type RaceLap,
  type SessionData,
  type WeatherSample,
} from './analysis-data';
import { fitTrackPoints, type MultiViewerCircuit } from './track-geometry';

interface Props {
  year: number;
  round: number;
  raceName: string;
  raceDate?: string;
  driverNumber: string;
}
type Raw = Record<string, unknown>;
const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/grand prix/g, 'gp')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
const words = (text: string) =>
  normalize(text)
    .split(' ')
    .filter((word) => word && !['gp', 'formula', '1'].includes(word));
let queue: Promise<unknown> = Promise.resolve();
let lastRequest = 0;

function requestRows(url: string, signal: AbortSignal): Promise<Raw[]> {
  const request = queue
    .catch(() => {})
    .then(async () => {
    const delay = Math.max(0, 500 - (performance.now() - lastRequest));
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      signal.throwIfAborted();
    lastRequest = performance.now();
      const response = await fetch(url, {
        cache: 'no-store',
        signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]),
      });
      if (response.status === 429)
        throw new Error(
          'OpenF1 요청 한도에 도달했습니다. 잠시 후 다시 조회해주세요.',
        );
      if (!response.ok)
        throw new Error(`OpenF1 자료 조회 실패 (${response.status})`);
      const rows = await response.json();
      if (!Array.isArray(rows))
        throw new Error('OpenF1 응답 형식이 올바르지 않습니다.');
      return rows.filter(
        (row): row is Raw => row !== null && typeof row === 'object',
      );
    });
  queue = request;
  return request;
}
function readCache<T>(key: string): T | null {
  try {
    return JSON.parse(sessionStorage.getItem(key) ?? 'null') as T | null;
  } catch {
    return null;
  }
}
function cache(key: string, value: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Storage is optional. */
  }
}

export default function TelemetryChart({
  year,
  round,
  raceName,
  raceDate,
  driverNumber,
}: Props) {
  const pending = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const metadataPending = useRef<AbortController | null>(null);
  const [session, setSession] = useState<SessionData | null>(null);
  const [lap, setLap] = useState<RaceLap | null>(null);
  const [lapData, setLapData] = useState<LapData>({ cars: [], locations: [] });
  const [metadata, setMetadata] = useState<MultiViewerCircuit | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      pending.current?.abort();
      metadataPending.current?.abort();
    };
  }, []);

  const circuitName = hints[normalize(raceName) as keyof typeof hints];
  const feature =
    normalize(raceName) === 'sakhir gp'
      ? null
      : circuits.features.find(
          (item) =>
            normalize(item.properties.Name) === normalize(circuitName ?? '') ||
            (normalize(raceName) === 'styrian gp' &&
              item.properties.Name === 'Red Bull Ring'),
        );
  const fallback =
    feature?.geometry.type === 'LineString'
      ? fitTrackPoints(
          (feature.geometry.coordinates as number[][]).map(([x, y]) => ({
            x,
            y,
          })),
          { geographic: true },
        )
      : [];
  const key = `pitwall:v1:${year}:${driverNumber}:${round}:${raceName}`;

  async function loadLap(
    target: RaceLap,
    source: SessionData,
    signal: AbortSignal,
    force = false,
  ) {
    const cacheKey = `${key}:lap:${target.lap}`;
    const saved = !force ? readCache<LapData>(cacheKey) : null;
    if (
      saved &&
      Array.isArray(saved.cars) &&
      saved.cars.length &&
      Array.isArray(saved.locations) &&
      saved.locations.length
    )
      return saved;
    const start = Date.parse(target.dateStart ?? '');
    if (!Number.isFinite(start) || !positive(target.lapTime))
      throw new Error(
        '이 랩의 시작 시각이 없어 차량 데이터를 연결할 수 없습니다.',
      );
    const window = `&date>=${encodeURIComponent(new Date(start).toISOString())}&date<=${encodeURIComponent(new Date(start + target.lapTime * 1000).toISOString())}`;
    const base = `?driver_number=${driverNumber}&session_key=${source.sessionKey}${window}`;
    const missing: string[] = [];
    const cars = await requestRows(
      `https://api.openf1.org/v1/car_data${base}`,
      signal,
    ).catch((err) => {
      if (signal.aborted) throw err;
      missing.push(err instanceof Error ? err.message : '차량 자료 미수신');
      return [];
    });
    const locations = await requestRows(
      `https://api.openf1.org/v1/location${base}`,
      signal,
    ).catch((err) => {
      if (signal.aborted) throw err;
      missing.push(err instanceof Error ? err.message : '위치 자료 미수신');
      return [];
    });
    signal.throwIfAborted();
    const result = {
      cars: formatCars(cars, target),
      locations: locations
        .filter(
          (row) =>
            validNumber(row.x) &&
            validNumber(row.y) &&
            typeof row.date === 'string',
        )
        .map((row) => ({
          date: row.date as string,
          x: row.x as number,
          y: row.y as number,
        })) as LocationSample[],
    };
    if (result.cars.length && result.locations.length) cache(cacheKey, result);
    if (missing.length) setError([...new Set(missing)].join(' · '));
    return result;
  }

  async function chooseLap(target: RaceLap, force = false) {
    if (!session) return;
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setLoading(true);
    setError('');
    setLap(target);
    setLapData({ cars: [], locations: [] });
    try {
      const result = await loadLap(target, session, controller.signal, force);
      controller.signal.throwIfAborted();
      setLapData(result);
    } catch (err) {
      if (!controller.signal.aborted)
        setError(err instanceof Error ? err.message : '차량 자료 조회 실패');
    } finally {
      if (mounted.current && pending.current === controller) setLoading(false);
    }
  }

  async function loadSession(force = false) {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    const signal = controller.signal;
    setLoading(true);
    setError('');
    try {
      if (!/^\d{1,3}$/.test(driverNumber) || driverNumber === '0')
        throw new Error('이 선수의 차량 번호가 없습니다.');
      let source = !force ? readCache<SessionData>(`${key}:session`) : null;
      if (
        !source ||
        !positive(source.sessionKey) ||
        !Array.isArray(source.laps) ||
        !source.laps.length
      ) {
        const meetings = await requestRows(
          `https://api.openf1.org/v1/meetings?year=${year}`,
          signal,
        );
        const targets = words(raceName);
        const ranked = meetings
          .map((meeting) => {
            const fields = [
              meeting.meeting_name,
              meeting.meeting_official_name,
              meeting.country_name,
              meeting.location,
              meeting.circuit_short_name,
            ].filter((field): field is string => typeof field === 'string');
            const score = Math.max(
              0,
              ...fields.map((field) =>
                normalize(field) === normalize(raceName)
                  ? 100
                  : targets.filter((word) => words(field).includes(word))
                      .length,
              ),
            );
            const distance =
              raceDate && typeof meeting.date_start === 'string'
                ? Math.abs(
                    Date.parse(raceDate) - Date.parse(meeting.date_start),
                  )
                : Infinity;
            return { meeting, score, distance };
          })
          .filter((item) => item.score > 0)
          .sort((a, b) => b.score - a.score || a.distance - b.distance);
        const meeting = ranked[0]?.meeting;
        if (!meeting || !positive(meeting.meeting_key))
          throw new Error(`${raceName}의 레이스 자료를 찾지 못했습니다.`);
        const sessions = await requestRows(
          `https://api.openf1.org/v1/sessions?meeting_key=${meeting.meeting_key}&session_name=Race`,
          signal,
        );
        const current = sessions[0];
        if (!current || !positive(current.session_key))
          throw new Error('레이스 세션 자료가 없습니다.');
        const sessionKey = current.session_key;
        const circuitKey = positive(current.circuit_key)
          ? current.circuit_key
          : positive(meeting.circuit_key)
            ? meeting.circuit_key
            : null;
        const base = `?driver_number=${driverNumber}&session_key=${sessionKey}`;
        const laps = formatLaps(
          await requestRows(`https://api.openf1.org/v1/laps${base}`, signal),
        );
        if (!bestLap(laps))
          throw new Error('이 선수의 유효한 랩 기록이 없습니다.');
        const missing: string[] = [];
        async function optional(
          endpoint: string,
          query: string,
          label: string,
        ) {
          try {
            return await requestRows(
              `https://api.openf1.org/v1/${endpoint}${query}`,
              signal,
            );
          } catch (err) {
            if (signal.aborted) throw err;
            missing.push(label);
            return [];
          }
        }
        const stints = formatStints(await optional('stints', base, '타이어'));
        const weather = (await optional(
          'weather',
          `?session_key=${sessionKey}`,
          '날씨',
        )) as WeatherSample[];
        if (!stints.length && !missing.includes('타이어'))
          missing.push('타이어');
        if (!weather.length && !missing.includes('날씨')) missing.push('날씨');
        const pits = (await optional('pit', base, '피트'))
          .filter((row) => positive(row.lap_number))
          .map((row) => ({
            lap: Number(row.lap_number),
            duration: positive(row.lane_duration)
              ? row.lane_duration
              : positive(row.pit_duration)
                ? row.pit_duration
                : null,
            date: typeof row.date === 'string' ? row.date : undefined,
          }));
        source = {
          sessionKey,
          circuitKey,
          laps,
          stints,
          weather,
          pits,
          missing,
        };
        if (!missing.length && stints.length && weather.length)
          cache(`${key}:session`, source);
      }
      signal.throwIfAborted();
      const target =
        force && lap && source.laps.some((item) => item.lap === lap.lap)
          ? source.laps.find((item) => item.lap === lap.lap)!
          : bestLap(source.laps)!;
      setSession(source);
      setLap(target);
      setLapData({ cars: [], locations: [] });
      if (source.circuitKey) {
        const circuitKey = source.circuitKey;
        metadataPending.current?.abort();
        const metadataController = new AbortController();
        metadataPending.current = metadataController;
        void fetch(`/api/circuit-info?key=${circuitKey}&year=${year}`, {
          signal: metadataController.signal,
        })
          .then((response) => (response.ok ? response.json() : null))
          .then((value) => {
            if (!metadataController.signal.aborted) setMetadata(value);
          })
          .catch(() => {});
      }
      const result = await loadLap(target, source, signal, force);
      signal.throwIfAborted();
      setLapData(result);
    } catch (err) {
      if (!signal.aborted)
        setError(err instanceof Error ? err.message : '레이스 자료 조회 실패');
    } finally {
      if (mounted.current && pending.current === controller) setLoading(false);
    }
  }

  if (session && lap)
    return (
      <IntegratedAnalysis
        key={`${session.sessionKey}:${lap.lap}`}
        session={session}
        lap={lap}
        lapData={lapData}
        fallback={fallback}
        metadata={metadata}
        loading={loading}
        error={error}
        selectLap={chooseLap}
        retry={() =>
          session.missing.length ? loadSession(true) : chooseLap(lap, true)
        }
      />
    );
  return (
    <div className="min-w-0 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">
            {year < 2023 ? '역사 레이스 모드' : '레이스 분석'}
          </h3>
          <p className="mt-1 text-xs text-neutral-400">
            {year < 2023
              ? 'OpenF1 차량 기록은 2023년부터 제공됩니다.'
              : '개인 베스트 랩 · 차량 데이터 · 타이어 · 날씨'}
          </p>
        </div>
        {year >= 2023 && (
          <button
            type="button"
            disabled={loading}
            onClick={() => loadSession(Boolean(error))}
            className="inline-flex min-h-11 items-center gap-2 rounded border border-red-500/50 bg-red-500/10 px-4 text-sm text-red-200 hover:bg-red-500/20 disabled:opacity-50"
          >
            {loading ? (
              <LoaderCircle
                size={16}
                className="animate-spin"
                aria-hidden="true"
              />
            ) : error ? (
              <RotateCcw size={16} aria-hidden="true" />
            ) : (
              <Download size={16} aria-hidden="true" />
            )}
            {loading
              ? '데이터 조회 중...'
              : error
                ? '다시 조회'
                : '데이터 불러오기'}
          </button>
        )}
      </div>
      {error && (
        <p
          role="alert"
          className="border-l-2 border-red-400 pl-3 text-sm text-red-300"
        >
          {error}
        </p>
      )}
      <section className="border-t border-neutral-800 pt-4">
        <h3 className="text-base font-semibold">참고 트랙 윤곽</h3>
        <div className="mt-4 grid gap-5 lg:grid-cols-[1.2fr_1fr]">
          <div
            className="aspect-[32/21] min-w-0 border border-[#27303b] bg-[#101419]"
            style={{ borderRadius: 6 }}
          >
            <svg
              viewBox="0 0 640 420"
              role="img"
              aria-label={`${raceName} 참고 트랙 윤곽`}
              className="h-full w-full"
            >
              {fallback.length > 1 ? (
                <>
                  <polyline
                    points={fallback.map((p) => `${p.x},${p.y}`).join(' ')}
                    fill="none"
                    stroke="#303b49"
                    strokeWidth="14"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  <polyline
                    points={fallback.map((p) => `${p.x},${p.y}`).join(' ')}
                    fill="none"
                    stroke="#a6c4d6"
                    strokeWidth="4"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                </>
              ) : (
                <text
                  x="320"
                  y="210"
                  textAnchor="middle"
                  fill="#94a3b8"
                  fontSize="16"
                >
                  이 레이아웃의 지도 자료 없음
                </text>
              )}
            </svg>
          </div>
          <div className="flex flex-col justify-center border-l-0 border-neutral-800 lg:border-l lg:pl-6">
            <p className="text-lg font-medium">{raceName}</p>
            <p className="mt-2 text-sm text-neutral-400">
              {year} · R{round} · #{driverNumber}
            </p>
            <p className="mt-4 text-xs leading-6 text-neutral-500">
              공개 GeoJSON 참고 윤곽 · 차량 위치를 수신하면 해당 랩의 실제 주행
              표본을 표시합니다.
            </p>
            {loading && (
              <p role="status" className="mt-4 text-sm text-cyan-300">
                랩·타이어·날씨 자료를 불러오는 중...
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
