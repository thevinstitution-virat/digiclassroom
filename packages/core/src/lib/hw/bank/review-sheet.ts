// The review sheet: ONE self-contained HTML file a teacher opens in a browser, offline. It shows every row as the learner will meet it, the marking
// points as we read them, the printed scheme beside them, and each thing a person must look at as a box to tick. It writes the verdict file
// (cbse-paper-check/1) the review command reads. It contains the board's paper text, so it is made into the ignored hw-evals/ folder, never into git.
//
// No server, no network, no libraries. Progress is kept in the browser (localStorage) so a long check can be done over several sittings.

import { REVIEW_FORMAT } from './review';

export interface SheetFigure {
  figureId: string; side: string; description: string; labels: unknown[]; readings: unknown; confidence: string; needsPersonCheck: boolean; note: string | null;
  /** The attached picture as a data: link, so the sheet stays one offline file; null when none is attached yet. */
  imageDataUri?: string | null;
}

export interface SheetRow {
  number: number; alt: string | null; variant: string | null; section: string; marks: number; qtype: string; stem: string;
  options: { letter: string; text: string }[]; correctOption: string | null; parts: unknown[]; schemeText: string;
  equations: { plain: string; latex: string }[]; diagramParts: string[]; needsCheck: string[];
  status: string; version: number; contentHash: string; checkedBy: string | null; choiceGroup: string | null; figures: SheetFigure[];
}

export interface ReviewSheetData {
  paper: { board: string; klass: number; subject: string; code: string; year: string; kind: 'sqp' | 'past_paper'; title: string; maxMarks: number; status: string; version: number };
  rows: SheetRow[];
}

/** JSON that is safe inside a <script> element: no "</script>", no comment openers. */
const safeJson = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const CSS = `
:root { --bg:#fbfaf7; --fg:#1d2433; --muted:#5b6475; --card:#fff; --line:#d9dbe3; --accent:#1f3a8a; --ok:#14663a; --okbg:#e3f4ea; --warn:#8a4b00; --warnbg:#fff1d6; --bad:#9b1c1c; --badbg:#fde4e4; }
@media (prefers-color-scheme: dark) { :root { --bg:#12151c; --fg:#e6e8ee; --muted:#9aa3b5; --card:#1a1e28; --line:#323849; --accent:#8fb0ff; --ok:#7bdca0; --okbg:#173325; --warn:#ffc46b; --warnbg:#3a2a0e; --bad:#ff9a9a; --badbg:#3a1717; } }
* { box-sizing: border-box; }
body { margin:0; background:var(--bg); color:var(--fg); font:16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
header.top { position:sticky; top:0; z-index:5; background:var(--card); border-bottom:1px solid var(--line); padding:10px 16px; }
header.top h1 { font-size:1.05rem; margin:0 0 2px; }
header.top .meta { color:var(--muted); font-size:.85rem; }
.bar { display:flex; flex-wrap:wrap; gap:10px 16px; align-items:center; margin-top:8px; }
.bar label { font-size:.85rem; color:var(--muted); }
input[type=text], textarea { font:inherit; padding:6px 8px; border:1px solid var(--line); border-radius:6px; background:var(--bg); color:var(--fg); }
textarea { width:100%; min-height:3.2em; }
button { font:inherit; padding:7px 14px; border:1px solid var(--accent); border-radius:6px; background:var(--accent); color:#fff; cursor:pointer; }
@media (prefers-color-scheme: dark) { button { color:#0b1020; } }
button.plain { background:transparent; color:var(--accent); }
main { max-width:900px; margin:0 auto; padding:12px 16px 80px; }
.row { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:12px 14px; margin:14px 0; }
.row h2 { font-size:1.02rem; margin:0 0 6px; display:flex; flex-wrap:wrap; gap:6px 10px; align-items:baseline; }
.pill { font-size:.75rem; padding:1px 8px; border-radius:99px; border:1px solid var(--line); color:var(--muted); }
.pill.checked { color:var(--ok); background:var(--okbg); border-color:transparent; }
.pill.rejected { color:var(--bad); background:var(--badbg); border-color:transparent; }
.pill.flag { color:var(--warn); background:var(--warnbg); border-color:transparent; }
h3 { font-size:.78rem; text-transform:uppercase; letter-spacing:.05em; color:var(--muted); margin:12px 0 4px; }
pre { white-space:pre-wrap; word-break:break-word; margin:0; font:inherit; }
.box { background:var(--bg); border:1px solid var(--line); border-radius:6px; padding:8px 10px; }
ul { margin:4px 0; padding-left:1.2em; }
.opt.correct { font-weight:600; color:var(--ok); }
.part { margin:6px 0; padding-left:8px; border-left:3px solid var(--line); }
.vp { margin:2px 0 2px 10px; }
.quote { color:var(--muted); font-style:italic; font-size:.88rem; }
.flags label { display:block; padding:4px 8px; margin:3px 0; background:var(--warnbg); color:var(--fg); border-radius:6px; cursor:pointer; }
.verdict { display:flex; flex-wrap:wrap; gap:6px 18px; margin:10px 0 6px; }
.verdict label { cursor:pointer; }
.msg { font-size:.85rem; color:var(--bad); min-height:1.2em; }
.done { opacity:.75; }
details summary { cursor:pointer; color:var(--accent); font-size:.9rem; }
.hint { font-size:.85rem; color:var(--muted); }
@media (max-width:600px) { header.top { padding:8px 12px; } main { padding:8px 10px 80px; } }
`;

