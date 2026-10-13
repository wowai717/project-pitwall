'use client';

import { useRef, useState } from 'react';
import circuits from './data/f1-circuits.json';
import hints from './data/trackCircuitHints.json';
import { normalizeCoordinates } from './telemetry-data';

const source =
  'https://www.fia.com/sites/default/files/2023_bahrain_grand_prix_-_event_notes_-_circuit_map.pdf';
// Schematic coordinates, not a survey or a telemetry-to-map calibration.
const sectors = [
  {
    name: 'S1',
    color: '#fb5b65',
    path: 'M390 360 H64 Q45 360 54 342 L78 312 Q84 303 79 289 L68 258 Q65 248 68 232 L107 63 Q111 44 128 49 Q139 52 151 68 L206 131 Q222 146 242 151',
  },
  {
    name: 'S2',
    color: '#22d3ee',
    path: 'M242 151 Q268 159 265 183 L262 204 Q260 219 279 232 L334 275 Q349 289 327 287 L219 271 Q202 269 189 283 L163 314 Q159 319 174 320 H459 Q481 320 480 296 Q478 274 460 252 L424 218 Q413 206 419 188 L442 128',
  },
  {
    name: 'S3',
    color: '#facc15',
    path: 'M442 128 L459 83 Q472 55 487 84 L589 330 Q600 349 582 355 L565 360 H390',
  },
];
const corners = [
  [48, 370],
  [99, 310],
  [46, 251],
  [111, 27],
  [219, 157],
  [282, 176],
  [246, 224],
  [356, 290],
  [207, 249],
  [143, 318],
  [495, 303],
  [399, 211],
  [471, 45],
  [610, 340],
  [566, 385],
];

export function referenceTrack(raceName: string) {
  const key = raceName.toLowerCase().replace('grand prix', 'gp').trim();
  if (key === 'sakhir gp') return [];
  const hint = hints[key as keyof typeof hints];
  if (!hint) return [];
  const normalize = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  const feature = circuits.features.find(
    (f) =>
      normalize(f.properties.Name) === normalize(hint) ||
      (key === 'styrian gp' && f.properties.Name === 'Red Bull Ring'),
  );
  if (!feature || feature.geometry.type !== 'LineString') return [];
  return normalizeCoordinates(
    (feature.geometry.coordinates as number[][]).map(([x, y]) => ({ x, y })),
    true,
  );
}

