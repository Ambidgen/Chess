/* Chess Trainer - application logic.
 *
 * Everything runs locally: the rules, the search engine, the puzzle data and
 * the piece artwork are all embedded in this single file.  No network calls.
 */
(function () {
  'use strict';

  var C = window.ChessCore;
  var D = window.ChessData;
  var INF = 33000;
  var MATE = C.MATE;

  /* ==================================================================
     Small helpers
     ================================================================== */
  function $(id) { return document.getElementById(id); }
  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function make(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function fmtTime(ms) {
    if (ms < 0) ms = 0;
    var s = Math.floor(ms / 1000);
    var m = Math.floor(s / 60);
    return m + ':' + pad2(s % 60);
  }
  function stripSan(san) { return String(san || '').replace(/[!?+#]/g, '').trim(); }

  /* ==================================================================
     Storage (localStorage with an in-memory fallback)
     ================================================================== */
  var store = (function () {
    var mem = {}, ok = true;
    try {
      window.localStorage.setItem('__ct_probe__', '1');
      window.localStorage.removeItem('__ct_probe__');
    } catch (e) { ok = false; }
    return {
      get: function (key, def) {
        try {
          var raw = ok ? window.localStorage.getItem(key) : mem[key];
          if (raw === null || raw === undefined) return def;
          return JSON.parse(raw);
        } catch (e) { return def; }
      },
      set: function (key, value) {
        try {
          var raw = JSON.stringify(value);
          if (ok) window.localStorage.setItem(key, raw); else mem[key] = raw;
        } catch (e) { /* ignore */ }
      },
      remove: function (key) {
        try { if (ok) window.localStorage.removeItem(key); else delete mem[key]; } catch (e) {}
      }
    };
  })();

  /* ==================================================================
     Settings
     ================================================================== */
  var DEFAULT_SETTINGS = {
    theme: 'dark', pieces: 'classic', sound: true, anim: true,
    legal: true, coords: true, lastmove: true, hints: true
  };
  var settings = Object.assign({}, DEFAULT_SETTINGS, store.get('ct.settings', {}));

  var state = {
    view: 'play',
    flipped: false,
    pzMode: 'mate', pzTheme: '', pzRating: 1600,
    egMaterial: 'KQK', egGoal: 2,
    busy: false
  };

  /* ==================================================================
     Audio (synthesised, no audio files)
     ================================================================== */
  var audioCtx = null;
  function audio() {
    if (!settings.sound) return null;
    if (!audioCtx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { audioCtx = new AC(); } catch (e) { return null; }
    }
    if (audioCtx.state === 'suspended' && audioCtx.resume) audioCtx.resume();
    return audioCtx;
  }
  function tone(freq, dur, type, vol, delay) {
    var ac = audio();
    if (!ac) return;
    var t0 = ac.currentTime + (delay || 0);
    var osc = ac.createOscillator(), gain = ac.createGain();
    osc.type = type || 'triangle';
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol || 0.05, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain); gain.connect(ac.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }
  function sfx(kind) {
    if (!settings.sound) return;
    if (kind === 'move') tone(520, 0.06, 'triangle', 0.045);
    else if (kind === 'capture') { tone(300, 0.09, 'square', 0.05); tone(180, 0.12, 'triangle', 0.04, 0.04); }
    else if (kind === 'check') { tone(760, 0.08, 'sine', 0.05); tone(980, 0.1, 'sine', 0.04, 0.06); }
    else if (kind === 'mate') { tone(880, 0.12, 'sine', 0.06); tone(1180, 0.16, 'sine', 0.05, 0.1); }
    else if (kind === 'bad') tone(180, 0.16, 'sawtooth', 0.045);
    else if (kind === 'good') tone(660, 0.09, 'sine', 0.05);
    else if (kind === 'ui') tone(440, 0.04, 'triangle', 0.03);
  }

  /* ==================================================================
     Toast + modal
     ================================================================== */
  function toast(msg, kind) {
    var host = $('toasts');
    if (!host) return;
    var t = make('div', 'toast' + (kind ? ' ' + kind : ''), msg);
    host.appendChild(t);
    setTimeout(function () {
      t.style.opacity = '0';
      t.style.transform = 'translateY(8px)';
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 260);
    }, 2200);
  }

  function openModal(title, html) {
    $('modal-title').textContent = title;
    $('modal-body').innerHTML = html;
    $('modal').classList.add('open');
  }
  function closeModal() { $('modal').classList.remove('open'); }

  /* ==================================================================
     Engine helpers
     ================================================================== */
  var engine = new C.Engine();
  var engineToken = 0;

  function makeCtx() {
    var ctx = {
      nodes: 0, deadline: 0, aborted: false, killers: [],
      history: new Int32Array(16384), startTime: Date.now()
    };
    for (var i = 0; i < 96; i++) ctx.killers.push([]);
    return ctx;
  }

  function searchSync(pos, depth, timeMs) {
    return engine.searchSync(pos, { maxDepth: depth, maxTime: timeMs || 0 });
  }

  /* score every root move - used to pick weaker moves for easy levels */
  function scoreRootMoves(pos, depth) {
    var list = pos.legalMoves(), out = [], i;
    for (i = 0; i < list.length; i++) {
      var p = pos.clone();
      p.makeMove(list[i]);
      var ctx = makeCtx();
      var gen = engine.searcher.negamax(p, depth, -INF, INF, 1, ctx);
      var r = gen.next();
      while (!r.done) r = gen.next();
      out.push({ move: list[i], score: -r.value });
    }
    out.sort(function (a, b) { return b.score - a.score; });
    return out;
  }

  var LEVELS = [
    { name: 'Beginner', depth: 2, time: 200, slack: 260 },
    { name: 'Casual', depth: 3, time: 400, slack: 150 },
    { name: 'Club', depth: 4, time: 700, slack: 60 },
    { name: 'Expert', depth: 5, time: 1200, slack: 0 },
    { name: 'Master', depth: 6, time: 2000, slack: 0 },
    { name: 'Engine', depth: 8, time: 3000, slack: 0 }
  ];

  /* ==================================================================
     Game model
     ================================================================== */
  var game = {
    startFen: C.START_FEN,
    replay: [new C.Position(C.START_FEN)],
    moves: [],
    cursor: 0,
    headers: { White: 'You', Black: 'Engine', Result: '*' },
    result: '*',
    lastMove: null
  };

  function currentPos() { return game.replay[game.cursor]; }
  function resetModel(fen) {
    game.startFen = fen || C.START_FEN;
    game.replay = [new C.Position(game.startFen)];
    game.moves = [];
    game.cursor = 0;
    game.result = '*';
    game.lastMove = null;
  }
  function pushMove(mv) {
    var pos = currentPos().clone();
    var list = pos.legalMoves();
    var san = pos.moveToSan(mv, list);
    pos.makeMove(mv);
    game.replay = game.replay.slice(0, game.cursor + 1);
    game.moves = game.moves.slice(0, game.cursor);
    game.replay.push(pos);
    game.moves.push({ san: san, from: mv.from, to: mv.to, promo: mv.promo || 0 });
    game.cursor = game.replay.length - 1;
    game.lastMove = mv;
    return san;
  }
  function goTo(index) {
    game.cursor = clamp(index, 0, game.replay.length - 1);
    game.lastMove = game.cursor > 0 ? game.moves[game.cursor - 1] : null;
    render();
    updateMoveLists();
  }
  function undoMove() {
    if (game.cursor <= 0) return false;
    goTo(game.cursor - 1);
    return true;
  }

  /* ==================================================================
     Board rendering
     ================================================================== */
  var boardEl = $('board'), piecesEl = $('pieces'), overlayEl = $('overlay'), frameEl = $('board-frame');
  var sqEls = {}, pieceEls = {}, selectedSq = -1, legalTargets = [], drag = null;

  function isLight(sq) { return ((sq >> 4) + (sq & 7)) % 2 === 0; }
  function displayToSquare(row, col) {
    return state.flipped ? (((7 - row) << 4) | (7 - col)) : ((row << 4) | col);
  }
  function squareToDisplay(sq) {
    var r = sq >> 4, f = sq & 7;
    return state.flipped ? { row: 7 - r, col: 7 - f } : { row: r, col: f };
  }

  function buildSquares() {
    clear(boardEl);
    sqEls = {};
    var row, col;
    for (row = 0; row < 8; row++) {
      for (col = 0; col < 8; col++) {
        var sq = displayToSquare(row, col);
        var d = make('div', 'sq ' + (isLight(sq) ? 'light' : 'dark'));
        d.dataset.sq = String(sq);
        d.setAttribute('role', 'gridcell');
        if (settings.coords) {
          if (col === 0) {
            var rk = make('span', 'coord rank', C.sqName(sq).replace(/[a-h]/, ''));
            d.appendChild(rk);
          }
          if (row === 7) {
            var fl = make('span', 'coord file', C.sqName(sq).replace(/[0-9]/, ''));
            d.appendChild(fl);
          }
        }
        boardEl.appendChild(d);
        sqEls[sq] = d;
      }
    }
  }

  function pieceSvg(piece) {
    var key = C.PIECE_CHAR[C.typeOf(piece)];
    return '<svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<g style="fill:var(--pf);stroke:var(--ps);stroke-width:var(--pw);' +
      'stroke-linejoin:round;stroke-linecap:round">' + D.pieces[key] + '</g></svg>';
  }

  function renderPieces(pos) {
    var sq, piece;
    /* remove pieces whose square is now empty */
    for (sq in pieceEls) {
      if (!pieceEls.hasOwnProperty(sq)) continue;
      if (!pos.board[sq]) {
        var dead = pieceEls[sq];
        delete pieceEls[sq];
        if (dead.parentNode) dead.parentNode.removeChild(dead);
      }
    }
    for (sq = 0; sq < 128; sq++) {
      if (!C.onBoard(sq)) continue;
      piece = pos.board[sq];
      if (!piece) continue;
      var el = pieceEls[sq];
      if (!el) {
        el = make('div', 'piece ' + (C.colorOf(piece) === C.WHITE ? 'w' : 'b'));
        el.innerHTML = pieceSvg(piece);
        el.dataset.sq = String(sq);
        piecesEl.appendChild(el);
        pieceEls[sq] = el;
      }
      var d = squareToDisplay(sq);
      el.style.transform = 'translate(' + (d.col * 100) + '%,' + (d.row * 100) + '%)';
    }
  }

  function renderSquares(pos) {
    var sq, el;
    var checkSq = -1;
    if (pos.inCheck()) checkSq = pos.kingSquare(pos.turn);
    for (sq in sqEls) {
      if (!sqEls.hasOwnProperty(sq)) continue;
      el = sqEls[sq];
      var cls = 'sq ' + (isLight(Number(sq)) ? 'light' : 'dark');
      if (settings.lastmove && game.lastMove) {
        if (game.lastMove.from === Number(sq) || game.lastMove.to === Number(sq)) cls += ' last';
      }
      if (selectedSq === Number(sq)) cls += ' selected';
      if (checkSq === Number(sq)) cls += ' check';
      el.className = cls;
      var target = legalTargets.some(function (m) { return m.to === Number(sq); });
      if (target) {
        var occupied = !!pos.board[sq];
        cls += occupied ? ' capture' : ' target';
        el.className = cls;
      }
    }
  }

  function render() {
    var pos = currentPos();
    renderSquares(pos);
    renderPieces(pos);
    updateClocks();
    updateStatus();
  }

  /* ==================================================================
     Overlay arrows
     ================================================================== */
  function setArrows(list) {
    if (!overlayEl) return;
    var ns = 'http://www.w3.org/2000/svg';
    clear(overlayEl);
    overlayEl.setAttribute('viewBox', '0 0 8 8');
    overlayEl.setAttribute('preserveAspectRatio', 'none');
    if (!list || !list.length) return;
    var defs = document.createElementNS(ns, 'defs');
    var marker = document.createElementNS(ns, 'marker');
    marker.setAttribute('id', 'ct-arrowhead');
    marker.setAttribute('markerWidth', '0.42');
    marker.setAttribute('markerHeight', '0.42');
    marker.setAttribute('refX', '0.34');
    marker.setAttribute('refY', '0.18');
    marker.setAttribute('orient', 'auto');
    marker.setAttribute('markerUnits', 'userSpaceOnUse');
    var mpath = document.createElementNS(ns, 'path');
    mpath.setAttribute('d', 'M0,0 L0.42,0.18 L0,0.36 z');
    mpath.setAttribute('fill', 'context-stroke');
    marker.appendChild(mpath);
    defs.appendChild(marker);
    overlayEl.appendChild(defs);

    list.forEach(function (a) {
      var p1 = squareToDisplay(a.from), p2 = squareToDisplay(a.to);
      var x1 = p1.col + 0.5, y1 = p1.row + 0.5, x2 = p2.col + 0.5, y2 = p2.row + 0.5;
      var dx = x2 - x1, dy = y2 - y1, len = Math.sqrt(dx * dx + dy * dy) || 1;
      var pad = 0.34 / len;
      var line = document.createElementNS(ns, 'line');
      line.setAttribute('x1', x1 + dx * pad); line.setAttribute('y1', y1 + dy * pad);
      line.setAttribute('x2', x2 - dx * pad); line.setAttribute('y2', y2 - dy * pad);
      line.setAttribute('stroke', a.color || '#3fb950');
      line.setAttribute('stroke-width', '0.14');
      line.setAttribute('stroke-linecap', 'round');
      line.setAttribute('marker-end', 'url(#ct-arrowhead)');
      overlayEl.appendChild(line);
    });
  }

  /* ==================================================================
     Board interaction
     ================================================================== */
  function squareFromPoint(clientX, clientY) {
    var rect = boardEl.getBoundingClientRect();
    if (!rect.width) return -1;
    var col = Math.floor((clientX - rect.left) / (rect.width / 8));
    var row = Math.floor((clientY - rect.top) / (rect.height / 8));
    if (col < 0 || col > 7 || row < 0 || row > 7) return -1;
    return displayToSquare(row, col);
  }

  /* the square can be found from the DOM (exact) or from the pointer position */
  function squareFromEvent(ev) {
    var node = ev.target;
    while (node && node !== frameEl) {
      if (node.classList && node.classList.contains('sq')) return Number(node.dataset.sq);
      node = node.parentNode;
    }
    return squareFromPoint(ev.clientX, ev.clientY);
  }

  function legalMovesFrom(sq) {
    var pos = currentPos();
    var list = pos.legalMoves(), out = [], i;
    for (i = 0; i < list.length; i++) if (list[i].from === sq) out.push(list[i]);
    return out;
  }

  function selectSquare(sq) {
    selectedSq = sq;
    legalTargets = sq >= 0 ? legalMovesFrom(sq) : [];
    render();
  }

  function tryMove(from, to) {
    var list = legalMovesFrom(from), i, mv = null, promo = null;
    for (i = 0; i < list.length; i++) {
      if (list[i].to !== to) continue;
      if (!mv) mv = list[i];
      /* a promotion is a queen unless the player asks for something else */
      if (list[i].promo === C.QUEEN) { promo = list[i]; break; }
    }
    if (promo) mv = promo;
    if (!mv) return false;
    var capture = !!currentPos().board[to];
    selectedSq = -1;
    legalTargets = [];
    onUserMove(mv, capture);
    return true;
  }

  function onPointerDown(ev) {
    if (ev.button === 2) return;
    var sq = squareFromEvent(ev);
    if (sq < 0) return;
    var pos = currentPos();
    var piece = pos.board[sq];
    audio();
    if (selectedSq >= 0 && selectedSq !== sq) {
      if (tryMove(selectedSq, sq)) { ev.preventDefault(); return; }
    }
    if (piece && C.colorOf(piece) === pos.turn && canUserMove()) {
      selectSquare(sq);
      drag = { sq: sq, x: ev.clientX, y: ev.clientY, active: false, el: pieceEls[sq] };
      if (drag.el) {
        drag.el.setPointerCapture && drag.el.setPointerCapture(ev.pointerId);
      }
    } else {
      selectSquare(-1);
    }
    ev.preventDefault();
  }

  function onPointerMove(ev) {
    if (!drag) return;
    var dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
    if (!drag.active && Math.abs(dx) + Math.abs(dy) < 5) return;
    drag.active = true;
    if (drag.el) {
      drag.el.classList.add('dragging');
      var rect = boardEl.getBoundingClientRect();
      var size = rect.width / 8;
      var d = squareToDisplay(drag.sq);
      var cx = rect.left + (d.col + 0.5) * size;
      var cy = rect.top + (d.row + 0.5) * size;
      drag.el.style.transform =
        'translate(' + ((ev.clientX - size / 2 - rect.left) / size * 100) + '%,' +
        ((ev.clientY - size / 2 - rect.top) / size * 100) + '%)';
      void cx; void cy;
    }
  }

  function onPointerUp(ev) {
    if (!drag) return;
    var d = drag;
    drag = null;
    if (d.el) d.el.classList.remove('dragging');
    if (!d.active) { render(); return; }
    var sq = squareFromPoint(ev.clientX, ev.clientY);
    selectedSq = -1;
    legalTargets = [];
    if (sq >= 0 && sq !== d.sq) {
      if (!tryMove(d.sq, sq)) render();
    } else {
      render();
    }
  }

  function onContextMenu(ev) {
    ev.preventDefault();
    var sq = squareFromPoint(ev.clientX, ev.clientY);
    if (sq < 0 || selectedSq < 0) return;
    if (tryMove(selectedSq, sq)) return;
    var pos = currentPos();
    var piece = pos.board[sq];
    if (piece && C.colorOf(piece) === pos.turn) selectSquare(sq);
  }

  /* ==================================================================
     Mode dispatch - what a user move means depends on the active view
     ================================================================== */
  function canUserMove() {
    if (state.busy) return false;
    switch (state.view) {
      case 'play': return play.active && play.result === '*' && currentPos().turn === play.userColor;
      case 'puzzles': return !!puzzle.current && !puzzle.solved && !puzzle.failed;
      case 'endgames': return !!drill.current && !drill.done;
      case 'openings': return openingTrain.active && openingTrain.step < openingTrain.line.length;
      default: return true;
    }
  }

  function onUserMove(mv, capture) {
    var mover = currentPos().turn;
    var san = pushMove(mv);
    var pos = currentPos();
    var givesCheck = pos.inCheck();
    sfx(capture ? 'capture' : 'move');
    if (givesCheck) setTimeout(function () { sfx('check'); }, 90);
    render();
    updateMoveLists();

    switch (state.view) {
      case 'play': playOnMove(mv, capture, mover); break;
      case 'puzzles': puzzleOnMove(mv, san); break;
      case 'endgames': drillOnMove(mv, san); break;
      case 'openings': openingOnMove(mv, san); break;
      default: break;
    }
    var res = pos.gameResult();
    if (res && res !== '*' && state.view === 'play') finishGame(res);
  }

  /* ==================================================================
     Clocks
     ================================================================== */
  var clock = { w: 600000, b: 600000, inc: 0, base: 600000, running: false, last: 0, timer: null };

  function clockTick() {
    if (!clock.running) return;
    var now = Date.now();
    var dt = now - clock.last;
    clock.last = now;
    var turn = currentPos().turn;
    if (turn === C.WHITE) clock.w -= dt; else clock.b -= dt;
    if (clock.w <= 0) { clock.w = 0; finishGame('0-1'); }
    else if (clock.b <= 0) { clock.b = 0; finishGame('1-0'); }
    updateClocks();
  }

  function updateClocks() {
    var wt = $('clock-white-time'), bt = $('clock-black-time');
    if (!wt) return;
    wt.textContent = fmtTime(clock.w);
    bt.textContent = fmtTime(clock.b);
    var wEl = $('clock-white'), bEl = $('clock-black');
    var turn = currentPos().turn;
    wEl.classList.toggle('active', clock.running && turn === C.WHITE);
    bEl.classList.toggle('active', clock.running && turn === C.BLACK);
    wEl.classList.toggle('low', clock.w < 30000);
    bEl.classList.toggle('low', clock.b < 30000);
  }

  function startClock(base, inc) {
    clock.base = base; clock.inc = inc || 0;
    clock.w = base; clock.b = base;
    clock.running = true;
    clock.last = Date.now();
    if (clock.timer) clearInterval(clock.timer);
    clock.timer = setInterval(clockTick, 100);
    updateClocks();
  }
  function stopClock() {
    clock.running = false;
    if (clock.timer) { clearInterval(clock.timer); clock.timer = null; }
    updateClocks();
  }

  /* ==================================================================
     Play mode
     ================================================================== */
  var play = { active: false, userColor: C.WHITE, level: 3, result: '*', thinking: false, pending: null, token: 0 };

  function newGame() {
    var side = $('sel-side').value;
    var level = parseInt($('sel-level').value, 10) || 3;
    var tc = $('sel-tc').value;
    var base = 0, inc = 0;
    if (tc !== '0') {
      var parts = String(tc).split('+');
      base = (parseInt(parts[0], 10) || 0) * 1000;
      inc = (parseInt(parts[1], 10) || 0) * 1000;
    }
    var userColor = side === 'r' ? (Math.random() < 0.5 ? C.WHITE : C.BLACK) : (side === 'w' ? C.WHITE : C.BLACK);
    play.userColor = userColor;
    play.level = level;
    play.active = true;
    play.result = '*';
    play.token++;                 /* cancels a reply that is still on its way */
    state.busy = false;
    resetModel(C.START_FEN);
    game.headers = { White: userColor === C.WHITE ? 'You' : 'Engine', Black: userColor === C.BLACK ? 'You' : 'Engine', Result: '*' };
    if (base > 0) startClock(base, inc); else { clock.w = 0; clock.b = 0; stopClock(); }
    state.flipped = userColor === C.BLACK;
    buildSquares();
    render();
    updateMoveLists();
    $('engine-badge').textContent = 'Engine: JS · ' + LEVELS[clamp(level - 1, 0, LEVELS.length - 1)].name;
    $('eng-score').textContent = '—';
    $('eng-depth-value').textContent = '—';
    $('eng-nodes').textContent = '—';
    $('eng-time').textContent = '—';
    $('eng-pv').textContent = '—';
    $('eng-depth').textContent = 'idle';
    updateEvalBar(0);
    setGameStatus('info', 'White to move. You play ' + (userColor === C.WHITE ? 'white' : 'black') + '.');
    $('game-turn').textContent = 'White to move';
    if (currentPos().turn !== userColor) scheduleEngineMove();
  }

  function setGameStatus(kind, text) {
    var b = $('game-status');
    b.className = 'banner ' + (kind || 'info');
    b.textContent = text;
  }

  function scheduleEngineMove() {
    if (!play.active || play.result !== '*') return;
    var pos = currentPos();
    if (pos.turn === play.userColor) return;
    play.thinking = true;
    state.busy = true;
    var lv = LEVELS[clamp(play.level - 1, 0, LEVELS.length - 1)];
    setGameStatus('info', 'Engine is thinking…');
    var token = play.token;
    setTimeout(function () {
      if (!play.active || play.token !== token) return;
      var res = searchSync(pos.clone(), lv.depth, lv.time);
      updateEnginePanel(res, pos);
      var mv = null;
      if (res && res.move) {
        mv = res.move;
        if (lv.slack > 0) {
          var scored = scoreRootMoves(pos, Math.max(1, lv.depth - 1));
          var best = scored.length ? scored[0].score : 0;
          var pool = scored.filter(function (s) { return s.score >= best - lv.slack; });
          if (pool.length > 1) mv = pool[Math.floor(Math.random() * pool.length)].move;
        }
      }
      play.thinking = false;
      state.busy = false;
      if (!mv) { setGameStatus('warn', 'The engine could not find a move.'); return; }
      /* the board may have moved on while the engine was thinking */
      var legal = currentPos().legalMoves(), i, use = null;
      for (i = 0; i < legal.length; i++) {
        if (legal[i].from === mv.from && legal[i].to === mv.to &&
            (legal[i].promo || 0) === (mv.promo || 0)) { use = legal[i]; break; }
      }
      if (!use) {
        setGameStatus('info', 'The position changed — the engine reply was skipped.');
        return;
      }
      mv = use;
      var capture = !!currentPos().board[mv.to];
      var san = pushMove(mv);
      if (clock.running && clock.inc) {
        if (currentPos().turn === C.WHITE) clock.w += clock.inc; else clock.b += clock.inc;
      }
      sfx(capture ? 'capture' : 'move');
      render();
      updateMoveLists();
      updateGameTurn();
      var r = currentPos().gameResult();
      if (r && r !== '*') { finishGame(r); return; }
      setGameStatus('info', 'Engine played ' + san + '. Your move.');
    }, 220);
  }

  function updateEnginePanel(res, pos) {
    if (!res) return;
    var side = pos && pos.turn === C.BLACK ? 'white' : 'black';
    var score = side === 'white' ? -res.score : res.score;
    $('eng-score').textContent = C.formatScore(score);
    $('eng-depth-value').textContent = res.depth || '—';
    $('eng-nodes').textContent = (res.nodes || 0).toLocaleString();
    $('eng-time').textContent = Math.round((res.time || 0)) + ' ms';
    $('eng-depth').textContent = 'depth ' + (res.depth || 0);
    $('eng-pv').textContent = pvText(res.pv, pos ? pos.turn : C.WHITE);
    updateEvalBar(score);
  }

  function playOnMove(mv, capture, mover) {
    if (!play.active) return;
    if (play.result !== '*') return;
    if (mover !== play.userColor) return;
    if (clock.running && clock.inc) {
      if (play.userColor === C.WHITE) clock.w += clock.inc; else clock.b += clock.inc;
    }
    updateGameTurn();
    var r = currentPos().gameResult();
    if (r && r !== '*') { finishGame(r); return; }
    scheduleEngineMove();
  }

  function updateGameTurn() {
    var pos = currentPos();
    var turn = pos.turn === C.WHITE ? 'White' : 'Black';
    $('game-turn').textContent = turn + ' to move';
  }

  function finishGame(result) {
    play.result = result;
    play.active = false;
    stopClock();
    game.result = result;
    game.headers.Result = result;
    var msg = result === '1-0' ? 'White wins — 1-0' : (result === '0-1' ? 'Black wins — 0-1' : 'Draw — ½-½');
    setGameStatus(result === '1/2-1/2' ? 'warn' : 'ok', msg);
    sfx(result === '1/2-1/2' ? 'ui' : 'mate');
    store.set('ct.game', { pgn: currentPgn(result), at: Date.now() });
  }

  function currentPgn(result) {
    var sans = game.moves.map(function (m) { return m.san; });
    var headers = Object.assign({}, game.headers, { Result: result || game.result });
    return C.makePgn(headers, sans, result || game.result);
  }

  /* ==================================================================
     Puzzles
     ================================================================== */
  var puzzleStats = store.get('ct.puzzles', { solved: 0, failed: 0, streak: 0, elo: 1200, done: [] });
  var puzzle = { list: [], current: null, solved: false, failed: false, attempts: 0 };

  function puzzlePool() {
    var out = [];
    for (var i = 0; i < D.puzzles.length; i++) {
      var p = D.puzzles[i];
      if (state.pzMode === 'mate' && !p.mate) continue;
      if (state.pzMode === 'material' && p.swing < 300) continue;
      if (state.pzMode === 'best' && (!p.quiet || p.margin < 60)) continue;
      if (state.pzTheme && p.tags.indexOf(state.pzTheme) < 0) continue;
      if (p.rating > state.pzRating) continue;
      out.push(p);
    }
    return out;
  }

  function refreshPuzzleList() {
    puzzle.list = puzzlePool();
    $('pz-count').textContent = puzzle.list.length + ' puzzles';
  }

  function nextPuzzle() {
    refreshPuzzleList();
    if (!puzzle.list.length) {
      puzzle.current = null;
      $('pz-status').className = 'banner warn';
      $('pz-status').textContent = 'No puzzle matches this filter — widen the rating or theme.';
      return;
    }
    var solvedSet = {};
    (puzzleStats.done || []).forEach(function (k) { solvedSet[k] = true; });
    var pool = puzzle.list.filter(function (p) { return !solvedSet[p.fen]; });
    if (!pool.length) pool = puzzle.list;
    var pick = pool[Math.floor(Math.random() * pool.length)];
    puzzle.current = pick;
    puzzle.solved = false;
    puzzle.failed = false;
    puzzle.attempts = 0;
    resetModel(pick.fen);
    state.flipped = pick.fen.split(' ')[1] === 'b';
    buildSquares();
    render();
    updateMoveLists();
    $('pz-title').textContent = pick.mate ? ('Mate in ' + pick.mate) : pick.theme;
    $('pz-rating').textContent = pick.rating;
    renderAttempts($('pz-attempts'), 0, false);
    $('pz-status').className = 'banner info';
    $('pz-status').textContent = 'Find the best move for ' + (state.flipped ? 'black' : 'white') + '.';
    var tags = $('pz-tags'); clear(tags);
    pick.tags.forEach(function (t) { tags.appendChild(make('span', 'badge', t)); });
    if (pick.swing >= 300) tags.appendChild(make('span', 'badge good', 'wins ' + pick.swing + 'cp'));
  }

  function puzzleOnMove(mv, san) {
    var p = puzzle.current;
    if (!p || puzzle.solved || puzzle.failed) return;
    puzzle.attempts++;
    renderAttempts($('pz-attempts'), puzzle.attempts, false);
    if (stripSan(san) === stripSan(p.sol)) {
      puzzle.solved = true;
      sfx('good');
      var extra = '';
      if (p.mate) {
        var res = currentPos().gameResult();
        extra = res === '1-0' || res === '0-1' ? ' Checkmate!' : '';
      }
      $('pz-status').className = 'banner ok';
      $('pz-status').textContent = 'Correct! ' + san + extra;
      if (!puzzleStats.done) puzzleStats.done = [];
      if (puzzleStats.done.indexOf(p.fen) < 0) puzzleStats.done.push(p.fen);
      puzzleStats.solved = (puzzleStats.solved || 0) + 1;
      puzzleStats.streak = (puzzleStats.streak || 0) + 1;
      puzzleStats.elo = clamp(1200 + (puzzleStats.streak - 1) * 15 + (p.rating - 1200) / 4, 800, 2800);
      store.set('ct.puzzles', puzzleStats);
      updatePuzzleStats();
      if (p.reply) {
        setTimeout(function () {
          if (!puzzle.current || puzzle.current.fen !== p.fen) return;
          var pos = currentPos();
          var mv2 = pos.sanToMove(p.reply);
          if (mv2) {
            pushMove(mv2);
            sfx('move');
            render();
            updateMoveLists();
          }
        }, 480);
      }
    } else {
      sfx('bad');
      $('pz-status').className = 'banner no';
      if (puzzle.attempts >= 3) {
        puzzle.failed = true;
        $('pz-status').textContent = 'The move was ' + p.sol + '. Press “Show solution” to review it.';
        showPuzzleSolution();
      } else {
        $('pz-status').textContent = 'Not quite — ' + (3 - puzzle.attempts) + ' tr' + (3 - puzzle.attempts === 1 ? 'y' : 'ies') + ' left.';
      }
    }
  }

  function showPuzzleSolution() {
    var p = puzzle.current;
    if (!p) return;
    var pos = currentPos();
    var mv = pos.sanToMove(p.sol);
    if (mv) {
      pushMove(mv);
      sfx('move');
      render();
      updateMoveLists();
    }
    if (p.reply) {
      var pos2 = currentPos();
      var mv2 = pos2.sanToMove(p.reply);
      if (mv2) { pushMove(mv2); sfx('move'); render(); updateMoveLists(); }
    }
    puzzle.failed = true;
    puzzleStats.failed = (puzzleStats.failed || 0) + 1;
    puzzleStats.streak = 0;
    store.set('ct.puzzles', puzzleStats);
    updatePuzzleStats();
    $('pz-status').className = 'banner warn';
    $('pz-status').textContent = 'Solution: ' + p.sol + (p.reply ? ' ' + p.reply : '');
  }

  function renderAttempts(box, count, good) {
    if (!box) return;
    clear(box);
    for (var i = 0; i < Math.min(count, 5); i++) box.appendChild(make('i', good ? 'ok' : 'bad'));
  }

  function updatePuzzleStats() {
    $('pz-solved').textContent = puzzleStats.solved || 0;
    $('pz-failed').textContent = puzzleStats.failed || 0;
    $('pz-streak').textContent = puzzleStats.streak || 0;
    $('pz-elo').textContent = Math.round(puzzleStats.elo || 1200);
    var total = (puzzleStats.solved || 0) + (puzzleStats.failed || 0);
    var pct = total ? Math.round((puzzleStats.solved || 0) / total * 100) : 0;
    $('pz-progress').style.width = pct + '%';
    $('pz-progress-label').textContent = total
      ? pct + '% of attempts solved so far.'
      : 'Solve puzzles to raise your rating.';
  }

  /* ==================================================================
     Endgame drills
     ================================================================== */
  var drillStats = store.get('ct.endgames', { solved: 0, mastered: 0, streak: 0, done: [] });
  var drill = { current: null, ply: 0, own: 0, done: false, color: C.WHITE, timer: null, token: 0 };

  function drillPool() {
    var list = D.endgames[state.egMaterial] || [];
    if (state.egMaterial === 'KPK') return list;   /* promotion drill */
    var goal = state.egGoal;
    var exact = list.filter(function (d) { return d.goal === goal; });
    if (exact.length) return exact;
    return list.filter(function (d) { return d.goal <= goal; });
  }

  /* has the pawn reached the eighth rank and become a piece? */
  function hasPromoted(pos) {
    for (var sq = 0; sq < 128; sq++) {
      if (!C.onBoard(sq)) continue;
      if (C.rankOf(sq) !== 0) continue;          /* rank 8 */
      var p = pos.board[sq];
      if (!p) continue;
      if (C.colorOf(p) !== C.WHITE) continue;
      if (C.typeOf(p) !== C.KING) return true;
    }
    return false;
  }

  function newDrill() {
    /* a reply that is still on its way belongs to the previous drill */
    if (drill.timer) { clearTimeout(drill.timer); drill.timer = null; }
    drill.token++;
    var pool = drillPool();
    if (!pool.length) {
      $('eg-status').className = 'banner warn';
      $('eg-status').textContent = 'No drill available for this material and goal.';
      drill.current = null;
      return;
    }
    var done = {};
    (drillStats.done || []).forEach(function (k) { done[k] = true; });
    var fresh = pool.filter(function (d) { return !done[d.fen]; });
    if (!fresh.length) fresh = pool;
    var pick = fresh[Math.floor(Math.random() * fresh.length)];
    drill.current = pick;
    drill.ply = 0;
    drill.own = 0;
    drill.done = false;
    drill.color = pick.side;
    resetModel(pick.fen);
    state.flipped = drill.color === C.BLACK;
    buildSquares();
    render();
    updateMoveLists();
    $('eg-side').textContent = drill.color === C.WHITE ? 'White' : 'Black';
    if (pick.kind === 'KPK') {
      $('eg-task').textContent = 'Push the pawn home and promote it. You play white.';
    } else {
      $('eg-task').textContent = 'Checkmate in ' + pick.goal + ' move' + (pick.goal > 1 ? 's' : '') +
        '. You play ' + (drill.color === C.WHITE ? 'white' : 'black') + '.';
    }
    $('eg-count').textContent = pool.length + ' positions';
    $('eg-status').className = 'banner info';
    $('eg-status').textContent = 'Play the winning move.';
    renderAttempts($('eg-attempts'), 0, false);
    updateDrillStats();
  }

  function drillOnMove(mv, san) {
    var d = drill.current;
    if (!d || drill.done) return;
    var line = d.line || [];
    var expected = line[drill.ply];
    var pawnDrill = d.kind === 'KPK';
    var correct = expected && stripSan(expected) === stripSan(san);
    if (!correct) {
      /* fall back to an engine check: does the move still force the win? */
      var after = currentPos().clone();
      if (pawnDrill) {
        var promotion = searchSync(after, 4);
        correct = !!(promotion && promotion.score >= 300);
      } else {
        var probe = searchSync(after, clamp(state.egGoal + 2, 3, 7));
        correct = !!(probe && probe.score <= -(MATE - 1000));
      }
    }
    if (!correct) {
      sfx('bad');
      $('eg-status').className = 'banner no';
      $('eg-status').textContent = 'That does not force mate. Try again.';
      drill.attempts = (drill.attempts || 0) + 1;
      renderAttempts($('eg-attempts'), drill.attempts, false);
      return;
    }
    sfx('good');
    drill.ply++;
    drill.own = (drill.own || 0) + 1;
    var res = currentPos().gameResult();
    if (pawnDrill && hasPromoted(currentPos())) {
      drill.done = true;
      $('eg-status').className = 'banner ok';
      $('eg-status').textContent = 'Promotion! The pawn has become a queen — well played.';
      sfx('mate');
      drillStats.solved = (drillStats.solved || 0) + 1;
      drillStats.streak = (drillStats.streak || 0) + 1;
      drillStats.mastered = (drillStats.mastered || 0) + 1;
      if (!drillStats.done) drillStats.done = [];
      if (drillStats.done.indexOf(d.fen) < 0) drillStats.done.push(d.fen);
      store.set('ct.endgames', drillStats);
      updateDrillStats();
      return;
    }
    if (res && res !== '*' && res !== '1/2-1/2') {
      drill.done = true;
      $('eg-status').className = 'banner ok';
      $('eg-status').textContent = 'Checkmate! Well played.';
      sfx('mate');
      drillStats.solved = (drillStats.solved || 0) + 1;
      drillStats.streak = (drillStats.streak || 0) + 1;
      if ((drill.own || 1) <= d.goal) {
        drillStats.mastered = (drillStats.mastered || 0) + 1;
        if (!drillStats.done) drillStats.done = [];
        if (drillStats.done.indexOf(d.fen) < 0) drillStats.done.push(d.fen);
      }
      store.set('ct.endgames', drillStats);
      updateDrillStats();
      return;
    }
    /* the opponent answers with the best defence */
    var replyIdx = drill.ply;
    var replySan = line[replyIdx];
    var token = drill.token;
    drill.timer = setTimeout(function () {
      drill.timer = null;
      if (drill.done || drill.token !== token) return;
      var pos = currentPos();
      var rmv = null;
      if (replySan) rmv = pos.sanToMove(replySan);
      if (!rmv) {
        var probe = searchSync(pos.clone(), 4);
        if (probe && probe.move) rmv = probe.move;
      }
      if (rmv) {
        pushMove(rmv);
        sfx('move');
        render();
        updateMoveLists();
        drill.ply++;
        $('eg-status').className = 'banner info';
        $('eg-status').textContent = drill.current && drill.current.kind === 'KPK'
          ? 'Your move — push the pawn home.'
          : 'Your move — finish the mate.';
      }
    }, 320);
  }

  function updateDrillStats() {
    $('eg-solved').textContent = drillStats.solved || 0;
    $('eg-mastered').textContent = drillStats.mastered || 0;
    $('eg-streak').textContent = drillStats.streak || 0;
  }

  /* ==================================================================
     Openings
     ================================================================== */
  var opening = { current: null };
  var openingTrain = { active: false, line: [], step: 0, opening: null };
  var openingQuiz = { active: false, questions: [], index: 0, score: 0, opening: null };

  function renderOpeningList() {
    var query = ($('op-search').value || '').toLowerCase();
    var list = $('op-list');
    clear(list);
    var shown = 0;
    D.openings.forEach(function (op) {
      if (query && (op.name + ' ' + op.eco + ' ' + op.ideas.join(' ')).toLowerCase().indexOf(query) < 0) return;
      shown++;
      var item = make('div', 'list-item' + (opening.current && opening.current.id === op.id ? ' active' : ''));
      item.appendChild(make('span', '', op.name));
      item.appendChild(make('span', 'pill', op.eco));
      item.addEventListener('click', function () { selectOpening(op); });
      list.appendChild(item);
    });
    if (!shown) list.appendChild(make('div', 'hint', 'No opening matches that search.'));
    $('op-count').textContent = D.openings.length + ' openings';
  }

  function selectOpening(op) {
    opening.current = op;
    $('op-name').textContent = op.name;
    $('op-eco').textContent = op.eco;
    $('op-moves').innerHTML = '';
    var line = formatMoveLine(op.moves);
    $('op-moves').textContent = line;
    var ideas = make('div', 'prose');
    ideas.innerHTML = '<ul>' + op.ideas.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ul>';
    $('op-moves').parentNode.appendChild(ideas);
    renderOpeningList();
  }

  function formatMoveLine(moves) {
    var out = '', n = 1, i;
    for (i = 0; i < moves.length; i++) {
      if (i % 2 === 0) out += n++ + '. ';
      out += moves[i] + ' ';
    }
    return out.trim();
  }

  function loadOpening(op) {
    opening.current = op;
    loadLine(op.moves, C.START_FEN, '*');
    game.cursor = 0;
    game.lastMove = null;
    state.flipped = op.side === 'b';
    buildSquares();
    render();
    updateMoveLists();
    toast('Loaded ' + op.name);
  }

  function trainOpening(op) {
    opening.current = op;
    loadOpening(op);
    openingTrain.active = true;
    openingTrain.opening = op;
    openingTrain.line = op.moves;
    openingTrain.step = 0;
    $('op-quiz-card').style.display = 'none';
    $('status-line').textContent = 'Training ' + op.name + ' — use ◀ ▶ to step through the line.';
  }

  function openingOnMove(mv, san) {
    if (!openingTrain.active) return;
    var expected = openingTrain.line[openingTrain.step];
    if (expected && stripSan(expected) === stripSan(san)) {
      openingTrain.step++;
      $('status-line').textContent = 'Training ' + openingTrain.opening.name + ' — move ' +
        openingTrain.step + ' of ' + openingTrain.line.length + '.';
    }
  }

  function startOpeningQuiz(op) {
    openingQuiz.active = true;
    openingQuiz.opening = op;
    openingQuiz.index = 0;
    openingQuiz.score = 0;
    openingQuiz.questions = buildQuiz(op);
    $('op-quiz-card').style.display = '';
    showQuizQuestion();
  }

  function buildQuiz(op) {
    var qs = [], pos = new C.Position(C.START_FEN), i;
    for (i = 0; i < op.moves.length; i++) {
      var san = op.moves[i];
      var legal = pos.legalMoves();
      if (!legal.length) break;
      if (i >= 2) {
        var options = [{ san: san, correct: true }];
        var pool = legal.slice();
        var tries = 0;
        while (options.length < 4 && tries < 40) {
          tries++;
          var m = pool[Math.floor(Math.random() * pool.length)];
          if (m.promo) continue;
          var cand = pos.moveToSan(m, legal);
          if (options.some(function (o) { return o.san === cand; })) continue;
          options.push({ san: cand, correct: false });
        }
        if (options.length >= 3) {
          for (var j = options.length - 1; j > 0; j--) {
            var k = Math.floor(Math.random() * (j + 1));
            var tmp = options[j]; options[j] = options[k]; options[k] = tmp;
          }
          qs.push({ prefix: op.moves.slice(0, i), options: options });
        }
      }
      var mv = pos.sanToMove(san);
      if (!mv) break;
      pos.makeMove(mv);
    }
    return qs;
  }

  function showQuizQuestion() {
    var q = openingQuiz.questions[openingQuiz.index];
    var card = $('op-quiz-card');
    if (!q) {
      $('op-quiz-question').textContent = 'Quiz finished — ' + openingQuiz.score + '/' + openingQuiz.questions.length + ' correct.';
      $('op-quiz-progress').textContent = 'done';
      clear($('op-quiz-options'));
      $('op-quiz-status').className = 'banner ok';
      $('op-quiz-status').textContent = 'Nice work. Try another opening!';
      return;
    }
    $('op-quiz-progress').textContent = (openingQuiz.index + 1) + '/' + openingQuiz.questions.length;
    $('op-quiz-question').textContent = 'After ' + formatMoveLine(q.prefix) + ' — what is the main move?';
    var box = $('op-quiz-options');
    clear(box);
    q.options.forEach(function (o) {
      var b = make('button', 'option', o.san);
      b.addEventListener('click', function () {
        if (o.correct) {
          sfx('good');
          openingQuiz.score++;
          $('op-quiz-status').className = 'banner ok';
          $('op-quiz-status').textContent = 'Correct!';
          openingQuiz.index++;
          setTimeout(showQuizQuestion, 700);
        } else {
          sfx('bad');
          $('op-quiz-status').className = 'banner no';
          $('op-quiz-status').textContent = 'Not quite — ' + o.san + ' is not the book move.';
        }
      });
      box.appendChild(b);
    });
    $('op-quiz-status').className = 'banner info';
    $('op-quiz-status').textContent = 'Pick the main continuation.';
  }

  /* ==================================================================
     Analysis
     ================================================================== */
  var analysis = { evalLine: [], running: false };

  function setAnalysisPosition(fen) {
    try {
      var pos = new C.Position(fen);
      resetModel(fen);
      state.flipped = pos.turn === C.BLACK;
      buildSquares();
      render();
      updateMoveLists();
      $('an-fen-badge').textContent = fen === C.START_FEN ? 'startpos' : fen;
      return true;
    } catch (e) {
      toast('That FEN could not be read.', 'warn');
      return false;
    }
  }

  /* rebuild the game from a list of SAN moves */
  function buildLine(sans, startFen) {
    var positions = [], moves = [];
    var pos = new C.Position(startFen || C.START_FEN);
    positions.push(pos);
    for (var i = 0; i < sans.length; i++) {
      var mv = pos.sanToMove(sans[i]);
      if (!mv) break;
      var list = pos.legalMoves();
      var san = pos.moveToSan(mv, list);
      pos.makeMove(mv);
      positions.push(pos.cloneFull());
      moves.push({ san: san, from: mv.from, to: mv.to, promo: mv.promo || 0 });
    }
    return { positions: positions, moves: moves };
  }

  function loadLine(sans, startFen, result) {
    var line = buildLine(sans, startFen);
    game.startFen = startFen || C.START_FEN;
    game.replay = line.positions;
    game.moves = line.moves;
    game.cursor = game.replay.length - 1;
    game.result = result || '*';
    game.lastMove = game.cursor > 0 ? game.moves[game.cursor - 1] : null;
    state.flipped = currentPos().turn === C.BLACK;
    buildSquares();
    render();
    updateMoveLists();
    return line.moves.length;
  }

  function importPgn(text) {
    try {
      var parsed = C.parsePgn(text);
      var conv = C.pgnToSanMoves(parsed);
      if (!conv.moves.length) { toast('No moves found in that PGN.', 'warn'); return; }
      var startFen = C.START_FEN;
      if (parsed.headers && parsed.headers.FEN) {
        try { new C.Position(parsed.headers.FEN); startFen = parsed.headers.FEN; } catch (e2) { /* ignore */ }
      }
      var n = loadLine(conv.moves.map(function (m) { return m.san; }), startFen,
        parsed.root && parsed.root.result !== '*' ? parsed.root.result : '*');
      if (parsed.headers && Object.keys(parsed.headers).length) game.headers = parsed.headers;
      toast('Imported ' + n + ' moves.');
    } catch (e) {
      toast('Could not read that PGN.', 'warn');
    }
  }

  function runAnalysis() {
    if (analysis.running) { engine.stop(); analysis.running = false; return; }
    var token = ++engineToken;
    analysis.running = true;
    $('an-depth').textContent = 'searching…';
    $('btn-an-analyze').textContent = 'Stop';
    var pos = currentPos().clone();
    engine.start(pos, {
      maxDepth: 12, maxTime: 4000,
      onUpdate: function (info) {
        if (token !== engineToken) return;
        var score = pos.turn === C.WHITE ? info.score : -info.score;
        $('an-score').textContent = C.formatScore(score);
        $('an-depth-value').textContent = info.depth;
        $('an-nodes').textContent = info.nodes.toLocaleString();
        $('an-pv').textContent = pvText(info.pv, pos.turn);
        $('an-depth').textContent = 'depth ' + info.depth;
        updateEvalBar(score);
        if (info.pv && info.pv.length) setArrows([{ from: info.pv[0].from, to: info.pv[0].to, color: '#3fb950' }]);
      },
      onDone: function (res) {
        if (token !== engineToken) return;
        analysis.running = false;
        $('btn-an-analyze').textContent = 'Analyse';
        $('an-depth').textContent = 'depth ' + (res.depth || 0);
        var score = pos.turn === C.WHITE ? res.score : -res.score;
        $('an-score').textContent = C.formatScore(score);
        $('an-pv').textContent = pvText(res.pv, pos.turn);
        updateEvalBar(score);
      }
    });
  }

  function pvText(pv, turn) {
    if (!pv || !pv.length) return '—';
    var pos = currentPos().clone();
    var out = [];
    for (var i = 0; i < pv.length && i < 12; i++) {
      var list = pos.legalMoves();
      var mv = null, j;
      for (j = 0; j < list.length; j++) {
        if (list[j].from === pv[i].from && list[j].to === pv[i].to &&
            (!pv[i].promo || list[j].promo === pv[i].promo)) { mv = list[j]; break; }
      }
      if (!mv) break;
      out.push(pos.moveToSan(mv, list));
      pos.makeMove(mv);
    }
    void turn;
    return out.join(' ');
  }

  function updateEvalBar(score) {
    if (score === undefined || score === null) return;
    var pct = clamp(50 + score / 30, 2, 98);
    if (score > 900) pct = 98;
    if (score < -900) pct = 2;
    $('evalbar-fill').style.height = pct + '%';
    $('evalbar-top').textContent = C.formatScore(score);
    $('evalbar-bottom').textContent = C.formatScore(-score);
  }

  function analyseGame() {
    var n = game.replay.length;
    var evals = new Array(n);
    var i = 0;
    $('an-depth').textContent = 'analysing 0/' + n;
    function step() {
      if (i >= n) {
        $('an-depth').textContent = 'done';
        analysis.evalLine = evals;
        renderAnalysisMoves(evals);
        return;
      }
      var pos = game.replay[i];
      var res = searchSync(pos.clone(), 4, 300);
      evals[i] = res ? (pos.turn === C.WHITE ? res.score : -res.score) : 0;
      i++;
      $('an-depth').textContent = 'analysing ' + i + '/' + n;
      setTimeout(step, 0);
    }
    step();
  }

  function renderAnalysisMoves(evals) {
    var list = $('an-moves');
    clear(list);
    var i;
    for (i = 0; i < game.moves.length; i++) {
      var before = evals[i], after = evals[i + 1];
      var drop = before === undefined || after === undefined ? 0 : before - after;
      var kind = 'best', label = 'best';
      if (drop >= 250) { kind = 'blunder'; label = 'blunder'; }
      else if (drop >= 90) { kind = 'mistake'; label = 'mistake'; }
      else if (drop >= 30) { kind = 'inaccuracy'; label = 'inaccuracy'; }
      else if (drop > 8) { kind = 'good'; label = 'good'; }
      if (i % 2 === 0) list.appendChild(make('span', 'no', (i / 2 + 1) + '.'));
      var span = make('span', 'mv ' + kind, game.moves[i].san);
      span.title = label;
      (function (idx) {
        span.addEventListener('click', function () { goTo(idx + 1); });
      })(i);
      list.appendChild(span);
    }
    $('an-move-count').textContent = game.moves.length + ' moves';
  }

  /* ==================================================================
     Move lists
     ================================================================== */
  function updateMoveLists() {
    var targets = [$('moves-play'), $('an-moves')];
    for (var t = 0; t < targets.length; t++) {
      var box = targets[t];
      if (!box) continue;
      if (t === 1 && analysis.evalLine.length) { renderAnalysisMoves(analysis.evalLine); continue; }
      clear(box);
      var i;
      for (i = 0; i < game.moves.length; i++) {
        if (i % 2 === 0) box.appendChild(make('span', 'no', (i / 2 + 1) + '.'));
        var span = make('span', 'mv' + (i + 1 === game.cursor ? ' cur' : ''), game.moves[i].san);
        (function (idx) {
          span.addEventListener('click', function () { goTo(idx + 1); });
        })(i);
        box.appendChild(span);
      }
      if (!game.moves.length) box.appendChild(make('span', 'no', ''));
    }
    $('an-move-count').textContent = game.moves.length + ' moves';
  }

  /* ==================================================================
     Status line
     ================================================================== */
  function updateStatus() {
    var line = $('status-line');
    if (!line) return;
    var pos = currentPos();
    if (pos.gameResult && pos.gameResult() !== '*') {
      line.textContent = 'Game over: ' + pos.gameResult();
      return;
    }
    if (state.view === 'puzzles' && puzzle.current) {
      line.textContent = 'Puzzle: find the best move (' + (state.flipped ? 'black' : 'white') + ' to play).';
      return;
    }
    if (state.view === 'endgames' && drill.current) {
      line.textContent = 'Endgame drill: mate in ' + drill.current.goal + '.';
      return;
    }
    line.textContent = (pos.turn === C.WHITE ? 'White' : 'Black') + ' to move. Click a piece, then a square — or drag and drop.';
  }

  /* ==================================================================
     Hints
     ================================================================== */
  function showHint() {
    if (state.view === 'puzzles' && puzzle.current) {
      var p = puzzle.current;
      var pos = currentPos();
      var mv = pos.sanToMove(p.sol);
      if (mv) {
        setArrows([{ from: mv.from, to: mv.to, color: '#d29922' }]);
        $('pz-status').className = 'banner warn';
        $('pz-status').textContent = 'Hint: try ' + C.sqName(mv.from) + ' → ' + C.sqName(mv.to) + '.';
      }
      return;
    }
    if (state.view === 'endgames' && drill.current) {
      var d = drill.current;
      var expected = (d.line || [])[drill.ply];
      var p2 = currentPos();
      var mv2 = expected ? p2.sanToMove(expected) : null;
      if (mv2) {
        setArrows([{ from: mv2.from, to: mv2.to, color: '#d29922' }]);
        $('eg-status').className = 'banner warn';
        $('eg-status').textContent = 'Hint: ' + expected + ' keeps the mate.';
      }
      return;
    }
    var pos3 = currentPos();
    var res = searchSync(pos3.clone(), 4, 500);
    if (res && res.move) {
      setArrows([{ from: res.move.from, to: res.move.to, color: '#d29922' }]);
      $('status-line').textContent = 'Hint: ' + (pos3.moveToSan(res.move)) + ' is the engine’s choice.';
    }
  }

  /* ==================================================================
     Views
     ================================================================== */
  function setView(view) {
    state.view = view;
    qsa('.tab').forEach(function (t) {
      var on = t.dataset.view === view;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.classList.toggle('active', on);
    });
    qsa('.panel').forEach(function (p) {
      p.classList.toggle('active', p.dataset.panel === view);
    });
    setArrows([]);
    if (view === 'puzzles') { refreshPuzzleList(); if (!puzzle.current) nextPuzzle(); }
    if (view === 'endgames') { if (!drill.current) newDrill(); }
    if (view === 'openings') renderOpeningList();
    if (view === 'analysis') {
      var fen = $('an-fen').value.trim();
      if (fen) setAnalysisPosition(fen);
    }
    render();
    updateStatus();
  }

  /* ==================================================================
     Lessons + shortcuts
     ================================================================== */
  function renderLessons() {
    var panel = qs('[data-panel="learn"]');
    var card = make('div', 'card');
    card.appendChild(make('div', 'card-title', '')).appendChild(make('span', '', 'Lessons'));
    card.lastChild.appendChild(make('span', 'pill', D.lessons.length + ' topics'));
    var wrap = make('div', 'prose');
    D.lessons.forEach(function (l) {
      var h = make('h3', '', l.title);
      wrap.appendChild(h);
      wrap.appendChild(make('p', 'hint', l.level + ' — ' + l.summary));
      l.body.forEach(function (b) {
        var d = make('div');
        d.innerHTML = b;
        wrap.appendChild(d);
      });
    });
    card.appendChild(wrap);
    panel.appendChild(card);
  }

  function renderShortcuts() {
    var table = $('shortcut-table');
    clear(table);
    D.shortcuts.forEach(function (s) {
      var tr = make('tr');
      tr.appendChild(make('td', '', s[0]));
      tr.appendChild(make('td', '', s[1]));
      table.appendChild(tr);
    });
  }

  /* ==================================================================
     Settings plumbing
     ================================================================== */
  function applyTheme() {
    var theme = settings.theme;
    if (theme === 'system') {
      var dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
      theme = dark ? 'light' : 'dark';
    }
    document.documentElement.dataset.theme = theme;
    $('btn-theme').textContent = theme === 'light' ? '☀' : '◐';
  }

  function applyPieceStyle() {
    document.body.dataset.pieces = settings.pieces;
  }

  function saveSettings() { store.set('ct.settings', settings); }

  function syncSettingsUI() {
    $('set-theme').value = settings.theme;
    $('set-pieces').value = settings.pieces;
    $('set-sound').setAttribute('aria-pressed', settings.sound ? 'true' : 'false');
    $('set-anim').setAttribute('aria-pressed', settings.anim ? 'true' : 'false');
    $('set-legal').setAttribute('aria-pressed', settings.legal ? 'true' : 'false');
    $('set-coords').setAttribute('aria-pressed', settings.coords ? 'true' : 'false');
    $('set-lastmove').setAttribute('aria-pressed', settings.lastmove ? 'true' : 'false');
    $('set-hints').setAttribute('aria-pressed', settings.hints ? 'true' : 'false');
    $('btn-sound').setAttribute('aria-pressed', settings.sound ? 'true' : 'false');
    $('btn-sound').textContent = settings.sound ? '🔊' : '🔇';
  }

  /* ==================================================================
     Wiring
     ================================================================== */
  function bind() {
    /* tabs */
    qsa('.tab').forEach(function (t) {
      t.addEventListener('click', function () { sfx('ui'); setView(t.dataset.view); });
    });

    /* board */
    frameEl.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    frameEl.addEventListener('contextmenu', onContextMenu);

    /* navigation */
    $('btn-first').addEventListener('click', function () { goTo(0); });
    $('btn-prev').addEventListener('click', function () { goTo(game.cursor - 1); });
    $('btn-next').addEventListener('click', function () { goTo(game.cursor + 1); });
    $('btn-last').addEventListener('click', function () { goTo(game.replay.length - 1); });
    $('btn-flip').addEventListener('click', flipBoard);
    $('btn-undo').addEventListener('click', function () {
      if (undoMove()) { stopEngine(); if (state.view === 'play' && play.active) scheduleEngineMove(); }
    });
    $('btn-hint').addEventListener('click', showHint);

    /* top bar */
    $('btn-theme').addEventListener('click', function () {
      settings.theme = settings.theme === 'dark' ? 'light' : 'dark';
      applyTheme(); syncSettingsUI(); saveSettings();
    });
    $('btn-sound').addEventListener('click', function () {
      settings.sound = !settings.sound;
      syncSettingsUI(); saveSettings();
      if (settings.sound) sfx('ui');
    });
    $('btn-help').addEventListener('click', function () {
      openModal('How to use the trainer', helpHtml());
    });
    $('modal-close').addEventListener('click', closeModal);
    $('modal').addEventListener('click', function (ev) { if (ev.target === $('modal')) closeModal(); });

    /* play */
    $('btn-newgame').addEventListener('click', function () { sfx('ui'); newGame(); });
    $('btn-resign').addEventListener('click', function () {
      if (!play.active) return;
      finishGame(currentPos().turn === C.WHITE ? '0-1' : '1-0');
    });
    $('btn-copy-pgn').addEventListener('click', function () {
      copyText(currentPgn(play.result));
    });
    $('btn-analyze').addEventListener('click', function () {
      setView('analysis');
      $('an-pgn').value = currentPgn(play.result);
      analyseGame();
    });
    $('btn-hint-game').addEventListener('click', showHint);

    /* puzzles */
    qsa('#pz-mode button').forEach(function (b) {
      b.addEventListener('click', function () {
        qsa('#pz-mode button').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
        b.setAttribute('aria-pressed', 'true');
        state.pzMode = b.dataset.mode;
        nextPuzzle();
      });
    });
    $('btn-pz-next').addEventListener('click', nextPuzzle);
    $('btn-pz-retry').addEventListener('click', function () {
      if (puzzle.current) {
        resetModel(puzzle.current.fen);
        buildSquares(); render(); updateMoveLists();
        puzzle.solved = false; puzzle.failed = false; puzzle.attempts = 0;
        $('pz-status').className = 'banner info';
        $('pz-status').textContent = 'Find the best move.';
        renderAttempts($('pz-attempts'), 0, false);
        setArrows([]);
      }
    });
    $('btn-pz-hint').addEventListener('click', showHint);
    $('btn-pz-solution').addEventListener('click', showPuzzleSolution);
    $('btn-pz-reset').addEventListener('click', function () {
      puzzleStats = { solved: 0, failed: 0, streak: 0, elo: 1200, done: [] };
      store.set('ct.puzzles', puzzleStats);
      updatePuzzleStats();
      toast('Puzzle progress reset.');
    });

    /* endgames */
    $('btn-eg-new').addEventListener('click', newDrill);
    $('btn-eg-hint').addEventListener('click', showHint);
    $('btn-eg-solution').addEventListener('click', function () {
      var d = drill.current;
      if (!d) return;
      var expected = (d.line || [])[drill.ply];
      if (!expected) return;
      var mv = currentPos().sanToMove(expected);
      if (mv) {
        pushMove(mv); sfx('move'); render(); updateMoveLists();
        drill.ply++;
        var reply = (d.line || [])[drill.ply];
        if (reply) {
          var mv2 = currentPos().sanToMove(reply);
          if (mv2) { pushMove(mv2); sfx('move'); render(); updateMoveLists(); drill.ply++; }
        }
      }
      $('eg-status').className = 'banner warn';
      $('eg-status').textContent = 'The winning continuation is ' + (d.line || []).join(' ') + '.';
    });
    $('btn-eg-reset').addEventListener('click', function () {
      drillStats = { solved: 0, mastered: 0, streak: 0, done: [] };
      store.set('ct.endgames', drillStats);
      updateDrillStats();
      toast('Endgame progress reset.');
    });
    $('eg-material').addEventListener('change', function () {
      state.egMaterial = $('eg-material').value;
      $('eg-goal').disabled = state.egMaterial === 'KPK';
      newDrill();
    });
    $('eg-goal').addEventListener('change', function () {
      state.egGoal = parseInt($('eg-goal').value, 10) || 2; newDrill();
    });

    /* openings */
    $('op-search').addEventListener('input', renderOpeningList);
    $('btn-op-load').addEventListener('click', function () {
      if (opening.current) loadOpening(opening.current);
    });
    $('btn-op-train').addEventListener('click', function () {
      if (opening.current) trainOpening(opening.current);
    });
    $('btn-op-quiz').addEventListener('click', function () {
      if (opening.current) startOpeningQuiz(opening.current);
    });

    /* analysis */
    $('btn-an-set').addEventListener('click', function () {
      var fen = $('an-fen').value.trim();
      if (!fen) { toast('Type a FEN first.', 'warn'); return; }
      setAnalysisPosition(fen);
    });
    $('btn-an-import').addEventListener('click', function () {
      var text = $('an-pgn').value.trim();
      if (!text) { toast('Paste a PGN first.', 'warn'); return; }
      importPgn(text);
    });
    $('btn-an-export').addEventListener('click', function () {
      $('an-pgn').value = currentPgn(game.result);
      toast('PGN written to the box below.');
    });
    $('btn-an-copy').addEventListener('click', function () { copyText(currentPgn(game.result)); });
    $('btn-an-clear').addEventListener('click', function () {
      $('an-pgn').value = '';
      $('an-fen').value = '';
      setAnalysisPosition(C.START_FEN);
      analysis.evalLine = [];
      $('an-moves').innerHTML = '';
      $('an-score').textContent = '—';
      $('an-depth-value').textContent = '—';
      $('an-nodes').textContent = '—';
      $('an-pv').textContent = '—';
      $('an-depth').textContent = 'idle';
    });
    $('btn-an-analyze').addEventListener('click', runAnalysis);
    $('btn-an-stop').addEventListener('click', function () {
      engine.stop();
      analysis.running = false;
      $('btn-an-analyze').textContent = 'Analyse';
      $('an-depth').textContent = 'stopped';
    });

    /* settings */
    $('set-theme').addEventListener('change', function () {
      settings.theme = $('set-theme').value; applyTheme(); saveSettings();
    });
    $('set-pieces').addEventListener('change', function () {
      settings.pieces = $('set-pieces').value; applyPieceStyle(); saveSettings();
    });
    [['set-sound', 'sound'], ['set-anim', 'anim'], ['set-legal', 'legal'],
     ['set-coords', 'coords'], ['set-lastmove', 'lastmove'], ['set-hints', 'hints']]
      .forEach(function (pair) {
        $(pair[0]).addEventListener('click', function () {
          settings[pair[1]] = !settings[pair[1]];
          syncSettingsUI(); saveSettings();
          if (pair[1] === 'coords') buildSquares();
          render();
        });
      });
    $('btn-reset-all').addEventListener('click', function () {
      store.remove('ct.puzzles'); store.remove('ct.endgames'); store.remove('ct.settings');
      store.remove('ct.game');
      puzzleStats = { solved: 0, failed: 0, streak: 0, elo: 1200, done: [] };
      drillStats = { solved: 0, mastered: 0, streak: 0, done: [] };
      settings = Object.assign({}, DEFAULT_SETTINGS);
      applyTheme(); applyPieceStyle(); syncSettingsUI(); saveSettings();
      buildSquares(); render(); updatePuzzleStats(); updateDrillStats();
      toast('All progress reset.');
    });

    /* puzzle filters */
    $('pz-theme').addEventListener('change', function () {
      state.pzTheme = $('pz-theme').value; nextPuzzle();
    });
    $('pz-rating').addEventListener('change', function () {
      state.pzRating = parseInt($('pz-rating').value, 10) || 0; nextPuzzle();
    });

    /* keyboard */
    window.addEventListener('keydown', onKey);
  }

  function stopEngine() { engine.stop(); }

  function flipBoard() {
    state.flipped = !state.flipped;
    buildSquares();
    render();
  }

  function onKey(ev) {
    var tag = (ev.target && ev.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    var k = ev.key;
    if (k === 'Escape') { closeModal(); return; }
    if (k === 'ArrowLeft') { goTo(game.cursor - 1); ev.preventDefault(); return; }
    if (k === 'ArrowRight') { goTo(game.cursor + 1); ev.preventDefault(); return; }
    if (k === 'Home') { goTo(0); ev.preventDefault(); return; }
    if (k === 'End') { goTo(game.replay.length - 1); ev.preventDefault(); return; }
    if (k === ' ') { flipBoard(); ev.preventDefault(); return; }
    var lower = k.toLowerCase();
    if (lower === 'f') { flipBoard(); return; }
    if (lower === 'u') { if (undoMove()) { stopEngine(); if (state.view === 'play' && play.active) scheduleEngineMove(); } return; }
    if (lower === 'h') { showHint(); return; }
    if (lower === 'n') {
      if (state.view === 'puzzles') nextPuzzle();
      else if (state.view === 'endgames') newDrill();
      else newGame();
      return;
    }
    if (lower === 'r' && state.view === 'play' && play.active) {
      finishGame(currentPos().turn === C.WHITE ? '0-1' : '1-0');
    }
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast('Copied to the clipboard.'); },
        function () { toast('Could not copy — select the text manually.', 'warn'); });
    } else {
      var ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); toast('Copied to the clipboard.'); }
      catch (e) { toast('Could not copy.', 'warn'); }
      document.body.removeChild(ta);
    }
  }

  function helpHtml() {
    return '<h3>Play</h3><ul>' +
      '<li>Pick a side, a strength and a time control, then press <strong>Start new game</strong>.</li>' +
      '<li>The engine answers automatically; your clock runs only while it is your move.</li>' +
      '<li><strong>Copy PGN</strong> exports the game, <strong>Analyze game</strong> reviews every move.</li></ul>' +
      '<h3>Puzzles</h3><ul>' +
      '<li>Every puzzle was verified with the built-in engine, so the “best move” is always the engine’s top choice.</li>' +
      '<li>Miss twice and the solution is revealed.</li></ul>' +
      '<h3>Endgames</h3><ul>' +
      '<li>Short checkmate patterns with a bare king. The drill checks your move with the engine, so any winning continuation is accepted.</li></ul>' +
      '<h3>Openings</h3><ul>' +
      '<li>Load a repertoire line on the board, train it move by move, or take the multiple-choice quiz.</li></ul>' +
      '<h3>Analysis</h3><ul>' +
      '<li>Paste a FEN or a PGN, then press <strong>Analyse</strong> for a live evaluation and principal variation.</li>' +
      '<li>The move list classifies every move as good, inaccuracy, mistake or blunder.</li></ul>' +
      '<h3>Everything is local</h3><p>No network requests, no external files: the rules, the engine, the puzzles and the artwork all live inside this one HTML file.</p>';
  }

  /* ==================================================================
     Boot
     ================================================================== */
  function init() {
    applyTheme();
    applyPieceStyle();
    syncSettingsUI();
    buildSquares();
    render();
    updatePuzzleStats();
    updateDrillStats();
    renderShortcuts();
    renderLessons();
    renderOpeningList();

    /* theme dropdown for puzzles */
    var themeSel = $('pz-theme');
    var seen = {};
    D.puzzles.forEach(function (p) {
      p.tags.forEach(function (t) { seen[t] = true; });
    });
    Object.keys(seen).sort().forEach(function (t) {
      var opt = make('option', '', t.charAt(0).toUpperCase() + t.slice(1));
      opt.value = t;
      themeSel.appendChild(opt);
    });

    bind();
    setView('play');

    /* restore the last game so it is not lost on reload */
    var last = store.get('ct.game', null);
    if (last && last.pgn) {
      try {
        var parsed = C.parsePgn(last.pgn);
        var conv = C.pgnToSanMoves(parsed);
        if (conv.moves.length) {
          loadLine(conv.moves.map(function (m) { return m.san; }), C.START_FEN,
            parsed.root && parsed.root.result !== '*' ? parsed.root.result : '*');
        }
      } catch (e) { /* ignore */ }
    }
  }

  /* a small handle for tests and for power users poking at the console */
  window.ChessTrainer = {
    C: C, D: D, state: state, settings: settings,
    game: game, puzzle: puzzle, drill: drill, opening: opening,
    engine: engine, search: searchSync
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
