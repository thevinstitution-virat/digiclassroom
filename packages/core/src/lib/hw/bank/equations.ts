// Equations in the board-paper bank (phase 5). Pure.
//
// A bank equation is written twice: `plain` (what a learner types or a reader returns) and `latex` (what a screen shows). Two checks live here:
//
//   1. The bank's own pair says the same thing. Both forms are flattened to one canonical string and compared; a pair that differs (a condition in one
//      and not the other, a missing term) is a mistake in the bank, found when the file is imported, not by a learner.
//   2. A read-back from handwriting. A reader may return "CO₂" for "CO2", "→" for "->", "I²" for "I^2": that is the same equation, not a misread one. The
//      comparison says exact, equivalent (the same after folding what is only a way of writing) or different, and never folds anything that changes
//      the chemistry or the physics: case, coefficients, digits, signs and the order of terms all stay.
//
// What is folded, and only this: subscript and superscript forms, arrow forms, minus-sign forms, spacing, the multiplication sign (a product is written
// with a sign, with a space or with nothing), the degree sign, and Greek letters written as their names.

import { levenshtein } from '../eval/reading';

const SUPER: Record<string, string> = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁺': '+', '⁻': '-' };
const SUB: Record<string, string> = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9', '₊': '+', '₋': '-' };
const GREEK: Record<string, string> = {
  α: 'alpha', β: 'beta', γ: 'gamma', δ: 'delta', θ: 'theta', λ: 'lambda', μ: 'mu', π: 'pi', ρ: 'rho', σ: 'sigma', ω: 'omega',
  Δ: 'Delta', Σ: 'Sigma', Ω: 'Omega',
};

/** Arrow forms to one: a plain arrow with an optional condition above it, `->[condition]`. */
function arrows(s: string): string {
  return s
    .replace(/[⇌↔⇄]/g, '<->')
    .replace(/(?:--+|—+|─+|-)\s*\(\s*([^()]*?(?:\([^()]*\)[^()]*?)*)\s*\)\s*(?:--+|—+|─+|-)*\s*(?:>|→|⟶)/g, (_m, c: string) => `->[${c.trim()}]`)
    .replace(/(?:--+|==+|—+|─+)\s*>|=>|[→⟶⇒➔➜]/g, '->');
}

/** The multiplication sign in any of its writings is nothing: a product is VxI, V I or VI. */
function product(s: string): string {
  return s.replace(/(\S)\s+[x×*·∙⋅]\s+(\S)/g, '$1$2').replace(/[×·∙⋅]/g, '');
}

/** The canonical form of the part of the bank's `plain` writing that LaTeX can also say. */
export function flattenPlain(s: string): string {
  return product(arrows(s.normalize('NFC'))).replace(/\s+/g, '');
}

/** LaTeX to the same canonical form. Only the commands equations in school papers use; any other command keeps its name. */
export function flattenLatex(s: string): string {
  let t = s.normalize('NFC');
  t = t.replace(/\\xrightarrow\s*\{([^{}]*)\}/g, (_m, c: string) => `->[${c}]`);
  // \frac{a}{b} -> a/b, innermost first (a fraction inside a fraction).
  for (let i = 0; i < 5 && /\\frac\s*\{[^{}]*\}\s*\{[^{}]*\}/.test(t); i++) t = t.replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '$1/$2');
  t = t.replace(/\\(?:rightarrow|longrightarrow|to)\b/g, '->').replace(/\\(?:rightleftharpoons|leftrightarrow)\b/g, '<->')
    .replace(/\\propto\b/g, '~').replace(/\\(?:times|cdot)\b/g, '').replace(/\^\s*\{?\\circ\}?/g, '').replace(/\\circ\b/g, '')
    .replace(/\\[ ,;:!]/g, ' ').replace(/\\([A-Za-z]+)/g, '$1');
  t = t.replace(/_\s*\{([^{}]*)\}/g, '$1').replace(/_\s*([A-Za-z0-9])/g, '$1').replace(/\^\s*\{([^{}]*)\}/g, '^$1').replace(/\^\s*([A-Za-z0-9+-])/g, '^$1');
  return t.replace(/[{}]/g, '').replace(/\s+/g, '');
}

export interface BankEquation { plain: string; latex: string }

/** Why a bank equation's two writings differ, or null when they say the same thing. */
export function equationDisagreement(e: BankEquation): string | null {
  const p = flattenPlain(e.plain);
  const l = flattenLatex(e.latex);
  return p === l ? null : `the plain form reads "${p}" and the LaTeX form reads "${l}"`;
}

/** Problems with a question's equations, for the importer: an equation whose two writings differ, or that is empty. */
export function equationProblems(label: string, equations: readonly BankEquation[]): string[] {
  const out: string[] = [];
  equations.forEach((e, i) => {
    if (!e.plain.trim() || !e.latex.trim()) { out.push(`${label}: equation ${i + 1} has an empty plain or LaTeX form`); return; }
    const why = equationDisagreement(e);
    if (why) out.push(`${label}: equation ${i + 1} (${e.plain}): ${why}`);
  });
  return out;
}

/** What a reading may differ in and still be the same equation. */
export function foldReading(s: string): string {
  let t = s.normalize('NFC');
  t = t.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]+/g, (m) => `^${[...m].map((c) => SUPER[c]).join('')}`);
  t = t.replace(/[₀₁₂₃₄₅₆₇₈₉₊₋]/g, (c) => SUB[c]);
  t = t.replace(/[−–—‑]/g, '-').replace(/[°º]/g, '').replace(/[αβγδθλμπρσωΔΣΩ]/g, (c) => GREEK[c]);
  return product(arrows(t)).replace(/\s+/g, '');
}

export type EquationMatch = 'exact' | 'equivalent' | 'different';

export function compareEquation(truth: string, read: string): EquationMatch {
  if (truth.normalize('NFC').trim() === read.normalize('NFC').trim()) return 'exact';
  return foldReading(truth) === foldReading(read) ? 'equivalent' : 'different';
}

export interface EquationReadingSummary {
  n: number;
  exact: number;
  equivalent: number;
  different: number;
  /** (exact + equivalent) / n; null with no items. */
  rate: number | null;
  /** The equations read wrongly, with what was read and how far off (edit distance over the folded forms, as a share of the truth's length). */
  misses: { truth: string; read: string; distance: number }[];
}

export function summariseEquationReading(pairs: readonly { truth: string; read: string }[]): EquationReadingSummary {
  const out: EquationReadingSummary = { n: pairs.length, exact: 0, equivalent: 0, different: 0, rate: null, misses: [] };
  for (const p of pairs) {
    const m = compareEquation(p.truth, p.read);
    out[m] += 1;
    if (m === 'different') {
      const a = [...foldReading(p.truth)];
      const b = [...foldReading(p.read)];
      out.misses.push({ truth: p.truth, read: p.read, distance: a.length ? Number((levenshtein(a, b) / a.length).toFixed(3)) : 1 });
    }
  }
  out.rate = pairs.length ? Number(((out.exact + out.equivalent) / pairs.length).toFixed(4)) : null;
  return out;
}