// The page's script. Plain DOM calls, no template strings (this whole thing sits in a TypeScript string).
const SCRIPT = `
(function () {
  var data = JSON.parse(document.getElementById('sheet-data').textContent);
  var FORMAT = data.format;
  var P = data.paper;
  var KEY = 'hwbank-sheet:' + P.board + ':' + P.klass + ':' + P.code + ':' + P.year + ':' + P.kind;
  var state = { reviewer: '', rows: {} };
  try { var s = localStorage.getItem(KEY); if (s) state = JSON.parse(s); } catch (e) {}
  if (!state.rows) state.rows = {};
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }

  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') el.className = attrs[k]; else if (k === 'text') el.textContent = attrs[k]; else el.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return el;
  }
  function label(r) { return 'Q' + r.number + (r.alt || '') + (r.variant ? ' (for visually impaired students)' : ''); }
  function rowState(r) { if (!state.rows[r.contentHash]) state.rows[r.contentHash] = { v: '', c: [], n: '' }; return state.rows[r.contentHash]; }
  function canOk(r, st) { return r.needsCheck.every(function (n) { return st.c.indexOf(n) >= 0; }); }

  function figureBox(f) {
    var kids = [h('div', { text: f.figureId + ' (' + f.side + ' side, read with ' + f.confidence + ' confidence' + (f.needsPersonCheck ? ', needs a person' : '') + ')' }), h('div', { text: f.description })];
    if (f.imageDataUri) kids.push(h('img', { src: f.imageDataUri, alt: f.description, style: 'max-width:100%;max-height:360px;background:#fff;border:1px solid var(--line);border-radius:6px;margin:4px 0' }));
    else if (f.side === 'paper') kids.push(h('div', { class: 'hint', text: 'No picture is attached to this figure yet: learners will not be offered this question until one is.' }));
    if (f.labels && f.labels.length) kids.push(h('div', { class: 'hint', text: 'Labels: ' + JSON.stringify(f.labels) }));
    if (f.readings) kids.push(h('div', { class: 'hint', text: 'Readings: ' + JSON.stringify(f.readings) }));
    if (f.note) kids.push(h('div', { class: 'hint', text: 'Note: ' + f.note }));
    return h('div', { class: 'box', style: 'margin:4px 0' }, kids);
  }

  function partBox(p) {
    var head = (p.label ? 'Part ' + p.label : 'Answer') + (p.alternative ? ' (alternative ' + p.alternative + ')' : '') + ' - ' + p.marks + ' mark' + (p.marks === 1 ? '' : 's') + ' - ' + p.answer_kind;
    var kids = [h('strong', { text: head })];
    if (p.any_n_of_m) kids.push(h('div', { class: 'hint', text: 'Any ' + p.any_n_of_m.n + ' of: ' + p.any_n_of_m.of.join(' | ') }));
    if (p.marks_split_inferred) kids.push(h('div', { class: 'hint', text: 'The scheme prints the total for this part; how it divides over the points is our reading.' }));
    if (p.scheme_notes) kids.push(h('div', { class: 'hint', text: 'Scheme note: ' + p.scheme_notes }));
    (p.value_points || []).forEach(function (v) {
      kids.push(h('div', { class: 'vp' }, [
        h('div', { text: v.id + ' (' + v.marks + '): ' + v.text }),
        v.quote ? h('div', { class: 'quote', text: 'printed: ' + v.quote }) : null
      ]));
    });
    if (p.official_answer_quote) kids.push(h('div', { class: 'quote', text: 'official answer, printed: ' + p.official_answer_quote }));
    return h('div', { class: 'part' }, kids);
  }

  function rowEl(r) {
    var st = rowState(r);
    var editable = r.status === 'draft';
    var msg = h('div', { class: 'msg' });
    var sec = h('section', { class: 'row' + (editable ? '' : ' done'), id: 'r-' + r.contentHash.slice(0, 10) });
    sec.setAttribute('data-flagged', r.needsCheck.length ? '1' : '0');
    var title = h('h2', null, [
      h('span', { text: label(r) }),
      h('span', { class: 'pill', text: r.marks + ' mark' + (r.marks === 1 ? '' : 's') }),
      h('span', { class: 'pill', text: r.qtype.replace('_', ' ') + ', section ' + r.section }),
      h('span', { class: 'pill ' + (r.status === 'checked' || r.status === 'published' ? 'checked' : r.status === 'rejected' ? 'rejected' : ''), text: r.status + (r.checkedBy ? ' by ' + r.checkedBy : '') }),
      r.needsCheck.length ? h('span', { class: 'pill flag', text: r.needsCheck.length + ' to look at' }) : null
    ]);
    sec.appendChild(title);
    if (r.choiceGroup) sec.appendChild(h('div', { class: 'hint', text: 'An internal choice: students answer this alternative or the other one; the marks count once.' }));

    sec.appendChild(h('h3', { text: 'The question, as the learner sees it' }));
    sec.appendChild(h('div', { class: 'box' }, [h('pre', { text: r.stem })]));
    if (r.options.length) {
      var ul = h('ul');
      r.options.forEach(function (o) { ul.appendChild(h('li', { class: 'opt' + (o.letter === r.correctOption ? ' correct' : ''), text: o.letter + '. ' + (o.text || '(drawn in the figure)') + (o.letter === r.correctOption ? '   <- marked correct' : '') })); });
      sec.appendChild(ul);
    }
    if (r.figures.length) { sec.appendChild(h('h3', { text: 'Figures, as we read them (compare with the PDF)' })); r.figures.forEach(function (f) { sec.appendChild(figureBox(f)); }); }
    if (r.parts.length) { sec.appendChild(h('h3', { text: 'Marking points, as we read the scheme (marks: ' + r.marks + ')' })); r.parts.forEach(function (p) { sec.appendChild(partBox(p)); }); }
    if (r.diagramParts.length) sec.appendChild(h('div', { class: 'hint', text: 'The expected answer is a drawing for: ' + r.diagramParts.join(', ') + ' (not marked by the AI).' }));
    if (r.equations.length) {
      sec.appendChild(h('h3', { text: 'Equations, as written' }));
      r.equations.forEach(function (e) { sec.appendChild(h('div', { class: 'box', style: 'margin:3px 0' }, [h('div', { text: e.plain }), h('div', { class: 'hint', text: e.latex })])); });
    }
    if (r.schemeText) {
      var d = h('details', null, [h('summary', { text: 'The printed scheme for this question (as extracted)' }), h('div', { class: 'box' }, [h('pre', { text: r.schemeText })])]);
      sec.appendChild(d);
    }
    if (!editable) return sec;

    if (r.needsCheck.length) {
      sec.appendChild(h('h3', { text: 'Tick each one when you have looked at it' }));
      var fl = h('div', { class: 'flags' });
      r.needsCheck.forEach(function (n) {
        var cb = h('input', { type: 'checkbox' });
        cb.checked = st.c.indexOf(n) >= 0;
        cb.addEventListener('change', function () {
          st.c = st.c.filter(function (x) { return x !== n; }); if (cb.checked) st.c.push(n); save(); refresh();
        });
        fl.appendChild(h('label', null, [cb, ' ' + n]));
      });
      sec.appendChild(fl);
    }
    sec.appendChild(h('h3', { text: 'Your verdict' }));
    var vb = h('div', { class: 'verdict' });
    [['', 'Not yet'], ['ok', 'OK as it is'], ['fix', 'Needs a correction'], ['reject', 'Throw this one out']].forEach(function (o) {
      var rd = h('input', { type: 'radio', name: 'v-' + r.contentHash });
      rd.checked = st.v === o[0];
      rd.addEventListener('change', function () { st.v = o[0]; save(); refresh(); });
      vb.appendChild(h('label', null, [rd, ' ' + o[1]]));
    });
    sec.appendChild(vb);
    var ta = h('textarea', { placeholder: 'What is wrong, and what it should say (needed for a correction or a rejection)' });
    ta.value = st.n || '';
    ta.addEventListener('input', function () { st.n = ta.value; save(); refresh(); });
    sec.appendChild(ta);
    sec.appendChild(msg);
    sec._check = function () {
      var m = '';
      if (st.v === 'ok' && !canOk(r, st)) m = 'Tick every item above before saying OK.';
      else if ((st.v === 'fix' || st.v === 'reject') && !st.n.trim()) m = 'Say what is wrong.';
      msg.textContent = m;
      return m === '';
    };
    return sec;
  }

  var main = document.getElementById('rows');
  var els = data.rows.map(function (r) { var e = rowEl(r); main.appendChild(e); return e; });

  function refresh() {
    var draft = data.rows.filter(function (r) { return r.status === 'draft'; });
    var decided = draft.filter(function (r) { return rowState(r).v !== ''; }).length;
    var bad = 0;
    els.forEach(function (e) { if (e._check && !e._check()) bad++; });
    document.getElementById('progress').textContent = decided + ' of ' + draft.length + ' decided' + (bad ? ', ' + bad + ' need attention' : '');
    var f = document.getElementById('filter').value;
    els.forEach(function (e, i) {
      var r = data.rows[i], show = true;
      if (f === 'flagged') show = r.needsCheck.length > 0 && r.status === 'draft';
      else if (f === 'undecided') show = r.status === 'draft' && rowState(r).v === '';
      else if (f === 'draft') show = r.status === 'draft';
      e.style.display = show ? '' : 'none';
    });
  }
  var nameEl = document.getElementById('reviewer');
  nameEl.value = state.reviewer || '';
  nameEl.addEventListener('input', function () { state.reviewer = nameEl.value; save(); });
  document.getElementById('filter').addEventListener('change', refresh);
  document.getElementById('download').addEventListener('click', function () {
    var name = nameEl.value.trim();
    if (name.length < 2) { alert('Type your name first: it is recorded as the person who checked.'); nameEl.focus(); return; }
    var problems = [], verdicts = [];
    data.rows.forEach(function (r, i) {
      if (r.status !== 'draft') return;
      var st = rowState(r); if (!st.v) return;
      if (els[i]._check && !els[i]._check()) { problems.push(label(r)); return; }
      verdicts.push({ q: r.number, alt: r.alt, variant: r.variant, content_hash: r.contentHash, verdict: st.v, confirmed: st.v === 'ok' ? r.needsCheck.slice() : [], note: (st.n || '').trim() });
    });
    if (problems.length) { alert('Fix these first: ' + problems.join(', ')); return; }
    if (!verdicts.length) { alert('No verdicts yet: choose OK, correction or reject on at least one question.'); return; }
    var out = { format: FORMAT, paper: { board: P.board, klass: P.klass, code: P.code, year: P.year, kind: P.kind }, reviewer: name, verdicts: verdicts };
    var blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'verdicts-' + P.code + '-' + P.year + '.json';
    document.body.appendChild(a); a.click(); a.remove();
  });
  refresh();
})();
`;

