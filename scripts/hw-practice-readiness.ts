// Self-practice pilot readiness (docs/hw-eval/self-practice-pilot.md). READ-ONLY: it reads the environment, runs SELECTs, and (unless
// --skip-hub) makes one library search per pilot subject and medium, which costs a query embedding at most. It prints no secret, only whether
// one is set. Exit code 1 when anything blocks the pilot, so it can sit in front of the switch.
//
//   npm run hw:practice:readiness -w apps/api -- [--learners 10] [--subjects Science,Mathematics] [--media en,hi] [--class 9] [--skip-hub]
//
// Run it with the environment of the server it should answer for (the env file, or the container's own environment).

import { evaluateReadiness, renderReadiness, verdictOf, type ReadinessFacts, type Route } from '@/lib/hw/practice/readiness';

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i > 1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const flag = (name: string) => process.argv.includes(`--${name}`);
const list = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

const KEY_ENV: Record<string, string> = { gemini: 'GEMINI_API_KEY', openrouter: 'OPENROUTER_API_KEY', openai: 'OPENAI_API_KEY' };

async function main() {
  const { getHwConfig, _resetHwConfig } = await import('@/lib/hw/config');
  _resetHwConfig();
  const c = getHwConfig();
  const subjects = list(arg('subjects', 'Science'));
  const media = list(arg('media', 'en')).filter((m): m is 'en' | 'hi' => m === 'en' || m === 'hi');
  const classLevel = arg('class', '9');
  const learners = Math.max(1, Number(arg('learners', '10')) || 10);

  const route = (step: string, provider: string, model: string | undefined): Route => ({ step, provider, model, keyPresent: Boolean(process.env[KEY_ENV[provider] ?? ''] ?? '') });
  const routes: Route[] = [
    route('read', c.HW_READ_PROVIDER ?? c.HW_AI_PROVIDER, c.HW_READ_MODEL),
    route('re-read', c.HW_ESCALATE_PROVIDER ?? c.HW_AI_PROVIDER, c.HW_ESCALATE_MODEL),
    route('mark', c.HW_GRADE_PROVIDER ?? c.HW_AI_PROVIDER, c.HW_GRADE_MODEL),
  ];

  let keys: ReadinessFacts['keys'];
  try {
    const { keySettingsFromEnv } = await import('@/lib/hw/keys/service');
    const k = keySettingsFromEnv();
    keys = { ok: true, rMin: k.rMin, writer: route('key writer', k.writer.provider, k.writer.model), verifier: route('key verifier', k.verifier.provider, k.verifier.model) };
  } catch (e) {
    keys = { ok: false, problem: e instanceof Error ? e.message : String(e), rMin: c.HW_KEY_R_MIN };
  }

  const { db } = await import('@/db');
  const { sql } = await import('drizzle-orm');
  const exists = async (t: string) => Boolean((await db.execute<{ r: string | null }>(sql`SELECT to_regclass(${`public.${t}`})::text AS r`)).rows[0]?.r);
  const tables = { practiceTrial: await exists('hw_practice_trial'), instructionFlag: await exists('hw_instruction_flag') };

  // Eligibility of every group a pilot learner can reach.
  const { eligibilityOfGroup, runningConfig } = await import('@/lib/hw/eligibility/registry');
  const { groupKey } = await import('@/lib/hw/eligibility/group');
  let runningHash: string | null = null;
  try { runningHash = runningConfig().hash; } catch { /* no grade model */ }
  const groups: ReadinessFacts['eligibility']['groups'] = [];
  for (const subject of subjects) {
    for (const language of media) {
      for (const questionType of ['very_short', 'short', 'long'] as const) {
        const parts = { subject, questionType, language, schemeSource: 'textbook_key' } as const;
        const d = await eligibilityOfGroup(db, parts);
        groups.push({ key: groupKey(parts), eligible: d.eligible, reason: d.eligible ? 'eligible' : d.reason });
      }
    }
  }

  // The library: one search per subject and medium.
  let hub: ReadinessFacts['hub'] = null;
  const hubUsable = process.env.LIBRARY_HUB_ENABLED === 'true' && Boolean(process.env.LIBRARY_HUB_URL) && Boolean(process.env.LIBRARY_HUB_SECRET);
  if (hubUsable && !flag('skip-hub')) {
    const { defaultHub, parseScope, searchPracticeQuestions } = await import('@/lib/hw/practice/catalog');
    hub = { probes: [] };
    for (const subject of subjects) {
      for (const medium of media) {
        const scope = `Class ${classLevel} ${subject}, ${medium === 'hi' ? 'Hindi' : 'English'} medium`;
        try {
          const r = await searchPracticeQuestions(parseScope({ classLevel, subject, medium }), 'chapter exercise questions', defaultHub());
          hub.probes.push({ scope, ok: r.available, practiceRows: r.questions.length, ...(r.available ? {} : { error: 'library hub off' }) });
        } catch (e) {
          hub.probes.push({ scope, ok: false, practiceRows: 0, error: e instanceof Error ? e.message : String(e) });
        }
      }
    }
  }

  const facts: ReadinessFacts = {
    pilot: { learners, subjects, media },
    env: {
      selfPracticeEnabled: c.HW_SELF_PRACTICE_ENABLED, trialDays: c.HW_SELF_PRACTICE_TRIAL_DAYS, trialBudgetPaise: c.HW_SELF_PRACTICE_TRIAL_BUDGET_PAISE,
      platformBudgetPaise: c.HW_SELF_PRACTICE_PLATFORM_BUDGET_PAISE, maxAttempts: c.HW_SELF_PRACTICE_MAX_ATTEMPTS,
      eligibilityEnforced: c.HW_ELIGIBILITY_ENFORCED, strictMarking: c.HW_STRICT_MARKING_ENABLED, instructionGuard: c.HW_INSTRUCTION_GUARD_ENABLED,
      sharedKeys: c.HW_SHARED_KEYS_ENABLED, allowSameFamily: c.HW_KEY_ALLOW_SAME_FAMILY, cronSecretLength: (process.env.HW_CRON_SECRET ?? '').length,
      hubEnabled: process.env.LIBRARY_HUB_ENABLED === 'true', hubUrlSet: Boolean(process.env.LIBRARY_HUB_URL), hubSecretSet: Boolean(process.env.LIBRARY_HUB_SECRET),
    },
    routes, keys, tables, eligibility: { runningHash, groups }, hub,
  };

  const checks = evaluateReadiness(facts);
  console.log(`Self-practice pilot readiness: ${learners} learner(s), ${subjects.join(', ')}, ${media.join('/')} medium, class ${classLevel}\n`);
  console.log(renderReadiness(checks));
  process.exitCode = verdictOf(checks).ready ? 0 : 1;
}

main().catch((e) => { console.error('readiness check failed to run:', e instanceof Error ? e.message : e); process.exit(2); }).finally(async () => {
  try { (await import('@/lib/db/connection')).getPool().end(); } catch { /* nothing to close */ }
});
