#!/usr/bin/env python3
"""Independent validation of the embedded puzzle and endgame datasets.

    python3 web/tests/validate-datasets.py [path/to/datasets.json]

Every position is checked with python-chess (a completely separate
implementation from the JavaScript engine that generated the data):

  * the FEN must be a legal position,
  * the stored solution must be a legal move,
  * the stored reply must be legal after the solution,
  * every endgame line must be legal and must end in checkmate with
    exactly the advertised mate distance,
  * pawn drills must end with a real promotion.
"""
import json
import os
import sys

import chess


def mate_in(board, depth, memo=None):
    """True when white can force mate using at most `depth` white moves."""
    if memo is None:
        memo = {}
    if depth <= 0:
        return False
    key = (board.fen(), depth)
    if key in memo:
        return memo[key]
    result = False
    for move in board.legal_moves:
        board.push(move)
        replies = list(board.legal_moves)
        if not replies:
            ok = board.is_checkmate()
        else:
            ok = True
            for reply in replies:
                board.push(reply)
                if not mate_in(board, depth - 1, memo):
                    ok = False
                    board.pop()
                    break
                board.pop()
        board.pop()
        if ok:
            result = True
            break
    memo[key] = result
    return result


def mate_distance(board, limit=3):
    """Number of white moves needed to force mate, or None."""
    for d in range(1, limit + 1):
        if mate_in(board, d, {}):
            return d
    return None


def check_position(board, label, errors):
    status = board.status()
    if status != chess.STATUS_VALID:
        errors.append("%s: illegal position (%s) %s" % (label, chess.status(status), board.fen()))
        return False
    return True


def validate_puzzles(data, errors):
    puzzles = data.get("puzzles", [])
    seen = set()
    for i, p in enumerate(puzzles):
        label = "puzzle %d" % i
        board = chess.Board(p["fen"])
        if not check_position(board, label, errors):
            continue
        if p["fen"] in seen:
            errors.append("%s: duplicate position %s" % (label, p["fen"]))
        seen.add(p["fen"])
        try:
            move = board.parse_san(p["sol"])
        except Exception as exc:            # noqa: BLE001
            errors.append("%s: solution %r is not a legal move (%s)" % (label, p["sol"], exc))
            continue
        board.push(move)
        if p.get("reply"):
            try:
                board.parse_san(p["reply"])
            except Exception as exc:        # noqa: BLE001
                errors.append("%s: reply %r is not legal after the solution (%s)"
                              % (label, p["reply"], exc))
        if p.get("mate") == 1 and not board.is_checkmate():
            errors.append("%s: claims mate in 1 but the position is not checkmate" % label)
        if p.get("swing") and p["swing"] < 0:
            errors.append("%s: negative swing %s" % (label, p["swing"]))
        if not p.get("tags"):
            errors.append("%s: no theme tags" % label)
    return len(puzzles)


def validate_endgames(data, errors):
    endgames = data.get("endgames", {})
    total = 0
    for kind, drills in endgames.items():
        seen = set()
        for i, d in enumerate(drills):
            label = "%s drill %d" % (kind, i)
            total += 1
            board = chess.Board(d["fen"])
            if not check_position(board, label, errors):
                continue
            if d["fen"] in seen:
                errors.append("%s: duplicate position" % label)
            seen.add(d["fen"])
            line = d.get("line") or []
            if not line:
                errors.append("%s: empty line" % label)
                continue
            try:
                board.parse_san(line[0])
            except Exception as exc:        # noqa: BLE001
                errors.append("%s: first move %r is illegal (%s)" % (label, line[0], exc))
                continue
            if kind == "KPK":
                promoted = False
                for san in line:
                    try:
                        board.push(board.parse_san(san))
                    except Exception as exc:    # noqa: BLE001
                        errors.append("%s: move %r is illegal (%s)" % (label, san, exc))
                        break
                    if board.piece_at(board.king(chess.WHITE) or chess.A1):
                        pass
                    if any(board.piece_at(sq) and board.piece_at(sq).piece_type != chess.PAWN
                           and board.piece_at(sq).color == chess.WHITE
                           and chess.square_rank(sq) == 7
                           for sq in chess.SQUARES):
                        promoted = True
                if not promoted:
                    errors.append("%s: the pawn never promotes" % label)
                if board.is_checkmate():
                    errors.append("%s: pawn drill ends in checkmate" % label)
            else:
                for san in line:
                    try:
                        board.push(board.parse_san(san))
                    except Exception as exc:    # noqa: BLE001
                        errors.append("%s: move %r is illegal (%s)" % (label, san, exc))
                        break
                if not board.is_checkmate():
                    errors.append("%s: the line does not end in checkmate" % label)
                else:
                    goal = d.get("goal")
                    if goal:
                        start = chess.Board(d["fen"])
                        distance = mate_distance(start, limit=goal)
                        if distance != goal:
                            errors.append("%s: claims mate in %d but the true distance is %s"
                                          % (label, goal, distance))
    return total


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(here, "datasets.json")
    with open(path, "r", encoding="utf-8") as handle:
        data = json.load(handle)

    errors = []
    puzzles = validate_puzzles(data, errors)
    drills = validate_endgames(data, errors)

    print("validated %d puzzles and %d endgame drills from %s" % (puzzles, drills, path))
    if errors:
        print("\n%d problem(s):" % len(errors))
        for err in errors[:60]:
            print("  -", err)
        if len(errors) > 60:
            print("  ... and %d more" % (len(errors) - 60))
        sys.exit(1)
    print("all positions legal, all solutions and lines verified")


if __name__ == "__main__":
    main()
