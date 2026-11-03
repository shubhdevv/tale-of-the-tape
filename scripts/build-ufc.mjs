// Builds public/ufc.json for the UFC higher-or-lower game.
//
// Stats:  UFCStats.com data via the public scrape_ufc_stats dataset
//         https://github.com/Greco1899/scrape_ufc_stats (refreshed regularly)
// Photos: freely-licensed lead images from Wikipedia / Wikimedia Commons
//
// Usage:  npm run build:ufc            (uses cached downloads in data/ufc-cache)
//         npm run build:ufc -- --refresh   (re-download everything)

import fs from 'node:fs';
import path from 'node:path';

const CACHE = path.resolve('data', 'ufc-cache');
const OUT = path.resolve('public', 'ufc.json');
const SRC = 'https://raw.githubusercontent.com/Greco1899/scrape_ufc_stats/main/';
const UA = 'TaleOfTheTape/1.0 (personal UFC trivia game; Node.js fetch)';
const MIN_FIGHTS = 5; // fighters need at least this many UFC fights to be in the game
const KEEP_WITHOUT_PHOTO = 12; // ...and a photo, unless they have this many fights
const REFRESH = process.argv.includes('--refresh');

fs.mkdirSync(CACHE, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log('[ufc]', ...a);

// ---------------------------------------------------------------- download + parse

async function source(name) {
  const file = path.join(CACHE, name);
  if (!REFRESH && fs.existsSync(file)) return fs.readFileSync(file, 'utf8');
  log('downloading', name);
  const res = await fetch(SRC + name, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(180_000) });
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  const text = await res.text();
  fs.writeFileSync(file, text);
  return text;
}

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows;
  return body.filter((r) => r.length === header.length).map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), r[i].trim()])));
}

const ofPair = (s) => { const m = /(\d+)\s+of\s+(\d+)/.exec(s || ''); return m ? [+m[1], +m[2]] : [0, 0]; };
const mmss = (s) => { const m = /^(\d+):(\d+)$/.exec(s || ''); return m ? +m[1] * 60 + +m[2] : 0; };
const inches = (s) => {
  const ft = /(\d+)'\s*(\d+)?/.exec(s || '');
  if (ft) return +ft[1] * 12 + (+ft[2] || 0);
  const inch = /^([\d.]+)"/.exec(s || '');
  return inch ? Math.round(+inch[1]) : null;
};
const isoDate = (s) => { const t = Date.parse(s); return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : null; };
const r1 = (x) => Math.round(x * 10) / 10;
const r2 = (x) => Math.round(x * 100) / 100;

function fightSeconds(round, time, format) {
  const lengths = /\(([\d-]+)\)/.exec(format || '')?.[1]?.split('-').map(Number) ?? [];
  let secs = mmss(time);
  for (let i = 0; i < round - 1; i++) secs += (lengths[i] ?? 5) * 60;
  return secs;
}

function division(weightclass) {
  return weightclass
    .replace(/^UFC\s+/, '')
    .replace(/Interim\s+/, '')
    .replace(/\s*(Title\s+)?Bout$/, '')
    .replace(/Tournament.*$/, '')
    .replace(/^Ultimate Fighter.*$/, '')
    .replace(/^TUF.*$/, '')
    .trim();
}

// ---------------------------------------------------------------- build stats

