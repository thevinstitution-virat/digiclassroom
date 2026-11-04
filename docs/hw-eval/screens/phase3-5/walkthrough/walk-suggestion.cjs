// The teacher's marking screen WITH an AI suggestion: see it, change a mark, accept with the change. Run against the scratch DB with HW_ELIGIBILITY_ENFORCED=false
// so the seeded suggestion is shown (eligibility itself is covered by the other screens). Test credentials only.
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const BASE = 'http://localhost:3003';
const OUT = 'H:/Trio/worktrees/DCP-hw-wt/docs/hw-eval/screens/phase3-5';
const findings = [];
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  ctx.setDefaultNavigationTimeout(240000); ctx.setDefaultTimeout(120000);
  await ctx.addInitScript(() => { try { const l = sessionStorage.getItem('wlang'); if (l) localStorage.setItem('hw-lang', l); } catch {} });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => findings.push('page error: ' + e.message.slice(0, 160)));
  page.on('response', (r) => { if (r.status() >= 500) findings.push(`HTTP ${r.status()} ${r.url().replace(BASE, '').slice(0, 100)}`); });
  const r = await page.request.post(`${BASE}/api/auth/sign-in/email`, { data: { email: 'wt-tc@walkthrough.test', password: 'Walkthrough#2026' }, headers: { origin: BASE } });
  if (!r.ok()) throw new Error('sign-in ' + r.status());
  await ctx.addCookies([{ name: 'better-auth.active_organization', value: 'wt-org', url: BASE }]);
  await page.goto(BASE + '/manifest.json').catch(() => {});
  const snap = async (name) => { await page.waitForTimeout(1200); await page.screenshot({ path: path.join(OUT, name + '.png'), fullPage: true }); };
  const text = async () => page.evaluate(() => document.body.innerText);

  for (const lang of ['en', 'hi']) {
    await page.evaluate((l) => sessionStorage.setItem('wlang', l), lang);
    await page.goto(`${BASE}/dashboard/teacher/assignments/wt-a-mark/mark`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const t0 = await text();
    if (!/0\.82|82%/.test(t0) && !/AI suggestion|AI का सुझाव/.test(t0)) findings.push(`${lang}: no AI suggestion block on the marking screen`);
    await snap(`marking-ai-suggestion-${lang}`);
    if (lang === 'en') {
      // change one mark: the button becomes "Accept with my changes"
      const nums = page.locator('input[type="number"]');
      if (await nums.count() > 1) { await nums.nth(1).fill('0'); await page.waitForTimeout(600); }
      else findings.push('en: no mark inputs to change');
      await snap('marking-ai-suggestion-changed-en');
      const btn = page.getByRole('button', { name: /Accept with my changes/ });
      if (await btn.count()) { await btn.click(); await page.waitForTimeout(2500); await snap('marking-ai-suggestion-accepted-en'); }
      else findings.push('en: no "Accept with my changes" button after changing a mark');
    }
  }
  await browser.close();
  console.log(JSON.stringify({ findings }, null, 1));
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
