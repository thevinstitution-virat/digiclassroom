// "AI never finalises a mark": only services/marking.ts (teacher actions) may write hw_grade.
// This scans the feature's source for any write to the final-grade table.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const HW_ROOT = join(__dirname, '../../../../../packages/core/src/lib/hw');
const ALLOWED = ['services/marking.ts'];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') ? [p] : [];
  });
}

const WRITES = [
  /\.(insert|update|delete)\(\s*hwGrade\s*\)/,
  /\b(INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+hw_grade\b(?!_)/i,
];

describe('final grades are written only by teacher actions', () => {
  const all = files(HW_ROOT);

  it('finds the feature source', () => {
    expect(all.length).toBeGreaterThan(10);
  });

  it('no file other than services/marking.ts writes hw_grade', () => {
    const offenders = all
      .map((f) => ({ f: relative(HW_ROOT, f).split(sep).join('/'), src: readFileSync(f, 'utf8') }))
      .filter(({ f, src }) => !ALLOWED.includes(f) && WRITES.some((re) => re.test(src)))
      .map(({ f }) => f);
    expect(offenders).toEqual([]);
  });

  it('the AI paths do not import the marking module', () => {
    const aiPaths = all.filter((f) => /[\\/](jobs|grader|reader|gemini)[\\/]/.test(f) || f.endsWith('pipeline.ts'));
    const importers = aiPaths.filter((f) => /from ['"](\.\.?\/)+services\/marking['"]/.test(readFileSync(f, 'utf8')));
    expect(importers).toEqual([]);
  });

  it('marking.ts does write hw_grade (the scan would catch a real write)', () => {
    const src = readFileSync(join(HW_ROOT, 'services/marking.ts'), 'utf8');
    expect(WRITES.some((re) => re.test(src))).toBe(true);
  });
});
