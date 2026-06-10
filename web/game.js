'use strict';

/* =====================================================================
   SQWORDS — web edition
   Four 5-letter words form a square frame, sharing corner letters.
   Every letter of a guess is revealed everywhere it appears.
   ===================================================================== */

const MAX_WRONG   = 3;
const MAX_HINTS   = 3;
const HINT_COST   = 15;
const WIN_BONUS   = 25;                       // per unused wrong guess
const POINTS      = [100, 80, 60, 40, 30, 20, 10];
const EPOCH       = '2026-01-01';             // daily puzzle #1

const WORD_SET = new Set(ALLOWED_WORDS);   // any of these is a valid guess
const byFirst = {}, byFirstLast = {};      // puzzle words come only from ANSWER_WORDS
for (const w of ANSWER_WORDS) {
  (byFirst[w[0]] = byFirst[w[0]] || []).push(w);
  const k = w[0] + w[4];
  (byFirstLast[k] = byFirstLast[k] || []).push(w);
}

/* ---------------- seeded RNG (deterministic daily puzzles) ---------- */
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];

/* ---------------- puzzle generation --------------------------------
   words[0]=TOP  words[1]=LEFT  words[2]=RIGHT  words[3]=BOTTOM
   LEFT starts with TOP[0]; RIGHT starts with TOP[4];
   BOTTOM starts with LEFT[4] and ends with RIGHT[4].               */
function generatePuzzle(rng) {
  for (let attempt = 0; attempt < 5000; attempt++) {
    const top = pick(ANSWER_WORDS, rng);
    const lefts = (byFirst[top[0]] || []).filter(w => w !== top);
    if (!lefts.length) continue;
    const left = pick(lefts, rng);
    const rights = (byFirst[top[4]] || []).filter(w => w !== top && w !== left);
    if (!rights.length) continue;
    const right = pick(rights, rng);
    const bottoms = (byFirstLast[left[4] + right[4]] || [])
      .filter(w => w !== top && w !== left && w !== right);
    if (!bottoms.length) continue;
    return [top, left, right, pick(bottoms, rng)];
  }
  return null;
}

/* ---------------- date helpers -------------------------------------- */
function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}
function dailyNumber(dateStr) {
  return Math.round((new Date(dateStr) - new Date(EPOCH)) / 86400000) + 1;
}

/* ---------------- persistent storage -------------------------------- */
const store = {
  get(key, fallback) {
    try { return JSON.parse(localStorage.getItem('sqwords.' + key)) ?? fallback; }
    catch { return fallback; }
  },
  set(key, val) {
    try { localStorage.setItem('sqwords.' + key, JSON.stringify(val)); } catch {}
  }
};

/* ---------------- game state ---------------------------------------- */
let G = null;          // current game
let cur = '';          // letters typed so far

function newGame(mode) {
  const dateStr = todayStr();
  const rng = mode === 'daily'
    ? mulberry32(hashString('sqwords-' + dateStr))
    : mulberry32((Math.random() * 4294967296) >>> 0);
  const words = generatePuzzle(rng);
  const dailyDone = store.get('dailyDone', {});
  G = {
    mode, dateStr, words,
    distinct: new Set(words.join('')),
    revealed: new Set(),         // letters hit so far
    guessedLetters: new Set(),   // every letter the player has tried
    guesses: [],
    wrong: 0,
    points: 0,
    hintsUsed: 0,
    solved: [null, null, null, null],   // 'named' | 'auto' | null
    over: false, won: false,
    playerRevealed: null,        // snapshot for sharing after a loss
    replay: mode === 'daily' && !!dailyDone[dateStr],
  };
  cur = '';
}

const basePoints = n => POINTS[Math.min(Math.max(n, 1) - 1, POINTS.length - 1)];

/* award points for any newly named/auto-completed words, then
   check the end of the game. gn = guess number used for scoring. */
