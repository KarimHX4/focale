'use strict';
/* =====================================================================
   FOCALE — interface
   ===================================================================== */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const FCOL = ['#2563eb', '#16a34a', '#dc2626', '#9333ea', '#ea580c', '#0891b2', '#ca8a04', '#db2777', '#4b5563', '#65a30d'];
const fcol = i => FCOL[i % FCOL.length];
function wlCol(um) {
  const l = um * 1000; let r = 0, g = 0, b = 0;
  if (l < 380) return '#6d28d9'; if (l > 780) return '#7f1d1d';
  if (l < 440) { r = -(l - 440) / 60; b = 1; } else if (l < 490) { g = (l - 440) / 50; b = 1; }
  else if (l < 510) { g = 1; b = -(l - 510) / 20; } else if (l < 580) { r = (l - 510) / 70; g = 1; }
  else if (l < 645) { r = 1; g = -(l - 645) / 65; } else r = 1;
  return `rgb(${Math.round(r * 225)},${Math.round(g * 175)},${Math.round(b * 235)})`;
}
const fmt = (v, d = 5) => {
  if (v === Infinity) return 'Infini'; if (v === -Infinity) return '-Infini';
  if (v == null || !isFinite(v)) return '—';
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a >= 1e6 || a < 1e-4) return v.toExponential(Math.max(1, d - 2));
  return String(+v.toPrecision(d + (a >= 100 ? 1 : 0)));
};
const fx = (v, d = 3) => (v == null || !isFinite(v)) ? (v === Infinity ? '∞' : '—') : (+v).toFixed(d);
function parseNum(s, allowInf = true) {
  s = String(s).trim().toLowerCase().replace(',', '.').replace(/\s/g, '');
  if (allowInf && ['inf', 'infini', 'infinity', '∞', '+inf', ''].includes(s)) return Infinity;
  if (allowInf && ['-inf', '-infini', '-∞', '-infinity'].includes(s)) return -Infinity;
  const v = Number(s); return isFinite(v) ? v : NaN;
}
const rep = (k, v) => (v === Infinity ? 'Infinity' : v === -Infinity ? '-Infinity' : v);
const rev = (k, v) => (v === 'Infinity' ? Infinity : v === '-Infinity' ? -Infinity : v);
const toJSON = o => JSON.stringify(o, rep, 1);
const fromJSON = s => JSON.parse(s, rev);
function toast(msg, ms = 2200) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), ms); }
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const newSurf = (o = {}) => ({ r: Infinity, t: 5, glass: '', sd: 0, sdFixed: false, k: 0, a4: 0, a6: 0, a8: 0, a10: 0, stop: false, comment: '', vr: false, vt: false, vk: false, tsolve: '',
  dx: 0, dy: 0, dz: 0, tx: 0, ty: 0, tz: 0, dmode: 'DEC', ...o });
const isDec = s => !!(s.dx || s.dy || s.dz || s.tx || s.ty || s.tz);
const ELEM = [['refr', 'Dioptre'], ['mirror', 'Miroir'], ['grating', 'Réseau (T)'], ['rgrating', 'Réseau (R)'], ['ideal', 'Lentille idéale'], ['polarizer', 'Polariseur'], ['waveplate', 'Lame d\'onde']];
const elemOf = s => s.elem === 'grating' ? (OE.isMirror(s) ? 'rgrating' : 'grating') : s.elem || (OE.isMirror(s) ? 'mirror' : 'refr');

/* ---------------- État ---------------- */
const App = {
  sys: null, M: null, sel: 1, hist: [], hi: -1, focus: null,
  panes: [{ type: 'spot' }, { type: 'wfe', fi: 0 }, { type: 'mtf' }, { type: 'psf', fi: 0 }, { type: 'rayfan' }, { type: 'footprint' }],
  grid: 4, mode: '2d', view: { auto: true, s: 1, ox: 0, oy: 0, yaw: 0.55, pitch: 0.32 }, nRays: 7, showAsph: false,
};
function save() { try { localStorage.setItem('focale.sys', toJSON(App.sys)); localStorage.setItem('focale.ui', JSON.stringify({ panes: App.panes, grid: App.grid, theme: document.documentElement.dataset.theme || '' })); } catch (e) { } }
function load() {
  try {
    const s = localStorage.getItem('focale.sys'); if (s) App.sys = normalize(fromJSON(s));
    const u = JSON.parse(localStorage.getItem('focale.ui') || 'null');
    if (u) { if (Array.isArray(u.panes) && u.panes.length >= 6) App.panes = u.panes; if (u.grid) App.grid = u.grid; if (u.theme) document.documentElement.dataset.theme = u.theme; }
  } catch (e) { App.sys = null; }
}
function normalize(s) {
  s.aperture = { type: 'EPD', value: 10, obscuration: 0, ...(s.aperture || {}) };
  s.fields = ((s.fields && s.fields.length) ? s.fields : [{ y: 0, w: 1 }]).map(f => ({ x: +f.x || 0, y: +f.y || 0, w: f.w ?? 1 }));
  s.wavelengths = (s.wavelengths && s.wavelengths.length) ? s.wavelengths : [{ um: 0.5875618, w: 1 }];
  s.primary = Math.min(Math.max(0, s.primary | 0), s.wavelengths.length - 1);
  s.merit = s.merit || { image: 'SPOT', ops: [] }; s.merit.ops = s.merit.ops || [];
  s.src = { type: 'none', fib: 'si', core: 50, clad: 125, na: 0.22, mfd: null, lc0: null, dl: null, len: null, att: null, bw: null, d: 10, w: 20, h: 200, ...(s.src || {}) };
  s.det = { on: false, p: 3.45, nx: 2448, ny: 2048, ff: 100, bits: 12, fw: 10000, rn: 3, lvl: 70, noise: false, ...(s.det || {}) };
  s.surfaces = s.surfaces.map(x => newSurf(x));
  if (s.userGlass) { OE.addGlasses(Object.values(s.userGlass).map(g => ({ ...g, user: true })), false); delete s.userGlass; rebuildGlassList(); }
  return s;
}
function pushHist() {
  const s = toJSON(App.sys);
  if (App.hist[App.hi] === s) return;
  App.hist.splice(App.hi + 1); App.hist.push(s);
  if (App.hist.length > 300) App.hist.shift();
  App.hi = App.hist.length - 1; save();
}
function commit(mut, opts = {}) { mut(App.sys); pushHist(); refresh(opts); }
function undo() { if (App.hi > 0) { App.hi--; App.sys = fromJSON(App.hist[App.hi]); refresh(); toast('Annulé'); } }
function redo() { if (App.hi < App.hist.length - 1) { App.hi++; App.sys = fromJSON(App.hist[App.hi]); refresh(); toast('Rétabli'); } }
function loadSystem(s, msg) { App.sys = normalize(s); App.sel = 1; App.view.auto = true; pushHist(); refresh(); if (msg) toast(msg); }

/* ---------------- Rafraîchissement ---------------- */
let paneTimer = null;
function refresh(opts = {}) {
  const t0 = performance.now();
  try { App.M = OE.prepare(App.sys); } catch (e) { console.error(e); App.M = { ok: false, errors: ['Erreur de calcul : ' + e.message] }; }
  App.sel = Math.min(Math.max(1, App.sel), App.sys.surfaces.length - 1);
  renderLDE(); renderSide(); drawLayout();
  App.lastPrep = performance.now() - t0;
  clearTimeout(paneTimer);
  paneTimer = setTimeout(renderPanes, opts.fast ? 0 : 40);
}
function status(extra) {
  const M = App.M, s = App.sys, el = $('#status');
  if (!M || !M.ok) { el.innerHTML = `<span class="err">⚠ ${esc((M && M.errors || []).join(' · '))}</span>`; return; }
  const p = M.par;
  el.innerHTML = `<span>${esc(s.title || 'Sans titre')}</span><span>Surfaces <span class="k">${s.surfaces.length - 2}</span></span>
  <span>EFL <span class="k">${fx(p.efl, 3)}</span></span><span>F/# trav. <span class="k">${fx(p.wfno, 3)}</span></span>
  <span>TTL <span class="k">${fx(p.ttl, 2)}</span></span><span>Variables <span class="k">${OE.getVars(s).length}</span></span>
  ${M.warnings && M.warnings.length ? `<span style="color:var(--warn)" title="${esc(M.warnings.join('\n'))}">⚠ ${M.warnings.length} avertissement(s) verre</span>` : ''}
  <span class="grow"></span><span>${extra || ''}</span><span>calcul <span class="k">${(App.lastPanes || 0).toFixed(0)} ms</span></span>`;
}

/* ---------------- Éditeur de lentilles ---------------- */
function renderLDE() {
  const S = App.sys.surfaces, N = S.length - 1, MS = App.M && App.M.ok ? App.M.S : null;
  const asph = App.showAsph;
  const tg = (i, k, lbl, on, cls = '', title = '') => `<button class="tg ${cls} ${on ? 'on' : ''}" data-tog="${k}" data-i="${i}" title="${title}">${lbl}</button>`;
  let h = `<thead><tr><th>#</th><th>Type</th><th>Élément</th><th>Commentaire</th><th>Rayon</th><th>Épaisseur</th><th>Verre</th><th>Demi-diamètre</th><th>Conique</th>${asph ? '<th>A4 (r⁴)</th><th>A6 (r⁶)</th><th>A8 (r⁸)</th><th>A10 (r¹⁰)</th>' : ''}</tr></thead><tbody>`;
  S.forEach((s, i) => {
    const obj = i === 0, img = i === N, mir = OE.isMirror(s);
    let badge = obj ? '<span class="b">OBJ</span>' : img ? '<span class="b">IMA</span>' : s.stop ? '<span class="b st">STO</span>' : mir ? '<span class="b mi">MIR</span>' : '';
    if (isDec(s)) badge += `<span class="b de" title="${{ DEC: 'Décentrement', DAR: 'Décentrement et retour', BEN: 'Pliage' }[s.dmode || 'DEC']}">${s.dmode || 'DEC'}</span>`;
    if (s.type && s.type !== 'STD') badge += `<span class="b fr">${s.type === 'XY' ? 'XY' : 'ZRN'}</span>`;
    const tVal = MS ? MS[i].t : s.t, sdVal = MS ? MS[i].sd : s.sd;
    const gOK = mir || OE.isAir(s.glass) || isFinite(OE.glassN(s.glass, 0.5876));
    h += `<tr data-i="${i}" class="${i === App.sel ? 'sel' : ''}">
      <td class="n">${i}</td><td class="ty">${badge}</td>
      <td>${obj || img ? '' : `<select class="el" data-i="${i}" data-k="elem">${ELEM.map(([k, l]) => `<option value="${k}" ${elemOf(s) === k ? 'selected' : ''}>${l}</option>`).join('')}</select>`}</td>
      <td><div class="cell"><input class="c" data-i="${i}" data-k="comment" value="${esc(s.comment)}"></div></td>
      <td><div class="cell"><input data-i="${i}" data-k="r" value="${obj ? '' : fmt(s.r, 7)}" ${obj ? 'disabled' : ''}>${obj || img ? '' : tg(i, 'vr', 'V', s.vr, '', 'Variable (optimisation)')}</div></td>
      <td><div class="cell"><input data-i="${i}" data-k="t" class="${s.tsolve === 'M' ? 'auto' : ''}" value="${img ? '' : fmt(tVal, 7)}" ${img ? 'disabled' : ''}>${img || obj ? '' : tg(i, 'vt', 'V', s.vt, '', 'Variable (optimisation)') + tg(i, 'tsolve', 'M', s.tsolve === 'M', 'm', 'Solve : hauteur marginale nulle à la surface suivante (focalisation paraxiale)')}</div></td>
      <td><div class="cell"><input class="g ${gOK ? '' : 'bad'}" list="glassList" data-i="${i}" data-k="glass" value="${esc(s.glass)}" ${img ? 'disabled' : ''} placeholder="${img ? '' : 'air'}"></div></td>
      <td><div class="cell"><input data-i="${i}" data-k="sd" class="${s.sdFixed ? '' : 'auto'}" value="${obj ? '' : fmt(sdVal, 5)}" ${obj ? 'disabled' : ''}>${obj ? '' : tg(i, 'sdFixed', '🔒', s.sdFixed, 'l', 'Demi-diamètre fixe (vignetage des rayons au-delà)')}</div></td>
      <td><div class="cell"><input data-i="${i}" data-k="k" value="${obj ? '' : fmt(s.k, 6)}" ${obj ? 'disabled' : ''}>${obj || img ? '' : tg(i, 'vk', 'V', s.vk, '', 'Variable (optimisation)')}</div></td>
      ${asph ? ['a4', 'a6', 'a8', 'a10'].map(k => `<td><div class="cell"><input data-i="${i}" data-k="${k}" value="${obj ? '' : fmt(s[k], 6)}" ${obj ? 'disabled' : ''}></div></td>`).join('') : ''}
    </tr>`;
  });
  h += '</tbody>';
  const tb = $('#lde'); tb.innerHTML = h;
  if (App.focus) { const f = App.focus; App.focus = null; const inp = tb.querySelector(`input[data-i="${f.i}"][data-k="${f.k}"]`); if (inp && !inp.disabled) { inp.focus(); inp.select(); } }
}
const LKEYS = () => ['comment', 'r', 't', 'glass', 'sd', 'k', ...(App.showAsph ? ['a4', 'a6', 'a8', 'a10'] : [])];
function commitCell(i, k, raw) {
  const s = App.sys.surfaces[i]; if (!s) return false;
  let v;
  switch (k) {
    case 'elem': {
      if (elemOf(s) === raw) return false;
      commit(S => {
        const x = S.surfaces[i], wasM = OE.isMirror(x);
        x.elem = ({ grating: 'grating', rgrating: 'grating', ideal: 'ideal', polarizer: 'polarizer', waveplate: 'waveplate' })[raw] || '';
        if (raw === 'mirror' || raw === 'rgrating') x.glass = 'MIRROR'; else if (wasM) x.glass = '';
        if (x.elem === 'grating') { x.lpmm = x.lpmm || 600; if (x.gm == null) x.gm = 1; }
        if (x.elem === 'ideal') { x.fid = x.fid || 100; x.r = Infinity; }
        if (x.elem === 'waveplate') { if (x.ret == null) x.ret = 0.25; if (x.wang == null) x.wang = 45; }
        if (x.elem === 'polarizer' && x.pang == null) x.pang = 0;
      });
      if (raw !== 'refr') toast('Paramètres de l\'élément dans le panneau « Surface » à gauche'); return true;
    }
    case 'comment': if (s.comment === raw) return false; commit(S => S.surfaces[i].comment = raw); return true;
    case 'glass': {
      let g = raw.trim(); const key = OE.glassKey(g); if (key) g = key; if (g.toUpperCase() === 'MIRROR') g = 'MIRROR';
      if (g === s.glass) return false;
      if (g && g !== 'MIRROR' && !OE.isAir(g) && !isFinite(OE.glassN(g, 0.5876))) toast(`Verre inconnu « ${g} » — utilisez le catalogue, un modèle nd/vd (ex. 1.5168/64.2) ou un indice fixe`, 3500);
      commit(S => S.surfaces[i].glass = g); return true;
    }
    case 'sd':
      if (raw.trim() === '') { commit(S => S.surfaces[i].sdFixed = false); return true; }
      v = parseNum(raw, false); if (!isFinite(v) || v <= 0) { toast('Valeur invalide'); refresh(); return false; }
      commit(S => { S.surfaces[i].sd = v; S.surfaces[i].sdFixed = true; }); return true;
    case 'r':
      v = parseNum(raw); if (isNaN(v)) { toast('Rayon invalide'); refresh(); return false; }
      if (v === 0) v = Infinity; if (v === s.r) return false;
      commit(S => S.surfaces[i].r = v); return true;
    case 't': {
      v = parseNum(raw, i === 0); if (isNaN(v)) { toast('Épaisseur invalide'); refresh(); return false; }
      const cur = App.M && App.M.ok ? App.M.S[i].t : s.t;
      if (Math.abs(v - cur) < 1e-12 * Math.max(1, Math.abs(v)) || v === cur) return false;
      commit(S => { S.surfaces[i].t = v; S.surfaces[i].tsolve = ''; }); return true;
    }
    default:
      v = parseNum(raw, false); if (raw.trim() === '') v = 0; if (isNaN(v)) { toast('Valeur invalide'); refresh(); return false; }
      if (v === s[k]) return false; commit(S => S.surfaces[i][k] = v); return true;
  }
}
function setupLDE() {
  const tb = $('#lde');
  tb.addEventListener('change', e => { const t = e.target; if (t.dataset.k) commitCell(+t.dataset.i, t.dataset.k, t.value); });
  tb.addEventListener('keydown', e => {
    const t = e.target; if (!t.dataset || !t.dataset.k) return;
    const i = +t.dataset.i, k = t.dataset.k;
    if (e.key === 'Enter' || e.key === 'Tab' || ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !e.altKey)) {
      e.preventDefault();
      const keys = LKEYS(); let ni = i, nk = k;
      if (e.key === 'Enter' || e.key === 'ArrowDown') ni = Math.min(i + 1, App.sys.surfaces.length - 1);
      else if (e.key === 'ArrowUp') ni = Math.max(0, i - 1);
      else { const ix = keys.indexOf(k) + (e.shiftKey ? -1 : 1); if (ix >= keys.length) { ni = i + 1; nk = keys[0]; } else if (ix < 0) { ni = i - 1; nk = keys[keys.length - 1]; } else nk = keys[ix]; }
      App.focus = { i: Math.max(0, Math.min(App.sys.surfaces.length - 1, ni)), k: nk };
      if (ni !== i) App.sel = Math.max(1, Math.min(App.sys.surfaces.length - 1, ni));
      const changed = commitCell(i, k, t.value);
      if (!changed) renderLDE();
    } else if (e.key === 'Escape') { renderLDE(); }
  });
  tb.addEventListener('focusin', e => { const t = e.target; if (t.dataset && t.dataset.i != null) selectRow(+t.dataset.i, false); });
  tb.addEventListener('click', e => {
    const b = e.target.closest('[data-tog]');
    if (b) {
      const i = +b.dataset.i, k = b.dataset.tog;
      commit(S => { const s = S.surfaces[i]; if (k === 'tsolve') { s.tsolve = s.tsolve === 'M' ? '' : 'M'; if (s.tsolve === 'M') s.vt = false; } else if (k === 'sdFixed') { if (!s.sdFixed && App.M && App.M.ok) s.sd = App.M.S[i].sd; s.sdFixed = !s.sdFixed; } else s[k] = !s[k]; });
      return;
    }
    const tr = e.target.closest('tr[data-i]'); if (tr && !e.target.closest('input')) selectRow(+tr.dataset.i, true);
  });
  tb.addEventListener('dblclick', e => { const td = e.target.closest('td.ty'); if (td) { const i = +td.parentElement.dataset.i; if (i > 0 && i < App.sys.surfaces.length - 1) setStop(i); } });
}
function selectRow(i, redraw = true) {
  i = Math.max(0, Math.min(App.sys.surfaces.length - 1, i));
  if (App.sel === i) return; App.sel = i;
  $$('#lde tr[data-i]').forEach(tr => tr.classList.toggle('sel', +tr.dataset.i === i));
  renderSide(); drawLayout();
  if (App.panes.slice(0, App.grid).some(p => p.type === 'footprint' && p.si == null)) renderPanes();
}
function setStop(i) { commit(S => S.surfaces.forEach((s, j) => s.stop = j === i)); }
function lde(act) {
  const S = App.sys.surfaces, N = S.length - 1; let i = App.sel;
  switch (act) {
    case 'insB': if (i < 1) i = 1; commit(s => s.surfaces.splice(i, 0, newSurf())); break;
    case 'insA': { const j = Math.min(i + 1, N); commit(s => s.surfaces.splice(j, 0, newSurf())); App.sel = j; refresh(); break; }
    case 'addLens': { const j = Math.min(i + 1, N); commit(s => s.surfaces.splice(j, 0, newSurf({ r: 50, t: 4, glass: 'N-BK7', comment: 'Lentille' }), newSurf({ r: -50, t: 10 }))); App.sel = j; refresh(); break; }
    case 'del': if (i < 1 || i >= N) return toast('Impossible de supprimer l\'objet ou l\'image'); if (N <= 2) return toast('Il faut au moins une surface');
      commit(s => { const wasStop = s.surfaces[i].stop; s.surfaces.splice(i, 1); if (wasStop) s.surfaces[Math.min(i, s.surfaces.length - 2)].stop = true; }); break;
    case 'stop': if (i < 1 || i >= N) return toast('Sélectionnez une surface optique'); setStop(i); break;
    case 'mirror': if (i < 1 || i >= N) return; commit(s => { const x = s.surfaces[i]; x.glass = OE.isMirror(x) ? '' : 'MIRROR'; }); break;
    case 'flip': {
      if (i < 1 || i >= N - 1) return toast('Sélectionnez la première surface d\'une lentille');
      commit(s => {
        const a = s.surfaces[i], b = s.surfaces[i + 1]; const neg = v => (isFinite(v) ? -v : v);
        const ra = a.r, rb = b.r; a.r = neg(rb); b.r = neg(ra);
        for (const k of ['k']) { const t = a[k]; a[k] = b[k]; b[k] = t; }
        for (const k of ['a4', 'a6', 'a8', 'a10']) { const t = a[k]; a[k] = -b[k]; b[k] = -t; }
      }); toast('Élément retourné'); break;
    }
  }
}

