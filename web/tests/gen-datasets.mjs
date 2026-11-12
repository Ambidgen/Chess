/* Generates the embedded puzzle + endgame datasets for chess-trainer.html.
 *
 *   node web/tests/gen-datasets.mjs
 *
 * Every position is checked for legality (kings not adjacent, no opposite
 * check, no pawns on the back ranks) and every tactic is verified with the
 * very search engine that ships inside the page.
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

const MATE = 32000;
/* mulberry32 - a small, well behaved 32 bit PRNG.  The classic
 * seed * 1103515245 LCG overflows a double and degenerates into a very
 * short cycle, which produced the same handful of positions over and
 * over again. */
let seed = (Number(process.env.SEED || 987654321) >>> 0) || 1;
function rnd() {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function pick(arr) { return arr[Math.floor(rnd() * arr.length)]; }

const engine = new C.Engine();

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function makeCtx() {
  const ctx = {
    nodes: 0, deadline: 0, aborted: false,
    killers: [], history: new Int32Array(16384), startTime: Date.now(),
  };
  for (let i = 0; i < 96; i++) ctx.killers.push([]);
  return ctx;
}

function search(pos, depth) {
  const gen = engine.searcher.iterative(pos.clone(), makeCtx(), depth);
  let r = gen.next();
  let best = null;
  while (!r.done) { const v = r.value; if (v && v.move) best = v; r = gen.next(); }
  return best;
}

function sanOf(pos, mv) {
  const list = pos.legalMoves();
  return pos.moveToSan(mv, list);
}

const SLIDE = {
  [C.BISHOP]: [[1, 1], [1, -1], [-1, 1], [-1, -1]],
  [C.ROOK]: [[1, 0], [-1, 0], [0, 1], [0, -1]],
  [C.QUEEN]: [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]],
};
const KNIGHT = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];

function attackedTargets(pos, from, type) {
  const out = [];
  const dirs = type === C.KNIGHT ? KNIGHT : (SLIDE[type] || []);
  for (const [df, dr] of dirs) {
    let f = C.fileOf(from) + df, r = C.rankOf(from) + dr;
    while (f >= 0 && f < 8 && r >= 0 && r < 8) {
      const occ = pos.board[(r << 4) | f];
      if (occ) {
        if (C.colorOf(occ) !== C.colorOf(pos.board[from])) out.push((r << 4) | f);
        break;
      }
      f += df; r += dr;
    }
  }
  return out;
}

function isFork(pos, mv) {
  const p = pos.clone();
  p.makeMove(mv);
  const t = C.typeOf(mv.piece);
  if (t === C.KING || t === C.PAWN) return false;
  return attackedTargets(p, mv.to, t).length >= 2;
}

function isPin(pos, mv) {
  const p = pos.clone();
  p.makeMove(mv);
  const t = C.typeOf(mv.piece);
  if (!SLIDE[t]) return false;
  const enemyKing = p.kingSquare(p.turn);
  if (enemyKing < 0) return false;
  for (const [df, dr] of SLIDE[t]) {
    let f = C.fileOf(mv.to) + df, r = C.rankOf(mv.to) + dr;
    let first = -1;
    while (f >= 0 && f < 8 && r >= 0 && r < 8) {
      const occ = p.board[(r << 4) | f];
      if (occ) { first = (r << 4) | f; break; }
      f += df; r += dr;
    }
    if (first < 0) continue;
    if (C.colorOf(p.board[first]) === C.colorOf(mv.piece)) continue;
    let f2 = C.fileOf(first) + df, r2 = C.rankOf(first) + dr;
    while (f2 >= 0 && f2 < 8 && r2 >= 0 && r2 < 8) {
      const occ2 = p.board[(r2 << 4) | f2];
      if (occ2) {
        if ((r2 << 4 | f2) === enemyKing) return true;
        break;
      }
      f2 += df; r2 += dr;
    }
  }
  return false;
}

const VALUE = { 1: 100, 2: 320, 3: 500, 4: 900, 5: 1800 };

