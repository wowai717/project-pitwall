"use client";

import { useEffect, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { findTrackAsset } from './trackAssets';

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
  speed: number;
  throttle: number;
  brake: number;
  rpm?: number;
  n_gear?: number;
}

interface OpenF1LapDataPoint {
  lap_number: number;
  lap_duration?: number;
  duration_sector_1?: number;
  duration_sector_2?: number;
  duration_sector_3?: number;
  i1_speed?: number;
  i2_speed?: number;
  st_speed?: number;
  is_pit_out_lap?: boolean;
}

interface OpenF1LocationPoint {
  x: number;
  y: number;
}

interface TrackPoint {
  x: number;
  y: number;
}

interface CarTelemetryPoint {
  sample: number;
  speed: number;
  throttle: number;
  brake: number;
  rpm: number;
  gear: number;
}

interface LapTelemetryPoint {
  lap: number;
  lapTime: number;
  sector1: number;
  sector2: number;
  sector3: number;
  trapSpeed: number;
}

interface TooltipPayloadItem {
  value?: unknown;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<TooltipPayloadItem>;
}

interface TelemetryInsight {
  label: string;
  value: string;
  accent: string;
}

interface TelemetrySummary {
  topSpeed: number;
  avgSpeed: number;
  avgThrottle: number;
  brakeMoments: number;
  bestLap: number;
  consistency: number;
  strongestSector: string;
  totalLaps: number;
}

