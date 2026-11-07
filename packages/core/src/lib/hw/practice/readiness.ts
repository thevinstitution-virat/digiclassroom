// Self-practice pilot readiness (docs/hw-eval/self-practice-pilot.md): turns facts gathered from the environment, the database and the library
// hub into a checklist. Pure, so the rules are tested and the script (scripts/hw-practice-readiness.ts) only gathers and prints.
//
// Statuses: pass; fail (blocks the pilot); warn (does not block, but a person should decide); manual (a person has to confirm it: the
// code cannot see it); info (where things stand now).

export type CheckStatus = 'pass' | 'fail' | 'warn' | 'manual' | 'info';

export interface Check { id: string; status: CheckStatus; title: string; detail: string }

export interface Route { step: string; provider: string; model: string | undefined; keyPresent: boolean }

export interface ReadinessFacts {
  pilot: { learners: number; subjects: string[]; media: ('en' | 'hi')[] };
  env: {
    selfPracticeEnabled: boolean; trialDays: number; trialBudgetPaise: number; platformBudgetPaise: number; maxAttempts: number;
    eligibilityEnforced: boolean; strictMarking: boolean; instructionGuard: boolean; sharedKeys: boolean;
    cronSecretLength: number; hubEnabled: boolean; hubUrlSet: boolean; hubSecretSet: boolean;
    /** HW_KEY_ALLOW_SAME_FAMILY: the answer-key verifier may be the writer's model family. */
    allowSameFamily?: boolean;
  };
  /** Reading, re-reading and marking. */
  routes: Route[];
  /** The answer-key service as the environment configures it. */
  keys: { ok: boolean; problem?: string; rMin?: number; writer?: Route; verifier?: Route };
  tables: { practiceTrial: boolean; instructionFlag: boolean };
  /** Eligibility of the groups a pilot learner can reach (subject x question type x language, textbook keys), under the running setup. */
  eligibility: { runningHash: string | null; groups: { key: string; eligible: boolean; reason: string }[] };
  /** One search per pilot subject and medium; null when the hub is off or was not tried. */
  hub: { probes: { scope: string; ok: boolean; practiceRows: number; error?: string }[] } | null;
}

const rupees = (paise: number) => `₹${(paise / 100).toFixed(2)}`;
const c = (id: string, status: CheckStatus, title: string, detail: string): Check => ({ id, status, title, detail });