/* ---------------- Panneau système ---------------- */
const closedCards = new Set();
function card(id, title, body) { return `<div class="card ${closedCards.has(id) ? 'closed' : ''}" data-card="${id}"><h3>${title}<span class="chev">▾</span></h3><div class="cb">${body}</div></div>`; }
function renderSide() {
  const s = App.sys, M = App.M, ap = s.aperture;
  const objInf = !isFinite(s.surfaces[0].t) || Math.abs(s.surfaces[0].t) > 1e10;
  const apOpts = objInf ? [['EPD', 'Diamètre pupille d\'entrée (mm)'], ['FNO', 'F/# image']] : [['EPD', 'Diamètre pupille d\'entrée (mm)'], ['NA', 'Ouverture numérique objet']];
  if (!apOpts.find(o => o[0] === ap.type)) ap.type = 'EPD';
  const el = document.activeElement; const keep = el && el.closest && el.closest('#side') && el.dataset.f ? `[data-f="${el.dataset.f}"]${el.dataset.k ? `[data-k="${el.dataset.k}"]` : ''}${el.dataset.i != null ? `[data-i="${el.dataset.i}"]` : ''}` : null;
  let h = card('gen', 'Système', `
    <div class="row"><input class="in" style="flex:1" data-f="title" value="${esc(s.title)}" placeholder="Titre du système"></div>`);
  h += inspector();
  h += card('ap', 'Ouverture', `
    <div class="row"><select class="in" style="flex:1" data-f="apType">${apOpts.map(o => `<option value="${o[0]}" ${o[0] === ap.type ? 'selected' : ''}>${o[1]}</option>`).join('')}</select></div>
    <div class="row"><label>Valeur</label><input class="in mini" data-f="apVal" value="${fmt(ap.value, 6)}"></div>
    <div class="row"><label>Obstruction centrale (rayon rel.)</label><input class="in mini" data-f="obs" value="${fmt(ap.obscuration || 0, 4)}"></div>
    <div class="row"><label title="Itère sur chaque rayon pour viser exactement le diaphragme">Visée réelle des rayons (ray aiming)</label><input type="checkbox" data-f="aim" ${s.rayAiming ? 'checked' : ''}></div>`);
  h += card('fi', `Champs — ${objInf ? 'angle (°)' : 'hauteur objet (mm)'}`, `
    <table class="mt"><tr><th></th><th>${objInf ? 'X (°)' : 'X (mm)'}</th><th>${objInf ? 'Y (°)' : 'Y (mm)'}</th><th>Poids</th><th></th></tr>
    ${s.fields.map((f, i) => `<tr><td><span class="sw" style="background:${fcol(i)}"></span></td><td><input class="in" data-f="fx" data-i="${i}" value="${fmt(f.x || 0, 6)}"></td><td><input class="in" data-f="fy" data-i="${i}" value="${fmt(f.y, 6)}"></td><td><input class="in" data-f="fw" style="width:44px" data-i="${i}" value="${fmt(f.w ?? 1, 4)}"></td><td><button class="x" data-a="fdel" data-i="${i}" title="Supprimer">✕</button></td></tr>`).join('')}
    </table><button class="add" data-a="fadd">+ Ajouter un champ</button>
    <div class="chips"><button class="chip" data-a="fspread">Répartir 0 · 0.7 · 1</button></div>`);
  h += card('wl', 'Longueurs d\'onde (µm)', `
    <table class="mt"><tr><th></th><th>λ (µm)</th><th>Poids</th><th title="Primaire">Prim.</th><th></th></tr>
    ${s.wavelengths.map((w, i) => `<tr><td><span class="sw" style="background:${wlCol(w.um)}"></span></td><td><input class="in" data-f="wum" data-i="${i}" value="${fmt(w.um, 7)}"></td><td><input class="in" data-f="ww" style="width:48px" data-i="${i}" value="${fmt(w.w ?? 1, 4)}"></td><td style="text-align:center"><input type="radio" name="prim" data-f="wp" data-i="${i}" ${i === s.primary ? 'checked' : ''}></td><td><button class="x" data-a="wdel" data-i="${i}">✕</button></td></tr>`).join('')}
    </table><button class="add" data-a="wadd">+ Ajouter une longueur d'onde</button>
    <div class="chips"><button class="chip" data-a="wpre" data-v="FdC">F, d, C</button><button class="chip" data-a="wpre" data-v="vis">Visible</button><button class="chip" data-a="wpre" data-v="hene">632,8 nm</button><button class="chip" data-a="wpre" data-v="nir">NIR</button><button class="chip" data-a="wpre" data-v="d">d seule</button></div>`);
  h += srcCard();
  h += detCard();
  if (M && M.ok) {
    const p = M.par;
    h += card('par', 'Données paraxiales', `<div class="kv">
      <span>Focale (EFL)</span><span>${fx(p.efl, 4)}</span>
      <span>Tirage (BFL)</span><span>${fx(p.bfl, 4)}</span>
      <span>Distance image parax.</span><span>${fx(p.imgDist, 4)}</span>
      <span>F/# (EFL/EPD)</span><span>${fx(p.fno, 3)}</span>
      <span>F/# de travail</span><span>${fx(p.wfno, 3)}</span>
      <span>ON image</span><span>${fx(p.imgSpaceNA, 4)}</span>
      ${objInf ? '' : `<span>ON objet</span><span>${fx(p.objNA, 4)}</span><span>Grandissement</span><span>${fx(p.mag, 4)}</span>`}
      <span>Diam. pupille entrée</span><span>${fx(p.epd, 3)}</span>
      <span>Pos. pupille entrée</span><span>${fx(p.zE, 3)}</span>
      <span>Diam. pupille sortie</span><span>${fx(p.xpD, 3)}</span>
      <span>Pos. pupille sortie (/image)</span><span>${fx(p.xpZ, 3)}</span>
      <span>Ø diaphragme</span><span>${fx(2 * p.stopR, 3)}</span>
      <span>Hauteur image parax.</span><span>${fx(p.imgH, 4)}</span>
      <span>Longueur totale</span><span>${fx(p.ttl, 3)}</span>
      <span>Invariant de Lagrange</span><span>${fx(p.H, 5)}</span>
      <span>λ primaire</span><span>${fx(M.wls[M.pw] * 1000, 2)} nm</span></div>
      <div class="hint" style="margin-top:6px">Positions relatives : PE / 1ʳᵉ surface, PS / plan image.</div>`);
  }
  $('#side').innerHTML = h;
  if (keep) { const e = $('#side ' + keep); if (e) e.focus(); }
  status();
}
const SUP = n => String(n).split('').map(d => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]).join('');
function freeformEditor(x) {
  if (x.type === 'XY') {
    const terms = []; for (let n = 1; n <= 6; n++) for (let j = 0; j <= n; j++) terms.push([n - j, j]);
    const lab = (i, j) => (i ? 'x' + (i > 1 ? SUP(i) : '') : '') + (j ? 'y' + (j > 1 ? SUP(j) : '') : '');
    return `<div class="hint" style="margin:6px 0 2px">z = conique + Σ cᵢⱼ xⁱ yʲ (mm, coordonnées locales)</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:3px;max-height:230px;overflow:auto;padding-right:2px">${terms.map(([i, j]) => `<div><div class="hint">${lab(i, j)}</div><input class="in" style="width:100%" data-f="coef" data-k="${i},${j}" value="${fmt((x.xy || {})[i + ',' + j] || 0, 6)}"></div>`).join('')}</div>`;
  }
  if (x.type === 'ZERN') {
    return `<div class="row"><label>Rayon de normalisation (mm)</label><input class="in mini" data-f="coef" data-k="zr" value="${fmt(x.zr || 1, 6)}"></div>
      <div class="hint" style="margin:2px 0">z = conique + Σ cₖ Zₖ(x/R, y/R), Zernike Fringe, cₖ en mm</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px;max-height:230px;overflow:auto;padding-right:2px">${OE.ZN.map((nm, k) => `<div><div class="hint" title="${nm}">Z${k + 1} ${nm}</div><input class="in" style="width:100%" data-f="coef" data-k="z${k}" value="${fmt((x.zc || [])[k] || 0, 6)}"></div>`).join('')}</div>`;
  }
  return '';
}
const CATCOL = { SCHOTT: '#2563eb', OHARA: '#16a34a', CDGM: '#dc2626', HOYA: '#9333ea', SPECIAL: '#0891b2' };
const catCol = c => CATCOL[c] || '#ca8a04';
function rebuildGlassList() {
  let dl = $('#glassList'); if (!dl) { dl = document.createElement('datalist'); dl.id = 'glassList'; document.body.appendChild(dl); }
  dl.innerHTML = [...OE.catalog().filter(g => g.st !== 'o').map(g => `<option value="${esc(g.name)}">${g.cat} · nd ${g.nd.toFixed(4)} · νd ${g.vd.toFixed(1)}</option>`), '<option value="MIRROR">miroir</option>'].join('');
}
function usedUserGlasses(s) {
  const out = {}; for (const x of s.surfaces) { const r = OE.glassRecord(x.glass); if (r && r.user) out[r.key] = { name: r.name, cat: r.cat, f: r.f, c: r.c, lmin: r.lmin, lmax: r.lmax }; } return out;
}
function importAGF(name, text) {
  const cat = ((name || '').replace(/\.[^.]*$/, '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'USER').slice(0, 20);
  const recs = OE.parseAGF(text, cat); if (!recs.length) { toast('Aucun verre lisible dans ce fichier AGF'); return; }
  const n = OE.addGlasses(recs, true);
  try { const st = JSON.parse(localStorage.getItem('focale.agf') || '{}'); st[cat] = text; localStorage.setItem('focale.agf', JSON.stringify(st)); } catch (e) { }
  rebuildGlassList(); closeDlg(); refresh(); toast(`${n} verres importés dans le catalogue ${cat}`, 3500);
}
function loadStoredAGF() { try { const st = JSON.parse(localStorage.getItem('focale.agf') || '{}'); for (const [cat, t] of Object.entries(st)) OE.addGlasses(OE.parseAGF(t, cat), true); } catch (e) { } }
function openGlasses() {
  const cats = OE.cats();
  dlg(`<h2>Catalogue de verres <button class="x" data-d="close">✕</button></h2><div class="db">
    <div class="row"><input class="in" id="gq" style="flex:1" placeholder="Rechercher (nom, ex. BK7, LAH, FK…)"><select class="in" id="gc"><option value="">Tous les catalogues</option>${cats.map(c => `<option>${c}</option>`).join('')}</select>
      <label class="hint"><input type="checkbox" id="go"> obsolètes</label><button class="bt" data-d="agf">Importer un AGF…</button></div>
    <div class="hint" id="gn"></div>
    <div style="max-height:420px;overflow:auto;border:1px solid var(--line);border-radius:8px;margin-top:6px"><table class="mt" id="gt" style="font-size:12px"></table></div>
    <div class="hint" style="margin-top:6px">Cliquez sur un verre pour l'affecter à la surface ${App.sel} (milieu après la surface). Données : refractiveindex.info (CC0) d'après les catalogues fabricants ; les fichiers AGF importés (Zemax, formules 1–13) sont conservés dans ce navigateur.</div></div>`, true);
  const draw = () => {
    const q = $('#gq').value.trim().toUpperCase().replace(/[\s\-_]/g, ''), c = $('#gc').value, ob = $('#go').checked;
    const L = OE.catalog().filter(g => (!c || g.cat === c) && (ob || g.st !== 'o') && (!q || g.name.toUpperCase().replace(/[\s\-_]/g, '').includes(q)));
    $('#gn').textContent = `${L.length} verres`;
    $('#gt').innerHTML = `<tr><th>Nom</th><th>Catalogue</th><th>nd</th><th>νd</th><th>Domaine (µm)</th><th>Statut</th></tr>` + L.slice(0, 400).map(g => `<tr data-g="${esc(g.name)}" style="cursor:pointer"><td><b>${esc(g.name)}</b></td><td><span class="sw" style="background:${catCol(g.cat)}"></span> ${g.cat}</td><td style="font-family:var(--mono)">${g.nd.toFixed(5)}</td><td style="font-family:var(--mono)">${g.vd.toFixed(2)}</td><td style="font-family:var(--mono)">${g.lmin ?? '—'} – ${g.lmax ?? '—'}</td><td>${{ s: 'standard', p: 'préférentiel', o: 'obsolète', i: 'inquiry' }[g.st] || g.st}</td></tr>`).join('');
  };
  ['input', 'change'].forEach(ev => { $('#gq').addEventListener(ev, draw); $('#gc').addEventListener(ev, draw); $('#go').addEventListener(ev, draw); });
  $('#gt').addEventListener('click', e => { const tr = e.target.closest('[data-g]'); if (!tr) return; const j = App.sel, N = App.sys.surfaces.length - 1; if (j < 0 || j >= N) return toast('Sélectionnez une surface (pas l\'image)'); commit(s => s.surfaces[j].glass = tr.dataset.g); toast(`${tr.dataset.g} → surface ${j}`); });
  draw(); $('#gq').focus();
}
function elemEditor(x, j, N) {
  const e = x.elem, inp = (k, l, u, v) => `<div class="row"><label>${l}${u ? ' <span style="opacity:.7">(' + u + ')</span>' : ''}</label><input class="in mini" data-f="ep" data-k="${k}" value="${fmt(v, 7)}"></div>`;
  const head = t => `<div class="hint" style="margin:2px 0 4px;font-weight:600;color:var(--fg)">${t}</div>`;
  let h = '';
  if (e === 'grating') {
    h = head(OE.isMirror(x) ? 'Réseau en réflexion' : 'Réseau en transmission') + inp('lpmm', 'Traits par mm', '', x.lpmm ?? 600) + inp('gm', 'Ordre', 'm', x.gm ?? 1) + inp('gang', 'Orientation des traits', '°', x.gang || 0)
      + `<div class="hint">0° : traits parallèles à X local, dispersion selon Y. Équation : n′ sin θ′ = n sin θ + m λ / d.</div>`
      + (j + 1 < N && !OE.isMirror(x) ? '<div class="chips"><button class="chip" data-a="galign">Aligner la suite sur l\'ordre m (λ primaire)</button></div>' : '');
  } else if (e === 'ideal') {
    h = head('Lentille idéale (mince, parfaitement stigmatique)') + inp('fid', 'Focale', 'mm', x.fid ?? 100) + '<div class="hint">Le rayon de courbure et la forme sont ignorés. Imagerie parfaite pour un objet à l\'infini.</div>';
  } else if (e === 'polarizer') {
    h = head('Polariseur linéaire idéal') + inp('pang', 'Axe de transmission', '° / X local', x.pang || 0) + '<div class="hint">Ne transmet que la composante du champ selon l\'axe (loi de Malus). Utilisez l\'analyse « Polarisation ».</div>';
  } else if (e === 'waveplate') {
    h = head('Lame d\'onde (retardateur idéal)') + inp('ret', 'Retard', 'λ', x.ret ?? 0.25) + inp('wang', 'Axe rapide', '° / X local', x.wang ?? 45)
      + '<div class="chips"><button class="chip" data-a="ret4">λ/4</button><button class="chip" data-a="ret2">λ/2</button></div>';
  }
  return h ? h + '<div style="border-top:1px solid var(--line);margin:8px 0 6px"></div>' : '';
}
const FIBPRE = {
  smf28: ['SMF-28 · 1550 nm', { fib: 'sm', core: 8.2, clad: 125, na: 0.14, mfd: 10.4, lc0: 1550, att: 0.18, bw: null }],
  sm630: ['Monomode 630 nm', { fib: 'sm', core: 3.5, clad: 125, na: 0.12, mfd: 4.2, lc0: 633, att: 10, bw: null }],
  om3: ['GI 50/125 OM3 · 850 nm', { fib: 'gi', core: 50, clad: 125, na: 0.2, mfd: null, lc0: 850, att: 2.5, bw: 2000 }],
  om1: ['GI 62,5/125 OM1', { fib: 'gi', core: 62.5, clad: 125, na: 0.275, mfd: null, lc0: 850, att: 3.5, bw: 200 }],
  si105: ['SI 105/125 ON 0,22', { fib: 'si', core: 105, clad: 125, na: 0.22, mfd: null, att: null, bw: null }],
  si200: ['SI 200/220 ON 0,22', { fib: 'si', core: 200, clad: 220, na: 0.22, mfd: null, att: null, bw: null }],
  si400: ['SI 400/440 ON 0,39', { fib: 'si', core: 400, clad: 440, na: 0.39, mfd: null, att: null, bw: null }],
};
const SRCT = [['none', 'Points de champ (aucune source)'], ['fiber', 'Fibre optique'], ['disk', 'Disque uniforme'], ['gauss', 'Tache gaussienne'], ['rect', 'Fente / rectangle'], ['point', 'Point source']];
const src = () => App.sys.src || { type: 'none' };
function srcCard() {
  const S = src(), M = App.M, inf = M && M.ok && M.objInf, u = inf ? '″' : 'µm';
  const inp = (k, l, un, ph = '') => `<div><div class="hint">${l}${un ? ' <span style="opacity:.7">' + un + '</span>' : ''}</div><input class="in" style="width:100%" data-f="src" data-k="${k}" value="${S[k] == null ? '' : fmt(S[k], 6)}" placeholder="${ph}"></div>`;
  let h = `<div class="row"><select class="in" style="flex:1" data-f="src" data-k="type">${SRCT.map(([k, l]) => `<option value="${k}" ${S.type === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>`;
  if (S.type === 'fiber') {
    if (inf) h += '<div class="hint" style="color:var(--warn)">Une fibre se place à distance finie : donnez une épaisseur finie à la surface objet (distance fibre → 1ʳᵉ surface).</div>';
    h += `<div class="row"><select class="in" style="flex:1" data-f="src" data-k="fib"><option value="si" ${S.fib === 'si' ? 'selected' : ''}>Multimode à saut d'indice</option><option value="gi" ${S.fib === 'gi' ? 'selected' : ''}>Multimode à gradient d'indice</option><option value="sm" ${S.fib === 'sm' ? 'selected' : ''}>Monomode</option></select></div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px">${inp('core', 'Ø cœur', 'µm')}${inp('clad', 'Ø gaine', 'µm')}${inp('na', 'ON', '')}${S.fib === 'sm' ? inp('mfd', 'MFD', 'µm', 'calculé') : ''}${inp('lc0', 'λ centrale', 'nm', 'système')}${inp('dl', 'Largeur Δλ', 'nm', '0')}</div>
      <div class="hint" style="margin:6px 0 2px;font-weight:600;color:var(--fg)">Lien fibré (optionnel)</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px">${inp('len', 'Longueur', 'm', '—')}${inp('att', 'Atténuation', 'dB/km', '—')}${inp('bw', 'Bande passante modale', 'MHz·km', '—')}</div>
      <div class="chips">${Object.entries(FIBPRE).map(([k, v]) => `<button class="chip" data-a="fibpre" data-v="${k}">${v[0]}</button>`).join('')}</div>`;
    const l = (S.lc0 > 0 ? S.lc0 / 1000 : M && M.ok ? M.wls[M.pw] : 0.55), fi = OE.fiberInfo(S, l);
    const rows = [['à λ', `${fmt(l * 1000, 5)} nm`], ['Fréquence normalisée V', fx(fi.V, 3)], ['Longueur d\'onde de coupure', `${fx(fi.lc * 1000, 0)} nm`], ['Régime', fi.single ? 'monomode' : `multimode (~${fi.modes} modes)`]];
    if (S.fib === 'sm' || fi.single) rows.push(['Diamètre de mode', `${fx(fi.mfd, 2)} µm${S.fib === 'sm' && +S.mfd > 0 ? ' (imposé)' : ' (Marcuse)'}`]);
    if (S.fib === 'sm' && !fi.single) rows.push(['Attention', 'V > 2,405 : multimode à cette λ']);
    rows.push(['Étendue', `${fx(fi.etendue * 1e-6, 6)} mm²·sr`]);
    if (M && M.ok && !inf) rows.push(['ON objet du système', fx(M.par.objNA, 4)]);
    if (S.len > 0 && S.att > 0) rows.push(['Transmission de la fibre', `${fx(100 * Math.pow(10, -S.att * S.len / 1e4), 2)} % (${fx(S.att * S.len / 1000, 3)} dB)`]);
    if (S.len > 0 && S.bw > 0) rows.push(['Bande passante du lien', `≈ ${fx(S.bw / (S.len / 1000), 0)} MHz`]);
    h += `<div class="kv" style="margin-top:6px">${rows.map(([a, b]) => `<span>${a}</span><span>${b}</span>`).join('')}</div>`;
  } else if (S.type === 'disk') h += `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px">${inp('d', 'Diamètre', u)}${inf ? '' : inp('na', 'ON d\'émission', '', '∞')}${inp('lc0', 'λ centrale', 'nm', 'système')}${inp('dl', 'Δλ', 'nm', '0')}</div>`;
  else if (S.type === 'gauss') h += `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px">${inp('d', 'Ø à 1/e²', u)}${inp('lc0', 'λ centrale', 'nm', 'système')}${inp('dl', 'Δλ', 'nm', '0')}</div>`;
  else if (S.type === 'rect') h += `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px">${inp('w', 'Largeur', u)}${inp('h', 'Hauteur', u)}${inp('lc0', 'λ centrale', 'nm', 'système')}${inp('dl', 'Δλ', 'nm', '0')}</div>`;
  else if (S.type === 'point') h += `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px">${inp('lc0', 'λ centrale', 'nm', 'système')}${inp('dl', 'Δλ', 'nm', '0')}</div>`;
  else h += '<div class="hint">Choisissez une source réelle (fibre, fente…) pour l\'analyse « Source étendue ».</div>';
  if (S.type !== 'none') h += '<div class="hint" style="margin-top:4px">λ centrale vide : longueurs d\'onde du système. Δλ > 0 : spectre gaussien échantillonné sur 5 λ. Résultats dans l\'analyse « Source étendue ».</div>';
  return card('src', 'Source / fibre', h);
}
/** système dont les longueurs d'onde sont celles du spectre de la source */
function srcModel() {
  const S = src(); if (!(S.lc0 > 0) || S.type === 'none') return App.M;
  const key = toJSON(App.sys); if (App._srcM && App._srcM.key === key) return App._srcM.M;
  const c = S.lc0 / 1000, d = (+S.dl || 0) / 1000, sys = structuredClone(App.sys);
  if (d > 0) { const ks = [-1, -0.5, 0, 0.5, 1]; sys.wavelengths = ks.map(k => ({ um: c + k * d, w: Math.exp(-4 * Math.LN2 * k * k) })); sys.primary = 2; }
  else { sys.wavelengths = [{ um: c, w: 1 }]; sys.primary = 0; }
  const M = OE.prepare(sys); App._srcM = { key, M }; return M;
}
const DETPRE = { imx250: ['CMOS 3,45 µm 2448×2048', 3.45, 2448, 2048, 10000, 3, 12], scmos: ['sCMOS 6,5 µm 2048×2048', 6.5, 2048, 2048, 30000, 1.6, 16], ccd: ['CCD 13 µm 1024×1024', 13, 1024, 1024, 100000, 5, 16], ingaas: ['InGaAs 15 µm 640×512', 15, 640, 512, 1000000, 100, 14], phone: ['Smartphone 1 µm 4000×3000', 1, 4000, 3000, 6000, 2, 10] };
const det = () => App.sys.det || {};
function detCard() {
  const d = det(), M = App.M;
  if (!d.on) return card('det', 'Détecteur', `<div class="row"><label>Ajouter un détecteur au plan image</label><input type="checkbox" data-f="det" data-k="on"></div><div class="hint">Pour comparer PSF, spot, footprint et image simulée à la taille des pixels.</div>`);
  const inp = (k, l, u) => `<div><div class="hint">${l}${u ? ' <span style="opacity:.7">' + u + '</span>' : ''}</div><input class="in" style="width:100%" data-f="det" data-k="${k}" value="${fmt(d[k], 6)}"></div>`;
  let info = '';
  if (M && M.ok) {
    const pmm = d.p * 1e-3, lF = M.ctxs[M.pw].lmm * M.par.wfno;
    info = `<div class="kv" style="margin-top:6px"><span>Capteur</span><span>${fx(d.nx * d.p * 1e-3, 2)} × ${fx(d.ny * d.p * 1e-3, 2)} mm</span><span>Nyquist</span><span>${fx(1 / (2 * pmm), 1)} cy/mm</span><span>Coupure optique</span><span>${fx(1 / lF, 1)} cy/mm</span><span>Q = λF/p</span><span>${fx(lF / pmm, 2)}</span><span>Ø Airy</span><span>${fx(2.44 * lF / pmm, 2)} px</span></div>`;
  }
  return card('det', 'Détecteur', `<div class="row"><label>Détecteur actif</label><input type="checkbox" data-f="det" data-k="on" checked></div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px">${inp('p', 'Pas', 'µm')}${inp('nx', 'Pixels X', '')}${inp('ny', 'Pixels Y', '')}${inp('ff', 'Remplissage', '%')}${inp('bits', 'Bits', '')}${inp('fw', 'Puits', 'e⁻')}${inp('rn', 'Bruit lecture', 'e⁻')}${inp('lvl', 'Signal', '% puits')}</div>
    <div class="row"><label>Bruit dans la simulation d'image</label><input type="checkbox" data-f="det" data-k="noise" ${d.noise ? 'checked' : ''}></div>
    <div class="chips">${Object.entries(DETPRE).map(([k, v]) => `<button class="chip" data-a="detpre" data-v="${k}">${v[0]}</button>`).join('')}</div>${info}`);
}
function inspector() {
  const s = App.sys, j = App.sel, x = s.surfaces[j]; if (!x) return '';
  const N = s.surfaces.length - 1;
  if (j === 0) return card('surf', 'Surface 0 — objet', '<div class="hint">Sélectionnez une surface pour voir ses propriétés.</div>');
  const ty = x.type || 'STD';
  const inp = (k, lbl, unit) => `<div><div class="hint">${lbl}${unit ? ' <span style="opacity:.7">' + unit + '</span>' : ''}</div><input class="in" style="width:100%" data-f="dec" data-k="${k}" value="${fmt(x[k] || 0, 6)}"></div>`;
  let h = `<div class="row"><label>Forme</label><select class="in" data-f="stype" style="width:150px">
      <option value="STD" ${ty === 'STD' ? 'selected' : ''}>Standard (conique + asphère)</option>
      <option value="XY" ${ty === 'XY' ? 'selected' : ''}>Polynôme XY</option>
      <option value="ZERN" ${ty === 'ZERN' ? 'selected' : ''}>Zernike (Fringe)</option></select></div>`;
  h = elemEditor(x, j, N) + h;
  if (typeof freeformEditor === 'function') h += freeformEditor(x);
  h += `<div class="hint" style="margin:8px 0 2px;font-weight:600;color:var(--fg)">Décentrement / bascule</div>
    <div class="row"><select class="in" style="flex:1" data-f="dmode">
      <option value="DEC" ${x.dmode !== 'DAR' && x.dmode !== 'BEN' ? 'selected' : ''}>Décentrement simple — la suite suit</option>
      <option value="DAR" ${x.dmode === 'DAR' ? 'selected' : ''}>Décentrement et retour (DAR)</option>
      <option value="BEN" ${x.dmode === 'BEN' ? 'selected' : ''}>Pliage miroir (BEN)</option></select></div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px">${inp('dx', 'X', 'mm')}${inp('dy', 'Y', 'mm')}${inp('dz', 'Z', 'mm')}${inp('tx', 'α (X)', '°')}${inp('ty', 'β (Y)', '°')}${inp('tz', 'γ (Z)', '°')}</div>
    <div class="chips">${j < N ? '<button class="chip" data-a="fold45">Miroir de renvoi 45°</button>' : ''}<button class="chip" data-a="dreset">Remettre à zéro</button></div>
    <div class="hint" style="margin-top:4px">Décentrement puis rotations α, β, γ (main droite). Les données paraxiales ignorent décentrements et bascules.</div>`;
  return card('surf', `Surface ${j}${x.comment ? ' — ' + esc(x.comment) : ''}`, h);
}
function setupSide() {
  const side = $('#side');
  side.addEventListener('click', e => {
    const h3 = e.target.closest('h3'); if (h3) { const c = h3.parentElement; c.classList.toggle('closed'); c.classList.contains('closed') ? closedCards.add(c.dataset.card) : closedCards.delete(c.dataset.card); return; }
    const b = e.target.closest('[data-a]'); if (!b) return; const i = +b.dataset.i;
    switch (b.dataset.a) {
      case 'fadd': commit(s => { const m = Math.max(...s.fields.map(f => f.y)); s.fields.push({ x: 0, y: +(m * 1.2 || 1).toFixed(4), w: 1 }); }); break;
      case 'fdel': if (App.sys.fields.length > 1) commit(s => s.fields.splice(i, 1)); break;
      case 'fspread': commit(s => { const m = Math.max(...s.fields.map(f => Math.hypot(f.x || 0, f.y))) || 1; s.fields = [0, 0.7, 1].map(k => ({ x: 0, y: +(m * k).toPrecision(6), w: 1 })); }); break;
      case 'fold45': commit(s => { const x = s.surfaces[App.sel]; x.glass = 'MIRROR'; x.r = Infinity; x.tx = 45; x.ty = 0; x.tz = 0; x.dx = x.dy = x.dz = 0; x.dmode = 'BEN'; }); toast('Miroir de renvoi à 45° : pensez au signe de l\'épaisseur suivante'); break;
      case 'fibpre': { const q = FIBPRE[b.dataset.v]; commit(s => Object.assign(s.src, { type: 'fiber', lc0: null, dl: null, len: null }, q[1])); toast('Fibre : ' + q[0]); break; }
      case 'detpre': { const q = DETPRE[b.dataset.v]; commit(s => Object.assign(s.det, { on: true, p: q[1], nx: q[2], ny: q[3], fw: q[4], rn: q[5], bits: q[6] })); toast(q[0]); break; }
      case 'ret4': commit(s => s.surfaces[App.sel].ret = 0.25); break;
      case 'ret2': commit(s => s.surfaces[App.sel].ret = 0.5); break;
      case 'galign': {
        const x = App.sys.surfaces[App.sel], M = App.M, l = M && M.ok ? M.wls[M.pw] : 0.55, sn = (x.gm ?? 1) * l * 1e-3 * (x.lpmm || 600);
        if (Math.abs(sn) >= 1) { toast('Ordre évanescent à cette longueur d\'onde'); break; }
        const a = Math.asin(sn) * 180 / Math.PI, ga = (x.gang || 0) * Math.PI / 180;
        const j = App.sel;
        commit(s => { const g = s.surfaces[j]; s.surfaces.splice(j + 1, 0, newSurf({ t: g.t, tx: +(-a * Math.cos(ga)).toFixed(5), ty: +(-a * Math.sin(ga)).toFixed(5), dmode: 'DEC', comment: `Axe de l'ordre ${g.gm ?? 1}` })); g.t = 0; });
        toast(`Surface d'axe insérée : la suite est basculée de ${a.toFixed(3)}° pour suivre l'ordre ${x.gm ?? 1}`); break;
      }
      case 'dreset': commit(s => { const x = s.surfaces[App.sel]; x.dx = x.dy = x.dz = x.tx = x.ty = x.tz = 0; x.dmode = 'DEC'; }); break;
      case 'wadd': commit(s => s.wavelengths.push({ um: 0.55, w: 1 })); break;
      case 'wdel': if (App.sys.wavelengths.length > 1) commit(s => { s.wavelengths.splice(i, 1); s.primary = Math.min(s.primary, s.wavelengths.length - 1); }); break;
      case 'wpre': {
        const P = { FdC: [[0.4861327, 1], [0.5875618, 1], [0.6562725, 1], 1], vis: [[0.45, 1], [0.55, 1], [0.65, 1], 1], hene: [[0.6328, 1], 0], nir: [[0.78, 1], [0.85, 1], [0.94, 1], 1], d: [[0.5875618, 1], 0] }[b.dataset.v];
        commit(s => { s.primary = P.pop(); s.wavelengths = P.map(([um, w]) => ({ um, w })); }); break;
      }
    }
  });
  side.addEventListener('change', e => {
    const t = e.target, f = t.dataset.f; if (!f) return; const i = +t.dataset.i;
    const num = (allow) => { const v = parseNum(t.value, false); if (!isFinite(v) || (allow && !allow(v))) { toast('Valeur invalide'); renderSide(); return null; } return v; };
    let v;
    switch (f) {
      case 'title': commit(s => s.title = t.value); break;
      case 'apType': commit(s => s.aperture.type = t.value); break;
      case 'apVal': if ((v = num(x => x > 0)) != null) commit(s => s.aperture.value = v); break;
      case 'obs': if ((v = num(x => x >= 0 && x < 0.95)) != null) commit(s => s.aperture.obscuration = v); break;
      case 'aim': commit(s => s.rayAiming = t.checked); break;
      case 'fy': if ((v = num()) != null) commit(s => s.fields[i].y = v); break;
      case 'fx': if ((v = num()) != null) commit(s => s.fields[i].x = v); break;
      case 'dmode': commit(s => s.surfaces[App.sel].dmode = t.value); break;
      case 'stype': commit(s => { const x = s.surfaces[App.sel]; x.type = t.value; if (t.value === 'ZERN' && !x.zr) x.zr = Math.max(1, App.M && App.M.ok ? +App.M.S[App.sel].sd.toPrecision(3) : 10); }); break;
      case 'dec': if ((v = num()) != null) commit(s => s.surfaces[App.sel][t.dataset.k] = v); break;
      case 'src': { const k = t.dataset.k; if (k === 'type' || k === 'fib') { commit(s => { s.src[k] = t.value; if (k === 'fib' && t.value === 'sm' && s.src.core > 12) Object.assign(s.src, { core: 8.2, na: 0.14 }); }); break; }
        if (t.value.trim() === '') { commit(s => s.src[k] = null); break; } if ((v = num(x => x > 0)) != null) commit(s => s.src[k] = v); break; }
      case 'det': { const k = t.dataset.k; if (k === 'on' || k === 'noise') { commit(s => s.det[k] = t.checked); break; } if ((v = num(x => x > 0)) != null) commit(s => s.det[k] = ['nx', 'ny', 'bits'].includes(k) ? Math.round(v) : v); break; }
      case 'ep': if ((v = num()) != null) { if (t.dataset.k === 'fid' && v === 0) { toast('Focale non nulle requise'); renderSide(); break; } commit(s => s.surfaces[App.sel][t.dataset.k] = v); } break;
      case 'coef': { const k = t.dataset.k; v = t.value.trim() === '' ? 0 : parseNum(t.value, false); if (!isFinite(v)) { toast('Valeur invalide'); renderSide(); break; }
        commit(s => { const x = s.surfaces[App.sel]; if (k === 'zr') x.zr = v; else if (k.startsWith('z')) { x.zc = x.zc || []; x.zc[+k.slice(1)] = v; } else { x.xy = x.xy || {}; if (v) x.xy[k] = v; else delete x.xy[k]; } }); break; }
      case 'fw': if ((v = num(x => x >= 0)) != null) commit(s => s.fields[i].w = v); break;
      case 'wum': if ((v = num(x => x > 0.15 && x < 25)) != null) commit(s => s.wavelengths[i].um = v); break;
      case 'ww': if ((v = num(x => x >= 0)) != null) commit(s => s.wavelengths[i].w = v); break;
      case 'wp': commit(s => s.primary = i); break;
    }
  });
}

/* ---------------- Outils de tracé ---------------- */
let TH = {};
function readTheme() { const g = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim(); TH = { fg: g('--fg'), mut: g('--mut'), line: g('--line'), grid: g('--grid'), acc: g('--acc'), panel: g('--panel'), lens: g('--lens'), lensE: g('--lensE'), bg: g('--bg') }; }
function prepCanvas(cv) {
  const p = cv.parentElement, w = Math.max(10, p.clientWidth), h = Math.max(10, p.clientHeight), d = window.devicePixelRatio || 1;
  if (cv.width !== Math.round(w * d) || cv.height !== Math.round(h * d)) { cv.width = Math.round(w * d); cv.height = Math.round(h * d); }
  cv.style.width = w + 'px'; cv.style.height = h + 'px';
  const c = cv.getContext('2d'); c.setTransform(d, 0, 0, d, 0, 0); c.clearRect(0, 0, w, h);
  return { c, w, h };
}
function niceStep(r, n) { const raw = r / n, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p; return (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p; }
function ticks(a, b, n = 5) { if (!(b > a)) b = a + 1; const s = niceStep(b - a, n), out = []; for (let v = Math.ceil(a / s - 1e-9) * s; v <= b + s * 1e-9; v += s) out.push(Math.abs(v) < s * 1e-9 ? 0 : v); return { t: out, s }; }
function tl(v, s) { const d = Math.max(0, -Math.floor(Math.log10(s) + 1e-9)); return Math.abs(v) >= 1e5 ? v.toExponential(1) : v.toFixed(Math.min(d, 6)); }
function range(arrs, pad = 0.05, sym = false) {
  let a = Infinity, b = -Infinity;
  for (const arr of arrs) for (const v of arr) if (isFinite(v)) { if (v < a) a = v; if (v > b) b = v; }
  if (!isFinite(a)) { a = -1; b = 1; }
  if (sym) { const m = Math.max(Math.abs(a), Math.abs(b)) || 1e-9; a = -m; b = m; }
  if (b - a < 1e-12) { const m = Math.abs(a) || 1; a -= m * 0.1 + 1e-9; b += m * 0.1 + 1e-9; }
  const p = (b - a) * pad; return [a - p, b + p];
}
function axes(c, R, xr, yr, o = {}) {
  const ml = o.ml ?? 50, mb = o.mb ?? (o.xl ? 32 : 20), mt = o.title ? 20 : 8, mr = o.mr ?? 10;
  const P = { x: R.x + ml, y: R.y + mt, w: Math.max(10, R.w - ml - mr), h: Math.max(10, R.h - mt - mb) };
  if (o.equal) {
    const sx = P.w / (xr[1] - xr[0]), sy = P.h / (yr[1] - yr[0]), s = Math.min(sx, sy);
    const cx = (xr[0] + xr[1]) / 2, cy = (yr[0] + yr[1]) / 2;
    xr = [cx - P.w / s / 2, cx + P.w / s / 2]; yr = [cy - P.h / s / 2, cy + P.h / s / 2];
  }
  const X = v => P.x + (v - xr[0]) / (xr[1] - xr[0]) * P.w, Y = v => P.y + P.h - (v - yr[0]) / (yr[1] - yr[0]) * P.h;
  c.save(); c.font = '10.5px Inter, sans-serif'; c.lineWidth = 1;
  const tx = ticks(Math.min(xr[0], xr[1]), Math.max(xr[0], xr[1]), Math.max(2, Math.floor(P.w / 70))), ty = ticks(Math.min(yr[0], yr[1]), Math.max(yr[0], yr[1]), Math.max(2, Math.floor(P.h / 38)));
  c.strokeStyle = TH.grid; c.beginPath();
  for (const v of tx.t) { const x = Math.round(X(v)) + 0.5; c.moveTo(x, P.y); c.lineTo(x, P.y + P.h); }
  for (const v of ty.t) { const y = Math.round(Y(v)) + 0.5; c.moveTo(P.x, y); c.lineTo(P.x + P.w, y); }
  c.stroke();
  if (o.zero !== false) { c.strokeStyle = TH.line; c.beginPath(); if (xr[0] < 0 && xr[1] > 0) { const x = Math.round(X(0)) + .5; c.moveTo(x, P.y); c.lineTo(x, P.y + P.h); } if (yr[0] < 0 && yr[1] > 0) { const y = Math.round(Y(0)) + .5; c.moveTo(P.x, y); c.lineTo(P.x + P.w, y); } c.stroke(); }
  c.strokeStyle = TH.line; c.strokeRect(P.x + .5, P.y + .5, P.w, P.h);
  c.fillStyle = TH.mut; c.textAlign = 'center'; c.textBaseline = 'top';
  if (!o.noX) for (const v of tx.t) c.fillText(tl(v, tx.s), X(v), P.y + P.h + 4);
  c.textAlign = 'right'; c.textBaseline = 'middle';
  for (const v of ty.t) c.fillText(tl(v, ty.s), P.x - 4, Y(v));
  if (o.xl) { c.textAlign = 'center'; c.textBaseline = 'bottom'; c.fillText(o.xl, P.x + P.w / 2, R.y + R.h - 1); }
  if (o.yl) { c.save(); c.translate(R.x + 9, P.y + P.h / 2); c.rotate(-Math.PI / 2); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(o.yl, 0, 0); c.restore(); }
  if (o.title) { c.fillStyle = TH.fg; c.font = '600 11px Inter, sans-serif'; c.textAlign = 'left'; c.textBaseline = 'top'; c.fillText(o.title, P.x, R.y + 4); }
  c.restore();
  return { X, Y, P, xr, yr };
}
function clip(c, P) { c.save(); c.beginPath(); c.rect(P.x, P.y, P.w, P.h); c.clip(); }
function pline(c, A, xs, ys, col, w = 1.6, dash) {
  clip(c, A.P); c.strokeStyle = col; c.lineWidth = w; c.setLineDash(dash || []); c.beginPath(); let pen = false;
  for (let i = 0; i < xs.length; i++) { if (!isFinite(xs[i]) || !isFinite(ys[i])) { pen = false; continue; } const x = A.X(xs[i]), y = A.Y(ys[i]); pen ? c.lineTo(x, y) : c.moveTo(x, y); pen = true; }
  c.stroke(); c.restore();
}
function legend(c, x, y, items) {
  c.save(); c.font = '10.5px Inter, sans-serif'; c.textBaseline = 'middle';
  let cx = x;
  for (const it of items) { c.strokeStyle = it.col; c.fillStyle = it.col; c.lineWidth = 2; c.setLineDash(it.dash || []); c.beginPath(); c.moveTo(cx, y); c.lineTo(cx + 14, y); c.stroke(); c.setLineDash([]); c.fillStyle = TH.mut; c.fillText(it.l, cx + 18, y); cx += 24 + c.measureText(it.l).width + 6; }
  c.restore();
}
function text(c, s, x, y, o = {}) { c.save(); c.font = (o.b ? '600 ' : '') + (o.size || 11) + 'px ' + (o.mono ? 'JetBrains Mono, monospace' : 'Inter, sans-serif'); c.fillStyle = o.col || TH.fg; c.textAlign = o.align || 'left'; c.textBaseline = o.base || 'top'; c.fillText(s, x, y); c.restore(); }
const CMAPS = {
  div: ['#1d3b8f', '#3f6fc4', '#8fb4e3', '#f5f5f4', '#f0a58d', '#d4553b', '#8c1a1a'],
  inferno: ['#000004', '#1b0c41', '#4a0c6b', '#781c6d', '#a52c60', '#cf4446', '#ed6925', '#fb9b06', '#f7d13d', '#fcffa4'],
  vir: ['#440154', '#46327e', '#365c8d', '#277f8e', '#1fa187', '#4ac16d', '#a0da39', '#fde725'],
};
const LUT = {};
function lut(name) {
  if (LUT[name]) return LUT[name];
  const st = CMAPS[name].map(h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
  const L = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) { const t = i / 255 * (st.length - 1), k = Math.min(st.length - 2, Math.floor(t)), f = t - k; for (let ch = 0; ch < 3; ch++) L[i * 3 + ch] = st[k][ch] * (1 - f) + st[k + 1][ch] * f; }
  return (LUT[name] = L);
}
function heat(c, A, data, nx, ny, vmin, vmax, cm, smooth) {
  const L = lut(cm), off = document.createElement('canvas'); off.width = nx; off.height = ny;
  const oc = off.getContext('2d'), im = oc.createImageData(nx, ny);
  for (let iy = 0; iy < ny; iy++) for (let ix = 0; ix < nx; ix++) {
    const v = data[iy * nx + ix], o = ((ny - 1 - iy) * nx + ix) * 4;
    if (!isFinite(v)) { im.data[o + 3] = 0; continue; }
    const k = Math.max(0, Math.min(255, Math.round((v - vmin) / (vmax - vmin || 1) * 255)));
    im.data[o] = L[k * 3]; im.data[o + 1] = L[k * 3 + 1]; im.data[o + 2] = L[k * 3 + 2]; im.data[o + 3] = 255;
  }
  oc.putImageData(im, 0, 0);
  c.save(); c.imageSmoothingEnabled = !!smooth;
  const x0 = A.X(A.xr0 ?? A.xr[0]), x1 = A.X(A.xr1 ?? A.xr[1]), y0 = A.Y(A.yr1 ?? A.yr[1]), y1 = A.Y(A.yr0 ?? A.yr[0]);
  c.drawImage(off, x0, y0, x1 - x0, y1 - y0); c.restore();
}
function cbar(c, x, y, w, h, vmin, vmax, cm, lbl) {
  const L = lut(cm);
  for (let i = 0; i < h; i++) { const k = Math.round((1 - i / h) * 255); c.fillStyle = `rgb(${L[k * 3]},${L[k * 3 + 1]},${L[k * 3 + 2]})`; c.fillRect(x, y + i, w, 1.5); }
  c.strokeStyle = TH.line; c.strokeRect(x + .5, y + .5, w, h);
  const t = ticks(vmin, vmax, 5);
  c.save(); c.font = '10px Inter, sans-serif'; c.fillStyle = TH.mut; c.textBaseline = 'middle';
  for (const v of t.t) { const yy = y + h - (v - vmin) / (vmax - vmin) * h; c.fillText(tl(v, t.s), x + w + 4, yy); }
  if (lbl) { c.textBaseline = 'bottom'; c.fillText(lbl, x - 2, y - 3); }
  c.restore();
}
function subgrid(n, w, h) { let best = null; for (let cols = 1; cols <= n; cols++) { const rows = Math.ceil(n / cols), s = Math.min(w / cols, h / rows); if (!best || s > best.s) best = { cols, rows, s }; } return best; }

/* ---------------- Layout 2D / 3D ---------------- */
function layoutGeom(M) {
  if (M.geom) return M.geom;
  const S = M.S, N = M.N, surfs = [], G3 = (j, p) => OE.toGlobal(M.fr[j], p);
  let zmin = Infinity, zmax = -Infinity, ymin = Infinity, ymax = -Infinity, xa = 0;
  for (let j = 1; j <= N; j++) {
    const sf = M.ctxs[M.pw].s[j], sd = S[j].sd || 1, pts = [], p3 = [];
    const sz = (x, y) => { const z = OE.sag(sf, x, y); return isFinite(z) ? z : 0; };
    for (let k = 0; k <= 40; k++) { const y = -sd + 2 * sd * k / 40, g = G3(j, [0, y, sz(0, y)]); p3.push(g); pts.push([g[2], g[1]]); }
    for (const q of p3) { zmin = Math.min(zmin, q[2]); zmax = Math.max(zmax, q[2]); ymin = Math.min(ymin, q[1]); ymax = Math.max(ymax, q[1]); xa = Math.max(xa, Math.abs(q[0])); }
    surfs.push({ j, pts, sd, sf, e: sz(0, sd), em: sz(0, -sd), sz });
  }
  const span = Math.max(zmax - zmin, ymax - ymin, 1e-3);
  const fin = !M.objInf && M.t0 < 4 * span && M.t0 > 0;
  const lead = fin ? M.t0 : 0.18 * span;
  if (fin) zmin = Math.min(zmin, -M.t0) - (src().type === 'fiber' ? 0.14 * span : 0.02 * span); else zmin -= lead;
  M.geom = { surfs, zmin, zmax, ymin: Math.min(ymin, -1e-3), ymax: Math.max(ymax, 1e-3), span, lead, fin, G3 };
  return M.geom;
}
function layoutRays(M, n, three) {
  const out = [], S = M.sys, G = layoutGeom(M);
  S.fields.forEach((f, fi) => {
    const fans = three ? [[0, 1], [1, 0]] : [[0, 1]];
    for (const [ax, ay] of fans) for (let k = 0; k < n; k++) {
      const p = n === 1 ? 0 : -1 + 2 * k / (n - 1);
      if (Math.abs(p) < M.obs - 1e-9) continue;
      const pts = []; const r = OE.ray(M, M.pw, f, p * ax, p * ay, { pts });
      if (!pts.length) continue;
      let p0;
      if (M.objInf) { const d = OE.fieldDir(f), q = pts[0], L = G.lead + (q[2] - M.zg[1]); p0 = [q[0] - d[0] * L, q[1] - d[1] * L, q[2] - d[2] * L]; }
      else if (G.fin) p0 = [f.x || 0, f.y, -M.t0];
      else { const q = pts[0], o = [f.x || 0, f.y, -M.t0]; let d = [q[0] - o[0], q[1] - o[1], q[2] - o[2]]; const dn = Math.hypot(...d); d = d.map(v => v / dn); p0 = [q[0] - d[0] * G.lead, q[1] - d[1] * G.lead, q[2] - d[2] * G.lead]; }
      out.push({ fi, pts: [p0, ...pts], vig: r.vig });
    }
  });
  return out;
}
function drawLayout() {
  readTheme();
  const cv = $('#lay'), { c, w, h } = prepCanvas(cv), M = App.M;
  $('#legend').innerHTML = App.sys.fields.map((f, i) => `<span><span class="sw" style="background:${fcol(i)}"></span> ${f.x ? '(' + fmt(f.x, 4) + ', ' + fmt(f.y, 4) + ')' : fmt(f.y, 4)}${M && M.objInf ? '°' : ' mm'}</span>`).join('');
  $$('#laySeg button').forEach(x => x.classList.toggle('on', x.dataset.m === App.mode));
  if (!M || !M.ok) { text(c, (M && M.errors || ['Erreur']).join('  ·  '), 14, 14, { col: '#dc2626' }); return; }
  const G = layoutGeom(M);
  if (App.mode === '3d') return draw3D(c, w, h, M, G);
  const V = App.view;
  if (V.auto) { const zr = G.zmax - G.zmin, yr = (G.ymax - G.ymin) * 1.15; V.s = Math.min((w - 40) / (zr || 1), (h - 30) / (yr || 1)); V.ox = 20 - G.zmin * V.s + ((w - 40) - zr * V.s) / 2; V.oy = h / 2 + (G.ymax + G.ymin) / 2 * V.s; }
  const T = (z, y) => [V.ox + z * V.s, V.oy - y * V.s];
  App.layT = T;
  // axe
  c.strokeStyle = TH.line; c.setLineDash([6, 4]); c.beginPath(); c.moveTo(0, V.oy); c.lineTo(w, V.oy); c.stroke(); c.setLineDash([]);
  const S = M.S, N = M.N;
  // lentilles
  for (let j = 1; j < N; j++) {
    if (OE.isAir(S[j].glass) || OE.isMirror(S[j])) continue;
    const a = G.surfs[j - 1], b = G.surfs[j], H = Math.max(a.sd, b.sd), P2 = (k, q) => { const g = G.G3(k, q); return [g[2], g[1]]; };
    const poly = [P2(j, [0, H, a.e]), ...a.pts.slice().reverse(), P2(j, [0, -H, a.em]), P2(j + 1, [0, -H, b.em]), ...b.pts, P2(j + 1, [0, H, b.e])];
    c.beginPath(); poly.forEach((p, k) => { const q = T(p[0], p[1]); k ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); }); c.closePath();
    c.fillStyle = TH.lens; c.fill(); c.strokeStyle = TH.lensE; c.lineWidth = 1.2; c.stroke();
  }
  // rayons
  const rays = layoutRays(M, App.nRays, false);
  c.lineWidth = 1; c.globalAlpha = 0.9;
  for (const r of rays) { c.strokeStyle = fcol(r.fi); c.beginPath(); r.pts.forEach((p, k) => { const q = T(p[2], p[1]); k ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); }); c.stroke(); }
  c.globalAlpha = 1;
  // surfaces
  for (const s of G.surfs) {
    const sel = s.j === App.sel, mir = OE.isMirror(S[s.j]);
    const symOnly = S[s.j].elem && S[s.j].elem !== 'grating' && s.j < N;
    c.strokeStyle = sel ? '#f59e0b' : (mir ? TH.fg : TH.lensE); c.lineWidth = sel ? 2.6 : (mir ? 2.2 : (s.j === N ? 1.6 : 1.2));
    if (s.j === N && !sel) c.strokeStyle = TH.mut;
    if (OE.isAir(S[s.j].glass) && (s.j === 1 || OE.isAir(S[s.j - 1].glass)) && !mir && s.j !== N && !sel && !S[s.j].stop) { c.strokeStyle = TH.mut; c.setLineDash([3, 3]); c.lineWidth = 0.8; }
    if (!symOnly) { c.beginPath(); s.pts.forEach((p, k) => { const q = T(p[0], p[1]); k ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); }); c.stroke(); }
    c.setLineDash([]);
    if (mir) { // hachures côté dos du miroir
      const dir = Math.sign(M.nW[M.pw][s.j - 1]) || 1; c.strokeStyle = TH.mut; c.lineWidth = 0.8; c.beginPath();
      for (let k = 0; k <= 40; k += 3) { const y = -s.sd + 2 * s.sd * k / 40, z = s.sz(0, y), g1 = G.G3(s.j, [0, y, z]), g2 = G.G3(s.j, [0, y - 5 / V.s, z + dir * 6 / V.s]); const q1 = T(g1[2], g1[1]), q2 = T(g2[2], g2[1]); c.moveTo(q1[0], q1[1]); c.lineTo(q2[0], q2[1]); } c.stroke();
    }
    const el = S[s.j].elem;
    if (el && s.j < N) {
      const top = G.G3(s.j, [0, s.sd, 0]), bot = G.G3(s.j, [0, -s.sd, 0]), a = T(top[2], top[1]), b = T(bot[2], bot[1]);
      const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
      c.save(); c.lineWidth = 1.6; c.strokeStyle = sel ? '#f59e0b' : ({ ideal: '#0891b2', grating: '#9333ea', polarizer: '#16a34a', waveplate: '#ea580c' })[el] || TH.fg;
      c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
      if (el === 'ideal') { const f = +S[s.j].fid || 1, d = f > 0 ? 1 : -1; for (const [P, sgn] of [[a, 1], [b, -1]]) { c.beginPath(); c.moveTo(P[0] - 6 * nx + d * sgn * 6 * dx / L, P[1] - 6 * ny + d * sgn * 6 * dy / L); c.lineTo(P[0], P[1]); c.lineTo(P[0] + 6 * nx + d * sgn * 6 * dx / L, P[1] + 6 * ny + d * sgn * 6 * dy / L); c.stroke(); } }
      else if (el === 'grating') { for (let k = 0; k <= 12; k++) { const q = [a[0] + dx * k / 12, a[1] + dy * k / 12]; c.beginPath(); c.moveTo(q[0], q[1]); c.lineTo(q[0] + 4 * nx, q[1] + 4 * ny); c.stroke(); } }
      else if (el === 'polarizer') { c.lineWidth = 1; for (let k = 1; k < 8; k++) { const q = [a[0] + dx * k / 8, a[1] + dy * k / 8]; c.beginPath(); c.moveTo(q[0] - 4 * nx, q[1] - 4 * ny); c.lineTo(q[0] + 4 * nx, q[1] + 4 * ny); c.stroke(); } }
      else if (el === 'waveplate') { c.lineWidth = 1; c.strokeRect(Math.min(a[0], b[0]) - 3, Math.min(a[1], b[1]), Math.abs(dx) + 6, Math.abs(dy)); }
      c.restore();
    }
    if (S[s.j].stop) { c.strokeStyle = TH.fg; c.lineWidth = 2.5; for (const sg of [1, -1]) { const e = sg > 0 ? s.e : s.em, g1 = G.G3(s.j, [0, sg * s.sd, e]), g2 = G.G3(s.j, [0, sg * (s.sd * 1.18 + 3 / V.s), e]); const q1 = T(g1[2], g1[1]), q2 = T(g2[2], g2[1]); c.beginPath(); c.moveTo(q1[0], q1[1]); c.lineTo(q2[0], q2[1]); c.stroke(); } }
  }
  if (G.fin) {
    const S = src();
    if (S.type === 'fiber') { // extrémité de la fibre : gaine, cœur et cône d'ouverture
      const f0 = App.sys.fields[0] || { y: 0 }, z0 = -M.t0, y0 = f0.y || 0, cl = Math.max((S.clad || S.core) * 5e-4 * V.s, 3), co = Math.max(S.core * 5e-4 * V.s, 1.5), q = T(z0, y0), L = Math.min(60, 0.12 * G.span * V.s);
      c.fillStyle = 'rgba(148,163,184,.35)'; c.fillRect(q[0] - L, q[1] - cl, L, 2 * cl); c.fillStyle = '#f59e0b'; c.fillRect(q[0] - L, q[1] - co, L, 2 * co);
      c.strokeStyle = TH.mut; c.lineWidth = 1; c.strokeRect(q[0] - L, q[1] - cl, L, 2 * cl);
      const th = Math.asin(Math.min(0.99, S.na || 0.1)), Lc = Math.min(0.25 * G.span, M.t0) * V.s; c.strokeStyle = 'rgba(245,158,11,.55)'; c.setLineDash([4, 3]); c.beginPath(); c.moveTo(q[0], q[1] - co); c.lineTo(q[0] + Lc, q[1] - co - Lc * Math.tan(th)); c.moveTo(q[0], q[1] + co); c.lineTo(q[0] + Lc, q[1] + co + Lc * Math.tan(th)); c.stroke(); c.setLineDash([]);
      text(c, `fibre ${fmt(S.core, 4)} µm · ON ${fmt(S.na, 3)}`, q[0] - L, q[1] + cl + 4, { col: TH.mut, size: 10.5 });
    } else { const q = T(-M.t0, 0); c.fillStyle = TH.mut; c.fillRect(q[0] - 1, q[1] - 30, 2, 60); }
  }
  // échelle
  const sl = niceStep(G.span, 4); const L = sl * V.s; c.strokeStyle = TH.mut; c.lineWidth = 1.2; c.beginPath(); c.moveTo(w - 16 - L, h - 14); c.lineTo(w - 16, h - 14); c.moveTo(w - 16 - L, h - 18); c.lineTo(w - 16 - L, h - 10); c.moveTo(w - 16, h - 18); c.lineTo(w - 16, h - 10); c.stroke();
  text(c, `${tl(sl, sl)} mm`, w - 16 - L / 2, h - 30, { col: TH.mut, align: 'center', size: 10.5 });
}
function draw3D(c, w, h, M, G) {
  const V = App.view, ca = Math.cos(V.yaw), sa = Math.sin(V.yaw), cb = Math.cos(V.pitch), sb = Math.sin(V.pitch);
  const zc = (G.zmin + G.zmax) / 2, yc = (G.ymin + G.ymax) / 2;
  const P = (x, y, z) => { z -= zc; y -= yc; const sx = z * ca - x * sa, dep = z * sa + x * ca, sy = y * cb + dep * sb; return [sx, sy]; };
  const sc = (V.s3 || 1) * Math.min((w - 40) / ((G.zmax - G.zmin) * 1.05 || 1), (h - 30) / (1.3 * (G.ymax - G.ymin) || 1));
  const T = (q) => { const p = P(q[0], q[1], q[2]); return [w / 2 + p[0] * sc + (V.px3 || 0), h / 2 - p[1] * sc + (V.py3 || 0)]; };
  const S = M.S, N = M.N, G3 = G.G3;
  const poly = (arr) => { c.beginPath(); arr.forEach((q, k) => { const t = T(q); k ? c.lineTo(t[0], t[1]) : c.moveTo(t[0], t[1]); }); c.stroke(); };
  c.lineWidth = 1;
  const rays = layoutRays(M, Math.max(3, App.nRays), true);
  c.globalAlpha = 0.85;
  for (const r of rays) { c.strokeStyle = fcol(r.fi); poly(r.pts); }
  c.globalAlpha = 1;
  for (const s of G.surfs) {
    const sel = s.j === App.sel, mir = OE.isMirror(S[s.j]), sd = s.sd;
    c.strokeStyle = sel ? '#f59e0b' : mir ? TH.fg : s.j === N ? TH.mut : TH.lensE; c.lineWidth = sel ? 2.2 : 1.1;
    poly(Array.from({ length: 65 }, (_, k) => { const a = 2 * Math.PI * k / 64, x = sd * Math.cos(a), y = sd * Math.sin(a); return G3(s.j, [x, y, s.sz(x, y)]); }));
    c.globalAlpha = 0.5; c.lineWidth = 0.8;
    for (let m = 0; m < 4; m++) { const a = Math.PI * m / 4; poly(Array.from({ length: 31 }, (_, k) => { const r = -sd + 2 * sd * k / 30, x = r * Math.cos(a), y = r * Math.sin(a); return G3(s.j, [x, y, s.sz(x, y)]); })); }
    c.globalAlpha = 1;
  }
  for (let j = 1; j < N; j++) {
    if (OE.isAir(S[j].glass) || OE.isMirror(S[j])) continue;
    const a = G.surfs[j - 1], b = G.surfs[j], H = Math.max(a.sd, b.sd);
    c.strokeStyle = TH.lensE; c.globalAlpha = 0.6;
    for (let m = 0; m < 8; m++) { const t = 2 * Math.PI * m / 8, x = H * Math.cos(t), y = H * Math.sin(t); poly([G3(j, [x, y, a.sz(x * a.sd / H, y * a.sd / H)]), G3(j + 1, [x, y, b.sz(x * b.sd / H, y * b.sd / H)])]); }
    c.globalAlpha = 1;
  }
  text(c, 'Glisser : rotation · Maj+glisser : déplacer · molette : zoom', 10, 8, { col: TH.mut, size: 10.5 });
}
function setupLayout() {
  const cv = $('#lay'); let drag = null;
  cv.addEventListener('mousedown', e => { drag = { x: e.clientX, y: e.clientY, moved: false, shift: e.shiftKey }; cv.classList.add('drag'); });
  window.addEventListener('mouseup', e => {
    if (!drag) return; cv.classList.remove('drag');
    if (!drag.moved && App.mode === '2d') { const hit = hitSurf(e); if (hit) { selectRow(hit, true); renderPanesIf('footprint'); } }
    drag = null;
  });
  window.addEventListener('mousemove', e => {
    if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
      drag.x = e.clientX; drag.y = e.clientY;
      const V = App.view;
      if (App.mode === '2d') { V.auto = false; V.ox += dx; V.oy += dy; }
      else if (drag.shift) { V.px3 = (V.px3 || 0) + dx; V.py3 = (V.py3 || 0) + dy; }
      else { V.yaw += dx * 0.01; V.pitch = Math.max(-1.5, Math.min(1.5, V.pitch + dy * 0.01)); }
      drawLayout(); $('#tip').style.display = 'none'; return;
    }
    if (e.target !== cv || App.mode !== '2d') { $('#tip').style.display = 'none'; return; }
    const j = hitSurf(e), tip = $('#tip');
    if (j) {
      const s = App.M.S[j], r = cv.getBoundingClientRect();
      tip.innerHTML = `<b>Surface ${j}</b>${s.comment ? ' · ' + esc(s.comment) : ''}<br>R = ${fmt(s.r, 6)}  t = ${fmt(s.t, 6)}<br>${s.glass || 'air'} · ½Ø = ${fmt(s.sd, 5)}${s.k ? ' · k = ' + fmt(s.k, 5) : ''}`;
      tip.style.left = (e.clientX - r.left + 14) + 'px'; tip.style.top = (e.clientY - r.top + 10) + 'px'; tip.style.display = 'block';
    } else tip.style.display = 'none';
  });
  cv.addEventListener('mouseleave', () => $('#tip').style.display = 'none');
  cv.addEventListener('wheel', e => {
    e.preventDefault(); const k = Math.exp(-e.deltaY * 0.0015), V = App.view;
    if (App.mode === '2d') { const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top; V.auto = false; V.ox = mx - (mx - V.ox) * k; V.oy = my - (my - V.oy) * k; V.s *= k; }
    else V.s3 = (V.s3 || 1) * k;
    drawLayout();
  }, { passive: false });
  cv.addEventListener('dblclick', () => fitView());
}
function fitView() { Object.assign(App.view, { auto: true, s3: 1, px3: 0, py3: 0 }); drawLayout(); }
function hitSurf(e) {
  const M = App.M; if (!M || !M.ok || !App.layT) return 0;
  const r = $('#lay').getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
  let best = 0, bd = 8;
  for (const s of layoutGeom(M).surfs) for (const p of s.pts) { const q = App.layT(p[0], p[1]); const d = Math.hypot(q[0] - mx, q[1] - my); if (d < bd) { bd = d; best = s.j; } }
  return best;
}

