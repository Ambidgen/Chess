/* Compares the legal move generator in chess-trainer.html against the
 * ground truth produced by python-chess (web/tests/gen_reference.py).
 *
 *   node web/tests/compare-reference.mjs [maxReports]
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(here, '..', 'chess-trainer.html'), 'utf8');
const core = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const sandbox = { console, performance, Date, Math, JSON };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(core, sandbox, { filename: 'core' });
const C = sandbox.ChessCore;

const data = JSON.parse(fs.readFileSync(path.join(here, 'reference-moves.json'), 'utf8'));
const maxReports = Number(process.argv[2] || 10);

function coreUci(mv) {
  const from = C.sqName(mv.from);
  const to = C.sqName(mv.to);
  if (mv.promo) return from + to + ['', '', 'n', 'b', 'r', 'q'][mv.promo];
  if (mv.flags & C.FLAG_CASTLE) return from + to;   // e1g1 / e1c1
  return from + to;
}

let checked = 0, bad = 0, reports = 0;
for (const [fen, uciList] of Object.entries(data.positions)) {
  const pos = new C.Position(fen);
  const mine = pos.legalMoves().map(coreUci).sort();
  const theirs = [...uciList].sort();
  checked++;
  if (mine.join(' ') !== theirs.join(' ')) {
    bad++;
    if (reports < maxReports) {
      reports++;
      const setMine = new Set(mine), setTheirs = new Set(theirs);
      console.log('MISMATCH', fen);
      console.log('  missing :', theirs.filter((m) => !setMine.has(m)).join(' ') || '-');
      console.log('  extra   :', mine.filter((m) => !setTheirs.has(m)).join(' ') || '-');
    }
  }
}

console.log(`\nchecked ${checked} positions, ${bad} mismatching`);
process.exit(bad ? 1 : 0);
