import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fillLapGaps, formatLaps, summarizeLaps, normalizeCoordinates, weatherMetric, lapClock } from '../frontend/app/standings/telemetry-data.ts';

const rows = formatLaps([
  { lap_number: 3, lap_duration: 92, duration_sector_1: 0, st_speed: null, i2_speed: 310 },
  { lap_number: 1, lap_duration: 90, duration_sector_1: 29, st_speed: 300 },
  { lap_number: 2, lap_duration: 100, is_pit_out_lap: true },
  { lap_number: 4, lap_duration: 0 },
  { lap_number: 5, lap_duration: Number.NaN },
]);
assert.deepEqual(rows.map(row => row.lap), [1, 3]);
assert.equal(rows[1].sector1, null);
assert.equal(rows[1].trapSpeed, null, 'intermediate speed must not become speed trap');
assert.equal(fillLapGaps(rows)[1].lap, 2);
assert.equal(fillLapGaps(rows)[1].lapTime, null, 'excluded laps must break the chart line');
assert.deepEqual(summarizeLaps(rows), { best: 90, average: 91, variation: 1, trapMax: 300, count: 2 });
assert.equal(summarizeLaps([rows[0], rows[0]]).variation, 0);
assert.equal(summarizeLaps([]).trapMax, null);
assert.equal(lapClock(96.263), '1:36.263');
assert.equal(lapClock(59.9999), '1:00.000');
assert.equal(weatherMetric([{}], 'air_temperature'), null);
assert.deepEqual(weatherMetric([{ air_temperature: 0 }, { air_temperature: -2 }, { air_temperature: NaN }], 'air_temperature'), { average: -1, min: -2, max: 0 });
const circuits = JSON.parse(readFileSync(new URL('../frontend/app/standings/data/f1-circuits.json', import.meta.url)));
for (const feature of circuits.features.filter(f => f.geometry.type === 'LineString')) {
  const points = normalizeCoordinates(feature.geometry.coordinates.map(([x, y]) => ({ x, y })), true);
  assert(points.length > 1, feature.properties.Name);
  const width = Math.max(...points.map(p => p.x)) - Math.min(...points.map(p => p.x));
  const height = Math.max(...points.map(p => p.y)) - Math.min(...points.map(p => p.y));
  assert(width > 300 || height >= 349, `${feature.properties.Name}: geographic coordinates must fill the viewport`);
  assert(points.every(p => p.x >= 39 && p.x <= 601 && p.y >= 34 && p.y <= 386));
}
assert.deepEqual(normalizeCoordinates([{ x: 1, y: 1 }, { x: 1, y: 1 }]), []);
console.log(`PASS telemetry calculations, missing values, units, and ${circuits.features.length} circuit coordinate bounds`);

if (process.argv.includes('--live')) {
  async function fetchJson(url) {
    const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
    assert(response.ok, `${response.status} ${url}`);
    return response.json();
  }
  const sessions = await fetchJson('https://api.openf1.org/v1/sessions?year=2023&country_name=Bahrain&session_name=Race');
  assert.equal(sessions.length, 1);
  const raw = await fetchJson(`https://api.openf1.org/v1/laps?session_key=${sessions[0].session_key}&driver_number=44`);
  const laps = formatLaps(raw);
  assert(laps.length > 40);
  const summary = summarizeLaps(laps);
  assert.equal(summary.best, Math.min(...raw.filter(l => !l.is_pit_out_lap && l.lap_duration > 0).map(l => l.lap_duration)));
  console.log(JSON.stringify({ source: 'OpenF1 live fetch', session: sessions[0].session_key, driver: 44, year: 2023, race: 'Bahrain', rawLaps: raw.length, ...summary }));
}