function settle(gn, namedWord) {
  G.words.forEach((w, i) => {
    if (namedWord && w === namedWord && !G.solved[i]) {
      G.solved[i] = 'named';
      G.points += basePoints(gn);
    }
  });
  G.words.forEach((w, i) => {
    if (!G.solved[i] && [...w].every(c => G.revealed.has(c))) {
      G.solved[i] = 'auto';
      G.points += basePoints(gn) - 10;
    }
  });
  if ([...G.distinct].every(c => G.revealed.has(c))) {
    G.won = true;
    G.over = true;
    G.points += WIN_BONUS * (MAX_WRONG - G.wrong);
  } else if (G.wrong >= MAX_WRONG) {
    G.playerRevealed = new Set(G.revealed);
    G.over = true;
  }
}

/* returns {ok, msg} — msg shown as toast when rejected */
function submitGuess(word) {
  if (G.over) return { ok: false };
  if (word.length < 5) return { ok: false, msg: 'Not enough letters' };
  if (!WORD_SET.has(word)) return { ok: false, msg: 'Not in word list' };
  if (G.guesses.includes(word)) return { ok: false, msg: 'Already guessed' };
  const idx = G.words.indexOf(word);
  if (idx >= 0 && G.solved[idx]) return { ok: false, msg: 'Already solved!' };

  G.guesses.push(word);
  if (idx < 0) G.wrong++;                       // naming a square word is free
  for (const ch of word) {
    G.guessedLetters.add(ch);
    if (G.distinct.has(ch)) G.revealed.add(ch);
  }
  settle(G.guesses.length, idx >= 0 ? word : null);
  return { ok: true };
}

function useHint() {
  if (G.over || G.hintsUsed >= MAX_HINTS) return false;
  const pool = [...G.distinct].filter(c => !G.revealed.has(c));
  if (!pool.length) return false;
  G.revealed.add(pool[Math.floor(Math.random() * pool.length)]);
  G.hintsUsed++;
  G.points -= HINT_COST;
  settle(G.guesses.length, null);
  return true;
}

/* ---------------- records: history + leaderboard -------------------- */
function recordGame() {
  if (G.replay) return;                          // daily replays aren't scored
  if (G.mode === 'daily') {
    const dd = store.get('dailyDone', {});
    dd[G.dateStr] = { won: G.won, score: G.points };
    store.set('dailyDone', dd);
  }
  const hist = store.get('history', []);
  hist.unshift({
    d: G.dateStr, mode: G.mode, won: G.won, score: G.points,
    guesses: G.guesses.length, hints: G.hintsUsed, words: G.words,
    share: shareText(),
  });
  store.set('history', hist.slice(0, 200));
}

function saveToLeaderboard(name) {
  const lb = store.get('leaderboard', []);
  lb.push({ name, score: G.points, d: G.dateStr, mode: G.mode, won: G.won });
  lb.sort((a, b) => b.score - a.score);
  store.set('leaderboard', lb.slice(0, 10));
  store.set('name', name);
}

function computeStats() {
  const hist = store.get('history', []);
  const played = hist.length;
  const wins = hist.filter(h => h.won).length;
  let streak = 0;
  for (const h of hist) { if (h.won) streak++; else break; }
  let best = 0, run = 0;
  for (let i = hist.length - 1; i >= 0; i--) {
    run = hist[i].won ? run + 1 : 0;
    if (run > best) best = run;
  }
  const bestScore = played ? Math.max(...hist.map(h => h.score)) : 0;
  const avg = played ? Math.round(hist.reduce((s, h) => s + h.score, 0) / played) : 0;
  const dailies = hist.filter(h => h.mode === 'daily' && h.won).length;
  return { played, winPct: played ? Math.round(100 * wins / played) : 0,
           streak, best, bestScore, avg, dailies,
           hints: hist.reduce((s, h) => s + (h.hints || 0), 0) };
}

