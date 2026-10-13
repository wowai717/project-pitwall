import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

const require = createRequire(import.meta.url);
const { chromium, expect } = require(process.env.PLAYWRIGHT_MODULE || '@playwright/test');
const base = process.env.UI_BASE_URL || 'http://localhost:3000';
const output = process.env.UI_SCREENSHOTS || '/tmp/pitwall-ui';
const username = `ui_check_${Date.now()}`;
const password = randomBytes(18).toString('hex');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await mkdir(output, { recursive: true });

async function overflowCheck(label) {
  await expect.poll(async () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), { message: label }).toBe(true);
  const sizes = await page.evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth }));
  assert(sizes.content <= sizes.width + 1, `${label}: horizontal overflow ${JSON.stringify(sizes)}`);
}

async function screenshot(name) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${output}/${name}.png`, fullPage: true });
}

try {
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [name, route] of [['home', '/'], ['standings', '/standings?year=2023'], ['teams', '/standings?year=2023&type=constructor'], ['driver', '/driver/hamilton?year=2023'], ['login', '/login'], ['register', '/register'], ['community', '/community']]) {
      const response = await page.goto(base + route, { waitUntil: 'networkidle' });
      assert.equal(response.status(), 200, route);
      await expect(page.getByRole('navigation', { name: '주 메뉴' }).getByRole('link', { name: '순위표' })).toBeVisible();
      await overflowCheck(`${width} ${name}`);
      await screenshot(`${name}-${width}`);
      console.log(`PASS ${width}px ${name}`);
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + '/register');
  page.on('dialog', dialog => dialog.accept());
  await page.getByLabel('아이디', { exact: true }).fill(username);
  await page.getByLabel('비밀번호', { exact: true }).fill(password);
  await page.getByLabel('비밀번호 확인', { exact: true }).fill(password);
  await page.getByRole('button', { name: '회원가입', exact: true }).click();
  await page.waitForURL('**/login');
  await page.getByLabel('아이디', { exact: true }).fill(username);
  await page.getByLabel('비밀번호', { exact: true }).fill(password);
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await page.waitForURL('**/community');
  await expect(page.getByRole('button', { name: '로그아웃' })).toBeVisible();
  await page.getByLabel('제목', { exact: true }).fill('UI verification');
  await page.getByLabel('내용', { exact: true }).fill('Temporary integration test post.');
  await page.getByRole('button', { name: '게시글 등록' }).click();
  await expect(page.getByRole('status').filter({ hasText: '게시글을 등록했습니다.' })).toBeVisible();
  await page.getByRole('button', { name: /UI verification/ }).click();
  await page.getByLabel('댓글 작성').fill('Temporary integration test comment.');
  await page.getByRole('button', { name: '댓글 등록' }).click();
  await expect(page.getByText('Temporary integration test comment.', { exact: true })).toBeVisible();
  await overflowCheck('community with content');
  await screenshot('community-flow');
  await page.getByRole('button', { name: '로그아웃' }).click();
  await expect(page.getByRole('navigation', { name: '주 메뉴' }).getByRole('link', { name: '로그인', exact: true })).toBeVisible();
  console.log('PASS registration, login, post, comment, logout');

  await page.goto(base + '/driver/hamilton?year=2021');
  await expect(page.getByRole('link', { name: /순위표로 돌아가기/ })).toHaveAttribute('href', '/standings?year=2021');
  await expect(page.getByText('역사 레이스 모드')).toBeVisible();
  console.log('PASS historical mode and season navigation');

  await page.goto(base + '/login');
  await page.evaluate(() => {
    const payload = btoa(JSON.stringify({ exp: 1 }));
    localStorage.setItem('accessToken', `expired.${payload}.signature`);
    localStorage.setItem('username', 'expired');
    window.dispatchEvent(new Event('auth-change'));
  });
  await expect(page.getByRole('button', { name: '로그아웃' })).toHaveCount(0);
  console.log('PASS expired session UI');

  let carRequests = 0;
  await page.route('https://api.openf1.org/v1/**', async route => {
    const endpoint = new URL(route.request().url()).pathname.split('/').at(-1);
    const start = '2023-03-05T15:00:00.000Z';
    const fixtures = {
      meetings: [{ meeting_key: 1, meeting_name: 'Bahrain Grand Prix', date_start: start }],
      sessions: [{ session_key: 1 }],
      laps: [1, 2, 3].map(lap => ({ lap_number: lap, date_start: start, lap_duration: 90 + lap, duration_sector_1: 30, duration_sector_2: 30, duration_sector_3: 30 + lap, st_speed: 300 })),
      stints: [{ compound: 'SOFT', lap_start: 1, lap_end: 3, stint_number: 1, tyre_age_at_start: 0 }],
      car_data: Array.from({ length: 30 }, (_, i) => ({ date: new Date(Date.parse(start) + i * 3000).toISOString(), speed: 180 + i, throttle: 90, brake: 0, rpm: 11000, n_gear: 6 })),
      location: Array.from({ length: 30 }, (_, i) => ({ date: new Date(Date.parse(start) + i * 3000).toISOString(), x: 100 * Math.cos(i / 29 * 2 * Math.PI), y: 100 * Math.sin(i / 29 * 2 * Math.PI) })),
      weather: [{ air_temperature: 25, track_temperature: 35, rainfall: 0, humidity: 40, wind_speed: 2 }],
    };
    if (endpoint === 'car_data' && ++carRequests === 1) return route.fulfill({ status: 503, json: {} });
    await route.fulfill({ json: fixtures[endpoint] ?? [] });
  });
  await page.goto(base + '/driver/hamilton?year=2023&round=1');
  await page.getByRole('button', { name: /데이터 불러오기/ }).click();
  await expect(page.getByRole('button', { name: '누락 데이터 다시 조회' })).toBeVisible({ timeout: 20000 });
  assert.equal(await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith('telemetry:v10:')).length), 0);
  await page.evaluate(() => { Storage.prototype.setItem = function () { throw new DOMException('Quota exceeded', 'QuotaExceededError'); }; });
  await page.getByRole('button', { name: '누락 데이터 다시 조회' }).click();
  await expect(page.getByRole('heading', { name: '랩 퍼포먼스 흐름' })).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole('button', { name: '누락 데이터 다시 조회' })).toHaveCount(0);
  await expect(page.getByRole('img', { name: /바레인 2023/ })).toBeVisible();
  await page.getByLabel('코너 번호', { exact: true }).uncheck();
  await expect(page.getByRole('img', { name: /바레인 2023/ }).locator('circle')).toHaveCount(0);
  await page.getByLabel('코너 번호', { exact: true }).check();
  await expect(page.getByRole('img', { name: /바레인 2023/ }).locator('circle')).toHaveCount(15);
  await page.getByLabel('DRS', { exact: true }).check();
  await expect(page.getByText('녹색 점선:', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: '트랙 지도 확대' }).click();
  await expect(page.getByRole('dialog', { name: '확대한 트랙 지도' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: '확대한 트랙 지도' })).not.toBeVisible();
  await page.getByLabel('DRS', { exact: true }).uncheck();
  await page.getByRole('button', { name: '섹터', exact: true }).click();
  await expect(page.getByRole('button', { name: '섹터', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '스피드 트랩', exact: true }).click();
  await expect(page.getByText('스피드 트랩 지점 기록.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: '랩타임', exact: true }).click();
  await overflowCheck('telemetry');
  await screenshot('telemetry-mobile');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await overflowCheck('desktop telemetry');
  await screenshot('telemetry-desktop');
  for (const width of [320, 768, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await overflowCheck(`telemetry ${width}`);
    await screenshot(`telemetry-${width}`);
  }
  console.log('PASS partial telemetry retry and storage quota failure (mocked OpenF1)');
  await page.locator('a[href="/driver/hamilton?year=2023&round=2"]').click();
  await expect(page.getByRole('button', { name: /데이터 불러오기/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: '랩 퍼포먼스 흐름' })).toHaveCount(0);
  console.log('PASS telemetry state reset on race navigation');
  assert.deepEqual(errors, [], 'browser runtime errors');
} finally {
  await browser.close();
  const cleanup = `const ds=require('./src/data-source').default; (async()=>{await ds.initialize();try{await ds.transaction(async m=>{const users=await m.query('SELECT id FROM users WHERE username = ?',[process.argv[1]]);if(!users.length)return;const id=users[0].id;await m.query('DELETE FROM comments WHERE authorId = ?',[id]);await m.query('DELETE FROM posts WHERE authorId = ?',[id]);await m.query('DELETE FROM users WHERE id = ?',[id]);});}finally{await ds.destroy()}})().catch(()=>{console.error('Test cleanup failed');process.exitCode=1});`;
  execFileSync('docker', ['compose', 'exec', '-T', 'backend', 'node', '-r', 'ts-node/register/transpile-only', '-e', cleanup, username], { stdio: 'pipe' });
  console.log('Temporary test records removed.');
}