/* ---------------- Analyses ---------------- */
const PT = {
  spot: { l: 'Diagramme de spot' },
  rayfan: { l: 'Aberrations transverses (ray fan)' },
  opdfan: { l: 'Front d\'onde — coupes (OPD fan)' },
  wfe: { l: 'Carte de front d\'onde (WFE)', f: 1, w: 1 },
  zern: { l: 'Coefficients de Zernike', f: 1, w: 1, html: 1 },
  psf: { l: 'PSF diffractive (FFT)', f: 1, w: 1 },
  mtf: { l: 'FTM / MTF polychromatique' },
  ee: { l: 'Énergie encerclée', f: 1 },
  footprint: { l: 'Footprint (empreinte du faisceau)', s: 1 },
  field: { l: 'Courbure de champ & distorsion' },
  seidel: { l: 'Aberrations de Seidel (3ᵉ ordre)' },
  chrom: { l: 'Décalage focal chromatique' },
  glass: { l: 'Carte des verres (nd / νd)' },
  polar: { l: 'Polarisation (pupille de sortie)', f: 1, w: 1 },
  detector: { l: 'Échantillonnage détecteur', f: 1, w: 1 },
  source: { l: 'Source étendue (fibre, fente…)', f: 1 },
  imgsim: { l: 'Simulation d\'image' },
  presc: { l: 'Prescription & synthèse', html: 1 },
};
function buildPanes() {
  const el = $('#panes'); el.className = 'g' + App.grid; el.innerHTML = '';
  for (let i = 0; i < App.grid; i++) {
    const d = document.createElement('div'); d.className = 'pane'; d.dataset.i = i;
    d.innerHTML = `<div class="ph"></div><div class="pb"><canvas></canvas><div class="phtml"></div></div>`;
    el.appendChild(d);
  }
  $$('#gridSeg button').forEach(b => b.classList.toggle('on', +b.dataset.g === App.grid));
  renderPanes();
}
function paneHeader(pi) {
  const p = App.panes[pi], t = PT[p.type] || PT.spot, s = App.sys, M = App.M;
  let h = `<select class="pt" data-p="type">${Object.entries(PT).map(([k, v]) => `<option value="${k}" ${k === p.type ? 'selected' : ''}>${v.l}</option>`).join('')}</select>`;
  if (t.f) { p.fi = Math.min(p.fi || 0, s.fields.length - 1); h += `<select data-p="fi">${s.fields.map((f, i) => `<option value="${i}" ${i === p.fi ? 'selected' : ''}>Champ ${i + 1} (${M && M.ok ? fLabel(M, i) : fmt(f.y, 4)})</option>`).join('')}</select>`; }
  if (t.w) { if (p.wi != null && p.wi >= s.wavelengths.length) p.wi = null; const we = p.wi ?? s.primary; h += `<select data-p="wi">${s.wavelengths.map((w, i) => `<option value="${i}" ${i === we ? 'selected' : ''}>${fmt(w.um * 1000, 5)} nm</option>`).join('')}</select>`; }
  if (t.s) h += `<select data-p="si"><option value="">Surface sélectionnée</option>${s.surfaces.map((x, i) => i ? `<option value="${i}" ${p.si === i ? 'selected' : ''}>Surface ${i}${x.comment ? ' · ' + esc(x.comment) : ''}</option>` : '').join('')}</select>`;
  if (p.type === 'detector') h += `<select data-p="phase"><option value="centre" ${(p.phase || 'centre') === 'centre' ? 'selected' : ''}>centrée sur un pixel</option><option value="coin" ${p.phase === 'coin' ? 'selected' : ''}>centrée sur un coin</option></select>`;
  if (p.type === 'source') {
    const S = src(); h += `<span class="hint">Source : <b>${S.type === 'fiber' ? ({ si: 'fibre SI', gi: 'fibre GI', sm: 'fibre monomode' })[S.fib] + ' ' + fmt(S.core, 4) + ' µm, ON ' + fmt(S.na, 3) : (SRCT.find(q => q[0] === S.type) || [0, ''])[1]}</b></span><button class="bt" data-p="srccfg" style="height:24px">Configurer…</button>`;
    if (det().on) h += `<label><input type="checkbox" data-p="pix" ${p.pix ? 'checked' : ''}>pixels</label>`;
  }
  if (p.type === 'imgsim' && det().on) h += `<label title="Échantillonner l'image sur les pixels du détecteur (bruit inclus si activé)"><input type="checkbox" data-p="det" ${p.det !== false ? 'checked' : ''}>détecteur</label>`;
  if (p.type === 'polar') h += `<select data-p="st">${[['X', 'Linéaire X'], ['Y', 'Linéaire Y'], ['P45', 'Linéaire +45°'], ['M45', 'Linéaire −45°'], ['RCP', 'Circulaire droite'], ['LCP', 'Circulaire gauche'], ['NONE', 'Non polarisée']].map(([k, l]) => `<option value="${k}" ${(p.st || 'X') === k ? 'selected' : ''}>${l}</option>`).join('')}</select><label title="Pertes et déphasages de Fresnel aux dioptres non traités"><input type="checkbox" data-p="fresnel" ${p.fresnel !== false ? 'checked' : ''}>Fresnel</label>`;
  if (p.type === 'imgsim') h += `<select data-p="src">${SIMSRC.map(([k, l]) => `<option value="${k}" ${(p.src || 'mire') === k ? 'selected' : ''}>${l}</option>`).join('')}${App.userImg ? `<option value="user" ${p.src === 'user' ? 'selected' : ''}>${esc(App.userImg.name)}</option>` : ''}</select><button class="bt" data-p="load" style="height:24px">Image…</button>
    <select data-p="res">${[128, 192, 256, 384].map(r => `<option value="${r}" ${(p.res || 192) == r ? 'selected' : ''}>${r} px</option>`).join('')}</select>
    <label title="Demi-champ objet couvert par l'image (vide : champ max du système)">½ champ <input class="in" data-p="fov" style="width:52px;height:22px" value="${p.fov || ''}" placeholder="auto"></label>
    <label><input type="checkbox" data-p="upright" ${p.upright ? 'checked' : ''}>redresser</label><button class="bt" data-p="run" style="height:24px">▶ Simuler</button>`;
  if (p.type === 'glass') h += `<select data-p="cat"><option value="">Tous les catalogues</option>${OE.cats().map(k => `<option ${p.cat === k ? 'selected' : ''}>${k}</option>`).join('')}</select>`;
  if (p.type === 'psf' && det().on) h += `<label title="PSF intégrée sur les pixels du détecteur"><input type="checkbox" data-p="pix" ${p.pix ? 'checked' : ''}>pixels</label>`;
  if (p.type === 'psf') h += `<label><input type="checkbox" data-p="log" ${p.log ? 'checked' : ''}>log</label><select data-p="zoom">${[1, 2, 4].map(z => `<option value="${z}" ${(p.zoom || 2) == z ? 'selected' : ''}>×${z}</option>`).join('')}</select>`;
  if (p.type === 'wfe') h += `<label><input type="checkbox" data-p="tilt" ${p.tilt !== false ? 'checked' : ''}>sans tilt</label>`;
  if (p.type === 'mtf') h += `<label>f max <input class="in" data-p="fmax" style="width:56px;height:22px" value="${p.fmax || ''}" placeholder="auto"></label>`;
  if (p.type === 'spot') h += `<label><input type="checkbox" data-p="chief" ${p.chief ? 'checked' : ''}>réf. principal</label>`;
  h += `<span class="grow"></span>${t.html ? '' : '<button class="x" data-p="png" title="Enregistrer l\'image (PNG)">⤓</button>'}<button class="x" data-p="max" title="Agrandir / réduire">⤢</button>`;
  return h;
}
function setupPanes() {
  const el = $('#panes');
  el.addEventListener('change', e => {
    const t = e.target, k = t.dataset.p; if (!k) return; const pi = +t.closest('.pane').dataset.i, p = App.panes[pi];
    if (k === 'type') { App.panes[pi] = { type: t.value }; }
    else if (['log', 'tilt', 'chief', 'fresnel', 'upright', 'pix', 'det', 'grid'].includes(k)) p[k] = t.checked;
    else if (['stype', 'phase'].includes(k)) p[k] = t.value;
    else if (['sd', 'sna', 'sw', 'sh'].includes(k)) { const v = parseFloat(String(t.value).replace(',', '.')); p[k] = isFinite(v) && v >= 0 ? v : null; }
    else if (k === 'st' || k === 'src') p[k] = t.value;
    else if (k === 'fov') { const v = parseFloat(String(t.value).replace(',', '.')); p.fov = isFinite(v) && v > 0 ? v : null; }
    else if (k === 'si') p.si = t.value === '' ? null : +t.value;
    else if (k === 'cat') p.cat = t.value;
    else if (k === 'fmax') { const v = parseFloat(t.value); p.fmax = isFinite(v) && v > 0 ? v : null; }
    else p[k] = +t.value;
    save(); renderPane(pi);
  });
  el.addEventListener('click', e => {
    const sc = e.target.closest('[data-p="srccfg"]'); if (sc) { closedCards.delete('src'); renderSide(); const el2 = $('#side [data-card="src"]'); if (el2) { el2.scrollIntoView({ behavior: 'smooth', block: 'start' }); el2.style.outline = '2px solid var(--acc)'; setTimeout(() => el2.style.outline = '', 1200); } return; }
    const ld = e.target.closest('[data-p="load"]'); if (ld) { App.simPane = +ld.closest('.pane').dataset.i; $('#imgIn').click(); return; }
    const run = e.target.closest('[data-p="run"]'); if (run) { const pi = +run.closest('.pane').dataset.i; SIM.cache.clear(); SIM.force = true; renderPane(pi); return; }
    const g = e.target.closest('[data-p="png"]');
    if (g) { const pane = g.closest('.pane'), cv = pane.querySelector('canvas'), p = App.panes[+pane.dataset.i]; const o = document.createElement('canvas'); o.width = cv.width; o.height = cv.height; const oc = o.getContext('2d'); oc.fillStyle = TH.panel || '#fff'; oc.fillRect(0, 0, o.width, o.height); oc.drawImage(cv, 0, 0); o.toBlob(b => download(`${fileBase()}_${p.type}.png`, b)); return; }
    const b = e.target.closest('[data-p="max"]'); if (b) { const pane = b.closest('.pane'); pane.classList.toggle('max'); renderPane(+pane.dataset.i); } });
  el.addEventListener('dblclick', e => { if (e.target.closest('.ph') && !e.target.closest('select,input')) { const pane = e.target.closest('.pane'); pane.classList.toggle('max'); renderPane(+pane.dataset.i); } });
  new ResizeObserver(() => { clearTimeout(App._rz); App._rz = setTimeout(() => { drawLayout(); renderPanes(); }, 80); }).observe(document.body);
}
function renderPanesIf(type) { $$('#panes .pane').forEach(d => { if (App.panes[+d.dataset.i].type === type) renderPane(+d.dataset.i); }); }
function renderPanes() { readTheme(); const t0 = performance.now(); $$('#panes .pane').forEach(d => renderPane(+d.dataset.i)); App.lastPanes = performance.now() - t0; status(); }
function renderPane(pi) {
  const d = $(`#panes .pane[data-i="${pi}"]`); if (!d) return;
  const p = App.panes[pi]; if (!PT[p.type]) p.type = 'spot';
  d.querySelector('.ph').innerHTML = paneHeader(pi);
  const cv = d.querySelector('canvas'), hd = d.querySelector('.phtml'), M = App.M;
  const isH = !!PT[p.type].html;
  hd.style.display = isH ? 'block' : 'none'; cv.style.display = isH ? 'none' : 'block';
  if (!M || !M.ok) { if (isH) hd.innerHTML = '<p style="color:#dc2626">Système invalide</p>'; else { const { c } = prepCanvas(cv); text(c, 'Système invalide : ' + (M && M.errors || []).join(', '), 12, 12, { col: '#dc2626' }); } return; }
  try {
    if (isH) hd.innerHTML = R[p.type](p, M);
    else { const { c, w, h } = prepCanvas(cv); R[p.type](p, M, c, w, h); }
  } catch (err) {
    console.error(err);
    if (isH) hd.innerHTML = 'Erreur : ' + esc(err.message); else { const { c } = prepCanvas(cv); text(c, 'Erreur : ' + err.message, 12, 12, { col: '#dc2626' }); }
  }
}
const fLabel = (M, i) => { const f = M.sys.fields[i], u = M.objInf ? '°' : ' mm'; return f.x ? `(${fmt(f.x, 4)}, ${fmt(f.y, 4)})${u}` : `${fmt(f.y, 4)}${u}`; };
const wlLegend = M => M.wls.map((l, i) => ({ col: wlCol(l), l: `${fmt(l * 1000, 4)} nm` }));
const R = {
  spot(p, M, c, w, h) {
    const nf = M.sys.fields.length, sp = M.sys.fields.map((_, i) => OE.spot(M, i, 25));
    const ref = sp.map(s => p.chief && s.chief ? s.chief : [s.cx, s.cy]);
    let half = 0; sp.forEach((s, i) => { for (const q of s.pts) half = Math.max(half, Math.abs(q.x - ref[i][0]), Math.abs(q.y - ref[i][1])); half = Math.max(half, s.airy); });
    half *= 1.08e3;
    const g = subgrid(nf, w, h - 22);
    sp.forEach((s, i) => {
      const col = i % g.cols, row = Math.floor(i / g.cols), cw = w / g.cols, ch = (h - 22) / g.rows;
      const A = axes(c, { x: col * cw, y: row * ch, w: cw, h: ch }, [-half, half], [-half, half], { equal: true, title: `Champ ${fLabel(M, i)}`, ml: 44, mb: 44 });
      clip(c, A.P);
      const ra = s.airy * 1e3; c.strokeStyle = TH.mut; c.setLineDash([3, 3]); c.beginPath(); c.arc(A.X(0), A.Y(0), Math.abs(A.X(ra) - A.X(0)), 0, 2 * Math.PI); c.stroke(); c.setLineDash([]);
      c.restore(); if (det().on) pixGrid(c, A, det().p); clip(c, A.P);
      const cols = M.wls.map(wlCol);
      for (const q of s.pts) { c.fillStyle = cols[q.wi]; c.fillRect(A.X((q.x - ref[i][0]) * 1e3) - 1, A.Y((q.y - ref[i][1]) * 1e3) - 1, 2, 2); }
      c.restore();
      text(c, `RMS ${fx(s.rms * 1e3, 2)} µm`, A.P.x, A.P.y + A.P.h + 16, { col: TH.fg, size: 10.5, mono: true });
      text(c, `GEO ${fx(s.geo * 1e3, 2)} µm${s.nv ? ' · vign. ' + Math.round(100 * s.nv / s.ntot) + '%' : ''}`, A.P.x, A.P.y + A.P.h + 29, { col: TH.mut, size: 10.5, mono: true });
    });
    legend(c, 8, h - 10, [...wlLegend(M), { col: TH.mut, dash: [3, 3], l: `Airy r=${fx(sp[0].airy * 1e3, 2)} µm` }, ...(det().on ? [{ col: 'rgba(120,140,170,.7)', l: `pixel ${det().p} µm` }] : [])]);
  },
  rayfan(p, M, c, w, h) { fans(c, w, h, M, M.sys.fields.map((_, i) => OE.rayFan(M, i, 61)), 1e3, 'µm'); },
  opdfan(p, M, c, w, h) { fans(c, w, h, M, M.sys.fields.map((_, i) => OE.opdFan(M, i, 61)), 1, 'λ'); },
  wfe(p, M, c, w, h) {
    const wf = OE.wavefront(M, p.fi || 0, p.wi ?? M.pw, 64, p.tilt !== false);
    let m = 0; for (const v of wf.W) if (isFinite(v)) m = Math.max(m, Math.abs(v)); m = m || 1e-3;
    const A = axes(c, { x: 0, y: 0, w: w - 70, h: h - 6 }, [-1.05, 1.05], [-1.05, 1.05], { equal: true, title: `WFE  RMS ${fx(wf.rms, 4)} λ · PV ${fx(wf.pv, 4)} λ · Strehl≈${fx(Math.exp(-((2 * Math.PI * wf.rms) ** 2)), 3)}`, ml: 40, mb: 22, zero: false });
    A.xr0 = -1; A.xr1 = 1; A.yr0 = -1; A.yr1 = 1;
    heat(c, A, wf.W, wf.N, wf.N, -m, m, 'div', false);
    c.strokeStyle = TH.line; c.beginPath(); c.arc(A.X(0), A.Y(0), A.X(1) - A.X(0), 0, 2 * Math.PI); c.stroke();
    cbar(c, w - 58, 30, 12, Math.max(40, h - 70), -m, m, 'div', 'λ');
    text(c, `λ = ${fmt(M.wls[p.wi ?? M.pw] * 1000, 5)} nm · champ ${fLabel(M, p.fi || 0)} · réf. sphère centrée sur le rayon principal`, 40, h - 14, { col: TH.mut, size: 10 });
  },
  zern(p, M) {
    const wf = OE.wavefront(M, p.fi || 0, p.wi ?? M.pw, 64, false);
    const z = wf.zern || [];
    const rows = z.map((v, i) => `<tr><td>Z${i + 1}</td><td style="text-align:left">${OE.ZN[i]}</td><td>${(v >= 0 ? '+' : '') + v.toFixed(5)}</td><td><div style="height:8px;width:${Math.min(160, Math.abs(v) / (Math.max(...z.map(Math.abs)) || 1) * 160)}px;background:${v >= 0 ? '#d4553b' : '#3f6fc4'};border-radius:2px"></div></td></tr>`).join('');
    return `<div class="hint">Zernike Fringe, unités : ondes (λ = ${fmt(M.wls[p.wi ?? M.pw] * 1000, 5)} nm), champ ${fLabel(M, p.fi || 0)}. Pupille normalisée, θ depuis l'axe X.</div>
      <table style="margin-top:8px"><tr><th>Terme</th><th style="text-align:left">Aberration</th><th>Coef. (λ)</th><th></th></tr>${rows}</table>
      <p class="hint">RMS total (piston retiré) : <b>${fx(wf.rms, 5)} λ</b> · PV : <b>${fx(wf.pv, 4)} λ</b></p>`;
  },
  psf(p, M, c, w, h) {
    const ps = OE.psf(M, p.fi || 0, p.wi ?? M.pw, 64, 256), P = ps.P, zoom = p.zoom || 2;
    const half = Math.floor(P / 2 / zoom / 2), n = 2 * half, o = P / 2 - half, data = new Float64Array(n * n);
    let mx = 0;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const v = ps.I[(y + o) * P + x + o]; data[y * n + x] = v; mx = Math.max(mx, v); }
    if (p.log) for (let i = 0; i < data.length; i++) data[i] = Math.log10(Math.max(data[i] / mx, 1e-6));
    const ext = half * ps.dx * 1e3;
    const A = axes(c, { x: 0, y: 0, w: w - 70, h: h - 4 }, [-ext, ext], [-ext, ext], { equal: true, title: `PSF  Strehl ${fx(ps.strehl, 4)}`, ml: 46, xl: 'µm', zero: false });
    A.xr0 = -ext; A.xr1 = ext; A.yr0 = -ext; A.yr1 = ext;
    heat(c, A, data, n, n, p.log ? -6 : 0, p.log ? 0 : mx, 'inferno', true);
    const ra = 1.22 * M.ctxs[p.wi ?? M.pw].lmm * M.par.wfno * 1e3;
    c.strokeStyle = 'rgba(255,255,255,.45)'; c.setLineDash([3, 3]); c.beginPath(); c.arc(A.X(0), A.Y(0), A.X(ra) - A.X(0), 0, 2 * Math.PI); c.stroke(); c.setLineDash([]);
    cbar(c, w - 58, 30, 12, Math.max(40, h - 70), p.log ? -6 : 0, p.log ? 0 : mx, 'inferno', p.log ? 'log₁₀' : 'Strehl');
    if (det().on) {
      const pu = det().p, bp = OE.binPSF(ps.I, ps.P, ps.dx, pu * 1e-3, 'centre', 3);
      if (p.pix) { const L = lut('inferno'), mxp = Math.max(...bp.G); const nb = Math.ceil(ext / pu) * 2 + 1, b2 = OE.binPSF(ps.I, ps.P, ps.dx, pu * 1e-3, 'centre', nb); const m2 = Math.max(...b2.G);
        clip(c, A.P); for (let iy = 0; iy < nb; iy++) for (let ix = 0; ix < nb; ix++) { const v = b2.G[iy * nb + ix] / m2, k = Math.round(Math.max(0, Math.min(1, v)) * 255); c.fillStyle = `rgb(${L[k * 3]},${L[k * 3 + 1]},${L[k * 3 + 2]})`; const x0 = A.X((ix - (nb >> 1) - 0.5) * pu), y0 = A.Y((iy - (nb >> 1) + 0.5) * pu); c.fillRect(x0, y0, A.X(pu) - A.X(0) + 0.5, A.Y(0) - A.Y(pu) + 0.5); } c.restore(); void mxp; }
      pixGrid(c, A, pu, 'rgba(255,255,255,.35)');
      text(c, `pixel ${pu} µm · énergie pixel central ${fx(bp.G[4] * 100, 1)} % · 3×3 ${fx(bp.G.reduce((a, b) => a + b, 0) * 100, 1)} %`, A.P.x + 4, A.P.y + A.P.h - 14, { col: '#fff', size: 10.5 });
    }
  },
  mtf(p, M, c, w, h) {
    const res = M.sys.fields.map((_, i) => OE.mtf(M, i, { fmax: p.fmax }));
    const f = res[0].f;
    const A = axes(c, { x: 0, y: 0, w, h: h - 18 }, [0, f[f.length - 1]], [0, 1.02], { xl: 'Fréquence spatiale (cycles/mm)', yl: 'Module FTM', title: 'FTM polychromatique (diffraction)' });
    pline(c, A, f, res[0].DL, TH.fg, 1.2, [2, 2]);
    res.forEach((r, i) => { pline(c, A, r.f, r.T, fcol(i), 1.7); pline(c, A, r.f, r.S, fcol(i), 1.7, [6, 4]); });
    const dd = det(); let dl = [];
    if (dd.on) {
      const pm = dd.p * 1e-3, ny = 1 / (2 * pm), D = f.map(x => OE.detMTF(x, pm, dd.ff / 100));
      pline(c, A, f, D, '#ea580c', 1.2, [1, 3]);
      res.forEach((r, i) => pline(c, A, r.f, r.T.map((v, k) => v * D[k]), fcol(i), 1.1, [1, 2]));
      if (ny < f[f.length - 1]) { c.strokeStyle = '#ea580c'; c.setLineDash([4, 3]); c.beginPath(); c.moveTo(A.X(ny), A.P.y); c.lineTo(A.X(ny), A.P.y + A.P.h); c.stroke(); c.setLineDash([]); text(c, `Nyquist ${fx(ny, 0)}`, A.X(ny) + 3, A.P.y + 3, { col: '#ea580c', size: 10 }); }
      dl = [{ col: '#ea580c', dash: [1, 3], l: 'FTM pixel' }, { col: TH.mut, dash: [1, 2], l: 'système × pixel (T)' }];
    }
    legend(c, 8, h - 8, [...dl, { col: TH.fg, dash: [2, 2], l: 'Limite de diffraction' }, { col: TH.mut, l: 'Tangentiel' }, { col: TH.mut, dash: [6, 4], l: 'Sagittal' }, ...M.sys.fields.map((_, i) => ({ col: fcol(i), l: fLabel(M, i) }))]);
  },
  ee(p, M, c, w, h) {
    const e = OE.encircled(M, p.fi || 0);
    const r = e.r.map(v => v * 1e3);
    const A = axes(c, { x: 0, y: 0, w, h: h - 18 }, [0, r[r.length - 1]], [0, 1.02], { xl: 'Rayon (µm)', yl: 'Fraction d\'énergie', title: `Énergie encerclée · champ ${fLabel(M, p.fi || 0)}` });
    pline(c, A, r, e.D, '#2563eb', 1.8); pline(c, A, r, e.G, '#ea580c', 1.6, [6, 4]);
    const ra = e.airy * 1e3; c.strokeStyle = TH.mut; c.setLineDash([2, 3]); c.beginPath(); c.moveTo(A.X(ra), A.P.y); c.lineTo(A.X(ra), A.P.y + A.P.h); c.stroke(); c.setLineDash([]);
    const r80 = (arr) => { const k = arr.findIndex(v => v >= 0.8); return k < 0 ? NaN : r[k]; };
    legend(c, 8, h - 8, [{ col: '#2563eb', l: `Diffraction (λ prim.) — r80 ${fx(r80(e.D), 2)} µm` }, { col: '#ea580c', dash: [6, 4], l: `Géométrique (poly) — r80 ${fx(r80(e.G), 2)} µm` }, { col: TH.mut, dash: [2, 3], l: 'Airy' }]);
  },
  footprint(p, M, c, w, h) {
    const si = Math.min(p.si ?? App.sel, M.N) || 1;
    const fp = OE.footprint(M, si, { n: 13 });
    let m = fp.sd; for (const f of fp.fields) for (const q of f.pts) m = Math.max(m, Math.abs(q[0]), Math.abs(q[1]));
    if (det().on && si === M.N) m = Math.max(m, det().nx * det().p * 5e-4, det().ny * det().p * 5e-4);
    m *= 1.08;
    const A = axes(c, { x: 0, y: 0, w, h: h - 18 }, [-m, m], [-m, m], { equal: true, xl: 'X (mm)', title: `Surface ${si}${M.S[si].comment ? ' · ' + M.S[si].comment : ''} — ½Ø ${fx(fp.sd, 3)} mm${M.S[si].sdFixed ? ' (fixe)' : ''}` });
    c.strokeStyle = TH.fg; c.lineWidth = 1.4; c.beginPath(); c.arc(A.X(0), A.Y(0), A.X(fp.sd) - A.X(0), 0, 2 * Math.PI); c.stroke();
    if (det().on && si === M.N) { const d = det(), W2 = d.nx * d.p * 5e-4, H2 = d.ny * d.p * 5e-4; c.strokeStyle = '#ea580c'; c.lineWidth = 1.8; c.setLineDash([6, 3]); c.strokeRect(A.X(-W2), A.Y(H2), A.X(W2) - A.X(-W2), A.Y(-H2) - A.Y(H2)); c.setLineDash([]); text(c, `Détecteur ${d.nx}×${d.ny} px · ${fx(2 * W2, 2)}×${fx(2 * H2, 2)} mm`, A.X(-W2) + 4, A.Y(H2) + 4, { col: '#ea580c', size: 10.5 }); }
    clip(c, A.P);
    fp.fields.forEach(f => { c.fillStyle = fcol(f.fi); for (const q of f.pts) { c.fillRect(A.X(q[0]) - 1, A.Y(q[1]) - 1, 2, 2); } });
    c.restore();
    let ext = [Infinity, -Infinity]; fp.fields.forEach(f => f.pts.forEach(q => { ext[0] = Math.min(ext[0], q[1]); ext[1] = Math.max(ext[1], q[1]); }));
    legend(c, 8, h - 8, [...M.sys.fields.map((_, i) => ({ col: fcol(i), l: fLabel(M, i) })), { col: TH.mut, l: `Y ∈ [${fx(ext[0], 2)} ; ${fx(ext[1], 2)}] · remplissage ${fx(100 * Math.max(-ext[0], ext[1]) / fp.sd, 1)}%` }]);
  },
  field(p, M, c, w, h) {
    const fc = OE.fieldCurves(M, 30), half = w / 2;
    const xs = fc.per.flatMap(q => [...q.T, ...q.S]);
    const xr = range([xs], 0.1, true);
    const A = axes(c, { x: 0, y: 0, w: half, h: h - 18 }, xr, [0, fc.f[fc.f.length - 1] || 1], { xl: 'Mise au point (mm)', yl: M.objInf ? 'Champ (°)' : 'Champ (mm)', title: 'Courbure de champ' });
    fc.per.forEach((q, wi) => { pline(c, A, q.T, fc.f, wlCol(M.wls[wi]), 1.7); pline(c, A, q.S, fc.f, wlCol(M.wls[wi]), 1.7, [6, 4]); });
    const B = axes(c, { x: half, y: 0, w: half, h: h - 18 }, range([fc.dist], 0.1, true), [0, fc.f[fc.f.length - 1] || 1], { xl: 'Distorsion (%)', title: `Distorsion (max ${fx(fc.dist[fc.dist.length - 1], 3)} %)`, ml: 40 });
    pline(c, B, fc.dist, fc.f, TH.acc, 1.8);
    legend(c, 8, h - 8, [{ col: TH.mut, l: 'T' }, { col: TH.mut, dash: [6, 4], l: 'S' }, ...wlLegend(M)]);
  },
  seidel(p, M, c, w, h) {
    const sd = OE.seidel(M), keys = ['SI', 'SII', 'SIII', 'SIV', 'SV', 'CL', 'CT'], nm = ['Sphérique', 'Coma', 'Astigm.', 'Petzval', 'Distorsion', 'Chrom. axial', 'Chrom. lat.'];
    const kc = ['#2563eb', '#16a34a', '#dc2626', '#9333ea', '#ea580c', '#0891b2', '#ca8a04'];
    const groups = [...sd.rows.map(r => ({ l: String(r.j), v: r })), { l: 'Σ', v: sd.sum }];
    const all = groups.flatMap(g => keys.map(k => g.v[k]));
    const yr = range([all, [0]], 0.08);
    const A = axes(c, { x: 0, y: 0, w, h: h - 34 }, [0, groups.length], yr, { title: 'Coefficients de Seidel par surface (mm)', ml: 58, noX: true });
    const gw = A.P.w / groups.length, bw = gw * 0.8 / keys.length;
    groups.forEach((g, gi) => {
      keys.forEach((k, ki) => { const v = g.v[k], x = A.P.x + gi * gw + gw * 0.1 + ki * bw, y0 = A.Y(0), y1 = A.Y(v); c.fillStyle = kc[ki]; c.globalAlpha = gi === groups.length - 1 ? 1 : 0.85; c.fillRect(x, Math.min(y0, y1), Math.max(1, bw - 1), Math.abs(y1 - y0)); });
      c.globalAlpha = 1; text(c, g.l, A.P.x + gi * gw + gw / 2, A.P.y + A.P.h + 3, { col: g.l === 'Σ' ? TH.fg : TH.mut, align: 'center', size: 10.5, b: g.l === 'Σ' });
    });
    const lm = sd.lmm;
    legend(c, 8, h - 22, keys.map((k, i) => ({ col: kc[i], l: nm[i] })));
    text(c, `W040 = ${fx(sd.sum.SI / 8 / lm, 3)} λ · W131 = ${fx(sd.sum.SII / 2 / lm, 3)} λ · W222 = ${fx(sd.sum.SIII / 2 / lm, 3)} λ · W220 = ${fx((sd.sum.SIV) / 4 / lm, 3)} λ · W311 = ${fx(sd.sum.SV / 2 / lm, 3)} λ`, 8, h - 12, { col: TH.mut, size: 10.5, mono: true });
  },
  chrom(p, M, c, w, h) {
    const cs = OE.chromShift(M, 60);
    const A = axes(c, { x: 0, y: 0, w, h }, [cs.l[0], cs.l[cs.l.length - 1]], range([cs.dz], 0.1), { xl: 'Longueur d\'onde (µm)', yl: 'Décalage focal (µm)', title: `Décalage focal chromatique paraxial — étendue ${fx(Math.max(...cs.dz) - Math.min(...cs.dz), 2)} µm` });
    pline(c, A, cs.l, cs.dz, TH.acc, 2);
    M.wls.forEach(l => { c.fillStyle = wlCol(l); const k = cs.l.reduce((b, v, i) => Math.abs(v - l) < Math.abs(cs.l[b] - l) ? i : b, 0); c.beginPath(); c.arc(A.X(l), A.Y(cs.dz[k]), 4, 0, 7); c.fill(); });
  },
  glass(p, M, c, w, h) {
    const used = new Set(M.S.map(s => OE.glassKey(s.glass)).filter(Boolean)), sel = p.cat || '';
    const cat = OE.catalog().filter(g => (!sel || g.cat === sel) && g.st !== 'o' && isFinite(g.nd) && isFinite(g.vd));
    const A = axes(c, { x: 0, y: 0, w, h: h - 16 }, [100, 15], [1.4, 2.08], { xl: 'Constringence νd', yl: 'nd', title: `Carte des verres — ${cat.length} verres${sel ? ' ' + sel : ''} (utilisés en orange)` });
    clip(c, A.P); c.globalAlpha = 0.55;
    for (const g of cat) { c.fillStyle = catCol(g.cat); c.beginPath(); c.arc(A.X(g.vd), A.Y(g.nd), 2.3, 0, 7); c.fill(); }
    c.globalAlpha = 1;
    for (const g of cat) if (used.has(g.name)) { c.fillStyle = '#ea580c'; c.strokeStyle = TH.panel; c.lineWidth = 1.5; c.beginPath(); c.arc(A.X(g.vd), A.Y(g.nd), 5.5, 0, 7); c.fill(); c.stroke(); text(c, g.name, A.X(g.vd) + 8, A.Y(g.nd) - 6, { size: 10.5, col: '#ea580c', b: true }); }
    c.restore();
    legend(c, 8, h - 7, [...new Set(cat.map(g => g.cat))].map(k => ({ col: catCol(k), l: k })));
  },
  polar(p, M, c, w, h) {
    const st = p.st || 'X', fr = p.fresnel !== false, res = OE.polPupil(M, p.fi || 0, p.wi ?? M.pw, st, 15, fr);
    const A = axes(c, { x: 0, y: 0, w: w - 66, h: h - 18 }, [-1.12, 1.12], [-1.12, 1.12], { equal: true, zero: false, ml: 40, mb: 22, title: `Transmission moyenne ${fx(res.T * 100, 2)} % · entrée ${({ X: 'linéaire X', Y: 'linéaire Y', P45: '+45°', M45: '−45°', RCP: 'circulaire droite', LCP: 'circulaire gauche', NONE: 'non polarisée' })[st]}` });
    c.strokeStyle = TH.line; c.beginPath(); c.arc(A.X(0), A.Y(0), A.X(1) - A.X(0), 0, 7); c.stroke();
    const cell = (A.X(2 / 14) - A.X(0)) * 0.48, L = lut('inferno');
    const col = I => { const k = Math.max(0, Math.min(255, Math.round(I * 230 + 25))); return `rgb(${L[k * 3]},${L[k * 3 + 1]},${L[k * 3 + 2]})`; };
    let sc = 0, ss = 0, n = 0;
    for (const q of res.pts) {
      const x = A.X(q.px), y = A.Y(q.py);
      if (!q.o) { c.fillStyle = col(q.I); c.fillRect(x - cell, y - cell, 2 * cell, 2 * cell); continue; }
      const a = cell * Math.sqrt(Math.min(1, q.I)) * Math.cos(q.o.chi), b = cell * Math.sqrt(Math.min(1, q.I)) * Math.abs(Math.sin(q.o.chi));
      c.strokeStyle = Math.abs(q.o.chi) < 0.02 ? TH.fg : q.o.chi > 0 ? '#dc2626' : '#2563eb'; c.lineWidth = 1.4; c.fillStyle = col(q.I); c.globalAlpha = 0.35;
      c.beginPath(); c.ellipse(x, y, Math.max(0.6, a), Math.max(0.6, b), -q.o.psi, 0, 2 * Math.PI); c.fill(); c.globalAlpha = 1; c.stroke();
      sc += q.o.psi; ss += Math.tan(q.o.chi); n++;
    }
    cbar(c, w - 54, 30, 12, Math.max(40, h - 76), 0, 1, 'inferno', 'T');
    legend(c, 8, h - 7, st === 'NONE' ? [{ col: TH.mut, l: 'transmission par point de pupille (lumière non polarisée)' }] : [{ col: TH.fg, l: 'linéaire' }, { col: '#dc2626', l: 'elliptique droite' }, { col: '#2563eb', l: 'elliptique gauche' }, { col: TH.mut, l: n ? `ψ moy. ${fx(sc / n * 180 / Math.PI, 1)}° · ellipticité moy. ${fx(ss / n, 3)}` : '' }]);
  },
  imgsim(p, M, c, w, h) { simPane(p, M, c, w, h); },
  detector(p, M, c, w, h) {
    const d = det();
    if (!d.on) { text(c, 'Activez un détecteur dans le panneau de gauche (carte « Détecteur »).', 14, 14, { col: TH.mut }); return; }
    const wi = p.wi ?? M.pw, ps = OE.psf(M, p.fi || 0, wi, 64, 256), pm = d.p * 1e-3, nb = 7, b = OE.binPSF(ps.I, ps.P, ps.dx, pm, p.phase || 'centre', nb);
    const sz = Math.min(w * 0.52, h - 40), cell = sz / nb, x0 = 12, y0 = 28, L = lut('vir'), mx = Math.max(...b.G);
    text(c, `PSF intégrée sur les pixels (${d.p} µm) — champ ${fLabel(M, p.fi || 0)}, ${fmt(M.wls[wi] * 1000, 5)} nm`, x0, 8, { b: true });
    for (let iy = 0; iy < nb; iy++) for (let ix = 0; ix < nb; ix++) {
      const v = b.G[iy * nb + ix], k = Math.round(Math.min(1, v / mx) * 255), X = x0 + ix * cell, Y = y0 + (nb - 1 - iy) * cell;
      c.fillStyle = `rgb(${L[k * 3]},${L[k * 3 + 1]},${L[k * 3 + 2]})`; c.fillRect(X, Y, cell - 1, cell - 1);
      if (cell > 26 && v > 0.0005) text(c, (v * 100).toFixed(v >= 0.1 ? 1 : 2), X + cell / 2, Y + cell / 2 - 5, { align: 'center', size: Math.min(11, cell / 3.4), col: k > 150 ? '#111' : '#fff', mono: true });
    }
    const G = b.G, c0 = nb >> 1, sum = (r) => { let a = 0; for (let iy = c0 - r; iy <= c0 + r; iy++) for (let ix = c0 - r; ix <= c0 + r; ix++) a += G[iy * nb + ix]; return a; };
    const q2 = Math.max(...[[0, 0], [0, -1], [-1, 0], [-1, -1]].map(([a, bb]) => G[(c0 + a) * nb + c0 + bb] + G[(c0 + a) * nb + c0 + bb + 1] + G[(c0 + a + 1) * nb + c0 + bb] + G[(c0 + a + 1) * nb + c0 + bb + 1]));
    const lF = M.ctxs[wi].lmm * M.par.wfno, sp = OE.spot(M, p.fi || 0, 21);
    const rows = [['Pixel central', fx(G[c0 * nb + c0] * 100, 2) + ' %'], ['Meilleur carré 2×2', fx(q2 * 100, 2) + ' %'], ['Carré 3×3', fx(sum(1) * 100, 2) + ' %'], ['Carré 5×5', fx(sum(2) * 100, 2) + ' %'],
      ['Strehl', fx(ps.strehl, 3)], ['Q = λF / p', fx(lF / pm, 2) + (lF / pm >= 2 ? ' ✓ Nyquist' : ' < 2')], ['Ø Airy', fx(2.44 * lF / pm, 2) + ' px'], ['Spot RMS', fx(sp.rms / pm, 2) + ' px'],
      ['Nyquist détecteur', fx(1 / (2 * pm), 1) + ' cy/mm'], ['Coupure optique', fx(1 / lF, 1) + ' cy/mm']];
    const tx = x0 + sz + 18; kvList(c, tx, y0, w - tx - 10, rows, h - y0 - 8);
    text(c, 'valeurs en % de l\'énergie', x0, y0 + sz + 6, { col: TH.mut, size: 10 });
  },
  source(p, M0, c, w, h) {
    const S = src(), M = srcModel(), inf = M.objInf;
    if (S.type === 'fiber' && inf) { text(c, 'Fibre : placez l\'objet à distance finie (épaisseur de la surface 0).', 12, 12, { col: '#dc2626' }); return; }
    const st0 = S.type === 'none' ? 'point' : S.type;
    const o = st0 === 'fiber' ? { type: 'fiber', fib: S.fib, core: S.core, na: S.na, mfd: S.mfd } : { type: st0, d: S.d, na: S.na, w: S.w, h: S.h };
    if (st0 === 'disk' && (inf || !(S.na > 0))) delete o.na;
    const r = OE.extSource(M, p.fi || 0, o); if (!r) { text(c, 'Rayon principal vignetté pour ce champ', 12, 12, { col: '#dc2626' }); return; }
    const st = r.type, odraw = { d: r.dEff, w: S.w, h: S.h };
    const Q = r.Q, pu = r.pq * 1e3, half = Q / 2 * pu, cxu = r.cx * 1e3, cyu = r.cy * 1e3, ext = Math.min(half, Math.max(r.d95 * 1e3 * 0.75, r.fwhmX * 1e3 * 1.5, 3 * pu));
    const wl = Math.min(w * 0.5, h - 10);
    const A = axes(c, { x: 0, y: 0, w: wl, h: h - 4 }, [cxu - ext, cxu + ext], [cyu - ext, cyu + ext], { equal: true, xl: 'µm (plan image)', title: `Image de la source — champ ${fLabel(M, p.fi || 0)}`, ml: 44, zero: false });
    A.xr0 = -half - pu / 2; A.xr1 = half - pu / 2; A.yr0 = -half - pu / 2; A.yr1 = half - pu / 2;
    clip(c, A.P); heat(c, A, r.img, Q, Q, 0, r.peak, 'inferno', true);
    // contour géométrique de la source
    c.strokeStyle = 'rgba(255,255,255,.7)'; c.setLineDash([4, 3]); c.lineWidth = 1.2; c.beginPath();
    const J = r.J, pt = (u, v) => [A.X(J[0] * u * 1e3 + J[1] * v * 1e3), A.Y(J[2] * u * 1e3 + J[3] * v * 1e3)];
    if (st === 'rect') { [[1, 1], [-1, 1], [-1, -1], [1, -1], [1, 1]].forEach(([a, b], k) => { const q = pt(a * odraw.w / 2, b * odraw.h / 2); k ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); }); }
    else if (st !== 'point') { const rr = odraw.d / 2; for (let k = 0; k <= 64; k++) { const q = pt(rr * Math.cos(2 * Math.PI * k / 64), rr * Math.sin(2 * Math.PI * k / 64)); k ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); } }
    c.stroke(); c.setLineDash([]); c.restore();
    const d = det(); let inPix = null;
    if (d.on) {
      const b = OE.binImage(r.img, Q, r.pq, d.p * 1e-3, r.cx, r.cy, 1, 'centre'); inPix = b.G[0];
      if (p.pix) { const nb = Math.ceil(2 * ext / d.p) + 3, bb = OE.binImage(r.img, Q, r.pq, d.p * 1e-3, r.cx, r.cy, nb, 'centre'), m2 = Math.max(...bb.G), L = lut('inferno'); clip(c, A.P);
        for (let iy = 0; iy < nb; iy++) for (let ix = 0; ix < nb; ix++) { const k = Math.round(bb.G[iy * nb + ix] / m2 * 255); c.fillStyle = `rgb(${L[k * 3]},${L[k * 3 + 1]},${L[k * 3 + 2]})`; const x0 = A.X(cxu + (ix - (nb >> 1) - 0.5) * d.p), y0 = A.Y(cyu + (iy - (nb >> 1) + 0.5) * d.p); c.fillRect(x0, y0, A.X(d.p) - A.X(0) + 0.5, A.Y(0) - A.Y(d.p) + 0.5); } c.restore(); }
      const A2 = { ...A, xr: [cxu - ext - cxu, cxu + ext - cxu], yr: A.yr, X: v => A.X(v + cxu), Y: v => A.Y(v + cyu) }; A2.xr = [-ext, ext]; A2.yr = [-ext, ext]; pixGrid(c, A2, d.p, 'rgba(255,255,255,.3)');
    }
    // profils + métriques
    const B = axes(c, { x: wl + 6, y: 0, w: w - wl - 6, h: h * 0.36 }, [-ext, ext], [0, 1.05], { xl: 'µm', title: 'Profils X (plein) / Y (tirets)', ml: 34 });
    const xs = Array.from({ length: Q }, (_, k) => (k - Q / 2) * pu), mxx = Math.max(...r.px), mxy = Math.max(...r.py);
    pline(c, B, xs.map(v => v - cxu), Array.from(r.px, v => v / mxx), TH.acc, 1.8); pline(c, B, xs.map(v => v - cyu), Array.from(r.py, v => v / mxy), '#ea580c', 1.6, [5, 3]);
    const mag = Math.sqrt(Math.abs(r.J[0] * r.J[3] - r.J[1] * r.J[2])) * 1e3;
    const lines = [['Spectre', M.wls.length > 1 ? `${fmt(Math.min(...M.wls) * 1000, 5)} – ${fmt(Math.max(...M.wls) * 1000, 5)} nm` : `${fmt(M.wls[0] * 1000, 5)} nm`], ['Grandissement local', inf ? `${fx(mag, 4)} µm/″` : `× ${fx(mag, 4)}`], ['Taille géométrique', st === 'point' ? '—' : st === 'rect' ? `${fx(odraw.w * mag, 2)} × ${fx(odraw.h * mag, 2)} µm` : `Ø ${fx(odraw.d * mag, 2)} µm${st === 'gauss' ? ' (1/e²)' : ''}`],
      ['FWHM X / Y', `${fx(r.fwhmX * 1e3, 2)} / ${fx(r.fwhmY * 1e3, 2)} µm`], ['Ø 50 / 80 / 95 % énergie', `${fx(r.d50 * 1e3, 2)} / ${fx(r.d80 * 1e3, 2)} / ${fx(r.d95 * 1e3, 2)} µm`],
      ['Couplage dans le système', inf ? '—' : `${fx(r.coupling * 100, 1)} %${o.na > r.NAs && st !== 'gauss' ? ` (ON ${o.na} > ${fx(r.NAs, 3)})` : ''}`],
      ...(S.type === 'fiber' && S.len > 0 && S.att > 0 ? [['Transmission totale', `${fx(100 * r.coupling * Math.pow(10, -S.att * S.len / 1e4), 2)} % (fibre × couplage)`]] : []), ...(inPix != null ? [['Énergie dans 1 pixel', `${fx(inPix * 100, 1)} % (${d.p} µm)`], ['Taille image', `${fx(r.d80 * 1e3 / d.p, 2)} px (Ø80)`]] : [])];
    kvList(c, wl + 12, h * 0.39, w - wl - 20, lines, h * 0.61 - 6);
  },
  presc(p, M) {
    const S = M.S, par = M.par;
    const sp = M.sys.fields.map((_, i) => OE.spot(M, i, 21)), wf = M.sys.fields.map((_, i) => OE.wavefront(M, i, M.pw, 48));
    let h = `<h4 style="margin-top:0">${esc(M.sys.title || 'Système')}</h4><table><tr><th>#</th><th>Rayon</th><th>Épaisseur</th><th>Verre</th><th>nd</th><th>½Ø</th><th>Conique</th><th>Commentaire</th></tr>`;
    S.forEach((s, i) => { const nd = OE.isMirror(s) ? 'miroir' : OE.isAir(s.glass) ? '' : fx(OE.glassN(s.glass, 0.5875618), 5); h += `<tr><td>${i}${s.stop ? '*' : ''}</td><td>${fmt(s.r, 7)}</td><td>${fmt(s.t, 7)}${s.tsolve === 'M' ? ' M' : ''}</td><td style="text-align:left">${esc(s.glass)}</td><td>${nd}</td><td>${i ? fmt(s.sd, 5) : ''}</td><td>${s.k ? fmt(s.k, 6) : ''}</td><td style="text-align:left">${esc(s.comment)}</td></tr>`; });
    h += `</table><p class="hint">* diaphragme · M : solve de mise au point paraxiale</p>`;
    h += `<h4>Performances par champ (λ prim. ${fmt(M.wls[M.pw] * 1000, 5)} nm pour la WFE)</h4><table><tr><th>Champ</th><th>Spot RMS (µm)</th><th>Spot GEO (µm)</th><th>WFE RMS (λ)</th><th>WFE PV (λ)</th><th>Strehl (Maréchal)</th></tr>`;
    M.sys.fields.forEach((f, i) => h += `<tr><td>${fLabel(M, i)}</td><td>${fx(sp[i].rms * 1e3, 2)}</td><td>${fx(sp[i].geo * 1e3, 2)}</td><td>${fx(wf[i].rms, 4)}</td><td>${fx(wf[i].pv, 3)}</td><td>${fx(Math.exp(-((2 * Math.PI * wf[i].rms) ** 2)), 3)}</td></tr>`);
    h += `</table><h4>Paraxial</h4><table><tr><td style="text-align:left">EFL</td><td>${fx(par.efl, 4)}</td><td style="text-align:left">F/# travail</td><td>${fx(par.wfno, 3)}</td></tr><tr><td style="text-align:left">BFL</td><td>${fx(par.bfl, 4)}</td><td style="text-align:left">TTL</td><td>${fx(par.ttl, 3)}</td></tr><tr><td style="text-align:left">PE Ø / pos.</td><td>${fx(par.epd, 3)} / ${fx(par.zE, 3)}</td><td style="text-align:left">PS Ø / pos.</td><td>${fx(par.xpD, 3)} / ${fx(par.xpZ, 3)}</td></tr></table>`;
    return h;
  },
};
/* ---------------- Simulation d'image ---------------- */
const SIMSRC = [['mire', 'Mire USAF 1951'], ['lettres', 'Texte'], ['grille', 'Grille (distorsion)'], ['etoiles', 'Champ d\'étoiles'], ['siemens', 'Étoile de Siemens'], ['damier', 'Damier'], ['couleurs', 'Mire couleur']];
const SIM = { cache: new Map(), queue: new Map(), timer: null, force: false, forceKey: null };
function makeSource(kind) {
  if (kind === 'user' && App.userImg) return App.userImg;
  SIM.src = SIM.src || {}; if (SIM.src[kind]) return SIM.src[kind];
  if (kind === 'mire') { const cvm = document.createElement('canvas'); cvm.width = cvm.height = 1024; drawUSAF(cvm.getContext('2d'), 1024); return (SIM.src[kind] = imgToSrc(cvm, kind)); }
  const N = 512, cv = document.createElement('canvas'); cv.width = cv.height = N; const g = cv.getContext('2d');
  const W = '#fff', B = '#000';
  if (false) { }
  else if (kind === 'lettres') {
    g.fillStyle = W; g.fillRect(0, 0, N, N); g.fillStyle = B; let y = 56;
    for (const sz of [56, 40, 30, 22, 16, 12, 9, 7]) { g.font = `${sz}px Georgia, serif`; g.fillText('Focale optique', 18, y); y += sz * 1.3 + 6; }
  } else if (kind === 'grille') {
    g.fillStyle = B; g.fillRect(0, 0, N, N); g.strokeStyle = W; g.lineWidth = 3; g.beginPath(); for (let k = 0; k <= 16; k++) { const q = Math.min(N - 1.5, k * 32 + 1.5); g.moveTo(q, 0); g.lineTo(q, N); g.moveTo(0, q); g.lineTo(N, q); } g.stroke();
  } else if (kind === 'etoiles') {
    g.fillStyle = B; g.fillRect(0, 0, N, N); g.fillStyle = W; for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) g.fillRect(16 + j * 60, 16 + i * 60, 3, 3);
  } else if (kind === 'siemens') {
    g.fillStyle = W; g.fillRect(0, 0, N, N); g.fillStyle = B; const n = 48; for (let k = 0; k < n; k += 2) { g.beginPath(); g.moveTo(256, 256); g.arc(256, 256, 250, 2 * Math.PI * k / n, 2 * Math.PI * (k + 1) / n); g.fill(); }
  } else if (kind === 'damier') {
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { g.fillStyle = (i + j) & 1 ? B : W; g.fillRect(j * 64, i * 64, 64, 64); }
  } else if (kind === 'couleurs') {
    g.fillStyle = B; g.fillRect(0, 0, N, N); const cs = ['#ff0000', '#00ff00', '#0000ff', '#ffffff']; for (let k = 0; k < 4; k++) { g.fillStyle = cs[k]; for (let l = 0; l < 7; l++) g.fillRect(28 + l * 68, 28 + k * 118, 6, 96); }
  }
  return (SIM.src[kind] = imgToSrc(cv, kind));
}
/** mire de résolution type USAF 1951, disposition auto-similaire : à chaque niveau, groupe pair à gauche, groupe impair à droite,
 *  niveau suivant à mi-échelle au centre. Élément : 3 barres horizontales + 3 verticales de largeur l et de longueur 5 l, pas 2^(1/6). */
