// "Any N of M" in a marking scheme ("any two of: blood pressure, salivation, vomiting") becomes N slots for marking: a model marking one point that
// lists all M would either expect all of them or give marks for fewer than N. N slots, each worth the same, each "one of these", cannot.
// Pure: which value point holds the list, and whether its marks share out in half marks.

import { normForQuote } from './norm';

export interface AnyNPart {
  label: string;
  value_points: { id: string; text: string; marks: number }[];
  any_n_of_m?: { n: number; of: string[] } | null;
}

export type AnyNPlan =
  | { ok: true; /** index into value_points of the point that holds the list */ pointIndex: number; slots: number; each: number; of: string[] }
  | { ok: false; problem: string };

const onHalfGrid = (x: number) => x > 0 && Math.abs(x * 2 - Math.round(x * 2)) < 1e-9;

/** null for a part that is not "any N of M". Otherwise which point to split, or why it cannot be (never a guess). */
export function planAnyN(part: AnyNPart): AnyNPlan | null {
  const a = part.any_n_of_m;
  if (!a) return null;
  const vps = part.value_points;
  let idx: number;
  if (vps.length === 1) idx = 0;
  else {
    const counts = vps.map((v) => a.of.filter((item) => normForQuote(item) && normForQuote(v.text).includes(normForQuote(item))).length);
    const best = Math.max(...counts);
    if (best === 0) return { ok: false, problem: 'asks for any N of M, but no value point lists the choices, so it cannot tell which one to split' };
    if (counts.filter((c) => c === best).length > 1) return { ok: false, problem: 'asks for any N of M, but more than one value point lists the choices, so it cannot tell which one to split' };
    idx = counts.indexOf(best);
  }
  const each = vps[idx].marks / a.n;
  if (!onHalfGrid(each)) return { ok: false, problem: `any ${a.n} of ${a.of.length}: the point's ${vps[idx].marks} marks cannot be shared over ${a.n} slots in half marks` };
  return { ok: true, pointIndex: idx, slots: a.n, each, of: a.of };
}
