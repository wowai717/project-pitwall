'use client';

import { useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import TrackMap from './TrackMap';
import {
  fillLapGaps,
  lapClock,
  mean,
  positive,
  seconds,
  summarizeLaps,
  weatherMetric,
  type Lap,
} from './telemetry-data';

interface Stint {
  compound: string;
  lapStart: number;
  lapEnd: number;
  stintNumber: number;
  tyreAgeAtStart: number | null;
}
interface Weather {
  air_temperature?: number;
  track_temperature?: number;
  humidity?: number;
  wind_speed?: number;
  rainfall?: number;
}
interface Props {
  year: number;
  raceName: string;
  laps: Lap[];
  cars: { speed: number }[];
  stints: Stint[];
  weather: Weather[];
  retry: () => void;
}
const sectorLines = [
  { key: 'sector1', label: 'S1', color: '#fb5b65' },
  { key: 'sector2', label: 'S2', color: '#22d3ee' },
  { key: 'sector3', label: 'S3', color: '#facc15' },
] as const;
const tyreColors: Record<string, string> = {
  SOFT: '#fb5b65',
  MEDIUM: '#facc15',
  HARD: '#e5e7eb',
  INTERMEDIATE: '#4ade80',
  WET: '#38bdf8',
};

export default function TelemetryView({
  year,
  raceName,
  laps,
  cars,
  stints,
  weather,
  retry,
}: Props) {
  const [chart, setChart] = useState<'lap' | 'sector' | 'speed'>('lap');
  const summary = summarizeLaps(laps);
  const carSpeeds = cars.map((p) => p.speed).filter(positive);
  const bestLap = laps.reduce<Lap | null>(
    (best, lap) => (!best || lap.lapTime < best.lapTime ? lap : best),
    null,
  );
  const missing = [
    !cars.length && '차량 속도',
    !stints.length && '타이어',
    !weather.length && '날씨',
  ].filter(Boolean);
  const lines =
    chart === 'sector'
      ? sectorLines
      : [
          {
            key: chart === 'lap' ? 'lapTime' : 'trapSpeed',
            label: chart === 'lap' ? '랩타임' : '스피드 트랩',
            color: chart === 'lap' ? '#22d3ee' : '#facc15',
          },
        ];
  const stats = [
    {
      label: '개인 베스트 랩',
      value: lapClock(summary.best),
      detail: bestLap ? `L${bestLap.lap} · 수신한 유효 랩 기준` : '기록 없음',
      color: 'text-cyan-300',
    },
    {
      label: '스피드 트랩 최고',
      value: summary.trapMax === null ? '--' : `${summary.trapMax.toFixed(0)}`,
      detail: 'km/h · 유효 랩의 측정 지점',
      color: 'text-yellow-300',
    },
    {
      label: '분석한 랩',
      value: String(summary.count),
      detail: '피트 아웃 랩·무효 시간 제외',
      color: 'text-white',
    },
    {
      label: '평균 랩 편차',
      value:
        summary.variation === null ? '--' : `${summary.variation.toFixed(2)} s`,
      detail: '평균 절대 편차 · 피트 인 랩 포함',
      color: 'text-emerald-300',
    },
  ];
  return (
    <div className="space-y-8 text-neutral-100" style={{ letterSpacing: 0 }}>
      {missing.length > 0 && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 border-b border-yellow-500/30 pb-3 text-xs text-yellow-200"
        >
          <span>일부 자료 미수신: {missing.join(', ')}</span>
          <button
            type="button"
            onClick={retry}
            className="min-h-11 underline underline-offset-4"
          >
            누락 데이터 다시 조회
          </button>
        </div>
      )}
      <dl className="grid grid-cols-2 gap-x-5 gap-y-5 border-b border-neutral-800 pb-6 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="min-w-0">
            <dt className="text-xs text-neutral-400">{stat.label}</dt>
            <dd
              className={`mt-2 text-2xl font-semibold tabular-nums ${stat.color}`}
            >
              {stat.value}
            </dd>
            <dd className="mt-2 text-xs leading-5 text-neutral-500">
              {stat.detail}
            </dd>
          </div>
        ))}
      </dl>
      <div className="grid min-w-0 gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <TrackMap raceName={raceName} year={year} />
        <section className="min-w-0" aria-label="랩별 기록">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 pb-4">
            <div>
              <p className="text-xs text-neutral-400">LAP ANALYSIS</p>
              <h3 className="mt-1 text-lg font-semibold">랩 퍼포먼스 흐름</h3>
            </div>
            <span className="text-xs text-neutral-400">
              {chart === 'speed' ? 'km/h' : '초'}
            </span>
          </div>
          <div
            role="group"
            aria-label="그래프 종류"
            className="my-4 flex border-b border-neutral-800 text-sm"
          >
            {(
              [
                { id: 'lap', label: '랩타임' },
                { id: 'sector', label: '섹터' },
                { id: 'speed', label: '스피드 트랩' },
              ] as const
            ).map((tab) => (
              <button
                type="button"
                key={tab.id}
                aria-pressed={chart === tab.id}
                onClick={() => setChart(tab.id)}
                className={`min-h-11 flex-1 border-b-2 px-2 ${chart === tab.id ? 'border-cyan-300 text-white' : 'border-transparent text-neutral-400 hover:text-white'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div
            className="h-64 min-w-0 overflow-hidden sm:h-72"
            data-testid="lap-chart"
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={fillLapGaps(laps)}
                margin={{ top: 12, right: 12, left: -16, bottom: 6 }}
              >
                <CartesianGrid
                  stroke="#262b31"
                  strokeDasharray="3 4"
                  vertical={false}
                />
                <XAxis
                  dataKey="lap"
                  stroke="#9ca3af"
                  fontSize={11}
                  minTickGap={24}
                  tickFormatter={(v) => `L${v}`}
                />
                <YAxis
                  stroke="#9ca3af"
                  fontSize={11}
                  domain={['auto', 'auto']}
                  width={56}
                  tickFormatter={(v) =>
                    Number(v).toFixed(chart === 'speed' ? 0 : 1)
                  }
                />
                <Tooltip
                  contentStyle={{
                    background: '#15191e',
                    border: '1px solid #46505c',
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                  labelFormatter={(label) => `L${label}`}
                  formatter={(value, name) => [
                    value == null
                      ? '--'
                      : `${Number(value).toFixed(chart === 'speed' ? 0 : 3)} ${chart === 'speed' ? 'km/h' : 's'}`,
                    name,
                  ]}
                />
                {lines.map((line) => (
                  <Line
                    key={line.key}
                    type="linear"
                    dataKey={line.key}
                    name={line.label}
                    stroke={line.color}
                    strokeWidth={2}
                    dot={false}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-xs">
            {lines.map((line) => (
              <span key={line.key} className="flex items-center gap-2">
                <span
                  style={{ background: line.color }}
                  className="h-0.5 w-4"
                />
                {line.label}
              </span>
            ))}
          </div>
          {chart === 'speed' && (
            <p className="mt-3 text-xs text-neutral-400">
              스피드 트랩 지점 기록. 차량의 랩 전체 최고 속도와 다릅니다.
            </p>
          )}
        </section>
      </div>
      <section className="border-t border-neutral-800 pt-6">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-base font-semibold">섹터별 기록</h3>
          <span className="text-xs text-neutral-400">
            각 섹터의 개인 최단 기록 · 서로 다른 랩일 수 있음
          </span>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {sectorLines.map((sector) => {
            const values = laps.map((lap) => lap[sector.key]).filter(positive);
            return (
              <dl
                key={sector.key}
                className="border-l-2 pl-4"
                style={{ borderColor: sector.color }}
              >
                <dt className="text-sm" style={{ color: sector.color }}>
                  {sector.label}
                </dt>
                <dd className="mt-2 text-xl tabular-nums">
                  {seconds(values.length ? Math.min(...values) : null)}{' '}
                  <span className="text-xs text-neutral-400">s</span>
                </dd>
                <dd className="mt-1 text-xs text-neutral-400">
                  평균 {seconds(mean(values))} s · {values.length}개 기록
                </dd>
              </dl>
            );
          })}
        </div>
      </section>
      <section className="border-t border-neutral-800 pt-6">
        <h3 className="text-base font-semibold">타이어 사용 기록</h3>
        {stints.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[440px] text-left text-sm">
              <thead className="text-xs text-neutral-400">
                <tr>
                  <th className="pb-3 font-normal">컴파운드</th>
                  <th className="pb-3 font-normal">사용 구간</th>
                  <th className="pb-3 font-normal">시작 시 사용 이력</th>
                  <th className="pb-3 text-right font-normal">평균 랩</th>
                </tr>
              </thead>
              <tbody>
                {stints.map((stint) => {
                  const times = laps
                    .filter(
                      (lap) =>
                        lap.lap >= stint.lapStart && lap.lap <= stint.lapEnd,
                    )
                    .map((lap) => lap.lapTime);
                  return (
                    <tr
                      key={stint.stintNumber}
                      className="border-t border-neutral-800"
                    >
                      <td className="py-3">
                        <span
                          className="mr-2 inline-block h-2 w-2 rounded-full"
                          style={{
                            background: tyreColors[stint.compound] ?? '#9ca3af',
                          }}
                        />
                        {stint.compound}
                      </td>
                      <td className="tabular-nums">
                        L{stint.lapStart}–{stint.lapEnd}
                      </td>
                      <td>
                        {stint.tyreAgeAtStart === null
                          ? '--'
                          : `${stint.tyreAgeAtStart}랩`}
                      </td>
                      <td className="text-right tabular-nums">
                        {lapClock(mean(times))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-neutral-400">
            타이어 기록을 받지 못했습니다.
          </p>
        )}
      </section>
      <section className="border-t border-neutral-800 pt-6">
        <h3 className="text-base font-semibold">세션 날씨</h3>
        <dl className="mt-4 grid grid-cols-2 gap-5 lg:grid-cols-4">
          {[
            { key: 'track_temperature', label: '노면', unit: '°C' },
            { key: 'air_temperature', label: '기온', unit: '°C' },
            { key: 'humidity', label: '습도', unit: '%' },
            { key: 'wind_speed', label: '풍속', unit: 'm/s' },
          ].map((item) => {
            const metric = weatherMetric(
              weather.map((row) => ({ ...row })),
              item.key,
            );
            return (
              <div key={item.key}>
                <dt className="text-xs text-neutral-400">{item.label}</dt>
                <dd className="mt-2 text-lg tabular-nums">
                  {metric ? `${metric.average.toFixed(1)} ${item.unit}` : '--'}
                </dd>
                <dd className="mt-1 text-xs text-neutral-500">
                  {metric
                    ? `${metric.min.toFixed(1)}–${metric.max.toFixed(1)} ${item.unit}`
                    : '측정값 없음'}
                </dd>
              </div>
            );
          })}
        </dl>
        <p className="mt-4 text-xs text-neutral-400">
          {weather.some((p) => p.rainfall === 1)
            ? '강수 관측 있음'
            : weather.some((p) => p.rainfall === 0)
              ? '수신 표본에서 강수 없음'
              : '강수 자료 없음'}{' '}
          · {weather.length}개 세션 표본
        </p>
      </section>
      <details className="border-t border-neutral-800 pt-4 text-xs text-neutral-400">
        <summary className="min-h-11 cursor-pointer text-sm text-neutral-300">
          데이터 출처 및 집계 범위
        </summary>
        <div className="space-y-2 leading-6">
          <p>
            <a
              href="https://openf1.org/docs/#laps"
              target="_blank"
              rel="noreferrer"
              className="text-cyan-300 underline"
            >
              OpenF1
            </a>{' '}
            · {year} {raceName}. 현재 선수의 수신 데이터 기준이며 공식 경기 전체
            최고 기록이 아닙니다.
          </p>
          <p>
            유효 랩 평균 {lapClock(summary.average)}. 피트 아웃 랩은 제외하며
            피트 인 랩, 세이프티카, 트래픽의 영향은 남아 있습니다. 평균 절대
            편차만으로 선수의 순수 페이스를 판단할 수 없습니다.
          </p>
          <p>
            차량 속도는 개인 베스트 랩의 시간 범위에서 조회합니다. 수신 표본
            최고{' '}
            {carSpeeds.length
              ? `${Math.max(...carSpeeds).toFixed(0)} km/h`
              : '--'}
            . 랩 시작 시각은 근사치이며 차량 자료와 지도 좌표를 임의로 연결하지
            않습니다.
          </p>
          <p>
            누락된 기록은 0으로 대체하지 않습니다. 섹터별 최단 기록의 합은 실제
            베스트 랩과 다를 수 있습니다. OpenF1 속도는 정수 표본이어서 공식
            기록의 소수점 단위와 차이가 있을 수 있습니다. 지도 색상은 섹터
            구분이며 속도·제동 강도가 아닙니다.
          </p>
        </div>
      </details>
    </div>
  );
}