/* ---------------- share text ---------------------------------------- */
function shareText() {
  const seen = G.won ? G.revealed : (G.playerRevealed || G.revealed);
  const namedLetters = new Set();
  G.words.forEach((w, i) => { if (G.solved[i] === 'named') for (const c of w) namedLetters.add(c); });
  let grid = '';
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const ch = cellLetter(r, c);
      grid += ch === null ? '  ' : !seen.has(ch) ? '🟥' : namedLetters.has(ch) ? '🟨' : '🟩';
    }
    grid += '\n';
  }
  const hearts = '❤️'.repeat(MAX_WRONG - G.wrong) + '🖤'.repeat(G.wrong);
  const label = G.mode === 'daily' ? `Daily #${dailyNumber(G.dateStr)}` : 'Random';
  return `SQWORDS ${label} · ${G.dateStr}\n` +
         `${G.won ? '🏆 WON' : '💀 LOST'} · ${G.points} pts · ` +
         `${G.guesses.length} guesses · ${hearts}\n${grid}`;
}

/* board geometry: letter at grid cell (r,c), null for interior */
function cellLetter(r, c) {
  if (r === 0) return G.words[0][c];   // top
  if (r === 4) return G.words[3][c];   // bottom
  if (c === 0) return G.words[1][r];   // left
  if (c === 4) return G.words[2][r];   // right
  return null;
}
/* which of the 4 words contain cell (r,c) — corners belong to two */
function cellWords(r, c) {
  const out = [];
  if (r === 0) out.push(0);
  if (r === 4) out.push(3);
  if (c === 0) out.push(1);
  if (c === 4) out.push(2);
  return out;
}

/* =====================================================================
   UI — everything below touches the DOM
   ===================================================================== */
