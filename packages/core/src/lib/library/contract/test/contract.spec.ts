import { createHash } from 'crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { dirname, join, relative, sep } from 'path';
import {
  ANSWER_ID_RE, BLOCK_ID_RE, BLOCK_ID_SRC, GOLDEN_ID_RE, INTEGER_INDEX_FIELDS, KEYWORD_INDEX_FIELDS, PASSAGE_ID_RE, PASSAGE_ID_SRC,
  PASSAGE_KINDS, PASSAGE_STATUSES, POINT_ID_NAMESPACE, PROSE_ID_SRC, RETRIEVAL_CLASSES, SECTION_ID_RE, SECTION_NO_SRC,
  SUMMARY_ID_SRC, UUID_SRC, VISIBILITIES, libraryPayloadV2Fields, libraryPayloadV2Schema, parseLibraryPayloadV2,
  parsePassageId, passageContentSha, pointIdFor, previewPointIdFor, proseIdFor, sectionIdFor, sectionKeyFor, splitPartId,
  summaryIdFor, uuid5,
} from '../src';
import type { PassageContent } from '../src';

/**
 * The library v2 contract test. It runs in the source package (contracts/library-v2) and, byte for
 * byte, in every repo that vendors the package, so a vendored copy proves itself where it is used.
 */
const ROOT = join(__dirname, '..');
const fixture = (name: string) => JSON.parse(readFileSync(join(ROOT, 'fixtures', name), 'utf8'));
const schema = JSON.parse(readFileSync(join(ROOT, 'schema', 'payload.schema.json'), 'utf8'));
const ids = fixture('passage-ids.json');
const points = fixture('point-ids.json');
const payloads = fixture('payloads.json');
/** Every id make_index.py listed for a real chapter: the grammar must accept what the skill writes. */
const skill = fixture('skill-ch01-ids.json');

/** Ajv 8 (JSON Schema draft-07 with if/then), from wherever the host repo has it. */
function loadAjv(): any | null {
  const tries: (() => string)[] = [
    () => require.resolve('ajv/package.json'),
    () => require.resolve('ajv/package.json', { paths: [dirname(require.resolve('ajv-formats/package.json'))] }),
  ];
  for (const t of tries) {
    try {
      const pkgPath = t();
      if (Number(JSON.parse(readFileSync(pkgPath, 'utf8')).version.split('.')[0]) < 8) continue;
      const mod = require(dirname(pkgPath));
      return mod.default ?? mod;
    } catch {
      // try the next place
    }
  }
  return null;
}

function variant(c: { base: number; set?: Record<string, unknown>; unset?: string[] }) {
  const p: Record<string, unknown> = { ...payloads.valid[c.base].payload, ...(c.set ?? {}) };
  for (const k of c.unset ?? []) delete p[k];
  return p;
}

