// E2E tests for machines web UI (playwright-core + Chrome).
// Run: NODE_PATH=/usr/local/lib/node_modules node tests/e2e.mjs
let chromium;
try { chromium = require('playwright-core').chromium; }
catch { chromium = require('/usr/local/lib/node_modules/playwright-core').chromium; }

const { spawn } = require('child_process');
const assert = (cond, msg) => { if (!cond) throw new Error('FAIL: ' + msg); };

function luminance(hex) {
  const h = hex.replace('#','').trim();
  const v = h.length === 3 ? h.split('').map(c=>c+c).join('') : h;
  const [r,g,b] = [0,2,4].map(i => parseInt(v.slice(i,i+2),16)/255).map(c => c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055,2.4));
  return 0.2126*r + 0.7152*g + 0.0722*b;
}
function contrast(c1, c2) { const l1=luminance(c1), l2=luminance(c2); return (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05); }
function toHex(c) {
  // c like "rgb(16, 185, 129)" or "#16a34a"
  if (c.startsWith('#')) return c;
  const m = c.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!m) return null;
  return '#' + [m[1],m[2],m[3]].map(x=>parseInt(x).toString(16).padStart(2,'0')).join('');
}

(async () => {
  const env = { ...process.env, MACHINES_FILE: process.env.MACHINES_FILE || '/Users/faris/dev/machines/machines.json', PORT: '7778' };
  const webDir = require('path').resolve(__dirname, '..');
  const srv = spawn('bun', ['run', 'src/index.ts'], { cwd: webDir, env, stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 2000));

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  let failed = 0;
  const run = async (name, fn) => {
    try { await fn(); console.log('PASS:', name); }
    catch (e) { failed++; console.log('FAIL:', name, '-', e.message); }
  };

  // Test 1: desktop grid 4 cols
  await run('desktop grid shows 4 columns', async () => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, colorScheme: 'light' });
    const page = await ctx.newPage();
    await page.goto('http://127.0.0.1:7778', { waitUntil: 'networkidle' });
    await page.waitForSelector('ui-card', { timeout: 10000 });
    const cols = await page.evaluate(() => {
      const el = document.getElementById('list');
      const cs = getComputedStyle(el).gridTemplateColumns;
      return cs.trim().split(/\s+/).length;
    });
    assert(cols === 4, `expected 4 columns, got ${cols}`);
    await ctx.close();
  });

  // Test 2: badge a11y on dark mode
  await run('badge a11y on dark mode (contrast >= 4.5)', async () => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, colorScheme: 'dark' });
    const page = await ctx.newPage();
    await page.goto('http://127.0.0.1:7778', { waitUntil: 'networkidle' });
    await page.waitForSelector('ui-badge', { timeout: 10000 });
    // find a success badge and a danger badge
    const badges = page.locator('ui-badge >>> .badge');
    const count = await badges.count();
    assert(count > 0, 'no badges rendered');
    for (let i = 0; i < count; i++) {
      const b = badges.nth(i);
      const color = await b.evaluate(e => getComputedStyle(e).color);
      const bg = await b.evaluate(e => getComputedStyle(e).backgroundColor);
      const ch = toHex(color), cb = toHex(bg);
      if (!ch || !cb) continue;
      const cr = contrast(ch, cb);
      assert(cr >= 4.5, `badge contrast ${cr.toFixed(2)} < 4.5 (color=${ch} bg=${cb})`);
    }
    await ctx.close();
  });

  // Test 3: inline form Save button same line
  await run('Save button stays on same line as input', async () => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, colorScheme: 'light' });
    const page = await ctx.newPage();
    await page.goto('http://127.0.0.1:7778', { waitUntil: 'networkidle' });
    await page.waitForSelector('.saveorg', { timeout: 10000 });
    const btn = page.locator('.saveorg').first();
    const input = page.locator('.orgval').first();
    const bBox = await btn.boundingBox();
    const iBox = await input.boundingBox();
    assert(bBox && iBox, 'missing bounding boxes');
    const sameLine = Math.abs(bBox.y - iBox.y) < 4;
    assert(sameLine, `Save button not on same line (btn.y=${bBox.y}, input.y=${iBox.y})`);
    await ctx.close();
  });

  await browser.close();
  srv.kill();
  await new Promise(r => setTimeout(r, 500));
  console.log(failed ? `\n${failed} test(s) failed` : '\nAll tests passed');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });