export interface TrackPoint {
  x: number;
  y: number;
}

export interface TrackLocation extends TrackPoint {
  date?: string;
}

export interface TrackCar {
  date?: string;
  speed: number;
  throttle: number;
  brake: number;
  rpm?: number;
  gear?: number;
  n_gear?: number;
}

export interface TrackLap {
  dateStart?: string;
  lapTime: number;
  sector1?: number | null;
  sector2?: number | null;
  sector3?: number | null;
}

export interface TrackOptions {
  width?: number;
  height?: number;
  padding?: number;
  rotation?: number;
  geographic?: boolean;
  maxTelemetryGapMs?: number;
  maxLocationGapMs?: number;
}

export interface LapTrackPoint extends TrackPoint {
  sourceX: number;
  sourceY: number;
  timestamp: number;
  elapsedSeconds: number;
  progress: number;
  speed: number | null;
  throttle: number | null;
  brake: number | null;
  rpm: number | null;
  gear: number | null;
  telemetryGapMs: number | null;
}

export interface LapTrack {
  points: LapTrackPoint[];
  segments: Array<{ start: LapTrackPoint; end: LapTrackPoint }>;
  sectorMarkers: Array<{ label: string; point: LapTrackPoint }>;
  complete: boolean;
  coverage: number;
}

export interface MultiViewerCircuit {
  year?: number;
  rotation?: number;
  corners?: Array<{
    number?: number;
    letter?: string;
    angle?: number;
    trackPosition?: { x?: number; y?: number };
  }>;
}

export interface CircuitCornerMarker extends TrackPoint {
  label: string;
  number: number;
  letter: string;
  pointIndex: number;
  elapsedSeconds: number;
  sourceYear: number | null;
}