describe('passage-id grammar', () => {
  it.each((ids.valid as any[]).map((v: any): [string, any] => [v.id, v]))('accepts %s', (id: string, v: any) => {
    expect(PASSAGE_ID_RE.test(id)).toBe(true);
    const parsed: any = parsePassageId(id);
    expect(parsed).not.toBeNull();
    expect(parsed.kind).toBe(v.kind);
    for (const key of ['blockKind', 'number', 'page', 'box', 'ordinal', 'mark', 'section', 'sectionKey', 'k', 'n'])
      if (key in v) expect(parsed[key]).toEqual(v[key]);
    if (v.kind === 'block') {
      expect(parsed.part).toEqual(v.part ?? null);
      expect(parsed.blockId).toBe(v.blockId ?? id);
    }
  });

  it.each((ids.invalid as any[]).map((v: any): [string, string] => [v.id, v.why]))('rejects %j (%s)', (id: string) => {
    expect(PASSAGE_ID_RE.test(id)).toBe(false);
    expect(parsePassageId(id)).toBeNull();
  });

  it('parses chapter and book code', () => {
    expect(parsePassageId('vigyan-ix-hi:07:sec:7.2:3')).toEqual({
      kind: 'prose', bookCode: 'vigyan-ix-hi', chapter: 7, section: '7.2', sectionKey: '7.2', k: 3,
    });
  });

  it('accepts every id the textbook-prep skill wrote for a real chapter (Science IX ch01)', () => {
    for (const id of skill.blocks) {
      const parsed = parsePassageId(id);
      expect([id, parsed?.kind]).toEqual([id, 'block']);
      expect(BLOCK_ID_RE.test(id)).toBe(true);
    }
    for (const p of skill.prose) {
      const parsed: any = parsePassageId(p.id);
      expect([p.id, parsed?.kind]).toEqual([p.id, 'prose']);
      // make_index.py's `section` is the number of a numbered section and the title of an unnumbered one.
      const numbered = /^[0-9]+(?:\.[0-9]+)*$/.test(p.section);
      expect(parsed.section).toBe(numbered ? p.section : null);
      expect(parsed.sectionKey).toBe(sectionKeyFor(numbered ? p.section : null, numbered ? null : p.section));
    }
    for (const id of skill.summary) expect(parsePassageId(id)?.kind).toBe('summary');
  });

  it('recognises the related ids, which are never passage ids', () => {
    for (const id of ids.related.section) expect([SECTION_ID_RE.test(id), PASSAGE_ID_RE.test(id)]).toEqual([true, false]);
    for (const id of ids.related.golden) expect([GOLDEN_ID_RE.test(id), PASSAGE_ID_RE.test(id)]).toEqual([true, false]);
    for (const id of ids.related.answer) expect([ANSWER_ID_RE.test(id), PASSAGE_ID_RE.test(id)]).toEqual([true, false]);
    for (const id of ids.related.not_answer) expect(ANSWER_ID_RE.test(id)).toBe(false);
  });

  it('formats prose, section, summary and part ids that parse back', () => {
    expect(proseIdFor('sci9-en', 7, '7.2', 3)).toBe('sci9-en:07:sec:7.2:3');
    expect(proseIdFor('sci9-en', 1, 'chapter-opening', 1)).toBe('sci9-en:01:sec:chapter-opening:1');
    expect(sectionIdFor('sci9-en', 7, '7.2')).toBe('sci9-en:07:sec:7.2');
    expect(sectionIdFor('sci9-en', 1, 'what-you-have-learnt')).toBe('sci9-en:01:sec:what-you-have-learnt');
    expect(sectionKeyFor('7.2', null)).toBe('7.2');
    expect(sectionKeyFor(null, 'What you have learnt')).toBe('what-you-have-learnt');
    expect(sectionKeyFor(null, '  Chapter opening (continued)!')).toBe('chapter-opening-continued');
    expect(sectionKeyFor(null, null)).toBe('untitled');
    expect(() => proseIdFor('sci9-en', 7, 'Intro', 1)).toThrow();
    expect(() => sectionKeyFor('7..2', null)).toThrow();
    expect(summaryIdFor('sci9-en', 12, 4)).toBe('sci9-en:12:summary:4');
    expect(splitPartId('sci9-en:07:example:7.2', 2)).toBe('sci9-en:07:example:7.2#2');
    expect(() => splitPartId('sci9-en:07:example:7.2#1', 2)).toThrow();
    expect(() => splitPartId('sci9-en:07:sec:7.2:1', 2)).toThrow();
    expect(() => proseIdFor('sci9-en', 7, '7.2', 0)).toThrow();
    expect(() => proseIdFor('SCI9', 7, '7.2', 1)).toThrow();
    expect(() => summaryIdFor('sci9-en', 7, 0)).toThrow();
  });
});

