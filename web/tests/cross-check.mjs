/* Cross-checks the 0x88 generator inside chess-trainer.html against the
 * independent reference generator in ref-engine.mjs.
 *
 *   node web/tests/cross-check.mjs [walks]
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { parseFen, legalMoves, moveKey, toFen } from './ref-engine.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(here, '..', 'chess-trainer.html'), 'utf8');
const core = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const sandbox = { console, performance, Date, Math, JSON };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(core, sandbox, { filename: 'core' });
const C = sandbox.ChessCore;

const walks = Number(process.argv[2] || 400);
let seed = 20240101;
function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }

const PROMO_LETTER = { 2: 'n', 3: 'b', 4: 'r', 5: 'q' };
function coreKey(mv) {
  return C.sqName(mv.from) + C.sqName(mv.to) + (mv.promo ? PROMO_LETTER[mv.promo] : '');
}

let mismatches = 0, checked = 0;
const seen = new Set();

function compare(fen) {
  if (seen.has(fen)) return true;
  seen.add(fen);
  const ref = legalMoves(parseFen(fen));
  const core = new C.Position(fen);
  const mine = core.legalMoves();
  const a = ref.map(moveKey).sort().join(' ');
  const b = mine.map(coreKey).sort().join(' ');
  checked++;
  if (a !== b) {
    mismatches++;
    if (mismatches <= 12) {
      console.log('MISMATCH at', fen);
      const setA = new Set(ref.map(moveKey));
      const setB = new Set(mine.map(coreKey));
      console.log('  only in reference:', [...setA].filter((x) => !setB.has(x)).join(' ') || '-');
      console.log('  only in core     :', [...setB].filter((x) => !setA.has(x)).join(' ') || '-');
    }
    return false;
  }
  return true;
}

const SEEDS = [
  C.START_FEN,
  'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',
  'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1',
  '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1',
  'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8',
  'r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10',
  'rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3',
  '4k3/8/8/8/8/8/8/4K2R w K - 0 1',
  '8/8/8/8/8/8/6k1/4K2R w K - 0 1'
];

for (const f of SEEDS) compare(f);

/* random walks */
for (let w = 0; w < walks; w++) {
  let fen = SEEDS[w % SEEDS.length];
  for (let ply = 0; ply < 40; ply++) {
    const ref = legalMoves(parseFen(fen));
    if (!ref.length) break;
    if (!compare(fen)) break;
    const core = new C.Position(fen);
    const mine = core.legalMoves();
    const mv = mine[Math.floor(rnd() * mine.length)];
    core.makeMove(mv);
    fen = core.fen();
  }
}

console.log(`\nchecked ${checked} positions, ${mismatches} mismatches`);
process.exit(mismatches ? 1 : 0);
