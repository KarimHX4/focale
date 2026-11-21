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
const newSurf = (o = {}) => ({ r: Infinity, t: 5, glass: '', sd: 0, sdFixed: false, k: 0, a4: 0, a6: 0, a8: 0, a10: 0, stop: false, comment: '', vr: false, vt: false, vk: false, tsolve: '', ...o });

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
  s.fields = (s.fields && s.fields.length) ? s.fields : [{ y: 0, w: 1 }];
  s.wavelengths = (s.wavelengths && s.wavelengths.length) ? s.wavelengths : [{ um: 0.5875618, w: 1 }];
  s.primary = Math.min(Math.max(0, s.primary | 0), s.wavelengths.length - 1);
  s.merit = s.merit || { image: 'SPOT', ops: [] }; s.merit.ops = s.merit.ops || [];
  s.surfaces = s.surfaces.map(x => newSurf(x));
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
  <span class="grow"></span><span>${extra || ''}</span><span>calcul <span class="k">${(App.lastPanes || 0).toFixed(0)} ms</span></span>`;
}

/* ---------------- Éditeur de lentilles ---------------- */
function renderLDE() {
  const S = App.sys.surfaces, N = S.length - 1, MS = App.M && App.M.ok ? App.M.S : null;
  const asph = App.showAsph;
  const tg = (i, k, lbl, on, cls = '', title = '') => `<button class="tg ${cls} ${on ? 'on' : ''}" data-tog="${k}" data-i="${i}" title="${title}">${lbl}</button>`;
  let h = `<thead><tr><th>#</th><th>Type</th><th>Commentaire</th><th>Rayon</th><th>Épaisseur</th><th>Verre</th><th>Demi-diamètre</th><th>Conique</th>${asph ? '<th>A4 (r⁴)</th><th>A6 (r⁶)</th><th>A8 (r⁸)</th><th>A10 (r¹⁰)</th>' : ''}</tr></thead><tbody>`;
  S.forEach((s, i) => {
    const obj = i === 0, img = i === N, mir = OE.isMirror(s);
    const badge = obj ? '<span class="b">OBJ</span>' : img ? '<span class="b">IMA</span>' : s.stop ? '<span class="b st">STO</span>' : mir ? '<span class="b mi">MIR</span>' : '';
    const tVal = MS ? MS[i].t : s.t, sdVal = MS ? MS[i].sd : s.sd;
    const gOK = mir || OE.isAir(s.glass) || isFinite(OE.glassN(s.glass, 0.5876));
    h += `<tr data-i="${i}" class="${i === App.sel ? 'sel' : ''}">
      <td class="n">${i}</td><td class="ty">${badge}</td>
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
  drawLayout();
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
  const el = document.activeElement; const keep = el && el.closest && el.closest('#side') && el.dataset.f ? el.dataset.f : null;
  let h = card('gen', 'Système', `
    <div class="row"><input class="in" style="flex:1" data-f="title" value="${esc(s.title)}" placeholder="Titre du système"></div>`);
  h += card('ap', 'Ouverture', `
    <div class="row"><select class="in" style="flex:1" data-f="apType">${apOpts.map(o => `<option value="${o[0]}" ${o[0] === ap.type ? 'selected' : ''}>${o[1]}</option>`).join('')}</select></div>
    <div class="row"><label>Valeur</label><input class="in mini" data-f="apVal" value="${fmt(ap.value, 6)}"></div>
    <div class="row"><label>Obstruction centrale (rayon rel.)</label><input class="in mini" data-f="obs" value="${fmt(ap.obscuration || 0, 4)}"></div>
    <div class="row"><label title="Itère sur chaque rayon pour viser exactement le diaphragme">Visée réelle des rayons (ray aiming)</label><input type="checkbox" data-f="aim" ${s.rayAiming ? 'checked' : ''}></div>`);
  h += card('fi', `Champs — ${objInf ? 'angle (°)' : 'hauteur objet (mm)'}`, `
    <table class="mt"><tr><th></th><th>${objInf ? 'Angle Y (°)' : 'Hauteur Y (mm)'}</th><th>Poids</th><th></th></tr>
    ${s.fields.map((f, i) => `<tr><td><span class="sw" style="background:${fcol(i)}"></span></td><td><input class="in" data-f="fy" data-i="${i}" value="${fmt(f.y, 6)}"></td><td><input class="in" data-f="fw" style="width:56px" data-i="${i}" value="${fmt(f.w ?? 1, 4)}"></td><td><button class="x" data-a="fdel" data-i="${i}" title="Supprimer">✕</button></td></tr>`).join('')}
    </table><button class="add" data-a="fadd">+ Ajouter un champ</button>
    <div class="chips"><button class="chip" data-a="fspread">Répartir 0 · 0.7 · 1</button></div>`);
  h += card('wl', 'Longueurs d\'onde (µm)', `
    <table class="mt"><tr><th></th><th>λ (µm)</th><th>Poids</th><th title="Primaire">Prim.</th><th></th></tr>
    ${s.wavelengths.map((w, i) => `<tr><td><span class="sw" style="background:${wlCol(w.um)}"></span></td><td><input class="in" data-f="wum" data-i="${i}" value="${fmt(w.um, 7)}"></td><td><input class="in" data-f="ww" style="width:48px" data-i="${i}" value="${fmt(w.w ?? 1, 4)}"></td><td style="text-align:center"><input type="radio" name="prim" data-f="wp" data-i="${i}" ${i === s.primary ? 'checked' : ''}></td><td><button class="x" data-a="wdel" data-i="${i}">✕</button></td></tr>`).join('')}
    </table><button class="add" data-a="wadd">+ Ajouter une longueur d'onde</button>
    <div class="chips"><button class="chip" data-a="wpre" data-v="FdC">F, d, C</button><button class="chip" data-a="wpre" data-v="vis">Visible</button><button class="chip" data-a="wpre" data-v="hene">632,8 nm</button><button class="chip" data-a="wpre" data-v="nir">NIR</button><button class="chip" data-a="wpre" data-v="d">d seule</button></div>`);
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
  if (keep) { const e = $(`#side [data-f="${keep}"]`); if (e) e.focus(); }
  status();
}
function setupSide() {
  const side = $('#side');
  side.addEventListener('click', e => {
    const h3 = e.target.closest('h3'); if (h3) { const c = h3.parentElement; c.classList.toggle('closed'); c.classList.contains('closed') ? closedCards.add(c.dataset.card) : closedCards.delete(c.dataset.card); return; }
    const b = e.target.closest('[data-a]'); if (!b) return; const i = +b.dataset.i;
    switch (b.dataset.a) {
      case 'fadd': commit(s => { const m = Math.max(...s.fields.map(f => f.y)); s.fields.push({ y: +(m * 1.2 || 1).toFixed(4), w: 1 }); }); break;
      case 'fdel': if (App.sys.fields.length > 1) commit(s => s.fields.splice(i, 1)); break;
      case 'fspread': commit(s => { const m = Math.max(...s.fields.map(f => Math.abs(f.y))) || 1; s.fields = [0, 0.7, 1].map(k => ({ y: +(m * k).toPrecision(6), w: 1 })); }); break;
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
  const S = M.S, N = M.N, zg = M.zg, surfs = [];
  for (let j = 1; j <= N; j++) {
    const sf = M.ctxs[M.pw].s[j], sd = S[j].sd || 1, pts = [];
    for (let k = 0; k <= 40; k++) { const y = -sd + 2 * sd * k / 40; const z = OE.sag(sf, y * y); pts.push([zg[j] + (isFinite(z) ? z : 0), y]); }
    surfs.push({ j, pts, sd, sf });
  }
  let zmin = Math.min(...zg.slice(1)), zmax = Math.max(...zg.slice(1)), ymax = Math.max(...S.slice(1).map(s => s.sd || 1));
  for (const s of surfs) for (const p of s.pts) { zmin = Math.min(zmin, p[0]); zmax = Math.max(zmax, p[0]); }
  const span = Math.max(zmax - zmin, ymax * 2, 1e-3);
  const fin = !M.objInf && M.t0 < 4 * span && M.t0 > 0;
  const lead = fin ? M.t0 : 0.18 * span;
  if (fin) zmin = Math.min(zmin, -M.t0);
  M.geom = { surfs, zmin: zmin - (fin ? 0 : lead), zmax, ymax, span, lead, fin };
  return M.geom;
}
function layoutRays(M, n, three) {
  const out = [], S = M.sys, G = layoutGeom(M);
  S.fields.forEach((f, fi) => {
    const fans = three ? [[0, 1], [1, 0]] : [[0, 1]];
    for (const [ax, ay] of fans) for (let k = 0; k < n; k++) {
      const p = n === 1 ? 0 : -1 + 2 * k / (n - 1);
      if (Math.abs(p) < M.obs - 1e-9) continue;
      const pts = []; const r = OE.ray(M, M.pw, f.y, p * ax, p * ay, { pts });
      if (!pts.length) continue;
      let p0;
      if (M.objInf) { const th = f.y * OE.DEG, d = [0, Math.sin(th), Math.cos(th)], q = pts[0]; const L = G.lead + (q[2] - M.zg[1]); p0 = [q[0] - d[0] * L, q[1] - d[1] * L, q[2] - d[2] * L]; }
      else if (G.fin) p0 = [0, f.y, -M.t0];
      else { const q = pts[0], o = [0, f.y, -M.t0]; let d = [q[0] - o[0], q[1] - o[1], q[2] - o[2]]; const dn = Math.hypot(...d); d = d.map(v => v / dn); p0 = [q[0] - d[0] * G.lead, q[1] - d[1] * G.lead, q[2] - d[2] * G.lead]; }
      out.push({ fi, pts: [p0, ...pts], vig: r.vig });
    }
  });
  return out;
}
function drawLayout() {
  readTheme();
  const cv = $('#lay'), { c, w, h } = prepCanvas(cv), M = App.M;
  $('#legend').innerHTML = App.sys.fields.map((f, i) => `<span><span class="sw" style="background:${fcol(i)}"></span> ${fmt(f.y, 4)}${M && M.objInf ? '°' : ' mm'}</span>`).join('');
  $$('#laySeg button').forEach(x => x.classList.toggle('on', x.dataset.m === App.mode));
  if (!M || !M.ok) { text(c, (M && M.errors || ['Erreur']).join('  ·  '), 14, 14, { col: '#dc2626' }); return; }
  const G = layoutGeom(M);
  if (App.mode === '3d') return draw3D(c, w, h, M, G);
  const V = App.view;
  if (V.auto) { const zr = G.zmax - G.zmin, yr = 2 * G.ymax * 1.15; V.s = Math.min((w - 40) / (zr || 1), (h - 30) / (yr || 1)); V.ox = 20 - G.zmin * V.s + ((w - 40) - zr * V.s) / 2; V.oy = h / 2; }
  const T = (z, y) => [V.ox + z * V.s, V.oy - y * V.s];
  App.layT = T;
  // axe
  c.strokeStyle = TH.line; c.setLineDash([6, 4]); c.beginPath(); c.moveTo(0, V.oy); c.lineTo(w, V.oy); c.stroke(); c.setLineDash([]);
  const S = M.S, N = M.N;
  // lentilles
  for (let j = 1; j < N; j++) {
    if (OE.isAir(S[j].glass) || OE.isMirror(S[j])) continue;
    const a = G.surfs[j - 1], b = G.surfs[j], H = Math.max(a.sd, b.sd);
    const za = a.pts[a.pts.length - 1][0], zb = b.pts[b.pts.length - 1][0];
    const poly = [[za, H], ...a.pts.slice().reverse(), [za, -H], [zb, -H], ...b.pts, [zb, H]];
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
    c.strokeStyle = sel ? '#f59e0b' : (mir ? TH.fg : TH.lensE); c.lineWidth = sel ? 2.6 : (mir ? 2.2 : (s.j === N ? 1.6 : 1.2));
    if (s.j === N && !sel) c.strokeStyle = TH.mut;
    if (OE.isAir(S[s.j].glass) && (s.j === 1 || OE.isAir(S[s.j - 1].glass)) && !mir && s.j !== N && !sel && !S[s.j].stop) { c.strokeStyle = TH.mut; c.setLineDash([3, 3]); c.lineWidth = 0.8; }
    c.beginPath(); s.pts.forEach((p, k) => { const q = T(p[0], p[1]); k ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); }); c.stroke(); c.setLineDash([]);
    if (mir) { // hachures
      const dir = Math.sign(M.nW[M.pw][s.j - 1]) || 1; c.strokeStyle = TH.mut; c.lineWidth = 0.8; c.beginPath();
      for (let k = 0; k < s.pts.length; k += 3) { const q = T(s.pts[k][0], s.pts[k][1]); c.moveTo(q[0], q[1]); c.lineTo(q[0] + dir * 6, q[1] - 5); } c.stroke();
    }
    if (S[s.j].stop) { const e = s.pts[s.pts.length - 1], z = e[0]; c.strokeStyle = TH.fg; c.lineWidth = 2.5; for (const sg of [1, -1]) { const q1 = T(z, sg * s.sd), q2 = T(z, sg * s.sd * 1.18 + sg * 3 / V.s); c.beginPath(); c.moveTo(q1[0], q1[1]); c.lineTo(q2[0], q2[1]); c.stroke(); } }
  }
  if (G.fin) { const q = T(-M.t0, 0); c.fillStyle = TH.mut; c.fillRect(q[0] - 1, q[1] - 30, 2, 60); }
  // échelle
  const sl = niceStep(G.span, 4); const L = sl * V.s; c.strokeStyle = TH.mut; c.lineWidth = 1.2; c.beginPath(); c.moveTo(w - 16 - L, h - 14); c.lineTo(w - 16, h - 14); c.moveTo(w - 16 - L, h - 18); c.lineTo(w - 16 - L, h - 10); c.moveTo(w - 16, h - 18); c.lineTo(w - 16, h - 10); c.stroke();
  text(c, `${tl(sl, sl)} mm`, w - 16 - L / 2, h - 30, { col: TH.mut, align: 'center', size: 10.5 });
}
function draw3D(c, w, h, M, G) {
  const V = App.view, ca = Math.cos(V.yaw), sa = Math.sin(V.yaw), cb = Math.cos(V.pitch), sb = Math.sin(V.pitch);
  const zc = (G.zmin + G.zmax) / 2;
  const P = (x, y, z) => { z -= zc; const sx = z * ca - x * sa, dep = z * sa + x * ca, sy = y * cb + dep * sb; return [sx, sy]; };
  const sc = (V.s3 || 1) * Math.min((w - 40) / ((G.zmax - G.zmin) * 1.05 || 1), (h - 30) / (2.6 * G.ymax || 1));
  const T = (x, y, z) => { const p = P(x, y, z); return [w / 2 + p[0] * sc + (V.px3 || 0), h / 2 - p[1] * sc + (V.py3 || 0)]; };
  const S = M.S, N = M.N;
  c.lineWidth = 1;
  // rayons
  const rays = layoutRays(M, Math.max(3, App.nRays), true);
  c.globalAlpha = 0.85;
  for (const r of rays) { c.strokeStyle = fcol(r.fi); c.beginPath(); r.pts.forEach((p, k) => { const q = T(p[0], p[1], p[2]); k ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); }); c.stroke(); }
  c.globalAlpha = 1;
  // surfaces : contours + méridiens
  for (const s of G.surfs) {
    const sel = s.j === App.sel, mir = OE.isMirror(S[s.j]), sd = s.sd, sf = s.sf, z0 = M.zg[s.j];
    const zs = OE.sag(sf, sd * sd), ze = isFinite(zs) ? zs : 0;
    c.strokeStyle = sel ? '#f59e0b' : mir ? TH.fg : s.j === N ? TH.mut : TH.lensE; c.lineWidth = sel ? 2.2 : 1.1;
    c.beginPath(); for (let k = 0; k <= 64; k++) { const a = 2 * Math.PI * k / 64; const q = T(sd * Math.cos(a), sd * Math.sin(a), z0 + ze); k ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); } c.stroke();
    c.globalAlpha = 0.5; c.lineWidth = 0.8;
    for (let m = 0; m < 4; m++) { const a = Math.PI * m / 4; c.beginPath(); for (let k = 0; k <= 30; k++) { const r = -sd + 2 * sd * k / 30, x = r * Math.cos(a), y = r * Math.sin(a), z = OE.sag(sf, r * r); const q = T(x, y, z0 + (isFinite(z) ? z : 0)); k ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); } c.stroke(); }
    c.globalAlpha = 1;
  }
  // bords des lentilles
  for (let j = 1; j < N; j++) {
    if (OE.isAir(S[j].glass) || OE.isMirror(S[j])) continue;
    const a = G.surfs[j - 1], b = G.surfs[j], H = Math.max(a.sd, b.sd);
    const za = M.zg[j] + (OE.sag(a.sf, a.sd * a.sd) || 0), zb = M.zg[j + 1] + (OE.sag(b.sf, b.sd * b.sd) || 0);
    c.strokeStyle = TH.lensE; c.globalAlpha = 0.6;
    for (let m = 0; m < 8; m++) { const t = 2 * Math.PI * m / 8; const q1 = T(H * Math.cos(t), H * Math.sin(t), za), q2 = T(H * Math.cos(t), H * Math.sin(t), zb); c.beginPath(); c.moveTo(q1[0], q1[1]); c.lineTo(q2[0], q2[1]); c.stroke(); }
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
  if (t.f) { p.fi = Math.min(p.fi || 0, s.fields.length - 1); h += `<select data-p="fi">${s.fields.map((f, i) => `<option value="${i}" ${i === p.fi ? 'selected' : ''}>Champ ${i + 1} (${fmt(f.y, 4)}${M && M.objInf ? '°' : ' mm'})</option>`).join('')}</select>`; }
  if (t.w) { if (p.wi != null && p.wi >= s.wavelengths.length) p.wi = null; const we = p.wi ?? s.primary; h += `<select data-p="wi">${s.wavelengths.map((w, i) => `<option value="${i}" ${i === we ? 'selected' : ''}>${fmt(w.um * 1000, 5)} nm</option>`).join('')}</select>`; }
  if (t.s) h += `<select data-p="si"><option value="">Surface sélectionnée</option>${s.surfaces.map((x, i) => i ? `<option value="${i}" ${p.si === i ? 'selected' : ''}>Surface ${i}${x.comment ? ' · ' + esc(x.comment) : ''}</option>` : '').join('')}</select>`;
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
    else if (k === 'log' || k === 'tilt' || k === 'chief') p[k] = t.checked;
    else if (k === 'si') p.si = t.value === '' ? null : +t.value;
    else if (k === 'fmax') { const v = parseFloat(t.value); p.fmax = isFinite(v) && v > 0 ? v : null; }
    else p[k] = +t.value;
    save(); renderPane(pi);
  });
  el.addEventListener('click', e => {
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
const fLabel = (M, i) => `${fmt(M.sys.fields[i].y, 4)}${M.objInf ? '°' : ' mm'}`;
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
      const cols = M.wls.map(wlCol);
      for (const q of s.pts) { c.fillStyle = cols[q.wi]; c.fillRect(A.X((q.x - ref[i][0]) * 1e3) - 1, A.Y((q.y - ref[i][1]) * 1e3) - 1, 2, 2); }
      c.restore();
      text(c, `RMS ${fx(s.rms * 1e3, 2)} µm`, A.P.x, A.P.y + A.P.h + 16, { col: TH.fg, size: 10.5, mono: true });
      text(c, `GEO ${fx(s.geo * 1e3, 2)} µm${s.nv ? ' · vign. ' + Math.round(100 * s.nv / s.ntot) + '%' : ''}`, A.P.x, A.P.y + A.P.h + 29, { col: TH.mut, size: 10.5, mono: true });
    });
    legend(c, 8, h - 10, [...wlLegend(M), { col: TH.mut, dash: [3, 3], l: `Airy r=${fx(sp[0].airy * 1e3, 2)} µm` }]);
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
  },
  mtf(p, M, c, w, h) {
    const res = M.sys.fields.map((_, i) => OE.mtf(M, i, { fmax: p.fmax }));
    const f = res[0].f;
    const A = axes(c, { x: 0, y: 0, w, h: h - 18 }, [0, f[f.length - 1]], [0, 1.02], { xl: 'Fréquence spatiale (cycles/mm)', yl: 'Module FTM', title: 'FTM polychromatique (diffraction)' });
    pline(c, A, f, res[0].DL, TH.fg, 1.2, [2, 2]);
    res.forEach((r, i) => { pline(c, A, r.f, r.T, fcol(i), 1.7); pline(c, A, r.f, r.S, fcol(i), 1.7, [6, 4]); });
    legend(c, 8, h - 8, [{ col: TH.fg, dash: [2, 2], l: 'Limite de diffraction' }, { col: TH.mut, l: 'Tangentiel' }, { col: TH.mut, dash: [6, 4], l: 'Sagittal' }, ...M.sys.fields.map((_, i) => ({ col: fcol(i), l: fLabel(M, i) }))]);
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
    m *= 1.08;
    const A = axes(c, { x: 0, y: 0, w, h: h - 18 }, [-m, m], [-m, m], { equal: true, xl: 'X (mm)', title: `Surface ${si}${M.S[si].comment ? ' · ' + M.S[si].comment : ''} — ½Ø ${fx(fp.sd, 3)} mm${M.S[si].sdFixed ? ' (fixe)' : ''}` });
    c.strokeStyle = TH.fg; c.lineWidth = 1.4; c.beginPath(); c.arc(A.X(0), A.Y(0), A.X(fp.sd) - A.X(0), 0, 2 * Math.PI); c.stroke();
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
    const cat = OE.catalog(), used = new Set(M.S.map(s => OE.glassKey(s.glass)).filter(Boolean));
    const A = axes(c, { x: 0, y: 0, w, h }, [100, 15], [1.4, 2.05], { xl: 'Constringence νd', yl: 'nd', title: 'Carte des verres du catalogue (verres utilisés en orange)' });
    for (const g of cat) { const u = used.has(g.name); c.fillStyle = u ? '#ea580c' : TH.acc; c.beginPath(); c.arc(A.X(g.vd), A.Y(g.nd), u ? 5 : 3.5, 0, 7); c.fill(); text(c, g.name, A.X(g.vd) + 6, A.Y(g.nd) - 6, { size: 10, col: u ? '#ea580c' : TH.mut, b: u }); }
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
function dlg(html) { $('#dlg').innerHTML = html; $('#modal').classList.add('open'); }
function closeDlg() { $('#modal').classList.remove('open'); OPT.running = false; }
function setupDlg() {
  $('#modal').addEventListener('mousedown', e => { if (e.target.id === 'modal') closeDlg(); });
  $('#dlg').addEventListener('change', e => {
    const t = e.target;
    if (t.id === 'mfImg') { commit(s => s.merit.image = t.value, { fast: false }); openOptim(); }
    if (t.dataset.o) { const i = +t.dataset.i, k = t.dataset.o; commit(s => s.merit.ops[i][k] = k === 'type' ? t.value : (parseFloat(String(t.value).replace(',', '.')) || 0)); openOptim(); }
  });
  $('#dlg').addEventListener('click', e => {
    const b = e.target.closest('[data-d]'); if (!b) return;
    const a = b.dataset.d;
    if (a === 'close') closeDlg();
    if (a === 'oadd') { commit(s => s.merit.ops.push({ type: 'EFL', target: Math.round(App.M?.par?.efl || 100), weight: 1 })); openOptim(); }
    if (a === 'odel') { commit(s => s.merit.ops.splice(+b.dataset.i, 1)); openOptim(); }
    if (a === 'run') runOpt();
    if (a === 'stop') { OPT.running = false; }
    if (a === 'revert') { if (OPT.snap) { OPT.running = false; App.sys = fromJSON(OPT.snap); pushHist(); refresh(); toast('État initial restauré'); openOptim(); } }
    if (a === 'copy') { const ta = $('#dlg textarea'); navigator.clipboard?.writeText(ta.value).then(() => toast('Copié dans le presse-papiers'), () => { ta.select(); toast('Sélectionné — Ctrl+C pour copier'); }); }
    if (a === 'fmtjson') { $('#exTxt').value = toJSON(App.sys); }
    if (a === 'fmtseq') { $('#exTxt').value = toSeq(App.sys); }
    if (a === 'pick') $('#fileIn').click();
    if (a === 'load') { importFile('', $('#imTxt').value); }
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

/* ---------------- Import / export (JSON, CODE V .seq) ---------------- */
const SEQ_GLASS = { 'N-BK7': 'NBK7_SCHOTT', 'F_SILICA': 'SILICA_SPECIAL', 'CAF2': 'CAF2_SPECIAL' };
function toSeq(s) {
  const S = s.surfaces, N = S.length - 1, L = [];
  const objInf = !isFinite(S[0].t) || Math.abs(S[0].t) > 1e10;
  const gl = g => { if (OE.isAir(g)) return ''; if (OE.isMirror({ glass: g })) return 'REFL'; const k = OE.glassKey(g); if (k) return SEQ_GLASS[k] || (k.replace('-', '') + '_SCHOTT'); const m = String(g).match(/^\s*([0-9.]+)\s*[,\/;:]\s*([0-9.]+)/); if (m) { const nd = +m[1], vd = +m[2]; return `${Math.round((nd - 1) * 1000)}.${Math.round(vd * 10)}`; } return g; };
  const r = v => isFinite(v) ? (+v).toPrecision(10).replace(/\.?0+$/, '') : '0';
  L.push('RDM;LEN', `TITLE '${(s.title || 'Focale').replace(/'/g, '')}'`);
  const ap = s.aperture;
  L.push(ap.type === 'FNO' ? `FNO ${ap.value}` : ap.type === 'NA' ? `NAO ${ap.value}` : `EPD ${ap.value}`, 'DIM M');
  L.push('WL ' + s.wavelengths.map(w => (w.um * 1000).toFixed(4)).join(' '), `REF ${s.primary + 1}`, 'WTW ' + s.wavelengths.map(w => w.w ?? 1).join(' '));
  L.push('INI \'FOC\'', 'XAN ' + s.fields.map(() => '0.0').join(' '));
  L.push((objInf ? 'YAN ' : 'YOB ') + s.fields.map(f => f.y).join(' '), 'WTF ' + s.fields.map(f => f.w ?? 1).join(' '));
  L.push(`SO 0 ${objInf ? '1e+18' : r(S[0].t)}`);
  for (let i = 1; i < N; i++) {
    const x = S[i]; L.push(`${x.stop ? 'STO' : 'S'} ${r(x.r)} ${r(x.t)} ${gl(x.glass)}`.trim());
    if (x.k || x.a4 || x.a6 || x.a8 || x.a10) { L.push(x.a4 || x.a6 || x.a8 || x.a10 ? '  ASP' : '  CON'); L.push(`  K ${x.k || 0}`); if (x.a4 || x.a6 || x.a8 || x.a10) L.push(`  A ${x.a4 || 0}; B ${x.a6 || 0}; C ${x.a8 || 0}; D ${x.a10 || 0}`); }
    if (x.sdFixed) L.push(`  CIR ${r(x.sd)}`);
    if (x.tsolve === 'M' && i === N - 1) L.push('  PIM');
    if (x.vr) L.push('  CCY 0'); if (x.vt && x.tsolve !== 'M') L.push('  THC 0');
  }
  L.push(`SI ${r(S[N].r)} 0`, 'GO');
  return L.join('\n');
}
function mapSeqGlass(g) {
  if (!g) return '';
  let u = g.toUpperCase();
  if (u === 'REFL') return 'MIRROR';
  if (/^\d{3}\.\d{2,3}$/.test(u)) { const [a, b] = u.split('.'); return `${(1 + (+a) / 1000).toFixed(3)}/${(+b / (b.length === 3 ? 10 : 1)).toFixed(1)}`; }
  u = u.replace(/[_.](SCHOTT|OHARA|HOYA|SPECIAL|CDGM|SUMITA|HIKARI)$/, '');
  if (OE.glassKey(u)) return OE.glassKey(u);
  if (u[0] === 'N' && OE.glassKey('N-' + u.slice(1))) return OE.glassKey('N-' + u.slice(1));
  if (/SILICA|SIO2/.test(u)) return 'F_SILICA';
  return u;
}
function parseSeq(txt) {
  const sys = { title: '', aperture: { type: 'EPD', value: 10, obscuration: 0 }, fields: [], wavelengths: [], primary: 0, rayAiming: false, merit: { image: 'SPOT', ops: [] }, surfaces: [] };
  let wl = [], wtw = [], fy = [], wtf = [], cur = null, rdn = false;
  const stmts = txt.split('\n').map(l => l.replace(/!.*$/, '')).join('\n').split(/[;\n]/);
  for (let st of stmts) {
    st = st.trim(); if (!st) continue;
    const q = st.match(/'([^']*)'|"([^"]*)"/); const tk = st.split(/\s+/), cmd = tk[0].toUpperCase(), a = tk.slice(1);
    const n = i => parseFloat(a[i]);
    switch (cmd) {
      case 'TIT': case 'TITLE': sys.title = q ? (q[1] ?? q[2]) : a.join(' '); break;
      case 'LEN': if (q) sys.title = sys.title || (q[1] ?? q[2]); break;
      case 'RDN': rdn = true; break;
      case 'EPD': sys.aperture = { type: 'EPD', value: n(0), obscuration: 0 }; break;
      case 'FNO': sys.aperture = { type: 'FNO', value: n(0), obscuration: 0 }; break;
      case 'NAO': sys.aperture = { type: 'NA', value: n(0), obscuration: 0 }; break;
      case 'WL': wl = a.map(Number).filter(isFinite); break;
      case 'WTW': wtw = a.map(Number); break;
      case 'REF': sys.primary = n(0) - 1; break;
      case 'YAN': case 'YOB': case 'YIM': fy = a.map(Number).filter(isFinite); break;
      case 'WTF': wtf = a.map(Number); break;
      case 'SO': sys.surfaces.push(newSurf({ r: Infinity, t: Math.abs(n(1)) > 1e10 || !isFinite(n(1)) ? Infinity : n(1), comment: 'Objet' })); cur = null; break;
      case 'S': case 'STO': case 'SI': {
        if (!sys.surfaces.length) sys.surfaces.push(newSurf({ t: Infinity, comment: 'Objet' }));
        let rv = n(0); if (rdn) rv = rv ? 1 / rv : 0;
        const s = newSurf({ r: !rv ? Infinity : rv, t: cmd === 'SI' ? 0 : (isFinite(n(1)) ? n(1) : 0), glass: cmd === 'SI' ? '' : mapSeqGlass(a[2] || ''), stop: cmd === 'STO' });
        if (cmd === 'SI') s.comment = 'Image';
        sys.surfaces.push(s); cur = s; break;
      }
      case 'K': if (cur) cur.k = n(0); break;
      case 'A': if (cur) cur.a4 = n(0); break; case 'B': if (cur) cur.a6 = n(0); break; case 'C': if (cur) cur.a8 = n(0); break; case 'D': if (cur) cur.a10 = n(0); break;
      case 'CIR': if (cur) { cur.sd = n(0); cur.sdFixed = true; } break;
      case 'THI': if (cur) cur.t = n(0); break;
      case 'RDY': if (cur) cur.r = n(0) ? n(0) : Infinity; break;
      case 'CUY': if (cur) cur.r = n(0) ? 1 / n(0) : Infinity; break;
      case 'GLA': if (cur) cur.glass = mapSeqGlass(a[0]); break;
      case 'REFL': if (cur) cur.glass = 'MIRROR'; break;
      case 'PIM': if (cur) cur.tsolve = 'M'; break;
      case 'CCY': if (cur && n(0) === 0) cur.vr = true; break;
      case 'THC': if (cur && n(0) === 0) cur.vt = true; break;
      case 'KC': if (cur && n(0) === 0) cur.vk = true; break;
    }
  }
  if (sys.surfaces.length < 3) throw new Error('Fichier .seq : aucune surface trouvée');
  const last = sys.surfaces[sys.surfaces.length - 1]; if (last.comment !== 'Image') sys.surfaces.push(newSurf({ t: 0, comment: 'Image' }));
  sys.wavelengths = (wl.length ? wl : [587.56]).map((v, i) => ({ um: v / 1000, w: wtw[i] ?? 1 }));
  sys.primary = Math.max(0, Math.min(sys.primary, sys.wavelengths.length - 1));
  sys.fields = (fy.length ? fy : [0]).map((v, i) => ({ y: v, w: wtf[i] ?? 1 }));
  if (!sys.surfaces.some(s => s.stop)) sys.surfaces[1].stop = true;
  return sys;
}
function importText(t) {
  try {
    t = t.trim(); let s;
    if (t.startsWith('{')) s = fromJSON(t); else s = parseSeq(t);
    if (!s.surfaces || s.surfaces.length < 3) throw new Error('Pas de surfaces');
    closeDlg(); loadSystem(s, 'Système importé');
  } catch (e) { toast('Import impossible : ' + e.message, 3500); }
}
function openExport() {
  dlg(`<h2>Exporter <button class="x" data-d="close">✕</button></h2><div class="db">
  <div class="seg" style="margin-bottom:8px"><button class="on" data-d="fmtjson" onclick="this.parentNode.querySelectorAll('button').forEach(b=>b.classList.remove('on'));this.classList.add('on')">JSON Focale</button><button data-d="fmtseq" onclick="this.parentNode.querySelectorAll('button').forEach(b=>b.classList.remove('on'));this.classList.add('on')">CODE V (.seq)</button></div>
  <textarea id="exTxt" spellcheck="false">${esc(toJSON(App.sys))}</textarea>
  <div class="hint">Le téléchargement direct n'est pas possible dans cette page : copiez le contenu et collez-le dans un fichier. L'export .seq est un séquentiel CODE V de base (verres Schott, coniques, asphères, CIR, PIM) à vérifier dans CODE V.</div></div>
  <div class="df"><button class="tb pri" data-d="copy">Copier</button></div>`);
}
function openImport() {
  dlg(`<h2>Importer un système <button class="x" data-d="close">✕</button></h2><div class="db">
  <div class="hint">Collez un fichier JSON Focale ou un séquentiel CODE V (.seq : SO, S, STO, SI, EPD/FNO/NAO, WL, REF, YAN/YOB, K, A–D, CIR, PIM, REFL…), ou choisissez un fichier.</div>
  <textarea id="imTxt" spellcheck="false" placeholder="RDM;LEN&#10;EPD 10&#10;WL 486.13 587.56 656.27&#10;REF 2&#10;YAN 0 14 20&#10;SO 0 1e18&#10;S 22.01359 3.25896 NSK16_SCHOTT&#10;…&#10;SI 0 0&#10;GO"></textarea></div>
  <div class="df"><button class="bt" data-d="pick">Choisir un fichier…</button><button class="tb pri" data-d="load">Importer</button></div>`);
}
function openHelp() {
  dlg(`<h2>Focale — aide rapide <button class="x" data-d="close">✕</button></h2><div class="db" style="font-size:13px;line-height:1.55">
  <p><b>Éditeur de lentilles</b> : chaque ligne est une surface (OBJ → IMA). Saisissez rayon, épaisseur, verre (catalogue Schott, modèle <code>nd/νd</code> comme <code>1.5168/64.2</code>, indice fixe, ou <code>MIRROR</code>). <kbd>Entrée</kbd> valide et descend, <kbd>Tab</kbd> passe à la colonne suivante, <kbd>Échap</kbd> annule. « Infini » ou vide = plan. Après un miroir, les épaisseurs sont négatives.</p>
  <p><b>V</b> rend un paramètre variable pour l'optimisation ; <b>M</b> calcule l'épaisseur pour la mise au point paraxiale ; <b>🔒</b> fixe le demi-diamètre (les rayons au-delà sont vignettés). Double-cliquez sur la colonne Type pour placer le diaphragme.</p>
  <p><b>Analyses</b> : choisissez 1, 2, 4 ou 6 fenêtres en haut à droite, le type d'analyse dans chaque fenêtre, double-cliquez sur l'en-tête pour agrandir. Tout se recalcule en direct à chaque modification.</p>
  <p><b>Méthodes</b> : tracé de rayons réels (Snell vectoriel, coniques et asphères paires par Newton), pupilles paraxiales avec visée réelle optionnelle, OPD par rapport à une sphère de référence centrée sur le rayon principal et passant par la pupille de sortie, PSF par FFT de la pupille 64×64 dans une grille 256×256, FTM par FFT de la PSF, Seidel avec contributions des coniques/asphères, optimisation Levenberg-Marquardt à Jacobien numérique.</p>
  <p><b>Raccourcis</b> : <kbd>Ctrl</kbd>+<kbd>Z</kbd> / <kbd>Ctrl</kbd>+<kbd>Y</kbd> annuler/rétablir, <kbd>Inser</kbd> insérer après, <kbd>Ctrl</kbd>+<kbd>Suppr</kbd> supprimer la surface, <kbd>Ctrl</kbd>+<kbd>O</kbd> ouvrir, <kbd>Ctrl</kbd>+<kbd>S</kbd> enregistrer, <kbd>Ctrl</kbd>+<kbd>Maj</kbd>+<kbd>O</kbd> optimiser. Glissez-déposez un fichier .json, .seq ou .agf sur la fenêtre pour l'ouvrir. Le système est sauvegardé automatiquement dans ce navigateur.</p></div>`);
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
      const [h] = await showOpenFilePicker({ types: [{ description: 'Systèmes optiques et catalogues', accept: { 'application/json': ['.json'], 'text/plain': ['.seq', '.agf', '.txt'] } }] });
      const f = await h.getFile(); importFile(f.name, await f.text()); FS.handle = /\.json$/i.test(f.name) ? h : null;
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
function importFile(name, t) {
  if (/\.agf$/i.test(name) || /^\s*NM\s/m.test(t) && /^\s*CD\s/m.test(t)) { if (typeof importAGF === 'function') importAGF(name, t); else toast('Catalogues AGF non pris en charge'); return; }
  importText(t);
}
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
  if ('launchQueue' in window) launchQueue.setConsumer(async params => { for (const h of params.files || []) { const f = await h.getFile(); importFile(f.name, await f.text()); if (/\.json$/i.test(f.name)) FS.handle = h; } });
  let dn = 0; const drop = $('#drop');
  window.addEventListener('dragenter', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { dn++; drop.classList.add('on'); } });
  window.addEventListener('dragleave', () => { if (--dn <= 0) { dn = 0; drop.classList.remove('on'); } });
  window.addEventListener('dragover', e => e.preventDefault());
  window.addEventListener('drop', e => { e.preventDefault(); dn = 0; drop.classList.remove('on'); const f = e.dataTransfer.files[0]; if (f) f.text().then(t => importFile(f.name, t)); });
}
function openAbout() {
  dlg(`<h2>À propos de Focale <button class="x" data-d="close">✕</button></h2><div class="db" style="font-size:13px;line-height:1.6">
  <p><b>Focale</b> — logiciel de conception optique séquentielle. Version <code>${FOCALE_VERSION}</code>.</p>
  <p>Code source : <a href="https://github.com/KarimHX4/focale" target="_blank" rel="noopener">github.com/KarimHX4/focale</a>. Installé comme application (bouton « Installer » dans Chrome/Edge), Focale fonctionne hors ligne et se met à jour automatiquement à chaque nouvelle version publiée.</p>
  <p class="hint">Données de verres : base refractiveindex.info (domaine public, CC0), d'après les catalogues des fabricants.</p></div>`);
}

/* ---------------- Initialisation ---------------- */
function init() {
  const dl = document.createElement('datalist'); dl.id = 'glassList';
  dl.innerHTML = [...OE.catalog().map(g => `<option value="${g.name}">nd ${g.nd.toFixed(4)} · νd ${g.vd.toFixed(1)}</option>`), '<option value="MIRROR">miroir</option>'].join('');
  document.body.appendChild(dl);
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
      case 'dlSeq': download(fileBase() + '.seq', toSeq(App.sys), 'text/plain'); toast('Export CODE V téléchargé'); break;
      case 'about': openAbout(); break;
      case 'install': if (deferredInstall) { deferredInstall.prompt(); deferredInstall.userChoice.finally(() => { deferredInstall = null; $('#btnInstall').style.display = 'none'; }); } break;
      case 'undo': undo(); break; case 'redo': redo(); break;
      case 'optim': openOptim(); break;
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
  $('#fileIn').addEventListener('change', e => { const f = e.target.files[0]; if (!f) return; f.text().then(t => importFile(f.name, t)); e.target.value = ''; });
  setupPlatform();
  document.addEventListener('keydown', e => {
    const inInput = e.target.closest && e.target.closest('input,textarea,select');
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !inInput) { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y' && !inInput) { e.preventDefault(); redo(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') { e.preventDefault(); e.shiftKey ? openOptim() : openFile(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveFile(e.shiftKey); }
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
