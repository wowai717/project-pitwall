'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Maximize2,
  Pause,
  Play,
  RotateCcw,
  Gauge,
  Activity,
  Flag,
} from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  bestLap,
  eligibleLaps,
  lapClock,
  lapPlot,
  lapSummary,
  mean,
  positive,
  seconds,
  sensorPlot,
  validNumber,
  weatherMetric,
  type LapData,
  type RaceLap,
  type SessionData,
} from './analysis-data';
import {
  buildLapTrack,
  layoutCornerLabels,
  matchCircuitCorners,
  trackPointAtElapsed,
  type LapTrackPoint,
  type MultiViewerCircuit,
  type TrackPoint,
} from './track-geometry';

interface Props {
  session: SessionData;
  lapData: LapData;
  lap: RaceLap;
  fallback: TrackPoint[];
  metadata: MultiViewerCircuit | null;
  loading: boolean;
  error: string;
  selectLap: (lap: RaceLap) => void;
  retry: () => void;
}
type Layer = 'speed' | 'brake' | 'throttle' | 'sector';
const sectorColors = ['#fb7185', '#22d3ee', '#facc15'];
const tyreColors: Record<string, string> = {
  SOFT: '#fb7185',
  MEDIUM: '#facc15',
  HARD: '#e5e7eb',
  INTERMEDIATE: '#4ade80',
  WET: '#38bdf8',
};
const buttonClass =
  'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded border border-neutral-700 text-neutral-300 transition-colors hover:bg-neutral-800 disabled:opacity-30';