function drawUSAF(g, N) {
  g.fillStyle = '#fff'; g.fillRect(0, 0, N, N); g.fillStyle = '#000'; g.strokeStyle = '#000';
  const k0 = N / 1024;
  const el = (x, y, w) => { for (let k = 0; k < 3; k++) { g.fillRect(x, y + 2 * k * w, 5 * w, w); g.fillRect(x + 6 * w + 2 * k * w, y, w, 5 * w); } };
  const column = (grp, x0, y0, colW, F) => {
    const w0 = 20 * k0 * Math.pow(2, -grp); let y = y0 + 0.07 * F;
    const fs = Math.max(7, Math.round(F * 0.035));
    g.font = `bold ${Math.round(fs * 1.25)}px sans-serif`; g.textAlign = 'center'; g.fillText(String(grp), x0 + colW / 2, y0 + 0.055 * F); g.textAlign = 'left';
    for (let e = 0; e < 6; e++) {
      const w = w0 * Math.pow(2, -e / 6), ew = 11 * w, x = x0 + (colW - ew) / 2 - fs * 0.4;
      el(x, y, w); if (fs >= 7) { g.font = `${fs}px sans-serif`; g.fillText(String(e + 1), x + ew + 3, y + 5 * w * 0.85); }
      y += 6 * w + 0.012 * F;
    }
  };
  let F = N, ox = 0, oy = 0;
  for (let lev = 0; lev < 3; lev++) {
    column(2 * lev, ox + F * 0.01, oy, F * 0.24, F);
    column(2 * lev + 1, ox + F * 0.75, oy, F * 0.24, F);
    if (lev === 0) {
      g.font = `bold ${Math.round(30 * k0)}px sans-serif`; g.textAlign = 'center'; g.fillText('USAF 1951', N / 2, 0.09 * N); g.font = `${Math.round(17 * k0)}px sans-serif`; g.fillText('mire de résolution · Focale', N / 2, 0.125 * N); g.fillText('groupes 0 → 5 · pas 2^(1/6) entre éléments', N / 2, 0.155 * N); g.textAlign = 'left';
      g.save(); g.translate(0.37 * N, 0.865 * N); g.rotate(5 * Math.PI / 180); g.fillRect(-0.085 * N, -0.085 * N, 0.17 * N, 0.17 * N); g.restore();
      const cx = 0.63 * N, cy = 0.865 * N, R = 0.105 * N, n = 40; for (let k = 0; k < n; k += 2) { g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R, 2 * Math.PI * k / n, 2 * Math.PI * (k + 1) / n); g.fill(); }
    }
    g.lineWidth = Math.max(1, 2 * k0 * Math.pow(0.5, lev)); g.strokeRect(ox + F * 0.25, oy + F * 0.25, F * 0.5, F * 0.5);
    ox += F * 0.25; oy += F * 0.25; F /= 2;
  }
  // centre : étoile de Siemens miniature
  const cx = ox + F / 2, cy = oy + F / 2, R = F * 0.42, n = 24; for (let k = 0; k < n; k += 2) { g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R, 2 * Math.PI * k / n, 2 * Math.PI * (k + 1) / n); g.fill(); }
  g.lineWidth = 4 * k0; g.strokeRect(2, 2, N - 4, N - 4);
}
function imgToSrc(cv, name) {
  const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data, n = cv.width * cv.height, ch = [0, 1, 2].map(() => new Float32Array(n));
  for (let q = 0; q < n; q++) for (let k = 0; k < 3; k++) ch[k][q] = d[q * 4 + k] / 255;
  return { w: cv.width, h: cv.height, ch, name, cv };
}
function loadUserImage(file) {
  const rd = new FileReader();
  rd.onload = () => { const im = new Image(); im.onload = () => { const sc = 256 / Math.max(im.width, im.height), cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(im.width * sc)); cv.height = Math.max(1, Math.round(im.height * sc)); cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height); App.userImg = imgToSrc(cv, file.name); if (App.simPane != null) { App.panes[App.simPane].src = 'user'; renderPane(App.simPane); } }; im.src = rd.result; };
  rd.readAsDataURL(file);
}
function simPane(p, M, c, w, h) {
  const src = makeSource(p.src || 'mire'), size = p.res || 192, fm = p.fov || (M.par.fmax > 1e-6 ? M.par.fmax : 1);
  const dd = det(), onDet = dd.on && p.det !== false, pixD = onDet ? dd.p * 1e-3 : 0;
  const key = toJSON(App.sys) + '|' + [p.src, size, fm, pixD].join('|') + (p.src === 'user' && App.userImg ? App.userImg.name : '');
  const half = w / 2, pad = 26, box = Math.min(half - 20, h - pad - 24);
  const drawSrc = () => { c.imageSmoothingEnabled = true; c.drawImage(src.cv, 10 + (half - 20 - box) / 2, pad, box * src.w / Math.max(src.w, src.h), box * src.h / Math.max(src.w, src.h)); text(c, `Objet — ½ champ ${fmt(fm, 4)}${M.objInf ? '°' : ' mm'}`, 10, 6, { b: true }); };
  drawSrc();
  const res = SIM.cache.get(key); p._key = key;
  const drawRes = (r, stale) => {
    if (!r) { text(c, 'Image impossible (champ entièrement vignetté ?)', half + 10, pad, { col: '#dc2626' }); return; }
    const S = r.S, off = document.createElement('canvas'); off.width = off.height = S; const oc = off.getContext('2d'), im = oc.createImageData(S, S);
    const W2 = onDet ? dd.nx * dd.p * 5e-4 : Infinity, H2 = onDet ? dd.ny * dd.p * 5e-4 : Infinity;
    if (onDet && dd.noise && !r.noisy) { // bruit de photons + lecture + quantification
      const g = () => { let u = 0; for (let k = 0; k < 6; k++) u += Math.random(); return (u - 3) * Math.SQRT2; }, Nmax = dd.fw * dd.lvl / 100, lv = Math.pow(2, dd.bits) - 1;
      r.noisy = r.ch.map(a => Float32Array.from(a, v => { const N = Math.max(0, v) * Nmax; let e = N + Math.sqrt(N) * g() + dd.rn * g(); e = Math.max(0, Math.min(dd.fw, e)); return Math.round(e / dd.fw * lv) / lv * dd.fw / Nmax; }));
    }
    const chs = onDet && dd.noise && r.noisy ? r.noisy : r.ch;
    for (let q = 0; q < S * S; q++) {
      const row = Math.floor(q / S), col = q % S, x = -r.H + (col + 0.5) * r.pix, y = r.H - (row + 0.5) * r.pix, outS = Math.abs(x) > W2 || Math.abs(y) > H2;
      const qq = p.upright ? S * S - 1 - q : q; for (let k = 0; k < 3; k++) im.data[qq * 4 + k] = outS ? 18 : Math.max(0, Math.min(255, Math.round(chs[k][q] * 255))); im.data[qq * 4 + 3] = 255;
    }
    oc.putImageData(im, 0, 0); c.imageSmoothingEnabled = S < box; c.globalAlpha = stale ? 0.45 : 1; c.drawImage(off, half + 10, pad, box, box); c.globalAlpha = 1;
    text(c, `${onDet ? 'Image sur le détecteur' : 'Image simulée'}${p.upright ? ' (redressée)' : ''} — ${fx(2 * r.H, 3)} mm${onDet ? (r.under ? ` · affichage ${S} px (1 point ≈ ${fx(r.pix / pixD, 1)} pixels)` : ` · ${S}×${S} pixels de ${dd.p} µm`) : ''}`, half + 10, 6, { b: true });
    if (onDet) { const sc = box / (2 * r.H), W2c = Math.min(W2, r.H), H2c = Math.min(H2, r.H); c.strokeStyle = '#ea580c'; c.setLineDash([5, 3]); c.lineWidth = 1.4; c.strokeRect(half + 10 + (r.H - W2c) * sc, pad + (r.H - H2c) * sc, 2 * W2c * sc, 2 * H2c * sc); c.setLineDash([]); }
    const sl = niceStep(2 * r.H, 4), L = sl / (2 * r.H) * box; c.strokeStyle = TH.fg; c.lineWidth = 2; c.beginPath(); c.moveTo(half + 10, pad + box + 10); c.lineTo(half + 10 + L, pad + box + 10); c.stroke();
    text(c, `${tl(sl, sl)} mm · PSF ${r.K}×${r.K} px · ${r.chW.length ? 'RVB = ' + [...new Set(r.chW)].length + ' λ' : ''}`, half + 16 + L, pad + box + 4, { col: TH.mut, size: 10.5 });
  };
  if (SIM.cache.has(key) && !(SIM.force && SIM.forceKey === key)) { drawRes(res, false); return; }
  if (p._last) drawRes(p._last, true);
  text(c, 'Calcul…', half + 14, pad + box / 2, { col: TH.mut });
  SIM.queue.set(key, { p, src, size, fm, pix: pixD });
  clearTimeout(SIM.timer); SIM.timer = setTimeout(simRun, SIM.force ? 10 : 450);
}
function simRun() {
  const it = SIM.queue.entries().next(); if (it.done) return;
  const [key, job] = it.value; SIM.queue.delete(key); SIM.force = false; SIM.forceKey = null;
  let r = null; try { r = OE.imageSim(App.M, job.src, { size: job.size, fm: job.fm, pix: job.pix, maxS: Math.max(256, job.size * 2) }); } catch (e) { console.error(e); }
  SIM.cache.set(key, r); job.p._last = r; while (SIM.cache.size > 8) SIM.cache.delete(SIM.cache.keys().next().value);
  $$('#panes .pane').forEach(d => { if (App.panes[+d.dataset.i] === job.p) renderPane(+d.dataset.i); });
  if (SIM.queue.size) SIM.timer = setTimeout(simRun, 20);
}
/** liste libellé / valeur : sur une ligne si la largeur le permet, sinon empilée */
function kvList(c, x, y, w, rows, maxH) {
  c.save(); c.font = '11px Inter, sans-serif'; const lw = Math.max(...rows.map(r => c.measureText(r[0]).width)); c.font = '11px JetBrains Mono, monospace'; const vw = Math.max(...rows.map(r => c.measureText(r[1]).width)); c.restore();
  const one = lw + vw + 16 <= w, lh = one ? 18 : 30, step = maxH ? Math.min(lh, maxH / rows.length) : lh;
  rows.forEach(([a, v], k) => {
    const yy = y + k * step;
    if (one) { text(c, a, x, yy, { col: TH.mut, size: 11 }); text(c, v, x + w, yy, { mono: true, size: 11, align: 'right' }); }
    else { text(c, a, x, yy, { col: TH.mut, size: 10.5 }); text(c, v, x, yy + 13, { mono: true, size: 11 }); }
  });
}
/** grille de pixels du détecteur sur un repère A (unités : µm), centrée sur 0 */
function pixGrid(c, A, pUm, col) {
  const xr = [Math.min(A.xr[0], A.xr[1]), Math.max(A.xr[0], A.xr[1])], yr = [Math.min(A.yr[0], A.yr[1]), Math.max(A.yr[0], A.yr[1])];
  if (Math.abs(A.X(pUm) - A.X(0)) < 4) return false;
  clip(c, A.P); c.strokeStyle = col || 'rgba(120,140,170,.45)'; c.lineWidth = 0.8; c.beginPath();
  for (let k = Math.ceil(xr[0] / pUm - 0.5); k * pUm - pUm / 2 <= xr[1]; k++) { const x = A.X(k * pUm - pUm / 2); c.moveTo(x, A.P.y); c.lineTo(x, A.P.y + A.P.h); }
  for (let k = Math.ceil(yr[0] / pUm - 0.5); k * pUm - pUm / 2 <= yr[1]; k++) { const y = A.Y(k * pUm - pUm / 2); c.moveTo(A.P.x, y); c.lineTo(A.P.x + A.P.w, y); }
  c.stroke(); c.restore(); return true;
}
function fans(c, w, h, M, data, k, unit) {
  const nf = data.length, rowH = (h - 18) / nf;
  let m = 0; data.forEach(d => d.forEach(q => { for (const v of [...q.T, ...q.S]) if (isFinite(v)) m = Math.max(m, Math.abs(v * k)); })); m = (m || 1e-6) * 1.08;
  data.forEach((d, fi) => {
    ['T', 'S'].forEach((ax, j) => {
      const A = axes(c, { x: j * w / 2, y: fi * rowH, w: w / 2, h: rowH }, [-1, 1], [-m, m], { title: `${ax === 'T' ? 'Tangentiel' : 'Sagittal'} · ${fLabel(M, fi)}`, ml: 46, mb: fi === nf - 1 ? 20 : 16, yl: j === 0 ? (unit === 'µm' ? (ax === 'T' ? 'εy (µm)' : '') : 'W (λ)') : '' });
      d.forEach(q => pline(c, A, q.P, q[ax].map(v => v * k), wlCol(M.wls[q.wi]), 1.6));
    });
  });
  legend(c, 8, h - 7, [...wlLegend(M), { col: TH.mut, l: unit === 'µm' ? 'abscisse : pupille normalisée Py / Px' : 'OPD, abscisse : Py / Px' }]);
}

