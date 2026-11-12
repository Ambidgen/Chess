#!/usr/bin/env python3
"""Re-checks the embedded opening repertoire with python-chess.

    python3 web/tests/validate-content.py

The repertoire lives in web/src/content.mjs; this script pulls the move
lists straight out of that module so that the shipped content is checked
by an engine that shares no code with the application.
"""
import json
import os
import re
import subprocess
import sys

import chess

HERE = os.path.dirname(os.path.abspath(__file__))
CONTENT = os.path.join(HERE, "..", "src", "content.mjs")


def load_openings():
    """Reads the moves arrays out of the ES module with a tiny parser."""
    text = open(CONTENT, "r", encoding="utf-8").read()
    start = text.index("export const OPENINGS")
    end = text.index("export const LESSONS")
    block = text[start:end]
    openings = []
    for match in re.finditer(r"id:\s*'([^']+)'.*?moves:\s*\[([^\]]*)\]", block, re.S):
        ident, moves = match.group(1), match.group(2)
        sans = re.findall(r"'([^']+)'", moves)
        openings.append((ident, sans))
    return openings


def main():
    openings = load_openings()
    if not openings:
        print("no openings found in", CONTENT)
        sys.exit(1)
    problems = []
    for ident, sans in openings:
        board = chess.Board()
        for san in sans:
            try:
                board.push_san(san)
            except Exception as exc:        # noqa: BLE001
                problems.append("%s: %s is not legal (%s)" % (ident, san, exc))
                break
    print("checked %d opening lines with python-chess" % len(openings))
    if problems:
        print("%d problem(s):" % len(problems))
        for p in problems:
            print("  -", p)
        sys.exit(1)
    print("all opening lines are legal")


if __name__ == "__main__":
    main()