function material(pos, color) {
  const vals = VALUE;
  let total = 0;
  for (let sq = 0; sq < 128; sq++) {
    if (!C.onBoard(sq)) continue;
    const p = pos.board[sq];
    if (!p || C.colorOf(p) !== color) continue;
    total += vals[C.typeOf(p)] || 0;
  }
  return total;
}

/* ------------------------------------------------------------------ */
/* legality                                                            */
/* ------------------------------------------------------------------ */

/* mirrors the checks python-chess performs on board.status() */
function legalPosition(pos) {
  let wKing = -1, bKing = -1, wPawns = 0, bPawns = 0, wPieces = 0, bPieces = 0;
  for (let sq = 0; sq < 128; sq++) {
    if (!C.onBoard(sq)) continue;
    const p = pos.board[sq];
    if (!p) continue;
    const t = C.typeOf(p);
    const white = C.colorOf(p) === C.WHITE;
    if (t === C.KING) { if (white) wKing = sq; else bKing = sq; }
    else if (white) wPieces++; else bPieces++;
    if (t === C.PAWN) {
      const r = C.rankOf(sq);
      if (r === 0 || r === 7) return false;          // pawn on the back rank
      if (white) wPawns++; else bPawns++;
    }
  }
  if (wKing < 0 || bKing < 0) return false;
  if (wPawns > 8 || bPawns > 8) return false;
  if (wPieces > 15 || bPieces > 15) return false;
  /* kings may not touch */
  if (Math.max(Math.abs(C.fileOf(wKing) - C.fileOf(bKing)),
                Math.abs(C.rankOf(wKing) - C.rankOf(bKing))) < 2) return false;
  /* the side that is not to move may not be in check */
  if (pos.inCheck(pos.turn ^ 24)) return false;
  return true;
}

const THEMES = {
  mate: 'Checkmate',
  backRank: 'Back rank',
  fork: 'Fork',
  pin: 'Pin',
  discovered: 'Discovered attack',
  promotion: 'Promotion',
  capture: 'Capture',
  quiet: 'Quiet move',
};

/* ------------------------------------------------------------------ */
/* puzzles                                                             */
/* ------------------------------------------------------------------ */

function classify(pos, mv, score) {
  const tags = [];
  const p = pos.clone();
  p.makeMove(mv);
  if (score > MATE - 1000) {
    tags.push('mate');
    const ek = p.kingSquare(p.turn);
    const replies = p.legalMoves().filter((m) => {
      const q = p.clone(); q.makeMove(m);
      return !q.inCheck();
    });
    if (ek >= 0 && (C.rankOf(ek) === 0 || C.rankOf(ek) === 7) && !replies.length) tags.push('backRank');
  }
  if (mv.promo) tags.push('promotion');
  if (isFork(pos, mv)) tags.push('fork');
  if (isPin(pos, mv)) tags.push('pin');
  if (p.inCheck(p.turn)) tags.push('discovered');
  if (mv.captured) tags.push('capture');
  if (!tags.length) tags.push('quiet');
  return tags;
}

function rootScores(pos, depth) {
  const list = pos.legalMoves();
  const out = [];
  for (const mv of list) {
    const p = pos.clone();
    p.makeMove(mv);
    const gen = engine.searcher.negamax(p, depth, -32000, 32000, 1, makeCtx());
    let r = gen.next();
    while (!r.done) r = gen.next();
    out.push({ move: mv, score: -r.value });
  }
  out.sort((a, b) => b.score - a.score);
  return out;
}

function emptyBoard() { return new Array(64).fill(''); }

function shuffledSquares() {
  const s = [];
  for (let i = 0; i < 64; i++) s.push(i);
  for (let i = s.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [s[i], s[j]] = [s[j], s[i]];
  }
  return s;
}

function boardToFen(board, turn) {
  const rows = [];
  for (let r = 7; r >= 0; r--) {
    let row = '', empty = 0;
    for (let f = 0; f < 8; f++) {
      const ch = board[r * 8 + f];
      if (!ch) { empty++; continue; }
      if (empty) { row += String(empty); empty = 0; }
      row += ch;
    }
    if (empty) row += String(empty);
    rows.push(row);
  }
  return rows.join('/') + ' ' + turn + ' - - 0 1';
}

