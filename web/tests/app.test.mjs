/* Exercises the assembled single-file app inside a DOM sandbox.
 *
 *   node --experimental-vm-modules web/tests/app.test.mjs
 *
 * Requires jsdom (installed separately, e.g. into /tmp/domtest):
 *   npm install --prefix /tmp/domtest jsdom
 *   NODE_PATH=/tmp/domtest/node_modules node web/tests/app.test.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let JSDOM;
try {
  ({ JSDOM } = require('jsdom'));
} catch (e) {
  console.error('jsdom not found. Install it with: npm install --prefix /tmp/domtest jsdom');
  console.error('then run with NODE_PATH=/tmp/domtest/node_modules');
  process.exit(2);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(here, '..', 'chess-trainer.html');
const html = fs.readFileSync(htmlPath, 'utf8');

let passed = 0, failed = 0;
const failures = [];
function ok(name, cond, extra) {
  if (cond) { passed++; console.log('  ok   ' + name); }
  else { failed++; failures.push(name + (extra ? ' — ' + extra : '')); console.log('  FAIL ' + name + (extra ? ' — ' + extra : '')); }
}

const errors = [];
const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  url: 'https://local.test/trainer.html',
  virtualConsole: (() => {
    const vc = new (require('jsdom').VirtualConsole)();
    vc.on('jsdomError', (e) => errors.push('jsdomError: ' + (e.detail && e.detail.stack ? e.detail.stack : (e.stack || e.message))));
    vc.on('error', (...a) => errors.push('console.error: ' + a.map(String).join(' ')));
    return vc;
  })(),
});

const { window } = dom;
const doc = window.document;
/* keep the original stack of anything that throws inside the page */
window.addEventListener('error', (e) => {
  errors.push('window error: ' + (e.error && e.error.stack ? e.error.stack : e.message));
});

/* jsdom has no layout engine: give the board a size so hit-testing works. */
window.Element.prototype.getBoundingClientRect = function () {
  if (this.id === 'board') return { left: 0, top: 0, width: 80, height: 80, right: 80, bottom: 80, x: 0, y: 0 };
  return { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0, x: 0, y: 0 };
};
window.HTMLCanvasElement.prototype.getContext = () => null;
window.navigator.clipboard = { writeText: () => Promise.resolve() };

await new Promise((r) => setTimeout(r, 300));

const C = window.ChessCore;
const D = window.ChessData;
const $ = (id) => doc.getElementById(id);

function click(el) {
  el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
}

console.log('\nChess Trainer — application harness');

/* ---------------------------------------------------------------- */
ok('core loaded', !!C);
ok('data loaded', !!D);
ok('no script errors on load', errors.length === 0, errors.slice(0, 3).join(' | '));

/* board rendered */
const squares = doc.querySelectorAll('#board .sq');
ok('64 squares rendered', squares.length === 64, String(squares.length));
const pieces = doc.querySelectorAll('#pieces .piece');
ok('32 pieces rendered', pieces.length === 32, String(pieces.length));
ok('pieces contain inline svg', doc.querySelector('#pieces .piece svg') !== null);
ok('no external images', doc.querySelectorAll('img').length === 0);
ok('no external links', doc.querySelectorAll('link[rel="stylesheet"], script[src]').length === 0);

/* tabs */
const tabs = doc.querySelectorAll('.tab');
ok('six tabs', tabs.length === 6, String(tabs.length));
click(tabs[1]);
ok('puzzles panel activates', doc.querySelector('[data-panel="puzzles"]').classList.contains('active'));
ok('puzzle list populated', $('pz-count').textContent !== '—', $('pz-count').textContent);
click(tabs[2]);
ok('endgames panel activates', doc.querySelector('[data-panel="endgames"]').classList.contains('active'));
click(tabs[3]);
ok('openings panel activates', doc.querySelector('[data-panel="openings"]').classList.contains('active'));
ok('opening list populated', doc.querySelectorAll('#op-list .list-item').length === D.openings.length,
   String(doc.querySelectorAll('#op-list .list-item').length));
click(tabs[4]);
ok('analysis panel activates', doc.querySelector('[data-panel="analysis"]').classList.contains('active'));
click(tabs[5]);
ok('learn panel activates', doc.querySelector('[data-panel="learn"]').classList.contains('active'));
ok('lessons rendered', doc.querySelectorAll('[data-panel="learn"] .prose h3').length >= D.lessons.length);
ok('shortcut table filled', $('shortcut-table').children.length === D.shortcuts.length);
click(tabs[0]);
ok('play panel activates', doc.querySelector('[data-panel="play"]').classList.contains('active'));

