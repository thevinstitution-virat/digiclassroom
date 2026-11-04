// Headless walkthrough of the Phase 3-5 screens against the scratch database and locally started apps. Test credentials only.
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const BASE = 'http://localhost:3003';
const OUT = 'H:/Trio/worktrees/DCP-hw-wt/docs/hw-eval/screens/phase3-5';
const PASSWORD = 'Walkthrough#2026';
fs.mkdirSync(OUT, { recursive: true });
const findings = [];
const shots = [];

async function login(browser, email, lang) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  ctx.setDefaultNavigationTimeout(240000); ctx.setDefaultTimeout(120000)
  await ctx.addInitScript(() => { try { const l = sessionStorage.getItem('wlang'); if (l) localStorage.setItem('hw-lang', l); } catch {} });
  const page = await ctx.newPage();
  const r = await page.request.post(`${BASE}/api/auth/sign-in/email`, { data: { email, password: PASSWORD }, headers: { origin: BASE } });
  if (!r.ok()) throw new Error(`sign-in ${email}: ${r.status()} ${(await r.text()).slice(0, 200)}`);
  if (/wt-(ia|tc|st|pa)@/.test(email)) await ctx.addCookies([{ name: 'better-auth.active_organization', value: 'wt-org', url: BASE }]);
  await page.goto(BASE + '/manifest.json').catch(() => {});
  return { ctx, page };
}
const sessions = new Map();
async function loginCached(browser, email, lang) {
  if (!sessions.has(email)) sessions.set(email, await login(browser, email, lang));
  const s = sessions.get(email);
  await s.page.evaluate((l) => sessionStorage.setItem('wlang', l), lang);
  return s;
}

async function check(page, name) {
  const info = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    text: document.body.innerText,
  }));
  const raw = [...new Set(info.text.match(/\b(?:tc|mk|ad|ev|app|common|lang|stu|pa)\.[a-z][A-Za-z0-9_.]*\b/g) || [])].filter((k) => !/\.(com|in|org|test|ts|js|tsx)$/.test(k));
  if (info.overflow) findings.push({ screen: name, problem: 'horizontal overflow' });
  if (raw.length) findings.push({ screen: name, problem: 'raw string keys visible: ' + raw.slice(0, 6).join(', ') });
  return info.text;
}

async function shot(page, name, opts = {}) {
  const file = path.join(OUT, name + '.png');
  await page.waitForTimeout(opts.wait ?? 1200);
  const text = await check(page, name);
  if (opts.expect) for (const e of [].concat(opts.expect)) if (!text.includes(e)) findings.push({ screen: name, problem: `expected text not found: ${e}` });
  if (opts.hindi && !/[\u0900-\u097F]/.test(text)) findings.push({ screen: name, problem: 'no Devanagari text on a Hindi screen' });
  await (opts.locator ? opts.locator.screenshot({ path: file }) : page.screenshot({ path: file, fullPage: true }));
  shots.push(name + '.png');
}