/* random midgame: lots of forks, pins and mating chances */
function randomMidgamePosition() {
  const board = emptyBoard();
  const squares = shuffledSquares();
  let idx = 0;
  const backRanks = [];
  for (let i = 0; i < 64; i++) {
    const r = Math.floor(i / 8);
    if ((r === 0 && rnd() < 0.7) || (r === 7 && rnd() < 0.7)) backRanks.push(i);
  }
  const bkSq = backRanks.length ? pick(backRanks) : squares[idx++];
  board[bkSq] = 'k';
  const wkSq = backRanks.length ? pick(backRanks) : squares[idx++];
  board[wkSq] = 'K';
  if (Math.max(Math.abs((bkSq % 8) - (wkSq % 8)), Math.abs(Math.floor(bkSq / 8) - Math.floor(wkSq / 8))) < 2) return null;
  const piecePool = ['q', 'r', 'b', 'n'];
  const place = (n) => {
    let placed = 0, pawns = 0;
    while (placed < n && idx < 60) {
      const sq = squares[idx++];
      const r = Math.floor(sq / 8);
      if (board[sq]) continue;
      if (rnd() < 0.55) {
        if (r === 0 || r === 7) continue;
        if (pawns >= 8) continue;
        board[sq] = 'p'; pawns++;
      } else {
        board[sq] = pick(piecePool);
      }
      placed++;
    }
  };
  place(3 + Math.floor(rnd() * 5));
  place(3 + Math.floor(rnd() * 5));
  const turn = rnd() < 0.5 ? 'w' : 'b';
  const fen = boardToFen(board, turn);
  try {
    const pos = new C.Position(fen);
    if (pos.legalMoves().length < 4) return null;
    if (!legalPosition(pos)) return null;
    return pos;
  } catch (e) { return null; }
}

/* The generator board uses row 0 for rank 1, so a square name maps to
 * (rank - 1) * 8 + file. */
function idxOf(name) {
  return (parseInt(name[1], 10) - 1) * 8 + 'abcdefgh'.indexOf(name[0]);
}

/* Back rank mates: the classic quiet mating pattern.  The defending king
 * is walled in by its own pawns and a rook or queen swings in along the
 * back rank.  These are quiet moves, so they fill the gap left by the
 * capture based tactics. */
function backRankPosition() {
  const board = emptyBoard();
  const corner = pick(['h8', 'a8', 'h1', 'a1']);
  const black = corner[1] === '8' ? 'p' : 'P';
  const kingFile = 'abcdefgh'.indexOf(corner[0]);
  const kingRank = parseInt(corner[1], 10);
  board[idxOf(corner)] = 'k';
  /* the wall of pawns */
  const pawnFiles = kingFile === 7 ? ['g', 'h'] : ['a', 'b'];
  for (const f of pawnFiles) {
    const sq = idxOf(f + (kingRank === 8 ? '7' : '2'));
    if (board[sq]) return null;
    board[sq] = black;
  }
  /* the attacker waits on the far side of the board */
  const rookFile = kingFile === 7 ? 'a' : 'h';
  const rookRank = kingRank === 8 ? 1 + Math.floor(rnd() * 3) : 6 + Math.floor(rnd() * 3);
  const rookSq = idxOf(rookFile + rookRank);
  if (board[rookSq]) return null;
  board[rookSq] = rnd() < 0.7 ? 'R' : 'Q';
  /* a white king that does not stand in the way */
  for (let attempt = 0; attempt < 20; attempt++) {
    const f = Math.floor(rnd() * 8);
    const r = Math.floor(rnd() * 8);
    const sq = r * 8 + f;
    if (board[sq]) continue;
    const kf = kingFile, kr = kingRank - 1;
    if (Math.max(Math.abs(f - kf), Math.abs(r - kr)) < 2) continue;
    if (f === 'abcdefgh'.indexOf(rookFile) && Math.abs(r - (rookRank - 1)) <= 1) continue;
    board[sq] = 'K';
    break;
  }
  if (!board.some((c) => c === 'K')) return null;
  /* an optional black defender that cannot help */
  if (rnd() < 0.6) {
    for (let attempt = 0; attempt < 12; attempt++) {
      const f = Math.floor(rnd() * 8);
      const r = Math.floor(rnd() * 8);
      const sq = r * 8 + f;
      if (board[sq]) continue;
      const kf = 'abcdefgh'.indexOf(rookFile), kr = rookRank - 1;
      if (Math.abs(f - kf) <= 1 && Math.abs(r - kr) <= 1) continue;
      board[sq] = pick(['n', 'b', 'q']);
      break;
    }
  }
  const fen = boardToFen(board, 'w');
  try {
    const pos = new C.Position(fen);
    if (!legalPosition(pos)) return null;
    if (!pos.legalMoves().length) return null;
    return pos;
  } catch (e) { return null; }
}