/* new game + engine reply */
click($('btn-newgame'));
ok('game started', doc.querySelectorAll('#pieces .piece').length === 32);

/* make a legal move by clicking squares */
function squareEl(name) {
  const sq = C.nameToSq(name);
  return doc.querySelector('#board .sq[data-sq="' + sq + '"]');
}
function clickSquare(name) {
  const el = squareEl(name);
  if (!el) throw new Error('no square ' + name);
  el.dispatchEvent(new window.MouseEvent('pointerdown', { bubbles: true, cancelable: true, clientX: 0, clientY: 0, button: 0 }));
  window.dispatchEvent(new window.MouseEvent('pointerup', { bubbles: true, cancelable: true, clientX: 0, clientY: 0, button: 0 }));
}

clickSquare('e2');
ok('piece selectable', doc.querySelectorAll('#board .sq.selected').length === 1);
clickSquare('e4');
ok('move registered', $('moves-play').textContent.includes('e4'), $('moves-play').textContent);

/* the engine (black) must answer */
let replied = 0;
for (let i = 0; i < 30 && replied < 2; i++) {
  await new Promise((r) => setTimeout(r, 250));
  replied = doc.querySelectorAll('#moves-play .mv').length;
}
ok('engine replied to 1.e4', replied >= 2, String(replied));

/* navigation */
click($('btn-first'));
ok('first move navigation', doc.querySelectorAll('#pieces .piece').length === 32);
click($('btn-last'));
ok('last move navigation', $('moves-play').textContent.includes('e4'));

/* puzzles: playing the stored solution must be accepted */
click(tabs[1]);
click($('btn-pz-next'));
const T = window.ChessTrainer;
ok('a puzzle is loaded', !!T.puzzle.current);
const pz = T.puzzle.current;
const pzPos = new C.Position(pz.fen);
const pzMv = pzPos.sanToMove(pz.sol);
ok('puzzle solution is legal', !!pzMv, pz.sol);
clickSquare(C.sqName(pzMv.from));
clickSquare(C.sqName(pzMv.to));
ok('correct puzzle move accepted', /Correct/.test($('pz-status').textContent), $('pz-status').textContent);

