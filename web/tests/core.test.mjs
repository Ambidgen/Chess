/* Node test harness for the Chess Trainer core.
 *
 *   node web/tests/core.test.mjs
 *
 * Extracts the inline <script id="core"> block from web/chess-trainer.html and
 * exercises it: perft (move generation), FEN/SAN/PGN round-trips, draw
 * detection and the search engine.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(here, '..', 'chess-trainer.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const match = html.match(/<script id="core">([\s\S]*?)<\/script>/);
if (!match) {
  console.error('Could not find the core script block in', htmlPath);
  process.exit(1);
}

const sandbox = { console, performance, Date, Math, JSON };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(match[1], sandbox, { filename: 'chess-trainer.html#core' });

const C = sandbox.ChessCore;
const { Position } = C;

let passed = 0, failed = 0;
const failures = [];

function ok(name, cond, extra = '') {
  if (cond) { passed++; }
  else { failed++; failures.push(`${name}${extra ? ' — ' + extra : ''}`); }
}

function eq(name, actual, expected) {
  ok(name, actual === expected, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

/* ------------------------------------------------------------------ */
/* 1. perft — exhaustive move generation check                        */
/* ------------------------------------------------------------------ */
const PERFT_CASES = [
  {
    name: 'startpos',
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    counts: [20, 400, 8902, 197281, 4865609]
  },
  {
    name: 'kiwipete',
    fen: 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',
    counts: [48, 2039, 97862, 4085603]
  },
  {
    name: 'position3',
    fen: '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1',
    counts: [14, 191, 2812, 43238, 674624]
  },
  {
    name: 'position4',
    fen: 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1',
    counts: [6, 264, 9467, 422333]
  },
  {
    name: 'position5',
    fen: 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8',
    counts: [44, 1486, 62379, 2103487]
  },
  {
    name: 'position6',
    fen: 'r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10',
    counts: [46, 2079, 89890]
  },
  {
    name: 'promo-castle',
    fen: 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1',
    counts: [6, 264, 9467]
  },
  {
    name: 'position2',
    fen: 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',
    counts: [48, 2039]
  }
];

for (const c of PERFT_CASES) {
  const pos = new Position(c.fen);
  for (let d = 1; d <= c.counts.length; d++) {
    const t0 = Date.now();
    const n = C.perft(pos, d);
    eq(`perft(${d}) ${c.name}`, n, c.counts[d - 1]);
    if (d === c.counts.length) {
      process.stdout.write(`  · ${c.name} depth ${d}: ${n} nodes in ${Date.now() - t0}ms\n`);
    }
  }
}

/* ------------------------------------------------------------------ */
/* 2. FEN round trip                                                   */
/* ------------------------------------------------------------------ */
const FENS = [
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',
  '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 b - - 3 17',
  '4k3/8/8/8/8/8/4P3/4K3 w - - 0 1',
  '8/8/8/8/k7/8/8/K6R b - - 12 40',
  'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2'
];
for (const fen of FENS) {
  const p = new Position(fen);
  eq('fen round trip: ' + fen, p.fen(), fen);
}