/* ---------------- Optimisation ---------------- */
const OPT = { running: false, st: null, hist: [], it: 0, snap: null };
function openOptim() {
  const s = App.sys, vars = OE.getVars(s), mf = s.merit;
  const vlab = v => `${{ c: 'C', t: 'T', k: 'K' }[v.kind]}${v.si}`;
  const ops = Object.entries(OE.OPS);
  dlg(`<h2>Optimisation — moindres carrés amortis <button class="x" data-d="close">✕</button></h2>
  <div class="db">
    <div class="hint">Variables (cliquez sur <b>V</b> dans l'éditeur de lentilles pour en ajouter ; C = courbure, T = épaisseur, K = conique) :</div>
    <div class="vars">${vars.length ? vars.map(v => `<span>${vlab(v)}</span>`).join('') : '<em class="hint">aucune variable définie</em>'}</div>
    <div class="row"><label style="flex:none;width:160px">Critère de qualité image</label><select class="in" id="mfImg"><option value="SPOT" ${mf.image === 'SPOT' ? 'selected' : ''}>Spot RMS (centroïde)</option><option value="WFE" ${mf.image === 'WFE' ? 'selected' : ''}>Front d'onde RMS</option><option value="NONE" ${mf.image === 'NONE' ? 'selected' : ''}>Aucun</option></select>
    <span class="hint">quadrature de Gauss 3 anneaux × 8 bras, tous champs et λ pondérés</span></div>
    <table class="mt" style="margin-top:8px"><tr><th>Opérande</th><th>Cible</th><th>Poids</th><th></th></tr>
      ${mf.ops.map((o, i) => `<tr><td><select class="in" data-o="type" data-i="${i}">${ops.map(([k, v]) => `<option value="${k}" ${k === o.type ? 'selected' : ''}>${k} — ${v.label}</option>`).join('')}</select></td><td><input class="in" data-o="target" data-i="${i}" value="${o.target}"></td><td><input class="in" data-o="weight" data-i="${i}" value="${o.weight}"></td><td><button class="x" data-d="odel" data-i="${i}">✕</button></td></tr>`).join('')}
    </table><button class="add" data-d="oadd">+ Ajouter un opérande</button>
    <div style="display:flex;gap:16px;align-items:center;margin-top:12px">
      <div style="flex:none;width:150px"><div class="hint">Fonction de mérite</div><div class="big" id="mval">—</div><div class="hint" id="mit"></div></div>
      <div style="flex:1;min-width:0;height:140px;position:relative"><canvas id="mchart"></canvas></div>
    </div>
    <div class="row"><label style="flex:none">Itérations max</label><input class="in mini" id="maxIt" value="100"></div>
  </div>
  <div class="df"><span class="hint grow" id="omsg"></span>
    <button class="bt" data-d="revert">Restaurer l'état initial</button>
    <button class="bt" data-d="stop">Arrêter</button>
    <button class="tb pri" data-d="run">▶ Optimiser</button></div>`);
  const r = OE.residuals(s); $('#mval').textContent = r ? OE.meritOf(r.f).toExponential(4) : '—';
  OPT.hist = r ? [OE.meritOf(r.f)] : []; drawMerit();
}
function dlg(html, wide) { $('#dlg').innerHTML = html; $('#dlg').classList.toggle('wide', !!wide); $('#modal').classList.add('open'); }
function closeDlg() { $('#modal').classList.remove('open'); OPT.running = false; if (typeof TOL !== 'undefined') TOL.running = false; }
function setupDlg() {
  $('#modal').addEventListener('mousedown', e => { if (e.target.id === 'modal') closeDlg(); });
  $('#dlg').addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.t) {
      const k = t.dataset.t, ty = t.dataset.k;
      commit(s => { tolCfg(); const c = s.tol; if (k === 'on') c.types[ty].on = t.checked; else if (k === 'v') { const v = parseNum(t.value, false); if (isFinite(v) && v >= 0) c.types[ty].v = v; } else if (k === 'comp') c.comp = t.checked; else if (k === 'trials') c.trials = Math.max(5, parseInt(t.value) || 100); else c[k] = t.value; });
      TOL.stale = !!(TOL.sens || TOL.mc); renderTolRes(); return;
    }
    if (t.id === 'mfImg') { commit(s => s.merit.image = t.value, { fast: false }); openOptim(); }
    if (t.dataset.o) { const i = +t.dataset.i, k = t.dataset.o; commit(s => s.merit.ops[i][k] = k === 'type' ? t.value : (parseFloat(String(t.value).replace(',', '.')) || 0)); openOptim(); }
  });
  $('#dlg').addEventListener('click', e => {
    const b = e.target.closest('[data-d]'); if (!b) return;
    const a = b.dataset.d;
    if (a === 'close') closeDlg();
    if (a === 'tsens') runSens();
    if (a === 'tmc') runMC();
    if (a === 'tstop') TOL.running = false;
    if (a === 'tcopy') { const r = tolReport(); navigator.clipboard?.writeText(r).then(() => toast('Rapport copié (CSV)'), () => download(fileBase() + '_tolerances.txt', r, 'text/plain')); }
    if (a === 'oadd') { commit(s => s.merit.ops.push({ type: 'EFL', target: Math.round(App.M?.par?.efl || 100), weight: 1 })); openOptim(); }
    if (a === 'odel') { commit(s => s.merit.ops.splice(+b.dataset.i, 1)); openOptim(); }
    if (a === 'run') runOpt();
    if (a === 'stop') { OPT.running = false; }
    if (a === 'revert') { if (OPT.snap) { OPT.running = false; App.sys = fromJSON(OPT.snap); pushHist(); refresh(); toast('État initial restauré'); openOptim(); } }
    if (a === 'copy') { const ta = $('#dlg textarea'); navigator.clipboard?.writeText(ta.value).then(() => toast('Copié dans le presse-papiers'), () => { ta.select(); toast('Sélectionné — Ctrl+C pour copier'); }); }
    if (a === 'fmtjson') { $('#exTxt').value = toJSON(App.sys); $('#exHint').textContent = 'JSON Focale (format natif complet).'; }
    if (a === 'fmtseq') { const r = IO.toSeq(App.sys); $('#exTxt').value = r.text; $('#exHint').textContent = r.warnings.length ? '⚠ ' + r.warnings.join(' · ') : 'CODE V séquentiel (.seq).'; }
    if (a === 'fmtzmx') { const r = IO.toZMX(App.sys); $('#exTxt').value = r.text; $('#exHint').textContent = r.warnings.length ? '⚠ ' + r.warnings.join(' · ') : 'Zemax OpticStudio séquentiel (.zmx).'; }
    if (a === 'pick') $('#fileIn').click();
    if (a === 'load') { importFile('', $('#imTxt').value); }
    if (a === 'agf') $('#fileIn').click();
  });
}
function runOpt() {
  if (OPT.running) return;
  if (!OE.getVars(App.sys).length) { $('#omsg').textContent = 'Définissez au moins une variable (bouton V).'; return; }
  OPT.snap = toJSON(App.sys); OPT.st = { sys: structuredClone(App.sys), mu: 1e-3 }; OPT.it = 0; OPT.running = true;
  const maxIt = Math.max(1, parseInt($('#maxIt').value) || 100);
  $('#omsg').textContent = 'Optimisation en cours…';
  let lastPane = 0;
  const loop = () => {
    if (!OPT.running) { finish('Arrêté'); return; }
    const t = performance.now(); let r;
    do { r = OE.optStep(OPT.st); OPT.it++; if (r.merit != null) OPT.hist.push(r.merit); } while (!r.done && OPT.it < maxIt && performance.now() - t < 90);
    App.sys = OPT.st.sys; App.M = OE.prepare(App.sys); renderLDE(); renderSide(); drawLayout();
    if (performance.now() - lastPane > 600) { renderPanes(); lastPane = performance.now(); }
    const mv = $('#mval'); if (mv) { mv.textContent = (OPT.st.merit ?? r.merit ?? 0).toExponential(4); $('#mit').textContent = `itération ${OPT.it}`; drawMerit(); }
    if (r.done || OPT.it >= maxIt) { OPT.running = false; finish(r.msg || (OPT.it >= maxIt ? 'Nombre max d\'itérations atteint' : 'Convergé')); return; }
    setTimeout(loop, 0);
  };
  const finish = (msg) => { pushHist(); refresh({ fast: true }); const o = $('#omsg'); if (o) o.textContent = msg + ` — ${OPT.it} itérations`; toast('Optimisation : ' + msg); };
  setTimeout(loop, 0);
}
function drawMerit() {
  const cv = $('#mchart'); if (!cv) return; readTheme(); const { c, w, h } = prepCanvas(cv);
  const H = OPT.hist.filter(isFinite); if (H.length < 1) return;
  const ly = H.map(v => Math.log10(Math.max(v, 1e-12)));
  const A = axes(c, { x: 0, y: 0, w, h }, [0, Math.max(1, H.length - 1)], range([ly], 0.1), { ml: 36, mb: 18, title: 'log₁₀(mérite)' });
  pline(c, A, ly.map((_, i) => i), ly, TH.acc, 2);
}

