/* A deliberately naive, independent chess move generator used to cross-check
 * the optimised 0x88 generator inside chess-trainer.html.
 *
 * Board representation: 64 character array, index 0 = a1 .. 63 = h8.
 */

const WHITE_PIECES = 'PNBRQK';
const BLACK_PIECES = 'pnbrqk';

export function parseFen(fen) {
  const parts = fen.trim().split(/\s+/);
  const board = new Array(64).fill('.');
  const rows = parts[0].split('/');
  for (let r = 0; r < 8; r++) {
    let file = 0;
    for (const ch of rows[r]) {
      if (ch >= '1' && ch <= '8') file += Number(ch);
      else board[(7 - r) * 8 + file++] = ch;
    }
  }
  const turn = parts[1] === 'b' ? 'b' : 'w';
  const castling = parts[2] || '-';
  const ep = parts[3] && parts[3] !== '-' ? parts[3] : null;
  return { board, turn, castling, ep, half: Number(parts[4] || 0), full: Number(parts[5] || 1) };
}

const idx = (file, rank) => rank * 8 + file;          // rank 0 = rank 1
const fileOf = (i) => i % 8;
const rankOf = (i) => Math.floor(i / 8);
const sqName = (i) => 'abcdefgh'[fileOf(i)] + (rankOf(i) + 1);
const nameIdx = (name) => idx('abcdefgh'.indexOf(name[0]), Number(name[1]) - 1);

const KNIGHT = [-2, -1, 1, 2, 2, 1, -1, -2];
const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function attackedBy(board, square, byWhite) {
  const f = fileOf(square), r = rankOf(square);
  const pieces = byWhite ? WHITE_PIECES : BLACK_PIECES;
  const sliders = byWhite ? 'NBRQ' : 'nbrq';
  const at = (ff, rr) => (ff < 0 || ff > 7 || rr < 0 || rr > 7) ? '.' : board[idx(ff, rr)];
  // pawns
  const dir = byWhite ? 1 : -1;
  for (const df of [-1, 1]) {
    const p = at(f + df, r - dir);
    if (p === (byWhite ? 'P' : 'p')) return true;
  }
  // knights
  for (const [df, dr] of [[-2, 1], [-2, -1], [-1, 2], [-1, -2], [1, 2], [1, -2], [2, 1], [2, -1]]) {
    if (at(f + df, r + dr) === (byWhite ? 'N' : 'n')) return true;
  }
  // king
  for (const df of [-1, 0, 1]) for (const dr of [-1, 0, 1]) {
    if (df === 0 && dr === 0) continue;
    if (at(f + df, r + dr) === (byWhite ? 'K' : 'k')) return true;
  }
  // sliders: bishops/queens on diagonals, rooks/queens on orthogonals
  for (const [df, dr] of DIAG) {
    let ff = f + df, rr = r + dr;
    while (ff >= 0 && ff <= 7 && rr >= 0 && rr <= 7) {
      const p = board[idx(ff, rr)];
      if (p !== '.') {
        if ((byWhite ? 'BQ' : 'bq').includes(p)) return true;
        break;
      }
      ff += df; rr += dr;
    }
  }
  for (const [df, dr] of ORTH) {
    let ff = f + df, rr = r + dr;
    while (ff >= 0 && ff <= 7 && rr >= 0 && rr <= 7) {
      const p = board[idx(ff, rr)];
      if (p !== '.') {
        if ((byWhite ? 'RQ' : 'rq').includes(p)) return true;
        break;
      }
      ff += df; rr += dr;
    }
  }
  void pieces; void sliders;
  return false;
}

