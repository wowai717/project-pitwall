"use client";

import { useEffect, useRef, useState } from 'react';
import TrackMap from './TrackMap';
import TelemetryView from './TelemetryView';
import { formatLaps, positive, type Lap, type RawLap } from './telemetry-data';

interface TelemetryProps {
  year: number;
  round: number;
  raceName: string;
  raceDate?: string;
  driverNumber: string;
}

interface OpenF1Meeting {
  meeting_key: number;
  meeting_name: string;
  meeting_official_name?: string;
  country_name?: string;
  location?: string;
  circuit_short_name?: string;
  date_start?: string;
}

interface OpenF1Session {
  session_key: number;
}

interface OpenF1CarDataPoint {
  date?: string;
  speed: number;
  throttle: number;
  brake: number;
  rpm?: number;
  n_gear?: number;
}

interface OpenF1Stint {
  compound?: string;
  lap_end?: number;
  lap_start?: number;
  stint_number?: number;
  tyre_age_at_start?: number;
}

interface OpenF1WeatherPoint {
  air_temperature?: number;
  humidity?: number;
  rainfall?: number;
  track_temperature?: number;
  wind_speed?: number;
}

interface CarTelemetryPoint {
  sample: number;
  date?: string;
  speed: number;
  throttle: number;
  brake: number;
  rpm: number;
  gear: number;
}

interface TyreStint {
  compound: string;
  lapEnd: number;
  lapStart: number;
  stintNumber: number;
  tyreAgeAtStart: number | null;
}

interface TelemetryCachePayload {
  carData: CarTelemetryPoint[];
  lapData: Lap[];
  tyreStints: TyreStint[];
  weatherData: OpenF1WeatherPoint[];
}

function normalizeRaceName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/grand prix/g, 'gp')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokenize(value: string) {
  return normalizeRaceName(value)
    .split(' ')
    .filter((word) => word && !['gp', 'grand', 'prix', 'formula', '1'].includes(word));
}

function scoreMeetingMatch(targetRaceName: string, meeting: OpenF1Meeting) {
  const targetWords = tokenize(targetRaceName);
  const candidateFields = [
    meeting.meeting_name,
    meeting.meeting_official_name,
    meeting.country_name,
    meeting.location,
    meeting.circuit_short_name,
  ].filter(Boolean) as string[];

  let bestScore = 0;

  for (const field of candidateFields) {
    const meetingWords = tokenize(field);
    if (meetingWords.length === 0) continue;

    const overlap = targetWords.filter((word) => meetingWords.includes(word)).length;
    const isExact = targetWords.join(' ') === meetingWords.join(' ');
    const score = isExact ? 100 : overlap;

    if (score > bestScore) {
      bestScore = score;
    }
  }

  return bestScore;
}

