/* Embedded data for the Chess Trainer: inline SVG pieces, verified puzzle and
 * endgame datasets, opening repertoire and lesson material.
 *
 * Everything here is plain data - no network access, no external assets.
 */
(function () {
  'use strict';

  /* ------------------------------------------------------------------
     Inline SVG pieces (45 x 45 viewBox).
     Colours come from CSS custom properties so the light/dark themes and the
     two piece styles are handled entirely by the stylesheet.
     ------------------------------------------------------------------ */
  var PIECES = {
    p:
      '<circle cx="22.5" cy="11.4" r="5.6"/>' +
      '<path d="M18.4 18c-1.4 1.7-3.6 3.6-4.8 6.6-.6 1.5-1 3.1-1.1 4.9h20c-.1-1.8-.5-3.4-1.1-4.9-1.2-3-3.4-4.9-4.8-6.6-.9.6-2 1-3.2 1s-2.3-.4-3.2-1z"/>' +
      '<path d="M12.5 29.5h20v3.4h-20z"/><path d="M10.4 32.9h24.2v3.6H10.4z"/>',
    r:
      '<path d="M11.6 33.4h21.8v3.6H11.6z"/><path d="M13.6 29.4h17.8v4h-17.8z"/>' +
      '<path d="M13 12h4.4v4.2h3.1v-4.2h4.4v4.2h3.1v-4.2H32.4v9.4H13z"/>' +
      '<path d="M15.4 21.4h14.2v8H15.4z"/>',
    n:
      '<path d="M13.4 25.2C12.6 21.6 13.6 18 16.2 15.2 18 13.2 19.4 10.6 20 7.2l3.4 3.4C27 11 29.8 14.2 29.8 18.6c0 3-1.2 5.4-3.2 7.2L30.4 33.4H14.6z"/>' +
      '<path d="M11.6 33.4h21.8v3.4H11.6z"/><path d="M13.4 36.8h18.2v2.4H13.4z"/>' +
      '<path d="M24.6 12.4c2.2 1.4 3.4 3.6 3.4 6.2" style="fill:none;stroke:var(--ps);stroke-width:1.5"/>' +
      '<circle cx="18.2" cy="18.4" r="1.4" style="fill:var(--ps);stroke:none"/>' +
      '<circle cx="15.4" cy="23" r="1" style="fill:var(--ps);stroke:none"/>',
    b:
      '<circle cx="22.5" cy="6.2" r="2.5"/>' +
      '<path d="M22.5 9.6C21 11.7 18.1 13.6 16.8 15.9 15.6 18 16 19.9 17.6 22.1 18.8 23.8 19.9 25 20 26.6h5c.1-1.6 1.2-2.8 2.4-4.5 1.6-2.2 2-4.1.8-6.2-1.3-2.3-4.2-4.2-5.7-6.3z"/>' +
      '<path d="M21.1 13.4 23.9 19.6" style="fill:none;stroke:var(--ps);stroke-width:1.7"/>' +
      '<path d="M15.6 26.6h13.8v3.4H15.6z"/><path d="M13.2 30h16.6v3.2H13.2z"/>' +
      '<path d="M11 33.2h23v3.6H11z"/>',
    q:
      '<path d="M11 30.5 7 12.5 13.5 20 17.5 7.5 22.5 19 27.5 7.5 31.5 20 38 12.5 34 30.5Z"/>' +
      '<circle cx="7" cy="11.3" r="2.3"/><circle cx="17.5" cy="6.3" r="2.3"/>' +
      '<circle cx="27.5" cy="6.3" r="2.3"/><circle cx="38" cy="11.3" r="2.3"/>' +
      '<path d="M11.4 31.6h22.2v3.4H11.4z"/><path d="M9.4 35h26.2v3.6H9.4z"/>',
    k:
      '<path d="M20.9 2.4h3.2v4.6h4.6v3.2h-4.6v5h-3.2v-5h-4.6V7h4.6z"/>' +
      '<path d="M22.5 14c-3.6 0-6 2.5-6 5.5 0 2.5 1.5 4.4 2.7 5.8 1 1.2 1.5 2.4 1.5 3.8h3.6v3.6h3.6v-3.6h3.6c0-1.4.5-2.6 1.5-3.8 1.2-1.4 2.7-3.3 2.7-5.8 0-3-2.4-5.5-6-5.5z"/>' +
      '<path d="M19.2 28.8h6.6v3.4h-6.6z"/><path d="M15.6 32.2h13.8v3.2H15.6z"/>' +
      '<path d="M12.6 35.4h19.8v3.2H12.6z"/>'
  };

  /* ------------------------------------------------------------------
     Datasets
     ------------------------------------------------------------------ */
  var PUZZLES = /*__PUZZLES__*/[];
  var ENDGAMES = /*__ENDGAMES__*/{};
  var OPENINGS = /*__OPENINGS__*/[];
  var LESSONS = /*__LESSONS__*/[];
  var SHORTCUTS = /*__SHORTCUTS__*/[];

  window.ChessData = {
    version: '1.0',
    pieces: PIECES,
    puzzles: PUZZLES,
    endgames: ENDGAMES,
    openings: OPENINGS,
    lessons: LESSONS,
    shortcuts: SHORTCUTS
  };
})();