async function buildFighters() {
  const [events, results, stats, details, tott] = await Promise.all(
    ['ufc_event_details.csv', 'ufc_fight_results.csv', 'ufc_fight_stats.csv', 'ufc_fighter_details.csv', 'ufc_fighter_tott.csv'].map(
      async (f) => parseCsv(await source(f)),
    ),
  );

  const eventDate = new Map(events.map((e) => [e.EVENT, isoDate(e.DATE)]));

  // Fighter identity. Names are the join key across files, so drop ambiguous duplicates.
  const nameCount = {};
  for (const t of tott) nameCount[t.FIGHTER] = (nameCount[t.FIGHTER] || 0) + 1;
  const nickByUrl = new Map(details.map((d) => [d.URL, d.NICKNAME]));
  const fighters = new Map();
  for (const t of tott) {
    if (nameCount[t.FIGHTER] !== 1) continue;
    fighters.set(t.FIGHTER, {
      name: t.FIGHTER,
      id: t.URL.split('/').pop(),
      nick: nickByUrl.get(t.URL) || '',
      height: inches(t.HEIGHT),
      reach: inches(t.REACH),
      stance: t.STANCE || '',
      dob: isoDate(t.DOB),
      fights: [],
    });
  }

  // Per-bout aggregated stats (summing rounds), keyed by event|bout|fighter.
  const boutStats = new Map();
  for (const s of stats) {
    if (!/^Round/.test(s.ROUND)) continue;
    const key = `${s.EVENT}|${s.BOUT}|${s.FIGHTER}`;
    let a = boutStats.get(key);
    if (!a) boutStats.set(key, (a = { kd: 0, sig: [0, 0], tot: [0, 0], td: [0, 0], sub: 0, rev: 0, ctrl: 0, head: 0, body: 0, leg: 0, ground: 0 }));
    const add = (k, col) => { const [l, t] = ofPair(s[col]); a[k][0] += l; a[k][1] += t; };
    a.kd += +s.KD || 0;
    add('sig', 'SIG.STR.'); add('tot', 'TOTAL STR.'); add('td', 'TD');
    a.sub += +s['SUB.ATT'] || 0;
    a.rev += +s['REV.'] || 0;
    a.ctrl += mmss(s.CTRL);
    a.head += ofPair(s.HEAD)[0]; a.body += ofPair(s.BODY)[0]; a.leg += ofPair(s.LEG)[0]; a.ground += ofPair(s.GROUND)[0];
  }

  for (const r of results) {
    const [a, b] = r.BOUT.split(/\s+vs\.\s+/).map((x) => x.trim());
    const [oa, ob] = r.OUTCOME.split('/');
    if (!a || !b || !oa) continue;
    const event = r.EVENT.trim();
    const base = {
      date: eventDate.get(event),
      method: r.METHOD,
      round: +r.ROUND || 1,
      secs: fightSeconds(+r.ROUND || 1, r.TIME, r['TIME FORMAT']),
      title: /^UFC .*Title Bout$/.test(r.WEIGHTCLASS) && !/Tournament/.test(r.WEIGHTCLASS),
      division: division(r.WEIGHTCLASS),
    };
    for (const [me, opp, res] of [[a, b, oa], [b, a, ob]]) {
      const f = fighters.get(me);
      if (!f) continue;
      f.fights.push({
        ...base,
        res,
        mine: boutStats.get(`${event}|${r.BOUT}|${me}`),
        theirs: boutStats.get(`${event}|${r.BOUT}|${opp}`),
      });
    }
  }

  const out = [];
  for (const f of fighters.values()) {
    if (f.fights.length < MIN_FIGHTS) continue;
    f.fights.sort((x, y) => (x.date ?? '').localeCompare(y.date ?? ''));
    const F = f.fights;
    const won = (pred) => F.filter((x) => x.res === 'W' && pred(x)).length;
    const lost = (pred) => F.filter((x) => x.res === 'L' && pred(x)).length;
    const isKO = (x) => /^(KO\/TKO|TKO)/.test(x.method);
    const isSub = (x) => x.method === 'Submission';
    const isDec = (x) => /^Decision/.test(x.method);

    const wins = won(() => true), losses = lost(() => true), draws = F.filter((x) => x.res === 'D').length;
    const ko = won(isKO), sub = won(isSub);

    let streak = 0, best = 0;
    for (const x of F) {
      if (x.res === 'W') best = Math.max(best, ++streak);
      else if (x.res !== 'NC') streak = 0;
    }

    const s = {
      fights: F.length,
      wins, losses,
      winPct: wins + losses + draws ? r1((wins / (wins + losses + draws)) * 100) : null,
      koWins: ko, subWins: sub, decWins: won(isDec),
      finishes: ko + sub,
      finishRate: wins >= 5 ? r1(((ko + sub) / wins) * 100) : null,
      timesFinished: lost(isKO) + lost(isSub),
      titleFights: F.filter((x) => x.title).length,
      titleWins: won((x) => x.title),
      r1Finishes: won((x) => x.round === 1 && (isKO(x) || isSub(x))),
      winStreak: best,
      octagonMin: r1(F.reduce((t, x) => t + x.secs, 0) / 60),
      height: f.height,
      reach: f.reach,
    };
    const first = F[0].date, last = F.at(-1).date;
    if (first && last) s.span = r1((Date.parse(last) - Date.parse(first)) / (365.25 * 864e5));

    // striking / grappling, only from bouts that have round-by-round stats
    const withStats = F.filter((x) => x.mine && x.theirs);
    const secs = withStats.reduce((t, x) => t + x.secs, 0);
    const mins = secs / 60;
    const sum = (fn) => withStats.reduce((t, x) => t + fn(x), 0);
    if (withStats.length >= 3) {
      const sigL = sum((x) => x.mine.sig[0]), sigA = sum((x) => x.mine.sig[1]);
      const oSigL = sum((x) => x.theirs.sig[0]), oSigA = sum((x) => x.theirs.sig[1]);
      const tdL = sum((x) => x.mine.td[0]), tdA = sum((x) => x.mine.td[1]);
      const oTdL = sum((x) => x.theirs.td[0]), oTdA = sum((x) => x.theirs.td[1]);
      const subAtt = sum((x) => x.mine.sub), ctrl = sum((x) => x.mine.ctrl);
      Object.assign(s, {
        sig: sigL,
        totStr: sum((x) => x.mine.tot[0]),
        kd: sum((x) => x.mine.kd),
        head: sum((x) => x.mine.head),
        body: sum((x) => x.mine.body),
        leg: sum((x) => x.mine.leg),
        gnp: sum((x) => x.mine.ground),
        td: tdL,
        subAtt,
        rev: sum((x) => x.mine.rev),
        ctrl: r1(ctrl / 60),
      });
      if (mins >= 30) {
        Object.assign(s, {
          slpm: r2(sigL / mins),
          sapm: r2(oSigL / mins),
          tdAvg: r2(tdL / (mins / 15)),
          subAvg: r2(subAtt / (mins / 15)),
          ctrlPct: r1((ctrl / secs) * 100),
        });
        if (sigA >= 100) s.sigAcc = r1((sigL / sigA) * 100);
        if (oSigA >= 100) s.strDef = r1((1 - oSigL / oSigA) * 100);
        if (tdA >= 10) s.tdAcc = r1((tdL / tdA) * 100);
        if (oTdA >= 10) s.tdDef = r1((1 - oTdL / oTdA) * 100);
      }
    }
    for (const k of Object.keys(s)) if (s[k] == null || Number.isNaN(s[k])) delete s[k];

    const lastDiv = [...F].reverse().find((x) => x.division && !/Catch|Open/.test(x.division))?.division ?? '';
    out.push({
      id: f.id,
      n: f.name,
      nick: f.nick,
      div: lastDiv,
      dob: f.dob,
      stance: f.stance,
      rec: `${wins}-${losses}${draws ? '-' + draws : ''}`,
      last: last ? last.slice(0, 4) : null,
      s,
    });
  }
  return out;
}

