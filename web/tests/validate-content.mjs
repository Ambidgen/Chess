/* Validates the embedded opening repertoire and lesson material.
 *
 *   node web/tests/validate-content.mjs
 *
 * Every opening line is played move by move with the engine that ships in
 * the page; a line that cannot be played is a content bug, not a parser
 * bug.  The same lines are re-checked with python-chess by
 * web/tests/validate-content.py.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { OPENINGS, LESSONS, SHORTCUTS } from '../src/content.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(here, '..', 'chess-trainer.html'), 'utf8');
const core = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const sandbox = { console, performance, Date, Math, JSON };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(core, sandbox, { filename: 'core' });
const C = sandbox.ChessCore;

let failed = 0;
const errors = [];

for (const op of OPENINGS) {
  if (!op.id || !op.name || !op.eco) {
    errors.push(`${op.id || '?'}: missing id/name/eco`);
    continue;
  }
  if (!Array.isArray(op.moves) || !op.moves.length) {
    errors.push(`${op.id}: no moves`);
    continue;
  }
  if (!Array.isArray(op.ideas) || !op.ideas.length) {
    errors.push(`${op.id}: no ideas`);
  }
  const pos = new C.Position(C.START_FEN);
  for (const san of op.moves) {
    const mv = pos.sanToMove(san);
    if (!mv) {
      errors.push(`${op.id}: illegal move ${san} in ${pos.fen()}`);
      break;
    }
    pos.makeMove(mv);
  }
}

for (const lesson of LESSONS) {
  if (!lesson.id || !lesson.title || !lesson.summary) {
    errors.push(`${lesson.id || '?'}: missing id/title/summary`);
    continue;
  }
  if (!Array.isArray(lesson.body) || !lesson.body.length) {
    errors.push(`${lesson.id}: empty lesson body`);
    continue;
  }
  for (const chunk of lesson.body) {
    if (typeof chunk !== 'string' || !chunk.length) {
      errors.push(`${lesson.id}: malformed body chunk`);
    }
  }
}

if (!Array.isArray(SHORTCUTS) || !SHORTCUTS.length) {
  errors.push('no keyboard shortcuts defined');
}
for (const sc of SHORTCUTS) {
  if (!Array.isArray(sc) || sc.length !== 2) errors.push('malformed shortcut entry');
}

console.log(`checked ${OPENINGS.length} openings, ${LESSONS.length} lessons, ${SHORTCUTS.length} shortcuts`);
if (errors.length) {
  failed = errors.length;
  console.log(`${failed} problem(s):`);
  errors.forEach((e) => console.log('  -', e));
}
process.exit(failed ? 1 : 0);
