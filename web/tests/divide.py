#!/usr/bin/env python3
"""Print a perft divide for a FEN (ground truth via python-chess).

    python3 web/tests/divide.py "<fen>" <depth>
"""
import sys
import chess


def perft(b, d):
    if d == 0:
        return 1
    if d == 1:
        return b.legal_moves.count()
    n = 0
    for m in b.legal_moves:
        b.push(m)
        n += perft(b, d - 1)
        b.pop()
    return n


fen = sys.argv[1]
depth = int(sys.argv[2]) if len(sys.argv) > 2 else 2
b = chess.Board(fen)
total = 0
for m in b.legal_moves:
    b.push(m)
    c = perft(b, depth - 1)
    b.pop()
    total += c
    print(m.uci(), c)
print("TOTAL", total)
