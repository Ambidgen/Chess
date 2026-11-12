#!/usr/bin/env python3
"""Generate ground truth legal-move data with python-chess.

    python3 web/tests/gen_reference.py > web/tests/reference-moves.json

The JSON file is used by cross-check.py / core.test.mjs to validate the
hand written move generator inside chess-trainer.html.
"""
import json
import random
import sys

import chess

SEEDS = [
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1",
    "r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1",
    "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1",
    "rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8",
    "r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10",
    "rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3",
    "4k3/8/8/8/8/8/8/4K2R w K - 0 1",
    "8/8/8/8/8/8/6k1/4K2R w K - 0 1",
    "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 b - - 3 17",
    "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1",
]

PERFT = [
    ("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", [20, 400, 8902, 197281, 4865609]),
    ("r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1", [48, 2039, 97862, 4085603]),
    ("8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1", [14, 191, 2812, 43238, 674624]),
    ("r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1", [6, 264, 9467, 422333]),
    ("rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8", [44, 1486, 62379, 2103487]),
    ("r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10", [46, 2079, 89890, 3894594]),
]


def perft(board, depth):
    if depth == 0:
        return 1
    if depth == 1:
        return board.legal_moves.count()
    n = 0
    for m in board.legal_moves:
        board.push(m)
        n += perft(board, depth - 1)
        board.pop()
    return n


def main():
    out = {"perft": {}, "positions": []}

    for fen, expected in PERFT:
        board = chess.Board(fen)
        results = []
        for depth, exp in enumerate(expected, start=1):
            got = perft(board, depth)
            results.append({"depth": depth, "expected": exp, "got": got, "ok": got == exp})
            if got != exp:
                print(f"PERFT MISMATCH {fen} depth {depth}: expected {exp} got {got}", file=sys.stderr)
        out["perft"][fen] = results

    positions = {}

    def record(board):
        fen = board.fen()
        if fen in positions:
            return
        positions[fen] = sorted(m.uci() for m in board.legal_moves)

    rng = random.Random(20240101)
    for seed in SEEDS:
        board = chess.Board(seed)
        for _ in range(260):
            record(board)
            moves = list(board.legal_moves)
            if not moves:
                break
            board.push(rng.choice(moves))

    # every position reachable in the first ply of each seed
    for seed in SEEDS:
        board = chess.Board(seed)
        for m in list(board.legal_moves):
            board.push(m)
            record(board)
            board.pop()

    out["positions"] = positions
    json.dump(out, sys.stdout)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