export function evaluateReadiness(f: ReadinessFacts): Check[] {
  const out: Check[] = [];

  out.push(c('flag', 'info', 'Self-practice switch', f.env.selfPracticeEnabled ? 'HW_SELF_PRACTICE_ENABLED is on.' : 'HW_SELF_PRACTICE_ENABLED is off. Switch it on last, after every check below passes.'));

  out.push(f.tables.practiceTrial
    ? c('migration-031', 'pass', 'Migration 031 (trial table)', 'hw_practice_trial exists.')
    : c('migration-031', 'fail', 'Migration 031 (trial table)', 'hw_practice_trial does not exist. Apply migration 031 (owner go-ahead needed).'));

  // Reading, re-reading and marking: a model and a key for each route.
  const missing = f.routes.filter((r) => !r.model);
  const noKey = f.routes.filter((r) => r.model && !r.keyPresent);
  if (missing.length) out.push(c('ai-models', 'fail', 'Reading and marking models', `No model set for: ${missing.map((r) => r.step).join(', ')}.`));
  else if (noKey.length) out.push(c('ai-models', 'fail', 'Reading and marking models', `No API key for the provider of: ${noKey.map((r) => `${r.step} (${r.provider})`).join(', ')}.`));
  else out.push(c('ai-models', 'pass', 'Reading and marking models', f.routes.map((r) => `${r.step}: ${r.provider}/${r.model}`).join('; ') + '.'));

  out.push(f.env.strictMarking
    ? c('strict', 'pass', 'Strict marking', 'HW_STRICT_MARKING_ENABLED is on (the accuracy-first setting).')
    : c('strict', 'warn', 'Strict marking', 'HW_STRICT_MARKING_ENABLED is off: learners would be marked with the older prompt, which detected fewer wrong answers in the evaluation.'));

  out.push(f.env.eligibilityEnforced
    ? c('elig-enforced', 'pass', 'Eligibility check', 'HW_ELIGIBILITY_ENFORCED is on: AI marks only for groups that passed the gates.')
    : c('elig-enforced', 'fail', 'Eligibility check', 'HW_ELIGIBILITY_ENFORCED is off: AI would mark groups that have not passed the gates. It must be on.'));

  const eligible = f.eligibility.groups.filter((g) => g.eligible);
  if (f.eligibility.runningHash === null) out.push(c('eligibility', 'fail', 'Groups eligible for the running setup', 'No grade model is configured, so there is no running setup to be eligible for.'));
  else if (!eligible.length) out.push(c('eligibility', 'fail', 'Groups eligible for the running setup', `None of the ${f.eligibility.groups.length} pilot groups is eligible. Import evaluation runs made under this exact setup (npm run hw:eval:gates). Without it learners get their handwriting read but no marks.`));
  else if (eligible.length < f.eligibility.groups.length) out.push(c('eligibility', 'warn', 'Groups eligible for the running setup', `${eligible.length} of ${f.eligibility.groups.length} pilot groups are eligible; learners get no marks for the rest (${f.eligibility.groups.filter((g) => !g.eligible).map((g) => g.key).slice(0, 6).join('; ')}${f.eligibility.groups.length - eligible.length > 6 ? '; …' : ''}). Narrow the pilot to the eligible groups or import more runs.`));
  else out.push(c('eligibility', 'pass', 'Groups eligible for the running setup', `All ${eligible.length} pilot groups are eligible.`));

  // The answer key.
  if (!f.keys.ok) out.push(c('keys', 'fail', 'Answer keys', f.keys.problem ?? 'The key service is not configured.'));
  else {
    const noWriterKey = f.keys.writer && !f.keys.writer.keyPresent, noVerifierKey = f.keys.verifier && !f.keys.verifier.keyPresent;
    if (noWriterKey || noVerifierKey) {
      out.push(c('keys', 'fail', 'Answer keys', `No API key for the provider of the ${[noWriterKey && `writer (${f.keys.writer!.provider})`, noVerifierKey && `verifier (${f.keys.verifier!.provider})`].filter(Boolean).join(' and ')}. Production routes them through OpenRouter today and has no OpenRouter key.`));
    } else out.push(c('keys', 'pass', 'Answer keys', `Writer ${f.keys.writer?.provider}/${f.keys.writer?.model}, verifier ${f.keys.verifier?.provider}/${f.keys.verifier?.model}, different families.`));
  }
  out.push(f.keys.rMin === undefined
    ? c('r-min', 'fail', 'Textbook retrieval threshold', 'HW_KEY_R_MIN is not set: textbook keys cannot be built.')
    : c('r-min', 'manual', 'Textbook retrieval threshold', `HW_KEY_R_MIN is ${f.keys.rMin}. The owner still has to confirm this value (roadmap).`));
  if (f.env.allowSameFamily) out.push(c('key-family', 'warn', 'Answer-key verifier independence', 'HW_KEY_ALLOW_SAME_FAMILY is on: the verifier may be the same model family as the writer, so it can share the writer\'s blind spots. A choice the owner made; the key quality on this setup has not been measured.'));
  out.push(f.env.sharedKeys
    ? c('shared-keys', 'pass', 'Shared keys', 'HW_SHARED_KEYS_ENABLED is on: learners who pick the same question share one key, so each key is paid for once.')
    : c('shared-keys', 'warn', 'Shared keys', 'HW_SHARED_KEYS_ENABLED is off: every learner who picks a question has a key built for them, paid by the platform. Consider switching it on for the pilot.'));

  // The library.
  if (!f.env.hubEnabled || !f.env.hubUrlSet || !f.env.hubSecretSet) {
    out.push(c('hub', 'fail', 'Textbook library', `Library hub is not usable: ${[!f.env.hubEnabled && 'LIBRARY_HUB_ENABLED is not true', !f.env.hubUrlSet && 'LIBRARY_HUB_URL is not set', !f.env.hubSecretSet && 'LIBRARY_HUB_SECRET is not set'].filter(Boolean).join('; ')}.`));
  } else if (!f.hub) {
    out.push(c('hub', 'warn', 'Textbook library', 'The library hub is configured but was not probed (run without --skip-hub).'));
  } else {
    const bad = f.hub.probes.filter((p) => !p.ok || p.practiceRows === 0);
    if (!f.hub.probes.length) out.push(c('hub', 'warn', 'Textbook library', 'No pilot subject was probed.'));
    else if (bad.length === f.hub.probes.length) out.push(c('hub', 'fail', 'Textbook library', `No pilot scope returned exercise questions: ${bad.map((p) => `${p.scope} (${p.error ?? 'no exercise rows'})`).join('; ')}. The books are not ingested or the scope is wrong.`));
    else if (bad.length) out.push(c('hub', 'warn', 'Textbook library', `Some pilot scopes return nothing: ${bad.map((p) => `${p.scope} (${p.error ?? 'no exercise rows'})`).join('; ')}. Learners in those would see "no questions".`));
    else out.push(c('hub', 'pass', 'Textbook library', `Exercise questions found for ${f.hub.probes.map((p) => `${p.scope} (${p.practiceRows} rows)`).join('; ')}.`));
  }
  out.push(c('qdrant-protected', 'manual', 'Vector store protected', 'Qdrant must have an access key before any textbook is ingested (roadmap D12). The code cannot see this: the owner confirms.'));

  // Instruction guard.
  if (f.env.instructionGuard) {
    out.push(f.tables.instructionFlag
      ? c('guard', 'pass', 'Instruction guard', 'On, and its table (migration 020) exists.')
      : c('guard', 'fail', 'Instruction guard', 'HW_INSTRUCTION_GUARD_ENABLED is on but migration 020 is not applied.'));
  } else out.push(c('guard', 'warn', 'Instruction guard', 'Off. It stops an answer that talks to the marker from steering its own mark; the accuracy-first setting has it on (needs migration 020, owner go-ahead).'));

  // The job runner.
  out.push(f.env.cronSecretLength >= 32
    ? c('cron-secret', 'pass', 'Job runner secret', 'HW_CRON_SECRET is set (32 characters or more).')
    : c('cron-secret', 'fail', 'Job runner secret', 'HW_CRON_SECRET is missing or shorter than 32 characters: the job route refuses every call, so nothing is read, marked or returned.'));
  out.push(c('cron-scheduled', 'manual', 'Job runner scheduled', 'A scheduled task must call POST /api/cron/hw-jobs every minute (roadmap W1). The code cannot see the schedule: the owner confirms it runs.'));

  // Money.
  const worstLearners = f.pilot.learners * f.env.trialBudgetPaise;
  out.push(worstLearners > f.env.platformBudgetPaise
    ? c('budget', 'warn', 'Spending limits', `${f.pilot.learners} learners x ${rupees(f.env.trialBudgetPaise)} = ${rupees(worstLearners)} could exceed the practice ceiling of ${rupees(f.env.platformBudgetPaise)} a month; raise HW_SELF_PRACTICE_PLATFORM_BUDGET_PAISE or invite fewer.`)
    : c('budget', 'pass', 'Spending limits', `${f.pilot.learners} learners x ${rupees(f.env.trialBudgetPaise)} = ${rupees(worstLearners)} of reading and marking at most, under the monthly ceiling of ${rupees(f.env.platformBudgetPaise)}; ${f.env.trialDays} days; up to ${f.env.maxAttempts} questions each.`));
  out.push(c('key-cost', 'warn', 'Cost of answer keys', `Building a key is not charged to the learner's ${rupees(f.env.trialBudgetPaise)} and its price per question has not been measured: at most ${f.pilot.learners * f.env.maxAttempts} keys in the pilot, counted against the ceiling. Measure it in the first week.`));

  // People.
  out.push(c('consent', 'manual', 'Consent and minors', 'Wording for learners and for parents of under-18s, and how long handwriting images are kept, are decided and legally reviewed (roadmap). The code cannot see this.'));
  out.push(c('hindi', f.pilot.media.includes('hi') ? 'manual' : 'info', 'Hindi review', f.pilot.media.includes('hi') ? 'A native Hindi speaker has read every Hindi string, and Hindi-medium books are in the library.' : 'English-medium pilot: Hindi text is shown if a learner switches language, so review it before opening to Hindi medium.'));

  return out;
}

export interface Verdict { ready: boolean; failing: Check[]; warnings: Check[]; manual: Check[] }

export function verdictOf(checks: Check[]): Verdict {
  const failing = checks.filter((x) => x.status === 'fail');
  return { ready: failing.length === 0, failing, warnings: checks.filter((x) => x.status === 'warn'), manual: checks.filter((x) => x.status === 'manual') };
}

const MARK: Record<CheckStatus, string> = { pass: 'PASS  ', fail: 'FAIL  ', warn: 'WARN  ', manual: 'CHECK ', info: 'INFO  ' };

export function renderReadiness(checks: Check[]): string {
  const v = verdictOf(checks);
  const lines = checks.map((x) => `${MARK[x.status]}${x.title}\n        ${x.detail}`);
  const tail = v.ready
    ? `\nNo check blocks the pilot. ${v.warnings.length} warning(s) to decide on; ${v.manual.length} item(s) a person must confirm.`
    : `\nNOT READY: ${v.failing.length} check(s) block the pilot (${v.failing.map((x) => x.id).join(', ')}).`;
  return lines.join('\n') + '\n' + tail + '\n';
}