function getRaceDateDistance(raceDate: string | undefined, meetingDate: string | undefined) {
  if (!raceDate || !meetingDate) return Number.POSITIVE_INFINITY;

  const raceTime = new Date(raceDate).getTime();
  const meetingTime = new Date(meetingDate).getTime();

  if (Number.isNaN(raceTime) || Number.isNaN(meetingTime)) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.abs(raceTime - meetingTime);
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchOpenF1Json<T>(url: string, fallbackErrorMessage: string, signal: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.any([controller.signal, signal]) });

    if (response.status === 429) {
      throw new Error('잠시 후 다시 시도해주세요. OpenF1 요청 제한에 걸렸습니다.');
    }

    if (response.status === 404) {
      throw new Error(`OpenF1 데이터 미제공: ${fallbackErrorMessage}`);
    }

    if (!response.ok) {
      throw new Error(fallbackErrorMessage);
    }

    return response.json();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('OpenF1 응답 시간이 초과되었습니다. 다시 시도해주세요.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export default function TelemetryChart({ year, round, raceName, raceDate, driverNumber }: TelemetryProps) {
  const pendingRequest = useRef<AbortController | null>(null);
  const [carData, setCarData] = useState<CarTelemetryPoint[]>([]);
  const [lapData, setLapData] = useState<Lap[]>([]);
  const [tyreStints, setTyreStints] = useState<TyreStint[]>([]);
  const [weatherData, setWeatherData] = useState<OpenF1WeatherPoint[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'historical' | 'unavailable' | 'error'>(year < 2023 ? 'historical' : 'idle');
  const [error, setError] = useState('');

  useEffect(() => {
    return () => pendingRequest.current?.abort();
  }, []);

  async function fetchTelemetry() {
    pendingRequest.current?.abort();
    const controller = new AbortController();
    pendingRequest.current = controller;
    if (!driverNumber || driverNumber === '0') {
      setError('차량 번호가 없어 추적할 수 없습니다.');
      setStatus('error');
      return;
    }

    if (year < 2023) {
      setStatus('historical');
      return;
    }

    try {
      setStatus('loading');
      setError('');
      setCarData([]);
      setLapData([]);
      setTyreStints([]);
      setWeatherData([]);

      const cacheKey = `telemetry:v10:${year}:${driverNumber}:${round}:${raceName}`;
      let cached: TelemetryCachePayload | null = null;
      try {
        const parsed = JSON.parse(window.sessionStorage.getItem(cacheKey) ?? 'null') as TelemetryCachePayload | null;
        if (parsed && [parsed.carData, parsed.lapData, parsed.tyreStints, parsed.weatherData].every(value => Array.isArray(value) && value.length > 0)) cached = parsed;
      } catch { /* Browser storage is optional. */ }

      if (cached) {
        const parsed = cached;
        setCarData(parsed.carData);
        setLapData(parsed.lapData);
        setTyreStints(parsed.tyreStints ?? []);
        setWeatherData(parsed.weatherData ?? []);
        setStatus('success');
        return;
      }

      await wait(1200);

      let lastOpenF1RequestAt = 0;
      const requestOpenF1 = async <T,>(url: string, fallbackErrorMessage: string) => {
        const remainingDelay = Math.max(0, 800 - (Date.now() - lastOpenF1RequestAt));
        if (remainingDelay > 0) await wait(remainingDelay);
        lastOpenF1RequestAt = Date.now();
        controller.signal.throwIfAborted();
        return fetchOpenF1Json<T>(url, fallbackErrorMessage, controller.signal);
      };

      const meetings = await requestOpenF1<OpenF1Meeting[]>(
        `https://api.openf1.org/v1/meetings?year=${year}`,
        '경기 메타데이터를 불러오지 못했습니다.',
      );

      const matchedMeeting = meetings
        .map((meeting) => ({
          meeting,
          score: scoreMeetingMatch(raceName, meeting),
          dateDistance: getRaceDateDistance(raceDate, meeting.date_start),
        }))
        .filter((candidate) => candidate.score > 0)
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          return a.dateDistance - b.dateDistance;
        })[0];

      if (!matchedMeeting) {
        throw new Error(`${raceName}의 OpenF1 경기 정보를 찾지 못했습니다.`);
      }

      const sessions = await requestOpenF1<OpenF1Session[]>(
        `https://api.openf1.org/v1/sessions?meeting_key=${matchedMeeting.meeting.meeting_key}&session_name=Race`,
        '세션 정보를 불러오지 못했습니다.',
      );

      if (!Array.isArray(sessions) || sessions.length === 0) {
        throw new Error(`${raceName} 레이스 세션 정보를 찾지 못했습니다.`);
      }

      const currentSession = sessions[0];

      const laps = await requestOpenF1<RawLap[]>(
        `https://api.openf1.org/v1/laps?driver_number=${driverNumber}&session_key=${currentSession.session_key}`,
        '랩 데이터를 불러오지 못했습니다.',
      );

      const formattedLapData = formatLaps(laps);

      if (formattedLapData.length === 0) {
        throw new Error('OpenF1 데이터 미제공: 이 선수에게 유효한 완주 랩 기록이 없습니다.');
      }

      const fastestLap = formattedLapData.reduce((best, lap) => (lap.lapTime < best.lapTime ? lap : best));
      const lapStartTime = fastestLap.dateStart ? new Date(fastestLap.dateStart) : null;
      const lapEndTime = lapStartTime && fastestLap.lapTime > 0 ? new Date(lapStartTime.getTime() + fastestLap.lapTime * 1000) : null;
      const lapWindow =
        lapStartTime && lapEndTime && !Number.isNaN(lapStartTime.getTime()) && !Number.isNaN(lapEndTime.getTime())
          ? `&date>=${encodeURIComponent(lapStartTime.toISOString())}&date<=${encodeURIComponent(lapEndTime.toISOString())}`
          : null;

      let formattedCarData: CarTelemetryPoint[] = [];

      // Strategy is requested before optional telemetry so it is not dropped by a rate limit burst.
      let stints: OpenF1Stint[] = [];
      let stintRequestFailed = false;

      try {
        stints = await requestOpenF1<OpenF1Stint[]>(
          `https://api.openf1.org/v1/stints?driver_number=${driverNumber}&session_key=${currentSession.session_key}`,
          '타이어 전략 데이터를 불러오지 못했습니다.',
        );
      } catch {
        stintRequestFailed = true;
      }
      const rawCarData = lapWindow === null ? [] : await requestOpenF1<OpenF1CarDataPoint[]>(
        `https://api.openf1.org/v1/car_data?driver_number=${driverNumber}&session_key=${currentSession.session_key}${lapWindow}`,
        '차량 텔레메트리를 불러오지 못했습니다.',
      ).catch(() => []);
      if (Array.isArray(rawCarData) && rawCarData.length > 0) {
        formattedCarData = rawCarData.filter(point => positive(point.speed)).map((point, index) => ({
          sample: index,
          date: point.date,
          speed: point.speed,
          throttle: point.throttle,
          brake: point.brake > 0 ? 100 : 0,
          rpm: point.rpm ?? 0,
          gear: point.n_gear ?? 0,
        }));
      }

      const formattedTyreStints = Array.isArray(stints)
        ? stints
            .filter((stint) => positive(stint.lap_start) && positive(stint.lap_end) && stint.lap_end >= stint.lap_start)
            .map((stint) => ({
              compound: stint.compound ?? 'UNKNOWN',
              lapEnd: stint.lap_end ?? 0,
              lapStart: stint.lap_start ?? 0,
              stintNumber: stint.stint_number ?? 0,
              tyreAgeAtStart: typeof stint.tyre_age_at_start === 'number' && Number.isFinite(stint.tyre_age_at_start) && stint.tyre_age_at_start >= 0 ? stint.tyre_age_at_start : null,
            }))
            .sort((a, b) => a.lapStart - b.lapStart)
        : [];
      const weather = await requestOpenF1<OpenF1WeatherPoint[]>(
        `https://api.openf1.org/v1/weather?session_key=${currentSession.session_key}`,
        '레이스 날씨 데이터를 불러오지 못했습니다.',
      ).catch(() => []);
      const safeWeatherData = Array.isArray(weather) ? weather : [];
      controller.signal.throwIfAborted();

      setCarData(formattedCarData);
      setLapData(formattedLapData);
      setTyreStints(formattedTyreStints);
      setWeatherData(safeWeatherData);
      setStatus('success');

      if (!stintRequestFailed && [formattedCarData, formattedLapData, formattedTyreStints, safeWeatherData].every(value => value.length > 0)) {
        const payload: TelemetryCachePayload = {
          carData: formattedCarData,
          lapData: formattedLapData,
          tyreStints: formattedTyreStints,
          weatherData: safeWeatherData,
        };
        try { window.sessionStorage.setItem(cacheKey, JSON.stringify(payload)); }
        catch { /* A full storage quota must not hide successfully loaded data. */ }
      }
    } catch (err: unknown) {
      if (controller.signal.aborted) return;
      const message = err instanceof Error ? err.message : '텔레메트리 연결에 실패했습니다.';
      setError(message);
      setStatus(message.startsWith('OpenF1 데이터 미제공:') ? 'unavailable' : 'error');
    }
  }

  if (status === 'idle') {
    return (
      <div className="space-y-6">
      <button type="button"
        onClick={fetchTelemetry}
        className="h-11 w-full bg-[#111] rounded-md border border-[#333] flex items-center justify-center hover:bg-[#222] hover:border-red-600/50 transition-all cursor-pointer group"
      >
        <p className="text-neutral-400 text-xs font-medium group-hover:text-red-400 transition-colors flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-neutral-600 group-hover:bg-red-600 rounded-full group-hover:animate-pulse"></span>
          {year < 2023 ? `라운드 ${round} 역사 레이스 보기` : `라운드 ${round} 데이터 불러오기`}
        </p>
      </button>
      <TrackMap raceName={raceName} year={year} />
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className="h-[30rem] w-full bg-[#0a0a0a] rounded-xl border border-[#222] flex flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(#222_1px,transparent_1px)] [background-size:16px_16px] opacity-20"></div>
        <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-neutral-400 text-sm tracking-wide animate-pulse">레이스 데이터를 정리하는 중...</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <button type="button"
        onClick={fetchTelemetry}
        className="h-14 w-full bg-[#110505] rounded-md border border-red-900/50 flex items-center justify-center cursor-pointer hover:bg-red-900/20 transition-colors px-4"
      >
        <p className="text-red-400/90 text-xs font-medium text-center flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-red-600 rounded-full"></span>
          {error} (다시 시도)
        </p>
      </button>
    );
  }

  if (status === 'unavailable') {
    return (
      <section className="rounded-xl border border-[#2a2a2a] bg-[#111] p-5">
        <p className="text-xs font-semibold tracking-[0.14em] text-yellow-300 uppercase">텔레메트리 미제공</p>
        <h3 className="mt-1 text-xl font-bold text-white">이 레이스의 OpenF1 랩 데이터를 찾지 못했습니다</h3>
        <p className="mt-2 text-sm leading-6 text-neutral-200">결과와 시즌 기록은 그대로 볼 수 있지만, 해당 세션은 차량·랩 텔레메트리 시각화를 제공하지 않습니다. 요청을 다시 보내도 같은 데이터 공백이므로 근거 없는 그래프는 표시하지 않습니다.</p>
      </section>
    );
  }

  if (status === 'historical') {
    return <div className="space-y-6"><div className="border-b border-neutral-800 pb-4"><h3 className="text-lg font-semibold">역사 레이스 모드</h3><p className="mt-2 text-sm text-neutral-400">OpenF1 랩 데이터는 2023년부터 제공합니다. 이 시즌은 경기 결과와 참고 지도를 표시합니다.</p></div><TrackMap raceName={raceName} year={year} /></div>;
  }

  return <TelemetryView year={year} raceName={raceName} laps={lapData} cars={carData} stints={tyreStints} weather={weatherData} retry={fetchTelemetry} />;
}
