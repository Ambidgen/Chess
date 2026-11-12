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
const { Position } = C;

const FENS = {
  kiwipete: 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',
  position4: 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1'
};

for (const [name, fen] of Object.entries(FENS)) {
  const pos = new Position(fen);
  console.log(name);
  for (let d = 1; d <= 4; d++) console.log('  perft(' + d + ') =', C.perft(pos, d));
}

/* Compare against a straightforward independent generator for the same
   positions: build the set of legal moves with a second implementation
   written from scratch (8x8 array, explicit rules). */
const WHITE_P = 'P', BLACK_P = 'p';

function board64(fen) {
  const pos = new Position(fen);
  const b = [];
  for (let r = 0; r < 8; r++) {
    const row = [];
    for (let f = 0; f < 8; f++) {
      const p = pos.board[(r << 4) | f];
      row.push(p === 0 ? '.' : (C.isWhitePiece(p) ? 'PNBRQK'[C.typeOf(p) - 1] : 'pnbrqk'[C.typeOf(p) - 1]));
    }
    b.push(row);
  }
  return b;
}

console.log('\nEP availability check:');
{
  const pos = new Position('rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3');
  const sans = pos.sanList();
  console.log('  has exf6:', sans.includes('exf6'), '| has exd6:', sans.includes('exd6'));
}
{
  /* black plays a double push -> white must be able to capture e.p. */
  const pos = new Position('rnbqkbnr/ppp1pppp/8/8/3pP3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 2');
  console.log('  after ...d5, ep target fen:', pos.fen());
  console.log('  black moves:', pos.sanList().join(' '));
  const mv = pos.sanToMove('d5');
  if (mv) {
    pos.makeMove(mv);
    console.log('  fen after d5:', pos.fen());
    console.log('  white replies include exd3:', pos.sanList().includes('exd3'));
  }
}
{
  /* en passant that would expose the king must be illegal */
  const pos = new Position('8/8/8/8/k2pP2R/8/8/4K3 b - d3 0 1');
  console.log('  pinned ep legal?', pos.sanList().includes('cxd3'), '(expected false)');
}
{
  const pos = new Position('8/8/8/8/K2pP2r/8/8/4k3 w - d3 0 1');
  console.log('  pinned ep legal (white)?', pos.sanList().includes('exd3'), '(expected false)');
}