interface TelemetryCachePayload {
  chartMode: 'car' | 'laps';
  carData: CarTelemetryPoint[];
  lapData: LapTelemetryPoint[];
  locationData: OpenF1LocationPoint[];
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

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatSeconds(value: number) {
  return Number.isFinite(value) && value > 0 ? value.toFixed(3) : '--';
}

function buildSummary(carData: CarTelemetryPoint[], lapData: LapTelemetryPoint[]): TelemetrySummary {
  const speedSource = carData.length > 0 ? carData.map((point) => point.speed) : lapData.map((lap) => lap.trapSpeed);
  const lapTimes = lapData.map((lap) => lap.lapTime);
  const avgLap = average(lapTimes);
  const sectorAverages = [
    { name: '섹터 1', value: average(lapData.map((lap) => lap.sector1)) },
    { name: '섹터 2', value: average(lapData.map((lap) => lap.sector2)) },
    { name: '섹터 3', value: average(lapData.map((lap) => lap.sector3)) },
  ].filter((sector) => sector.value > 0);

  return {
    topSpeed: Math.max(...speedSource, 0),
    avgSpeed: average(speedSource),
    avgThrottle: average(carData.map((point) => point.throttle)),
    brakeMoments: carData.filter((point) => point.brake > 0).length,
    bestLap: lapData.length > 0 ? Math.min(...lapData.map((lap) => lap.lapTime)) : 0,
    consistency: lapTimes.length > 0 ? average(lapTimes.map((lap) => Math.abs(lap - avgLap))) : 0,
    strongestSector:
      sectorAverages.length > 0
        ? sectorAverages.reduce((best, current) => (current.value < best.value ? current : best)).name
        : '데이터 없음',
    totalLaps: lapData.length,
  };
}

function buildInsights(summary: TelemetrySummary): TelemetryInsight[] {
  return [
    {
      label: '최고 속도',
      value: summary.topSpeed > 0 ? `${summary.topSpeed.toFixed(0)} km/h` : '데이터 없음',
      accent: 'text-yellow-400',
    },
    {
      label: '베스트 랩',
      value: summary.bestLap > 0 ? `${formatSeconds(summary.bestLap)}초` : '데이터 없음',
      accent: 'text-cyan-400',
    },
    {
      label: '강한 섹터',
      value: summary.strongestSector,
      accent: 'text-green-400',
    },
    {
      label: '일관성',
      value: summary.consistency > 0 ? `±${summary.consistency.toFixed(2)}초` : '데이터 없음',
      accent: 'text-purple-400',
    },
  ];
}

function buildSectorComparison(lapData: LapTelemetryPoint[]) {
  const avgSector1 = average(lapData.map((lap) => lap.sector1));
  const avgSector2 = average(lapData.map((lap) => lap.sector2));
  const avgSector3 = average(lapData.map((lap) => lap.sector3));
  const maxSector = Math.max(avgSector1, avgSector2, avgSector3, 1);

  return [
    { label: '섹터 1', seconds: avgSector1, score: 100 - (avgSector1 / maxSector) * 100, color: 'bg-red-500' },
    { label: '섹터 2', seconds: avgSector2, score: 100 - (avgSector2 / maxSector) * 100, color: 'bg-green-500' },
    { label: '섹터 3', seconds: avgSector3, score: 100 - (avgSector3 / maxSector) * 100, color: 'bg-purple-500' },
  ];
}

function buildTrackSegments(carData: CarTelemetryPoint[], lapData: LapTelemetryPoint[]) {
  if (carData.length > 0) {
    const segmentSize = Math.max(1, Math.floor(carData.length / 12));

    return Array.from({ length: 12 }, (_, index) => {
      const slice = carData.slice(index * segmentSize, (index + 1) * segmentSize);
      const avgSpeed = average(slice.map((point) => point.speed));
      const brakeShare = slice.length > 0 ? slice.filter((point) => point.brake > 0).length / slice.length : 0;

      return {
        index,
        avgSpeed,
        brakeShare,
      };
    });
  }

  return lapData.slice(0, 12).map((lap, index) => ({
    index,
    avgSpeed: lap.trapSpeed,
    brakeShare: 0.2 + ((lap.sector1 + lap.sector3) % 1) * 0.6,
  }));
}

function getSegmentColor(segment: { avgSpeed: number; brakeShare: number }) {
  if (segment.brakeShare > 0.45) return '#ef4444';
  if (segment.avgSpeed > 280) return '#eab308';
  if (segment.avgSpeed > 240) return '#22c55e';
  return '#38bdf8';
}

function normalizeTrackPoints(locationData: OpenF1LocationPoint[]) {
  if (locationData.length < 2) {
    return [];
  }

  const sampled = locationData.filter((_, index) => index % Math.ceil(locationData.length / 90) === 0);
  const xs = sampled.map((point) => point.x);
  const ys = sampled.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const size = Math.max(maxX - minX, maxY - minY, 1);
  const viewSize = 220;
  const padding = 20;

  return sampled.map((point) => ({
    x: padding + ((point.x - minX) / size) * (viewSize - padding * 2),
    y: viewSize - (padding + ((point.y - minY) / size) * (viewSize - padding * 2)),
  }));
}

function toPolyline(points: TrackPoint[]) {
  return points.map((point) => `${point.x},${point.y}`).join(' ');
}

function formatTooltipValue(value: unknown) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value.toFixed(0) : '--';
  }

  if (typeof value === 'string') {
    return value;
  }

  return '--';
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchOpenF1Json<T>(url: string, fallbackErrorMessage: string): Promise<T> {
  const response = await fetch(url);

  if (response.status === 429) {
    throw new Error('잠시 후 다시 시도해주세요. OpenF1 요청 제한에 걸렸습니다.');
  }

  if (!response.ok) {
    throw new Error(fallbackErrorMessage);
  }

  return response.json();
}