describe('point ids', () => {
  it('uses the recorded namespace', () => {
    expect(POINT_ID_NAMESPACE).toBe(points.namespace);
  });

  it.each((points.live as any[]).map((p: any): [string, any] => [p.passage_id, p]))('pointIdFor(%s) matches the reference uuid5', (_id: string, p: any) => {
    expect(pointIdFor(p.work_id, p.passage_id)).toBe(p.point_id);
  });

  it('gives preview points their own id per revision', () => {
    for (const p of points.preview) {
      expect(previewPointIdFor(p.work_id, p.passage_id, p.revision_id)).toBe(p.point_id);
      expect(p.point_id).not.toBe(pointIdFor(p.work_id, p.passage_id));
    }
  });

  it('is a well-formed version-5 uuid and matches RFC 4122 test vector', () => {
    // RFC 4122 appendix (errata 1352): uuid5(DNS namespace, "www.example.com").
    expect(uuid5('www.example.com', '6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe('2ed6657d-e927-568b-95e1-2665a8aea6a2');
    expect(pointIdFor(points.live[0].work_id, 'sci9-en:01:sec:1.1:1')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('refuses ids it cannot vouch for', () => {
    expect(() => pointIdFor('0B6F3C1E-5D2A-4F7E-9A41-3C2D1E0F9A87', 'sci9-en:07:example:7.2')).toThrow();
    expect(() => pointIdFor(points.live[0].work_id, 'sci9-en:07:golden:1')).toThrow();
    expect(() => previewPointIdFor(points.live[0].work_id, 'sci9-en:07:example:7.2', 'rev-1')).toThrow();
  });
});

describe('payload', () => {
  const Ajv = loadAjv();
  const validate = Ajv ? new Ajv({ allErrors: true, allowUnionTypes: true, strict: true }).compile(schema) : null;
  if (!validate) console.warn('Ajv 8 not found in this repo: JSON Schema checks skipped, zod checks still run.');

  it.each((payloads.valid as any[]).map((v: any): [string, unknown] => [v.name, v.payload]))('accepts %s', (_name: string, payload: unknown) => {
    expect(() => parseLibraryPayloadV2(payload)).not.toThrow();
    if (validate) expect(validate(payload) ? null : validate.errors).toBeNull();
  });

  it.each((payloads.invalid_schema as any[]).map((v: any): [string, any] => [v.name, v]))('rejects %s (zod and JSON Schema)', (_name: string, v: any) => {
    const p = variant(v);
    expect(libraryPayloadV2Schema.safeParse(p).success).toBe(false);
    if (validate) expect(validate(p)).toBe(false);
  });

  it.each((payloads.invalid_rules as any[]).map((v: any): [string, any] => [v.name, v]))('rejects %s (zod cross-field rule)', (_name: string, v: any) => {
    expect(libraryPayloadV2Schema.safeParse(variant(v)).success).toBe(false);
  });

  it('JSON Schema and zod describe the same fields', () => {
    const zodKeys = Object.keys(libraryPayloadV2Fields.shape).sort();
    expect(Object.keys(schema.properties).sort()).toEqual(zodKeys);
    expect([...schema.required].sort()).toEqual(zodKeys);
    expect(schema.additionalProperties).toBe(false);
    expect(schema.properties.kind.enum).toEqual([...PASSAGE_KINDS]);
    expect(schema.properties.retrieval_class.enum).toEqual([...RETRIEVAL_CLASSES]);
    expect(schema.properties.status.enum).toEqual([...PASSAGE_STATUSES]);
    expect(schema.properties.visibility.enum).toEqual([...VISIBILITIES]);
    expect(schema.properties.passage_id.pattern).toBe(`^${PASSAGE_ID_SRC}$`);
    expect(schema.properties.section_no.pattern).toBe(`^${SECTION_NO_SRC}$`);
    expect(schema.properties.work_id.pattern).toBe(`^${UUID_SRC}$`);
    expect(schema.properties.revision_id.pattern).toBe(`^${UUID_SRC}$`);
    const byKind = Object.fromEntries(schema.allOf.map((r: any) => [r.if.properties.kind.const, r.then.properties.passage_id.pattern]));
    expect(byKind).toEqual({ prose: `^${PROSE_ID_SRC}$`, block: `^${BLOCK_ID_SRC}$`, summary: `^${SUMMARY_ID_SRC}$` });
  });

  it('carries no board, class or domain, and indexes only real fields', () => {
    const fields = Object.keys(schema.properties);
    for (const banned of ['board', 'class', 'classLevel', 'class_level', 'domain', 'subject', 'grade'])
      expect(fields).not.toContain(banned);
    for (const f of [...KEYWORD_INDEX_FIELDS, ...INTEGER_INDEX_FIELDS]) expect(fields).toContain(f);
  });
});

describe('content sha', () => {
  const base: PassageContent = {
    kind: 'prose', block_type: null, label: null, section_no: '7.2', section_title: 'Measuring the Rate of Motion',
    page_start: 75, page_end: 76, retrieval_class: 'reference', parent_id: 'sci9-en:07:sec:7.2', chunk_order: 12,
    text: 'The speed of an object is the distance travelled per unit time.', authored_text: null,
  };

  it('is stable, field-order independent and NFC-normalised', () => {
    const sha = passageContentSha(base);
    expect(sha).toMatch(/^[0-9a-f]{64}$/);
    const reordered = Object.fromEntries(Object.entries(base).reverse()) as unknown as PassageContent;
    expect(passageContentSha(reordered)).toBe(sha);
    const nfc = { ...base, text: 'café' };
    const nfd = { ...base, text: 'café' };
    expect(passageContentSha(nfd)).toBe(passageContentSha(nfc));
  });

  it('changes when anything that is embedded or shown changes', () => {
    const sha = passageContentSha(base);
    expect(passageContentSha({ ...base, text: base.text + ' ' })).not.toBe(sha);
    expect(passageContentSha({ ...base, page_start: 74 })).not.toBe(sha);
    expect(passageContentSha({ ...base, authored_text: 'Diagram [provenance: authored]: a car' })).not.toBe(sha);
    expect(() => passageContentSha({ ...base, label: undefined } as any)).toThrow();
  });
});

describe('release', () => {
  const release = JSON.parse(readFileSync(join(ROOT, 'RELEASE.json'), 'utf8'));
  const sha = (p: string) => createHash('sha256').update(readFileSync(p, 'utf8').replace(/\r\n/g, '\n'), 'utf8').digest('hex');

  it('records the namespace and collection', () => {
    expect(release.name).toBe('library-v2');
    expect(release.point_id_namespace).toBe(POINT_ID_NAMESPACE);
    expect(release.collection).toBe('library_v2_te3l_3072');
  });

  it('every released file matches its hash (a vendored copy was not edited)', () => {
    for (const [p, h] of Object.entries<string>(release.files)) {
      expect(existsSync(join(ROOT, p))).toBe(true);
      expect([p, sha(join(ROOT, p))]).toEqual([p, h]);
    }
    const lines = Object.keys(release.files).sort().map((p) => `${release.files[p]}  ${p}\n`).join('');
    expect(createHash('sha256').update(lines).digest('hex')).toBe(release.bundle_sha256);
  });

  it('has no file outside the release', () => {
    const walk = (d: string): string[] =>
      readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));
    const present = ['schema', 'src', 'fixtures', 'test', 'scripts']
      .filter((d) => existsSync(join(ROOT, d)))
      .flatMap((d) => walk(join(ROOT, d)))
      .map((f) => relative(ROOT, f).split(sep).join('/'));
    for (const p of present) expect(Object.keys(release.files)).toContain(p);
  });
});