/* ------------------------------------------------------------------ */
/* 3. SAN generation / parsing                                         */
/* ------------------------------------------------------------------ */
function sanCase(name, fen, expected) {
  const p = new Position(fen);
  const sans = p.sanList();
  ok(`san list contains ${expected} (${name})`, sans.includes(expected), sans.join(' '));
  const mv = p.sanToMove(expected);
  ok(`sanToMove finds ${expected} (${name})`, !!mv);
  const squares = expected.match(/[a-h][1-8]/g);
  if (mv && squares) eq(`sanToMove target for ${expected} (${name})`, C.sqName(mv.to), squares[squares.length - 1]);
}
sanCase('castle kingside', 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', 'O-O');
sanCase('castle queenside', 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', 'O-O-O');
sanCase('capture', 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2', 'exd5');
sanCase('promotion', '8/P6k/8/8/8/8/8/K7 w - - 0 1', 'a8=Q');
sanCase('promotion capture', '1n6/P6k/8/8/8/8/8/K7 w - - 0 1', 'axb8=Q');
sanCase('check', 'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2', 'Qh4#');
sanCase('disambiguate file', '8/8/8/8/8/8/R6R/K5k1 w - - 0 1', 'Rae2');
sanCase('disambiguation rank', '8/8/8/8/8/8/R6R/K5k1 w - - 0 1', 'Rhe2');
sanCase('en passant', 'rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3', 'exf6');

/* SAN round trip over a random walk */
{
  const pos = new Position(C.START_FEN);
  let sanOk = true;
  for (let i = 0; i < 120; i++) {
    const moves = pos.legalMoves();
    if (!moves.length) break;
    const mv = moves[Math.floor(Math.random() * moves.length)];
    const san = pos.moveToSan(mv);
    const back = pos.sanToMove(san);
    if (!back || back.from !== mv.from || back.to !== mv.to || back.promo !== mv.promo) {
      sanOk = false;
      console.log('   SAN mismatch', san, C.sqName(mv.from), C.sqName(mv.to));
      break;
    }
    pos.makeMove(mv);
  }
  ok('san round trip over random game', sanOk);
}

/* ------------------------------------------------------------------ */
/* 4. game state                                                       */
/* ------------------------------------------------------------------ */
{
  const mate = new Position('R5k1/5ppp/8/8/8/8/8/6K1 b - - 0 1');
  const m = mate.legalMoves();
  ok('mate position has no legal moves', m.length === 0);
  ok('mate position is checkmate', mate.gameResult() === '1-0', mate.gameResult());

  const stale = new Position('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
  eq('stalemate result', stale.gameResult(), '1/2-1/2');

  const insuf = new Position('8/8/4k3/8/8/4K3/8/8 w - - 0 1');
  ok('insufficient material', insuf.isInsufficientMaterial());
  const insuf2 = new Position('8/8/4k3/8/8/4K3/6B1/8 w - - 0 1');
  ok('K+B vs K insufficient', insuf2.isInsufficientMaterial());
  const ok1 = new Position('8/8/4k3/8/8/4K3/6P1/8 w - - 0 1');
  ok('K+P vs K not insufficient', !ok1.isInsufficientMaterial());
}

/* castling rights updates */
{
  const pos = new Position('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  const mv = pos.legalMoves().find((m) => C.sqName(m.from) === 'e1' && C.sqName(m.to) === 'g1');
  ok('kingside castle generated', !!mv);
  pos.makeMove(mv);
  ok('castling rights cleared after king move', pos.fen().split(' ')[2] === 'kq', pos.fen());
}

/* en passant removes the right pawn */
{
  const pos = new Position('rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3');
  const mv = pos.sanToMove('exf6');
  ok('en passant move found', !!mv);
  pos.makeMove(mv);
  eq('en passant capture removes pawn', pos.board[C.nameToSq('f5')], 0);
  eq('en passant lands on f6', C.sqName(pos.kingSquare(C.WHITE) === -1 ? 0 : C.nameToSq('f6')), 'f6');
}

/* ------------------------------------------------------------------ */
/* 5. PGN parsing                                                      */
/* ------------------------------------------------------------------ */
{
  const pgn = `[Event "Test"]
[Site "?"]
[Date "2024.01.01"]
[Round "1"]
[White "Player One"]
[Black "Player Two"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 1-0`;
  const game = C.parsePgn(pgn);
  eq('pgn header White', game.headers.White, 'Player One');
  eq('pgn header Result', game.headers.Result, '1-0');
  eq('pgn move count', game.root.moves.length, 6);
  const conv = C.pgnToSanMoves(game);
  eq('pgn replay first move', conv.moves[0].san, 'e4');
  eq('pgn replay last move', conv.moves[5].san, 'a6');
  eq('pgn replay reaches the final position', conv.position.fen().split(' ')[0], 'r1bqkbnr/1ppp1ppp/p1n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R');
}
{
  const pgn = `1. e4 {King's pawn} e5 $1 2. Nf3 (2. d4 exd4) Nc6 1-0`;
  const game = C.parsePgn(pgn);
  eq('pgn with comment/nag/variation: mainline length', game.root.moves.length, 4);
  eq('pgn comment captured', game.root.moves[0].comment, "King's pawn");
  eq('pgn nag captured', game.root.moves[1].nags[0], 1);
  eq('pgn variation captured', game.root.moves[2].variations.length, 1);
  eq('pgn variation moves', game.root.moves[2].variations[0].moves.length, 2);
}

/* ------------------------------------------------------------------ */
/* 6. search engine                                                    */
/* ------------------------------------------------------------------ */
{
  const engine = new C.Engine();
  const mateIn1 = new Position('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1');
  const res = engine.searchSync(mateIn1, { maxDepth: 4, maxTime: 4000 });
  ok('engine finds mate in 1', res && res.score > C.MATE - 100, res ? String(res.score) : 'null');
  ok('engine returns a move', !!(res && res.move));
  ok('engine pv has moves', !!(res && res.pv && res.pv.length >= 1));
}
{
  const engine = new C.Engine();
  const pos = new Position(C.START_FEN);
  const res = engine.searchSync(pos, { maxDepth: 5, maxTime: 5000 });
  ok('engine searches start position', res && res.depth >= 4, JSON.stringify({ depth: res.depth, nodes: res.nodes }));
  ok('engine score is sane', Math.abs(res.score) < 500, String(res.score));
  const mv = C.findMove(pos, res.move.from, res.move.to, res.move.promo);
  ok('engine move is legal', !!mv);
}
{
  /* the engine must not blunder a simple tactic */
  const engine = new C.Engine();
  const pos = new Position('r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 4 4');
  const res = engine.searchSync(pos, { maxDepth: 5, maxTime: 5000 });
  const san = pos.moveToSan(res.move);
  ok('engine finds the scholar mate', san === 'Qxf7#', san);
}
{
  const engine = new C.Engine();
  const pos = new Position('8/8/8/8/8/1k6/8/K6R w - - 0 1');
  const res = engine.searchSync(pos, { maxDepth: 6, maxTime: 5000 });
  ok('engine wins KRK', res.score > 0, String(res.score));
}

/* evaluate sanity: material advantage is positive */
{
  const pos = new Position('4k3/8/8/8/8/8/8/3QK3 w - - 0 1');
  ok('eval: queen up is positive', C.evaluateWhite(pos) > 500, String(C.evaluateWhite(pos)));
  const pos2 = new Position('4k3/8/8/8/8/8/8/3R1K2 w - - 0 1');
  ok('eval: rook up is positive', C.evaluateWhite(pos2) > 300, String(C.evaluateWhite(pos2)));
  const equal = new Position('4k3/8/8/8/8/8/8/4K3 w - - 0 1');
  ok('eval: bare kings is near zero', Math.abs(C.evaluateWhite(equal)) < 60, String(C.evaluateWhite(equal)));
  const sym = new Position('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  ok('eval: symmetric position is near zero', Math.abs(C.evaluateWhite(sym)) < 80, String(C.evaluateWhite(sym)));
}

/* ------------------------------------------------------------------ */
console.log('');
if (failed) {
  console.log('FAILURES:');
  for (const f of failures) console.log('  ✗ ' + f);
}
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
