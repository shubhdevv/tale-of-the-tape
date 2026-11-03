// Tale of the Tape — UFC higher or lower.
(() => {
  const $ = (sel) => document.querySelector(sel);
  const stage = $('#ufcStage'), track = $('#ufcTrack'), vs = $('#ufcVs'), overlay = $('#ufcOverlay');
  const scoreEl = $('#ufcScore'), bestEl = $('#ufcBest'), catEl = $('#ufcCat');
  if (!stage) return;

  // ---------------------------------------------------------------- categories
  const GROUPS = { rec: ['🏆', 'Record'], str: ['🥊', 'Striking'], gr: ['🤼', 'Grappling'], phy: ['📏', 'Physical'] };
  // k: stat key · l: label · f: format · hi/lo: button words (defaults depend on format)
  const CATS = [
    { k: 'wins', g: 'rec', l: 'UFC wins' },
    { k: 'losses', g: 'rec', l: 'UFC losses' },
    { k: 'fights', g: 'rec', l: 'UFC fights' },
    { k: 'winPct', g: 'rec', l: 'UFC win rate', f: 'pct' },
    { k: 'koWins', g: 'rec', l: 'KO/TKO wins' },
    { k: 'subWins', g: 'rec', l: 'submission wins' },
    { k: 'decWins', g: 'rec', l: 'decision wins' },
    { k: 'finishes', g: 'rec', l: 'finishes' },
    { k: 'finishRate', g: 'rec', l: 'finish rate', f: 'pct' },
    { k: 'timesFinished', g: 'rec', l: 'times finished' },
    { k: 'titleFights', g: 'rec', l: 'UFC title fights' },
    { k: 'titleWins', g: 'rec', l: 'UFC title fight wins' },
    { k: 'r1Finishes', g: 'rec', l: 'first-round finishes' },
    { k: 'winStreak', g: 'rec', l: 'longest UFC win streak', hi: 'Longer', lo: 'Shorter', unit: 'fights' },
    { k: 'octagonMin', g: 'rec', l: 'time in the Octagon', f: 'dur' },
    { k: 'span', g: 'rec', l: 'years between first and last UFC fight', short: 'UFC career length', f: 'yrs', hi: 'Longer', lo: 'Shorter' },
    { k: 'sig', g: 'str', l: 'significant strikes landed' },
    { k: 'slpm', g: 'str', l: 'sig. strikes landed per minute', f: 'dec' },
    { k: 'sigAcc', g: 'str', l: 'striking accuracy', f: 'pct' },
    { k: 'sapm', g: 'str', l: 'sig. strikes absorbed per minute', f: 'dec' },
    { k: 'strDef', g: 'str', l: 'striking defense', f: 'pct' },
    { k: 'kd', g: 'str', l: 'knockdowns' },
    { k: 'head', g: 'str', l: 'head strikes landed' },
    { k: 'body', g: 'str', l: 'body strikes landed' },
    { k: 'leg', g: 'str', l: 'leg strikes landed' },
    { k: 'totStr', g: 'str', l: 'total strikes landed' },
    { k: 'gnp', g: 'gr', l: 'ground strikes landed' },
    { k: 'td', g: 'gr', l: 'takedowns landed' },
    { k: 'tdAvg', g: 'gr', l: 'takedowns per 15 min', f: 'dec' },
    { k: 'tdAcc', g: 'gr', l: 'takedown accuracy', f: 'pct' },
    { k: 'tdDef', g: 'gr', l: 'takedown defense', f: 'pct' },
    { k: 'subAtt', g: 'gr', l: 'submission attempts' },
    { k: 'subAvg', g: 'gr', l: 'sub attempts per 15 min', f: 'dec' },
    { k: 'ctrl', g: 'gr', l: 'control time', f: 'dur' },
    { k: 'ctrlPct', g: 'gr', l: 'of fight time in control', short: 'control share', f: 'pct' },
    { k: 'rev', g: 'gr', l: 'reversals' },
    { k: 'height', g: 'phy', l: 'tall', short: 'height', f: 'height', hi: 'Taller', lo: 'Shorter', than: '' },
    { k: 'reach', g: 'phy', l: 'reach', f: 'reach', hi: 'Longer', lo: 'Shorter', than: 'reach' },
    { k: 'age', g: 'phy', l: 'years old', short: 'age', f: 'age', hi: 'Older', lo: 'Younger', than: '' },
  ];
  for (const c of CATS) {
    const rate = ['pct', 'dec'].includes(c.f);
    c.hi ??= c.f === 'dur' ? 'More' : rate ? 'Higher' : 'More';
    c.lo ??= c.f === 'dur' ? 'Less' : rate ? 'Lower' : 'Fewer';
    c.than ??= c.l;
    c.short ??= c.l;
  }

  // ---------------------------------------------------------------- helpers
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const rand = (n) => Math.floor(Math.random() * n);
  const YEAR = 365.25 * 864e5;
  const val = (f, c) => (c.k === 'age' ? (f.dob ? Math.floor((Date.now() - Date.parse(f.dob)) / YEAR) : null) : f.s[c.k] ?? null);
  const lastName = (n) => n.split(' ').slice(1).join(' ') || n;
  const initials = (n) => n.split(/\s+/).map((w) => w[0]).slice(0, 2).join('');
  const hue = (s) => [...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 7);
  const capital = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  function fmt(c, v) {
    switch (c.f) {
      case 'pct': return `${Math.round(v * 10) / 10}%`;
      case 'dec': return v.toFixed(2);
      case 'yrs': return `${v.toFixed(1)} yrs`;
      case 'dur': { const m = Math.round(v); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`; }
      case 'height': { const r = Math.round(v); return `${Math.floor(r / 12)}′${r % 12}″`; }
      case 'reach': return `${Math.round(v)}″`;
      case 'age': return String(Math.round(v));
      default: return Math.round(v).toLocaleString('en-US');
    }
  }
  const knownLabel = (c) => (c.f === 'yrs' ? c.short : c.l);
  const guessLabel = (c, other) => `${c.than ? c.than + ' ' : ''}than ${lastName(other.n)}`;

  // ---------------------------------------------------------------- state
  let pool = [], spread = {}, meta = null;
  let left, right, cat, score = 0, playing = false, busy = false;
  let best = Number(localStorage.getItem('ufc-best')) || 0;
  let recentCats = [], recentIds = [];
  bestEl.textContent = best;

  // Difficulty ramps up: early rounds use famous fighters and obvious gaps.
  function tier(s) {
    if (s < 4) return { top: 120, gap: 0.45 };
    if (s < 8) return { top: 260, gap: 0.28 };
    if (s < 14) return { top: 450, gap: 0.14 };
    if (s < 22) return { top: Infinity, gap: 0.06 };
    return { top: Infinity, gap: 0 };
  }

  function pickRound(L) {
    const t = tier(score);
    for (let attempt = 0; attempt < 1500; attempt++) {
      const relax = attempt > 900;
      const c = CATS[rand(CATS.length)];
      if (!relax && recentCats.includes(c.k)) continue;
      const a = val(L, c);
      if (a == null) continue;
      const R = pool[rand(relax ? pool.length : Math.min(pool.length, t.top))];
      if (R === L || (!relax && recentIds.includes(R.id))) continue;
      const b = val(R, c);
      if (b == null || fmt(c, a) === fmt(c, b)) continue; // no ties (as displayed)
      if (!relax && Math.abs(a - b) / spread[c.k] < t.gap) continue;
      recentCats = [...recentCats, c.k].slice(-8);
      recentIds = [...recentIds, R.id].slice(-40);
      return { cat: c, right: R };
    }
    throw new Error('could not find a matchup');
  }

  // ---------------------------------------------------------------- rendering
  function nameHtml(n) {
    const [first, ...rest] = n.split(' ');
    return rest.length ? `<span class="first">${esc(first)}</span> ${esc(rest.join(' '))}` : esc(n);
  }

  function paneEl(f) {
    const el = document.createElement('div');
    el.className = 'pane';
    const champ = f.s.titleWins > 0;
    el.innerHTML = `
      ${f.img ? `<img src="${esc(f.img)}" alt="${esc(f.n)}" draggable="false">` : fallbackHtml(f)}
      <div class="pane-shade"></div>
      ${f.file ? `<a class="pane-credit" href="https://commons.wikimedia.org/wiki/File:${encodeURIComponent(f.file)}" target="_blank" rel="noopener" title="Photo: Wikimedia Commons (view author &amp; license)" aria-label="Photo credit">i</a>` : ''}
      <div class="pane-body">
        <div class="tags">${f.div ? `<span>${esc(f.div)}</span>` : ''}${champ ? '<span class="gold">UFC champion</span>' : ''}</div>
        ${f.nick ? `<div class="nick">“${esc(f.nick)}”</div>` : ''}
        <div class="name">${nameHtml(f.n)}</div>
        <div class="rec">UFC record ${esc(f.rec)}${f.last ? ` · last fought ${esc(f.last)}` : ''}</div>
        <div class="stat"></div>
      </div>`;
    const img = el.querySelector('img');
    if (img) img.onerror = () => { img.insertAdjacentHTML('afterend', fallbackHtml(f)); img.remove(); };
    return el;
  }
  const fallbackHtml = (f) => `<div class="pane-fallback" style="--h:${hue(f.n)}"><span>${esc(initials(f.n))}</span></div>`;

  function setKnown(pane, f, c) {
    const st = pane.querySelector('.stat');
    st.classList.remove('fade'); void st.offsetWidth; st.classList.add('fade');
    st.innerHTML = `<div class="val">${fmt(c, val(f, c))}</div><div class="lbl">${esc(knownLabel(c))}</div>`;
  }

  function setGuess(pane, f, c, other) {
    const st = pane.querySelector('.stat');
    st.innerHTML = `
      <div class="btns">
        <button type="button" data-g="hi">${esc(c.hi)} <span>▲</span></button>
        <button type="button" data-g="lo">${esc(c.lo)} <span>▼</span></button>
      </div>
      <div class="lbl">${esc(guessLabel(c, other))}</div>`;
    st.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => guess(b.dataset.g)));
  }

  function reveal(pane, from, to, c, cls) {
    const st = pane.querySelector('.stat');
    st.innerHTML = `<div class="val ${cls}">${fmt(c, from)}</div><div class="lbl">${esc(knownLabel(c))}</div>`;
    const el = st.querySelector('.val');
    const start = performance.now(), dur = 850;
    const step = (t) => {
      const k = Math.min(1, (t - start) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(c, k < 1 ? from + (to - from) * e : to);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function setCategory(c) {
    catEl.classList.add('swap');
    setTimeout(() => {
      catEl.innerHTML = `<span>${GROUPS[c.g][0]}</span><span class="grp">${GROUPS[c.g][1]} ·</span><span>${esc(capital(c.short))}</span>`;
      catEl.classList.remove('swap');
    }, 150);
  }
  function resetVs() { vs.className = 'ufc-vs'; vs.textContent = 'VS'; }
  function setScore(n, pop) {
    score = n;
    scoreEl.textContent = n;
    if (pop) { scoreEl.classList.remove('pop'); void scoreEl.offsetWidth; scoreEl.classList.add('pop'); }
  }
  const preload = (src) => new Promise((res) => {
    if (!src) return res();
    const i = new Image();
    i.onload = i.onerror = res;
    i.src = src;
    setTimeout(res, 2200); // don't stall the game on a slow image
  });

  // ---------------------------------------------------------------- game flow
  function start() {
    setScore(0);
    recentCats = []; recentIds = [];
    left = pool[rand(Math.min(60, pool.length))];
    recentIds.push(left.id);
    ({ cat, right } = pickRound(left));
    track.classList.remove('slide');
    track.innerHTML = '';
    const lp = paneEl(left), rp = paneEl(right);
    track.append(lp, rp);
    setKnown(lp, left, cat);
    setGuess(rp, right, cat, left);
    setCategory(cat);
    resetVs();
    overlay.classList.add('hidden');
    playing = true; busy = false;
    setTimeout(() => rp.querySelector('button')?.focus({ preventScroll: true }), 350);
  }

  function guess(dir) {
    if (!playing || busy) return;
    busy = true;
    const a = val(left, cat), b = val(right, cat);
    const correct = dir === 'hi' ? b > a : b < a;
    reveal(track.children[1], a, b, cat, correct ? 'ok' : 'no');
    setTimeout(() => {
      vs.className = 'ufc-vs ' + (correct ? 'ok' : 'no');
      vs.textContent = correct ? '✓' : '✕';
      if (correct) setScore(score + 1, true);
    }, 850);
    if (!correct) return void setTimeout(() => gameOver(a, b), 1900);

    // pick the next matchup now and load its photo while the reveal animates
    let next;
    try { score++; next = pickRound(right); } catch { next = null; } finally { score--; }
    const ready = Promise.all([new Promise((r) => setTimeout(r, 1450)), preload(next?.right.img)]);
    ready.then(() => (next ? advance(next) : gameOver(null, null, true)));
  }

  function advance(next) {
    left = right;
    ({ cat, right } = next);
    const pane = paneEl(right);
    setGuess(pane, right, cat, left);
    track.appendChild(pane);

    // the outgoing right pane becomes the new left: show its value for the new category
    setKnown(track.children[1], left, cat);
    setCategory(cat);
    resetVs();
    track.classList.add('slide');
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      track.classList.remove('slide');
      track.firstElementChild.remove();
      busy = false;
      track.children[1]?.querySelector('button')?.focus({ preventScroll: true });
    };
    track.addEventListener('transitionend', (e) => e.target === track && finish(), { once: true });
    setTimeout(finish, 1000);
  }

  function rank(s) {
    if (s >= 25) return 'G.O.A.T.';
    if (s >= 15) return 'Undisputed champion';
    if (s >= 10) return 'Title challenger';
    if (s >= 6) return 'Ranked contender';
    if (s >= 3) return 'Main card';
    return 'Prelims';
  }

  function shareUrl() {
    const local = /^(localhost|127\.|\[::1\]|192\.168\.|10\.)/.test(location.hostname);
    const text = `🥊 I scored ${score} on Tale of the Tape, the UFC higher-or-lower game (${rank(score)}).\n\nThink you know your fighters better?`;
    const params = new URLSearchParams({ text });
    if (!local) params.set('url', location.origin + location.pathname);
    return 'https://x.com/intent/post?' + params;
  }

  function gameOver(a, b, ranOut = false) {
    playing = false;
    const newBest = score > best;
    if (newBest) { best = score; localStorage.setItem('ufc-best', best); bestEl.textContent = best; }
    const cmp = a == null ? '' : `
      <div class="ov-cmp">
        <div><span>${esc(left.n)}</span><b>${fmt(cat, a)}</b></div>
        <div class="mid">${esc(cat.short)}</div>
        <div><span>${esc(right.n)}</span><b class="miss">${fmt(cat, b)}</b></div>
      </div>`;
    overlay.innerHTML = `
      <div class="ov">
        <div class="ov-kicker ${newBest ? 'gold' : ''}">${ranOut ? 'You ran the table' : newBest ? 'New personal best' : 'Fight over'}</div>
        <div class="ov-score">${score}</div>
        <div class="ov-rank">${rank(score)}</div>
        ${cmp || '<div style="height:24px"></div>'}
        <div class="ov-btns">
          <button class="btn-red" id="ufcAgain" type="button">Run it back</button>
          <a class="btn-x" href="${esc(shareUrl())}" target="_blank" rel="noopener">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            Share score
          </a>
        </div>
        <div class="ov-foot">Best: ${best}</div>
      </div>`;
    overlay.classList.remove('hidden');
    $('#ufcAgain').addEventListener('click', start);
    $('#ufcAgain').focus({ preventScroll: true });
  }

  function showStart() {
    overlay.innerHTML = `
      <div class="ov">
        <div class="ov-kicker">UFC higher or lower</div>
        <div class="ov-title">Tale of the Tape</div>
        <p>Is the fighter on the right higher or lower than the one on the left? One wrong call and you're out.</p>
        <div class="ov-chips">
          <span>${pool.length || '700'}+ fighters</span><span>${CATS.length} stats</span><span>Record · Striking · Grappling · Physical</span>
        </div>
        <button class="btn-red" id="ufcStart" type="button" ${pool.length ? '' : 'disabled'}>${pool.length ? 'Start fight' : 'Loading fighters…'}</button>
        <div class="ov-foot">Use <kbd>↑</kbd> <kbd>↓</kbd> keys to play</div>
      </div>`;
    $('#ufcStart').addEventListener('click', start);
  }

  // keyboard: ↑ higher, ↓ lower, Enter to (re)start, only while the game is on screen
  document.addEventListener('keydown', (e) => {
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) return;
    const r = stage.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return;
    if (playing && !busy && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      guess(e.key === 'ArrowUp' ? 'hi' : 'lo');
    }
  });

  // ---------------------------------------------------------------- boot
  showStart();
  fetch('ufc.json')
    .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then((d) => {
      meta = d;
      pool = d.fighters;
      // spread (p10–p90) per stat, so "gap" means the same thing across categories
      for (const c of CATS) {
        const vals = pool.map((f) => val(f, c)).filter((v) => v != null).sort((x, y) => x - y);
        const p = (q) => vals[Math.floor(q * (vals.length - 1))];
        spread[c.k] = Math.max(p(0.9) - p(0.1), 1e-6);
      }
      // backdrop behind the start screen
      const a = pool[0], b = pool[1];
      track.innerHTML = '';
      track.append(paneEl(a), paneEl(b));
      const creditDate = new Date(d.updated + 'T00:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });
      $('#ufcCredits').innerHTML =
        `Stats from <a href="http://ufcstats.com" target="_blank" rel="noopener">UFCStats.com</a> via ` +
        `<a href="https://github.com/Greco1899/scrape_ufc_stats" target="_blank" rel="noopener">scrape_ufc_stats</a>, UFC fights only, updated ${creditDate}. ` +
        `Photos from Wikimedia Commons (tap <b>i</b> on a photo for its license). Not affiliated with the UFC.`;
      showStart();
    })
    .catch((err) => {
      overlay.innerHTML = `<div class="ov"><div class="ov-kicker">Couldn't load fighters</div><p>${esc(err.message)}. Run <code>npm run build:ufc</code> and refresh.</p></div>`;
    });
})();
