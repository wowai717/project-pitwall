import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
const source = await readFile(new URL('../frontend/app/standings/analysis-data.ts', import.meta.url), 'utf8');
const { formatLaps, lapSummary, lapPlot, sensorPlot, formatCars, formatStints, weatherMetric, lapClock } = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString('base64')}`);
const date = '2025-01-01T12:00:00Z';
const laps = formatLaps([
  { lap_number: 3, lap_duration: 89, is_pit_out_lap: true, st_speed: 333 },
  { lap_number: 2, date_start: date, lap_duration: 92, duration_sector_1: 0, i2_speed: 350 },
  { lap_number: 1, lap_duration: 90, st_speed: 300 },
  { lap_number: 4, lap_duration: null },
  { lap_number: 0, lap_duration: 88 },
]);
assert.equal(laps.length, 4);
assert.equal(laps[1].trapSpeed, null, 'intermediate speed is not speedtrap');
assert.equal(laps[1].sector1, null, 'missing sector is not zero');
assert.equal(laps[3].lapTime, null, 'whole-race graph keeps missing lap');
const summary = lapSummary(laps);
assert.equal(summary.best.lap, 1);
assert.equal(summary.average, 91);
assert.equal(summary.variation, 1);
assert.equal(summary.trapMax, 300);
assert.equal(summary.count, 2);
assert.equal(lapPlot([laps[0], laps[2]], true)[1].lapTime, null);
assert.equal(lapPlot(laps, false)[2].trapSpeed, null);
assert.equal(lapClock(59.9999), '1:00.000');
const cars = formatCars([
  { date, speed: 0, throttle: 0, brake: 0, rpm: 0, n_gear: 0 },
  { date: '2025-01-01T12:00:20Z', speed: 250, throttle: 105, brake: 100, n_gear: 6 },
  { date: '2025-01-01T11:59:59Z', speed: 333, throttle: 100 },
  { date: '2025-01-01T12:02:00Z', speed: 333, throttle: 100 },
], laps[1]);
assert.equal(cars.length, 2);
assert.equal(cars[0].speed, 0, 'stopped car is valid');
assert.equal(cars[0].gear, 0, 'neutral is valid');
assert(Number.isNaN(cars[1].throttle), 'invalid throttle stays missing');
assert.equal(cars[1].brake, 100);
assert.equal(sensorPlot(cars)[1].speed, null, 'missing time interval breaks the sensor graph');
assert.equal(formatStints([{ lap_start: 2, lap_end: 1 }]).length, 0);
assert.equal(formatStints([{ lap_start: 1, lap_end: 2 }])[0].tyreAgeAtStart, null);
assert.equal(weatherMetric([{}], 'air_temperature'), null);
assert.deepEqual(weatherMetric([{ air_temperature: 0 }, { air_temperature: -2 }], 'air_temperature'), { average: -1, min: -2, max: 0, count: 2 });
console.log('Analysis checks passed: lap scope, missing values, units, pit-out filtering, sensor time window and weather.');
