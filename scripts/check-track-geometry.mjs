#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';

const source = await readFile(new URL('../frontend/app/standings/track-geometry.ts', import.meta.url), 'utf8');
const geometry = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString('base64')}`);
const { buildLapTrack, fitTrackPoints, layoutCornerLabels, matchCircuitCorners, trackPointAtElapsed } = geometry;
const start = Date.parse('2025-01-01T12:00:00Z');
const date = (seconds) => new Date(start + seconds * 1000).toISOString();
const lap = { dateStart: date(0), lapTime: 60, sector1: 20, sector2: 15, sector3: 25 };
const locations = Array.from({ length: 241 }, (_, index) => {
  const angle = index / 240 * Math.PI * 2;
  return { date: date(index / 4), x: 2000 + Math.cos(angle) * 1000, y: 3000 + Math.sin(angle) * 700 };
});
const cars = locations.map((point, index) => ({ date: point.date, speed: 100 + index / 4, throttle: 80, brake: index % 30 === 0 ? 100 : 0, rpm: 12000, gear: 6 }));

const fitted = fitTrackPoints([{ x: 0, y: 0 }, { x: 50, y: 100 }, { x: NaN, y: 0 }], { width: 640, height: 420, padding: 32 });
assert.equal(fitted.length, 2);
assert.equal(fitted[0].y, 388);
assert.equal(fitted[1].y, 32);
assert.equal(fitted[1].x - fitted[0].x, 178);
assert.deepEqual(fitTrackPoints([{ x: 1, y: 1 }, { x: 1, y: 1 }]), []);
const geographic = fitTrackPoints([{ x: 10, y: 54.5 }, { x: 11, y: 55.5 }], { geographic: true });
assert.ok(Math.abs((geographic[1].x - geographic[0].x) / (geographic[0].y - geographic[1].y) - Math.cos(55 * Math.PI / 180)) < 1e-9);
const rotated = fitTrackPoints([{ x: 0, y: 0 }, { x: 100, y: 0 }], { rotation: 90 });
assert.ok(Math.abs(rotated[0].x - rotated[1].x) < 1e-9);
assert.ok(rotated[0].y > rotated[1].y);

const track = buildLapTrack([...locations].reverse(), [...cars].reverse(), lap);
assert.equal(track.complete, true);
assert.equal(track.coverage, 1);
assert.equal(track.points.length, 241);
assert.equal(track.segments.length, 240);
assert.equal(track.points[80].speed, 120);
assert.equal(track.points[80].elapsedSeconds, 20);
assert.equal(track.points[80].sourceX, locations[80].x);
assert.equal(track.sectorMarkers.length, 3);
assert.deepEqual(track.sectorMarkers.map((marker) => marker.point.elapsedSeconds), [10, 27.5, 47.5]);
assert.equal(trackPointAtElapsed(track, 20).speed, 120);
assert.equal(trackPointAtElapsed(track, 100), null);

const noisy = buildLapTrack([
  ...locations,
  { ...locations[0], date: date(-5) },
  { ...locations[0], date: date(65) },
  { x: Infinity, y: 0, date: date(10) },
  { x: 1, y: 2, date: 'invalid' },
  locations[100],
], cars, lap);
assert.equal(noisy.points.length, track.points.length);
assert.equal(noisy.points[100].speed, track.points[100].speed);
assert.equal(buildLapTrack(locations, [], lap).points[80].speed, null);
const missingCars = buildLapTrack(locations, cars.filter((point) => Date.parse(point.date) < start + 15000 || Date.parse(point.date) > start + 25000), lap);
assert.equal(missingCars.points[80].speed, null);
assert.equal(missingCars.points[80].telemetryGapMs, null);
const missingLocations = buildLapTrack(locations.filter((point) => Date.parse(point.date) < start + 15000 || Date.parse(point.date) > start + 25000), cars, lap);
assert.equal(missingLocations.complete, false);
assert.equal(missingLocations.segments.length, missingLocations.points.length - 2);
assert.equal(trackPointAtElapsed(missingLocations, 20), null);
assert.equal(buildLapTrack(locations.slice(60), cars, lap).complete, false);
assert.equal(buildLapTrack(locations, cars, { ...lap, dateStart: undefined }).points.length, 0);
assert.equal(buildLapTrack(locations, cars, { ...lap, sector2: null }).sectorMarkers.length, 0);
assert.equal(buildLapTrack(locations, cars.map((point) => ({ ...point, speed: NaN, throttle: 104 })), lap).points[80].speed, null);

const metadata = { year: 2024, corners: [40, 80, 120, 160, 200].map((index, offset) => ({ number: offset + 1, trackPosition: { x: locations[index].x, y: locations[index].y } })) };
const markers = matchCircuitCorners(metadata, track);
assert.equal(markers.length, 5);
assert.equal(markers[1].pointIndex, 80);
assert.equal(markers[1].sourceYear, 2024);
assert.equal(markers[1].x, track.points[80].x);
assert.deepEqual(matchCircuitCorners({ corners: [{ number: 1, trackPosition: { x: -5000, y: -5000 } }] }, track), []);
assert.deepEqual(matchCircuitCorners({ corners: [{ number: 1, trackPosition: metadata.corners[2].trackPosition }, { number: 2, trackPosition: metadata.corners[1].trackPosition }] }, track), []);
assert.deepEqual(matchCircuitCorners(metadata, missingLocations), []);
assert.deepEqual(matchCircuitCorners({ corners: [null] }, track), []);

for (const cluster of [
  [{ x: 32, y: 32 }, { x: 34, y: 34 }, { x: 606, y: 387 }, { x: 608, y: 388 }, { x: 320, y: 210 }, { x: 325, y: 210 }],
  Array.from({ length: 27 }, () => ({ x: 320, y: 210 })),
]) {
  const original = cluster.map((point, index) => ({ ...markers[0], ...point, label: String(index + 1), pointIndex: index }));
  const labels = layoutCornerLabels(original);
  assert.equal(labels.length, original.length);
  labels.forEach((label, index) => {
    assert.equal(label.x, original[index].x);
    assert.equal(label.y, original[index].y);
    assert.equal(label.pointIndex, original[index].pointIndex);
    assert.ok(label.labelX >= 14 && label.labelX <= 626 && label.labelY >= 14 && label.labelY <= 406);
    assert.ok(labels.slice(0, index).every((other) => Math.hypot(label.labelX - other.labelX, label.labelY - other.labelY) >= 26));
  });
  assert.ok(original.every((point) => !('labelX' in point)));
}

const geojson = JSON.parse(await readFile(new URL('../frontend/app/standings/data/f1-circuits.json', import.meta.url), 'utf8'));
const pairs = (value) => Array.isArray(value) ? typeof value[0] === 'number' && typeof value[1] === 'number' ? [{ x: value[0], y: value[1] }] : value.flatMap(pairs) : [];
for (const feature of geojson.features) {
  const points = fitTrackPoints(pairs(feature.geometry?.coordinates), { geographic: true });
  assert.ok(points.length >= 2, feature.properties?.Name);
  assert.ok(points.every((point) => point.x >= 31.99 && point.x <= 608.01 && point.y >= 31.99 && point.y <= 388.01), feature.properties?.Name);
}
console.log(`Track geometry checks passed: timestamps, gaps, sectors, corner alignment, ${geojson.features.length} fallback layouts.`);

if (process.argv.includes('--live')) {
  const directory = '/tmp/pitwall-track-verification';
  await mkdir(directory, { recursive: true });
  let lastRequest = 0;
  async function fetchJson(url) {
    const filename = `${directory}/${Buffer.from(url).toString('base64url')}.json`;
    try { return JSON.parse(await readFile(filename, 'utf8')); } catch { /* Fresh requests follow the API rate limit. */ }
    await new Promise((resolve) => setTimeout(resolve, Math.max(0, 2100 - (Date.now() - lastRequest))));
    lastRequest = Date.now();
    const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
    assert.ok(response.ok, `${response.status} ${url}`);
    const data = await response.json();
    await writeFile(filename, JSON.stringify(data));
    return data;
  }
  const scenarios = [
    { year: 2023, circuit: 'Sakhir', driver: 44 },
    { year: 2024, circuit: 'Jeddah', driver: 16 },
    { year: 2025, circuit: 'Monza', driver: 1 },
  ];
  for (const scenario of scenarios) {
    const sessions = await fetchJson(`https://api.openf1.org/v1/sessions?year=${scenario.year}&session_name=Race&circuit_short_name=${encodeURIComponent(scenario.circuit)}`);
    const session = sessions.find((point) => !point.is_cancelled);
    assert.ok(session, JSON.stringify(scenario));
    const laps = await fetchJson(`https://api.openf1.org/v1/laps?session_key=${session.session_key}&driver_number=${scenario.driver}`);
    const best = laps.filter((point) => Number.isFinite(point.lap_duration) && point.lap_duration > 0 && !point.is_pit_out_lap && point.date_start).sort((a, b) => a.lap_duration - b.lap_duration)[0];
    assert.ok(best, JSON.stringify(scenario));
    const window = `&date>=${encodeURIComponent(best.date_start)}&date<=${encodeURIComponent(new Date(Date.parse(best.date_start) + best.lap_duration * 1000).toISOString())}`;
    const actualLocations = await fetchJson(`https://api.openf1.org/v1/location?session_key=${session.session_key}&driver_number=${scenario.driver}${window}`);
    const actualCars = await fetchJson(`https://api.openf1.org/v1/car_data?session_key=${session.session_key}&driver_number=${scenario.driver}${window}`);
    const actualMetadata = await fetchJson(`https://api.multiviewer.app/api/v1/circuits/${session.circuit_key}/${scenario.year}`);
    const actualLap = { dateStart: best.date_start, lapTime: best.lap_duration, sector1: best.duration_sector_1, sector2: best.duration_sector_2, sector3: best.duration_sector_3 };
    const actualTrack = buildLapTrack(actualLocations, actualCars, actualLap, { rotation: actualMetadata.rotation });
    assert.ok(actualTrack.points.length >= 16, JSON.stringify(scenario));
    assert.ok(actualTrack.complete, JSON.stringify(scenario));
    assert.ok(actualTrack.points.some((point) => point.speed !== null), JSON.stringify(scenario));
    const actualMarkers = matchCircuitCorners(actualMetadata, actualTrack);
    assert.equal(actualMarkers.length, actualMetadata.corners.length, JSON.stringify(scenario));
    assert.equal(actualTrack.sectorMarkers.length, 3, JSON.stringify(scenario));
    const actualLabels = layoutCornerLabels(actualMarkers);
    assert.equal(actualLabels.length, actualMarkers.length, JSON.stringify(scenario));
    actualLabels.forEach((label, index) => {
      assert.ok(actualLabels.slice(0, index).every((other) => Math.hypot(label.labelX - other.labelX, label.labelY - other.labelY) >= 26), JSON.stringify(scenario));
    });
    console.log(JSON.stringify({ ...scenario, session: session.session_key, lap: best.lap_number, lapTime: best.lap_duration, points: actualTrack.points.length, complete: actualTrack.complete, coverage: actualTrack.coverage, matchedSpeedPoints: actualTrack.points.filter((point) => point.speed !== null).length, corners: actualMarkers.length, metadataCorners: actualMetadata.corners?.length, metadataYear: actualMetadata.year }));
  }
}
