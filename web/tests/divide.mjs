/* Perft divide for the engine inside chess-trainer.html.

 *   node web/tests/divide.mjs "<fen>" <depth>
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

const fen = process.argv[2];
const depth = Number(process.argv[3] || 2);
const pos = new C.Position(fen);
let total = 0;
for (const mv of pos.legalMoves()) {
  const uci = C.sqName(mv.from) + C.sqName(mv.to) + (mv.promo ? ['', '', 'n', 'b', 'r', 'q'][mv.promo] : '');
  pos.makeMove(mv);
  const n = C.perft(pos, depth - 1);
  pos.unmakeMove();
  total += n;
  console.log(uci, n);
}
console.log('TOTAL', total);