/* A cheap tactical scan: mate in one, or a capture that wins material. */
function findTactic(pos) {
  const list = pos.legalMoves();
  let best = null;
  for (const mv of list) {
    const p = pos.clone();
    p.makeMove(mv);
    if (!p.legalMoves().length && p.inCheck(p.turn)) return { mate: true, mv };
    if (!mv.captured) continue;
    if (C.typeOf(mv.piece) === C.KING) continue;   /* the king does not grab material */
    const gain = VALUE[C.typeOf(mv.captured)] - VALUE[C.typeOf(mv.piece)];
    if (gain < 0) continue;
    const defended = pos.isAttacked(mv.to, pos.turn ^ 24);
    if (defended && gain <= 0) continue;
    if (!best || gain > best.gain) best = { mv, gain, defended };
  }
  return best;
}

function buildPuzzles(target) {
  const out = [];
  const seen = new Set();
  let attempts = 0;
  const maxAttempts = target * 900;
  const stats = { attempts: 0, built: 0, tactic: 0, quiet: 0, deep: 0, verified: 0, weak: 0, thin: 0 };
  while (out.length < target && attempts < maxAttempts) {
    attempts++;
    stats.attempts++;
    let pos;
    const roll = attempts % 6;
    if (roll === 0) {
      pos = randomMidgamePosition();
      if (!pos) continue;
    } else if (roll === 1) {
      pos = backRankPosition();
      if (!pos) continue;
    } else {
      pos = new C.Position(C.START_FEN);
      const plies = 8 + Math.floor(rnd() * 34);
      for (let i = 0; i < plies; i++) {
        const moves = pos.legalMoves();
        if (!moves.length) break;
        pos.makeMove(pick(moves));
      }
      if (!legalPosition(pos)) continue;
    }
    const fen = pos.fen();
    if (seen.has(fen)) continue;
    seen.add(fen);
    stats.built++;

    /* every fifth position is screened with the engine so that quiet
     * tactics (discovered attacks, mates) also make it into the set */
    let tactic = null;
    if (attempts % 4 === 0) {
      const rs = rootScores(pos, 2);
      if (rs.length < 2) continue;
      if (rs[0].score - rs[1].score < 90) continue;
      if (Math.abs(rs[0].score) < 180) continue;
      if (rs[0].move.captured) continue;        /* quiet moves only */
      tactic = { quiet: true, mv: rs[0].move };
      stats.quiet++;
    } else {
      tactic = findTactic(pos);
      if (!tactic) continue;
      stats.tactic++;
    }

    /* the real search, used for the solution and the metadata */
    const res = search(pos, 5);
    stats.deep++;
    if (!res || !res.move) continue;
    const score = res.score;
    const mate = score > MATE - 1000;
    if (!mate && Math.abs(score) < 300) { stats.weak++; continue; }
    stats.verified++;

    const mv = pos.legalMoves().find((m) => C.moveKey(m) === C.moveKey(res.move));
    if (!mv) continue;

    const before = material(pos, pos.turn);
    const after = pos.clone();
    after.makeMove(mv);
    const gained = before - material(after, pos.turn);

    const rs2 = rootScores(pos, 2);
    const margin = rs2.length > 1 ? rs2[0].score - rs2[1].score : 999;
    if (!mate && margin < 40) { stats.thin++; continue; }

    const tags = classify(pos, mv, score);
    const theme = THEMES[tags[0]] || 'Tactic';
    const quiet = !mv.captured && !mate;

    const replyRes = search(after, 4);
    let replySan = null;
    if (replyRes && replyRes.move) {
      const rl = after.legalMoves().find((m) => C.moveKey(m) === C.moveKey(replyRes.move));
      if (rl) replySan = sanOf(after, rl);
    }

    /* the value of the tactic: the material it wins, or the engine's
     * assessment when the win comes later (quiet discoveries) */
    const swing = mate ? Math.max(0, gained)
      : Math.max(gained, Math.round(Math.abs(score)));

    let rating;
    if (mate) {
      const dist = Math.ceil((MATE - score) / 2);
      rating = 900 + dist * 250;
    } else {
      rating = 800 + res.depth * 40 +
        Math.min(1100, Math.max(0, gained) * 1.1) +
        Math.min(300, Math.max(0, margin) * 1.5);
    }
    rating = Math.max(700, Math.min(2400, Math.round(rating / 25) * 25));

    out.push({
      fen,
      sol: sanOf(pos, mv),
      reply: replySan,
      theme,
      tags,
      rating,
      mate: mate ? Math.ceil((MATE - score) / 2) : 0,
      swing: swing,
      quiet,
      margin: Math.round(margin),
    });
  }
  if (process.env.DEBUG_PUZZLE) console.log('puzzle stats:', stats);
  return out;
}