export default function IntegratedAnalysis({
  session,
  lapData,
  lap,
  fallback,
  metadata,
  loading,
  error,
  selectLap,
  retry,
}: Props) {
  const [layer, setLayer] = useState<Layer>('speed');
  const [sample, setSample] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [includePitOut, setIncludePitOut] = useState(true);
  const dialog = useRef<HTMLDialogElement>(null);
  const track = useMemo(
    () =>
      buildLapTrack(
        lapData.locations,
        lapData.cars,
        { ...lap, lapTime: lap.lapTime ?? 0 },
        { rotation: metadata?.rotation ?? 0 },
      ),
    [lapData, lap, metadata],
  );
  const corners = useMemo(
    () => matchCircuitCorners(metadata, track),
    [metadata, track],
  );
  const cornerLabels = useMemo(() => layoutCornerLabels(corners), [corners]);
  const point =
    track.points[Math.min(sample, Math.max(0, track.points.length - 1))];
  const corner = point
    ? corners.find((marker) => marker.pointIndex === Math.min(sample, track.points.length - 1))
    : null;
  const summary = lapSummary(session.laps);
  const personalBest = bestLap(session.laps);
  const speeds = lapData.cars.map((car) => car.speed).filter(validNumber);
  const maxSpeed = speeds.length ? Math.max(...speeds) : null;
  const minimumSpeed = speeds.length ? Math.min(...speeds) : null;
  const avgSpeed = mean(speeds);
  const throttleAverage = mean(
    lapData.cars.map((car) => car.throttle).filter(validNumber),
  );
  const brakeEvents = lapData.cars.reduce(
    (count, car, i) =>
      count +
      (car.brake > 0 && (i === 0 || lapData.cars[i - 1].brake === 0) ? 1 : 0),
    0,
  );
  const metric = (value: number | null | undefined, precision = 0) =>
    validNumber(value) ? value.toFixed(precision) : '--';

  useEffect(() => {
    if (!playing || !track.points.length) return;
    let frame = 0;
    const started =
      performance.now() -
      (track.points[Math.min(sample, track.points.length - 1)]
        ?.elapsedSeconds ?? 0) *
        1000;
    const tick = (now: number) => {
      const elapsed = (now - started) / 1000;
      const index = track.points.findIndex(
        (item) => item.elapsedSeconds >= elapsed,
      );
      if (index < 0) {
        setPlaying(false);
        setSample(track.points.length - 1);
        return;
      }
      setSample(index);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // The playback clock starts at the selected sample and advances independently.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, track]);

  function chooseSample(index: number) {
    setPlaying(false);
    setSample(index);
  }
  function color(p: LapTrackPoint) {
    if (layer === 'brake')
      return p.brake === null ? '#58606a' : p.brake > 0 ? '#fb7185' : '#5e6a77';
    if (layer === 'throttle')
      return p.throttle === null
        ? '#58606a'
        : `hsl(${125 + p.throttle * 0.35} 70% ${25 + p.throttle * 0.35}%)`;
    if (layer === 'sector')
      return p.elapsedSeconds < (lap.sector1 ?? Infinity)
        ? sectorColors[0]
        : p.elapsedSeconds < (lap.sector1 ?? 0) + (lap.sector2 ?? Infinity)
          ? sectorColors[1]
          : sectorColors[2];
    if (p.speed === null) return '#58606a';
    const low = minimumSpeed ?? 0;
    const high = maxSpeed ?? low;
    return `hsl(${205 - Math.max(0, Math.min(1, (p.speed - low) / Math.max(1, high - low))) * 160} 90% 60%)`;
  }
  const diagram = (
    <svg
      viewBox="0 0 640 420"
      data-testid="track-map"
      role="img"
      aria-label="선택한 랩 트랙 지도"
      className="h-full w-full"
    >
      {track.points.length > 1 ? (
        <>
          {track.segments.map(({ start, end }, i) => (
            <line
              key={`base-${i}`}
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              stroke="#2a3039"
              strokeWidth="13"
              strokeLinecap="round"
            />
          ))}
          {track.segments.map(({ start, end }, i) => (
            <line
              key={i}
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              stroke={color(start)}
              strokeWidth="5"
              strokeLinecap="round"
            />
          ))}
          {track.points.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r="7"
              fill="transparent"
              data-testid={`track-sample-${i}`}
              onClick={() => chooseSample(i)}
              className="cursor-crosshair"
            >
              <title>
                {p.elapsedSeconds.toFixed(2)} s · {metric(p.speed)} km/h
              </title>
            </circle>
          ))}
          {cornerLabels.map((marker) => (
            <g
              key={marker.label}
              onClick={() => chooseSample(marker.pointIndex)}
              className="cursor-pointer"
            >
              <line
                x1={marker.x}
                y1={marker.y}
                x2={marker.labelX}
                y2={marker.labelY}
                stroke="#a3adb9"
                strokeWidth="1"
              />
              <circle
                cx={marker.labelX}
                cy={marker.labelY}
                r="11"
                fill="#10151b"
                stroke="#a3adb9"
                strokeWidth="1.5"
              />
              <text
                x={marker.labelX}
                y={marker.labelY + 4}
                textAnchor="middle"
                fill="white"
                fontSize="12"
                fontWeight="600"
              >
                {marker.label}
              </text>
              <title>코너 {marker.label} 주변 표본</title>
            </g>
          ))}
          {!corners.length &&
            track.sectorMarkers.map((marker) => (
              <g key={marker.label}>
                <circle
                  cx={marker.point.x}
                  cy={marker.point.y}
                  r="11"
                  fill="#10151b"
                  stroke="#97a4b5"
                />
                <text
                  x={marker.point.x}
                  y={marker.point.y + 4}
                  fill="white"
                  fontSize="12"
                  textAnchor="middle"
                >
                  {marker.label}
                </text>
              </g>
            ))}
          {point && (
            <g pointerEvents="none">
              <circle
                cx={point.x}
                cy={point.y}
                r="8"
                fill="white"
                stroke="#0c1016"
                strokeWidth="3"
              />
              <circle
                cx={point.x}
                cy={point.y}
                r="13"
                fill="none"
                stroke="white"
                strokeWidth="1"
              />
            </g>
          )}
        </>
      ) : fallback.length > 1 ? (
        <polyline
          points={fallback.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke="#93a5b7"
          strokeWidth="7"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ) : (
        <text x="320" y="210" fill="#94a3b8" fontSize="16" textAnchor="middle">
          위치 자료 없음
        </text>
      )}
    </svg>
  );
  const charts = [
    {
      id: 'speed-chart',
      title: '차량 속도',
      unit: 'km/h',
      lines: [{ key: 'speed', color: '#facc15', label: '속도' }],
    },
    {
      id: 'controls-chart',
      title: '스로틀 · 브레이크',
      unit: '% / 작동 여부',
      lines: [
        { key: 'throttle', color: '#34d399', label: '스로틀' },
        { key: 'brake', color: '#fb7185', label: '브레이크' },
      ],
    },
    {
      id: 'rpm-gear-chart',
      title: 'RPM · 기어',
      unit: 'rpm / 단',
      lines: [
        { key: 'rpm', color: '#a5b4fc', label: 'RPM' },
        { key: 'gear', color: '#f9a8d4', label: '기어' },
      ],
    },
  ];

  return (
    <div
      data-testid="telemetry-dashboard"
      className="min-w-0 space-y-7 text-neutral-100"
    >
      <dl className="grid grid-cols-2 gap-x-5 gap-y-4 border-b border-neutral-800 pb-5 sm:grid-cols-3 xl:grid-cols-6">
        {[
          {
            label: '개인 베스트 랩',
            value: lapClock(summary.best?.lapTime ?? null),
            sub: summary.best ? `L${summary.best.lap}` : '기록 없음',
            color: 'text-cyan-300',
          },
          {
            label: '선택 랩 최고 속도',
            value: `${metric(maxSpeed)} km/h`,
            sub: `L${lap.lap} · 차량 표본`,
            color: 'text-yellow-300',
          },
          {
            label: '스피드 트랩 최고',
            value: `${metric(summary.trapMax)} km/h`,
            sub: '유효 랩 측정 지점',
            color: 'text-white',
          },
          {
            label: '평균 랩',
            value: lapClock(summary.average),
            sub: `${summary.count}개 유효 랩`,
            color: 'text-white',
          },
          {
            label: '랩타임 흔들림',
            value: `${metric(summary.variation, 2)} s`,
            sub: '평균 절대 편차',
            color: 'text-emerald-300',
          },
          {
            label: '선택 랩 시간',
            value: lapClock(lap.lapTime),
            sub: `L${lap.lap}${lap.pitOut ? ' · 피트 아웃' : ''}`,
            color: 'text-white',
          },
        ].map((stat) => (
          <div key={stat.label} className="min-w-0">
            <dt className="text-xs text-neutral-400">{stat.label}</dt>
            <dd
              className={`mt-2 text-xl font-semibold tabular-nums ${stat.color}`}
            >
              {stat.value}
            </dd>
            <dd className="mt-1 text-xs text-neutral-500">{stat.sub}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-neutral-400">
            분석할 랩
            <select
              aria-label="분석할 랩"
              data-testid="lap-selector"
              value={lap.lap}
              disabled={loading}
              onChange={(e) => {
                const next = session.laps.find(
                  (item) => item.lap === Number(e.target.value),
                );
                if (next) selectLap(next);
              }}
              className="h-11 rounded border border-neutral-700 bg-[#15191f] px-3 text-sm text-white"
            >
              {session.laps
                .filter((item) => positive(item.lapTime))
                .map((item) => (
                  <option key={item.lap} value={item.lap}>
                    L{item.lap} · {lapClock(item.lapTime)}
                    {item.pitOut ? ' · 피트 아웃' : ''}
                  </option>
                ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
              if (personalBest) selectLap(personalBest);
            }}
            disabled={loading}
            className="inline-flex min-h-11 items-center gap-2 rounded border border-cyan-900 px-3 text-sm text-cyan-300 hover:bg-cyan-950"
          >
            <Flag size={15} aria-hidden="true" />
            베스트 랩
          </button>
        </div>
        <div className="flex items-center gap-3 text-xs text-neutral-400">
          L{lap.lap} · {lapData.cars.length}개 차량 표본
          <button
            type="button"
            title="다시 조회"
            aria-label="선택 랩 다시 조회"
            disabled={loading}
            onClick={retry}
            className={buttonClass}
          >
            <RotateCcw size={17} aria-hidden="true" />
          </button>
        </div>
      </div>
      {loading && (
        <p role="status" className="text-sm text-cyan-300">
          선택한 랩을 불러오는 중...
        </p>
      )}
      {!loading &&
        (error ||
          !lapData.cars.length ||
          !lapData.locations.length ||
          session.missing.length > 0) && (
          <div
            role="status"
            className="flex flex-wrap items-center justify-between gap-3 border-l-2 border-yellow-400 bg-yellow-400/5 px-4 py-3 text-sm text-yellow-200"
          >
            <span>
              {error ||
                `일부 자료 미수신: ${[!lapData.cars.length && '차량 데이터', !lapData.locations.length && '위치 데이터', ...session.missing].filter(Boolean).join(', ')}`}
            </span>
            <button
              type="button"
              onClick={retry}
              className="min-h-11 underline"
            >
              누락 데이터 다시 조회
            </button>
          </div>
        )}
      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,.75fr)]">
        <section className="min-w-0" aria-label="트랙 분석">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-semibold">트랙 레이아웃</h3>
            <div
              role="group"
              aria-label="트랙 표시"
              className="flex flex-wrap gap-1"
            >
              {(
                [
                  { id: 'speed', label: '속도' },
                  { id: 'brake', label: '제동' },
                  { id: 'throttle', label: '스로틀' },
                  { id: 'sector', label: '섹터' },
                ] as const
              ).map((mode) => (
                <button
                  type="button"
                  key={mode.id}
                  aria-pressed={layer === mode.id}
                  onClick={() => setLayer(mode.id)}
                  disabled={
                    mode.id === 'sector' &&
                    ![lap.sector1, lap.sector2, lap.sector3].every(positive)
                  }
                  className={`min-h-11 border-b-2 px-3 text-xs transition-colors ${layer === mode.id ? 'border-white text-white' : 'border-transparent text-neutral-400 hover:text-white'} disabled:opacity-30`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>
          <div
            className="relative aspect-[32/21] w-full min-w-0 border border-[#272f39] bg-[#101419]"
            style={{ borderRadius: 6 }}
          >
            {diagram}
            <button
              type="button"
              title="트랙 확대"
              aria-label="트랙 확대"
              onClick={() => dialog.current?.showModal()}
              className={`${buttonClass} absolute right-3 top-3 bg-[#101419]`}
            >
              <Maximize2 size={16} aria-hidden="true" />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-400">
            <span>
              {track.points.length
                ? `OpenF1 위치 · L${lap.lap}${!track.complete ? ' · 부분 표본' : ''}`
                : '참고 트랙 윤곽'}
              {corners.length > 0
                ? ` · 코너 ${corners[0].sourceYear ?? '연도 미상'} 자료`
                : ''}
            </span>
            {layer === 'speed' ? (
              <span className="flex items-center gap-2">
                <span>
                  {metric(speeds.length ? Math.min(...speeds) : null)}
                </span>
                <span className="h-1.5 w-24 bg-[linear-gradient(90deg,#38bdf8,#34d399,#facc15)]" />
                <span>{metric(maxSpeed)} km/h</span>
              </span>
            ) : (
              <span>
                {layer === 'brake'
                  ? '빨강: 브레이크 작동'
                  : layer === 'throttle'
                    ? '밝을수록 높은 스로틀'
                    : 'S1 · S2 · S3'}
              </span>
            )}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              aria-label={playing ? '재생 일시정지' : '랩 재생'}
              title={playing ? '일시정지' : '랩 재생'}
              disabled={!track.points.length}
              onClick={() => {
                if (sample >= track.points.length - 1) setSample(0);
                setPlaying(!playing);
              }}
              className={buttonClass}
            >
              {playing ? (
                <Pause size={17} aria-hidden="true" />
              ) : (
                <Play size={17} aria-hidden="true" />
              )}
            </button>
            <input
              aria-label="위치 표본 선택"
              type="range"
              min="0"
              max={Math.max(0, track.points.length - 1)}
              step="1"
              value={Math.min(sample, Math.max(0, track.points.length - 1))}
              disabled={!track.points.length}
              onChange={(e) => chooseSample(Number(e.target.value))}
              className="min-w-0 flex-1 accent-cyan-300"
            />
            <span className="w-16 text-right text-xs tabular-nums text-neutral-300">
              {metric(point?.elapsedSeconds, 2)} s
            </span>
          </div>
          {corners.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1" aria-label="코너 선택">
              {corners.map((marker) => (
                <button
                  type="button"
                  key={marker.label}
                  onClick={() => chooseSample(marker.pointIndex)}
                  className={`min-h-11 min-w-11 rounded border px-2 text-xs ${corner?.label === marker.label ? 'border-cyan-300 text-cyan-300' : 'border-neutral-800 text-neutral-400'}`}
                >
                  T{marker.label}
                </button>
              ))}
            </div>
          )}
        </section>
        <section
          aria-label="선택 지점 차량 기록"
          data-testid="selected-sample"
          className="min-w-0 border-l-0 border-neutral-800 xl:border-l xl:pl-6"
        >
          <div className="flex items-center gap-2 text-neutral-400">
            <Gauge size={16} aria-hidden="true" />
            <h3 className="text-base font-semibold text-white">
              {corner ? `코너 ${corner.label} 주변 표본` : '선택 지점 기록'}
            </h3>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-4xl font-semibold tabular-nums text-yellow-300">
              {metric(point?.speed)}
            </span>
            <span className="text-sm text-neutral-400">km/h</span>
          </div>
          <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-5">
            {[
              {
                label: '스로틀',
                value: `${metric(point?.throttle)} %`,
                color: 'text-emerald-300',
              },
              {
                label: '브레이크',
                value:
                  point?.brake == null
                    ? '--'
                    : point.brake > 0
                      ? '작동'
                      : '해제',
                color: 'text-rose-300',
              },
              {
                label: 'RPM',
                value: metric(point?.rpm),
                color: 'text-indigo-200',
              },
              {
                label: '기어',
                value: `${metric(point?.gear)} 단`,
                color: 'text-pink-200',
              },
            ].map((item) => (
              <div key={item.label}>
                <dt className="text-xs text-neutral-400">{item.label}</dt>
                <dd className={`mt-2 text-xl tabular-nums ${item.color}`}>
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-6 border-t border-neutral-800 pt-4 text-xs leading-6 text-neutral-400">
            <p>
              L{lap.lap} · 시작 후 {metric(point?.elapsedSeconds, 3)} s
            </p>
            <p>선택 랩 평균 속도 {metric(avgSpeed)} km/h</p>
            <p>
              평균 스로틀 {metric(throttleAverage)} % · 제동 전환 {lapData.cars.some(car => validNumber(car.brake)) ? brakeEvents : '--'}
              회
            </p>
            <p>
              {corners.length
                ? '코너 위치에 가까운 차량 표본입니다.'
                : '코너 번호 자료가 맞지 않으면 지점 기록으로 표시합니다.'}
            </p>
          </div>
        </section>
      </div>
      <section
        className="border-t border-neutral-800 pt-5"
        aria-label="선택 랩 차량 데이터"
      >
        <div className="mb-4 flex items-center gap-2">
          <Activity size={17} className="text-cyan-300" aria-hidden="true" />
          <h3 className="text-base font-semibold">선택 랩 차량 데이터</h3>
          <span className="ml-auto text-xs text-neutral-400">
            L{lap.lap} · 경과 시간 기준
          </span>
        </div>
        <div className="grid min-w-0 gap-5 lg:grid-cols-3">
          {charts.map((chart) => (
            <div key={chart.id} className="min-w-0">
              <div className="mb-2 flex justify-between gap-2 text-xs">
                <h4 className="font-medium text-neutral-200">{chart.title}</h4>
                <span className="text-neutral-500">{chart.unit}</span>
              </div>
              <div
                className="h-44 min-w-0 overflow-hidden"
                data-testid={chart.id}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={sensorPlot(lapData.cars)}
                    margin={{ top: 10, right: 8, left: -20, bottom: 0 }}
                    onMouseMove={(state) => {
                      if (playing || state.activeLabel == null) return;
                      const elapsed = Number(state.activeLabel);
                      if (!Number.isFinite(elapsed)) return;
                      const nearby = trackPointAtElapsed(track, elapsed);
                      if (nearby) setSample(track.points.indexOf(nearby));
                    }}
                  >
                    <CartesianGrid
                      stroke="#26303a"
                      vertical={false}
                      strokeDasharray="2 4"
                    />
                    <XAxis
                      dataKey="elapsed"
                      type="number"
                      domain={[0, lap.lapTime ?? 'auto']}
                      stroke="#8693a3"
                      fontSize={10}
                      tickFormatter={(v) => `${Number(v).toFixed(0)}s`}
                    />
                    <YAxis
                      yAxisId="main"
                      stroke="#8693a3"
                      fontSize={10}
                      domain={
                        chart.id === 'controls-chart' ? [0, 100] : [0, 'auto']
                      }
                    />
                    {chart.id === 'rpm-gear-chart' && (
                      <YAxis
                        yAxisId="gear"
                        orientation="right"
                        domain={[0, 8]}
                        width={22}
                        stroke="#d8a7cb"
                        fontSize={10}
                      />
                    )}
                    <Tooltip
                      contentStyle={{
                        background: '#151b23',
                        border: '1px solid #465365',
                        borderRadius: 6,
                        fontSize: 11,
                      }}
                      labelFormatter={(v) => `${Number(v).toFixed(3)} s`}
                      formatter={(value, name) => [
                        Number(value).toFixed(0),
                        name,
                      ]}
                    />
                    {point && (
                      <ReferenceLine
                        x={point.elapsedSeconds}
                        yAxisId="main"
                        stroke="#dbe7f5"
                        strokeDasharray="3 3"
                      />
                    )}
                    {chart.lines.map((line) => (
                      <Line
                        key={line.key}
                        yAxisId={line.key === 'gear' ? 'gear' : 'main'}
                        type={
                          line.key === 'brake' || line.key === 'gear'
                            ? 'stepAfter'
                            : 'linear'
                        }
                        dataKey={line.key}
                        name={line.label}
                        stroke={line.color}
                        strokeWidth={1.8}
                        dot={false}
                        connectNulls={false}
                        isAnimationActive={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section
        className="border-t border-neutral-800 pt-5"
        aria-label="경기 전체 흐름"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold">랩 퍼포먼스 흐름</h3>
          <label className="flex min-h-11 items-center gap-2 text-xs text-neutral-400">
            <input
              type="checkbox"
              checked={includePitOut}
              onChange={(e) => setIncludePitOut(e.target.checked)}
              className="accent-cyan-300"
            />
            피트 아웃 랩 포함
          </label>
        </div>
        <div className="grid min-w-0 gap-5 lg:grid-cols-3">
          {[
            {
              id: 'lap-flow-chart',
              title: '랩타임 · 초',
              lines: [{ key: 'lapTime', label: '랩타임', color: '#22d3ee' }],
            },
            {
              id: 'sector-chart',
              title: '섹터 기록 · 초',
              lines: [
                { key: 'sector1', label: 'S1', color: sectorColors[0] },
                { key: 'sector2', label: 'S2', color: sectorColors[1] },
                { key: 'sector3', label: 'S3', color: sectorColors[2] },
              ],
            },
            {
              id: 'trap-chart',
              title: '스피드 트랩 · km/h',
              lines: [
                { key: 'trapSpeed', label: '스피드 트랩', color: '#facc15' },
              ],
            },
          ].map((chart) => (
            <div key={chart.id} className="min-w-0">
              <p className="mb-2 text-xs text-neutral-400">{chart.title}</p>
              <div
                className="h-48 min-w-0 overflow-hidden"
                data-testid={chart.id}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={lapPlot(session.laps, includePitOut)}
                    margin={{ top: 10, right: 10, left: -18, bottom: 0 }}
                    onClick={(state) => {
                      const chosen = session.laps.find(
                        (item) => item.lap === Number(state.activeLabel),
                      );
                      if (chosen && positive(chosen.lapTime) && !loading)
                        selectLap(chosen);
                    }}
                  >
                    <CartesianGrid
                      stroke="#26303a"
                      vertical={false}
                      strokeDasharray="2 4"
                    />
                    <XAxis
                      dataKey="lap"
                      stroke="#8693a3"
                      fontSize={10}
                      minTickGap={25}
                      tickFormatter={(v) => `L${v}`}
                    />
                    <YAxis
                      stroke="#8693a3"
                      fontSize={10}
                      domain={['auto', 'auto']}
                    />
                    <Tooltip
                      contentStyle={{
                        background: '#151b23',
                        border: '1px solid #465365',
                        fontSize: 11,
                        borderRadius: 6,
                      }}
                      labelFormatter={(v) => `L${v}`}
                      formatter={(value, name) => [
                        Number(value).toFixed(
                          chart.id === 'trap-chart' ? 0 : 3,
                        ) + (chart.id === 'trap-chart' ? ' km/h' : ' s'),
                        name,
                      ]}
                    />
                    <ReferenceLine
                      x={lap.lap}
                      stroke="#dbe7f5"
                      strokeDasharray="3 3"
                    />
                    {chart.lines.map((line) => (
                      <Line
                        key={line.key}
                        type="linear"
                        dataKey={line.key}
                        name={line.label}
                        stroke={line.color}
                        strokeWidth={1.8}
                        dot={false}
                        connectNulls={false}
                        isAnimationActive={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {(['sector1', 'sector2', 'sector3'] as const).map((key, i) => {
            const values = eligibleLaps(session.laps)
              .map((item) => item[key])
              .filter(positive);
            return (
              <div
                key={key}
                className="border-l-2 pl-3"
                style={{ borderColor: sectorColors[i] }}
              >
                <p className="text-xs text-neutral-400">
                  S{i + 1} · 각 섹터 개인 최단
                </p>
                <p className="mt-1 text-lg tabular-nums">
                  {seconds(values.length ? Math.min(...values) : null)} s
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  평균 {seconds(mean(values))} s · 서로 다른 랩일 수 있음
                </p>
              </div>
            );
          })}
        </div>
      </section>
      <section
        className="border-t border-neutral-800 pt-5"
        data-testid="tyre-strategy"
      >
        <h3 className="text-base font-semibold">타이어 구간과 날씨 흐름</h3>
        <div className="mt-5 grid gap-5 md:grid-cols-3">
          {session.stints.map((stint) => {
            const times = eligibleLaps(session.laps)
              .filter(
                (item) =>
                  item.lap >= stint.lapStart && item.lap <= stint.lapEnd,
              )
              .map((item) => item.lapTime!);
            return (
              <div
                key={stint.stintNumber}
                className="border-l-4 pl-4"
                style={{ borderColor: tyreColors[stint.compound] ?? '#7d8796' }}
              >
                <div className="flex items-center justify-between gap-3">
                  <span
                    className="text-sm font-semibold"
                    style={{ color: tyreColors[stint.compound] ?? '#adb6c4' }}
                  >
                    {stint.compound}
                  </span>
                  <span className="text-xs text-neutral-400">
                    {stint.lapEnd - stint.lapStart + 1}랩
                  </span>
                </div>
                <p className="mt-2 text-lg tabular-nums">
                  L{stint.lapStart}–{stint.lapEnd}
                </p>
                <p className="mt-2 text-xs leading-6 text-neutral-400">
                  시작 사용 이력{' '}
                  {stint.tyreAgeAtStart === null
                    ? '--'
                    : `${stint.tyreAgeAtStart}랩`}
                  <br />
                  평균 {lapClock(mean(times))}
                  <br />
                  베스트 {lapClock(times.length ? Math.min(...times) : null)}
                </p>
              </div>
            );
          })}
        </div>
        {!session.stints.length && (
          <p className="mt-3 text-sm text-neutral-400">타이어 기록 미수신</p>
        )}
        {session.pits.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-4 border-t border-neutral-800 pt-4 text-xs text-neutral-300">
            {session.pits.map((pit, i) => (
              <span key={i}>
                피트 L{pit.lap} · 피트 구간{' '}
                {pit.duration === null ? '--' : pit.duration.toFixed(2)} s
              </span>
            ))}
          </div>
        )}
        <div
          className="mt-6 border-t border-neutral-800 pt-5"
          data-testid="weather-summary"
        >
          <h4 className="text-sm font-medium">레이스 중 날씨</h4>
          <dl className="mt-4 grid grid-cols-2 gap-5 lg:grid-cols-4">
            {[
              { key: 'track_temperature', label: '노면 온도', unit: '°C' },
              { key: 'air_temperature', label: '기온', unit: '°C' },
              { key: 'humidity', label: '습도', unit: '%' },
              { key: 'wind_speed', label: '풍속', unit: 'm/s' },
            ].map((item) => {
              const value = weatherMetric(
                session.weather,
                item.key as keyof (typeof session.weather)[number],
              );
              return (
                <div key={item.key}>
                  <dt className="text-xs text-neutral-400">{item.label}</dt>
                  <dd className="mt-1 text-xl tabular-nums">
                    {value ? `${value.average.toFixed(1)} ${item.unit}` : '--'}
                  </dd>
                  <dd className="mt-1 text-xs text-neutral-500">
                    {value
                      ? `${value.min.toFixed(1)}–${value.max.toFixed(1)} ${item.unit}`
                      : '측정값 없음'}
                  </dd>
                </div>
              );
            })}
          </dl>
          <p className="mt-4 text-xs text-neutral-400">
            {session.weather.some((item) => item.rainfall === 1)
              ? '강수 관측 있음'
              : session.weather.some((item) => item.rainfall === 0)
                ? '수신 표본에서 강수 없음'
                : '강수 자료 없음'}{' '}
            · {session.weather.length}개 날씨 표본
          </p>
        </div>
      </section>
      <details className="border-t border-neutral-800 py-3 text-xs text-neutral-400">
        <summary className="min-h-11 cursor-pointer text-sm">
          데이터 출처와 집계 범위
        </summary>
        <div className="space-y-2 leading-6">
          <p>
            <a
              href="https://openf1.org/docs/"
              target="_blank"
              rel="noreferrer"
              className="text-cyan-300 underline"
            >
              OpenF1
            </a>{' '}
            · 세션 {session.sessionKey}. 위치와 차량 채널을 시각으로 연결합니다.
            랩 시작 시각과 위치 좌표는 근사값입니다.
          </p>
          <p>
            개인 베스트·평균은 피트 아웃 랩과 시간 누락을 제외합니다. 피트 인
            랩·SC·트래픽의 영향은 포함됩니다. 속도는 선택 랩 표본과 스피드 트랩
            지점 기록을 따로 표시합니다.
          </p>
          <p>
            코너는{' '}
            <a
              href="https://github.com/theOehrly/Fast-F1/tree/master/fastf1/mvapi"
              target="_blank"
              rel="noreferrer"
              className="text-cyan-300 underline"
            >
              MultiViewer / FastF1
            </a>
            의 수동 주석을 실제 위치와 대조합니다. 코너별 공식 진입·정점·탈출
            속도는 제공하지 않습니다. 지도 색은 현재 선택한 채널 값입니다.
          </p>
          <p>
            차량 위치가 없으면 공개 GeoJSON 참고 윤곽을 표시하며, 그 위에 차량
            데이터를 임의로 배치하지 않습니다. 날씨 온도는 노면·기온이며 타이어
            온도가 아닙니다.
          </p>
        </div>
      </details>
      <dialog
        ref={dialog}
        aria-label="확대한 트랙 지도"
        className="m-auto max-h-[90vh] w-[min(1100px,95vw)] overflow-auto border border-neutral-600 bg-[#101419] p-4 text-white backdrop:bg-black/80"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm">L{lap.lap} · 트랙 레이아웃</span>
          <button
            type="button"
            className="min-h-11 px-3 text-sm"
            onClick={() => dialog.current?.close()}
          >
            닫기
          </button>
        </div>
        <div className="overflow-auto">
          <div className="aspect-[32/21] min-w-[600px]">{diagram}</div>
        </div>
      </dialog>
    </div>
  );
}
