import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium, expect } = require(process.env.PLAYWRIGHT_MODULE || '@playwright/test');
const base = process.env.UI_BASE_URL || 'http://localhost:3000';
const output = process.env.UI_SCREENSHOTS || '/tmp/pitwall-design';
const circuits = JSON.parse(await readFile(new URL('../frontend/app/standings/data/f1-circuits.json', import.meta.url), 'utf8'));
const cases = [
  { year: 2023, round: 1, driver: 'hamilton', number: '44', name: 'Bahrain Grand Prix', circuit: 'Bahrain International Circuit', date: '2023-03-05', pace: 96, topSpeed: 318 },
  { year: 2024, round: 8, driver: 'leclerc', number: '16', name: 'Monaco Grand Prix', circuit: 'Circuit de Monaco', date: '2024-05-26', pace: 76, topSpeed: 279 },
  { year: 2025, round: 13, driver: 'norris', number: '4', name: 'Belgian Grand Prix', circuit: 'Circuit de Spa-Francorchamps', date: '2025-07-27', pace: 108, topSpeed: 337 },
];

function fixture(testCase) {
  const coordinates = circuits.features.find(item => item.properties.Name === testCase.circuit)?.geometry.coordinates;
  assert(coordinates?.length > 20, `${testCase.name}: track fixture exists`);
  const origin = Date.parse(`${testCase.date}T13:00:00.000Z`);
  let elapsed = 0;
  const laps = [1, 2, 3, 4].map(lap => {
    const duration = testCase.pace + [5, 2, 0, 8][lap - 1];
    const result = {
      lap_number: lap,
      date_start: new Date(origin + elapsed * 1000).toISOString(),
      lap_duration: duration,
      duration_sector_1: duration * .31,
      duration_sector_2: duration * .38,
      duration_sector_3: duration * .31,
      st_speed: testCase.topSpeed - (lap === 3 ? 0 : lap),
      i1_speed: 220 + lap,
      i2_speed: 260 + lap,
      is_pit_out_lap: lap === 4,
    };
    elapsed += duration;
    return result;
  });
  const at = (lap, fraction) => new Date(Date.parse(lap.date_start) + lap.lap_duration * fraction * 1000).toISOString();
  const minX = Math.min(...coordinates.map(point => point[0]));
  const minY = Math.min(...coordinates.map(point => point[1]));
  const longitudeScale = Math.cos(coordinates.reduce((sum, point) => sum + point[1], 0) / coordinates.length * Math.PI / 180);
  const sourcePoints = coordinates.map(point => ({ x: (point[0] - minX) * 100000 * longitudeScale, y: (point[1] - minY) * 100000 }));
  const distances = [0];
  sourcePoints.slice(1).forEach((point, index) => distances.push(distances[index] + Math.hypot(point.x - sourcePoints[index].x, point.y - sourcePoints[index].y)));
  const pathAt = fraction => {
    const distance = distances.at(-1) * fraction;
    const lastIndex = Math.max(1, distances.findIndex(value => value >= distance));
    const first = sourcePoints[lastIndex - 1];
    const last = sourcePoints[lastIndex];
    const mix = (distance - distances[lastIndex - 1]) / (distances[lastIndex] - distances[lastIndex - 1] || 1);
    return { x: first.x + (last.x - first.x) * mix, y: first.y + (last.y - first.y) * mix };
  };
  const samples = lap => Array.from({ length: 121 }, (_, index) => {
    const fraction = index / 120;
    const speed = Math.round(80 + (testCase.topSpeed - 80) * (1 + Math.sin(fraction * Math.PI * 10)) / 2) - (lap.lap_number === 3 ? 0 : 10);
    return { date: at(lap, fraction), speed, throttle: speed < 140 ? 28 : 100, brake: speed < 120 ? 1 : 0, rpm: Math.round(7000 + speed * 15), n_gear: Math.max(2, Math.min(8, Math.round(speed / 43))) };
  });
  const locations = lap => Array.from({ length: 91 }, (_, index) => ({ date: at(lap, index / 90), ...pathAt(index / 90) }));
  return {
    laps,
    samples,
    locations,
    metadata: { year: testCase.year, rotation: 0, corners: [10, 25, 40, 55, 70].map((index, offset) => ({ number: offset + 1, letter: '', angle: 0, trackPosition: pathAt(index / 90) })) },
    pits: [{ lap_number: 3, lane_duration: 24.1, date: laps[2].date_start }],
    stints: [
      { compound: 'SOFT', lap_start: 1, lap_end: 2, stint_number: 1, tyre_age_at_start: 0 },
      { compound: 'HARD', lap_start: 3, lap_end: 4, stint_number: 2, tyre_age_at_start: 1 },
    ],
    weather: laps.map((lap, index) => ({ date: lap.date_start, air_temperature: 22 + index, track_temperature: 34 + index, rainfall: 0, humidity: 41 + index, wind_speed: 2 + index / 2, wind_direction: 190 })),
  };
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
const requests = [];
let activeCase = cases[0];
let carFailures = 0;
let carDelay = 0;
let metadataAvailable = true;
page.on('pageerror', error => errors.push(error.message));
await mkdir(output, { recursive: true });

await page.route('**/api/circuit-info?**', route => {
  const year = Number(new URL(route.request().url()).searchParams.get('year'));
  const testCase = cases.find(item => item.year === year) ?? activeCase;
  return route.fulfill(metadataAvailable ? { json: fixture(testCase).metadata } : { status: 404, json: {} });
});
await page.route('https://api.openf1.org/v1/**', async route => {
  const url = new URL(route.request().url());
  const endpoint = url.pathname.split('/').at(-1);
  const year = url.searchParams.get('year') ?? url.searchParams.get('meeting_key') ?? url.searchParams.get('session_key');
  const testCase = cases.find(item => item.year === Number(year)) ?? activeCase;
  const data = fixture(testCase);
  requests.push({ endpoint, url: url.href, driver: testCase.number });
  if (['laps', 'stints', 'car_data', 'location'].includes(endpoint)) {
    assert.equal(url.searchParams.get('driver_number'), testCase.number, `${endpoint}: selected driver`);
  }
  if (endpoint === 'car_data' && carFailures > 0) {
    carFailures--;
    return route.fulfill({ status: 503, json: {} });
  }
  if (endpoint === 'car_data' && carDelay) await new Promise(resolve => setTimeout(resolve, carDelay));
  const start = [...url.searchParams].find(([key]) => key.startsWith('date>'))?.[1];
  const chosen = data.laps.find(lap => start && Math.abs(Date.parse(lap.date_start) - Date.parse(start)) < 6000) ?? data.laps[2];
  const fixtures = {
    meetings: [{ meeting_key: testCase.year, meeting_name: testCase.name, date_start: `${testCase.date}T13:00:00.000Z`, circuit_short_name: testCase.circuit, circuit_key: testCase.year }],
    sessions: [{ session_key: testCase.year, circuit_key: testCase.year, year: testCase.year, session_name: 'Race', date_start: `${testCase.date}T13:00:00.000Z` }],
    laps: data.laps,
    stints: data.stints,
    car_data: data.samples(chosen),
    location: data.locations(chosen),
    weather: data.weather,
    pit: data.pits,
  };
  await route.fulfill({ json: fixtures[endpoint] ?? [] }).catch(error => {
    if (!/closed|canceled|Target|handled/i.test(error.message)) throw error;
  });
});

async function overflow(label) {
  const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
  assert(dimensions.document <= dimensions.viewport + 1, `${label}: horizontal overflow ${JSON.stringify(dimensions)}`);
}

async function snapshot(name) {
  await page.evaluate(() => { scrollTo(0, 0); return document.fonts.ready; });
  await page.screenshot({ path: `${output}/${name}.png`, fullPage: true });
}

async function load(testCase) {
  activeCase = testCase;
  await page.goto(`${base}/driver/${testCase.driver}?year=${testCase.year}&round=${testCase.round}`, { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: testCase.name, exact: true })).toBeVisible();
  await page.getByRole('button', { name: '데이터 불러오기', exact: true }).click();
  await expect(page.getByRole('heading', { name: '트랙 레이아웃', exact: true })).toBeVisible({ timeout: 30000 });
  await expect(page.getByLabel('분석할 랩')).toHaveValue('3');
  await expect(page.getByLabel('분석할 랩')).toBeEnabled({ timeout: 30000 });
}