/* ------------------------------------------------------------------ */
/* endgame drills                                                      */
/* ------------------------------------------------------------------ */

/* Mating nets.  The black king is driven into a corner and the white pieces
 * are placed so that one move delivers mate.  Every template is expanded by
 * the eight symmetries of the board; the squares around it are then probed so
 * that the catalogue also contains slower mates.  Every candidate is finally
 * verified with the search engine that ships inside the page. */
const TEMPLATES = {
  KQK: [
    { bk: 'a8', wk: 'b6', w: [['Q', 'c7']] },
    { bk: 'a8', wk: 'c7', w: [['Q', 'b6']] },
    { bk: 'a8', wk: 'b6', w: [['Q', 'd7']] },
    { bk: 'a8', wk: 'c7', w: [['Q', 'b5']] },
    { bk: 'a8', wk: 'a6', w: [['Q', 'c7']] },
    { bk: 'a8', wk: 'b6', w: [['Q', 'h1']] },
    { bk: 'a8', wk: 'c7', w: [['Q', 'd8']] }
  ],
  KRK: [
    { bk: 'a8', wk: 'b6', w: [['R', 'c1']] },
    { bk: 'a8', wk: 'b6', w: [['R', 'd1']] },
    { bk: 'a8', wk: 'b6', w: [['R', 'f1']] },
    { bk: 'a8', wk: 'b6', w: [['R', 'h1']] },
    { bk: 'a8', wk: 'c7', w: [['R', 'b2']] },
    { bk: 'a8', wk: 'b6', w: [['R', 'h3']] }
  ],
  KBBK: [
    { bk: 'h8', wk: 'g6', w: [['B', 'c4'], ['B', 'h6']] },
    { bk: 'h8', wk: 'g6', w: [['B', 'c4'], ['B', 'f8']] },
    { bk: 'h8', wk: 'g6', w: [['B', 'b3'], ['B', 'h6']] },
    { bk: 'h8', wk: 'g6', w: [['B', 'a2'], ['B', 'f8']] },
    { bk: 'h8', wk: 'g6', w: [['B', 'd5'], ['B', 'h6']] },
    { bk: 'h8', wk: 'g6', w: [['B', 'e6'], ['B', 'h6']] },
    { bk: 'h8', wk: 'f6', w: [['B', 'c4'], ['B', 'h6']] },
    { bk: 'h8', wk: 'g5', w: [['B', 'c4'], ['B', 'f8']] }
  ],
  KNNK: [
    { bk: 'h8', wk: 'f7', w: [['N', 'f6'], ['N', 'e5']] },
    { bk: 'h8', wk: 'f7', w: [['N', 'g5'], ['N', 'e5']] },
    { bk: 'h8', wk: 'f7', w: [['N', 'f6'], ['N', 'e7']] },
    { bk: 'h8', wk: 'f7', w: [['N', 'g5'], ['N', 'e7']] },
    { bk: 'h8', wk: 'f7', w: [['N', 'f6'], ['N', 'h4']] },
    { bk: 'h8', wk: 'f7', w: [['N', 'g5'], ['N', 'f4']] },
    { bk: 'h8', wk: 'f7', w: [['N', 'f8'], ['N', 'e5']] },
    { bk: 'h8', wk: 'f6', w: [['N', 'f6'], ['N', 'e5']] }
  ],
  KQKR: [
    { bk: 'a8', wk: 'c7', w: [['Q', 'b6']], b: [['R', 'h1']] },
    { bk: 'a8', wk: 'c6', w: [['Q', 'b6']], b: [['R', 'h1']] },
    { bk: 'a8', wk: 'c7', w: [['Q', 'b5']], b: [['R', 'h1']] },
    { bk: 'a8', wk: 'b6', w: [['Q', 'c7']], b: [['R', 'h1']] },
    { bk: 'a8', wk: 'c7', w: [['Q', 'd6']], b: [['R', 'h1']] },
    { bk: 'a8', wk: 'c7', w: [['Q', 'b6']], b: [['R', 'h3']] }
  ],
  KRKB: [
    { bk: 'a8', wk: 'c7', w: [['R', 'b2']], b: [['B', 'h1']] },
    { bk: 'a8', wk: 'c6', w: [['R', 'b2']], b: [['B', 'h1']] },
    { bk: 'a8', wk: 'c7', w: [['R', 'b3']], b: [['B', 'h1']] },
    { bk: 'a8', wk: 'b6', w: [['R', 'c1']], b: [['B', 'h1']] }
  ],
  KQKQ: [
    { bk: 'a8', wk: 'c7', w: [['Q', 'b6']], b: [['Q', 'h1']] },
    { bk: 'a8', wk: 'c6', w: [['Q', 'b6']], b: [['Q', 'h1']] },
    { bk: 'a8', wk: 'c7', w: [['Q', 'b5']], b: [['Q', 'h1']] }
  ]
};