/* ---------------- Tolérancement ---------------- */
const TOL = { running: false, sens: null, mc: null, stale: false };
const tick = () => new Promise(r => setTimeout(r, 0));
function tolCfg() { const d = OE.tolDefaults(), s = App.sys; s.tol = { ...d, ...(s.tol || {}) }; s.tol.types = { ...d.types, ...(s.tol.types || {}) }; return s.tol; }
const tolUnit = k => k === 'SPOT' ? 'µm' : 'λ';
function openTol() {
  const c = tolCfg();
  const rows = Object.entries(OE.TOLT).map(([k, v]) => `<tr><td><input type="checkbox" data-t="on" data-k="${k}" ${c.types[k].on ? 'checked' : ''}></td><td title="${v.desc || ''}">${v.label}</td><td><input class="in" style="width:70px" data-t="v" data-k="${k}" value="${c.types[k].v}"></td><td class="hint">± ${v.unit}</td></tr>`).join('');
  dlg(`<h2>Tolérancement <button class="x" data-d="close">✕</button></h2>
  <div class="db"><div style="display:grid;grid-template-columns:300px 1fr;gap:18px">
    <div>
      <div class="row"><label>Critère</label><select class="in" data-t="crit"><option value="WFE" ${c.crit === 'WFE' ? 'selected' : ''}>Front d'onde RMS (λ)</option><option value="SPOT" ${c.crit === 'SPOT' ? 'selected' : ''}>Spot RMS (µm)</option></select></div>
      <div class="row"><label title="L'épaisseur avant l'image est réoptimisée pour chaque tirage">Compensateur : mise au point</label><input type="checkbox" data-t="comp" ${c.comp ? 'checked' : ''}></div>
      <table class="mt" style="margin-top:6px"><tr><th></th><th>Tolérance</th><th>Valeur</th><th></th></tr>${rows}</table>
      <div class="hint" style="margin:10px 0 4px;font-weight:600;color:var(--fg)">Monte-Carlo</div>
      <div class="row"><label>Tirages</label><input class="in mini" data-t="trials" value="${c.trials}"></div>
      <div class="row"><label>Distribution</label><select class="in" data-t="dist"><option value="normal" ${c.dist === 'normal' ? 'selected' : ''}>Gaussienne (σ = tol/2, tronquée)</option><option value="uniform" ${c.dist === 'uniform' ? 'selected' : ''}>Uniforme</option><option value="end" ${c.dist === 'end' ? 'selected' : ''}>Extrêmes (± tol)</option></select></div>
      <div class="hint" style="margin-top:8px">Rayon en % de R, épaisseurs et décentrements en mm, bascules en degrés. Les bascules d'élément pivotent autour du sommet de sa première surface.</div>
    </div>
    <div id="tolres" style="min-width:0"></div>
  </div></div>
  <div class="df"><span class="hint grow" id="tmsg"></span><button class="bt" data-d="tcopy">Copier le rapport</button><button class="bt" data-d="tstop">Arrêter</button><button class="bt" data-d="tsens">Analyse de sensibilité</button><button class="tb pri" data-d="tmc">▶ Monte-Carlo</button></div>`, true);
  renderTolRes();
}
function tolMsg(t) { const e = $('#tmsg'); if (e) e.textContent = t; }
async function runSens() {
  if (TOL.running) return; const c = structuredClone(tolCfg()); TOL.running = true; TOL.stale = false; tolMsg('Préparation (mise au point nominale)…'); await tick();
  const B = OE.tolBase(App.sys, c.crit, c.comp), items = OE.tolItems(B.base, c), rows = [];
  let tl = performance.now();
  for (let i = 0; i < items.length && TOL.running; i++) {
    const it = items[i], r = [1, -1].map(sg => OE.tolEval(OE.tolApply(structuredClone(B.base), it, sg * it.tol), c.crit, c.comp, B.h0));
    rows.push({ it, cp: r[0].c, cm: r[1].c, fp: r[0].dt, fm: r[1].dt });
    if (performance.now() - tl > 70) { TOL.sens = { B, rows, c, n: items.length }; renderTolRes(); tolMsg(`Sensibilité : ${i + 1} / ${items.length}`); await tick(); tl = performance.now(); }
  }
  TOL.sens = { B, rows, c, n: items.length }; TOL.running = false; renderTolRes(); tolMsg(`Sensibilité terminée — ${rows.length} tolérances`);
}
async function runMC() {
  if (TOL.running) return; const c = structuredClone(tolCfg()); TOL.running = true; TOL.stale = false; tolMsg('Préparation…'); await tick();
  const B = OE.tolBase(App.sys, c.crit, c.comp), items = OE.tolItems(B.base, c), n = Math.max(5, Math.min(5000, +c.trials || 100));
  const vals = [], foc = []; TOL.mc = { B, vals, foc, c, n };
  let tl = performance.now();
  for (let k = 0; k < n && TOL.running; k++) {
    const s = structuredClone(B.base); for (const it of items) OE.tolApply(s, it, it.tol * OE.tolDraw(c.dist, Math.random));
    const r = OE.tolEval(s, c.crit, c.comp, B.h0); if (isFinite(r.c)) { vals.push(r.c); foc.push(r.dt); }
    if (performance.now() - tl > 90) { renderTolRes(); tolMsg(`Monte-Carlo : ${k + 1} / ${n}`); await tick(); tl = performance.now(); }
  }
  TOL.running = false; renderTolRes(); tolMsg(`Monte-Carlo terminé — ${vals.length} tirages`);
}
const pct = (arr, q) => { if (!arr.length) return NaN; const a = arr.slice().sort((x, y) => x - y), i = Math.min(a.length - 1, Math.max(0, q * (a.length - 1))), lo = Math.floor(i), f = i - lo; return a[lo] * (1 - f) + (a[lo + 1] ?? a[lo]) * f; };
function renderTolRes() {
  const el = $('#tolres'); if (!el) return;
  let h = '';
  const S = TOL.sens, MC = TOL.mc;
  if (TOL.stale) h += '<div class="hint" style="color:var(--warn)">Le système ou les réglages ont changé depuis le dernier calcul.</div>';
  if (!S && !MC) h += `<div class="hint" style="padding:30px 0">Lancez une <b>analyse de sensibilité</b> (chaque tolérance seule, à ±) puis un <b>Monte-Carlo</b> (toutes les tolérances tirées au hasard simultanément) pour estimer le rendement de fabrication.</div>`;
  if (S) {
    const u = tolUnit(S.c.crit), rows = S.rows.map(r => ({ ...r, dp: r.cp - S.B.nominal, dm: r.cm - S.B.nominal })).map(r => ({ ...r, w: Math.max(r.dp, r.dm) }));
    const rss = S.B.nominal + Math.sqrt(rows.reduce((a, r) => a + Math.max(0, r.w) ** 2, 0));
    const top = rows.slice().sort((a, b) => b.w - a.w), mx = Math.max(1e-12, ...top.map(r => Math.abs(r.w)));
    h += `<div style="display:flex;gap:24px;margin-bottom:8px"><div><div class="hint">Nominal${S.c.comp ? ' (compensé)' : ''}</div><div class="big">${fx(S.B.nominal, 4)} ${u}</div></div><div><div class="hint">Estimation RSS</div><div class="big">${fx(rss, 4)} ${u}</div></div>${S.c.comp ? `<div><div class="hint">Mise au point nominale</div><div class="big">${fx(S.B.focus * 1e3, 1)} µm</div></div>` : ''}</div>
    <div class="hint">Sensibilités triées (${rows.length}/${S.n}) — Δ = critère perturbé − nominal</div>
    <div style="max-height:250px;overflow:auto;border:1px solid var(--line);border-radius:8px"><table class="mt" style="font-size:12px"><tr><th>Tolérance</th><th>Valeur</th><th>Δ (+)</th><th>Δ (−)</th><th style="width:110px"></th>${S.c.comp ? '<th>Foyer (µm)</th>' : ''}</tr>
    ${top.map(r => `<tr><td>${esc(r.it.label)}</td><td style="font-family:var(--mono)">±${r.it.tol}</td><td style="font-family:var(--mono)">${fx(r.dp, 4)}</td><td style="font-family:var(--mono)">${fx(r.dm, 4)}</td><td><div style="height:7px;border-radius:3px;background:${r.w > 0 ? '#ea580c' : '#16a34a'};width:${Math.max(2, Math.abs(r.w) / mx * 100)}px"></div></td>${S.c.comp ? `<td style="font-family:var(--mono)">${fx(r.fp * 1e3, 0)} / ${fx(r.fm * 1e3, 0)}</td>` : ''}</tr>`).join('')}</table></div>`;
  }
  if (MC) {
    const u = tolUnit(MC.c.crit), v = MC.vals, mean = v.reduce((a, b) => a + b, 0) / (v.length || 1), sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, v.length - 1));
    h += `<div class="hint" style="margin-top:12px;font-weight:600;color:var(--fg)">Monte-Carlo — ${v.length} / ${MC.n} tirages · nominal ${fx(MC.B.nominal, 4)} ${u}</div>
    <div style="display:flex;gap:14px;align-items:stretch;margin-top:4px"><div style="flex:1;min-width:0;height:180px;position:relative"><canvas id="mcchart"></canvas></div>
    <table class="mt" style="width:auto;font-family:var(--mono);font-size:12px"><tr><th>Statistique</th><th>${u}</th></tr>
    <tr><td>Moyenne</td><td>${fx(mean, 4)}</td></tr><tr><td>Écart-type</td><td>${fx(sd, 4)}</td></tr>
    ${[0.5, 0.8, 0.9, 0.98].map(q => `<tr><td>${q * 100} % &lt;</td><td>${fx(pct(v, q), 4)}</td></tr>`).join('')}
    <tr><td>Max</td><td>${fx(Math.max(...v), 4)}</td></tr>${MC.c.comp ? `<tr><td>Compensateur</td><td>${fx(Math.min(...MC.foc) * 1e3, 0)}…${fx(Math.max(...MC.foc) * 1e3, 0)} µm</td></tr>` : ''}</table></div>`;
  }
  el.innerHTML = h;
  if (MC && MC.vals.length) drawMC();
}
function drawMC() {
  const cv = $('#mcchart'); if (!cv) return; readTheme(); const { c, w, h } = prepCanvas(cv), MC = TOL.mc, v = MC.vals.slice().sort((a, b) => a - b);
  const lo = Math.min(MC.B.nominal, v[0]), hi = v[v.length - 1], nb = Math.max(8, Math.min(30, Math.round(Math.sqrt(v.length) * 1.5))), bw = (hi - lo) / nb || 1;
  const bins = new Array(nb).fill(0); for (const x of v) bins[Math.min(nb - 1, Math.floor((x - lo) / bw))]++;
  const A = axes(c, { x: 0, y: 0, w, h }, [lo, hi + 1e-12], [0, Math.max(...bins) * 1.1], { xl: tolUnit(MC.c.crit) + ' RMS', ml: 36, mb: 30 });
  c.fillStyle = TH.acc; c.globalAlpha = 0.55; bins.forEach((b, i) => { const x0 = A.X(lo + i * bw), x1 = A.X(lo + (i + 1) * bw); c.fillRect(x0 + 0.5, A.Y(b), x1 - x0 - 1, A.Y(0) - A.Y(b)); }); c.globalAlpha = 1;
  const yc = A.Y, mxb = Math.max(...bins) * 1.1; c.strokeStyle = '#ea580c'; c.lineWidth = 1.8; c.beginPath(); v.forEach((x, i) => { const px = A.X(x), py = yc((i + 1) / v.length * mxb); i ? c.lineTo(px, py) : c.moveTo(px, py); }); c.stroke();
  c.strokeStyle = TH.fg; c.setLineDash([3, 3]); c.beginPath(); c.moveTo(A.X(MC.B.nominal), A.P.y); c.lineTo(A.X(MC.B.nominal), A.P.y + A.P.h); c.stroke(); c.setLineDash([]);
  text(c, 'histogramme · cumul (orange) · nominal (pointillé)', A.P.x + 4, A.P.y + 2, { col: TH.mut, size: 10 });
}
function tolReport() {
  const L = [`Focale — rapport de tolérancement — ${App.sys.title || ''}`];
  if (TOL.sens) { const S = TOL.sens, u = tolUnit(S.c.crit); L.push('', `Critère : ${S.c.crit} (${u}), compensateur : ${S.c.comp ? 'mise au point' : 'aucun'}`, `Nominal : ${S.B.nominal.toFixed(5)}`, '', 'Tolérance;Valeur;Δ+;Δ-');
    S.rows.forEach(r => L.push(`${r.it.label};±${r.it.tol};${(r.cp - S.B.nominal).toFixed(5)};${(r.cm - S.B.nominal).toFixed(5)}`)); }
  if (TOL.mc) { const M = TOL.mc; L.push('', `Monte-Carlo : ${M.vals.length} tirages, distribution ${M.c.dist}`); [0.5, 0.8, 0.9, 0.98].forEach(q => L.push(`${q * 100}% < ${pct(M.vals, q).toFixed(5)}`)); }
  return L.join('\n');
}