// ---------------------------------------------------------------- photos (Wikipedia)

const FIGHTER_DESC = /mixed martial|martial art|fighter|wrestler|kickbox|boxer|judoka|jiu.?jitsu|grappler|muay thai|karate|taekwondo|sambo/i;

async function wikiLookup(titles) {
  const url =
    'https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1' +
    '&prop=pageimages|description&piprop=thumbnail|name&pithumbsize=640&pilicense=free&titles=' +
    encodeURIComponent(titles.join('|'));
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(30_000) });
      if (res.status === 429 && attempt < 4) { await sleep(5000 * (attempt + 1)); continue; }
      const j = await res.json();
      const q = j.query ?? {};
      const hop = (list) => new Map((list ?? []).map((x) => [x.from, x.to]));
      const norm = hop(q.normalized), redir = hop(q.redirects);
      const pages = new Map((q.pages ?? []).map((p) => [p.title, p]));
      return new Map(titles.map((t) => {
        let k = norm.get(t) ?? t;
        k = redir.get(k) ?? k;
        return [t, pages.get(k)];
      }));
    } catch (err) {
      if (attempt >= 4) throw err;
      await sleep(3000);
    }
  }
}

async function addPhotos(list) {
  const cacheFile = path.join(CACHE, 'wiki.json');
  const cache = !REFRESH && fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, 'utf8')) : {};
  let todo = list.map((f) => f.n).filter((n) => !(n in cache));
  log(`photos: ${list.length - todo.length} cached, looking up ${todo.length} on Wikipedia`);

  for (const suffix of ['', ' (fighter)', ' (mixed martial artist)', ' (wrestler)', ' (kickboxer)', ' (boxer)']) {
    const still = [];
    for (let i = 0; i < todo.length; i += 50) {
      const chunk = todo.slice(i, i + 50);
      const found = await wikiLookup(chunk.map((n) => n + suffix));
      for (const n of chunk) {
        const p = found.get(n + suffix);
        if (p && !p.missing && FIGHTER_DESC.test(p.description ?? '')) {
          cache[n] = { title: p.title, img: p.thumbnail?.source ?? null, file: p.pageimage ?? null };
        } else still.push(n);
      }
      await sleep(250);
    }
    log(`  "${suffix || 'exact'}": matched ${todo.length - still.length}`);
    todo = still;
    if (!todo.length) break;
  }
  for (const n of todo) cache[n] = null;
  fs.writeFileSync(cacheFile, JSON.stringify(cache));

  for (const f of list) {
    const w = cache[f.n];
    if (w?.img) { f.img = w.img; f.file = w.file; }
    if (w?.title) f.wiki = w.title;
  }
}

// ---------------------------------------------------------------- main

const fighters = await buildFighters();
log(`${fighters.length} fighters with ${MIN_FIGHTS}+ UFC fights`);
await addPhotos(fighters);

const pool = fighters.filter((f) => f.img || f.s.fights >= KEEP_WITHOUT_PHOTO);
// rough fame score so early rounds feature recognisable names
for (const f of pool) f.fame = f.s.fights + f.s.titleFights * 4 + f.s.titleWins * 4 + (f.img ? 6 : 0) + (f.wiki ? 4 : 0);
pool.sort((a, b) => b.fame - a.fame);

fs.writeFileSync(
  OUT,
  JSON.stringify({ updated: new Date().toISOString().slice(0, 10), source: 'UFCStats.com via github.com/Greco1899/scrape_ufc_stats', fighters: pool }),
);
const withImg = pool.filter((f) => f.img).length;
log(`wrote ${path.relative(process.cwd(), OUT)}: ${pool.length} fighters (${withImg} with photos), ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`);