/* the eight symmetries of the board */
function symmetry(f, r, i) {
  switch (i) {
    case 0: return [f, r];
    case 1: return [7 - f, r];
    case 2: return [f, 7 - r];
    case 3: return [7 - f, 7 - r];
    case 4: return [r, f];
    case 5: return [7 - r, f];
    case 6: return [r, 7 - f];
    default: return [7 - r, 7 - f];
  }
}
function sqOf(name) {
  const f = 'abcdefgh'.indexOf(name[0]);
  const r = 8 - parseInt(name[1], 10);
  return { f, r };
}

function templateBoard(t, sym) {
  const board = emptyBoard();
  const put = (name, ch) => {
    const p = sqOf(name);
    const [nf, nr] = symmetry(p.f, p.r, sym);
    board[(7 - nr) * 8 + nf] = ch;   /* board row 0 is rank 1 */
  };
  put(t.bk, 'k');
  put(t.wk, 'K');
  for (const [piece, sq] of (t.w || [])) put(sq, piece);
  for (const [piece, sq] of (t.b || [])) put(sq, piece.toLowerCase());
  return board;
}

/* every square within a small radius of a square (0x88 index -> board index) */
function around(sq, radius) {
  const out = [];
  const f = sq % 8, r = Math.floor(sq / 8);
  for (let dr = -radius; dr <= radius; dr++) {
    for (let df = -radius; df <= radius; df++) {
      const nf = f + df, nr = r + dr;
      if (nf < 0 || nf > 7 || nr < 0 || nr > 7) continue;
      out.push(nr * 8 + nf);
    }
  }
  return out;
}

/* candidate positions: the template itself plus small perturbations of the
 * black king and of every non-king piece. */