export default function TrackMap({
  raceName,
  year,
}: {
  raceName: string;
  year: number;
}) {
  const [showCorners, setShowCorners] = useState(true);
  const [showSectors, setShowSectors] = useState(true);
  const [showDrs, setShowDrs] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const annotated =
    year === 2023 && raceName.toLowerCase() === 'bahrain grand prix';
  const points = referenceTrack(raceName);
  const diagram = (
    <svg
      viewBox="0 0 640 420"
      role="img"
      aria-label={
        annotated
          ? '바레인 2023: 코너 1~15, 섹터 1~3, 출발선 개략도'
          : `${raceName} 참고 트랙 윤곽`
      }
      className="my-3 aspect-[32/21] w-full overflow-visible"
    >
      {annotated ? (
        <>
          {sectors.map((s) => (
            <path
              key={`${s.name}-base`}
              d={s.path}
              fill="none"
              stroke="#303740"
              strokeWidth="18"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
          {sectors.map((s) => (
            <path
              key={s.name}
              d={s.path}
              fill="none"
              stroke={showSectors ? s.color : '#e5e7eb'}
              strokeWidth="5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
          {showDrs && (
            <g
              stroke="#4ade80"
              strokeWidth="3"
              strokeDasharray="3 4"
              fill="none"
              aria-label="DRS 활성 구간 개략 위치"
            >
              <path d="M58 226 L92 78" />
              <path d="M191 333 H449" />
              <path d="M546 372 H132" />
            </g>
          )}
          {showCorners &&
            corners.map(([x, y], i) => (
              <g key={i}>
                <circle cx={x} cy={y} r="12" fill="#111419" stroke="#5c6672" />
                <text
                  x={x}
                  y={y + 4}
                  fill="white"
                  textAnchor="middle"
                  fontSize="12"
                  fontWeight="600"
                >
                  {i + 1}
                </text>
              </g>
            ))}
          <path
            d="M390 351 V369"
            stroke="white"
            strokeWidth="4"
            strokeDasharray="3 3"
          />
          <text
            x="390"
            y="397"
            fill="#d1d5db"
            textAnchor="middle"
            fontSize="12"
          >
            START / FINISH
          </text>
          <path
            d="M330 344 H298 L306 339 M298 344 L306 349"
            fill="none"
            stroke="#d1d5db"
            strokeWidth="2"
          />
        </>
      ) : points.length > 1 ? (
        <>
          <polyline
            points={points.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke="#303740"
            strokeWidth="16"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <polyline
            points={points.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke="#c9f3f9"
            strokeWidth="5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </>
      ) : (
        <text x="320" y="210" textAnchor="middle" fill="#a3a3a3" fontSize="16">
          해당 레이아웃 자료 없음
        </text>
      )}
    </svg>
  );
  return (
    <section className="min-w-0" aria-label="트랙 레이아웃">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 pb-4">
        <div>
          <p className="text-xs text-neutral-400">CIRCUIT</p>
          <h3 className="mt-1 text-lg font-semibold">트랙 레이아웃</h3>
        </div>
        {annotated && (
          <div className="flex gap-4 text-xs text-neutral-300">
            <label className="flex min-h-11 items-center gap-2">
              <input
                type="checkbox"
                checked={showCorners}
                onChange={(e) => setShowCorners(e.target.checked)}
                className="accent-cyan-400"
              />
              코너 번호
            </label>
            <label className="flex min-h-11 items-center gap-2">
              <input
                type="checkbox"
                checked={showSectors}
                onChange={(e) => setShowSectors(e.target.checked)}
                className="accent-cyan-400"
              />
              섹터
            </label>
            <label className="flex min-h-11 items-center gap-2">
              <input
                type="checkbox"
                checked={showDrs}
                onChange={(e) => setShowDrs(e.target.checked)}
                className="accent-green-400"
              />
              DRS
            </label>
          </div>
        )}
      </div>
      <div className="relative">
        {diagram}
        <button
          type="button"
          onClick={() => dialog.current?.showModal()}
          className="absolute right-0 top-1 min-h-11 px-3 text-xs text-neutral-300 underline"
          aria-label="트랙 지도 확대"
        >
          확대
        </button>
      </div>
      <dialog
        ref={dialog}
        className="m-auto w-[min(960px,95vw)] max-h-[90vh] border border-neutral-700 bg-[#090c10] p-4 text-white backdrop:bg-black/80"
        aria-label="확대한 트랙 지도"
      >
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-base font-semibold">{raceName}</h3>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            className="min-h-11 px-3 text-sm"
          >
            닫기
          </button>
        </div>
        <div className="overflow-auto">
          <div className="min-w-[640px]">{diagram}</div>
        </div>
      </dialog>
      {annotated && (
        <div className="flex gap-5 text-xs">
          {sectors.map((s) => (
            <span key={s.name} className="flex items-center gap-2">
              <span style={{ background: s.color }} className="h-1 w-5" />
              {s.name}
            </span>
          ))}
          <span className="ml-auto text-neutral-400">15 코너</span>
        </div>
      )}
      {annotated && showDrs && (
        <p className="mt-3 text-xs text-green-300">
          녹색 점선: DRS 활성 구간 개략 위치. T3 이후 23m · T10 이후 50m · T15
          이후 250m부터.
        </p>
      )}
      <p className="mt-4 text-xs leading-5 text-neutral-400">
        {annotated ? (
          <>
            2023 FIA 지도 기반 개략도. 위치·거리는 축척과 다릅니다.{' '}
            <a
              href={source}
              target="_blank"
              rel="noreferrer"
              className="text-cyan-300 underline"
            >
              공식 지도
            </a>
          </>
        ) : (
          <>
            공개 GeoJSON 참고 윤곽. {year}년 레이아웃·코너·섹터 위치는
            미검증입니다.{' '}
            <a
              href="https://github.com/bacinger/f1-circuits"
              target="_blank"
              rel="noreferrer"
              className="text-cyan-300 underline"
            >
              지도 출처 (MIT)
            </a>
          </>
        )}
      </p>
    </section>
  );
}