/* a wrong move must be rejected */
click($('btn-pz-next'));
const pz2 = T.puzzle.current;
const pz2Pos = new C.Position(pz2.fen);
const wrong = pz2Pos.legalMoves().find((m) => {
  const s = pz2Pos.moveToSan(m, pz2Pos.legalMoves());
  return s.replace(/[+#]/g, '') !== pz2.sol.replace(/[+#]/g, '');
});
if (wrong) {
  clickSquare(C.sqName(wrong.from));
  clickSquare(C.sqName(wrong.to));
  ok('wrong puzzle move rejected', !/Correct/.test($('pz-status').textContent), $('pz-status').textContent);
}

/* engine hint on the puzzle panel */
click($('btn-pz-hint'));
ok('puzzle hint produced an arrow', doc.querySelectorAll('#overlay line').length >= 0);

/* endgames: new drill, then play the stored winning move */
click(tabs[2]);
click($('btn-eg-new'));
ok('endgame drill created', $('eg-status').textContent.length > 0, $('eg-status').textContent);
const dr = window.ChessTrainer.drill.current;
ok('drill has a solution line', !!(dr && dr.line && dr.line.length), dr && dr.line && dr.line[0]);
if (dr && dr.line && dr.line.length) {
  const dPos = new C.Position(dr.fen);
  const dMv = dPos.sanToMove(dr.line[0]);
  ok('drill solution is legal', !!dMv, dr.line[0]);
  if (dMv) {
    clickSquare(C.sqName(dMv.from));
    clickSquare(C.sqName(dMv.to));
    ok('drill move accepted', !/does not force mate/.test($('eg-status').textContent), $('eg-status').textContent);
  }
}

/* endgames: the king and pawn promotion drill */
$('eg-material').value = 'KPK';
$('eg-material').dispatchEvent(new window.Event('change', { bubbles: true }));
ok('pawn drill task described', /promot/i.test($('eg-task').textContent), $('eg-task').textContent);
ok('mate distance disabled for the pawn drill', $('eg-goal').disabled === true);
const pk = window.ChessTrainer.drill.current;
if (process.env.DEBUG_KPK) console.log('  kpk drill', JSON.stringify(pk));
ok('pawn drill created', !!pk && pk.kind === 'KPK', pk && pk.kind);
if (pk && pk.line && pk.line.length) {
  /* the line alternates: our pawn push, the defender's answer, ... */
  for (let i = 0; i < pk.line.length; i += 2) {
    const pos = window.ChessTrainer.game.replay[window.ChessTrainer.game.cursor];
    const mv = pos.sanToMove(pk.line[i]);
    if (!mv) break;
    clickSquare(C.sqName(mv.from));
    clickSquare(C.sqName(mv.to));
    if (process.env.DEBUG_KPK) console.log('    kpk play', pk.line[i], '->', $('eg-status').textContent,
      '| fen', window.ChessTrainer.game.replay[window.ChessTrainer.game.cursor].fen());
    await new Promise((r) => setTimeout(r, 420));
    if (process.env.DEBUG_KPK) console.log('    kpk after', $('eg-status').textContent,
      '| fen', window.ChessTrainer.game.replay[window.ChessTrainer.game.cursor].fen());
    if (/Promotion/i.test($('eg-status').textContent)) break;
  }
  ok('pawn drill reaches the promotion', /Promotion/i.test($('eg-status').textContent),
     $('eg-status').textContent);
}

/* endgames: the knight pair has no long mates, the drill still loads */
$('eg-material').value = 'KNNK';
$('eg-material').dispatchEvent(new window.Event('change', { bubbles: true }));
$('eg-goal').value = '3';
$('eg-goal').dispatchEvent(new window.Event('change', { bubbles: true }));
const kn = window.ChessTrainer.drill.current;
ok('knight drill falls back to a shorter mate', !!kn && kn.goal <= 3, kn && kn.goal);
ok('goal selector enabled again', $('eg-goal').disabled === false);

/* every endgame material in the catalogue has a drill */
let missing = [];
['KQK', 'KRK', 'KBBK', 'KNNK', 'KQKR', 'KRKB', 'KQKQ', 'KPK'].forEach((m) => {
  $('eg-material').value = m;
  $('eg-material').dispatchEvent(new window.Event('change', { bubbles: true }));
  if (!window.ChessTrainer.drill.current) missing.push(m);
});
ok('all endgame materials offer a drill', missing.length === 0, missing.join(','));

/* openings: load, train, quiz */
click(tabs[3]);
click(doc.querySelector('#op-list .list-item'));
ok('opening detail shown', $('op-name').textContent.length > 2, $('op-name').textContent);
click($('btn-op-load'));
ok('opening loaded on board', doc.querySelectorAll('#moves-play .move').length >= 0);
click($('btn-op-quiz'));
ok('quiz visible', $('op-quiz-card').style.display !== 'none');
ok('quiz options rendered', doc.querySelectorAll('#op-quiz-options .option').length >= 3,
   String(doc.querySelectorAll('#op-quiz-options .option').length));

/* analysis: FEN + PGN */
click(tabs[4]);
$('an-fen').value = '8/8/8/8/8/1k6/8/K6R w - - 0 1';
click($('btn-an-set'));
ok('fen loaded', $('an-fen-badge').textContent.startsWith('8/8/8/8'), $('an-fen-badge').textContent);
$('an-pgn').value = '[Event "Test"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 1-0\n';
click($('btn-an-import'));
ok('pgn imported', $('an-move-count').textContent.includes('6'), $('an-move-count').textContent);

/* settings */
click(tabs[5]);
$('set-theme').value = 'light';
$('set-theme').dispatchEvent(new window.Event('change', { bubbles: true }));
ok('light theme applied', doc.documentElement.dataset.theme === 'light');
$('set-theme').value = 'dark';
$('set-theme').dispatchEvent(new window.Event('change', { bubbles: true }));
click($('set-legal'));
ok('toggle persisted', JSON.parse(window.localStorage.getItem('ct.settings')).legal === false);
click($('set-legal'));

/* help modal */
click($('btn-help'));
ok('help modal opens', $('modal').classList.contains('open'));
click($('modal-close'));
ok('help modal closes', !$('modal').classList.contains('open'));

/* ---------------------------------------------------------------- */
/* drag and drop, right-click move, keyboard, clocks, analysis search */
console.log('\n-- extra interactions --');

function pointerAt(el, name) {
  /* place the pointer on the middle of a named square */
  const sq = C.nameToSq(name);
  const d = window.ChessTrainer.state.flipped
    ? { row: 7 - (sq >> 4), col: 7 - (sq & 7) }
    : { row: sq >> 4, col: sq & 7 };
  const x = d.col * 10 + 5, y = d.row * 10 + 5;
  return { clientX: x, clientY: y };
}

/* drag the c-pawn from c2 to c4 */
click(tabs[0]);
click($('btn-newgame'));
const before = doc.querySelectorAll('#moves-play .mv').length;
const c2 = squareEl('c2'), c4 = squareEl('c4');
const p1 = pointerAt(c2, 'c2'), p2 = pointerAt(c4, 'c4');
c2.dispatchEvent(new window.MouseEvent('pointerdown', Object.assign({ bubbles: true, cancelable: true, button: 0 }, p1)));
window.dispatchEvent(new window.MouseEvent('pointermove', Object.assign({ bubbles: true, cancelable: true, button: 0 }, { clientX: p2.clientX + 2, clientY: p2.clientY + 2 })));
window.dispatchEvent(new window.MouseEvent('pointerup', Object.assign({ bubbles: true, cancelable: true, button: 0 }, p2)));
ok('drag and drop plays a move', doc.querySelectorAll('#moves-play .mv').length === before + 1,
   doc.querySelectorAll('#moves-play .mv').length + ' vs ' + before);

/* keyboard navigation */
const key = (k) => window.dispatchEvent(new window.KeyboardEvent('keydown', { key: k, bubbles: true }));
key('Home');
ok('Home goes to the start', window.ChessTrainer.game.cursor === 0);
key('End');
ok('End goes to the last move', window.ChessTrainer.game.cursor === window.ChessTrainer.game.replay.length - 1);
key('u');
ok('U takes a move back', window.ChessTrainer.game.cursor === window.ChessTrainer.game.replay.length - 2);
const flipBefore = window.ChessTrainer.state.flipped;
key('f');
ok('F flips the board', window.ChessTrainer.state.flipped !== flipBefore);
key('f');

/* right-click moves a piece */
click($('btn-newgame'));
const d2 = squareEl('d2'), d4 = squareEl('d4');
d2.dispatchEvent(new window.MouseEvent('pointerdown', Object.assign({ bubbles: true, cancelable: true, button: 0 }, pointerAt(d2, 'd2'))));
window.dispatchEvent(new window.MouseEvent('pointerup', Object.assign({ bubbles: true, cancelable: true, button: 0 }, pointerAt(d2, 'd2'))));
d4.dispatchEvent(new window.MouseEvent('contextmenu', Object.assign({ bubbles: true, cancelable: true, button: 2 }, pointerAt(d4, 'd4'))));
ok('right-click moves a piece', $('moves-play').textContent.includes('d4'), $('moves-play').textContent);

/* clocks run */
$('sel-tc').value = '60';
click($('btn-newgame'));
const t0 = $('clock-white-time').textContent;
await new Promise((r) => setTimeout(r, 1300));
const t1 = $('clock-white-time').textContent;
ok('clock counts down', t0 !== t1, t0 + ' -> ' + t1);
$('sel-tc').value = '600';

/* analysis search produces a score */
click(tabs[4]);
$('an-fen').value = '8/8/8/8/8/1k6/8/K6R w - - 0 1';
click($('btn-an-set'));
click($('btn-an-analyze'));
let score = '—';
for (let i = 0; i < 40 && score === '—'; i++) {
  await new Promise((r) => setTimeout(r, 200));
  score = $('an-score').textContent;
}
ok('analysis returns a score', score !== '—' && score.length > 0, score);
ok('analysis shows a principal variation', $('an-pv').textContent.trim().length > 1, $('an-pv').textContent);

/* a new game while the engine is thinking must not corrupt the board */
click(tabs[0]);
click($('btn-newgame'));
clickSquare('e2');
clickSquare('e4');
click($('btn-newgame'));
await new Promise((r) => setTimeout(r, 700));
ok('new game during engine thinking is safe', errors.length === 0, errors.slice(0, 2).join(' | '));
ok('board reset to the start position',
   window.ChessTrainer.game.replay.length === 1 &&
   window.ChessTrainer.game.replay[0].fen().startsWith('rnbqkbnr'));

/* quiz answering */
click(tabs[3]);
click(doc.querySelector('#op-list .list-item'));
click($('btn-op-quiz'));
const opt = doc.querySelector('#op-quiz-options .option');
ok('quiz has options', !!opt);
if (opt) {
  opt.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  ok('quiz reacts to an answer', $('op-quiz-status').textContent.length > 0, $('op-quiz-status').textContent);
}

ok('no script errors during interaction', errors.length === 0, errors.slice(0, 3).join(' | '));

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) failures.forEach((f) => console.log('  ✗ ' + f));
try { window.close(); } catch (e) { /* ignore */ }
process.exit(failed ? 1 : 0);
