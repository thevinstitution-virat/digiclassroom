#!/usr/bin/env node
/**
 * Release and vendoring for library contract v2.
 *
 *   node scripts/vendor.mjs release            rewrite RELEASE.json from the files (source repo only)
 *   node scripts/vendor.mjs verify [dir]       check dir (default: this package) against its RELEASE.json
 *   node scripts/vendor.mjs copy <target>      verify this package, replace <target> with its release
 *                                              files, then verify the copy
 *
 * Hashes are sha256 of each file with CRLF folded to LF, so a Windows checkout hashes the same as a
 * Linux one. bundle_sha256 is the sha256 of the `<sha>  <path>\n` lines sorted by path. A vendored
 * copy is never edited by hand: change the source, release, copy.
 */
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const NAME = 'library-v2';
/** What a release carries. Build and editor files (jest.config.js, tsconfig.json) stay in the source. */
const RELEASED_DIRS = ['schema', 'src', 'fixtures', 'test', 'scripts'];
const RELEASED_FILES = ['README.md'];

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const fileSha = (path) => sha256(Buffer.from(readFileSync(path, 'utf8').replace(/\r\n/g, '\n'), 'utf8'));
const toPosix = (p) => p.split(sep).join('/');

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

function releasedFiles(root) {
  const files = RELEASED_FILES.filter((f) => existsSync(join(root, f)));
  for (const d of RELEASED_DIRS) if (existsSync(join(root, d))) files.push(...walk(join(root, d)).map((f) => toPosix(relative(root, f))));
  return files.sort();
}

export function bundleSha(files) {
  return sha256(Object.keys(files).sort().map((p) => `${files[p]}  ${p}\n`).join(''));
}

function readRelease(root) {
  const path = join(root, 'RELEASE.json');
  if (!existsSync(path)) throw new Error(`${root}: no RELEASE.json`);
  const release = JSON.parse(readFileSync(path, 'utf8'));
  if (release.name !== NAME) throw new Error(`${root}: RELEASE.json is not ${NAME}`);
  return release;
}

function verify(root) {
  const release = readRelease(root);
  const problems = [];
  const listed = Object.keys(release.files);
  for (const p of listed) {
    const full = join(root, p);
    if (!existsSync(full)) problems.push(`missing ${p}`);
    else if (fileSha(full) !== release.files[p]) problems.push(`changed ${p}`);
  }
  for (const p of releasedFiles(root)) if (!listed.includes(p)) problems.push(`not in the release: ${p}`);
  if (bundleSha(release.files) !== release.bundle_sha256) problems.push('bundle_sha256 does not match the file list');
  if (problems.length) throw new Error(`${root} does not match ${NAME} ${release.version}:\n  ${problems.join('\n  ')}`);
  return release;
}

function release() {
  const previous = existsSync(join(PKG, 'RELEASE.json')) ? readRelease(PKG) : {};
  const files = Object.fromEntries(releasedFiles(PKG).map((p) => [p, fileSha(join(PKG, p))]));
  const next = {
    name: NAME,
    version: previous.version ?? '2.0.0',
    released: previous.bundle_sha256 === bundleSha(files) ? previous.released : new Date().toISOString().slice(0, 10),
    point_id_namespace: '8fa6d651-f95a-49d8-a753-f3f06fc98958',
    collection: 'library_v2_te3l_3072',
    bundle_sha256: bundleSha(files),
    files,
  };
  writeFileSync(join(PKG, 'RELEASE.json'), JSON.stringify(next, null, 2) + '\n');
  return next;
}

function copy(target) {
  const release = verify(PKG);
  const dest = resolve(target);
  if (dest === PKG) throw new Error('target is the source package');
  if (existsSync(dest)) {
    const entries = readdirSync(dest);
    if (entries.length && !entries.includes('RELEASE.json')) throw new Error(`${dest} is not empty and holds no ${NAME} release; refusing to replace it`);
    if (entries.length) readRelease(dest);
    rmSync(dest, { recursive: true, force: true });
  }
  mkdirSync(dest, { recursive: true });
  for (const p of [...Object.keys(release.files), 'RELEASE.json']) {
    mkdirSync(dirname(join(dest, p)), { recursive: true });
    cpSync(join(PKG, p), join(dest, p));
  }
  return verify(dest);
}

const [cmd, arg] = process.argv.slice(2);
try {
  if (cmd === 'release') {
    const r = release();
    console.log(`${NAME} ${r.version}: ${Object.keys(r.files).length} files, bundle ${r.bundle_sha256}`);
  } else if (cmd === 'verify') {
    const r = verify(resolve(arg ?? PKG));
    console.log(`OK ${NAME} ${r.version} bundle ${r.bundle_sha256}`);
  } else if (cmd === 'copy' && arg) {
    const r = copy(arg);
    console.log(`Vendored ${NAME} ${r.version} into ${resolve(arg)} (bundle ${r.bundle_sha256})`);
  } else {
    console.error('usage: vendor.mjs release | verify [dir] | copy <target>');
    process.exit(2);
  }
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