function candidates(kind, sym, t) {
  const board = templateBoard(t, sym);
  const out = [board.slice()];
  const pieces = [];
  for (let i = 0; i < 64; i++) if (board[i]) pieces.push(i);
  for (const from of pieces) {
    const piece = board[from];
    /* the defending king may be pushed further away, the rest less so */
    const radius = piece === 'k' ? 3 : 2;
    for (const to of around(from, radius)) {
      if (board[to]) continue;
      const copy = board.slice();
      copy[from] = '';
      copy[to] = piece;
      out.push(copy);
    }
  }
  return out;
}

function positionOf(board) {
  const fen = boardToFen(board, 'w');
  let pos;
  try { pos = new C.Position(fen); } catch (e) { return null; }
  if (!pos.legalMoves().length) return null;
  if (!legalPosition(pos)) return null;
  return pos;
}

/* the forced mating line: our move, their best reply, our next move ... */
function matingLine(pos, dist) {
  const line = [];
  const cur = pos.clone();
  for (let i = 0; i < dist; i++) {
    const r2 = search(cur, 4);
    if (!r2 || !r2.move) return null;
    const m2 = cur.legalMoves().find((m) => C.moveKey(m) === C.moveKey(r2.move));
    if (!m2) return null;
    line.push(sanOf(cur, m2));
    cur.makeMove(m2);
    if (i < dist - 1) {
      const r3 = search(cur, 4);
      if (!r3 || !r3.move) return null;
      const m3 = cur.legalMoves().find((m) => C.moveKey(m) === C.moveKey(r3.move));
      if (!m3) return null;
      line.push(sanOf(cur, m3));
      cur.makeMove(m3);
    }
  }
  const res = cur.gameResult();
  if (res !== '1-0') return null;
  return line;
}

function buildEndgames(kind, goal, target) {
  const out = [];
  const seen = new Set();
  const templates = TEMPLATES[kind] || [];
  const depth = Math.min(8, 2 * goal + 1);
  let budget = 2500;
  for (const t of templates) {
    for (let sym = 0; sym < 8; sym++) {
      for (const board of candidates(kind, sym, t)) {
        if (out.length >= target) return out;
        if (budget-- <= 0) return out;
        const pos = positionOf(board);
        if (!pos) continue;
        const fen = pos.fen();
        if (seen.has(fen)) continue;
        const res = search(pos, depth);
        if (!res || !res.move || res.score < MATE - 1000) continue;
        const dist = Math.ceil((MATE - res.score) / 2);
        if (dist !== goal) continue;
        const line = matingLine(pos, dist);
        if (!line || !line.length) continue;
        seen.add(fen);
        out.push({ fen, sol: line[0], line, goal: dist, kind, side: 'w' });
      }
    }
  }
  return out;
}