const map = () => page.getByTestId('track-map').filter({ visible: true });

try {
  for (const testCase of cases) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await load(testCase);
    for (const heading of ['랩 퍼포먼스 흐름', '타이어 구간과 날씨 흐름']) await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    await expect(map()).toBeVisible();
    assert(await map().locator('[data-testid^="track-sample-"]').count() > 20, `${testCase.name}: location trace populated`);
    for (const id of ['speed-chart', 'controls-chart', 'rpm-gear-chart', 'lap-flow-chart', 'sector-chart', 'trap-chart']) {
      await expect(page.getByTestId(id).locator('svg.recharts-surface')).toBeVisible();
      assert(await page.getByTestId(id).locator('.recharts-line-curve').count() > 0, `${id}: real data curves present`);
    }
    const bestTimes = { 2023: '1:36.000', 2024: '1:16.000', 2025: '1:48.000' };
    await expect(page.getByText('개인 베스트 랩', { exact: true }).locator('..')).toContainText(bestTimes[testCase.year]);
    await expect(page.getByText('선택 랩 최고 속도', { exact: true }).locator('..')).toContainText(`${testCase.topSpeed} km/h`);
    await expect(page.getByTestId('tyre-strategy')).toContainText('SOFT');
    await expect(page.getByTestId('tyre-strategy')).toContainText('HARD');
    await expect(page.getByTestId('tyre-strategy')).toContainText('피트 L3');
    for (const value of ['35.5 °C', '23.5 °C', '42.5 %', '2.8 m/s']) await expect(page.getByTestId('weather-summary')).toContainText(value);
    await expect(page.getByLabel('분석할 랩').locator('option')).toHaveCount(4);
    await expect(page.getByRole('checkbox', { name: '피트 아웃 랩 포함' })).toBeChecked();
    for (const width of [320, 390, 1440, 1920]) {
      await page.setViewportSize({ width, height: width < 500 ? 844 : 1000 });
      await overflow(`${testCase.name} ${width}`);
      await snapshot(`${testCase.driver}-${testCase.year}-${width}`);
      console.log(`PASS ${testCase.name}, #${testCase.number}, ${width}px`);
    }
    const carBefore = requests.filter(request => request.endpoint === 'car_data').length;
    await page.getByLabel('분석할 랩').selectOption('2');
    await expect(page.getByLabel('분석할 랩')).toHaveValue('2');
    await expect.poll(() => requests.filter(request => request.endpoint === 'car_data').length).toBeGreaterThan(carBefore);
    const selectedRequest = new URL(requests.filter(request => request.endpoint === 'car_data').at(-1).url);
    const lapStart = [...selectedRequest.searchParams].find(([key]) => key.startsWith('date>'))?.[1];
    assert.equal(lapStart, fixture(testCase).laps[1].date_start, `${testCase.name}: request is scoped to selected lap`);
    await expect(page.getByLabel('분석할 랩')).toBeEnabled({ timeout: 30000 });
    await expect(map().locator('[data-testid^="track-sample-"]').first()).toBeVisible();
    const reference = page.getByTestId('speed-chart').locator('.recharts-reference-line-line');
    const originalX = await reference.getAttribute('x1');
    const selectedFixture = fixture(testCase);
    const elapsedAt = index => ((Date.parse(selectedFixture.locations(selectedFixture.laps[1])[index].date) - Date.parse(selectedFixture.laps[1].date_start)) / 1000).toFixed(3);
    await map().locator('[data-testid^="track-sample-"]').nth(20).click();
    await expect(page.getByTestId('selected-sample')).toContainText(`시작 후 ${elapsedAt(20)} s`);
    await expect(page.getByTestId('selected-sample').getByRole('heading')).toHaveText('선택 지점 기록');
    assert.notEqual(await reference.getAttribute('x1'), originalX, 'map selection moves chart reference line');
    await page.getByLabel('코너 선택').getByRole('button', { name: 'T2', exact: true }).click();
    await expect(page.getByTestId('selected-sample').getByRole('heading')).toHaveText('코너 2 주변 표본');
    await expect(page.getByTestId('selected-sample')).toContainText(`시작 후 ${elapsedAt(25)} s`);
    const chartBox = await page.getByTestId('speed-chart').boundingBox();
    await page.getByTestId('speed-chart').hover({ position: { x: chartBox.width * .55, y: 80 } });
    await expect.poll(() => page.getByRole('slider', { name: '위치 표본 선택' }).inputValue()).not.toBe('25');
    for (const name of ['제동', '스로틀', '섹터', '속도']) {
      const button = page.getByRole('group', { name: '트랙 표시' }).getByRole('button', { name, exact: true });
      await button.click();
      await expect(button).toHaveAttribute('aria-pressed', 'true');
    }
    await expect(page.getByRole('button', { name: '베스트 랩', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '베스트 랩', exact: true }).click();
    await expect(page.getByLabel('분석할 랩')).toHaveValue('3');
    await expect(page.getByLabel('분석할 랩')).toBeEnabled();
    console.log(`PASS ${testCase.name}: lap request and linked map selection`);
  }

  await page.getByRole('button', { name: '랩 재생', exact: true }).click();
  await expect.poll(() => page.getByRole('slider', { name: '위치 표본 선택' }).inputValue()).not.toBe('0');
  await page.getByRole('button', { name: '재생 일시정지', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '트랙 확대', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '확대한 트랙 지도' })).toBeVisible();
  await overflow('expanded mobile track');
  await page.getByRole('dialog', { name: '확대한 트랙 지도' }).getByRole('button', { name: '닫기', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '확대한 트랙 지도' })).not.toBeVisible();
  console.log('PASS playback, pause, mobile map expansion');

  await page.evaluate(() => sessionStorage.clear());
  carFailures = 1;
  metadataAvailable = false;
  await load(cases[0]);
  await expect(page.getByRole('button', { name: '누락 데이터 다시 조회', exact: true })).toBeVisible({ timeout: 30000 });
  const cachedKeys = await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith('pitwall:v1:')));
  assert(!cachedKeys.some(key => key.includes(':lap:')), 'incomplete selected-lap data is not cached');
  await page.evaluate(() => { Storage.prototype.setItem = function () { throw new DOMException('Quota exceeded', 'QuotaExceededError'); }; });
  await page.getByRole('button', { name: '누락 데이터 다시 조회', exact: true }).click();
  await expect(page.getByLabel('분석할 랩')).toBeEnabled({ timeout: 30000 });
  await expect(page.getByRole('button', { name: '누락 데이터 다시 조회', exact: true })).toHaveCount(0, { timeout: 30000 });
  await expect(page.getByLabel('코너 선택')).toHaveCount(0);
  assert(await map().locator('[data-testid^="track-sample-"]').count() > 20, 'metadata failure preserves actual location trace');
  console.log('PASS partial telemetry retry and storage quota');

  await page.evaluate(() => sessionStorage.clear());
  carDelay = 1500;
  const pendingBefore = requests.filter(request => request.endpoint === 'car_data').length;
  await page.getByLabel('분석할 랩').selectOption('1');
  await expect.poll(() => requests.filter(request => request.endpoint === 'car_data').length).toBeGreaterThan(pendingBefore);
  activeCase = cases[1];
  await page.goto(`${base}/driver/${activeCase.driver}?year=${activeCase.year}&round=${activeCase.round}`);
  carDelay = 0;
  await expect(page.getByRole('button', { name: '데이터 불러오기', exact: true })).toBeVisible();
  await expect(page.getByLabel('분석할 랩')).toHaveCount(0);
  console.log('PASS pending lap telemetry reset during race navigation');
  assert.deepEqual(errors, [], 'browser runtime errors');
} finally {
  await browser.close();
}
