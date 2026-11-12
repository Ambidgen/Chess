# Chess Trainer

A complete, self-contained chess trainer that runs from a single HTML file.

```
web/chess-trainer.html      <- the deliverable: open it in any browser
```

No network access, no CDN, no fonts, no images, no libraries. The pieces are
inline SVG, the fonts are system stacks, and every script is embedded in the
page. The file works from `file://`.

## What is inside the page

| Area | What it does |
| --- | --- |
| **Play** | Games against the built-in engine at six levels, side choice, chess clocks, move list, PGN export/import, undo, board flip. |
| **Puzzles** | 160 verified tactics with themes, ratings, hints and solutions. Filters for mate, material wins and quiet "best move" puzzles. |
| **Endgames** | 148 positions across eight material endings: mate in 1/2/3 for KQK, KRK, KBBK, KNNK, KQKR, KRKB and KQKQ, plus king-and-pawn promotion drills. |
| **Openings** | 38 named opening lines with ideas, a move-by-move trainer and a quiz. |
| **Analysis** | FEN and PGN input, engine search with score, depth, nodes, time and principal variation, evaluation bar. |
| **Learn** | Nine lessons on the rules, notation and strategy, plus the keyboard shortcut list. |

The engine is a from-scratch JavaScript implementation: legal move generation
with all special cases, SAN/PGN handling, a transposition table, iterative
deepening, quiescence search, null-move pruning and killers.

## Source layout

```
web/src/app.js        application logic (board, panels, engine, drills)
web/src/data.js       inline SVG pieces + injected datasets
web/src/content.mjs   opening repertoire, lessons, shortcuts
web/tests/            test harnesses and the dataset generator
```

`web/chess-trainer.html` is both the source template and the build output:
`web/tests/build.mjs` splices `src/data.js` and `src/app.js` into the
`<script id="data">` and `<script id="app">` blocks.

```bash
node web/tests/build.mjs            # rebuild web/chess-trainer.html
```

## Tests

```bash
node web/tests/core.test.mjs          # 96 chess-core assertions, perft, SAN, PGN
node web/tests/cross-check.mjs        # differential test against an independent engine
node web/tests/compare-reference.mjs  # differential test against python-chess
node web/tests/validate-content.mjs   # opening lines, lessons and shortcuts
python3 web/tests/validate-content.py # the same openings, checked with python-chess
python3 web/tests/validate-datasets.py # puzzles and endgame drills, checked with python-chess
```

The DOM harness needs jsdom:

```bash
npm install --prefix /tmp/domtest jsdom
NODE_PATH=/tmp/domtest/node_modules node web/tests/app.test.mjs
```

## Regenerating the datasets

```bash
node web/tests/gen-datasets.mjs      # writes web/tests/datasets.json
```

The generator plays no games by hand: it searches for positions with the
engine that ships in the page, checks every position for legality, verifies
that each tactic wins material (or mates) and that each endgame line ends in
checkmate with exactly the advertised distance. `web/tests/validate-datasets.py`
re-checks the result with python-chess, which shares no code with the app.

Environment variables: `SEED` (PRNG seed), `PUZZLES` (puzzle count),
`EG_PER_GOAL` (endgame positions per mate distance), `DEBUG_PUZZLE` (statistics).