function initUI() {
  const $ = id => document.getElementById(id);
  const els = {
    board: $('board'), hearts: $('hearts'), score: $('score'),
    hint: $('btn-hint'), solvedRow: $('solved-row'), entry: $('entry'),
    keyboard: $('keyboard'), toast: $('toast'), modeInfo: $('mode-info'),
    daily: $('btn-daily'), random: $('btn-random'),
    overTitle: $('over-title'), overWords: $('over-words'),
    overScore: $('over-score'), overNameRow: $('over-name-row'),
    overName: $('over-name'), confetti: $('confetti'),
  };
  const WORD_LABELS = ['top', 'left', 'right', 'bottom'];
  let toastTimer = null, overShown = false;

  /* ---- board ---- */
  function buildBoard() {
    els.board.innerHTML = '';
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        if (cellLetter(r, c) === null) continue;
        const d = document.createElement('div');
        d.className = 'cell';
        d.style.gridArea = `${r + 1} / ${c + 1}`;
        d.dataset.r = r; d.dataset.c = c;
        els.board.appendChild(d);
      }
    }
    const center = document.createElement('div');
    center.className = 'board-center';
    center.innerHTML = `<b id="center-pts">0</b><div>POINTS</div><div id="center-mode"></div>`;
    els.board.appendChild(center);
  }

  function render() {
    for (const d of els.board.querySelectorAll('.cell')) {
      const r = +d.dataset.r, c = +d.dataset.c;
      const ch = cellLetter(r, c);
      const shown = G.revealed.has(ch) || G.over;
      d.textContent = shown ? ch : '';
      d.classList.toggle('missed', G.over && !G.revealed.has(ch));
      const named = cellWords(r, c).some(i => G.solved[i] === 'named');
      d.classList.toggle('named', shown && !d.classList.contains('missed') && named);
      d.classList.toggle('revealed', G.revealed.has(ch) && !named);
    }
    document.getElementById('center-pts').textContent = G.points;
    document.getElementById('center-mode').textContent =
      G.mode === 'daily' ? `DAILY #${dailyNumber(G.dateStr)}` : 'RANDOM';

    els.hearts.textContent = '❤️'.repeat(MAX_WRONG - G.wrong) + '🖤'.repeat(G.wrong);
    els.score.textContent = G.points;
    els.hint.disabled = G.over || G.hintsUsed >= MAX_HINTS;

    els.solvedRow.innerHTML = '';
    G.words.forEach((w, i) => {
      const chip = document.createElement('span');
      chip.className = 'chip' + (G.solved[i] === 'named' ? ' exact' : G.solved[i] ? ' done' : '');
      chip.textContent = G.solved[i] || G.over ? `${WORD_LABELS[i]}: ${w}` : WORD_LABELS[i];
      els.solvedRow.appendChild(chip);
    });

    els.entry.innerHTML = '';
    for (let i = 0; i < 5; i++) {
      const s = document.createElement('div');
      s.className = 'slot' + (cur[i] ? ' filled' : '');
      s.textContent = cur[i] || '';
      els.entry.appendChild(s);
    }

    for (const k of els.keyboard.querySelectorAll('.key[data-letter]')) {
      const l = k.dataset.letter;
      k.classList.toggle('hit', G.revealed.has(l));
      k.classList.toggle('miss', G.guessedLetters.has(l) && !G.distinct.has(l));
    }

    els.modeInfo.textContent = G.mode === 'daily'
      ? (G.replay ? 'replay — not scored' : `puzzle #${dailyNumber(G.dateStr)}`)
      : 'free play';
  }

  /* ---- keyboard ---- */
  function buildKeyboard() {
    const rows = ['qwertyuiop', 'asdfghjkl', '#zxcvbnm<'];
    els.keyboard.innerHTML = '';
    for (const row of rows) {
      const rd = document.createElement('div');
      rd.className = 'krow';
      for (const ch of row) {
        const b = document.createElement('button');
        if (ch === '#') { b.className = 'key wide'; b.textContent = 'ENTER'; b.dataset.action = 'enter'; }
        else if (ch === '<') { b.className = 'key wide'; b.textContent = '⌫'; b.dataset.action = 'back'; }
        else { b.className = 'key'; b.textContent = ch; b.dataset.letter = ch; }
        rd.appendChild(b);
      }
      els.keyboard.appendChild(rd);
    }
    els.keyboard.addEventListener('click', e => {
      const b = e.target.closest('.key');
      if (!b) return;
      b.blur();
      if (b.dataset.letter) typeLetter(b.dataset.letter);
      else if (b.dataset.action === 'enter') doSubmit();
      else if (b.dataset.action === 'back') backspace();
    });
  }

  function typeLetter(l) {
    if (G.over || cur.length >= 5) return;
    cur += l;
    render();
  }
  function backspace() {
    cur = cur.slice(0, -1);
    render();
  }
  function doSubmit() {
    const res = submitGuess(cur);
    if (!res.ok) {
      if (res.msg) { toast(res.msg); shakeEntry(); }
      return;
    }
    cur = '';
    render();
    if (G.over) finishGame();
  }
  function shakeEntry() {
    els.entry.classList.remove('shake');
    void els.entry.offsetWidth;
    els.entry.classList.add('shake');
  }

  function toast(msg, ms = 1600) {
    els.toast.textContent = msg;
    els.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove('show'), ms);
  }

  /* ---- game over ---- */
  function finishGame() {
    recordGame();
    if (G.won) confettiBurst();
    setTimeout(showOverModal, G.won ? 900 : 600);
  }

  function showOverModal() {
    overShown = true;
    els.overTitle.textContent = G.won ? '🏆 You solved the square!' : '💀 Out of guesses';
    els.overWords.innerHTML = '';
    G.words.forEach((w, i) => {
      const chip = document.createElement('span');
      chip.className = 'chip ' + (G.solved[i] === 'named' ? 'exact' : G.solved[i] ? 'done' : '');
      chip.textContent = `${WORD_LABELS[i]}: ${w}`;
      els.overWords.appendChild(chip);
    });
    els.overScore.textContent = `${G.points} points · ${G.guesses.length} guesses` +
      (G.hintsUsed ? ` · ${G.hintsUsed} hint${G.hintsUsed > 1 ? 's' : ''}` : '');
    const lb = store.get('leaderboard', []);
    const qualifies = !G.replay && G.points > 0 &&
      (lb.length < 10 || G.points > lb[lb.length - 1].score);
    const savedName = store.get('name', '');
    if (qualifies && savedName) {
      // name already known -- save automatically, no extra click needed
      saveToLeaderboard(savedName);
      els.overNameRow.classList.add('hidden');
      els.overScore.textContent += ` · saved to leaderboard as ${savedName}`;
    } else {
      els.overNameRow.classList.toggle('hidden', !qualifies);
      els.overName.value = savedName;
    }
    openModal('modal-over');
  }

  /* ---- modals ---- */
  function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
  function closeModals() {
    document.querySelectorAll('.modal-back').forEach(m => m.classList.add('hidden'));
  }
  document.querySelectorAll('.modal-back').forEach(m => {
    m.addEventListener('click', e => { if (e.target === m) closeModals(); });
  });
  document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeModals));

  /* ---- stats / leaderboard panels ---- */
  function renderStats() {
    const today = todayStr();
    const td = store.get('history', []).find(h => h.mode === 'daily' && h.d === today);
    const tdEl = document.getElementById('today-daily');
    if (td) {
      tdEl.innerHTML = `<div class="today-box">
          <div class="today-head">Daily #${dailyNumber(today)} · ${td.won ? '🏆 Won' : '💀 Lost'} ·
            ${td.score} pts · ${td.guesses} guesses</div>
          ${td.share ? `<pre class="share-grid">${td.share.split('\n').slice(2).join('\n').trimEnd()}</pre>` : ''}
          <button class="small-btn" id="btn-copy-daily">📋 Copy result</button>
        </div>`;
      document.getElementById('btn-copy-daily').addEventListener('click', async () => {
        const text = td.share ||
          `SQWORDS Daily #${dailyNumber(today)} · ${today}\n` +
          `${td.won ? '🏆 WON' : '💀 LOST'} · ${td.score} pts · ${td.guesses} guesses`;
        try {
          await navigator.clipboard.writeText(text);
          toast('Result copied — paste it anywhere!');
        } catch {
          toast('Could not copy — see console');
          console.log(text);
        }
      });
    } else {
      tdEl.innerHTML = `<div class="empty-note">You haven't finished today's daily (#${dailyNumber(today)}) yet.</div>`;
    }
    const s = computeStats();
    const cells = [
      [s.played, 'played'], [s.winPct + '%', 'win rate'],
      [s.streak, 'streak'], [s.best, 'best streak'],
      [s.bestScore, 'best score'], [s.avg, 'avg score'],
      [s.dailies, 'dailies won'], [s.hints, 'hints used'],
    ];
    document.getElementById('stat-grid').innerHTML =
      cells.map(([v, l]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`).join('');
    const hist = store.get('history', []).slice(0, 10);
    document.getElementById('history-list').innerHTML = hist.length
      ? hist.map(h => `<div class="hist-row">
            <span class="res">${h.won ? '🏆' : '💀'}</span>
            <span>${h.d}</span>
            <span class="words">${h.words.join(' · ')}</span>
            <span class="pts">${h.score}</span>
          </div>`).join('')
      : '<div class="empty-note">No games yet — go play!</div>';
  }

  function renderLeaderboard() {
    const lb = store.get('leaderboard', []);
    document.getElementById('leaderboard-list').innerHTML = lb.length
      ? lb.map((e, i) => `<div class="lb-row">
            <span class="rank">${i + 1}</span>
            <span class="name">${escapeHtml(e.name)}</span>
            <span class="meta">${e.d} · ${e.mode}</span>
            <span class="pts">${e.score}</span>
          </div>`).join('')
      : '<div class="empty-note">No scores yet. Finish a game with points to claim the top spot!</div>';
  }
  const escapeHtml = s => s.replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---- confetti ---- */
  function confettiBurst() {
    const cv = els.confetti, ctx = cv.getContext('2d');
    cv.width = innerWidth; cv.height = innerHeight;
    const colors = ['#6c8cff', '#9b6cff', '#ff6c9b', '#3aa46b', '#c9a227', '#ffffff'];
    const parts = Array.from({ length: 160 }, () => ({
      x: cv.width / 2 + (Math.random() - 0.5) * 220,
      y: cv.height / 2.6,
      vx: (Math.random() - 0.5) * 11,
      vy: -Math.random() * 11 - 3,
      s: Math.random() * 7 + 4,
      c: colors[Math.floor(Math.random() * colors.length)],
      a: Math.random() * Math.PI,
      va: (Math.random() - 0.5) * 0.3,
    }));
    let frames = 0;
    (function tick() {
      ctx.clearRect(0, 0, cv.width, cv.height);
      for (const p of parts) {
        p.x += p.vx; p.y += p.vy; p.vy += 0.28; p.a += p.va;
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(p.a);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6);
        ctx.restore();
      }
      if (++frames < 150) requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, cv.width, cv.height);
    })();
  }

  /* ---- top-level buttons ---- */
  function startGame(mode) {
    // drop focus from whatever button started the game, so Enter/Space
    // afterwards only submit guesses instead of re-triggering the button
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    newGame(mode);
    els.daily.classList.toggle('active', mode === 'daily');
    els.random.classList.toggle('active', mode === 'random');
    overShown = false;
    closeModals();
    buildBoard();
    render();
    if (G.replay) toast("Today's daily already played — replays aren't scored", 2600);
  }

  els.daily.addEventListener('click', () => startGame('daily'));
  els.random.addEventListener('click', () => startGame('random'));
  els.hint.addEventListener('click', () => {
    els.hint.blur();
    if (useHint()) {
      render();
      if (G.over) finishGame();
    }
  });
  document.getElementById('btn-help').addEventListener('click', () => openModal('modal-help'));
  document.getElementById('btn-stats').addEventListener('click', () => { renderStats(); openModal('modal-stats'); });
  document.getElementById('btn-board').addEventListener('click', () => { renderLeaderboard(); openModal('modal-board'); });
  document.getElementById('btn-again').addEventListener('click', () => startGame(G.mode === 'daily' ? 'random' : G.mode));
  document.getElementById('btn-share').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(shareText());
      toast('Result copied to clipboard!');
    } catch {
      toast('Could not copy — see console');
      console.log(shareText());
    }
  });
  document.getElementById('btn-save-score').addEventListener('click', () => {
    const name = els.overName.value.trim() || 'anon';
    saveToLeaderboard(name);
    els.overNameRow.classList.add('hidden');
    toast('Score saved to leaderboard!');
  });
  // pressing Enter in the name box saves too (the game key handler skips inputs)
  els.overName.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btn-save-score').click();
  });

  /* physical keyboard */
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    const overOpen = !document.getElementById('modal-over').classList.contains('hidden');
    if (overOpen && e.key === 'Enter') return;
    if (!document.querySelector('.modal-back:not(.hidden)')) {
      if (/^[a-zA-Z]$/.test(e.key)) typeLetter(e.key.toLowerCase());
      else if (e.key === 'Enter') {
        // prevent Enter from also "clicking" a still-focused button
        // (e.g. the Random tab), which would restart the game
        e.preventDefault();
        doSubmit();
      }
      else if (e.key === 'Backspace') backspace();
    } else if (e.key === 'Escape') closeModals();
  });

  buildKeyboard();
  startGame('daily');

  /* first-visit help — after startGame, which closes all modals */
  if (!store.get('seenHelp', false)) {
    openModal('modal-help');
    store.set('seenHelp', true);
  }
}

if (typeof document !== 'undefined') {
  initUI();
}
