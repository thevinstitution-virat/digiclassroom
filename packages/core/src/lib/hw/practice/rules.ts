// Self-practice for independent learners (docs/hw-eval/self-practice.md): the rules, with no database. Unit-tested.

/** The practice space: one platform-owned institution that holds every independent learner's practice work. */
export const PRACTICE_ORG_ID = 'virat-gyankosh-practice';

export type TrialState = 'active' | 'used_up' | 'ended';

export interface TrialRow {
  endsAt: Date;
  budgetPaise: number;
  spentPaise: number;
  state: TrialState;
}

export type TrialVerdict =
  | { ok: true; remainingPaise: number; daysLeft: number }
  | { ok: false; why: 'budget' | 'time' | 'no_trial'; remainingPaise: number };

/**
 * May a reading or marking step start now? Only while the days last and at least `reservePaise` of the budget is unspent, so the
 * rupee limit holds to within one step's cost.
 */
export function trialVerdict(t: TrialRow | null, now: Date, reservePaise: number): TrialVerdict {
  if (!t) return { ok: false, why: 'no_trial', remainingPaise: 0 };
  const remaining = Math.max(0, t.budgetPaise - t.spentPaise);
  if (now >= t.endsAt || t.state === 'ended') return { ok: false, why: 'time', remainingPaise: remaining };
  if (t.state === 'used_up' || remaining <= 0 || remaining < reservePaise) return { ok: false, why: 'budget', remainingPaise: remaining };
  return { ok: true, remainingPaise: remaining, daysLeft: Math.max(0, Math.ceil((t.endsAt.getTime() - now.getTime()) / 86_400_000)) };
}

/** The stored state after spending: a trial that has run out of money is `used_up` even if days remain. */
export function stateAfterSpend(t: Pick<TrialRow, 'budgetPaise' | 'spentPaise' | 'endsAt' | 'state'>, now: Date): TrialState {
  if (t.state === 'ended' || now >= t.endsAt) return 'ended';
  return t.spentPaise >= t.budgetPaise ? 'used_up' : 'active';
}

export type PracticeLang = 'en' | 'hi';

const rupees = (paise: number) => `₹${(paise / 100).toFixed(2)}`;

/** What the learner is told. Every string has English and Hindi. */
export const PRACTICE_TEXT = {
  estimateLabel: { en: 'AI practice estimate', hi: 'एआई द्वारा अभ्यास का अनुमान' },
  estimateNote: {
    en: 'This mark was suggested by AI to help you practise. No teacher has checked it.',
    hi: 'यह अंक आपके अभ्यास में मदद के लिए एआई ने सुझाया है। किसी शिक्षक ने इसे जाँचा नहीं है।',
  },
  trialEndedTime: {
    en: 'Your free trial has ended. Upgrade to keep practising.',
    hi: 'आपका निःशुल्क ट्रायल समाप्त हो गया है। अभ्यास जारी रखने के लिए अपग्रेड करें।',
  },
  trialEndedBudget: {
    en: 'You have used your free trial allowance. Upgrade to keep practising.',
    hi: 'आपने निःशुल्क ट्रायल की सीमा पूरी कर ली है। अभ्यास जारी रखने के लिए अपग्रेड करें।',
  },
  notStarted: {
    en: 'Start your free trial to practise.',
    hi: 'अभ्यास करने के लिए अपना निःशुल्क ट्रायल शुरू करें।',
  },
  attemptLimit: {
    en: 'You have started as many practice questions as the free trial allows. Upgrade to practise more.',
    hi: 'आपने निःशुल्क ट्रायल में जितने अभ्यास प्रश्न मिलते हैं, उतने शुरू कर लिए हैं। और अभ्यास के लिए अपग्रेड करें।',
  },
  retryBusy: {
    en: 'Your answer is still being processed. Please try again in a minute.',
    hi: 'आपका उत्तर अभी जाँचा जा रहा है। कृपया एक मिनट बाद फिर कोशिश करें।',
  },
  retryNotHeld: {
    en: 'This answer does not need to be written again.',
    hi: 'इस उत्तर को दोबारा लिखने की ज़रूरत नहीं है।',
  },
  retryNoKey: {
    en: 'This question has no answer key in the textbook, so it cannot be marked. Please choose another question.',
    hi: 'पाठ्यपुस्तक में इस प्रश्न की उत्तर-कुंजी नहीं मिली, इसलिए इसे अंक नहीं दिए जा सकते। कृपया कोई दूसरा प्रश्न चुनें।',
  },
  retryKeyLimit: {
    en: 'The answer key for this question could not be built. Please choose another question.',
    hi: 'इस प्रश्न की उत्तर-कुंजी नहीं बन सकी। कृपया कोई दूसरा प्रश्न चुनें।',
  },
  scopeOff: {
    en: 'That class and subject are not available yet. Choose one from the list.',
    hi: 'वह कक्षा और विषय अभी उपलब्ध नहीं हैं। सूची में से कोई चुनें।',
  },
  libraryOff: {
    en: 'Textbook questions are not available yet.',
    hi: 'पाठ्यपुस्तक के प्रश्न अभी उपलब्ध नहीं हैं।',
  },
  off: {
    en: 'Self-practice is not available yet.',
    hi: 'स्व-अभ्यास अभी उपलब्ध नहीं है।',
  },
} as const;

export function refusalText(why: 'budget' | 'time' | 'no_trial', lang: PracticeLang): string {
  return PRACTICE_TEXT[why === 'budget' ? 'trialEndedBudget' : why === 'time' ? 'trialEndedTime' : 'notStarted'][lang];
}

/** The trial's face for the screens, in the learner's language. */
export function trialSummary(t: TrialRow | null, now: Date, reservePaise: number, lang: PracticeLang) {
  const v = trialVerdict(t, now, reservePaise);
  return {
    started: t !== null,
    active: v.ok,
    daysLeft: v.ok ? v.daysLeft : 0,
    remainingRupees: Number((v.remainingPaise / 100).toFixed(2)),
    remainingText: rupees(v.remainingPaise),
    message: v.ok ? null : refusalText(v.why, lang),
  };
}

export type PracticeQuestionType = 'very_short' | 'short' | 'long';

/**
 * A textbook exercise carries no marks, so the practice question is given a shape from its length: up to 10 words is one mark, up to 25 is
 * three, longer is five. The answer key then splits those marks over the book's key points.
 */
export function questionShape(wordCount: number): { type: PracticeQuestionType; marks: number } {
  if (wordCount <= 10) return { type: 'very_short', marks: 1 };
  if (wordCount <= 25) return { type: 'short', marks: 3 };
  return { type: 'long', marks: 5 };
}