export interface LabelledCircuitCornerMarker extends CircuitCornerMarker {
  labelX: number;
  labelY: number;
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function timestamp(date?: string) {
  return date ? Date.parse(date) : Number.NaN;
}

function bounds(points: TrackPoint[]) {
  return points.reduce(
    (box, point) => ({
      minX: Math.min(box.minX, point.x),
      maxX: Math.max(box.maxX, point.x),
      minY: Math.min(box.minY, point.y),
      maxY: Math.max(box.maxY, point.y),
    }),
    { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
  );
}

// GeoJSON uses degrees; longitude must be scaled by latitude before fitting.
function trackTransform(points: TrackPoint[], options: TrackOptions) {
  const width = options.width ?? 640;
  const height = options.height ?? 420;
  const padding = options.padding ?? 32;
  const latitude = options.geographic
    ? points.reduce((sum, point) => sum + point.y, 0) / points.length
    : 0;
  const longitudeScale = Math.cos((latitude * Math.PI) / 180);
  const radians =
    ((finite(options.rotation) ? options.rotation : 0) * Math.PI) / 180;
  const rotate = (point: TrackPoint) => {
    const x = point.x * longitudeScale;
    return {
      x: x * Math.cos(radians) - point.y * Math.sin(radians),
      y: x * Math.sin(radians) + point.y * Math.cos(radians),
    };
  };
  const box = bounds(points.map(rotate));
  const spanX = box.maxX - box.minX;
  const spanY = box.maxY - box.minY;
  const scale = Math.min(
    (width - padding * 2) / Math.max(spanX, Number.EPSILON),
    (height - padding * 2) / Math.max(spanY, Number.EPSILON),
  );
  const offsetX = (width - spanX * scale) / 2;
  const offsetY = (height - spanY * scale) / 2;
  return (point: TrackPoint): TrackPoint => {
    const rotated = rotate(point);
    return {
      x: offsetX + (rotated.x - box.minX) * scale,
      y: offsetY + (box.maxY - rotated.y) * scale,
    };
  };
}

export function fitTrackPoints(
  points: TrackPoint[],
  options: TrackOptions = {},
): TrackPoint[] {
  const valid = points.filter((point) => finite(point.x) && finite(point.y));
  if (valid.length < 2) return [];
  const box = bounds(valid);
  if (box.maxX === box.minX && box.maxY === box.minY) return [];
  return valid.map(trackTransform(valid, options));
}

function nearestIndex<T extends { timestamp: number }>(
  points: T[],
  target: number,
) {
  let low = 0;
  let high = points.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (points[middle].timestamp < target) low = middle + 1;
    else high = middle;
  }
  if (low === 0) return 0;
  if (low === points.length) return points.length - 1;
  return target - points[low - 1].timestamp <= points[low].timestamp - target
    ? low - 1
    : low;
}

export function trackPointAtElapsed(
  track: LapTrack,
  elapsedSeconds: number,
  maxGapMs = 500,
) {
  if (!track.points.length || !finite(elapsedSeconds)) return null;
  const target =
    track.points[0].timestamp +
    (elapsedSeconds - track.points[0].elapsedSeconds) * 1000;
  const point = track.points[nearestIndex(track.points, target)];
  return Math.abs(point.timestamp - target) <= maxGapMs ? point : null;
}

export function buildLapTrack(
  locations: TrackLocation[],
  cars: TrackCar[],
  lap: TrackLap,
  options: TrackOptions = {},
): LapTrack {
  const empty: LapTrack = {
    points: [],
    segments: [],
    sectorMarkers: [],
    complete: false,
    coverage: 0,
  };
  const start = timestamp(lap.dateStart);
  if (!finite(start) || !finite(lap.lapTime) || lap.lapTime <= 0) return empty;
  const end = start + lap.lapTime * 1000;
  const orderedLocations = [
    ...new Map(
      locations
        .map((point) => ({ ...point, timestamp: timestamp(point.date) }))
        .filter(
          (point) =>
            finite(point.x) &&
            finite(point.y) &&
            finite(point.timestamp) &&
            point.timestamp >= start &&
            point.timestamp <= end,
        )
        .map((point) => [point.timestamp, point]),
    ).values(),
  ].sort((a, b) => a.timestamp - b.timestamp);
  if (orderedLocations.length < 2) return empty;
  const sourceBounds = bounds(orderedLocations);
  const span = Math.max(
    sourceBounds.maxX - sourceBounds.minX,
    sourceBounds.maxY - sourceBounds.minY,
  );
  if (span === 0) return empty;
  const orderedCars = cars
    .map((point) => ({ ...point, timestamp: timestamp(point.date) }))
    .filter(
      (point) =>
        finite(point.timestamp) &&
        point.timestamp >= start &&
        point.timestamp <= end,
    )
    .sort((a, b) => a.timestamp - b.timestamp);
  const transform = trackTransform(orderedLocations, options);
  const maxTelemetryGapMs = options.maxTelemetryGapMs ?? 500;
  const maxLocationGapMs = options.maxLocationGapMs ?? 1500;
  const points: LapTrackPoint[] = orderedLocations.map((location) => {
    const nearest = orderedCars.length
      ? orderedCars[nearestIndex(orderedCars, location.timestamp)]
      : null;
    const gap = nearest
      ? Math.abs(nearest.timestamp - location.timestamp)
      : null;
    const car = gap !== null && gap <= maxTelemetryGapMs ? nearest : null;
    const metric = (value: unknown, minimum = 0, maximum = Infinity) =>
      finite(value) && value >= minimum && value <= maximum ? value : null;
    return {
      ...transform(location),
      sourceX: location.x,
      sourceY: location.y,
      timestamp: location.timestamp,
      elapsedSeconds: (location.timestamp - start) / 1000,
      progress: (location.timestamp - start) / (end - start),
      speed: metric(car?.speed),
      throttle: metric(car?.throttle, 0, 100),
      brake: metric(car?.brake) === null ? null : car!.brake > 0 ? 100 : 0,
      rpm: metric(car?.rpm),
      gear: metric(car?.gear ?? car?.n_gear, 0, 8),
      telemetryGapMs: car ? gap : null,
    };
  });
  const segments = points.slice(1).flatMap((point, index) => {
    const previous = points[index];
    const distance = Math.hypot(
      point.sourceX - previous.sourceX,
      point.sourceY - previous.sourceY,
    );
    return point.timestamp - previous.timestamp <= maxLocationGapMs &&
      distance <= span * 0.2
      ? [{ start: previous, end: point }]
      : [];
  });
  const first = points[0];
  const last = points[points.length - 1];
  const coverage = (last.timestamp - first.timestamp) / (end - start);
  const complete =
    points.length >= 16 &&
    first.timestamp - start <= maxLocationGapMs &&
    end - last.timestamp <= maxLocationGapMs &&
    segments.length === points.length - 1 &&
    Math.hypot(first.sourceX - last.sourceX, first.sourceY - last.sourceY) <=
      span * 0.12;
  const result: LapTrack = {
    points,
    segments,
    sectorMarkers: [],
    complete,
    coverage,
  };
  const durations = [lap.sector1, lap.sector2, lap.sector3];
  if (durations.every((value) => finite(value) && value > 0)) {
    let elapsed = 0;
    result.sectorMarkers = durations.flatMap((duration, index) => {
      const point = trackPointAtElapsed(result, elapsed + duration! / 2);
      elapsed += duration!;
      return point ? [{ label: `S${index + 1}`, point }] : [];
    });
  }
  return result;
}

// MultiViewer's manually placed corners share FastF1/F1 position coordinates.
// Verify proximity and lap order against this actual lap before showing numbers.
export function matchCircuitCorners(
  metadata: MultiViewerCircuit | null,
  track: LapTrack,
): CircuitCornerMarker[] {
  if (
    !Array.isArray(metadata?.corners) ||
    !metadata.corners.length ||
    !track.complete
  )
    return [];
  if (
    metadata.corners.some(
      (corner) =>
        !corner ||
        !finite(corner.number) ||
        !Number.isInteger(corner.number) ||
        corner.number <= 0 ||
        (corner.letter !== undefined && typeof corner.letter !== 'string'),
    )
  )
    return [];
  const sourceBounds = bounds(
    track.points.map((point) => ({ x: point.sourceX, y: point.sourceY })),
  );
  const span = Math.max(
    sourceBounds.maxX - sourceBounds.minX,
    sourceBounds.maxY - sourceBounds.minY,
  );
  const corners = [...metadata.corners].sort(
    (a, b) =>
      (a.number ?? 0) - (b.number ?? 0) ||
      (a.letter ?? '').localeCompare(b.letter ?? ''),
  );
  const markers: CircuitCornerMarker[] = [];
  for (const corner of corners) {
    const position = corner.trackPosition;
    if (
      !finite(corner.number) ||
      corner.number <= 0 ||
      !finite(position?.x) ||
      !finite(position?.y)
    )
      return [];
    let bestDistance = Infinity;
    let bestIndex = -1;
    let bestFraction = 0;
    for (const segment of track.segments) {
      const dx = segment.end.sourceX - segment.start.sourceX;
      const dy = segment.end.sourceY - segment.start.sourceY;
      const lengthSquared = dx * dx + dy * dy;
      const fraction =
        lengthSquared === 0
          ? 0
          : Math.max(
              0,
              Math.min(
                1,
                ((position.x - segment.start.sourceX) * dx +
                  (position.y - segment.start.sourceY) * dy) /
                  lengthSquared,
              ),
            );
      const distance = Math.hypot(
        position.x - segment.start.sourceX - fraction * dx,
        position.y - segment.start.sourceY - fraction * dy,
      );
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = track.points.indexOf(segment.start);
        bestFraction = fraction;
      }
    }
    if (bestIndex < 0 || bestDistance > span * 0.025) return [];
    const first = track.points[bestIndex];
    const second = track.points[bestIndex + 1];
    const elapsedSeconds =
      first.elapsedSeconds +
      (second.elapsedSeconds - first.elapsedSeconds) * bestFraction;
    if (
      markers.length &&
      elapsedSeconds <= markers[markers.length - 1].elapsedSeconds
    )
      return [];
    markers.push({
      label: `${corner.number}${corner.letter ?? ''}`,
      number: corner.number,
      letter: corner.letter ?? '',
      pointIndex: bestFraction < 0.5 ? bestIndex : bestIndex + 1,
      elapsedSeconds,
      x: first.x + (second.x - first.x) * bestFraction,
      y: first.y + (second.y - first.y) * bestFraction,
      sourceYear: finite(metadata.year) ? metadata.year : null,
    });
  }
  return markers;
}

