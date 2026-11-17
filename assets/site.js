/* Year 10 Media Exam Hub — login gate and interactive engine */
(() => {
  'use strict';
  const LS = 'y10hub:';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const store = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem(LS + k)); return v ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch { /* storage unavailable */ } }
  };
  const PAGES = [['hub', 'index.html', 'Hub'], ['s1', 'section-one.html', '1 · Terms'], ['s2', 'section-two.html', '2 · Stimulus'], ['s3', 'section-three.html', '3 · Essay'], ['bank', 'word-bank.html', 'Word Bank']];
  const CATS = { codes: 'Codes & conventions', story: 'Narrative & genre', cam: 'Camera & composition', edit: 'Editing', ls: 'Lighting & sound', aud: 'Audience', rep: 'Representation & values', print: 'Magazines & advertising', ca: 'Current affairs', prod: 'Production' };
  let P, G, byKey = {};

  /* ---------- theme ---------- */
  const setTheme = t => { document.documentElement.dataset.theme = t; store.set('theme', t); document.dispatchEvent(new Event('hub:theme')); };
  document.documentElement.dataset.theme = store.get('theme', 'dark');

  /* ---------- gate ---------- */
  const payloadEl = $('#payload');
  const bytes = b64 => { const s = atob(b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
  const toB64 = u => btoa(String.fromCharCode(...u));
  const keyStore = {
    get() { try { return sessionStorage.getItem(LS + 'k') || localStorage.getItem(LS + 'k'); } catch { return null; } },
    set(v, keep) { try { sessionStorage.setItem(LS + 'k', v); if (keep) localStorage.setItem(LS + 'k', v); } catch { /* ignore */ } },
    clear() { try { sessionStorage.removeItem(LS + 'k'); localStorage.removeItem(LS + 'k'); } catch { /* ignore */ } }
  };
  // The login unlocks a content key (assets/login.js); the content key unlocks this page.
  async function derive(user, pass, salt, iter) {
    const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(user.trim().toLowerCase() + '\n' + pass.trim()), 'PBKDF2', false, ['deriveBits']);
    return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: bytes(salt), iterations: iter, hash: 'SHA-256' }, km, 256));
  }
  async function open(raw, b64) {
    const buf = bytes(b64), key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.subarray(0, 12) }, key, buf.subarray(12)));
  }
  const unlock = async raw => JSON.parse(new TextDecoder().decode(await open(raw, payloadEl.textContent.trim())));
  async function signIn(user, pass) {
    const L = window.HUB_LOGIN;
    for (const l of L.logins) { try { const ck = await open(await derive(user, pass, l.salt, L.iter), l.key); return { ck, page: await unlock(ck) }; } catch { /* try the next login */ } }
    throw new Error('bad login');
  }
  function showGate() {
    const app = $('#app');
    app.innerHTML = `<div class="gate"><form autocomplete="on">
      <div class="bulbs"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
      <div class="kicker" style="color:#f5b83d">Sacred Heart College · Media Production and Analysis</div>
      <h1>Year 10 <em>Exam Hub</em></h1>
      <p style="color:#9aa5b8;margin:0">Tickets, please. Sign in with the class login from Mr Clarke.</p>
      <label for="u">Username</label><input id="u" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" required>
      <label for="p">Password</label><input id="p" type="password" autocomplete="current-password" required>
      <label class="chk" style="margin-top:14px;font-weight:400"><input id="keep" type="checkbox" checked> Keep me signed in on this device</label>
      <button class="btn" type="submit">Roll film ▶</button>
      <p class="err" role="alert"></p></form></div>`;
    const f = $('form', app), err = $('.err', app);
    if (!window.crypto || !crypto.subtle || !window.HUB_LOGIN) { err.textContent = 'This browser cannot open the hub. Try an up-to-date Chrome, Safari, Edge or Firefox.'; return; }
    f.addEventListener('submit', async e => {
      e.preventDefault(); err.textContent = ''; const b = $('button', f); b.disabled = true; b.textContent = 'Loading the projector…';
      try {
        const { ck, page } = await signIn($('#u').value, $('#p').value);
        keyStore.set(toB64(ck), $('#keep').checked); render(page);
      } catch {
        b.disabled = false; b.textContent = 'Roll film ▶'; err.textContent = 'That login didn’t work. Check the spelling: the password is case-sensitive.';
        f.classList.remove('bad'); void f.offsetWidth; f.classList.add('bad');
      }
    });
    $('#u').focus();
  }
  async function boot() {
    const k = keyStore.get();
    if (k && window.crypto && crypto.subtle) { try { render(await unlock(bytes(k))); return; } catch { keyStore.clear(); } }
    showGate();
  }

  /* ---------- page chrome ---------- */
  function render(page) {
    P = page; G = P.G; G.forEach(g => byKey[g.k] = g);
    const id = document.body.dataset.page;
    $('#app').innerHTML = `<header class="top"><div class="wrap">
      <a class="brand" href="index.html"><i></i>Y10 Media · Exam Hub</a>
      <nav aria-label="Main">${PAGES.map(p => `<a href="${p[1]}"${p[0] === id ? ' aria-current="page"' : ''}>${p[2]}</a>`).join('')}</nav>
      <div class="tools"><button class="icon" id="lights" title="Switch between dark and light">House lights</button><button class="icon" id="out">Sign out</button></div>
      </div></header><main id="main">${P.html}</main>
      <footer class="foot"><div class="wrap">Sacred Heart College · Year 10 Media Production and Analysis · Semester Two 2026 · Created by Mr D Clarke.<br>Your ticks, answers and scores are saved in this browser only. Images are used for study and analysis.</div></footer>`;
    $('#lights').onclick = () => setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
    $('#out').onclick = () => { keyStore.clear(); location.reload(); };
    modules();
    $$('[data-c]').forEach(n => { const f = C[n.dataset.c]; if (f) f(n, P.data[n.dataset.src]); });
    terms();
    if (location.hash) { const t = document.getElementById(location.hash.slice(1)); if (t) setTimeout(() => t.scrollIntoView(), 60); }
  }

  const toast = msg => { const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.innerHTML = msg; document.body.append(t); setTimeout(() => t.classList.add('out'), 3600); setTimeout(() => t.remove(), 4200); };

  /* ---------- modules ("scenes") and progress ---------- */
  function modules() {
    const mods = $$('section.mod'); if (!mods.length) return;
    const done = store.get('done', {});
    const nav = document.createElement('div'); nav.className = 'scenes';
    nav.innerHTML = `<div class="wrap"><span class="pct"></span>${mods.map(m => `<a href="#${m.id}" data-for="${m.id}">${esc(m.dataset.mod)}</a>`).join('')}</div>`;
    const first = $('.hero') || mods[0]; first.after(nav); if (first === mods[0]) mods[0].before(nav);
    const paint = () => {
      const n = mods.filter(m => done[m.id]).length; $('.pct', nav).textContent = Math.round(n / mods.length * 100) + '%';
      mods.forEach(m => { $(`[data-for="${m.id}"]`, nav).classList.toggle('done', !!done[m.id]); const b = $('.donebtn', m); b.classList.toggle('on', !!done[m.id]); b.textContent = done[m.id] ? '✓ Scene complete' : 'Mark this scene as done'; });
    };
    mods.forEach((m, i) => {
      const h = document.createElement('div'); h.className = 'slate';
      h.innerHTML = `<span class="scene">SCENE ${String(i + 1).padStart(2, '0')}</span><h2>${esc(m.dataset.mod)}</h2>`; m.prepend(h);
      const f = document.createElement('div'); f.className = 'modfoot';
      f.innerHTML = `<span class="onenote">${m.dataset.onenote ? 'More in OneNote: <b>' + esc(m.dataset.onenote) + '</b>' : ''}</span><button class="btn ghost sm donebtn"></button>`; m.append(f);
      $('.donebtn', f).onclick = () => { done[m.id] = !done[m.id]; store.set('done', done); paint(); if (done[m.id]) toast(mods.every(x => done[x.id]) ? '<b>That’s a wrap!</b> Every scene on this reel is done.' : '<b>Cut! Scene complete.</b> ' + (mods.length - mods.filter(x => done[x.id]).length) + ' to go on this reel.'); };
    });
    paint();
  }

  /* ---------- glossary term pop-ups ---------- */
  function terms() {
    const pop = document.createElement('div'); pop.className = 'pop'; pop.hidden = true; document.body.append(pop);
    document.addEventListener('click', e => {
      const t = e.target.closest('.t-term');
      if (!t) { if (!e.target.closest('.pop')) pop.hidden = true; return; }
      const g = byKey[t.dataset.t]; if (!g) return;
      pop.innerHTML = `<b>${esc(g.t)}</b>${g.d}<br><a href="word-bank.html#${g.k}">Open in the Word Bank →</a>`; pop.hidden = false;
      const r = t.getBoundingClientRect(), w = Math.min(320, innerWidth - 24);
      pop.style.width = w + 'px'; pop.style.left = Math.max(12, Math.min(r.left + scrollX, scrollX + innerWidth - w - 12)) + 'px'; pop.style.top = r.bottom + scrollY + 8 + 'px';
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') pop.hidden = true; });
  }
  const termBtn = (k, label) => byKey[k] ? `<button class="t-term" data-t="${k}">${esc(label || byKey[k].t)}</button>` : esc(label || k);

  /* ---------- components ---------- */
  const C = {};

  C.count = root => {
    const end = new Date(P.cfg.exam).getTime();
    const tick = () => {
      let s = Math.floor((end - Date.now()) / 1000);
      if (s <= 0) { root.innerHTML = '<p class="score">It’s showtime. Good luck!</p>'; return; }
      const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
      root.innerHTML = `<div class="count" role="timer" aria-label="${d} days ${h} hours until the exam"><div><b>${d}</b><span>days</span></div><div><b>${h}</b><span>hours</span></div><div><b>${m}</b><span>mins</span></div></div><p class="small muted">${esc(P.cfg.examLabel)}</p>`;
    };
    tick(); setInterval(tick, 30000);
  };

  C.tickets = (root, list) => {
    const done = store.get('done', {});
    root.className = 'tickets';
    root.innerHTML = list.map(t => {
      const mods = P.M[t.id] || [], n = mods.filter(m => done[m.id]).length, pct = mods.length ? Math.round(n / mods.length * 100) : 0;
      return `<a class="ticket" href="${t.href}" style="--c:var(--${t.c})"><span class="reel">${t.reel}</span><h3>${t.t}</h3><span class="meta">${t.meta}</span>
        <span class="stub">${mods.length ? `<span class="ring" style="--p:${pct}"><b>${pct}%</b></span><span class="small muted">${n} of ${mods.length} scenes done</span>` : `<span class="small muted">${t.stub || ''}</span>`}<span class="go">Enter →</span></span></a>`;
    }).join('');
  };

  C.plan = (root, list) => {
    const st = store.get('plan', {});
    root.innerHTML = `<ul class="plan">${list.map((p, i) => `<li class="${st[i] ? 'on' : ''}"><input type="checkbox" data-i="${i}" ${st[i] ? 'checked' : ''} aria-label="Done: ${esc(p.t)}"><div><span class="pt">${p.t}</span> <span class="tag">${p.m} min</span><br><span class="small muted">${p.d}</span> <a class="small" href="${p.href}">Go →</a></div></li>`).join('')}</ul>`;
    root.addEventListener('change', e => { const i = e.target.dataset.i; if (i === undefined) return; st[i] = e.target.checked; store.set('plan', st); e.target.closest('li').classList.toggle('on', st[i]); });
  };

  C.flash = root => {
    const known = store.get('known', {}); let deck = [], i = 0;
    root.innerHTML = `<div class="bar"><label>Topic <select class="sel"><option value="">All topics</option>${Object.entries(CATS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
      <label class="chk"><input type="checkbox" class="only"> Only cards I’m still learning</label><button class="btn ghost sm shuf">Shuffle</button><span class="push small muted cnt"></span></div>
      <button class="card3d" aria-label="Flashcard. Press to flip."><span class="in"><span class="face front"></span><span class="face back"></span></span></button>
      <div class="bar center"><button class="btn ghost prev">← Back</button><button class="btn warn again">Still learning</button><button class="btn ok got">Got it ✓</button><button class="btn ghost next">Skip →</button></div>
      <p class="small muted center">Say the definition out loud before you flip. Click the card or press Space to flip it.</p>`;
    const card = $('.card3d', root), sel = $('.sel', root), only = $('.only', root);
    const build = () => { deck = G.filter(g => (!sel.value || g.c === sel.value) && (!only.checked || !known[g.k])); i = 0; show(); };
    const show = () => {
      card.classList.remove('flip'); const g = deck[i];
      const k = G.filter(x => known[x.k]).length;
      $('.cnt', root).textContent = deck.length ? `Card ${i + 1} of ${deck.length} · ${k} of ${G.length} terms marked “got it”` : '';
      if (!g) { $('.front', root).innerHTML = '<b>All done!</b><span class="eg">No cards left in this pile. Untick the box or change topic.</span>'; $('.back', root).innerHTML = ''; return; }
      $('.front', root).innerHTML = `<span class="tag a">${CATS[g.c]}</span><b>${esc(g.t)}</b>${known[g.k] ? '<span class="tag" style="margin-top:10px">✓ got it</span>' : ''}`;
      $('.back', root).innerHTML = `<p>${g.d}</p>${g.e ? `<p class="eg">Example: ${g.e}</p>` : ''}`;
    };
    const step = n => { if (!deck.length) return; i = (i + n + deck.length) % deck.length; show(); };
    card.onclick = () => card.classList.toggle('flip');
    card.onkeydown = e => { if (e.key === 'ArrowRight') step(1); if (e.key === 'ArrowLeft') step(-1); };
    sel.onchange = only.onchange = build;
    $('.shuf', root).onclick = () => { shuffle(deck); i = 0; show(); };
    $('.prev', root).onclick = () => step(-1); $('.next', root).onclick = () => step(1);
    const mark = v => { const g = deck[i]; if (!g) return; if (v) known[g.k] = 1; else delete known[g.k]; store.set('known', known); if (only.checked && v) { deck.splice(i, 1); if (i >= deck.length) i = 0; show(); } else step(1); };
    $('.got', root).onclick = () => mark(true); $('.again', root).onclick = () => mark(false);
    build();
  };

  C.quiz = (root, bank) => {
    const n = Math.min(+root.dataset.n || 10, bank.length), id = root.dataset.src; let qs, i, score, wrong;
    const intro = () => { const best = store.get('best:' + id, null); root.innerHTML = `<p>${n} questions drawn at random from a bank of ${bank.length}. You get instant feedback and an explanation after each one.</p>${best !== null ? `<p class="small muted">Your best score so far: <b>${best} / ${n}</b></p>` : ''}<button class="btn go">Action! Start the quiz ▶</button>`; $('.go', root).onclick = start; };
    const start = () => { qs = shuffle(bank.slice()).slice(0, n); i = 0; score = 0; wrong = []; show(); };
    const show = () => {
      const q = qs[i], opts = shuffle(q.o.map((t, k) => ({ t, ok: k === 0 })));
      root.innerHTML = `<div class="qhead"><span>Question ${i + 1} of ${n}</span><span>Score ${score}</span></div><div class="meter"><i style="width:${i / n * 100}%"></i></div>
        ${q.img ? `<img class="qimg" src="${q.img}" alt="Still to analyse">` : ''}<h3 class="q">${q.q}</h3><div class="opts">${opts.map((o, k) => `<button class="opt" data-ok="${o.ok ? 1 : 0}"><b>${'ABCD'[k]}</b><span>${o.t}</span></button>`).join('')}</div><div class="why" hidden></div>`;
      $$('.opt', root).forEach(b => b.onclick = () => {
        const ok = b.dataset.ok === '1'; if (ok) score++; else wrong.push(q);
        $$('.opt', root).forEach(x => { x.disabled = true; if (x.dataset.ok === '1') x.classList.add('right'); }); if (!ok) b.classList.add('wrong');
        const w = $('.why', root); w.hidden = false;
        w.innerHTML = `<b style="color:var(--${ok ? 'green' : 'red'})">${ok ? 'Correct.' : 'Not quite.'}</b> ${q.why}<div class="bar"><button class="btn nx">${i + 1 < n ? 'Next question →' : 'See my score →'}</button></div>`;
        $('.nx', root).onclick = () => { i++; i < n ? show() : end(); }; $('.nx', root).focus();
      });
    };
    const end = () => {
      const best = Math.max(score, store.get('best:' + id, 0)); store.set('best:' + id, best);
      const msg = score === n ? 'A perfect take!' : score >= n * .8 ? 'That’s a wrap. Strong work.' : score >= n * .5 ? 'Good first cut. Review the ones below and go again.' : 'Early rushes. Hit the flashcards, then try another take.';
      root.innerHTML = `<div class="center"><div class="score">${score} / ${n}</div><p><b>${msg}</b> Best so far: ${best} / ${n}.</p><button class="btn go">Take ${n} more ▶</button></div>
        ${wrong.length ? `<h4 style="margin-top:20px">Review these</h4>${wrong.map(q => `<div class="gymq"><div class="qq">${q.q}</div><b style="color:var(--green)">${q.o[0]}</b><br><span class="small muted">${q.why}</span></div>`).join('')}` : ''}`;
      $('.go', root).onclick = start;
    };
    intro();
  };

  C.gym = (root, list) => {
    const st = store.get('gym', {});
    root.innerHTML = list.map(q => `<div class="gymq" data-id="${q.id}"><div class="qq"><span>${q.q}</span><span class="marks">${q.m} mark${q.m > 1 ? 's' : ''}</span></div>
      <textarea rows="3" placeholder="Type your answer first…" aria-label="Your answer">${esc(st[q.id] || '')}</textarea>
      <details class="rev"><summary>Check it against the marking guide</summary><div><div class="pts">${q.pts.map(p => `<label><input type="checkbox"> <span>${p}</span></label>`).join('')}</div>
      <p class="small muted" style="margin:.6em 0 0"><b>Model answer:</b> ${q.model}</p></div></details></div>`).join('');
    root.addEventListener('input', e => { if (e.target.tagName === 'TEXTAREA') { st[e.target.closest('.gymq').dataset.id] = e.target.value; store.set('gym', st); } });
  };

  // Camera Movement Lab: a 3D set loaded on demand from assets/camlab.js
  let camlabLoad = null;
  C.moves = (root, list) => {
    root.innerHTML = '<div class="cl-wait box center"><p class="muted">Setting up the 3D camera…</p></div>';
    const go = () => {
      camlabLoad = camlabLoad || new Promise((ok, bad) => { const sc = document.createElement('script'); sc.src = 'assets/camlab.js?v=' + (document.querySelector('script[src*="site.js"]')?.src.split('v=')[1] || '1'); sc.onload = ok; sc.onerror = bad; document.head.append(sc); });
      camlabLoad.then(() => window.CamLab.mount(root, list)).catch(() => { root.innerHTML = '<div class="box"><p>The 3D camera could not load. Check your connection and refresh the page.</p></div>'; });
    };
    if (!('IntersectionObserver' in window)) return go();
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); go(); } }, { rootMargin: '600px 0px' });
    io.observe(root);
  };

  C.comp = (root, list) => {
    root.innerHTML = `<div class="tabs" role="tablist">${list.map((r, i) => `<button class="tab" role="tab" data-i="${i}">${r.n}</button>`).join('')}</div><div class="grid g2"><div class="frame"></div><div class="cap"></div></div>`;
    const pick = i => { const r = list[i]; $$('.tab', root).forEach((t, k) => t.setAttribute('aria-selected', k === i));
      $('.frame', root).innerHTML = `<svg viewBox="0 0 300 200" role="img" aria-label="Diagram: ${esc(r.n)}">${r.svg}</svg>`;
      $('.cap', root).innerHTML = `<h3>${r.n}</h3><div class="lbl kicker">Explain it in one sentence</div><p>${r.ex}</p><div class="lbl kicker">Sketch it in 20 seconds</div><p>${r.sk}</p><div class="lbl kicker">Where you’ve seen it</div><p class="muted">${r.eg}</p>`; };
    root.onclick = e => { const b = e.target.closest('.tab'); if (b) pick(+b.dataset.i); }; pick(0);
  };

  C.spots = (root, stims) => {
    const seen = store.get('spots', {}), notes = store.get('spotnotes', {});
    let s = 0, mode = '', order = [], qi = 0, misses = 0, ti = 0, timer = null, playing = false, waiting = false;
    root.innerHTML = `<div class="tabs stimtabs" role="tablist">${stims.map((x, i) => `<button class="tab" role="tab" data-i="${i}">${x.tab}</button>`).join('')}</div>
      <div class="bar"><div class="tabs modes" style="margin:0"></div><span class="push small muted prog"></span></div>
      <div class="findbar" hidden></div><div class="spotwrap"><div><div class="stage"></div><p class="small muted cred"></p></div><div class="panel" aria-live="polite"></div></div>`;
    const stage = $('.stage', root), panel = $('.panel', root), fb = $('.findbar', root), modes = $('.modes', root);
    const X = () => stims[s], key = i => X().id + i;
    const pos = p => p.d || [(p.b[0] + p.b[2]) / 2, (p.b[1] + p.b[3]) / 2];
    const MODES = x => x.worked ? [['explore', 'Explore'], ['tour', 'Guided tour ▶'], ['find', 'Test me: find it']] : [['find', 'Find it'], ['mine', 'My finds and notes']];
    const stop = () => { clearInterval(timer); timer = null; playing = false; };
    const count = () => X().spots.filter((_, i) => seen[key(i)]).length;
    const prog = () => { $('.prog', root).textContent = `${count()} of ${X().spots.length} ${X().worked ? 'explored' : 'found'}`; };
    const dot = (p, i, cls) => `<button class="dot ${cls || ''}" style="left:${pos(p)[0]}%;top:${pos(p)[1]}%" data-i="${i}" aria-label="${esc(p.n)}">${i + 1}</button>`;
    const box = (p, cls) => `<i class="${cls}" style="left:${p.b[0]}%;top:${p.b[1]}%;width:${p.b[2] - p.b[0]}%;height:${p.b[3] - p.b[1]}%"></i>`;
    const info = () => {
      const x = X();
      const start = { explore: 'Tap a numbered hotspot. Name the convention, think about why it is there, then reveal its effect.', tour: 'Sit back. The spotlight moves through every convention on this cover. Pause whenever you like.', find: x.worked ? 'Read the prompt above the image, then tap where you think that convention is.' : 'This one is yours to analyse. Read the prompt above the image and tap the convention. When you find it, write your own notes on its effect.', mine: 'Tap a number to reopen what you found and add to your notes.' }[mode];
      let mine = '';
      if (mode === 'mine') { const f = x.spots.map((p, i) => [p, i]).filter(a => seen[key(a[1])]);
        mine = f.length ? `<div class="lbl">Found so far</div><ol class="finds">${f.map(([p, i]) => `<li value="${i + 1}"><b>${esc(p.n)}</b><br><span class="small muted">${notes[key(i)] ? esc(notes[key(i)]) : 'No notes yet.'}</span></li>`).join('')}</ol>` : '<p class="muted">Nothing found yet. Switch to <b>Find it</b> to start.</p>'; }
      panel.innerHTML = `<div class="kicker">${x.kind}</div><h3>${x.title}</h3><p>${x.sub}</p>${x.aud ? `<div class="lbl">${x.worked ? 'Target audience' : 'Think about the audience'}</div><p>${x.aud}</p>` : ''}<div class="lbl">Start here</div><p>${start}</p>${mine}`;
    };
    const detail = (i, reveal) => { const x = X(), p = x.spots[i];
      panel.innerHTML = `<div class="kicker">Hotspot ${i + 1} · ${x.tab}</div><h3>${termBtn(p.t, p.n)}</h3><div class="lbl">What you can see</div><p>${p.see}</p><div class="lbl">Ask yourself</div><p>${p.ask}</p>` +
        (p.eff ? `<details class="rev"${reveal ? ' open' : ''}><summary>Think first, then reveal the effect</summary><div><p>${p.eff}</p><div class="lbl">Say it in the exam</div><p class="say">${p.say}</p></div></details>`
          : `<div class="lbl">My analysis</div><textarea class="note" data-note="${key(i)}" rows="4" placeholder="What effect does this have on the audience? Why did the designer do it?">${esc(notes[key(i)] || '')}</textarea><p class="small muted" style="margin:.4em 0 0">Name it → show it → explain it. Your notes are saved on this device.</p>`); };
    const draw = () => {
      stop(); const x = X(); if (!MODES(x).some(m => m[0] === mode)) mode = MODES(x)[0][0];
      $$('.stimtabs .tab', root).forEach((t, k) => t.setAttribute('aria-selected', k === s));
      modes.innerHTML = MODES(x).map(m => `<button class="tab m" data-m="${m[0]}" aria-selected="${m[0] === mode}">${m[1]}</button>`).join('');
      stage.className = 'stage' + (mode === 'find' ? ' find' : '') + (mode === 'tour' ? ' touring' : ''); $('.cred', root).textContent = x.cred;
      stage.innerHTML = `<img src="${x.img}" alt="${esc(x.title)}">` + (mode === 'explore' ? x.spots.map((p, i) => dot(p, i, seen[key(i)] ? 'seen' : '')).join('') : '') +
        (mode === 'mine' ? x.spots.map((p, i) => seen[key(i)] ? dot(p, i, 'hit') : '').join('') : '') + (mode === 'tour' ? '<i class="lamp"></i>' : '');
      fb.hidden = mode === 'explore' || mode === 'mine'; fb.className = 'findbar' + (mode === 'tour' ? ' tour' : ''); info(); prog();
      if (mode === 'find') { order = shuffle(x.spots.map((_, i) => i).filter(i => x.worked || !seen[key(i)])); qi = 0; ask(); }
      if (mode === 'tour') { ti = 0; step(0); play(true); }
    };
    /* guided tour */
    const tourbar = () => { fb.innerHTML = `<span>Guided tour · stop ${ti + 1} of ${X().spots.length}</span><span class="push"></span><button class="btn ghost sm tp">← Back</button><button class="btn ghost sm tpp">${playing ? 'Pause' : 'Play'}</button><button class="btn sm tn">Next →</button>`; };
    const step = n => { const x = X(); ti = (ti + n + x.spots.length) % x.spots.length; const p = x.spots[ti], l = $('.lamp', stage);
      if (l) Object.assign(l.style, { left: p.b[0] + '%', top: p.b[1] + '%', width: p.b[2] - p.b[0] + '%', height: p.b[3] - p.b[1] + '%' });
      seen[key(ti)] = 1; store.set('spots', seen); detail(ti, true); prog(); tourbar(); };
    const play = on => { clearInterval(timer); timer = null; playing = on; if (on) timer = setInterval(() => step(1), 9000); tourbar(); };
    fb.addEventListener('click', e => { if (mode !== 'tour') return; if (e.target.closest('.tp')) { step(-1); play(playing); } if (e.target.closest('.tn')) { step(1); play(playing); } if (e.target.closest('.tpp')) play(!playing); });
    /* find it */
    const ask = () => { misses = 0; waiting = false; fb.className = 'findbar'; const x = X();
      if (qi >= order.length) { fb.innerHTML = x.worked ? `That’s a wrap: all ${x.spots.length} found. <button class="btn sm again">Go again</button>` : `That’s a wrap: all ${x.spots.length} found. Open <b>My finds and notes</b> to review, then try the answer builder. <button class="btn ghost sm again">Start this one again</button>`;
        $('.again', fb).onclick = () => { if (!x.worked) { x.spots.forEach((_, i) => delete seen[key(i)]); store.set('spots', seen); } draw(); }; return; }
      fb.innerHTML = `Find it (${qi + 1} of ${order.length}): <span style="color:var(--accent)">${x.spots[order[qi]].n}</span> <span class="small muted" style="font-weight:400">— tap it on the image</span>${x.spots[order[qi]].hint ? `<div class="small muted" style="font-weight:400">Hint: ${x.spots[order[qi]].hint}</div>` : ''}<div class="small fbmsg" style="color:var(--red);font-weight:400"></div>`; };
    stage.addEventListener('click', e => {
      const x = X(), d = e.target.closest('.dot');
      if (mode === 'explore' || mode === 'mine') { if (!d) return; const i = +d.dataset.i; if (mode === 'explore') { seen[key(i)] = 1; store.set('spots', seen); d.classList.add('seen'); }
        $$('.dot', stage).forEach(b => b.classList.remove('sel')); d.classList.add('sel'); detail(i); prog(); return; }
      if (mode !== 'find' || waiting || qi >= order.length) return;
      const r = stage.getBoundingClientRect(), px = (e.clientX - r.left) / r.width * 100, py = (e.clientY - r.top) / r.height * 100, i = order[qi], p = x.spots[i];
      const tx = Math.max(2.5, 18 / r.width * 100), ty = Math.max(2.5, 18 / r.height * 100);
      const show = given => { stage.insertAdjacentHTML('beforeend', box(p, 'found') + dot(p, i, 'hit')); if (!x.worked) { seen[key(i)] = 1; store.set('spots', seen); } detail(i, true); qi++; prog();
        if (x.worked) { ask(); if (given && qi < order.length) $('.fbmsg', fb).textContent = 'The last one was shown for you.'; return; }
        waiting = true; fb.className = 'findbar tour'; fb.innerHTML = `<span>${given ? 'Here it is' : '<span style="color:var(--green)">Found it</span>'}: <span style="color:var(--accent)">${esc(p.n)}</span> <span class="small muted" style="font-weight:400">— answer the questions in your notes, then carry on.</span></span><span class="push"></span><button class="btn sm nxt">${qi < order.length ? 'Next one →' : 'Finish'}</button>`;
        $('.nxt', fb).onclick = ask; const n = $('textarea.note', panel); if (n && matchMedia('(min-width: 900px)').matches) n.focus({ preventScroll: true }); };
      if (px >= p.b[0] - tx && px <= p.b[2] + tx && py >= p.b[1] - ty && py <= p.b[3] + ty) show();
      else { misses++; const m = document.createElement('i'); m.className = 'miss'; m.style.left = e.clientX - r.left + 'px'; m.style.top = e.clientY - r.top + 'px'; stage.append(m); setTimeout(() => m.remove(), 700);
        if (misses >= 3) show(true); else $('.fbmsg', fb).textContent = `Not there. Try again (${3 - misses} ${3 - misses === 1 ? 'try' : 'tries'} left).`; }
    });
    panel.addEventListener('input', e => { const k = e.target.dataset.note; if (k) { notes[k] = e.target.value; store.set('spotnotes', notes); } });
    root.addEventListener('click', e => { const t = e.target.closest('.stimtabs .tab'); if (t) { s = +t.dataset.i; mode = ''; draw(); } const m = e.target.closest('.tab.m'); if (m) { mode = m.dataset.m; draw(); } });
    draw();
  };

  C.builder = (root, cfg) => {
    const st = store.get('b:' + cfg.id, {}); let left = (cfg.mins || 0) * 60, run = null;
    const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    root.innerHTML = `${cfg.qs ? `<div class="field"><label>Practice question</label><select class="qsel" style="width:100%">${cfg.qs.map((q, i) => `<option value="${i}">${esc(q.replace(/<[^>]+>/g, ''))}</option>`).join('')}</select></div><div class="qbox"></div>` : ''}
      ${cfg.fields.map(f => `<div class="field"><label for="${cfg.id + f.k}">${f.l}</label><div class="hint">${f.h || ''}</div>${f.s ? `<div class="chips">${f.s.map(x => `<button type="button" class="chip" data-k="${f.k}">${esc(x)}</button>`).join('')}</div>` : ''}${f.ev && cfg.ev ? `<select class="evsel" data-k="${f.k}" aria-label="Insert evidence"><option value="">＋ Insert evidence from the reel…</option>${cfg.ev.map((x, i) => `<option value="${i}">${esc(x)}</option>`).join('')}</select>` : ''}<textarea id="${cfg.id + f.k}" data-k="${f.k}" rows="${f.rows || 3}">${esc(st[f.k] || '')}</textarea></div>`).join('')}
      <div class="bar">${cfg.mins ? `<span class="timer">${fmt(left)}</span><button class="btn sm tgo">Start ${cfg.mins}-minute timer</button><button class="btn ghost sm trs">Reset</button>` : ''}<span class="push small muted wc"></span><button class="btn ghost sm copy">Copy my answer</button><button class="btn ghost sm clr">Clear</button></div>
      ${cfg.check ? `<details class="rev"><summary>Self-check before you move on</summary><div class="pts">${cfg.check.map(c => `<label><input type="checkbox"> <span>${c}</span></label>`).join('')}</div></details>` : ''}`;
    const areas = $$('textarea', root), qsel = $('.qsel', root), tm = $('.timer', root);
    const wc = () => { const n = areas.map(a => a.value).join(' ').trim().split(/\s+/).filter(Boolean).length; $('.wc', root).textContent = `${n} words${cfg.words ? ' · aim for ' + cfg.words : ''}`; };
    const save = () => { areas.forEach(a => st[a.dataset.k] = a.value); if (qsel) st.q = +qsel.value; store.set('b:' + cfg.id, st); wc(); };
    if (qsel) { qsel.value = st.q || 0; const sq = () => $('.qbox', root).innerHTML = cfg.qs[+qsel.value]; qsel.onchange = () => { sq(); save(); }; sq(); }
    root.addEventListener('input', save);
    root.addEventListener('change', e => { const v = e.target.closest('.evsel'); if (!v || v.value === '') return; const a = $(`textarea[data-k="${v.dataset.k}"]`, root); a.value += (a.value && !/\s$/.test(a.value) ? ' ' : '') + cfg.ev[+v.value] + ' '; v.value = ''; a.focus(); save(); });
    root.addEventListener('click', e => { const c = e.target.closest('.chip'); if (!c) return; const a = $(`textarea[data-k="${c.dataset.k}"]`, root); a.value += (a.value && !/\s$/.test(a.value) ? ' ' : '') + c.textContent + ' '; a.focus(); save(); });
    if (cfg.mins) $('.tgo', root).onclick = e => { if (run) { clearInterval(run); run = null; e.target.textContent = 'Resume'; return; } e.target.textContent = 'Pause'; tm.classList.remove('end');
      run = setInterval(() => { left--; tm.textContent = fmt(Math.max(left, 0)); if (left <= 0) { clearInterval(run); run = null; tm.classList.add('end'); tm.textContent = 'CUT!'; e.target.textContent = 'Time’s up'; } }, 1000); };
    if (cfg.mins) $('.trs', root).onclick = () => { clearInterval(run); run = null; left = cfg.mins * 60; tm.textContent = fmt(left); tm.classList.remove('end'); $('.tgo', root).textContent = `Start ${cfg.mins}-minute timer`; };
    $('.copy', root).onclick = async e => { const txt = (qsel ? 'Question: ' + qsel.options[qsel.selectedIndex].text + '\n\n' : '') + areas.map(a => a.value.trim()).filter(Boolean).join('\n\n');
      try { await navigator.clipboard.writeText(txt); } catch { const t = document.createElement('textarea'); t.value = txt; document.body.append(t); t.select(); document.execCommand('copy'); t.remove(); }
      e.target.textContent = 'Copied ✓'; setTimeout(() => e.target.textContent = 'Copy my answer', 1600); };
    $('.clr', root).onclick = () => { if (confirm('Clear everything you typed in this builder?')) { areas.forEach(a => a.value = ''); save(); } };
    wc();
  };

  C.reel = (root, list) => {
    const seen = store.get('reel', {}); let i = 0;
    root.innerHTML = `<div class="film" role="tablist" aria-label="Moments from the segment">${list.map((m, k) => `<button role="tab" data-i="${k}" class="${seen[k] ? 'seen' : ''}"><img src="${m.img}" alt="" loading="lazy"><span>${m.tc}</span></button>`).join('')}</div><div class="moment"></div>
      <div class="bar center"><button class="btn ghost prev">← Previous moment</button><span class="small muted n"></span><button class="btn next">Next moment →</button></div>`;
    const show = k => { i = (k + list.length) % list.length; const m = list[i]; seen[i] = 1; store.set('reel', seen);
      $$('.film button', root).forEach((b, j) => { b.setAttribute('aria-selected', j === i); if (seen[j]) b.classList.add('seen'); if (j === i) b.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' }); });
      $('.n', root).textContent = `${i + 1} of ${list.length}`;
      $('.moment', root).innerHTML = `<div><img src="${m.img}" alt="Still at ${m.tc}"><p class="small muted" style="margin-top:6px">60 Minutes, Nine Network, 2018</p></div><div><div class="tc">${m.tc}</div><h3>${m.t}</h3><p>${m.what}</p>${m.q ? `<blockquote>${m.q}</blockquote>` : ''}
        <div>${m.tech.map(t => `<span class="tag a">${t}</span>`).join('')}</div>
        <details class="rev"><summary>How does this position the audience?</summary><div><p>${m.eff}</p><div class="lbl kicker">Use it in a paragraph about</div><p>${m.use}</p></div></details></div>`; };
    root.addEventListener('click', e => { const b = e.target.closest('.film button'); if (b) show(+b.dataset.i); if (e.target.closest('.prev')) show(i - 1); if (e.target.closest('.next')) show(i + 1); });
    show(0);
  };

  C.match = (root, pairs) => {
    let a = null, left;
    const start = () => { left = pairs.length; a = null;
      root.innerHTML = `<div class="match"><div>${shuffle(pairs.map((p, i) => `<button data-s="a" data-i="${i}">${p[0]}</button>`)).join('')}</div><div>${shuffle(pairs.map((p, i) => `<button data-s="b" data-i="${i}">${p[1]}</button>`)).join('')}</div></div><p class="small muted msg">Tap a technique on the left, then its evidence on the right.</p>`; };
    root.addEventListener('click', e => { const b = e.target.closest('.match button'); if (!b || b.classList.contains('ok')) return;
      if (b.dataset.s === 'a') { $$('.sel', root).forEach(x => x.classList.remove('sel')); b.classList.add('sel'); a = b; return; }
      if (!a) return;
      if (a.dataset.i === b.dataset.i) { a.className = b.className = 'ok'; a = null; if (--left === 0) { $('.msg', root).innerHTML = '<b style="color:var(--green)">All matched. That’s a full evidence bank for your essay.</b> <button class="btn sm again">Shuffle and replay</button>'; $('.again', root).onclick = start; } }
      else { b.classList.add('no'); setTimeout(() => b.classList.remove('no'), 350); } });
    start();
  };

  C.unpack = (root, list) => {
    root.innerHTML = `<div class="bar"><select class="sel" style="flex:1;min-width:0" aria-label="Choose a statement">${list.map((s, i) => `<option value="${i}">${esc(s.s)}</option>`).join('')}</select><button class="btn ghost sm rnd">Random statement</button></div><div class="out"></div>`;
    const sel = $('.sel', root);
    const show = () => { const s = list[+sel.value]; $('.out', root).innerHTML = `<div class="qbox" style="font-size:1.15rem">“${s.s}”</div>
      <div class="grid g2"><div class="box"><h4>What it’s really asking</h4><p>${s.ask}</p><p><b>Key words:</b> ${s.key.map(k => `<span class="tag a">${k}</span>`).join('')}</p></div>
      <div class="box"><h4>Take a position</h4><p><b>Mostly agree:</b> ${s.yes}</p><p><b>But also:</b> ${s.but}</p></div></div>
      <details class="rev"><summary>Which evidence fits best?</summary><div><ul>${s.ev.map(e => `<li>${e}</li>`).join('')}</ul></div></details>`; };
    sel.onchange = show; $('.rnd', root).onclick = () => { let n; do { n = Math.floor(Math.random() * list.length); } while (list.length > 1 && n === +sel.value); sel.value = n; show(); }; show();
  };

  C.bank = root => {
    let cat = '';
    root.innerHTML = `<div class="bankbar"><input type="search" class="find" placeholder="Search ${G.length} terms… try “cut”, “audience” or “bias”" aria-label="Search the Word Bank">
      <div class="chips" style="margin:10px 0 0"><button class="chip on" data-c="">All</button>${Object.entries(CATS).map(([k, v]) => `<button class="chip" data-c="${k}">${v}</button>`).join('')}</div></div>
      <p class="small muted n" style="margin:14px 0"></p><div class="grid g2 list"></div>`;
    const find = $('.find', root), list = $('.list', root);
    const draw = () => { const q = find.value.trim().toLowerCase();
      const hits = G.filter(g => (!cat || g.c === cat) && (!q || (g.t + ' ' + g.d + ' ' + (g.e || '')).toLowerCase().includes(q))).sort((a, b) => a.t.localeCompare(b.t));
      $('.n', root).textContent = `${hits.length} term${hits.length === 1 ? '' : 's'}`;
      list.innerHTML = hits.map(g => `<article class="term" id="${g.k}"><span class="tag a">${CATS[g.c]}</span><h3>${esc(g.t)}</h3><p style="margin:0">${g.d}</p>${g.e ? `<p class="eg">Example: ${g.e}</p>` : ''}
        <p class="more" style="margin:.5em 0 0">${g.u ? `<a href="${g.u}" target="_blank" rel="noopener">Learn more ↗</a>` : ''}<a href="https://www.google.com/search?q=${encodeURIComponent(g.t + ' media studies definition')}" target="_blank" rel="noopener">Search the web ↗</a>${g.o ? `<span class="small muted">OneNote: ${esc(g.o)}</span>` : ''}</p></article>`).join('') || '<p>No terms match. Try a shorter search.</p>'; };
    find.oninput = draw;
    root.addEventListener('click', e => { const c = e.target.closest('.bankbar .chip'); if (!c) return; cat = c.dataset.c; $$('.bankbar .chip', root).forEach(x => x.classList.toggle('on', x === c)); draw(); });
    draw();
    const jump = () => { const t = document.getElementById(location.hash.slice(1)); if (t) { t.scrollIntoView({ block: 'center' }); t.classList.add('hl'); } };
    if (location.hash) setTimeout(jump, 80); addEventListener('hashchange', jump);
  };


  C.sorter = (root, items) => {
    const N = Math.min(12, items.length), CODES = { S: 'Symbolic', W: 'Written', A: 'Audio', T: 'Technical' }; let qs, i, score, streak, bestStreak;
    const intro = () => { const best = store.get('best:sorter', null); root.innerHTML = `<p>${N} things you might see or hear in a media text. Sort each one into the right code as fast as you can.</p>${best !== null ? `<p class="small muted">Your best score so far: <b>${best} / ${N}</b></p>` : ''}<button class="btn go">Start sorting ▶</button>`; $('.go', root).onclick = start; };
    const start = () => { qs = shuffle(items.slice()).slice(0, N); i = 0; score = 0; streak = 0; bestStreak = 0; show(); };
    const show = () => { const q = qs[i];
      root.innerHTML = `<div class="qhead"><span>Item ${i + 1} of ${N}</span><span>Score ${score} · Streak ${streak}</span></div><div class="meter"><i style="width:${i / N * 100}%"></i></div>
        <div class="sortcard">${q.t}</div><div class="sortbtns">${Object.entries(CODES).map(([k, v]) => `<button class="opt" data-k="${k}"><b>${k}</b><span>${v}</span></button>`).join('')}</div><div class="why" hidden></div>`;
      $$('.opt', root).forEach(b => b.onclick = () => { const ok = b.dataset.k === q.c; $$('.opt', root).forEach(x => { x.disabled = true; if (x.dataset.k === q.c) x.classList.add('right'); });
        const next = () => { i++; i < N ? show() : end(); };
        if (ok) { score++; streak++; bestStreak = Math.max(bestStreak, streak); setTimeout(next, 650); }
        else { streak = 0; b.classList.add('wrong'); const w = $('.why', root); w.hidden = false; w.innerHTML = `<b style="color:var(--red)">Not quite.</b> It is a <b>${CODES[q.c].toLowerCase()}</b> code: ${q.w}<div class="bar"><button class="btn nx">Next →</button></div>`; $('.nx', root).onclick = next; $('.nx', root).focus(); } }); };
    const end = () => { const best = Math.max(score, store.get('best:sorter', 0)); store.set('best:sorter', best);
      root.innerHTML = `<div class="center"><div class="score">${score} / ${N}</div><p>Longest streak: ${bestStreak}. Best score so far: ${best} / ${N}.</p><button class="btn go">Sort ${N} more ▶</button></div>`; $('.go', root).onclick = start; };
    intro();
  };

  C.sketch = (root, rules) => {
    root.innerHTML = `<div class="bar"><label>Sketch this rule <select class="sel">${rules.map(r => `<option>${esc(r)}</option>`).join('')}</select></label><label class="chk"><input type="checkbox" class="grid3"> Show a thirds grid</label><span class="push"></span><button class="btn ghost sm undo">Undo</button><button class="btn ghost sm clr">Clear</button></div>
      <canvas class="pad" width="900" height="600" aria-label="Sketch pad"></canvas><p class="small muted">Draw with your mouse, trackpad or finger. If you are asked to sketch a rule, keep it simple and make the rule obvious. Stick figures are fine.</p>`;
    const cv = $('.pad', root), cx = cv.getContext('2d'); let strokes = [], cur = null;
    const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
    const paint = () => { cx.clearRect(0, 0, 900, 600);
      if ($('.grid3', root).checked) { cx.strokeStyle = css('--line'); cx.lineWidth = 2; cx.setLineDash([10, 8]); [300, 600].forEach(x => { cx.beginPath(); cx.moveTo(x, 0); cx.lineTo(x, 600); cx.stroke(); }); [200, 400].forEach(y => { cx.beginPath(); cx.moveTo(0, y); cx.lineTo(900, y); cx.stroke(); }); cx.setLineDash([]); }
      cx.strokeStyle = css('--text'); cx.lineWidth = 4; cx.lineCap = cx.lineJoin = 'round';
      strokes.forEach(s => { cx.beginPath(); s.forEach((p, i) => i ? cx.lineTo(p[0], p[1]) : cx.moveTo(p[0], p[1])); if (s.length === 1) cx.lineTo(s[0][0] + .1, s[0][1]); cx.stroke(); }); };
    const pt = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * 900, (e.clientY - r.top) / r.height * 600]; };
    cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); cur = [pt(e)]; strokes.push(cur); paint(); });
    cv.addEventListener('pointermove', e => { if (!cur) return; cur.push(pt(e)); paint(); });
    ['pointerup', 'pointercancel'].forEach(t => cv.addEventListener(t, () => cur = null));
    $('.undo', root).onclick = () => { strokes.pop(); paint(); }; $('.clr', root).onclick = () => { strokes = []; paint(); };
    $('.grid3', root).onchange = paint; $('.sel', root).onchange = () => { strokes = []; paint(); };
    document.addEventListener('hub:theme', paint); paint();
  };

  C.rubric = (root, list) => {
    const st = store.get('rubric', {});
    root.innerHTML = list.map((c, k) => `<fieldset class="rub"><legend>${c.n} <span class="marks">${c.max} marks</span></legend><p class="small muted">${c.q}</p>${c.bands.map(b => `<label><input type="radio" name="rub${k}" value="${b.m}"${st[k] === b.m ? ' checked' : ''}> <span><b>${b.m}</b> · ${b.d}</span></label>`).join('')}</fieldset>`).join('') + '<div class="rubout" aria-live="polite"></div>';
    const paint = () => { const out = $('.rubout', root), got = list.map((c, k) => st[k]);
      if (got.some(v => v === undefined)) { out.innerHTML = '<p class="muted">Choose one description for each of the four criteria to see your estimated mark.</p>'; return; }
      const total = got.reduce((a, b) => a + b, 0), max = list.reduce((a, c) => a + c.max, 0); let weak = 0; list.forEach((c, k) => { if (got[k] / c.max < got[weak] / list[weak].max) weak = k; });
      out.innerHTML = `<div class="center"><div class="score">${total} / ${max}</div><p class="muted">An honest estimate, not a final mark.</p></div><div class="tip"><b>Your next step:</b> ${list[weak].tip}</div>`; };
    root.addEventListener('change', e => { if (e.target.type !== 'radio') return; st[+e.target.name.slice(3)] = +e.target.value; store.set('rubric', st); paint(); });
    paint();
  };

  if (payloadEl) boot();
})();
