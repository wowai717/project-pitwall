"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { circuitGeoJson } from './data/circuitGeoJson';
import trackCircuitHints from './data/trackCircuitHints.json';

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

interface OpenF1LapDataPoint {
  date_start?: string;
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
  date?: string;
  x: number;
  y: number;
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

interface TrackPoint {
  x: number;
  y: number;
}

interface GeoJsonCircuitFeature {
  properties?: {
    Name?: string;
    Location?: string;
  };
  geometry?: {
    type?: string;
    coordinates?: unknown;
  };
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

interface LapTelemetryPoint {
  lap: number;
  dateStart?: string;
  lapTime: number;
  sector1: number;
  sector2: number;
  sector3: number;
  trapSpeed: number;
}

interface TyreStint {
  compound: string;
  lapEnd: number;
  lapStart: number;
  stintNumber: number;
  tyreAgeAtStart: number;
}

interface WeatherSummary {
  airTemperature: number;
  airTemperatureMax: number;
  airTemperatureMin: number;
  humidity: number;
  humidityMax: number;
  humidityMin: number;
  rainy: boolean;
  rainfallSamples: number;
  sampleCount: number;
  trackTemperature: number;
  trackTemperatureMax: number;
  trackTemperatureMin: number;
  windSpeed: number;
  windSpeedMax: number;
  windSpeedMin: number;
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
  averageLap: number;
  lapVariation: number;
  totalLaps: number;
}

interface TrackSegment {
  index: number;
  avgSpeed: number;
  avgThrottle: number;
  brakeShare: number;
  speedGain: number;
}

type HeatmapLayer = 'all' | 'brake' | 'speed' | 'throttle';
type TrackSegmentKind = Exclude<HeatmapLayer, 'all'> | 'neutral';
type TrackSource = 'mit-openf1' | 'mit' | 'openf1' | 'loading' | 'missing';

interface ClassifiedTrackSegment extends TrackSegment {
  kind: TrackSegmentKind;
}

interface TrackHighlight {
  detail: string;
  id: Exclude<HeatmapLayer, 'all'>;
  metric: string;
  title: string;
  tone: string;
}

interface SectorMarker {
  label: string;
  point: TrackPoint;
}

interface TelemetryCachePayload {
  carData: CarTelemetryPoint[];
  lapData: LapTelemetryPoint[];
  locationData: OpenF1LocationPoint[];
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

const RACE_CIRCUIT_HINTS = trackCircuitHints as Record<string, string>;

function getCircuitTrackHint(raceName: string) {
  const normalizedRace = normalizeRaceName(raceName);
  return `${raceName} ${RACE_CIRCUIT_HINTS[normalizedRace] ?? ''}`;
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

function minimum(values: number[]) {
  return values.length > 0 ? Math.min(...values) : 0;
}

function maximum(values: number[]) {
  return values.length > 0 ? Math.max(...values) : 0;
}

function percentile(values: number[], ratio: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index];
}

function countBrakeZones(carData: CarTelemetryPoint[]) {
  return carData.reduce((count, point, index) => {
    const previousBrake = index > 0 ? carData[index - 1].brake : 0;
    return point.brake > 0 && previousBrake === 0 ? count + 1 : count;
  }, 0);
}

function getTyreCompoundStyle(compound: string) {
  switch (compound.toUpperCase()) {
    case 'SOFT':
      return 'border-red-400/70 bg-red-500/15 text-red-200';
    case 'MEDIUM':
      return 'border-yellow-400/70 bg-yellow-500/15 text-yellow-100';
    case 'HARD':
      return 'border-neutral-300/70 bg-neutral-100/10 text-neutral-100';
    case 'INTERMEDIATE':
      return 'border-green-400/70 bg-green-500/15 text-green-100';
    case 'WET':
      return 'border-cyan-400/70 bg-cyan-500/15 text-cyan-100';
    default:
      return 'border-neutral-500 bg-neutral-500/10 text-neutral-200';
  }
}

function buildWeatherSummary(weatherData: OpenF1WeatherPoint[]): WeatherSummary | null {
  if (weatherData.length === 0) return null;

  const airTemperatures = weatherData.map((point) => point.air_temperature).filter((value): value is number => typeof value === 'number');
  const trackTemperatures = weatherData.map((point) => point.track_temperature).filter((value): value is number => typeof value === 'number');
  const humidities = weatherData.map((point) => point.humidity).filter((value): value is number => typeof value === 'number');
  const windSpeeds = weatherData.map((point) => point.wind_speed).filter((value): value is number => typeof value === 'number');

  return {
    airTemperature: average(airTemperatures),
    airTemperatureMax: maximum(airTemperatures),
    airTemperatureMin: minimum(airTemperatures),
    humidity: average(humidities),
    humidityMax: maximum(humidities),
    humidityMin: minimum(humidities),
    rainy: weatherData.some((point) => point.rainfall === 1),
    rainfallSamples: weatherData.filter((point) => point.rainfall === 1).length,
    sampleCount: weatherData.length,
    trackTemperature: average(trackTemperatures),
    trackTemperatureMax: maximum(trackTemperatures),
    trackTemperatureMin: minimum(trackTemperatures),
    windSpeed: average(windSpeeds),
    windSpeedMax: maximum(windSpeeds),
    windSpeedMin: minimum(windSpeeds),
  };
}

function formatSeconds(value: number) {
  return Number.isFinite(value) && value > 0 ? value.toFixed(3) : '--';
}

function buildSummary(carData: CarTelemetryPoint[], lapData: LapTelemetryPoint[]): TelemetrySummary {
  const speedSource = carData.length > 0 ? carData.map((point) => point.speed) : lapData.map((lap) => lap.trapSpeed);
  const lapTimes = lapData.map((lap) => lap.lapTime);
  const avgLap = average(lapTimes);
  return {
    topSpeed: Math.max(...speedSource, 0),
    avgSpeed: average(speedSource),
    avgThrottle: average(carData.map((point) => point.throttle)),
    brakeMoments: countBrakeZones(carData),
    bestLap: lapData.length > 0 ? Math.min(...lapData.map((lap) => lap.lapTime)) : 0,
    averageLap: avgLap,
    lapVariation: lapTimes.length > 0 ? average(lapTimes.map((lap) => Math.abs(lap - avgLap))) : 0,
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
      label: '피트 제외 랩',
      value: `${summary.totalLaps}랩`,
      accent: 'text-green-400',
    },
    {
      label: '랩타임 흔들림',
      value: summary.lapVariation > 0 ? `±${summary.lapVariation.toFixed(2)}초` : '데이터 없음',
      accent: 'text-purple-400',
    },
  ];
}

function buildSectorComparison(lapData: LapTelemetryPoint[]) {
  const sectors = [
    { label: '섹터 1', key: 'sector1' as const, color: 'bg-red-500' },
    { label: '섹터 2', key: 'sector2' as const, color: 'bg-green-500' },
    { label: '섹터 3', key: 'sector3' as const, color: 'bg-purple-500' },
  ];

  return sectors.map((sector) => {
    const values = lapData.map((lap) => lap[sector.key]).filter((value) => value > 0);
    const averageSeconds = average(values);
    const bestSeconds = values.length > 0 ? Math.min(...values) : 0;

    return {
      ...sector,
      averageSeconds,
      bestSeconds,
      improvement: averageSeconds > 0 && bestSeconds > 0 ? averageSeconds - bestSeconds : 0,
    };
  });
}

function buildTrackSegments(carData: CarTelemetryPoint[], locationData: OpenF1LocationPoint[]): TrackSegment[] {
  const timestampedCarData = carData
    .map((point) => ({ ...point, timestamp: point.date ? new Date(point.date).getTime() : Number.NaN }))
    .filter((point) => Number.isFinite(point.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp);
  const timestampedLocations = locationData
    .map((point) => ({ ...point, timestamp: point.date ? new Date(point.date).getTime() : Number.NaN }))
    .filter((point) => Number.isFinite(point.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp);

  if (timestampedCarData.length === 0 || timestampedLocations.length === 0) return [];

  const telemetryAtLocation = timestampedLocations.map((location) => {
    let closest = timestampedCarData[0];

    for (const point of timestampedCarData) {
      if (Math.abs(point.timestamp - location.timestamp) >= Math.abs(closest.timestamp - location.timestamp)) break;
      closest = point;
    }

    return closest;
  });
  const segmentCount = 18;
  const segmentSize = Math.max(1, Math.floor(telemetryAtLocation.length / segmentCount));

  return Array.from({ length: segmentCount }, (_, index) => {
    const start = index * segmentSize;
    const end = index === segmentCount - 1 ? telemetryAtLocation.length : Math.min(telemetryAtLocation.length, start + segmentSize);
    const slice = telemetryAtLocation.slice(start, end);

    return {
      index,
      avgSpeed: average(slice.map((point) => point.speed)),
      avgThrottle: average(slice.map((point) => point.throttle)),
      brakeShare: slice.length > 0 ? slice.filter((point) => point.brake > 0).length / slice.length : 0,
      speedGain:
        slice.length > 1
          ? average(slice.slice(Math.floor(slice.length / 2)).map((point) => point.speed)) - average(slice.slice(0, Math.ceil(slice.length / 2)).map((point) => point.speed))
          : 0,
    };
  });
}

function buildSectorMarkers(
  lapData: LapTelemetryPoint[],
  locationData: OpenF1LocationPoint[],
  renderedTrack: TrackPoint[],
): SectorMarker[] {
  const fastestLap = lapData.reduce<LapTelemetryPoint | null>(
    (best, lap) => (!best || lap.lapTime < best.lapTime ? lap : best),
    null,
  );
  const startTime = fastestLap?.dateStart ? new Date(fastestLap.dateStart).getTime() : Number.NaN;
  const timestampedLocations = locationData
    .map((point) => ({ ...point, timestamp: point.date ? new Date(point.date).getTime() : Number.NaN }))
    .filter((point) => Number.isFinite(point.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp);

  if (!fastestLap || !Number.isFinite(startTime) || timestampedLocations.length < 2 || renderedTrack.length < 2) return [];

  const midpointSeconds = [
    fastestLap.sector1 / 2,
    fastestLap.sector1 + fastestLap.sector2 / 2,
    fastestLap.sector1 + fastestLap.sector2 + fastestLap.sector3 / 2,
  ];

  return midpointSeconds
    .map((seconds, index) => {
      if (!Number.isFinite(seconds) || seconds <= 0) return null;

      const targetTime = startTime + seconds * 1000;
      const locationIndex = timestampedLocations.reduce((closestIndex, location, currentIndex) => {
        const closest = timestampedLocations[closestIndex];
        return Math.abs(location.timestamp - targetTime) < Math.abs(closest.timestamp - targetTime)
          ? currentIndex
          : closestIndex;
      }, 0);
      const trackIndex = Math.round((locationIndex / (timestampedLocations.length - 1)) * (renderedTrack.length - 1));

      return {
        label: `S${index + 1}`,
        point: renderedTrack[trackIndex],
      };
    })
    .filter((marker): marker is SectorMarker => marker !== null);
}

function classifyTrackSegments(segments: TrackSegment[]): ClassifiedTrackSegment[] {
  const brakeThreshold = Math.max(0.08, percentile(segments.map((segment) => segment.brakeShare), 0.72));
  const speeds = segments.map((segment) => segment.avgSpeed);
  const throttles = segments.map((segment) => segment.avgThrottle);
  const speedThreshold = percentile(speeds, 0.78);
  const throttleThreshold = percentile(throttles, 0.72);
  const hasSpeedSpread = speeds.length > 0 && Math.max(...speeds) - Math.min(...speeds) >= 8;
  const hasThrottleSpread = throttles.length > 0 && Math.max(...throttles) - Math.min(...throttles) >= 6;

  return segments.map((segment) => {
    let kind: TrackSegmentKind = 'neutral';

    if (segment.brakeShare >= brakeThreshold && segment.brakeShare > 0) {
      kind = 'brake';
    } else if (hasSpeedSpread && segment.avgSpeed >= speedThreshold) {
      kind = 'speed';
    } else if (hasThrottleSpread && segment.avgThrottle >= throttleThreshold && segment.speedGain > 0) {
      kind = 'throttle';
    }

    return { ...segment, kind };
  });
}

function getSegmentColor(kind: TrackSegmentKind) {
  if (kind === 'brake') return '#ef4444';
  if (kind === 'speed') return '#eab308';
  if (kind === 'throttle') return '#22c55e';
  return '#38bdf8';
}

function buildTrackHighlights(segments: ClassifiedTrackSegment[]): TrackHighlight[] {
  if (segments.length === 0) return [];

  const describeLocation = (segment: ClassifiedTrackSegment) => {
    const start = Math.round((segment.index / segments.length) * 100);
    const end = Math.round(((segment.index + 1) / segments.length) * 100);
    return `베스트 랩 진행 ${start}-${end}% 구간`;
  };
  const strongestBrake = [...segments].sort((left, right) => right.brakeShare - left.brakeShare)[0];
  const highestSpeed = [...segments].sort((left, right) => right.avgSpeed - left.avgSpeed)[0];
  const strongestExit = [...segments].sort((left, right) => right.speedGain - left.speedGain)[0];

  return [
    {
      id: 'brake',
      title: '강한 제동 포인트',
      detail: describeLocation(strongestBrake),
      metric: `브레이크 사용 ${Math.round(strongestBrake.brakeShare * 100)}%`,
      tone: 'border-red-500/40 bg-red-500/10 text-red-200',
    },
    {
      id: 'speed',
      title: '가장 빠른 구간',
      detail: describeLocation(highestSpeed),
      metric: `평균 ${Math.round(highestSpeed.avgSpeed)} km/h`,
      tone: 'border-yellow-400/40 bg-yellow-500/10 text-yellow-100',
    },
    {
      id: 'throttle',
      title: '가장 좋은 재가속',
      detail: describeLocation(strongestExit),
      metric: `속도 변화 +${Math.max(0, strongestExit.speedGain).toFixed(0)} km/h`,
      tone: 'border-green-500/40 bg-green-500/10 text-green-100',
    },
  ];
}

function normalizeTrackPoints(locationData: OpenF1LocationPoint[]) {
  if (locationData.length < 2) {
    return [];
  }

  const sampled = locationData.filter((_, index) => index % Math.ceil(locationData.length / 90) === 0);
  return normalizeTrackCoordinates(sampled);
}

function extractCoordinatePairs(value: unknown): TrackPoint[] {
  if (!Array.isArray(value)) return [];

  if (value.length >= 2 && !Array.isArray(value[0]) && !Array.isArray(value[1])) {
    const x = Number(value[0]);
    const y = Number(value[1]);
    return Number.isFinite(x) && Number.isFinite(y) ? [{ x, y }] : [];
  }

  return value.flatMap((item) => extractCoordinatePairs(item));
}

function normalizeGeoJsonTrackPoints(coordinates: unknown) {
  const points = extractCoordinatePairs(coordinates);
  if (points.length < 2) return [];

  const sampled = points.filter((_, index) => index % Math.ceil(points.length / 100) === 0);
  return normalizeTrackCoordinates(sampled);
}

function normalizeTrackCoordinates(points: TrackPoint[]) {
  const validPoints = points.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  if (validPoints.length < 2) return [];

  const xs = validPoints.map((point) => point.x);
  const ys = validPoints.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const sourceWidth = Math.max(maxX - minX, 1);
  const sourceHeight = Math.max(maxY - minY, 1);
  const rotateForWideCard = sourceHeight > sourceWidth * 1.08;
  const rotated = validPoints.map((point) =>
    rotateForWideCard
      ? { x: point.y - minY, y: maxX - point.x }
      : { x: point.x - minX, y: maxY - point.y },
  );
  const rotatedWidth = Math.max(...rotated.map((point) => point.x), 1);
  const rotatedHeight = Math.max(...rotated.map((point) => point.y), 1);
  const viewWidth = 320;
  const viewHeight = 220;
  const padding = 22;
  const scale = Math.min((viewWidth - padding * 2) / rotatedWidth, (viewHeight - padding * 2) / rotatedHeight);
  const offsetX = (viewWidth - rotatedWidth * scale) / 2;
  const offsetY = (viewHeight - rotatedHeight * scale) / 2;

  return rotated.map((point) => ({
    x: offsetX + point.x * scale,
    y: offsetY + point.y * scale,
  }));
}

function isRenderableTrack(points: TrackPoint[]) {
  if (points.length < 2 || points.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) return false;

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) > 24;
}

function hasCompleteTrackShape(points: TrackPoint[]) {
  if (points.length < 16 || !isRenderableTrack(points)) return false;

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const first = points[0];
  const last = points[points.length - 1];
  const closingDistance = Math.hypot(last.x - first.x, last.y - first.y);
  const pathLength = points.slice(1).reduce((length, point, index) => length + Math.hypot(point.x - points[index].x, point.y - points[index].y), 0);
  const boundsPerimeter = 2 * ((Math.max(...xs) - Math.min(...xs)) + (Math.max(...ys) - Math.min(...ys)));

  return span > 50 && closingDistance < span * 0.12 && pathLength > boundsPerimeter * 0.85;
}

function scoreCircuitFeature(trackHint: string, feature: GeoJsonCircuitFeature) {
  const normalizedHint = normalizeRaceName(trackHint);
  const targetWords = tokenize(trackHint);
  const fields = [feature.properties?.Name, feature.properties?.Location].filter(Boolean) as string[];

  return Math.max(
    0,
    ...fields.map((field) => {
      const normalizedField = normalizeRaceName(field);
      if (normalizedField && normalizedHint.includes(normalizedField)) return 100;
      return targetWords.filter((word) => tokenize(field).includes(word)).length;
    }),
  );
}

function toPolyline(points: TrackPoint[]) {
  return points.map((point) => `${point.x},${point.y}`).join(' ');
}

function alignTrackToLapProgress(track: TrackPoint[], referenceTrack: TrackPoint[]) {
  if (track.length < 3 || referenceTrack.length < 2) return track;

  const trackPoints = [...track];
  const first = trackPoints[0];
  const last = trackPoints[trackPoints.length - 1];
  if (Math.hypot(last.x - first.x, last.y - first.y) < 2) trackPoints.pop();
  if (trackPoints.length < 3) return track;

  const referenceStart = referenceTrack[0];
  const referenceDirection = {
    x: referenceTrack[1].x - referenceStart.x,
    y: referenceTrack[1].y - referenceStart.y,
  };
  const startIndex = trackPoints.reduce((closestIndex, point, index) => {
    const closest = trackPoints[closestIndex];
    return Math.hypot(point.x - referenceStart.x, point.y - referenceStart.y) < Math.hypot(closest.x - referenceStart.x, closest.y - referenceStart.y)
      ? index
      : closestIndex;
  }, 0);
  const forward = trackPoints[(startIndex + 1) % trackPoints.length];
  const backward = trackPoints[(startIndex - 1 + trackPoints.length) % trackPoints.length];
  const startPoint = trackPoints[startIndex];
  const forwardScore = (forward.x - startPoint.x) * referenceDirection.x + (forward.y - startPoint.y) * referenceDirection.y;
  const backwardScore = (backward.x - startPoint.x) * referenceDirection.x + (backward.y - startPoint.y) * referenceDirection.y;
  const direction = forwardScore >= backwardScore ? 1 : -1;
  const aligned = Array.from({ length: trackPoints.length }, (_, offset) => {
    const index = (startIndex + direction * offset + trackPoints.length) % trackPoints.length;
    return trackPoints[index];
  });

  return [...aligned, aligned[0]];
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
  const [lapData, setLapData] = useState<LapTelemetryPoint[]>([]);
  const [locationData, setLocationData] = useState<OpenF1LocationPoint[]>([]);
  const [tyreStints, setTyreStints] = useState<TyreStint[]>([]);
  const [weatherData, setWeatherData] = useState<OpenF1WeatherPoint[]>([]);
  const [strategyDataStatus, setStrategyDataStatus] = useState<'idle' | 'available' | 'unavailable'>('idle');
  const [heatmapLayer, setHeatmapLayer] = useState<HeatmapLayer>('all');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'historical' | 'unavailable' | 'error'>(year < 2023 ? 'historical' : 'idle');
  const [error, setError] = useState('');

  useEffect(() => {
    return () => pendingRequest.current?.abort();
  }, []);

  const licensedTrack = useMemo(() => {
    const trackHint = getCircuitTrackHint(raceName);
    const matchingFeature = (circuitGeoJson.features as unknown as GeoJsonCircuitFeature[])
      .map((feature) => ({ feature, score: scoreCircuitFeature(trackHint, feature) }))
      .filter((candidate) => candidate.score > 0 && ['LineString', 'MultiLineString'].includes(candidate.feature.geometry?.type ?? ''))
      .sort((a, b) => b.score - a.score)[0]?.feature;
    const normalizedPoints = normalizeGeoJsonTrackPoints(matchingFeature?.geometry?.coordinates);
    return isRenderableTrack(normalizedPoints) ? normalizedPoints : [];
  }, [raceName]);

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
      setLocationData([]);
      setTyreStints([]);
      setWeatherData([]);
      setStrategyDataStatus('idle');

      const cacheKey = `telemetry:v9:${year}:${driverNumber}:${round}:${raceName}`;
      let cached: TelemetryCachePayload | null = null;
      try {
        const parsed = JSON.parse(window.sessionStorage.getItem(cacheKey) ?? 'null') as TelemetryCachePayload | null;
        if (parsed && [parsed.carData, parsed.lapData, parsed.locationData, parsed.tyreStints, parsed.weatherData].every(value => Array.isArray(value) && value.length > 0)) cached = parsed;
      } catch { /* Browser storage is optional. */ }

      if (cached) {
        const parsed = cached;
        setCarData(parsed.carData);
        setLapData(parsed.lapData);
        setLocationData(parsed.locationData);
        setTyreStints(parsed.tyreStints ?? []);
        setWeatherData(parsed.weatherData ?? []);
        setStrategyDataStatus((parsed.tyreStints ?? []).length > 0 ? 'available' : 'unavailable');
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

      const laps = await requestOpenF1<OpenF1LapDataPoint[]>(
        `https://api.openf1.org/v1/laps?driver_number=${driverNumber}&session_key=${currentSession.session_key}`,
        '랩 데이터를 불러오지 못했습니다.',
      );

      const formattedLapData = laps
        .filter((lap) => !lap.is_pit_out_lap && typeof lap.lap_duration === 'number')
        .map((lap) => ({
          lap: lap.lap_number,
          dateStart: lap.date_start,
          lapTime: lap.lap_duration ?? 0,
          sector1: lap.duration_sector_1 ?? 0,
          sector2: lap.duration_sector_2 ?? 0,
          sector3: lap.duration_sector_3 ?? 0,
          trapSpeed: lap.st_speed ?? lap.i2_speed ?? lap.i1_speed ?? 0,
        }));

      if (formattedLapData.length === 0) {
        throw new Error('OpenF1 데이터 미제공: 이 선수에게 유효한 완주 랩 기록이 없습니다.');
      }

      const fastestLap = formattedLapData.reduce((best, lap) => (lap.lapTime < best.lapTime ? lap : best));
      const lapStartTime = fastestLap.dateStart ? new Date(fastestLap.dateStart) : null;
      const lapEndTime = lapStartTime && fastestLap.lapTime > 0 ? new Date(lapStartTime.getTime() + fastestLap.lapTime * 1000) : null;
      const lapWindow =
        lapStartTime && lapEndTime && !Number.isNaN(lapStartTime.getTime()) && !Number.isNaN(lapEndTime.getTime())
          ? `&date>=${encodeURIComponent(new Date(lapStartTime.getTime() - 5000).toISOString())}&date<=${encodeURIComponent(new Date(lapEndTime.getTime() + 5000).toISOString())}`
          : '&limit=400';

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
      const rawCarData = await requestOpenF1<OpenF1CarDataPoint[]>(
        `https://api.openf1.org/v1/car_data?driver_number=${driverNumber}&session_key=${currentSession.session_key}${lapWindow}`,
        '차량 텔레메트리를 불러오지 못했습니다.',
      ).catch(() => []);
      const locations = await requestOpenF1<OpenF1LocationPoint[]>(
        `https://api.openf1.org/v1/location?driver_number=${driverNumber}&session_key=${currentSession.session_key}${lapWindow}`,
        '트랙 위치 데이터를 불러오지 못했습니다.',
      ).catch(() => []);

      if (Array.isArray(rawCarData) && rawCarData.length > 0) {
        formattedCarData = rawCarData.map((point, index) => ({
          sample: index,
          date: point.date,
          speed: point.speed,
          throttle: point.throttle,
          brake: point.brake > 0 ? 100 : 0,
          rpm: point.rpm ?? 0,
          gear: point.n_gear ?? 0,
        }));
      }

      const safeLocationData = Array.isArray(locations) ? locations : [];
      const formattedTyreStints = Array.isArray(stints)
        ? stints
            .filter((stint) => typeof stint.lap_start === 'number' && typeof stint.lap_end === 'number')
            .map((stint) => ({
              compound: stint.compound ?? 'UNKNOWN',
              lapEnd: stint.lap_end ?? 0,
              lapStart: stint.lap_start ?? 0,
              stintNumber: stint.stint_number ?? 0,
              tyreAgeAtStart: stint.tyre_age_at_start ?? 0,
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
      setLocationData(safeLocationData);
      setTyreStints(formattedTyreStints);
      setWeatherData(safeWeatherData);
      setStrategyDataStatus(!stintRequestFailed && formattedTyreStints.length > 0 ? 'available' : 'unavailable');
      setStatus('success');

      if (!stintRequestFailed && [formattedCarData, formattedLapData, safeLocationData, formattedTyreStints, safeWeatherData].every(value => value.length > 0)) {
        const payload: TelemetryCachePayload = {
          carData: formattedCarData,
          lapData: formattedLapData,
          locationData: safeLocationData,
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
      <button type="button"
        onClick={fetchTelemetry}
        className="h-11 w-full bg-[#111] rounded-md border border-[#333] flex items-center justify-center hover:bg-[#222] hover:border-red-600/50 transition-all cursor-pointer group"
      >
        <p className="text-neutral-400 text-xs font-medium group-hover:text-red-400 transition-colors flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-neutral-600 group-hover:bg-red-600 rounded-full group-hover:animate-pulse"></span>
          {year < 2023 ? `라운드 ${round} 역사 레이스 보기` : `라운드 ${round} 데이터 불러오기`}
        </p>
      </button>
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
    const historicalTrack = licensedTrack;

    return (
      <section className="bg-[#111] border border-[#2a2a2a] rounded-xl p-5">
        <p className="text-xs font-semibold tracking-[0.14em] text-neutral-300 uppercase">역사 레이스 모드</p>
        <h3 className="mt-1 text-xl font-bold text-white">{year} 시즌은 결과와 트랙 중심으로 봅니다</h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-200">
          이 시즌은 OpenF1 차량 위치·속도·브레이크 데이터의 안정적인 역사 범위 이전이라 코너별 히트맵을 만들지 않습니다. 왼쪽 레이스 기록과 상단 결과 정보는 그대로 볼 수 있고, 아래에는 해당 서킷 윤곽을 표시합니다.
        </p>
        <div className="mt-5 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_0.8fr] gap-4">
          <div className="rounded-xl border border-[#222] bg-[#0b0b0b] p-4">
            <svg viewBox="0 0 320 220" className="h-80 w-full">
              {historicalTrack.length > 1 ? (
                <polyline points={toPolyline(historicalTrack)} fill="none" stroke="#38bdf8" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
              ) : (
                <text x="160" y="110" textAnchor="middle" className="fill-neutral-300 text-sm">검증된 트랙 윤곽을 찾지 못했습니다</text>
              )}
            </svg>
          </div>
          <div className="rounded-xl border border-[#242424] bg-[#0b0b0b] p-5 text-sm leading-7 text-neutral-100">
            <p><span className="font-bold text-cyan-300">가능:</span> 시즌 순위, 선수·팀 기록, 결승 결과, 그랑프리 선택</p>
            <p className="mt-3"><span className="font-bold text-yellow-300">표시하지 않음:</span> 실제 차량 속도·브레이크·스로틀 기반 코너 히트맵</p>
            <p className="mt-3 text-neutral-300">근거 없는 색칠 대신, 2023년 이후 레이스에서만 차량 텔레메트리 히트맵을 제공합니다.</p>
          </div>
        </div>
      </section>
    );
  }

  const summary = buildSummary(carData, lapData);
  const insights = buildInsights(summary);
  const sectors = buildSectorComparison(lapData);
  const weatherSummary = buildWeatherSummary(weatherData);
  const stintPerformance = tyreStints.map((stint) => {
    const stintLaps = lapData.filter((lap) => lap.lap >= stint.lapStart && lap.lap <= stint.lapEnd);
    const stintTimes = stintLaps.map((lap) => lap.lapTime).filter((lapTime) => lapTime > 0);

    return {
      ...stint,
      averageLap: average(stintTimes),
      bestLap: stintTimes.length > 0 ? Math.min(...stintTimes) : 0,
      lapCount: Math.max(1, stint.lapEnd - stint.lapStart + 1),
    };
  });
  const normalizedTrack = normalizeTrackPoints(locationData);
  const hasCompleteOpenF1Track = hasCompleteTrackShape(normalizedTrack);
  const hasRenderableLicensedTrack = isRenderableTrack(licensedTrack);
  const hasRenderableOpenF1Track = isRenderableTrack(normalizedTrack);
  const isTrackAssetLoading = false;
  const renderedTrack = hasRenderableLicensedTrack
    ? hasCompleteOpenF1Track
      ? alignTrackToLapProgress(licensedTrack, normalizedTrack)
      : licensedTrack
    : hasRenderableOpenF1Track
      ? normalizedTrack
      : [];
  const hasTrackData = isRenderableTrack(renderedTrack);
  const trackSource: TrackSource = hasRenderableLicensedTrack
    ? hasCompleteOpenF1Track
      ? 'mit-openf1'
      : 'mit'
    : hasRenderableOpenF1Track
      ? 'openf1'
      : isTrackAssetLoading
        ? 'loading'
        : 'missing';
  const rawTrackSegments = hasCompleteOpenF1Track ? buildTrackSegments(carData, locationData) : [];
  const trackSegments = classifyTrackSegments(rawTrackSegments);
  const hasTelemetryHeatmap = hasCompleteOpenF1Track && hasTrackData && trackSegments.length > 0;
  const trackHighlights = hasTelemetryHeatmap ? buildTrackHighlights(trackSegments) : [];
  const sectorMarkers = hasCompleteOpenF1Track && hasTrackData ? buildSectorMarkers(lapData, locationData, renderedTrack) : [];
  const heatmapControls: Array<{ id: HeatmapLayer; label: string; activeClass: string }> = [
    { id: 'all', label: '전체', activeClass: 'border-neutral-100 bg-neutral-100 text-black' },
    { id: 'brake', label: '제동', activeClass: 'border-red-400 bg-red-500/15 text-red-300' },
    { id: 'speed', label: '고속', activeClass: 'border-yellow-400 bg-yellow-500/15 text-yellow-200' },
    { id: 'throttle', label: '가속', activeClass: 'border-green-400 bg-green-500/15 text-green-200' },
  ];
  const chartGuideItems = [
    { color: 'bg-cyan-400', title: '파랑', text: '랩타임입니다. 크게 출렁이면 그 랩에서 실수, 트래픽, 피트 영향이 있었을 수 있습니다.' },
    { color: 'bg-yellow-400', title: '노랑', text: '스피드 트랩입니다. 직선 최고속 구간의 분위기를 보여줍니다.' },
    { color: 'bg-red-500', title: '빨강/초록/보라', text: '섹터 1, 2, 3 기록입니다. 어느 구간에서 시간이 갈렸는지 빠르게 읽을 수 있습니다.' },
    { color: 'bg-neutral-200', title: '읽는 법', text: '파랑 랩타임이 튀는 랩을 먼저 보고, 같은 랩에서 어느 섹터 선이 흔들렸는지 같이 보면 됩니다.' },
  ];

  const lapTimeTooltip = ({ active, payload }: CustomTooltipProps) => {
    if (!active || !payload || payload.length === 0) return null;

    return (
      <div className="bg-[#111] border border-[#333] p-3 rounded-md shadow-2xl text-xs">
        <p className="text-cyan-400">랩타임 <span className="text-white">{formatTooltipValue(payload[0]?.value)}초</span></p>
      </div>
    );
  };

  const speedTrapTooltip = ({ active, payload }: CustomTooltipProps) => {
    if (!active || !payload || payload.length === 0) return null;

    return (
      <div className="bg-[#111] border border-[#333] p-3 rounded-md shadow-2xl text-xs">
        <p className="text-yellow-400">스피드 트랩 <span className="text-white">{formatTooltipValue(payload[0]?.value)} km/h</span></p>
      </div>
    );
  };

  const sectorTooltip = ({ active, payload }: CustomTooltipProps) => {
    if (!active || !payload || payload.length === 0) return null;

    return (
      <div className="bg-[#111] border border-[#333] p-3 rounded-md shadow-2xl text-xs">
        <p className="text-green-500">
          섹터 기록 <span className="text-white">{formatTooltipValue(payload[0]?.value)}초 / {formatTooltipValue(payload[1]?.value)}초 / {formatTooltipValue(payload[2]?.value)}초</span>
        </p>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {(carData.length === 0 || locationData.length === 0 || weatherData.length === 0 || tyreStints.length === 0) && <div role="status" className="flex flex-wrap items-center justify-between gap-3 border-b border-yellow-500/30 pb-4 text-sm text-yellow-200"><span>일부 텔레메트리를 받지 못했습니다.</span><button type="button" onClick={fetchTelemetry} className="min-h-11 underline">누락 데이터 다시 조회</button></div>}
      <div className="grid grid-cols-1 2xl:grid-cols-[1.8fr_1fr] gap-4">
        <section className="min-w-0 bg-[#111] border border-[#2a2a2a] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-semibold tracking-[0.14em] text-neutral-300 uppercase">레이스 흐름</p>
              <h3 className="text-xl font-bold text-white mt-1">랩 퍼포먼스 흐름</h3>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold tracking-[0.14em] text-neutral-300 uppercase">데이터 모드</p>
              <p className="text-sm font-semibold text-green-400">랩 기록 기준</p>
            </div>
          </div>

          <div className="space-y-4">
              <div>
                <div className="mb-2 flex items-center justify-between text-xs font-semibold">
                  <span className="text-cyan-300">랩타임</span>
                  <span className="text-neutral-400">초</span>
                </div>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={lapData} margin={{ top: 6, right: 10, left: -18, bottom: 0 }}>
                      <CartesianGrid stroke="#222" strokeDasharray="3 3" />
                      <XAxis dataKey="lap" stroke="#666" fontSize={10} />
                      <YAxis stroke="#666" fontSize={10} />
                      <Tooltip content={lapTimeTooltip} />
                      <Line type="monotone" dataKey="lapTime" stroke="#22d3ee" strokeWidth={3} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                <div>
                  <div className="mb-2 flex items-center justify-between text-xs font-semibold">
                    <span className="text-yellow-300">스피드 트랩</span>
                    <span className="text-neutral-400">km/h</span>
                  </div>
                  <div className="h-32">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={lapData} margin={{ top: 6, right: 10, left: -18, bottom: 0 }}>
                        <CartesianGrid stroke="#222" strokeDasharray="3 3" />
                        <XAxis dataKey="lap" stroke="#666" fontSize={10} />
                        <YAxis stroke="#666" fontSize={10} />
                        <Tooltip content={speedTrapTooltip} />
                        <Line type="monotone" dataKey="trapSpeed" stroke="#eab308" strokeWidth={2.5} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-xs font-semibold"><span className="text-red-400">S1</span><span className="text-neutral-500"> · </span><span className="text-green-400">S2</span><span className="text-neutral-500"> · </span><span className="text-purple-400">S3</span></div>
                  <div className="h-32">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={lapData} margin={{ top: 6, right: 10, left: -18, bottom: 0 }}>
                        <CartesianGrid stroke="#222" strokeDasharray="3 3" />
                        <XAxis dataKey="lap" stroke="#666" fontSize={10} />
                        <YAxis stroke="#666" fontSize={10} />
                        <Tooltip content={sectorTooltip} />
                        <Line type="monotone" dataKey="sector1" stroke="#ef4444" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="sector2" stroke="#22c55e" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="sector3" stroke="#a855f7" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
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
                  최고 속도는 <span className="font-bold text-yellow-400">{summary.topSpeed.toFixed(0)} km/h</span>, 피트 아웃 랩을 뺀 기록은 <span className="font-bold text-green-400">{summary.totalLaps}랩</span>입니다.
                </p>
                <p>
                  {hasTelemetryHeatmap
                    ? `그래프는 랩 기록으로 통일했고, 트랙 히트맵만 가장 빠른 랩의 차량 데이터를 기준으로 색칠했습니다.`
                    : `차량 텔레메트리가 비어 있어도 ${summary.totalLaps}개 랩의 흐름과 섹터 기록은 같은 형식으로 볼 수 있습니다.`}
                </p>
                <p className="text-neutral-300">
                  <span className="font-bold text-purple-300">랩타임 흔들림</span>은 평균 랩타임에서 얼마나 벗어났는지입니다. <span className="font-semibold text-white">낮을수록 페이스가 일정</span>했다는 뜻입니다.
                </p>
              </div>
            </div>
          </div>

        </section>

        <div className="min-w-0 space-y-4">
          <section className="bg-[#111] border border-[#2a2a2a] rounded-xl p-5">
            <p className="text-xs font-semibold tracking-[0.14em] text-neutral-300 uppercase">트랙 분석</p>
            <h3 className="text-xl font-bold text-white mt-1">
              {isTrackAssetLoading ? '검증된 트랙 윤곽 준비 중' : hasTrackData ? (hasTelemetryHeatmap ? '베스트 랩 구간 히트맵' : '트랙 레이아웃') : '트랙 데이터 준비 상태'}
            </h3>
            <p className="text-sm text-neutral-200 mt-1 leading-6">
              {isTrackAssetLoading
                ? 'OpenF1 위치 좌표가 불완전해 공개 라이선스 서킷 윤곽을 확인하고 있습니다. 근사 트랙은 이 과정에서 표시하지 않습니다.'
                : hasTrackData
                ? hasTelemetryHeatmap
                  ? '이 베스트 랩 안에서 상대적으로 두드러진 제동·고속·재가속 구간만 표시합니다. 모든 구간을 억지로 색칠하지 않습니다.'
                  : '차량 텔레메트리가 없어 코너별 색칠은 하지 않았습니다. 트랙 윤곽과 섹터 위치만 보여줍니다.'
                : '내장된 검증 서킷 윤곽을 이 레이스명과 연결하지 못했습니다. OpenF1 위치 좌표 유무와는 별개인 매칭 문제입니다.'}
            </p>
            <div className="mt-3 flex items-center gap-2 text-xs text-neutral-200">
              <span className={`inline-flex h-2 w-2 rounded-full ${trackSource === 'missing' ? 'bg-neutral-500' : trackSource === 'loading' ? 'bg-cyan-400 animate-pulse' : 'bg-cyan-400'}`}></span>
              <span className="font-semibold">
                {trackSource === 'mit-openf1'
                  ? 'MIT 트랙 윤곽 · OpenF1 랩 분석'
                  : trackSource === 'mit'
                    ? 'MIT GeoJSON 트랙 윤곽 대체'
                    : trackSource === 'openf1'
                      ? 'OpenF1 위치 좌표 대체'
                      : trackSource === 'loading'
                        ? '검증된 트랙 윤곽 불러오는 중'
                        : '트랙 자산 없음'}
              </span>
            </div>
            {hasTelemetryHeatmap && (
              <div className="mt-4 grid grid-cols-4 gap-2" role="group" aria-label="트랙 분석 표시 기준">
                {heatmapControls.map((control) => (
                  <button
                    key={control.id}
                    type="button"
                    onClick={() => setHeatmapLayer(control.id)}
                    className={`rounded-md border px-2 py-2 text-xs font-bold transition-colors ${
                      heatmapLayer === control.id
                        ? control.activeClass
                        : 'border-[#303030] bg-[#101010] text-neutral-300 hover:border-neutral-500 hover:text-white'
                    }`}
                  >
                    {control.label}
                  </button>
                ))}
              </div>
            )}

            <div className="mt-4 rounded-xl border border-[#222] bg-[#0b0b0b] p-3">
              <svg viewBox="0 0 320 220" className="w-full h-80">
                {isTrackAssetLoading ? (
                  <>
                    <circle cx="160" cy="94" r="10" fill="none" stroke="#22d3ee" strokeWidth="2" strokeDasharray="18 12" className="origin-center animate-spin" />
                    <text x="160" y="126" textAnchor="middle" className="fill-neutral-200 text-sm font-semibold">
                      검증된 트랙 윤곽을 불러오는 중
                    </text>
                  </>
                ) : hasTrackData ? (
                  <>
                    <polyline
                      points={toPolyline(renderedTrack)}
                      fill="none"
                      stroke="#262626"
                      strokeWidth="10"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {hasTelemetryHeatmap && trackSegments.map((segment, index) => {
                      const startIndex = Math.floor((index / trackSegments.length) * (renderedTrack.length - 1));
                      const endIndex = Math.floor(((index + 1) / trackSegments.length) * (renderedTrack.length - 1));
                      const points = renderedTrack.slice(startIndex, Math.max(endIndex + 1, startIndex + 2));
                      const isVisible = heatmapLayer === 'all' || heatmapLayer === segment.kind;

                      return (
                        <polyline
                          key={segment.index}
                          points={toPolyline(points)}
                          fill="none"
                          stroke={getSegmentColor(segment.kind)}
                          strokeWidth="5"
                          strokeOpacity={isVisible ? 1 : 0.12}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      );
                    })}
                    {hasCompleteOpenF1Track && renderedTrack[0] && (
                      <g>
                        <circle cx={renderedTrack[0].x} cy={renderedTrack[0].y} r="6" fill="#0b0b0b" stroke="#f8fafc" strokeWidth="1.5" />
                        <text x={renderedTrack[0].x} y={renderedTrack[0].y + 2.5} textAnchor="middle" className="fill-white text-[6px] font-bold">
                          S/F
                        </text>
                      </g>
                    )}
                    {sectorMarkers.map((marker) => (
                      <g key={marker.label}>
                        <circle cx={marker.point.x} cy={marker.point.y} r="9" fill="#082f49" stroke="#22d3ee" strokeWidth="1.5" />
                        <text x={marker.point.x} y={marker.point.y + 3} textAnchor="middle" className="fill-cyan-100 text-[8px] font-bold">
                          {marker.label}
                        </text>
                      </g>
                    ))}
                  </>
                ) : (
                  <>
                    <text x="160" y="92" textAnchor="middle" className="fill-neutral-100 text-base font-semibold">
                      검증된 트랙 윤곽을 찾지 못했습니다
                    </text>
                    <text x="160" y="118" textAnchor="middle" className="fill-neutral-300 text-sm">
                      레이스명 매칭: {raceName}
                    </text>
                    <text x="160" y="142" textAnchor="middle" className="fill-neutral-300 text-sm">
                      이 문구가 보이면 매칭 키를 기준으로 바로 보완합니다.
                    </text>
                  </>
                )}
              </svg>
            </div>

            {trackHighlights.length > 0 && (
              <div className="mt-4 border-t border-[#262626] pt-4">
                <p className="text-xs font-semibold tracking-[0.14em] text-neutral-300 uppercase">구간별 주행 포인트</p>
                <div className="mt-3 space-y-2">
                  {trackHighlights.map((highlight) => (
                    <button
                      key={highlight.id}
                      type="button"
                      onClick={() => setHeatmapLayer(highlight.id)}
                      className={`w-full rounded-lg border p-3 text-left transition-colors hover:brightness-125 ${highlight.tone}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-bold">{highlight.title}</span>
                        <span className="text-xs font-semibold">{highlight.metric}</span>
                      </div>
                      <p className="mt-1 text-xs opacity-90">{highlight.detail} · 누르면 지도에서 해당 색상만 볼 수 있습니다.</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {sectorMarkers.length === 3 && (
              <p className="mt-3 text-sm leading-6 text-neutral-200">
                <span className="font-semibold text-cyan-300">S1·S2·S3</span>는 베스트 랩 진행률을 트랙 윤곽에 맞춘 각 섹터 중심입니다.
              </p>
            )}
            {(trackSource === 'mit-openf1' || trackSource === 'mit') && (
              <p className="mt-3 text-sm leading-6 text-neutral-200">
                {hasCompleteOpenF1Track
                  ? <>MIT 라이선스의 <a className="font-semibold text-cyan-300 underline underline-offset-4" href="https://github.com/bacinger/f1-circuits" target="_blank" rel="noreferrer">f1-circuits GeoJSON</a> 윤곽 위에 OpenF1 베스트 랩 진행 데이터를 표시합니다.</>
                  : <>OpenF1 좌표가 불완전해 MIT 라이선스의 <a className="font-semibold text-cyan-300 underline underline-offset-4" href="https://github.com/bacinger/f1-circuits" target="_blank" rel="noreferrer">f1-circuits GeoJSON</a> 윤곽으로 대체했습니다.</>}
              </p>
            )}
            {trackSource === 'openf1' && (
              <p className="mt-3 text-sm leading-6 text-neutral-200">
                검증 GeoJSON 매칭이 실패해 OpenF1 위치 좌표로 트랙을 표시했습니다. 이 경우 서킷 윤곽은 보이지만 공식 코너 라벨은 아직 붙이지 않습니다.
              </p>
            )}
          </section>

          <section className="bg-[#111] border border-[#2a2a2a] rounded-xl p-5">
            <p className="text-xs font-semibold tracking-[0.14em] text-neutral-300 uppercase">빠른 해석</p>
            <h3 className="text-xl font-bold text-white mt-1">이번 경기에서 볼 것</h3>
            <div className="mt-4 space-y-3 text-[15px] text-neutral-100 leading-7">
              <p>
                먼저 <span className="text-cyan-400 font-bold">베스트 랩</span>과 <span className="text-yellow-400 font-bold">최고 속도</span>로 이 선수의 한 방 페이스를 봅니다.
              </p>
              <p>
                다음으로 <span className="text-purple-300 font-bold">랩타임 흔들림</span>을 봅니다. 숫자가 낮을수록 랩마다 페이스가 덜 흔들렸다는 뜻입니다.
              </p>
              <p>
                {hasTelemetryHeatmap
                  ? '오른쪽 트랙의 빨간·노란·초록 구간을 그래프의 감속·고속·재가속 흐름과 함께 보면 됩니다.'
                  : '이번 경기는 차량 텔레메트리가 없어 랩타임과 섹터 기록 중심으로 흐름을 보여주고 있습니다.'}
              </p>
            </div>
          </section>
        </div>
      </div>

      {(stintPerformance.length > 0 || weatherSummary) && (
        <section className="rounded-xl border border-[#242424] bg-[#0b0b0b] p-5">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-xs font-semibold tracking-[0.14em] text-neutral-300 uppercase">전략·레이스 조건</p>
              <h3 className="mt-1 text-xl font-bold text-white">타이어 구간과 날씨 흐름</h3>
            </div>
            <p className="text-xs text-neutral-300">타이어 구간은 OpenF1 스틴트, 날씨는 세션 표본 기준</p>
          </div>

          {stintPerformance.length > 0 && (
            <div className="mt-5 overflow-x-auto pb-1">
              <div className="flex min-w-max gap-3">
                {stintPerformance.map((stint, index) => (
                  <div
                    key={`timeline-${stint.stintNumber}-${stint.lapStart}-${index}`}
                    className={`min-w-48 rounded-lg border p-4 ${getTyreCompoundStyle(stint.compound)}`}
                    style={{ flexGrow: stint.lapCount }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold">{stint.compound}</span>
                      <span className="text-xs opacity-80">{stint.lapCount}랩 사용</span>
                    </div>
                    <p className="mt-3 text-base font-semibold">L{stint.lapStart} - L{stint.lapEnd}</p>
                    <p className="mt-1 text-xs opacity-80">시작 타이어 수명 {stint.tyreAgeAtStart}랩</p>
                    <div className="mt-4 border-t border-current/20 pt-3 text-xs leading-5">
                      <p>평균 랩타임 {formatSeconds(stint.averageLap)}초</p>
                      <p className="font-bold">베스트 랩 {formatSeconds(stint.bestLap)}초</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {stintPerformance.length === 0 && strategyDataStatus === 'unavailable' && (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-yellow-400/30 bg-yellow-400/5 p-4 text-sm text-yellow-100">
              <p>이 선수의 타이어 스틴트를 이번 요청에서 받지 못했습니다. 날씨 데이터와 별개로 OpenF1 스틴트를 다시 조회할 수 있습니다.</p>
              <button
                type="button"
                onClick={fetchTelemetry}
                className="rounded-md border border-yellow-300/60 px-3 py-2 text-xs font-bold text-yellow-100 transition-colors hover:bg-yellow-300 hover:text-black"
              >
                타이어 전략 다시 불러오기
              </button>
            </div>
          )}

          {weatherSummary && (
            <div className="mt-5 border-t border-[#262626] pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold text-white">레이스 중 날씨</p>
                <p className={`text-xs font-bold ${weatherSummary.rainy ? 'text-cyan-300' : 'text-yellow-200'}`}>
                  {weatherSummary.rainy ? `강수 표본 ${weatherSummary.rainfallSamples}회` : '강수 기록 없음'}
                </p>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs lg:grid-cols-4">
                <div className="rounded-md border border-[#262626] bg-[#101010] p-3"><span className="block text-neutral-400">트랙 온도</span><span className="mt-1 block font-bold text-orange-200">평균 {weatherSummary.trackTemperature.toFixed(0)}°C</span><span className="mt-1 block text-neutral-300">{weatherSummary.trackTemperatureMin.toFixed(0)} - {weatherSummary.trackTemperatureMax.toFixed(0)}°C</span></div>
                <div className="rounded-md border border-[#262626] bg-[#101010] p-3"><span className="block text-neutral-400">기온</span><span className="mt-1 block font-bold text-white">평균 {weatherSummary.airTemperature.toFixed(0)}°C</span><span className="mt-1 block text-neutral-300">{weatherSummary.airTemperatureMin.toFixed(0)} - {weatherSummary.airTemperatureMax.toFixed(0)}°C</span></div>
                <div className="rounded-md border border-[#262626] bg-[#101010] p-3"><span className="block text-neutral-400">습도</span><span className="mt-1 block font-bold text-cyan-200">평균 {weatherSummary.humidity.toFixed(0)}%</span><span className="mt-1 block text-neutral-300">{weatherSummary.humidityMin.toFixed(0)} - {weatherSummary.humidityMax.toFixed(0)}%</span></div>
                <div className="rounded-md border border-[#262626] bg-[#101010] p-3"><span className="block text-neutral-400">풍속</span><span className="mt-1 block font-bold text-blue-200">평균 {weatherSummary.windSpeed.toFixed(1)} m/s</span><span className="mt-1 block text-neutral-300">{weatherSummary.windSpeedMin.toFixed(1)} - {weatherSummary.windSpeedMax.toFixed(1)} m/s</span></div>
              </div>
              <p className="mt-3 text-xs leading-5 text-neutral-400">총 {weatherSummary.sampleCount}개 날씨 표본입니다. 온도·습도 변화와 랩타임을 함께 보되, 이 값만으로 페이스 변화 원인을 단정하지는 않습니다.</p>
            </div>
          )}
        </section>
      )}

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
              평균 랩은 <span className="text-white font-bold">{summary.averageLap > 0 ? `${formatSeconds(summary.averageLap)}초` : '확인 불가'}</span>입니다.
            </p>
            <p>
              가장 빨랐던 랩은 <span className="text-cyan-400 font-bold">{summary.bestLap > 0 ? `${formatSeconds(summary.bestLap)}초` : '확인 불가'}</span>이고,
              평균 페이스와의 차이는 <span className="text-purple-400 font-bold">{summary.averageLap > summary.bestLap ? `+${(summary.averageLap - summary.bestLap).toFixed(2)}초` : '확인 불가'}</span>입니다.
            </p>
            <p>
              {hasTelemetryHeatmap
                ? `그래프는 랩 기록 기준이며, 트랙 히트맵에는 베스트 랩의 차량 데이터를 함께 반영했습니다.`
                : `${summary.totalLaps}개 랩의 랩타임과 섹터 흐름을 같은 형식으로 보여주고 있습니다.`}
            </p>
          </div>
        </section>

        <section className="min-w-0 bg-[#111] border border-[#2a2a2a] rounded-xl p-5">
          <p className="text-xs font-semibold tracking-[0.14em] text-neutral-300 uppercase">섹터 비교</p>
          <h3 className="text-xl font-bold text-white mt-1">베스트 랩에서 줄인 시간</h3>
          <p className="mt-2 text-sm leading-6 text-neutral-200">섹터 길이가 서로 달라 섹터끼리 단순히 빠르다/느리다로 비교하지 않습니다. 각 섹터의 평균 기록과 개인 베스트 기록의 차이를 보여줍니다.</p>
          <div className="mt-5 space-y-4">
            {sectors.map((sector) => (
              <div key={sector.label}>
                <div className="flex items-center justify-between text-sm text-neutral-100 mb-2">
                  <span>{sector.label}</span>
                  <span>{sector.averageSeconds > 0 ? `평균 ${sector.averageSeconds.toFixed(3)}초` : '데이터 없음'}</span>
                </div>
                <div className="h-3 rounded-full bg-[#1b1b1b] overflow-hidden">
                  <div className={`h-full ${sector.color}`} style={{ width: `${sector.averageSeconds > 0 ? Math.min(100, Math.max(12, (sector.improvement / sector.averageSeconds) * 500)) : 0}%` }}></div>
                </div>
                <p className="mt-2 text-xs text-neutral-300">
                  개인 베스트 {sector.bestSeconds > 0 ? `${sector.bestSeconds.toFixed(3)}초` : '--'} · 평균보다 <span className="font-bold text-white">{sector.improvement > 0 ? `${sector.improvement.toFixed(3)}초` : '--'}</span> 단축
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