export default function TelemetryChart({ year, round, raceName, raceDate, driverNumber }: TelemetryProps) {
  const [carData, setCarData] = useState<CarTelemetryPoint[]>([]);
  const [lapData, setLapData] = useState<LapTelemetryPoint[]>([]);
  const [locationData, setLocationData] = useState<OpenF1LocationPoint[]>([]);
  const [chartMode, setChartMode] = useState<'car' | 'laps'>('car');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    setCarData([]);
    setLapData([]);
    setLocationData([]);
    setChartMode('car');
    setStatus('idle');
    setError('');
  }, [driverNumber, raceDate, raceName, round, year]);

  async function fetchTelemetry() {
    if (!driverNumber || driverNumber === '0') {
      setError('차량 번호가 없어 추적할 수 없습니다.');
      setStatus('error');
      return;
    }

    if (year < 2023) {
      setError('텔레메트리는 2023 시즌부터 제공됩니다.');
      setStatus('error');
      return;
    }

    try {
      setStatus('loading');
      setError('');
      setCarData([]);
      setLapData([]);
      setLocationData([]);
      setChartMode('car');

      const cacheKey = `telemetry:${year}:${driverNumber}:${round}:${raceName}`;
      const cached = typeof window !== 'undefined' ? window.sessionStorage.getItem(cacheKey) : null;

      if (cached) {
        const parsed = JSON.parse(cached) as TelemetryCachePayload;
        setCarData(parsed.carData);
        setLapData(parsed.lapData);
        setLocationData(parsed.locationData);
        setChartMode(parsed.chartMode);
        setStatus('success');
        return;
      }

      await wait(1200);

      const meetings = await fetchOpenF1Json<OpenF1Meeting[]>(
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

      const sessions = await fetchOpenF1Json<OpenF1Session[]>(
        `https://api.openf1.org/v1/sessions?meeting_key=${matchedMeeting.meeting.meeting_key}&session_name=Race`,
        '세션 정보를 불러오지 못했습니다.',
      );

      if (!Array.isArray(sessions) || sessions.length === 0) {
        throw new Error(`${raceName} 레이스 세션 정보를 찾지 못했습니다.`);
      }

      const currentSession = sessions[0];

      const [laps, locations] = await Promise.all([
        fetchOpenF1Json<OpenF1LapDataPoint[]>(
          `https://api.openf1.org/v1/laps?driver_number=${driverNumber}&session_key=${currentSession.session_key}`,
          '랩 데이터를 불러오지 못했습니다.',
        ),
        fetchOpenF1Json<OpenF1LocationPoint[]>(
          `https://api.openf1.org/v1/location?driver_number=${driverNumber}&session_key=${currentSession.session_key}&limit=400`,
          '트랙 위치 데이터를 불러오지 못했습니다.',
        ).catch(() => []),
      ]);

      const formattedLapData = laps
        .filter((lap) => !lap.is_pit_out_lap && typeof lap.lap_duration === 'number')
        .map((lap) => ({
          lap: lap.lap_number,
          lapTime: lap.lap_duration ?? 0,
          sector1: lap.duration_sector_1 ?? 0,
          sector2: lap.duration_sector_2 ?? 0,
          sector3: lap.duration_sector_3 ?? 0,
          trapSpeed: lap.st_speed ?? lap.i2_speed ?? lap.i1_speed ?? 0,
        }));

      if (formattedLapData.length === 0) {
        throw new Error('시각화할 수 있는 랩 데이터가 없습니다.');
      }

      let formattedCarData: CarTelemetryPoint[] = [];
      let resolvedMode: 'car' | 'laps' = 'laps';

      try {
        const rawCarData = await fetchOpenF1Json<OpenF1CarDataPoint[]>(
          `https://api.openf1.org/v1/car_data?driver_number=${driverNumber}&session_key=${currentSession.session_key}&limit=300`,
          '차량 텔레메트리를 불러오지 못했습니다.',
        );

        if (Array.isArray(rawCarData) && rawCarData.length > 0) {
          formattedCarData = rawCarData.map((point, index) => ({
            sample: index,
            speed: point.speed,
            throttle: point.throttle,
            brake: point.brake > 0 ? point.brake : 0,
            rpm: point.rpm ?? 0,
            gear: point.n_gear ?? 0,
          }));
          resolvedMode = 'car';
        }
      } catch {
        resolvedMode = 'laps';
      }

      const safeLocationData = Array.isArray(locations) ? locations : [];

      setCarData(formattedCarData);
      setLapData(formattedLapData);
      setLocationData(safeLocationData);
      setChartMode(resolvedMode);
      setStatus('success');

      if (typeof window !== 'undefined') {
        const payload: TelemetryCachePayload = {
          chartMode: resolvedMode,
          carData: formattedCarData,
          lapData: formattedLapData,
          locationData: safeLocationData,
        };
        window.sessionStorage.setItem(cacheKey, JSON.stringify(payload));
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '텔레메트리 연결에 실패했습니다.';
      setError(message);
      setStatus('error');
    }
  }

  if (status === 'idle') {
    return (
      <div
        onClick={fetchTelemetry}
        className="h-11 w-full bg-[#111] rounded-md border border-[#333] flex items-center justify-center hover:bg-[#222] hover:border-red-600/50 transition-all cursor-pointer group"
      >
        <p className="text-neutral-400 text-xs font-medium group-hover:text-red-400 transition-colors flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-neutral-600 group-hover:bg-red-600 rounded-full group-hover:animate-pulse"></span>
          라운드 {round} 데이터 불러오기
        </p>
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
      <div
        onClick={fetchTelemetry}
        className="h-14 w-full bg-[#110505] rounded-md border border-red-900/50 flex items-center justify-center cursor-pointer hover:bg-red-900/20 transition-colors px-4"
      >
        <p className="text-red-400/90 text-xs font-medium text-center flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-red-600 rounded-full"></span>
          {error} (다시 시도)
        </p>
      </div>
    );
  }

  const summary = buildSummary(carData, lapData);
  const insights = buildInsights(summary);
  const sectors = buildSectorComparison(lapData);
  const trackSegments = buildTrackSegments(carData, lapData);
  const normalizedTrack = normalizeTrackPoints(locationData);
  const localTrackAsset = findTrackAsset(raceName);
  const renderedTrack = normalizedTrack.length > 1 ? normalizedTrack : localTrackAsset?.points ?? [];
  const hasTrackData = renderedTrack.length > 1;
  const trackSource = normalizedTrack.length > 1 ? 'openf1' : localTrackAsset ? 'local' : 'missing';
  const chartGuideItems =
    chartMode === 'car'
      ? [
          { color: 'bg-yellow-400', title: '노랑', text: '속도입니다. 위로 튈수록 직선에서 강하게 밀어붙였다는 뜻입니다.' },
          { color: 'bg-green-500', title: '초록', text: '스로틀입니다. 높게 유지되면 가속을 오래 가져간 구간입니다.' },
          { color: 'bg-red-500', title: '빨강', text: '브레이크입니다. 급하게 솟는 구간은 강한 제동 포인트로 보면 됩니다.' },
          { color: 'bg-neutral-200', title: '읽는 법', text: '노랑이 떨어지고 빨강이 튀면 감속, 그 다음 초록이 다시 오르면 탈출 가속입니다.' },
        ]
      : [
          { color: 'bg-cyan-400', title: '파랑', text: '랩타임입니다. 크게 출렁이면 그 랩에서 실수, 트래픽, 피트 영향이 있었을 수 있습니다.' },
          { color: 'bg-yellow-400', title: '노랑', text: '스피드 트랩입니다. 직선 최고속 구간의 분위기를 보여줍니다.' },
          { color: 'bg-red-500', title: '빨강/초록/보라', text: '섹터 1, 2, 3 기록입니다. 어느 구간에서 시간이 갈렸는지 빠르게 읽을 수 있습니다.' },
          { color: 'bg-neutral-200', title: '읽는 법', text: '파랑 랩타임이 튀는 랩을 먼저 보고, 같은 랩에서 어느 섹터 선이 흔들렸는지 같이 보면 됩니다.' },
        ];

  const telemetryTooltip = ({ active, payload }: CustomTooltipProps) => {
    if (!active || !payload || payload.length === 0) return null;

    return (
      <div className="bg-[#111] border border-[#333] p-3 rounded-md shadow-2xl text-xs">
        <p className="text-yellow-400">속도 <span className="text-white">{formatTooltipValue(payload[0]?.value)} km/h</span></p>
        <p className="text-green-500">스로틀 <span className="text-white">{formatTooltipValue(payload[1]?.value)}%</span></p>
        <p className="text-red-500">브레이크 <span className="text-white">{payload[2]?.value ? '사용' : '없음'}</span></p>
      </div>
    );
  };

  const lapTooltip = ({ active, payload }: CustomTooltipProps) => {
    if (!active || !payload || payload.length === 0) return null;

    return (
      <div className="bg-[#111] border border-[#333] p-3 rounded-md shadow-2xl text-xs">
        <p className="text-cyan-400">랩타임 <span className="text-white">{formatTooltipValue(payload[0]?.value)}초</span></p>
        <p className="text-yellow-400">스피드 트랩 <span className="text-white">{formatTooltipValue(payload[1]?.value)} km/h</span></p>
        <p className="text-green-500">
          섹터 기록 <span className="text-white">{formatTooltipValue(payload[2]?.value)}초 / {formatTooltipValue(payload[3]?.value)}초 / {formatTooltipValue(payload[4]?.value)}초</span>
        </p>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 2xl:grid-cols-[1.8fr_1fr] gap-4">
        <section className="min-w-0 bg-[#111] border border-[#2a2a2a] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-semibold tracking-[0.14em] text-neutral-300 uppercase">레이스 흐름</p>
              <h3 className="text-xl font-bold text-white mt-1">
                {chartMode === 'car' ? '텔레메트리 추적' : '랩 퍼포먼스 흐름'}
              </h3>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold tracking-[0.14em] text-neutral-300 uppercase">데이터 모드</p>
              <p className="text-sm font-semibold text-green-400">{chartMode === 'car' ? '차량 데이터' : '랩 데이터 대체'}</p>
            </div>
          </div>

          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              {chartMode === 'car' ? (
                <LineChart data={carData} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="#222" strokeDasharray="3 3" />
                  <XAxis dataKey="sample" stroke="#666" fontSize={10} />
                  <YAxis stroke="#666" fontSize={10} />
                  <Tooltip content={telemetryTooltip} />
                  <Line type="monotone" dataKey="speed" stroke="#eab308" strokeWidth={3} dot={false} />
                  <Line type="monotone" dataKey="throttle" stroke="#22c55e" strokeWidth={2} dot={false} />
                  <Line type="stepAfter" dataKey="brake" stroke="#ef4444" strokeWidth={2} dot={false} />
                </LineChart>
              ) : (
                <LineChart data={lapData} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="#222" strokeDasharray="3 3" />
                  <XAxis dataKey="lap" stroke="#666" fontSize={10} />
                  <YAxis stroke="#666" fontSize={10} />
                  <Tooltip content={lapTooltip} />
                  <Line type="monotone" dataKey="lapTime" stroke="#22d3ee" strokeWidth={3} dot={false} />
                  <Line type="monotone" dataKey="trapSpeed" stroke="#eab308" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="sector1" stroke="#ef4444" strokeWidth={1} dot={false} strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="sector2" stroke="#22c55e" strokeWidth={1} dot={false} strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="sector3" stroke="#a855f7" strokeWidth={1} dot={false} strokeDasharray="4 4" />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>

          <div className="mt-5 grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-4">
            <div className="rounded-xl border border-[#242424] bg-[#0b0b0b] p-4">
              <p className="text-xs font-semibold tracking-[0.14em] text-neutral-300 uppercase">그래프 설명</p>
              <h4 className="mt-1 text-lg font-bold text-white">처음 보는 사람도 바로 읽는 법</h4>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {chartGuideItems.map((item) => (
                  <div key={item.title} className="rounded-lg border border-[#222] bg-[#101010] p-3">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${item.color}`}></span>
                      <span className="text-sm font-bold text-white">{item.title}</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-neutral-200">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-[#242424] bg-[#0b0b0b] p-4">
              <p className="text-xs font-semibold tracking-[0.14em] text-neutral-300 uppercase">한눈에 보기</p>
              <h4 className="mt-1 text-lg font-bold text-white">이번 경기 핵심만 빠르게</h4>
              <div className="mt-4 space-y-3 text-sm leading-6 text-neutral-100">
                <p>
                  가장 빠른 랩은 <span className="font-bold text-cyan-400">{summary.bestLap > 0 ? `${formatSeconds(summary.bestLap)}초` : '확인 불가'}</span>입니다.
                </p>
                <p>
                  최고 속도는 <span className="font-bold text-yellow-400">{summary.topSpeed.toFixed(0)} km/h</span>, 가장 강했던 구간은 <span className="font-bold text-green-400">{summary.strongestSector}</span>입니다.
                </p>
                <p>
                  {chartMode === 'car'
                    ? `차량 데이터가 잡혀서 브레이크 ${summary.brakeMoments}회, 평균 스로틀 ${summary.avgThrottle.toFixed(0)}%까지 읽을 수 있습니다.`
                    : `차량 텔레메트리가 비어 있어 ${summary.totalLaps}개 랩의 흐름으로 경기를 복원했습니다.`}
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="min-w-0 space-y-4">
          <section className="bg-[#111] border border-[#2a2a2a] rounded-xl p-5">
            <p className="text-xs font-semibold tracking-[0.14em] text-neutral-300 uppercase">빠른 해석</p>
            <h3 className="text-xl font-bold text-white mt-1">지금 뭘 보면 되는지</h3>
            <div className="mt-4 space-y-3 text-[15px] text-neutral-100 leading-7">
              <p>
                이 경기에서 가장 먼저 볼 건 <span className="text-yellow-400 font-bold">최고 속도</span>와
                <span className="text-cyan-400 font-bold"> 베스트 랩</span>입니다.
              </p>
              <p>
                그다음 <span className="text-green-400 font-bold">{summary.strongestSector}</span>가 강했는지 보고,
                아래 섹터 비교에서 어느 구간이 빨랐는지 확인하면 됩니다.
              </p>
              <p>
                {chartMode === 'car'
                  ? '위 그래프는 실제 차량 텔레메트리 기반이라 속도와 스로틀, 브레이크 흐름을 함께 읽을 수 있습니다.'
                  : '이 경기는 차량 텔레메트리가 없어 랩타임과 섹터 기록 중심으로 흐름을 보여주고 있습니다.'}
              </p>
            </div>
          </section>

          <section className="bg-[#111] border border-[#2a2a2a] rounded-xl p-5">
            <p className="text-xs font-semibold tracking-[0.14em] text-neutral-300 uppercase">트랙 분석</p>
            <h3 className="text-xl font-bold text-white mt-1">{hasTrackData ? '구간별 히트맵' : '트랙 데이터 준비 상태'}</h3>
            <p className="text-sm text-neutral-200 mt-1 leading-6">
              {hasTrackData
                ? '빨간색은 강한 브레이킹, 노란색은 고속 구간, 파란색은 비교적 안정적인 구간을 뜻합니다.'
                : '이 경기에서는 위치 좌표가 충분하지 않아 실제 트랙을 아직 그리지 못했습니다. 대신 아래 숫자 카드와 섹터 비교를 먼저 보는 게 좋습니다.'}
            </p>
            <div className="mt-3 flex items-center gap-2 text-xs text-neutral-200">
              <span className={`inline-flex h-2 w-2 rounded-full ${trackSource === 'openf1' ? 'bg-green-500' : trackSource === 'local' ? 'bg-yellow-400' : 'bg-neutral-500'}`}></span>
              <span className="font-semibold">
                {trackSource === 'openf1' ? 'OpenF1 위치 좌표 사용' : trackSource === 'local' ? '로컬 트랙 자산으로 대체 표시' : '트랙 자산 없음'}
              </span>
            </div>

            <div className="mt-4 rounded-xl border border-[#222] bg-[#0b0b0b] p-4">
              <svg viewBox="0 0 260 220" className="w-full h-56">
                {hasTrackData ? (
                  <>
                    <polyline
                      points={toPolyline(renderedTrack)}
                      fill="none"
                      stroke="#262626"
                      strokeWidth="24"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {trackSegments.map((segment, index) => {
                      const startIndex = Math.floor((index / trackSegments.length) * (renderedTrack.length - 1));
                      const endIndex = Math.floor(((index + 1) / trackSegments.length) * (renderedTrack.length - 1));
                      const points = renderedTrack.slice(startIndex, Math.max(endIndex + 1, startIndex + 2));

                      return (
                        <polyline
                          key={segment.index}
                          points={toPolyline(points)}
                          fill="none"
                          stroke={getSegmentColor(segment)}
                          strokeWidth="16"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      );
                    })}
                    {trackSource === 'local' &&
                      localTrackAsset?.labels.map((label) => (
                        <g key={`${label.kind}-${label.text}`}>
                          <circle cx={label.x} cy={label.y} r={label.kind === 'sector' ? 11 : 9} fill={label.kind === 'sector' ? '#111827' : '#0f0f0f'} stroke={label.kind === 'sector' ? '#22c55e' : '#525252'} strokeWidth="1.5" />
                          <text
                            x={label.x}
                            y={label.y + 3}
                            textAnchor="middle"
                            className={label.kind === 'sector' ? 'fill-green-300 text-[9px] font-bold' : 'fill-neutral-100 text-[8px] font-semibold'}
                          >
                            {label.text}
                          </text>
                        </g>
                      ))}
                  </>
                ) : (
                  <>
                    <text x="130" y="92" textAnchor="middle" className="fill-neutral-100 text-base font-semibold">
                      위치 좌표 데이터 없음
                    </text>
                    <text x="130" y="118" textAnchor="middle" className="fill-neutral-300 text-sm">
                      OpenF1에서 이 경기의 트랙 좌표를 제공하지 않았습니다.
                    </text>
                    <text x="130" y="142" textAnchor="middle" className="fill-neutral-300 text-sm">
                      대신 오른쪽 위 빠른 해석과 아래 섹터 비교를 먼저 보세요.
                    </text>
                  </>
                )}
              </svg>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-3 text-[11px] font-semibold tracking-[0.08em]">
              <div className="rounded-md border border-[#222] bg-[#0b0b0b] p-3 text-neutral-100">
                <span className="block text-red-400 font-bold mb-1">브레이크</span>
                강한 감속 구간
              </div>
              <div className="rounded-md border border-[#222] bg-[#0b0b0b] p-3 text-neutral-100">
                <span className="block text-yellow-400 font-bold mb-1">속도</span>
                고속 어택 구간
              </div>
              <div className="rounded-md border border-[#222] bg-[#0b0b0b] p-3 text-neutral-100">
                <span className="block text-cyan-400 font-bold mb-1">흐름</span>
                안정적인 구간
              </div>
            </div>
            {trackSource === 'local' && (
              <p className="mt-3 text-sm leading-6 text-neutral-200">
                현재는 OpenF1 위치 좌표가 비어 있어 <span className="font-semibold text-white">{localTrackAsset?.name}</span> 로컬 자산으로 트랙 윤곽과 섹터 라벨을 대신 보여주고 있습니다.
              </p>
            )}
          </section>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {insights.map((insight) => (
          <section key={insight.label} className="bg-[#111] border border-[#2a2a2a] rounded-xl p-4">
            <p className="text-xs font-semibold tracking-[0.14em] text-neutral-300 uppercase">{insight.label}</p>
            <p className={`mt-3 text-2xl font-bold ${insight.accent}`}>{insight.value}</p>
          </section>
        ))}
      </div>

      <div className="grid grid-cols-1 2xl:grid-cols-[1.5fr_1fr] gap-4">
        <section className="min-w-0 bg-[#111] border border-[#2a2a2a] rounded-xl p-5">
          <p className="text-xs font-semibold tracking-[0.14em] text-neutral-300 uppercase">경기 해설</p>
          <h3 className="text-xl font-bold text-white mt-1">이 경기에서 보이는 점</h3>
          <div className="mt-4 space-y-3 text-[15px] text-neutral-100 leading-7">
            <p>
              최고 속도는 <span className="text-yellow-400 font-bold">{summary.topSpeed.toFixed(0)} km/h</span>까지 나왔고,
              가장 강했던 구간은 <span className="text-green-400 font-bold">{summary.strongestSector}</span>입니다.
            </p>
            <p>
              가장 빨랐던 랩은 <span className="text-cyan-400 font-bold">{summary.bestLap > 0 ? `${formatSeconds(summary.bestLap)}초` : '확인 불가'}</span>이고,
              랩 편차는 <span className="text-purple-400 font-bold">{summary.consistency > 0 ? `±${summary.consistency.toFixed(2)}초` : 'N/A'}</span> 수준입니다.
            </p>
            <p>
              {chartMode === 'car'
                ? `이 샘플에서는 스로틀 평균이 ${summary.avgThrottle.toFixed(0)}%였고, 브레이크 사용 장면은 ${summary.brakeMoments}번 포착됐습니다.`
                : `차량 텔레메트리가 없어 ${summary.totalLaps}개 랩의 랩타임과 섹터 흐름으로 대체해서 보여주고 있습니다.`}
            </p>
          </div>
        </section>

        <section className="min-w-0 bg-[#111] border border-[#2a2a2a] rounded-xl p-5">
          <p className="text-xs font-semibold tracking-[0.14em] text-neutral-300 uppercase">섹터 비교</p>
          <h3 className="text-xl font-bold text-white mt-1">어느 구간이 빨랐는지</h3>
          <div className="mt-5 space-y-4">
            {sectors.map((sector) => (
              <div key={sector.label}>
                <div className="flex items-center justify-between text-sm text-neutral-100 mb-2">
                  <span>{sector.label}</span>
                  <span>{sector.seconds > 0 ? `${sector.seconds.toFixed(3)}초` : '데이터 없음'}</span>
                </div>
                <div className="h-3 rounded-full bg-[#1b1b1b] overflow-hidden">
                  <div className={`h-full ${sector.color}`} style={{ width: `${Math.max(sector.score, 8)}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