/* king + pawn: the drill is "promote the pawn", not mate */
function buildPawnDrills(target) {
  const out = [];
  const seen = new Set();
  let attempts = 0;
  while (out.length < target && attempts < target * 200) {
    attempts++;
    const board = emptyBoard();
    const squares = shuffledSquares();
    let idx = 0;
    /* white pawn on ranks 4, 5 or 6 so the promotion takes 2 to 4 pushes
     * (board row 0 is rank 1, so rows 3..5 are ranks 4, 5 and 6) */
    let pawnSq = -1;
    while (idx < squares.length) {
      const sq = squares[idx++];
      const r = Math.floor(sq / 8);
      if (r >= 3 && r <= 5) { pawnSq = sq; break; }
    }
    if (pawnSq < 0) continue;
    board[pawnSq] = 'P';
    /* the white king walks beside the pawn, never in front of it */
    let wkSq = -1;
    for (let i = idx; i < squares.length; i++) {
      const sq = squares[i];
      const df = Math.abs((sq % 8) - (pawnSq % 8));
      const dr = Math.floor(sq / 8) - Math.floor(pawnSq / 8);
      if (df === 1 && dr >= -2 && dr <= -1) { wkSq = sq; idx = i + 1; break; }
    }
    if (wkSq < 0) continue;
    board[wkSq] = 'K';
    /* the black king is too far away to catch the pawn */
    let bkSq = -1;
    for (let i = idx; i < squares.length; i++) {
      const sq = squares[i];
      const df = Math.abs((sq % 8) - (pawnSq % 8));
      const dr = Math.abs(Math.floor(sq / 8) - Math.floor(pawnSq / 8));
      if (df + dr >= 5) { bkSq = sq; break; }
    }
    if (bkSq < 0) continue;
    board[bkSq] = 'k';

    const fen = boardToFen(board, 'w');
    let pos;
    try { pos = new C.Position(fen); } catch (e) { continue; }
    if (!legalPosition(pos)) continue;
    if (!pos.legalMoves().length) continue;
    if (seen.has(fen)) continue;

    const pushes = 7 - Math.floor(pawnSq / 8);   /* row 3 == rank 4 == 4 pushes */
    if (pushes < 2 || pushes > 4) continue;

    /* the engine must see the position as clearly won */
    const probe = search(pos, 6);
    if (!probe || probe.score < 400) continue;

    /* walk the pawn home, letting the black king reply */
    const cur = pos.clone();
    const line = [];
    let ok = true;
    let promoted = false;
    for (let i = 0; i < pushes; i++) {
      const pawnMoves = cur.legalMoves().filter((m) => C.typeOf(m.piece) === C.PAWN);
      if (!pawnMoves.length) { ok = false; break; }
      const push = pawnMoves.find((m) => m.to === m.from - 16 && (!m.promo || m.promo === C.QUEEN)) ||
                   pawnMoves.find((m) => m.to === m.from - 16) || pawnMoves[0];
      line.push(sanOf(cur, push));
      cur.makeMove(push);
      if (i === pushes - 1) { promoted = true; break; }
      const reply = search(cur, 4);
      if (!reply || !reply.move) { ok = false; break; }
      const rm = cur.legalMoves().find((m) => C.moveKey(m) === C.moveKey(reply.move));
      if (!rm) { ok = false; break; }
      line.push(sanOf(cur, rm));
      cur.makeMove(rm);
      const still = search(cur, 5);
      if (!still || still.score < 300) { ok = false; break; }
    }
    if (!ok || !promoted) continue;

    /* the pawn really has to be a piece on the eighth rank now */
    let onEighth = false;
    for (let sq = 0; sq < 128; sq++) {
      if (!C.onBoard(sq) || C.rankOf(sq) !== 0) continue;
      const piece = cur.board[sq];
      if (!piece || C.colorOf(piece) !== C.WHITE) continue;
      if (C.typeOf(piece) === C.KING) continue;
      onEighth = true;
    }
    if (!onEighth) continue;

    seen.add(fen);
    out.push({ fen, sol: line[0], line, goal: pushes, kind: 'KPK', side: 'w' });
  }
  return out;
}

/* ------------------------------------------------------------------ */

const puzzles = buildPuzzles(Number(process.env.PUZZLES || 160));
console.log('puzzles:', puzzles.length);

const endgames = {};
for (const kind of Object.keys(TEMPLATES)) {
  endgames[kind] = [];
  const seen = new Set();
  for (const goal of [1, 2, 3]) {
    const list = buildEndgames(kind, goal, Number(process.env.EG_PER_GOAL || 8));
    for (const d of list) {
      if (seen.has(d.fen)) continue;
      seen.add(d.fen);
      endgames[kind].push(d);
    }
    console.log(`  ${kind} mate in ${goal}:`, list.length);
  }
  console.log(`endgame ${kind}:`, endgames[kind].length,
    endgames[kind].reduce((a, d) => { a[d.goal] = (a[d.goal] || 0) + 1; return a; }, {}));
}
endgames.KPK = buildPawnDrills(Number(process.env.EG_PER_GOAL || 8));
console.log('endgame KPK promotion drills:', endgames.KPK.length);

fs.writeFileSync(
  path.join(here, 'datasets.json'),
  JSON.stringify({ puzzles, endgames }, null, 1),
);
console.log('wrote', path.join(here, 'datasets.json'));