/* ---------------- Import / export (JSON, CODE V .seq) ---------------- */
/** rapport d'import / export (avertissements de conversion) */
function ioReport(title, warnings, extra = '') {
  if (!warnings || !warnings.length) return;
  dlg(`<h2>${esc(title)} <button class="x" data-d="close">✕</button></h2><div class="db">${extra}
    <div class="hint" style="margin-bottom:6px">${warnings.length} point(s) à vérifier :</div>
    <ul style="margin:0;padding-left:18px;font-size:12.5px;line-height:1.6">${warnings.map(w => `<li>${esc(w)}</li>`).join('')}</ul></div>
    <div class="df"><button class="tb pri" data-d="close">OK</button></div>`);
}
function importText(t, name = '') {
  try {
    const kind = IO.detect(name, t); let s, W = [];
    if (kind === 'agf') { importAGF(name, t); return; }
    if (kind === 'json') s = fromJSON(t.trim());
    else if (kind === 'zmx') ({ sys: s, warnings: W } = IO.parseZMX(t));
    else ({ sys: s, warnings: W } = IO.parseSeq(t));
    if (!s.surfaces || s.surfaces.length < 3) throw new Error('Pas de surfaces');
    closeDlg(); rebuildGlassList(); loadSystem(s, `${({ zmx: 'Fichier Zemax', seq: 'Fichier CODE V', json: 'Système' })[kind]} importé${W.length ? ` — ${W.length} remarque(s)` : ''}`);
    if (W.length) ioReport(`Import ${kind === 'zmx' ? 'Zemax' : 'CODE V'}${name ? ' — ' + name : ''}`, W);
  } catch (e) { console.error(e); toast('Import impossible : ' + e.message, 4000); }
}
function exportAs(kind, dl = true) {
  const r = kind === 'zmx' ? IO.toZMX(App.sys) : IO.toSeq(App.sys), ext = kind === 'zmx' ? '.zmx' : '.seq';
  if (dl) { download(fileBase() + ext, r.text, 'text/plain'); toast(`Export ${kind === 'zmx' ? 'Zemax' : 'CODE V'} téléchargé`); }
  if (r.warnings.length) ioReport(`Export ${kind === 'zmx' ? 'Zemax (.zmx)' : 'CODE V (.seq)'}`, r.warnings, dl ? '' : '');
  return r.text;
}
function openExport() {
  const seg = (k, l, on) => `<button ${on ? 'class="on"' : ''} data-d="fmt${k}" onclick="this.parentNode.querySelectorAll('button').forEach(b=>b.classList.remove('on'));this.classList.add('on')">${l}</button>`;
  dlg(`<h2>Exporter <button class="x" data-d="close">✕</button></h2><div class="db">
  <div class="seg" style="margin-bottom:8px">${seg('json', 'JSON Focale', true)}${seg('zmx', 'Zemax (.zmx)')}${seg('seq', 'CODE V (.seq)')}</div>
  <textarea id="exTxt" spellcheck="false">${esc(toJSON(App.sys))}</textarea>
  <div class="hint" id="exHint">Copiez le contenu dans un fichier, ou utilisez Fichier → Exporter pour télécharger directement.</div></div>
  <div class="df"><button class="tb pri" data-d="copy">Copier</button></div>`);
}
function openImport() {
  dlg(`<h2>Importer un système <button class="x" data-d="close">✕</button></h2><div class="db">
  <div class="hint">Collez un fichier <b>Zemax OpticStudio (.zmx)</b>, <b>CODE V (.seq)</b> ou JSON Focale — le format est reconnu automatiquement — ou choisissez un fichier (les .zmx en UTF-16 sont pris en charge).</div>
  <textarea id="imTxt" spellcheck="false" placeholder="VERS …&#10;MODE SEQ&#10;SURF 0 …   (Zemax)&#10;&#10;RDM;LEN&#10;EPD 10 …&#10;SO 0 1e18&#10;S 22.01 3.26 NSK16_SCHOTT …   (CODE V)"></textarea></div>
  <div class="df"><button class="bt" data-d="pick">Choisir un fichier…</button><button class="tb pri" data-d="load">Importer</button></div>`);
}
function openHelp(id) {
  const nav = HELP.map(x => `<button class="hn" data-h="${x.id}">${x.t}</button>`).join('');
  dlg(`<h2>Aide de Focale <span class="hint" style="font-weight:400;margin-left:10px">version ${FOCALE_VERSION}</span><button class="x" data-d="close">✕</button></h2>
  <div class="db" style="display:grid;grid-template-columns:220px 1fr;gap:16px;height:min(72vh,760px);padding-bottom:0">
    <div style="display:flex;flex-direction:column;min-height:0"><input class="in" id="hq" placeholder="Rechercher dans l'aide…" style="margin-bottom:6px"><div id="hnav" style="overflow:auto">${nav}</div></div>
    <div id="hbody" class="help" style="overflow:auto;padding-right:8px"></div></div>`, true);
  const show = hid => {
    const q = $('#hq').value.trim().toLowerCase(), items = q ? HELP.filter(x => (x.t + ' ' + x.h.replace(/<[^>]+>/g, ' ')).toLowerCase().includes(q)) : HELP.filter(x => x.id === (hid || 'demarrage'));
    $$('#hnav .hn').forEach(b => { b.classList.toggle('on', !q && b.dataset.h === (hid || 'demarrage')); b.style.display = !q || items.some(x => x.id === b.dataset.h) ? '' : 'none'; });
    let html = items.map(x => `<h3>${x.t}</h3>${x.h}`).join('<hr>') || '<p class="hint">Aucun résultat.</p>';
    if (q) { const re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi'); html = html.replace(/>([^<]+)</g, (m, t) => '>' + t.replace(re, '<mark>$1</mark>') + '<'); }
    $('#hbody').innerHTML = html; $('#hbody').scrollTop = 0;
  };
  $('#hnav').addEventListener('click', e => { const b = e.target.closest('[data-h]'); if (b) { $('#hq').value = ''; show(b.dataset.h); } });
  $('#hq').addEventListener('input', () => show());
  show(id); $('#hq').focus();
}
/* ---------------- Fichiers (ouvrir / enregistrer / glisser-déposer) ---------------- */
const FS = { handle: null };
const TOP = (() => { try { return window.top === window; } catch (e) { return false; } })();
const fileBase = () => (App.sys.title || 'systeme').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w\-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'systeme';
function sysJSON() { const s = structuredClone(App.sys); if (typeof usedUserGlasses === 'function') { const u = usedUserGlasses(s); if (Object.keys(u).length) s.userGlass = u; } return toJSON(s); }
function download(name, text, type = 'application/json') {
  const b = text instanceof Blob ? text : new Blob([text], { type }), a = document.createElement('a');
  a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
async function openFile() {
  if (window.showOpenFilePicker && TOP) {
    try {
      const [h] = await showOpenFilePicker({ types: [{ description: 'Systèmes optiques et catalogues', accept: { 'application/json': ['.json'], 'text/plain': ['.zmx', '.seq', '.agf', '.txt'] } }] });
      const f = await h.getFile(); await readAndImport(f); FS.handle = /\.json$/i.test(f.name) ? h : null;
    } catch (e) { if (e.name !== 'AbortError') toast('Ouverture impossible : ' + e.message); }
  } else $('#fileIn').click();
}
async function saveFile(as) {
  const txt = sysJSON();
  if (window.showSaveFilePicker && TOP) {
    try {
      if (!FS.handle || as) FS.handle = await showSaveFilePicker({ suggestedName: fileBase() + '.json', types: [{ description: 'Système Focale', accept: { 'application/json': ['.json'] } }] });
      const w = await FS.handle.createWritable(); await w.write(txt); await w.close(); toast('Enregistré : ' + FS.handle.name); return;
    } catch (e) { if (e.name === 'AbortError') return; }
  }
  download(fileBase() + '.json', txt); toast('Fichier ' + fileBase() + '.json téléchargé' + (TOP ? '' : ' (si rien ne se passe, utilisez Fichier → Afficher / copier)'), 4000);
}
function importFile(name, t) { importText(t, name); }
/** lit un fichier (UTF-8, UTF-16…) puis l'importe */
async function readAndImport(f) { importFile(f.name, IO.decode(await f.arrayBuffer())); }
let deferredInstall = null;
function setupPlatform() {
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; $('#btnInstall').style.display = ''; });
  window.addEventListener('appinstalled', () => { $('#btnInstall').style.display = 'none'; toast('Focale est installé'); });
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && TOP) {
    navigator.serviceWorker.register('sw.js').then(reg => {
      reg.addEventListener('updatefound', () => { const nw = reg.installing; if (nw && navigator.serviceWorker.controller) nw.addEventListener('statechange', () => { if (nw.state === 'activated') toast('Focale a été mis à jour', 4000); }); });
      setInterval(() => reg.update().catch(() => { }), 3600e3);
    }).catch(() => { });
  }
  if ('launchQueue' in window) launchQueue.setConsumer(async params => { for (const h of params.files || []) { const f = await h.getFile(); await readAndImport(f); if (/\.json$/i.test(f.name)) FS.handle = h; } });
  let dn = 0; const drop = $('#drop');
  window.addEventListener('dragenter', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { dn++; drop.classList.add('on'); } });
  window.addEventListener('dragleave', () => { if (--dn <= 0) { dn = 0; drop.classList.remove('on'); } });
  window.addEventListener('dragover', e => e.preventDefault());
  window.addEventListener('drop', e => { e.preventDefault(); dn = 0; drop.classList.remove('on'); const f = e.dataTransfer.files[0]; if (f) readAndImport(f); });
}
function openAbout() {
  dlg(`<h2>À propos de Focale <button class="x" data-d="close">✕</button></h2><div class="db" style="font-size:13px;line-height:1.6">
  <p><b>Focale</b> — logiciel de conception optique séquentielle. Version <code>${FOCALE_VERSION}</code>.</p>
  <p>Code source : <a href="https://github.com/KarimHX4/focale" target="_blank" rel="noopener">github.com/KarimHX4/focale</a>. Installé comme application (bouton « Installer » dans Chrome/Edge), Focale fonctionne hors ligne et se met à jour automatiquement à chaque nouvelle version publiée.</p>
  <p class="hint">Données de verres : base refractiveindex.info (domaine public, CC0), d'après les catalogues des fabricants.</p></div>`);
}