export function layoutCornerLabels(
  markers: CircuitCornerMarker[],
  width = 640,
  height = 420,
): LabelledCircuitCornerMarker[] {
  const placed: LabelledCircuitCornerMarker[] = [];
  const margin = 14;
  const spacing = 26;
  const available = (point: TrackPoint) =>
    point.x >= margin &&
    point.x <= width - margin &&
    point.y >= margin &&
    point.y <= height - margin &&
    placed.every(
      (marker) =>
        Math.hypot(marker.labelX - point.x, marker.labelY - point.y) >= spacing,
    );
  for (const marker of markers) {
    if (!finite(marker.x) || !finite(marker.y)) continue;
    const preferred = Math.atan2(marker.y - height / 2, marker.x - width / 2);
    const candidates = [18, 30, 42, 54, 66, 90, 120].flatMap((radius) =>
      [0, 1, -1, 2, -2, 3, -3, 4].map((step) => ({
        x: marker.x + Math.cos(preferred + (step * Math.PI) / 4) * radius,
        y: marker.y + Math.sin(preferred + (step * Math.PI) / 4) * radius,
      })),
    );
    let position = candidates.find(available);
    if (!position) {
      const grid: TrackPoint[] = [];
      for (let y = margin; y <= height - margin; y += spacing) {
        for (let x = margin; x <= width - margin; x += spacing) {
          const point = { x, y };
          if (available(point)) grid.push(point);
        }
      }
      position = grid.sort(
        (a, b) =>
          Math.hypot(a.x - marker.x, a.y - marker.y) -
          Math.hypot(b.x - marker.x, b.y - marker.y),
      )[0];
    }
    if (position)
      placed.push({ ...marker, labelX: position.x, labelY: position.y });
  }
  return placed;
}