export function pseudoMoves(state) {
  const { board, turn, castling, ep } = state;
  const out = [];
  const white = turn === 'w';
  const own = white ? WHITE_PIECES : BLACK_PIECES;
  const enemy = white ? BLACK_PIECES : WHITE_PIECES;
  const push = (from, to, promo) => out.push({ from, to, promo: promo || '' });

  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (p === '.' || !own.includes(p)) continue;
    const f = fileOf(i), r = rankOf(i);
    switch (p.toUpperCase()) {
      case 'P': {
        const dir = white ? 1 : -1;
        const start = white ? 1 : 6;
        const last = white ? 7 : 0;
        const one = r + dir;
        if (one >= 0 && one <= 7 && board[idx(f, one)] === '.') {
          if (one === last) for (const pr of ['q', 'r', 'b', 'n']) push(i, idx(f, one), pr);
          else {
            push(i, idx(f, one));
            if (r === start && board[idx(f, r + 2 * dir)] === '.') push(i, idx(f, r + 2 * dir));
          }
        }
        for (const df of [-1, 1]) {
          const ff = f + df;
          if (ff < 0 || ff > 7 || one < 0 || one > 7) continue;
          const target = board[idx(ff, one)];
          if (target !== '.' && enemy.includes(target)) {
            if (one === last) for (const pr of ['q', 'r', 'b', 'n']) push(i, idx(ff, one), pr);
            else push(i, idx(ff, one));
          } else if (target === '.' && ep && idx(ff, one) === nameIdx(ep)) {
            push(i, idx(ff, one));
          }
        }
        break;
      }
      case 'N':
        for (const [df, dr] of [[-2, 1], [-2, -1], [-1, 2], [-1, -2], [1, 2], [1, -2], [2, 1], [2, -1]]) {
          const ff = f + df, rr = r + dr;
          if (ff < 0 || ff > 7 || rr < 0 || rr > 7) continue;
          const target = board[idx(ff, rr)];
          if (target === '.') push(i, idx(ff, rr));
          else if (enemy.includes(target)) push(i, idx(ff, rr));
        }
        break;
      case 'B': case 'R': case 'Q': {
        const dirs = p.toUpperCase() === 'B' ? DIAG : p.toUpperCase() === 'R' ? ORTH : [...DIAG, ...ORTH];
        for (const [df, dr] of dirs) {
          let ff = f + df, rr = r + dr;
          while (ff >= 0 && ff <= 7 && rr >= 0 && rr <= 7) {
            const target = board[idx(ff, rr)];
            if (target === '.') push(i, idx(ff, rr));
            else {
              if (enemy.includes(target)) push(i, idx(ff, rr));
              break;
            }
            ff += df; rr += dr;
          }
        }
        break;
      }
      case 'K':
        for (const df of [-1, 0, 1]) for (const dr of [-1, 0, 1]) {
          if (df === 0 && dr === 0) continue;
          const ff = f + df, rr = r + dr;
          if (ff < 0 || ff > 7 || rr < 0 || rr > 7) continue;
          const target = board[idx(ff, rr)];
          if (target === '.') push(i, idx(ff, rr));
          else if (enemy.includes(target)) push(i, idx(ff, rr));
        }
        break;
    }
  }

  /* castling */
  const kingSq = white ? idx(4, 0) : idx(4, 7);
  if (board[kingSq] === (white ? 'K' : 'k') && !attackedBy(board, kingSq, !white)) {
    if (white && castling.includes('K') && board[idx(7, 0)] === 'R' &&
        board[idx(5, 0)] === '.' && board[idx(6, 0)] === '.' &&
        !attackedBy(board, idx(5, 0), false) && !attackedBy(board, idx(6, 0), false)) {
      push(kingSq, idx(6, 0));
    }
    if (white && castling.includes('Q') && board[idx(0, 0)] === 'R' &&
        board[idx(1, 0)] === '.' && board[idx(2, 0)] === '.' && board[idx(3, 0)] === '.' &&
        !attackedBy(board, idx(3, 0), false) && !attackedBy(board, idx(2, 0), false)) {
      push(kingSq, idx(2, 0));
    }
    if (!white && castling.includes('k') && board[idx(7, 7)] === 'r' &&
        board[idx(5, 7)] === '.' && board[idx(6, 7)] === '.' &&
        !attackedBy(board, idx(5, 7), true) && !attackedBy(board, idx(6, 7), true)) {
      push(kingSq, idx(6, 7));
    }
    if (!white && castling.includes('q') && board[idx(0, 7)] === 'r' &&
        board[idx(1, 7)] === '.' && board[idx(2, 7)] === '.' && board[idx(3, 7)] === '.' &&
        !attackedBy(board, idx(3, 7), true) && !attackedBy(board, idx(2, 7), true)) {
      push(kingSq, idx(2, 7));
    }
  }
  return out;
}