/* ---------------- Initialisation ---------------- */
function init() {
  loadStoredAGF(); rebuildGlassList();
  $('#mSamp').innerHTML = Object.keys(SAMPLES).map(k => `<button data-samp="${esc(k)}">${esc(k)}</button>`).join('');
  load();
  if (!App.sys) App.sys = normalize(SAMPLES['Triplet de Cooke f=50 F/5']());
  App.showAsph = App.sys.surfaces.some(s => s.a4 || s.a6 || s.a8 || s.a10); $('#showAsph').checked = App.showAsph;
  setupLDE(); setupSide(); setupLayout(); setupPanes(); setupDlg();
  pushHist(); buildPanes(); refresh();
  // header
  document.addEventListener('click', e => {
    const mb = e.target.closest('[data-menu]');
    $$('.menu').forEach(m => { if (!mb || m.id !== mb.dataset.menu) m.classList.remove('open'); });
    if (mb) { $('#' + mb.dataset.menu).classList.toggle('open'); return; }
    const sb = e.target.closest('[data-samp]'); if (sb) { loadSystem(SAMPLES[sb.dataset.samp](), 'Exemple chargé'); return; }
    const a = e.target.closest('[data-act]'); if (!a) return;
    switch (a.dataset.act) {
      case 'new': FS.handle = null; loadSystem({ title: 'Nouveau système', aperture: { type: 'EPD', value: 10, obscuration: 0 }, fields: [{ y: 0, w: 1 }, { y: 5, w: 1 }], wavelengths: [{ um: 0.4861327, w: 1 }, { um: 0.5875618, w: 1 }, { um: 0.6562725, w: 1 }], primary: 1, rayAiming: false, merit: { image: 'SPOT', ops: [] },
        surfaces: [newSurf({ t: Infinity, comment: 'Objet' }), newSurf({ r: 50, t: 4, glass: 'N-BK7', stop: true }), newSurf({ r: -50, t: 45, tsolve: 'M' }), newSurf({ t: 0, comment: 'Image' })] }, 'Nouveau système'); break;
      case 'import': openImport(); break;
      case 'export': openExport(); break;
      case 'open': openFile(); break;
      case 'save': saveFile(false); break;
      case 'saveAs': saveFile(true); break;
      case 'dlSeq': exportAs('seq'); break;
      case 'dlZmx': exportAs('zmx'); break;
      case 'about': openAbout(); break;
      case 'install': if (deferredInstall) { deferredInstall.prompt(); deferredInstall.userChoice.finally(() => { deferredInstall = null; $('#btnInstall').style.display = 'none'; }); } break;
      case 'undo': undo(); break; case 'redo': redo(); break;
      case 'optim': openOptim(); break;
      case 'tol': openTol(); break;
      case 'glasses': openGlasses(); break;
      case 'theme': { const d = document.documentElement; d.dataset.theme = d.dataset.theme === 'dark' ? '' : 'dark'; save(); readTheme(); drawLayout(); renderPanes(); break; }
      case 'help': openHelp(); break;
      case 'fit': fitView(); break;
      default: lde(a.dataset.act);
    }
  });
  $('#gridSeg').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { App.grid = +b.dataset.g; save(); buildPanes(); } });
  $('#laySeg').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; App.mode = b.dataset.m; drawLayout(); });
  $('#nRays').addEventListener('change', e => { App.nRays = +e.target.value; drawLayout(); });
  $('#showAsph').addEventListener('change', e => { App.showAsph = e.target.checked; renderLDE(); });
  $('#fileIn').addEventListener('change', e => { const f = e.target.files[0]; if (!f) return; readAndImport(f); e.target.value = ''; });
  setupPlatform();
  const ii = document.createElement('input'); ii.type = 'file'; ii.accept = 'image/*'; ii.id = 'imgIn'; ii.style.display = 'none'; document.body.appendChild(ii);
  ii.addEventListener('change', e => { const f = e.target.files[0]; if (f) loadUserImage(f); e.target.value = ''; });
  document.addEventListener('keydown', e => {
    const inInput = e.target.closest && e.target.closest('input,textarea,select');
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !inInput) { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y' && !inInput) { e.preventDefault(); redo(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') { e.preventDefault(); e.shiftKey ? openOptim() : openFile(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveFile(e.shiftKey); }
    else if (e.key === 'F1') { e.preventDefault(); openHelp(); }
    else if (e.key === 'Insert') { e.preventDefault(); lde('insA'); }
    else if ((e.ctrlKey || e.metaKey) && e.key === 'Delete') { e.preventDefault(); lde('del'); }
    else if (e.key === 'Escape') { closeDlg(); $$('.pane.max').forEach(p => { p.classList.remove('max'); renderPane(+p.dataset.i); }); }
  });
  // séparateurs
  const drag = (el, fn) => el.addEventListener('mousedown', e => { e.preventDefault(); el.classList.add('drag'); const mv = ev => fn(ev); const up = () => { el.classList.remove('drag'); window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); drawLayout(); renderPanes(); }; window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up); });
  drag($('#hs'), ev => { const r = $('#center').getBoundingClientRect(); const v = Math.max(80, Math.min(r.height - 120, ev.clientY - r.top)); $('#center').style.setProperty('--ldeh', v + 'px'); });
  drag($('#vs'), ev => { const r = $('#ws').getBoundingClientRect(); const v = Math.max(280, Math.min(r.width - 600, r.right - ev.clientX)); $('#ws').style.setProperty('--anw', v + 'px'); });
}
init();
