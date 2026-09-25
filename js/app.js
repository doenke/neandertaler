/* Neandertaler – Karten, Rundentimer und Punkte für „Poesie für Neandertaler“. */
(function () {
  'use strict';

  // __BUILD__ wird beim Deploy durch den Commit-SHA ersetzt.
  const BUILD = '__BUILD__';

  const KEY_SETTINGS = 'neandertaler:settings';
  const KEY_GAME = 'neandertaler:game';
  const DEFAULT_NAMES = ['Team Mammut', 'Team Säbelzahn'];
  const UNDO_LIMIT = 30;

  const $ = (id) => document.getElementById(id);

  const load = (key, fallback) => {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch { return fallback; }
  };
  const save = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ohne Speicher weiter */ }
  };
  const drop = (key) => { try { localStorage.removeItem(key); } catch { /* egal */ } };

  const settings = Object.assign(
    { timer: 90, penalty: 'minus', sound: true, disabled: [] },
    load(KEY_SETTINGS, {})
  );
  let game = load(KEY_GAME, null);

  const saveSettings = () => save(KEY_SETTINGS, settings);
  const saveGame = () => { if (game) save(KEY_GAME, game); else drop(KEY_GAME); };

  // ---------------------------------------------------------------- Wertung

  /** Punkte-Änderung [Team 0, Team 1] für Bonk/Überspringen des aktiven Teams. */
  function penaltyPts(active) {
    const pts = [0, 0];
    if (settings.penalty === 'minus') pts[active] = -1;
    else if (settings.penalty === 'other') pts[1 - active] = 1;
    return pts;
  }

  function penaltyLabel() {
    return { minus: '−1', other: '+1 Gegner', none: '±0' }[settings.penalty] || '−1';
  }

  function applyPts(pts, sign = 1) {
    game.teams[0].score += sign * pts[0];
    game.teams[1].score += sign * pts[1];
  }

  /** Eintrag der aktuellen Karte im Protokoll (falls schon gewertet). */
  function currentEntry() {
    const card = game.card;
    if (!card) return null;
    for (let i = game.log.length - 1; i >= 0; i--) {
      const e = game.log[i];
      if (e.turn !== game.turn) break;
      if (e.id === card.id) return e;
    }
    return null;
  }

  function snapshot() {
    game.undo.push(JSON.stringify({
      scores: game.teams.map((t) => t.score),
      card: game.card,
      log: game.log.length,
      last: game.log.length ? { ...game.log[game.log.length - 1] } : null,
      pos: Deck.pos
    }));
    if (game.undo.length > UNDO_LIMIT) game.undo.shift();
  }

  function undo() {
    const raw = game.undo.pop();
    if (!raw) { toast('Nichts rückgängig zu machen.'); return; }
    const s = JSON.parse(raw);
    game.teams.forEach((t, i) => { t.score = s.scores[i]; });
    game.log.length = s.log;
    if (s.last && game.log.length) game.log[game.log.length - 1] = s.last;
    if (game.phase === 'play') {
      game.card = s.card;
      Deck.setPos(s.pos);
    }
    saveGame();
    render();
  }

  function scoreOne() {
    if (!game.card || game.card.got1) return;
    snapshot();
    const pts = [0, 0]; pts[game.active] = 1;
    applyPts(pts);
    game.log.push({ turn: game.turn, team: game.active, id: game.card.id, result: 'one', pts });
    game.card.got1 = true;
    saveGame();
    render();
    buzz(20);
  }

  function scoreThree() {
    if (!game.card) return;
    snapshot();
    const entry = currentEntry();
    if (entry) {
      // Aus dem gewerteten 1er wird ein 3er: die Karte zählt insgesamt 3.
      applyPts(entry.pts, -1);
      entry.result = 'three';
      entry.pts = [0, 0]; entry.pts[game.active] = 3;
      applyPts(entry.pts);
    } else {
      const pts = [0, 0]; pts[game.active] = 3;
      applyPts(pts);
      game.log.push({ turn: game.turn, team: game.active, id: game.card.id, result: 'three', pts });
    }
    buzz(20);
    nextCard();
  }

  /** Bonk oder Überspringen: die Karte verfällt, auch ein schon erratener 1er. */
  function scoreFail(result) {
    if (!game.card) return;
    snapshot();
    const pts = penaltyPts(game.active);
    const entry = currentEntry();
    if (entry) {
      applyPts(entry.pts, -1);
      entry.result = result;
      entry.pts = pts;
    } else {
      game.log.push({ turn: game.turn, team: game.active, id: game.card.id, result, pts });
    }
    applyPts(pts);
    buzz(result === 'bonk' ? [60, 40, 60] : 20);
    nextCard();
  }

  /** Nach einem 1er ohne Versuch am 3er zur nächsten Karte. */
  function keepOne() {
    if (!game.card || !game.card.got1) return;
    snapshot();
    nextCard();
  }

  function nextCard() {
    const { card, reshuffled } = Deck.draw();
    game.card = card ? { id: card.id, got1: false } : null;
    if (reshuffled) toast('Alle Karten gespielt – Stapel neu gemischt.');
    saveGame();
    render();
  }

  // ---------------------------------------------------------------- Ablauf

  function newGame(names, target) {
    game = {
      teams: names.map((name) => ({ name, score: 0 })),
      target,
      active: 0,
      turn: 1,
      phase: 'ready',
      endsAt: 0,
      remaining: 0,
      card: null,
      log: [],
      undo: []
    };
    Deck.rebuild();
    saveGame();
    show('game');
  }

  function startTurn() {
    unlockAudio();
    game.phase = 'play';
    game.endsAt = Date.now() + settings.timer * 1000;
    game.undo = [];
    nextCard();
    wakeLock(true);
    tick();
  }

  function pauseTurn() {
    game.remaining = Math.max(0, game.endsAt - Date.now());
    game.phase = 'pause';
    wakeLock(false);
    saveGame();
    render();
  }

  function resumeTurn() {
    unlockAudio();
    game.endsAt = Date.now() + game.remaining;
    game.phase = 'play';
    wakeLock(true);
    saveGame();
    render();
    tick();
  }

  function endTurn(timeUp) {
    // Die offene Karte zählt nicht; das andere Team hat die Hinweise ja gehört.
    game.card = null;
    game.phase = 'summary';
    game.endsAt = 0;
    wakeLock(false);
    saveGame();
    render();
    if (timeUp) alarm();
  }

  function nextTeam() {
    const t = game.target;
    if (t > 0 && game.teams.some((team) => team.score >= t)) {
      game.phase = 'over';
    } else {
      game.active = 1 - game.active;
      game.turn += 1;
      game.phase = 'ready';
    }
    game.undo = [];
    saveGame();
    render();
  }

  // ---------------------------------------------------------------- Timer

  let tickHandle = 0;
  let lastBeep = -1;
  function tick() {
    cancelAnimationFrame(tickHandle);
    if (!game || game.phase !== 'play') return;
    const left = game.endsAt - Date.now();
    renderTimer(left);
    if (left <= 0) { endTurn(true); return; }
    const sec = Math.ceil(left / 1000);
    if (sec <= 5 && sec !== lastBeep) { lastBeep = sec; beep(660, 0.06, 0.15); }
    tickHandle = requestAnimationFrame(tick);
  }

  function fmt(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  function renderTimer(left) {
    const total = settings.timer * 1000;
    $('timerText').value = fmt(left);
    $('timerFill').style.transform = `scaleX(${Math.max(0, Math.min(1, left / total))})`;
    $('timer').classList.toggle('urgent', left <= 10000 && game.phase === 'play');
  }

  // ---------------------------------------------------------------- Ton, Vibration, Wake Lock

  let audio = null;
  function unlockAudio() {
    if (!settings.sound) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
    } catch { audio = null; }
  }

  function beep(freq, dur, vol = 0.25, when = 0) {
    if (!settings.sound || !audio) return;
    try {
      const t = audio.currentTime + when;
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(gain).connect(audio.destination);
      osc.start(t);
      osc.stop(t + dur);
    } catch { /* kein Ton */ }
  }

  function buzz(pattern) {
    if (settings.sound && navigator.vibrate) navigator.vibrate(pattern);
  }

  function alarm() {
    beep(520, 0.25, 0.3, 0);
    beep(390, 0.25, 0.3, 0.3);
    beep(260, 0.5, 0.3, 0.6);
    buzz([300, 100, 300, 100, 500]);
  }

  let lock = null;
  async function wakeLock(on) {
    try {
      if (on && 'wakeLock' in navigator && !lock) {
        lock = await navigator.wakeLock.request('screen');
        lock.addEventListener('release', () => { lock = null; });
      } else if (!on && lock) {
        await lock.release();
        lock = null;
      }
    } catch { lock = null; }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && game && game.phase === 'play') {
      wakeLock(true);
      tick();
    }
  });

  // ---------------------------------------------------------------- Darstellung

  function show(view) {
    $('viewSetup').hidden = view !== 'setup';
    $('viewGame').hidden = view !== 'game';
    if (view === 'setup') renderSetup(); else render();
  }

  function renderSetup() {
    const running = game && game.phase !== 'over';
    $('btnResume').hidden = !running;
    if (game) {
      $('team0').value = game.teams[0].name === DEFAULT_NAMES[0] ? '' : game.teams[0].name;
      $('team1').value = game.teams[1].name === DEFAULT_NAMES[1] ? '' : game.teams[1].name;
      $('target').value = game.target || 0;
    }
    renderDeckInfo();
  }

  function renderDeckInfo() {
    if (!Deck.cards.length) return;
    const pool = Deck.pool().length;
    $('deckInfo').textContent =
      `${pool} Karten im Stapel, davon ${Deck.unseenCount()} noch nicht gespielt.`;
  }

  const STAGES = { ready: 'stageReady', play: 'stagePlay', pause: 'stagePause', summary: 'stageSummary', over: 'stageOver' };

  function render() {
    if (!game || $('viewGame').hidden) return;

    game.teams.forEach((t, i) => {
      const el = $(`score${i}`);
      el.querySelector('.team-name').textContent = t.name;
      el.querySelector('.team-score').textContent = t.score;
      el.classList.toggle('active', i === game.active && game.phase !== 'over');
    });

    for (const [phase, id] of Object.entries(STAGES)) $(id).hidden = game.phase !== phase;
    document.body.dataset.team = String(game.active);

    const left = game.phase === 'play' ? game.endsAt - Date.now()
      : game.phase === 'pause' ? game.remaining
      : game.phase === 'ready' ? settings.timer * 1000 : 0;
    $('timer').hidden = game.phase === 'over';
    renderTimer(left);

    $('turnNo').textContent = game.turn;
    $('readyTeam').textContent = game.teams[game.active].name;
    $('deckLeft').textContent = `${Deck.remaining()} Karten übrig`;

    if (game.phase === 'play') renderCard();
    if (game.phase === 'summary') renderSummary();
    if (game.phase === 'over') renderOver();
  }

  function renderCard() {
    const card = game.card && Deck.byId.get(game.card.id);
    if (!card) { $('cardOne').textContent = 'Keine Karten'; $('cardThree').textContent = ''; return; }
    const got1 = game.card.got1;
    $('cardOne').textContent = card.one;
    $('cardThree').textContent = card.three;
    $('cardCat').textContent = card.cat;
    $('card').classList.toggle('got1', got1);
    $('btnOne').disabled = got1;
    const pen = penaltyLabel();
    $('bonkHint').textContent = got1 ? `1 verfällt, ${pen}` : pen;
    $('btnSkip').firstChild.textContent = got1 ? 'Weiter' : 'Überspringen';
    $('skipHint').textContent = got1 ? '1 behalten' : pen;
    $('btnUndo').disabled = !game.undo.length;
  }

  const RESULT = {
    one: ['✓', 'ok'], three: ['✓✓', 'ok'], bonk: ['Bonk', 'bad'], skip: ['–', 'bad']
  };

  function renderSummary() {
    const entries = game.log.filter((e) => e.turn === game.turn);
    const sum = entries.reduce((acc, e) => acc + e.pts[game.active] - e.pts[1 - game.active], 0);
    const gained = entries.reduce((acc, e) => acc + e.pts[game.active], 0);
    const other = entries.reduce((acc, e) => acc + e.pts[1 - game.active], 0);
    $('turnPoints').textContent = entries.length
      ? `${game.teams[game.active].name}: ${gained >= 0 ? '+' : '−'}${Math.abs(gained)}` +
        (other ? ` · ${game.teams[1 - game.active].name}: +${other}` : '')
      : 'Keine Karte gewertet.';
    $('turnPoints').dataset.sign = sum >= 0 ? 'plus' : 'minus';
    const list = $('summaryList');
    list.replaceChildren(...entries.map((e) => {
      const card = Deck.byId.get(e.id);
      const li = document.createElement('li');
      const [mark, cls] = RESULT[e.result] || ['?', ''];
      li.className = cls;
      const word = e.result === 'three' ? card?.three : card?.one;
      const pts = e.pts[game.active] || (e.pts[1 - game.active] ? `+${e.pts[1 - game.active]} Gegner` : 0);
      li.innerHTML = '<span class="mark"></span><span class="w"></span><span class="p"></span>';
      li.children[0].textContent = mark;
      li.children[1].textContent = word || '?';
      li.children[2].textContent = typeof pts === 'number' ? (pts > 0 ? `+${pts}` : String(pts).replace('-', '−')) : pts;
      return li;
    }));
    $('btnUndoSummary').hidden = !game.undo.length;
  }

  function renderOver() {
    const [a, b] = game.teams;
    $('winner').textContent = a.score === b.score ? 'Unentschieden!'
      : `${(a.score > b.score ? a : b).name} gewinnt!`;
    $('finalScore').textContent = `${a.name} ${a.score} : ${b.score} ${b.name}`;
  }

  // ---------------------------------------------------------------- Dialoge

  let scoreTeam = 0;
  function openScore(team) {
    scoreTeam = team;
    $('dlgScoreTitle').textContent = `Punkte ${game.teams[team].name}`;
    $('dlgScoreValue').value = game.teams[team].score;
    $('dlgScore').showModal();
  }

  $('dlgScore').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-delta]');
    if (!btn) return;
    game.teams[scoreTeam].score += Number(btn.dataset.delta);
    $('dlgScoreValue').value = game.teams[scoreTeam].score;
    saveGame();
    render();
  });

  function openSettings() {
    $('setTimer').value = settings.timer;
    $('timerOut').value = settings.timer;
    for (const r of document.querySelectorAll('input[name=penalty]')) r.checked = r.value === settings.penalty;
    $('setSound').checked = settings.sound;
    const box = $('catList');
    box.replaceChildren(...Deck.categories.map((cat) => {
      const n = Deck.cards.filter((c) => c.cat === cat).length;
      const label = document.createElement('label');
      label.className = 'chip';
      label.innerHTML = '<input type="checkbox"><span></span>';
      label.firstChild.value = cat;
      label.firstChild.checked = !settings.disabled.includes(cat);
      label.lastChild.textContent = `${cat} (${n})`;
      return label;
    }));
    renderSeenInfo();
    $('appVersion').textContent = BUILD.startsWith('__') ? 'dev' : BUILD;
    $('dlgSettings').showModal();
  }

  function renderSeenInfo() {
    $('seenInfo').textContent = `${Deck.seen.size} von ${Deck.cards.length} Karten schon gespielt.`;
  }

  $('setTimer').addEventListener('input', (e) => { $('timerOut').value = e.target.value; });

  $('settingsForm').addEventListener('change', () => {
    settings.timer = Number($('setTimer').value);
    settings.penalty = document.querySelector('input[name=penalty]:checked')?.value || 'minus';
    settings.sound = $('setSound').checked;
    let disabled = [...$('catList').querySelectorAll('input')].filter((i) => !i.checked).map((i) => i.value);
    if (disabled.length === Deck.categories.length) {
      // Ohne Kategorie gäbe es keine Karten.
      disabled = settings.disabled;
      toast('Mindestens eine Kategorie muss an bleiben.');
      for (const i of $('catList').querySelectorAll('input')) i.checked = !disabled.includes(i.value);
    }
    settings.disabled = disabled;
    Deck.setDisabled(disabled);
    saveSettings();
    renderDeckInfo();
    render();
  });

  $('btnResetSeen').addEventListener('click', () => {
    Deck.resetSeen();
    renderSeenInfo();
    renderDeckInfo();
    render();
    toast('Alle Karten gelten wieder als neu.');
  });

  // ---------------------------------------------------------------- Toast

  let toastTimer = 0;
  function toast(text, actionLabel, action) {
    const el = $('toast');
    $('toastText').textContent = text;
    const btn = $('toastAction');
    btn.hidden = !actionLabel;
    btn.textContent = actionLabel || '';
    btn.onclick = action || null;
    el.hidden = false;
    clearTimeout(toastTimer);
    if (!actionLabel) toastTimer = setTimeout(() => { el.hidden = true; }, 3500);
  }

  // ---------------------------------------------------------------- Ereignisse

  $('setupForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const names = [0, 1].map((i) => $(`team${i}`).value.trim() || DEFAULT_NAMES[i]);
    const target = Math.max(0, Math.min(999, parseInt($('target').value, 10) || 0));
    newGame(names, target);
  });
  $('btnResume').addEventListener('click', () => show('game'));

  $('btnStartTurn').addEventListener('click', startTurn);
  $('btnOne').addEventListener('click', scoreOne);
  $('btnThree').addEventListener('click', scoreThree);
  $('btnBonk').addEventListener('click', () => scoreFail('bonk'));
  $('btnSkip').addEventListener('click', () => (game.card && game.card.got1 ? keepOne() : scoreFail('skip')));
  $('btnUndo').addEventListener('click', undo);
  $('btnUndoSummary').addEventListener('click', undo);
  $('btnPause').addEventListener('click', pauseTurn);
  $('btnResumeTurn').addEventListener('click', resumeTurn);
  $('btnEndTurn').addEventListener('click', () => endTurn(false));
  $('btnNextTeam').addEventListener('click', nextTeam);
  $('btnNewGame').addEventListener('click', () => show('setup'));
  $('btnContinue').addEventListener('click', () => {
    game.target = 0;
    game.active = 1 - game.active;
    game.turn += 1;
    game.phase = 'ready';
    saveGame();
    render();
  });

  for (const i of [0, 1]) $(`score${i}`).addEventListener('click', () => openScore(i));
  for (const b of document.querySelectorAll('[data-open-settings]')) b.addEventListener('click', openSettings);

  $('btnMenu').addEventListener('click', () => $('dlgMenu').showModal());
  $('menuSwitch').addEventListener('click', () => {
    if (game.phase === 'play' || game.phase === 'pause') endTurn(false);
    game.active = 1 - game.active;
    game.turn += 1;
    game.phase = 'ready';
    game.undo = [];
    saveGame();
    $('dlgMenu').close();
    render();
  });
  $('menuFinish').addEventListener('click', () => {
    if (game.phase === 'play' || game.phase === 'pause') endTurn(false);
    game.phase = 'over';
    saveGame();
    $('dlgMenu').close();
    render();
  });
  $('menuHome').addEventListener('click', () => {
    if (game.phase === 'play') pauseTurn();
    $('dlgMenu').close();
    show('setup');
  });

  // Dialoge schließen beim Tippen auf den Hintergrund.
  for (const dlg of document.querySelectorAll('dialog')) {
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  }

  // ---------------------------------------------------------------- Service Worker

  if ('serviceWorker' in navigator) {
    const hadController = !!navigator.serviceWorker.controller;
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
    // Nach einem Deploy übernimmt der neue Service Worker sofort; nur dann,
    // wenn vorher schon einer aktiv war, ist das ein echtes Update.
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController) toast('Neue Version verfügbar.', 'Neu laden', () => location.reload());
    });
  }

  // ---------------------------------------------------------------- Start

  (async function init() {
    try {
      await Deck.load();
    } catch (err) {
      $('deckInfo').textContent = `Karten konnten nicht geladen werden: ${err.message}`;
      return;
    }
    Deck.setDisabled(settings.disabled);
    if (!Deck.order.length) Deck.rebuild();

    if (game && (!game.teams || !Array.isArray(game.log))) game = null;
    if (game) {
      game.undo = game.undo || [];
      if (game.phase === 'play') {
        // Neu geladen mitten im Zug: Zeit läuft weiter, sofern noch welche übrig ist.
        if (game.endsAt <= Date.now()) endTurn(false);
        else { show('game'); tick(); wakeLock(true); return; }
      }
      show(game.phase === 'over' ? 'setup' : 'game');
    } else {
      show('setup');
    }
  })();
})();