const watched = new WeakSet();
function watch(page, label) {
  if (watched.has(page)) return; watched.add(page);
  page.on('pageerror', (e) => findings.push({ screen: label, problem: 'page error: ' + String(e.message).slice(0, 200) }));
  page.on('console', (m) => { if (m.type() === 'error') { const t = m.text(); if (!/favicon|Failed to load resource: the server responded with a status of (401|404)/.test(t)) findings.push({ screen: label, problem: 'console error: ' + t.slice(0, 200) }); } });
  page.on('response', (r) => { if (r.status() >= 500) findings.push({ screen: label, problem: `HTTP ${r.status()} ${r.url().replace(BASE, '').slice(0, 120)}` }); });
}

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });

  // ── super admin tabs ──
  {
    const { ctx, page } = await loginCached(browser, 'wt-sa@walkthrough.test', 'en'); watch(page, 'super-admin');
    await page.goto(`${BASE}/dashboard/super-admin/evaluation`, { waitUntil: 'networkidle' });
    const tabs = [['consent', 'Consent', 'consent'], ['tenants', 'Tenants', 'Walkthrough School'], ['eligibility', 'Eligibility', 'textbook'], ['monitoring', 'Monitoring', 'provisional'], ['runs-gates', 'Runs & gates', 'Gate tables']];
    for (const [slug, label, expect] of tabs) {
      await page.getByRole('tab', { name: label }).click();
      await page.waitForTimeout(1500);
      if (slug === 'tenants') { const b = page.getByRole('button', { name: 'Edit' }).first(); if (await b.count()) { await b.click(); await page.waitForTimeout(1200); } }
      if (slug === 'eligibility') { const b = page.getByRole('button', { name: 'Open' }).first(); if (await b.count()) { await b.click(); await page.waitForTimeout(1200); } }
      if (slug === 'monitoring') { const b = page.getByRole('button', { name: 'Days' }).first(); if (await b.count()) { await b.click(); await page.waitForTimeout(800); } }
      if (slug === 'runs-gates') { const b = page.getByRole('button', { name: 'Checks' }).first(); if (await b.count()) { await b.click(); await page.waitForTimeout(800); } }
      await shot(page, `super-admin-${slug}`, { expect: expect === 'consent' ? undefined : expect });
    }
  }

  // ── institution admin: monitoring view, English and Hindi ──
  for (const lang of ['en', 'hi']) {
    const { ctx, page } = await loginCached(browser, 'wt-ia@walkthrough.test', lang); watch(page, `institution-${lang}`);
    await page.goto(`${BASE}/dashboard/institution/assignments`, { waitUntil: 'networkidle' });
    await shot(page, `institution-monitoring-${lang}`, { hindi: lang === 'hi', expect: lang === 'en' ? ['Marking quality', 'Answer keys built'] : undefined });
  }

  // ── teacher: builder (every key status + own rubric), publish preview, marking reasons ──
  for (const lang of ['en', 'hi']) {
    const { ctx, page } = await loginCached(browser, 'wt-tc@walkthrough.test', lang); watch(page, `teacher-${lang}`);
    const dialogs = [];
    page.on('dialog', async (d) => { dialogs.push(d.message()); await d.dismiss(); });
    await page.goto(`${BASE}/dashboard/teacher/assignments/wt-a-build`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await shot(page, `builder-all-statuses-${lang}`, { hindi: lang === 'hi' });
    for (const st of ['building', 'ready', 'partial', 'no_grounding', 'failed', 'not_available']) {
      const panel = page.locator(`[data-testid="key-panel"][data-key-status="${st}"]`).first();
      if (await panel.count()) { await panel.scrollIntoViewIfNeeded(); await shot(page, `builder-key-${st}-${lang}`, { locator: panel, wait: 300, hindi: lang === 'hi' }); }
      else findings.push({ screen: `builder-${lang}`, problem: `no key panel with status ${st}` });
    }
    const own = page.locator('[data-testid="own-rubric-note"]').first();
    if (await own.count()) { await own.scrollIntoViewIfNeeded(); await shot(page, `builder-own-rubric-${lang}`, { wait: 300, locator: own.locator('xpath=ancestor::div[contains(@class,"space-y-4")][1]') }); }
    else findings.push({ screen: `builder-${lang}`, problem: 'no own-rubric note' });
    if (lang === 'en') {
      const pub = page.getByRole('button', { name: /^Publish/ }).first();
      if (await pub.count()) { await pub.click(); await page.waitForTimeout(1500); }
      fs.writeFileSync(path.join(OUT, 'publish-preview-dialog.txt'), dialogs.join('\n---\n') || '(no dialog)');
      if (!dialogs.some((d) => /marked by hand/i.test(d))) findings.push({ screen: 'builder-en', problem: 'publish confirm did not list hand-marked questions: ' + JSON.stringify(dialogs).slice(0, 200) });
    }
    await page.goto(`${BASE}/dashboard/teacher/assignments/wt-a-mark/mark`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await shot(page, `marking-q1-${lang}`, { hindi: lang === 'hi' });
    for (const [i, key] of [[1, 'key-not-supported'], [2, 'quota-reached']]) {
      const sel = page.locator('select').first();
      if (await sel.count()) { await sel.selectOption({ index: i }); await page.waitForTimeout(1500); await shot(page, `marking-${key}-${lang}`, { hindi: lang === 'hi' }); }
      else findings.push({ screen: `marking-${lang}`, problem: `no question selector for question ${i + 1}` });
    }
  }

  // ── student, parent, and the parent-link card ──
  for (const lang of ['en', 'hi']) {
    const st = await loginCached(browser, 'wt-st@walkthrough.test', lang); watch(st.page, `student-${lang}`);
    await st.page.goto(`${BASE}/dashboard/student/assignments`, { waitUntil: 'networkidle' });
    await shot(st.page, `student-list-${lang}`, { hindi: lang === 'hi' });
    await st.page.goto(`${BASE}/dashboard/student/assignments/wt-a-todo`, { waitUntil: 'networkidle' });
    await shot(st.page, `student-passage-question-${lang}`, { hindi: lang === 'hi', expect: 'The poverty line is the money' });
    await st.page.goto(`${BASE}/dashboard/student/assignments/wt-a-ret`, { waitUntil: 'networkidle' });
    await shot(st.page, `student-returned-result-${lang}`, { hindi: lang === 'hi' });
    const pa = await loginCached(browser, 'wt-pa@walkthrough.test', lang); watch(pa.page, `parent-${lang}`);
    await pa.page.goto(`${BASE}/dashboard/parent/assignments`, { waitUntil: 'networkidle' });
    await pa.page.waitForTimeout(1500);
    const sees = pa.page.getByRole('button', { name: lang === 'en' ? 'See the result' : 'परिणाम देखें' }).first();
    if (await sees.count()) { await sees.click(); await pa.page.waitForTimeout(1500); } else findings.push({ screen: `parent-${lang}`, problem: 'no See the result button for the returned assignment' });
    await shot(pa.page, `parent-assignments-${lang}`, { hindi: lang === 'hi', expect: lang === 'en' ? ['Returned homework', 'Good start. Add one example'] : undefined });
    const ia = await loginCached(browser, 'wt-ia@walkthrough.test', lang);
    await ia.page.goto(`${BASE}/dashboard/institution/assignments`, { waitUntil: 'networkidle' });
    await shot(ia.page, `institution-parent-access-${lang}`, { hindi: lang === 'hi', expect: lang === 'en' ? ['Parents’ access', 'Parent Priya'] : undefined });
  }

  // ── rater ──
  for (const lang of ['en', 'hi']) {
    const { ctx, page } = await loginCached(browser, 'wt-rt@walkthrough.test', lang); watch(page, `rater-${lang}`);
    await page.goto(`${BASE}/evaluate`, { waitUntil: 'networkidle' });
    await shot(page, `rater-evaluate-${lang}`, { hindi: lang === 'hi' });
  }

  for (const { ctx } of sessions.values()) await ctx.close();
  await browser.close();
  fs.writeFileSync(path.join(OUT, '_findings.json'), JSON.stringify({ findings, shots }, null, 2));
  console.log(JSON.stringify({ shots: shots.length, findings }, null, 1));
})().catch((e) => { console.error('WALK FAILED', e); process.exit(1); });
