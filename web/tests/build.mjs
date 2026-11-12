/* Splices the authored data + application scripts into the single-file app.
 *
 *   node web/tests/build.mjs
 *
 * web/src/data.js and web/src/app.js are plain scripts; this file replaces the
 * placeholder <script id="data"> and <script id="app"> blocks inside
 * web/chess-trainer.html with them.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { OPENINGS, LESSONS, SHORTCUTS } from '../src/content.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const target = path.join(root, 'chess-trainer.html');

let html = fs.readFileSync(target, 'utf8');

function inject(html, id, source) {
  const re = new RegExp(`(<script id="${id}">)[\\s\\S]*?(</script>)`);
  if (!re.test(html)) throw new Error(`no <script id="${id}"> block found`);
  return html.replace(re, (_m, open, close) => open + '\n' + source.trim() + '\n' + close);
}

const datasets = JSON.parse(fs.readFileSync(path.join(here, 'datasets.json'), 'utf8'));

let data = fs.readFileSync(path.join(root, 'src', 'data.js'), 'utf8');
data = data
  .replace('/*__PUZZLES__*/[]', JSON.stringify(datasets.puzzles))
  .replace('/*__ENDGAMES__*/{}', JSON.stringify(datasets.endgames))
  .replace('/*__OPENINGS__*/[]', JSON.stringify(OPENINGS))
  .replace('/*__LESSONS__*/[]', JSON.stringify(LESSONS))
  .replace('/*__SHORTCUTS__*/[]', JSON.stringify(SHORTCUTS));

const app = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');

html = inject(html, 'data', data);
html = inject(html, 'app', app);

fs.writeFileSync(target, html);
console.log('built', target, (html.length / 1024).toFixed(1) + ' KB');
