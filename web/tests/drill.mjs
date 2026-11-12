/* Drills down to the shallowest position where the engine's move generation
 * disagrees with python-chess.
 *
 *   node web/tests/drill.mjs "<fen>" <depth>
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(here, '..', 'chess-trainer.html'), 'utf8');
const core = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const sandbox = { console, performance, Date, Math, JSON };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(core, sandbox, { filename: 'core' });
const C = sandbox.ChessCore;

function referenceDivide(fen, depth) {
  const out = execFileSync('python3', [path.join(here, 'divide.py'), fen, String(depth)], { encoding: 'utf8' });
  const map = new Map();
  for (const line of out.trim().split('\n')) {
    const [uci, count] = line.split(' ');
    if (uci === 'TOTAL') continue;
    map.set(uci, Number(count));
  }
  return map;
}

function uciOf(mv) {
  return C.sqName(mv.from) + C.sqName(mv.to) + (mv.promo ? ['', '', 'n', 'b', 'r', 'q'][mv.promo] : '');
}

function drill(fen, depth) {
  if (depth < 2) { console.log('bottomed out at', fen); return; }
  const ref = referenceDivide(fen, depth);
  const pos = new C.Position(fen);
  for (const mv of pos.legalMoves()) {
    const uci = uciOf(mv);
    const expected = ref.get(uci);
    if (expected === undefined) continue;
    pos.makeMove(mv);
    const mine = C.perft(pos, depth - 1);
    const childFen = pos.fen();
    pos.unmakeMove();
    if (mine !== expected) {
      console.log(`divergence after ${uci} (depth ${depth}) in ${fen}`);
      console.log(`  mine=${mine} ref=${expected} delta=${mine - expected}`);
      console.log(`  child fen: ${childFen}`);
      drill(childFen, depth - 1);
      return;
    }
  }
  console.log('no divergence found at this level:', fen, 'depth', depth);
}

const fen = process.argv[2];
const depth = Number(process.argv[3] || 4);
drill(fen, depth);