export function renderReviewSheet(data: ReviewSheetData): string {
  const p = data.paper;
  const draft = data.rows.filter((r) => r.status === 'draft').length;
  const flagged = data.rows.filter((r) => r.status === 'draft' && r.needsCheck.length).length;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Check sheet - ${esc(p.title)}</title>
<style>${CSS}</style>
</head>
<body>
<header class="top">
  <h1>Check sheet - ${esc(p.title)}</h1>
  <div class="meta">${esc(p.board)} Class ${p.klass} ${esc(p.subject)} (${esc(p.code)}) ${esc(p.year)} - ${p.kind === 'sqp' ? 'sample paper' : 'past paper'} - ${p.maxMarks} marks - ${data.rows.length} questions to attempt, ${draft} to check, ${flagged} with something to look at - paper is ${esc(p.status)}</div>
  <div class="bar">
    <label>Your name <input id="reviewer" type="text" autocomplete="name" size="22"></label>
    <label>Show <select id="filter"><option value="draft">to check</option><option value="flagged">with something to look at</option><option value="undecided">not decided yet</option><option value="all">everything</option></select></label>
    <span id="progress" class="hint"></span>
    <button id="download" type="button">Save my verdicts (file)</button>
  </div>
</header>
<main>
  <p class="hint">Compare each question with the board's PDF paper and marking scheme. Tick every flagged item, then choose a verdict. Your choices are kept in this browser while you work.
  "Save my verdicts" makes a file; give it back to whoever runs the check command. The contents of this page are the board's paper: keep it off public sites.</p>
  <div id="rows"></div>
</main>
<script type="application/json" id="sheet-data">${safeJson({ format: REVIEW_FORMAT, paper: { board: p.board, klass: p.klass, code: p.code, year: p.year, kind: p.kind }, rows: data.rows })}</script>
<script>${SCRIPT}</script>
</body>
</html>
`;
}