export function legalMoves(state) {
  const out = [];
  for (const mv of pseudoMoves(state)) {
    const next = applyMove(state, mv);
    if (next === null) continue;
    const white = state.turn === 'w';
    const king = next.board.indexOf(white ? 'K' : 'k');
    if (king < 0) continue;
    if (!attackedBy(next.board, king, !white)) out.push(mv);
  }
  return out;
}

export function applyMove(state, mv) {
  const board = state.board.slice();
  const white = state.turn === 'w';
  const piece = board[mv.from];
  let captured = board[mv.to];
  let castling = state.castling;
  let ep = null;
  const pieceType = piece.toUpperCase();

  /* en passant */
  if (pieceType === 'P' && captured === '.' && state.ep && mv.to === nameIdx(state.ep)) {
    const capSq = mv.to + (white ? -8 : 8);
    captured = board[capSq];
    board[capSq] = '.';
  }

  board[mv.from] = '.';
  board[mv.to] = mv.promo ? (white ? mv.promo.toUpperCase() : mv.promo) : piece;

  if (pieceType === 'K') castling = white ? castling.replace(/[KQ]/g, '') : castling.replace(/[kq]/g, '');
  if (mv.from === idx(7, 0) || mv.to === idx(7, 0)) castling = castling.replace(/K/g, '');
  if (mv.from === idx(0, 0) || mv.to === idx(0, 0)) castling = castling.replace(/Q/g, '');
  if (mv.from === idx(7, 7) || mv.to === idx(7, 7)) castling = castling.replace(/k/g, '');
  if (mv.from === idx(0, 7) || mv.to === idx(0, 7)) castling = castling.replace(/q/g, '');

  /* castling rook */
  if (pieceType === 'K' && Math.abs(fileOf(mv.to) - fileOf(mv.from)) === 2) {
    if (fileOf(mv.to) === 6) {
      board[idx(5, rankOf(mv.to))] = board[idx(7, rankOf(mv.to))];
      board[idx(7, rankOf(mv.to))] = '.';
    } else {
      board[idx(3, rankOf(mv.to))] = board[idx(0, rankOf(mv.to))];
      board[idx(0, rankOf(mv.to))] = '.';
    }
  }

  if (pieceType === 'P' && Math.abs(rankOf(mv.to) - rankOf(mv.from)) === 2) {
    ep = sqName(idx(fileOf(mv.from), (rankOf(mv.from) + rankOf(mv.to)) / 2));
  }

  return {
    board,
    turn: white ? 'b' : 'w',
    castling: castling || '-',
    ep,
    half: (pieceType === 'P' || captured !== '.') ? 0 : state.half + 1,
    full: white ? state.full : state.full + 1
  };
}

export function toFen(state) {
  let out = '';
  for (let r = 7; r >= 0; r--) {
    let empty = 0;
    for (let f = 0; f < 8; f++) {
      const p = state.board[idx(f, r)];
      if (p === '.') { empty++; continue; }
      if (empty) { out += empty; empty = 0; }
      out += p;
    }
    if (empty) out += empty;
    if (r > 0) out += '/';
  }
  out += ' ' + state.turn + ' ' + (state.castling || '-') + ' ' + (state.ep || '-') +
    ' ' + state.half + ' ' + state.full;
  return out;
}

export function moveKey(mv) {
  return sqName(mv.from) + sqName(mv.to) + (mv.promo || '');
}

export { sqName, nameIdx, idx };
