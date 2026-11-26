'use strict';
/* =====================================================================
   FOCALE — interface
   ===================================================================== */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const FCOL = ['#2563eb', '#16a34a', '#dc2626', '#9333ea', '#ea580c', '#0891b2', '#ca8a04', '#db2777', '#4b5563', '#65a30d'];
/** couleur d'un champ : choisie par l'utilisateur (f.col) sinon palette par défaut */
const fcol = (i, sys) => { const f = (sys || (typeof App !== 'undefined' && App.sys) || {}).fields?.[i]; return (f && f.col) || FCOL[i % FCOL.length]; };
/** couleur d'une longueur d'onde : choisie par l'utilisateur si cette λ est dans le système, sinon couleur spectrale */
function wlCol(um) {
  const W = typeof App !== 'undefined' && App.sys && App.sys.wavelengths; if (W) { const w = W.find(x => x.col && Math.abs(x.um - um) < 1e-9); if (w) return w.col; }
  return wlSpec(um);
}
const hexCol = c => { if (/^#[0-9a-f]{6}$/i.test(c)) return c; const m = String(c).match(/\d+/g) || [0, 0, 0]; return '#' + m.slice(0, 3).map(v => (+v).toString(16).padStart(2, '0')).join(''); };
function wlSpec(um) {
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
/** renumérote les références de surfaces (pickups, colonnes S1/S2 des opérandes) après insertion (n > 0) ou suppression (n < 0) à l'indice at */
function shiftRefs(sys, at, n) {
  const map = k => { k = Math.round(+k); if (!(k >= at)) return k; if (n > 0) return k + n; return k < at - n ? null : k + n; };
  for (const x of sys.surfaces) { for (const [kk, sk] of [['rpk', 'rsolve'], ['tpk', 'tsolve']]) if (x[sk] === 'P' && x[kk] != null) { const m = map(x[kk]); if (m == null) { x[sk] = ''; } else x[kk] = m; } }
  for (const o of (sys.merit && sys.merit.ops) || []) { const d = OE.OPS[o.type]; if (!d || d.math) continue; for (const c of ['s1', 's2']) if ((d.cols || []).includes(c) && +o[c] > 0) { const m = map(o[c]); if (m != null) o[c] = m; } }
}
const newSurf = (o = {}) => ({ r: Infinity, t: 5, glass: '', sd: 0, sdFixed: false, k: 0, a4: 0, a6: 0, a8: 0, a10: 0, a12: 0, a14: 0, a16: 0, a18: 0, a20: 0, stop: false, comment: '', vr: false, vt: false, vk: false, tsolve: '',
  dx: 0, dy: 0, dz: 0, tx: 0, ty: 0, tz: 0, dmode: 'DEC', ...o });
const isDec = s => !!(s.dx || s.dy || s.dz || s.tx || s.ty || s.tz);
const ELEM = [['refr', 'Dioptre'], ['mirror', 'Miroir'], ['grating', 'Réseau (T)'], ['rgrating', 'Réseau (R)'], ['doe', 'Diffractif (DOE)'], ['ideal', 'Lentille idéale'], ['polarizer', 'Polariseur'], ['waveplate', 'Lame d\'onde']];
const elemOf = s => s.elem === 'grating' ? (OE.isMirror(s) ? 'rgrating' : 'grating') : s.elem || (OE.isMirror(s) ? 'mirror' : 'refr');

/* ---------------- État ---------------- */
const App = {
  sys: null, M: null, sel: 1, hist: [], hmeta: [], hi: -1, focus: null,
  panes: [{ type: 'spot' }, { type: 'wfe', fi: 0 }, { type: 'mtf' }, { type: 'psf', fi: 0 }, { type: 'rayfan' }, { type: 'footprint' }],
  grid: 4, mode: '2d', view: { auto: true, s: 1, ox: 0, oy: 0, yaw: 0.55, pitch: 0.32 }, nRays: 7, ray3: 'xy', showAsph: false, qf: { crit: 'SPOT', wl: 'central' }, asst: true, fw: {},
};
function save() { try { localStorage.setItem('focale.sys', toJSON(App.sys)); localStorage.setItem('focale.ui', JSON.stringify({ panes: App.panes, grid: App.grid, qf: App.qf, asst: App.asst, fw: App.fw, nRays: App.nRays, ray3: App.ray3, th: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light' })); } catch (e) { } }
function load() {
  try {
    const s = localStorage.getItem('focale.sys'); if (s) App.sys = normalize(fromJSON(s));
    const u = JSON.parse(localStorage.getItem('focale.ui') || 'null');
    if (u) { if (Array.isArray(u.panes) && u.panes.length >= 6) App.panes = u.panes; if (u.grid) App.grid = u.grid; if (u.qf) App.qf = { ...App.qf, ...u.qf }; if (u.asst === false) App.asst = false; if (u.fw && typeof u.fw === 'object') App.fw = u.fw; if (Number.isInteger(u.nRays) && u.nRays >= 3 && u.nRays <= 100) App.nRays = u.nRays; if (RAY3.some(o => o[0] === u.ray3)) App.ray3 = u.ray3; }
    // thème : sombre par défaut (premier lancement) ; ensuite le dernier choix de l'utilisateur
    document.documentElement.dataset.theme = u && u.th === 'light' ? '' : 'dark';
  } catch (e) { App.sys = null; }
}
function normalize(s) {
  s.aperture = { type: 'EPD', value: 10, obscuration: 0, ...(s.aperture || {}) };
  s.fields = ((s.fields && s.fields.length) ? s.fields : [{ y: 0, w: 1 }]).map(f => { const o = { x: +f.x || 0, y: +f.y || 0, w: f.w ?? 1, ...(f.col ? { col: f.col } : {}) }; for (const k of ['vuy', 'vly', 'vux', 'vlx']) if (+f[k]) o[k] = +f[k]; return o; });
  if (s.ftype && !OE.FTYPES[s.ftype]) delete s.ftype;
  s.wavelengths = (s.wavelengths && s.wavelengths.length) ? s.wavelengths : [{ um: 0.5875618, w: 1 }];
  s.primary = Math.min(Math.max(0, s.primary | 0), s.wavelengths.length - 1);
  s.merit = s.merit || { image: 'SPOT', ops: [], v: 2 }; s.merit.ops = s.merit.ops || []; OE.meritUpgrade(s);
  s.src = { type: 'none', fib: 'si', core: 50, clad: 125, na: 0.22, mfd: null, lc0: null, dl: null, len: null, att: null, bw: null, d: 10, w: 20, h: 200, ...(s.src || {}) };
  s.det = { on: false, p: 3.45, nx: 2448, ny: 2048, ff: 100, bits: 12, fw: 10000, rn: 3, lvl: 70, noise: false, ...(s.det || {}) };
  s.surfaces = s.surfaces.map(x => newSurf(x));
  if (s.userGlass) { OE.addGlasses(Object.values(s.userGlass).map(g => ({ ...g, user: true })), false); delete s.userGlass; rebuildGlassList(); }
  return s;
}
/** historique des modifications : App.hist (états JSON) et App.hmeta ({ t, label, name }) en parallèle */
function pushHist(label) {
  const s = toJSON(App.sys);
  if (App.hist[App.hi] === s) return;
  const prev = App.hist[App.hi]; let lab = label;
  if (!lab) { try { lab = prev ? histDiff(fromJSON(prev), App.sys) : 'Système initial'; } catch (e) { lab = 'Modification'; } }
  App.hmeta = App.hmeta || [];
  App.hist.splice(App.hi + 1); App.hmeta.splice(App.hi + 1); App.hist.push(s); App.hmeta.push({ t: Date.now(), label: lab });
  if (App.hist.length > 300) { App.hist.shift(); App.hmeta.shift(); }
  App.hi = App.hist.length - 1; save(); if (WIN.key === 'Historique') renderHist();
}
function commit(mut, opts = {}) { mut(App.sys); pushHist(opts.label); refresh(opts); }
const histGo = k => { if (k < 0 || k >= App.hist.length || k === App.hi) return; App.hi = k; App.sys = fromJSON(App.hist[k]); refresh(); if (WIN.key === 'Historique') renderHist(); };
function undo() { if (App.hi > 0) { const l = (App.hmeta[App.hi] || {}).label; histGo(App.hi - 1); toast('Annulé' + (l ? ' : ' + l : '')); } }
function redo() { if (App.hi < App.hist.length - 1) { histGo(App.hi + 1); const l = (App.hmeta[App.hi] || {}).label; toast('Rétabli' + (l ? ' : ' + l : '')); } }
function loadSystem(s, msg) { App.sys = normalize(s); App.sel = 1; App.view.auto = true; pushHist('Chargement : ' + (App.sys.title || 'système')); refresh(); if (msg) toast(msg); }
/** description courte de la différence entre deux états du système */
const HKEYS = { r: 'rayon', t: 'épaisseur', glass: 'verre', k: 'conique', sd: '½Ø', sdFixed: '½Ø fixe', comment: 'commentaire', elem: 'élément', type: 'forme', stop: 'diaphragme', tsolve: 'solve M',
  dx: 'décentrement X', dy: 'décentrement Y', dz: 'décentrement Z', tx: 'bascule α', ty: 'bascule β', tz: 'bascule γ', dmode: 'mode de décentrement', vr: 'variable R', vt: 'variable T', vk: 'variable K', vg: 'verre variable',
  rx: 'rayon X', kx: 'conique X', da: 'coefficients DOE', dm: 'ordre DOE', dnr: 'rayon de normalisation DOE', lpmm: 'traits/mm', gm: 'ordre', fid: 'focale idéale', tce: 'CTE' };
function histDiff(a, b) {
  const v = x => x === Infinity || x === -Infinity ? '∞' : typeof x === 'number' ? fmt(x, 6) : x === true ? 'oui' : x === false || x == null || x === '' ? '—' : Array.isArray(x) ? '[…]' : String(x);
  const SA = a.surfaces, SB = b.surfaces;
  if (SA.length !== SB.length) return SB.length > SA.length ? `Surface insérée (${SB.length - 2} surfaces)` : `Surface supprimée (${SB.length - 2} surfaces)`;
  const ch = [];
  for (let j = 0; j < SB.length; j++) for (const k of new Set([...Object.keys(SA[j]), ...Object.keys(SB[j])])) {
    if (JSON.stringify(SA[j][k]) === JSON.stringify(SB[j][k])) continue;
    const nm = HKEYS[k] || (/^a\d+$/.test(k) ? k.toUpperCase() : /^v/.test(k) ? 'variable ' + k.slice(1) : k);
    ch.push(/^v|stop|sdFixed/.test(k) && typeof SB[j][k] === 'boolean' ? `S${j} ${nm} ${SB[j][k] ? 'activé' : 'désactivé'}` : `S${j} ${nm} ${v(SA[j][k])} → ${v(SB[j][k])}`);
  }
  if (ch.length) return ch.length > 2 ? `${ch.slice(0, 2).join(' · ')} (+${ch.length - 2})` : ch.join(' · ');
  const P = [['fields', 'Champs'], ['wavelengths', 'Longueurs d\'onde'], ['primary', 'λ primaire'], ['aperture', 'Ouverture'], ['ftype', 'Type de champ'], ['merit', 'Fonction de mérite'], ['tol', 'Tolérancement'], ['mc', 'Multi-configuration'], ['env', 'Environnement'], ['title', 'Titre'], ['det', 'Détecteur'], ['src', 'Source'], ['apod', 'Apodisation'], ['aimMode', 'Visée'], ['rayAiming', 'Visée']];
  for (const [k, l] of P) if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) { if (k === 'mc' && a.mc && b.mc && a.mc.cur !== b.mc.cur) return `Configuration active : ${mcName(b, b.mc.cur | 0)}`; if (k === 'title') return `Titre : ${b.title}`; return l; }
  return 'Modification';
}
/* --- fenêtre Historique : états de la session et points de sauvegarde nommés (conservés entre les sessions) --- */
const SNAPS = { list: null };
function snapsLoad() { if (SNAPS.list) return SNAPS.list; try { SNAPS.list = JSON.parse(localStorage.getItem('focale.snaps') || '[]'); } catch (e) { SNAPS.list = []; } return SNAPS.list; }
function snapsSave() { try { localStorage.setItem('focale.snaps', JSON.stringify(SNAPS.list.slice(0, 40))); } catch (e) { toast('Mémoire du navigateur pleine : point de sauvegarde non conservé'); } }
function openHist() { dlg(`<h2>Historique <button class="x" data-d="close">✕</button></h2><div class="db" id="hw" style="display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:16px;min-height:0"></div>`, true, { w: 980, h: 600 }); renderHist(); }
function renderHist() {
  const el = $('#hw'); if (!el) return; const H = App.hist, Mt = App.hmeta || [], L = snapsLoad(), hm = t => new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const rows = H.map((_, k) => k).reverse().map(k => { const m = Mt[k] || {}; return `<div class="hrow ${k === App.hi ? 'cur' : k > App.hi ? 'fut' : ''}" data-hgo="${k}" title="${k === App.hi ? 'État actuel' : 'Revenir à cet état'}"><span class="hn">${k + 1}</span><span class="ht">${m.t ? hm(m.t) : ''}</span><span class="hl">${m.name ? `<b>★ ${esc(m.name)}</b> · ` : ''}${esc(m.label || '—')}</span></div>`; }).join('');
  el.innerHTML = `<div style="display:flex;flex-direction:column;min-height:0"><h4 class="th4" style="margin-top:0">Modifications de la session <span class="hint">(${H.length}, la plus récente en haut)</span></h4>
      <div class="hlist">${rows}</div><div class="hint" style="margin-top:6px">Cliquez sur une ligne pour revenir à cet état ; les états plus récents restent disponibles (en grisé) tant qu'aucune nouvelle modification n'est faite. Ctrl+Z / Ctrl+Y parcourent la liste pas à pas.</div></div>
    <div style="display:flex;flex-direction:column;min-height:0"><h4 class="th4" style="margin-top:0">Points de sauvegarde <span class="hint">(conservés entre les sessions)</span></h4>
      <div class="row"><input class="in" id="snapName" placeholder="Nom (ex. « avant optimisation »)" style="flex:1"><button class="bt" data-hact="snap">★ Créer</button></div>
      <div class="hlist">${L.length ? L.map((q, k) => `<div class="hrow"><span class="hl"><b>${esc(q.name)}</b><br><span class="hint">${esc(q.title || '')} · ${new Date(q.t).toLocaleString('fr-FR')}</span></span><button class="bt" data-hact="sload" data-i="${k}" style="height:22px">Charger</button><button class="x" data-hact="sdel" data-i="${k}" title="Supprimer">✕</button></div>`).join('') : '<div class="hint" style="padding:8px">Aucun point de sauvegarde. Nommez l\'état actuel pour pouvoir y revenir plus tard, même après avoir fermé Focale.</div>'}</div></div>`;
  const c = el.querySelector('.hrow.cur'); if (c) c.scrollIntoView({ block: 'nearest' });
}
function histAction(b) {
  const a = b.dataset.hact;
  if (a === 'snap') { const nm = ($('#snapName').value || '').trim() || `Point ${new Date().toLocaleString('fr-FR')}`; snapsLoad().unshift({ name: nm, t: Date.now(), title: App.sys.title || '', sys: toJSON(App.sys) }); snapsSave(); if (App.hmeta[App.hi]) App.hmeta[App.hi].name = nm; renderHist(); toast(`Point de sauvegarde « ${nm} » créé`); }
  if (a === 'sload') { const q = snapsLoad()[+b.dataset.i]; if (q) { App.sys = normalize(fromJSON(q.sys)); pushHist(`Point de sauvegarde chargé : ${q.name}`); refresh(); toast(`« ${q.name} » chargé (Ctrl+Z pour revenir)`); } }
  if (a === 'sdel') { snapsLoad().splice(+b.dataset.i, 1); snapsSave(); renderHist(); }
}

/* ---------------- Assistant (module facultatif assistant.js, chargé à la demande) ---------------- */
function applyAsstPref() { const b = $('#asstBtn'), m = $('#asstShow'); if (b) b.style.display = App.asst ? '' : 'none'; if (m) m.textContent = App.asst ? 'Masquer le bouton Assistant' : 'Afficher le bouton Assistant'; }
function openAssistant() {
  if (window.ASST) { window.ASST.toggle(); return; }
  if (openAssistant.loading) return; openAssistant.loading = true;
  const sc = document.createElement('script'); sc.src = `assistant.js?v=${typeof FOCALE_VERSION !== 'undefined' ? FOCALE_VERSION : ''}`;
  sc.onload = () => { openAssistant.loading = false; if (window.ASST) window.ASST.open(); };
  sc.onerror = () => { openAssistant.loading = false; sc.remove();
    dlg(`<h2>Assistant indisponible <button class="x" data-d="close">✕</button></h2><div class="db"><p>Le module facultatif <code>assistant.js</code> n'a pas été trouvé à côté de cette page. Focale fonctionne entièrement sans lui.</p>
      <p>Pour l'ajouter, placez le fichier <code>assistant.js</code> (dépôt GitHub de Focale) dans le même dossier que <code>index.html</code>, ou utilisez la version en ligne. Pour ne plus voir ce bouton : <b>Fichier › Masquer le bouton Assistant</b>.</p></div>`); };
  document.head.appendChild(sc);
}

/* ---------------- Rafraîchissement ---------------- */
let paneTimer = null;
function refresh(opts = {}) {
  const t0 = performance.now(); App.sysKey = null;
  if (App.sys.mc) OE.mcSync(App.sys);
  try { App.M = OE.prepare(App.sys); } catch (e) { console.error(e); App.M = { ok: false, errors: ['Erreur de calcul : ' + e.message] }; }
  App.sel = Math.min(Math.max(1, App.sel), App.sys.surfaces.length - 1);
  renderLDE(); renderSide(); drawLayout(); if (window.GLW) GLW.refresh?.(); if (WIN.key === 'Données système') renderSD(); if (WIN.key === 'Multi-configuration') renderMC(); renderMCBar();
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
  ${M.env ? `<span title="Environnement (Données système → Température et pression)">🌡 <span class="k">${fmt(M.env.T, 4)} °C · ${fmt(M.env.P, 4)} atm</span></span>` : ''}
  ${M.warnings && M.warnings.length ? `<span style="color:var(--warn)" title="${esc(M.warnings.join('\n'))}">⚠ ${M.warnings.length} avertissement(s)</span>` : ''}
  <span class="grow"></span><span id="bgst"></span><span>${extra || ''}</span><span>calcul <span class="k">${(App.lastPanes || 0).toFixed(0)} ms</span></span>`;
  bgStatus();
}

/* ---------------- Éditeur de lentilles ---------------- */
/** bouton de solve d'une cellule rayon (r) ou épaisseur (t) : lettre du solve actif, ou « S » discret */
const SOLVES = { r: { F: 'F/# image (angle marginal u′ = −1/2F)', U: 'Angle marginal u′ après la surface', P: 'Pickup du rayon d\'une autre surface' }, t: { M: 'Hauteur marginale nulle à la surface suivante (foyer paraxial)', P: 'Pickup de l\'épaisseur d\'une autre surface' } };
function solveBtn(i, k, s) {
  const v = k === 'r' ? s.rsolve : s.tsolve, d = v ? SOLVES[k][v] + (v === 'F' ? ` = ${s.rsv}` : v === 'U' ? ` = ${s.rsv}` : v === 'P' ? ` : S${k === 'r' ? s.rpk : s.tpk} × ${k === 'r' ? (s.rps ?? 1) : (s.tps ?? 1)}${k === 't' && +s.tpo ? ` + ${s.tpo}` : ''}` : '') : '';
  return `<button class="tg m ${v ? 'on' : 'sv0'}" data-solve="${k}" data-i="${i}" title="${v ? 'Solve : ' + esc(d) + ' — clic pour modifier' : 'Solve (F/#, angle marginal, pickup' + (k === 't' ? ', foyer paraxial M' : '') + ')'}">${v || 'S'}</button>`;
}
/** fenêtre de choix du solve (comme la cellule « solve » de Zemax / les solves de CODE V) */
function solvePop(btn, i, k) {
  $('#svpop')?.remove(); const s = App.sys.surfaces[i], cur = k === 'r' ? s.rsolve || '' : s.tsolve || '', el = document.createElement('div'); el.id = 'svpop'; el.className = 'svpop';
  const wf = App.M && App.M.ok ? +App.M.par.wfno.toFixed(3) : 4;
  const opts = k === 'r' ? [['', 'Aucun (valeur fixe)'], ['F', 'F/# image'], ['U', 'Angle marginal u′'], ['P', 'Pickup']] : [['', 'Aucun (valeur fixe)'], ['M', 'Foyer paraxial (hauteur marginale nulle)'], ['P', 'Pickup']];
  el.innerHTML = `<div class="svh">Solve sur ${k === 'r' ? 'le rayon' : 'l\'épaisseur'} de S${i}</div>${opts.map(([v, l]) => `<label class="ck"><input type="radio" name="svk" value="${v}" ${cur === v ? 'checked' : ''}> ${l}</label>`).join('')}
    <div class="svf" data-for="F">F/# <input class="in" id="svF" value="${s.rsolve === 'F' ? s.rsv : wf}" style="width:70px"></div>
    <div class="svf" data-for="U">u′ <input class="in" id="svU" value="${s.rsolve === 'U' ? s.rsv : 0}" style="width:70px"> <span class="hint">(rad, &lt; 0 : convergent)</span></div>
    <div class="svf" data-for="P">depuis S <input class="in" id="svK" value="${(k === 'r' ? s.rpk : s.tpk) ?? Math.max(1, i - 1)}" style="width:44px"> × <input class="in" id="svS" value="${(k === 'r' ? s.rps : s.tps) ?? (k === 'r' ? -1 : 1)}" style="width:52px">${k === 't' ? ` + <input class="in" id="svO" value="${s.tpo ?? 0}" style="width:52px">` : ''}</div>
    <div class="row" style="justify-content:flex-end;gap:6px;margin-top:6px"><button class="bt" data-sv="0">Annuler</button><button class="tb pri" data-sv="1">Appliquer</button></div>`;
  document.body.appendChild(el); const r = btn.getBoundingClientRect(); el.style.left = Math.min(r.left, innerWidth - 300) + 'px'; el.style.top = Math.min(r.bottom + 4, innerHeight - 260) + 'px';
  const sync = () => { const v = el.querySelector('[name=svk]:checked')?.value || ''; el.querySelectorAll('.svf').forEach(d => d.style.display = d.dataset.for === v ? '' : 'none'); };
  el.addEventListener('change', sync); sync();
  const close = () => { el.remove(); document.removeEventListener('mousedown', off, true); }, off = e => { if (!el.contains(e.target)) close(); };
  setTimeout(() => document.addEventListener('mousedown', off, true), 0);
  el.addEventListener('click', e => { const b = e.target.closest('[data-sv]'); if (!b) return; if (b.dataset.sv === '0') return close();
    const v = el.querySelector('[name=svk]:checked')?.value || '', num = id => parseFloat(String($('#' + id)?.value ?? '').replace(',', '.'));
    if (v === 'F' && !(num('svF') > 0)) return toast('F/# invalide'); if (v === 'U' && !isFinite(num('svU'))) return toast('Angle invalide');
    if (v === 'P') { const j = Math.round(num('svK')); if (!(j >= 1 && j < App.sys.surfaces.length - (k === 't' ? 1 : 0)) || j === i) return toast('Surface source invalide'); if (!isFinite(num('svS')) || (k === 'r' && !num('svS'))) return toast('Facteur invalide'); }
    commit(S => { const x = S.surfaces[i];
      if (k === 'r') { if (!v && x.rsolve && App.M && App.M.ok) x.r = App.M.S[i].r; x.rsolve = v; if (v === 'F') x.rsv = num('svF'); if (v === 'U') x.rsv = num('svU'); if (v === 'P') { x.rpk = Math.round(num('svK')); x.rps = num('svS'); } if (v) x.vr = false; }
      else { if (!v && x.tsolve && App.M && App.M.ok) x.t = App.M.S[i].t; x.tsolve = v; if (v === 'P') { x.tpk = Math.round(num('svK')); x.tps = num('svS'); x.tpo = num('svO') || 0; } if (v) x.vt = false; } });
    close(); toast(v ? `Solve ${v} sur ${k === 'r' ? 'R' : 'T'}${i}` : `Solve retiré : ${k === 'r' ? 'R' : 'T'}${i} fixé à sa valeur actuelle`); });
}
function renderLDE() {
  const S = App.sys.surfaces, N = S.length - 1, MS = App.M && App.M.ok ? App.M.S : null;
  const asph = App.showAsph, AK = asphKeys();
  const tg = (i, k, lbl, on, cls = '', title = '') => `<button class="tg ${cls} ${on ? 'on' : ''}" data-tog="${k}" data-i="${i}" title="${title}">${lbl}</button>`;
  let h = `<thead><tr><th>#</th><th>Type</th><th>Élément</th><th>Commentaire</th><th>Rayon</th><th>Épaisseur</th><th>Verre</th><th>Demi-diamètre</th><th>Conique</th>${asph ? AK.map(k => `<th>A${k.slice(1)} (r${SUP(k.slice(1))})</th>`).join('') : ''}</tr></thead><tbody>`;
  S.forEach((s, i) => {
    const obj = i === 0, img = i === N, mir = OE.isMirror(s);
    let badge = obj ? '<span class="b">OBJ</span>' : img ? '<span class="b">IMA</span>' : s.stop ? '<span class="b st">STO</span>' : mir ? '<span class="b mi">MIR</span>' : '';
    if (isDec(s)) badge += `<span class="b de" title="${{ DEC: 'Décentrement', DAR: 'Décentrement et retour', BEN: 'Pliage' }[s.dmode || 'DEC']}">${s.dmode || 'DEC'}</span>`;
    if (s.type && s.type !== 'STD') badge += `<span class="b fr">${s.type === 'XY' ? 'XY' : s.type === 'TOR' ? (isFinite(+s.rx) && +s.rx ? 'TOR' : 'CYL') : 'ZRN'}</span>`;
    if (s.elem === 'doe') badge += '<span class="b fr" title="Surface diffractive">DOE</span>';
    // valeurs de la prescription ; seules les grandeurs calculées (solve M, demi-diamètre automatique) viennent du modèle préparé
    const tVal = MS && s.tsolve ? MS[i].t : s.t, rVal = MS && s.rsolve ? MS[i].r : s.r, sdVal = MS && !s.sdFixed ? MS[i].sd : s.sd;
    const gOK = mir || OE.isAir(s.glass) || isFinite(OE.glassN(s.glass, 0.5876));
    h += `<tr data-i="${i}" class="${i === App.sel ? 'sel' : ''}">
      <td class="n">${i}</td><td class="ty">${badge}</td>
      <td>${obj || img ? '' : `<select class="el" data-i="${i}" data-k="elem">${ELEM.map(([k, l]) => `<option value="${k}" ${elemOf(s) === k ? 'selected' : ''}>${l}</option>`).join('')}</select>`}</td>
      <td><div class="cell"><input class="c" data-i="${i}" data-k="comment" value="${esc(s.comment)}"></div></td>
      <td><div class="cell"><input data-i="${i}" data-k="r" class="${s.rsolve ? 'auto' : ''}" value="${obj ? '' : fmt(rVal, 7)}" ${obj ? 'disabled' : ''}>${obj || img ? '' : tg(i, 'vr', 'V', s.vr && !s.rsolve, '', 'Variable (optimisation)') + solveBtn(i, 'r', s)}</div></td>
      <td><div class="cell"><input data-i="${i}" data-k="t" class="${s.tsolve ? 'auto' : ''}" value="${img ? '' : fmt(tVal, 7)}" ${img ? 'disabled' : ''}>${img || obj ? '' : tg(i, 'vt', 'V', s.vt && !s.tsolve, '', 'Variable (optimisation)') + solveBtn(i, 't', s)}</div></td>
      <td><div class="cell"><input class="g ${gOK ? '' : 'bad'} ${s.vg && OE.parseModel(s.glass) ? 'model' : ''}" list="glassList" data-i="${i}" data-k="glass" value="${esc(s.glass)}" ${img ? 'disabled' : ''} placeholder="${img ? '' : 'air'}" title="${s.vg ? (OE.parseModel(s.glass) ? 'Verre modèle variable (nd/νd) — à substituer par un verre réel dans la fenêtre d\'optimisation' : 'Verre réel substituable (substitution dans la fenêtre d\'optimisation)') : ''}">${obj || img || mir ? '' : tg(i, 'vg', 'V', s.vg, '', 'Verre variable : nd et νd deviennent des variables (verre modèle), puis substitution par un verre réel')}</div></td>
      <td><div class="cell"><input data-i="${i}" data-k="sd" class="${s.sdFixed ? '' : 'auto'}" value="${obj ? '' : fmt(sdVal, 5)}" ${obj ? 'disabled' : ''}>${obj ? '' : tg(i, 'sdFixed', '🔒', s.sdFixed, 'l', 'Demi-diamètre fixe (vignetage des rayons au-delà)')}</div></td>
      <td><div class="cell"><input data-i="${i}" data-k="k" value="${obj ? '' : fmt(s.k, 6)}" ${obj ? 'disabled' : ''}>${obj || img ? '' : tg(i, 'vk', 'V', s.vk, '', 'Variable (optimisation)')}</div></td>
      ${asph ? AK.map(k => `<td><div class="cell"><input data-i="${i}" data-k="${k}" value="${obj ? '' : fmt(s[k], 6)}" ${obj ? 'disabled' : ''}>${obj || img ? '' : tg(i, 'v' + k, 'V', s['v' + k], '', 'Variable (optimisation)')}</div></td>`).join('') : ''}
    </tr>`;
  });
  h += '</tbody>';
  const tb = $('#lde'); tb.innerHTML = h;
  // valeurs pilotées par la multi-configuration
  if (OE.mcOn(App.sys)) { const KM = { THI: 't', RAD: 'r', GLA: 'glass', SD: 'sd', CNC: 'k' }, nm = mcName(App.sys, App.sys.mc.cur | 0);
    for (const op of App.sys.mc.ops) { const k = KM[op.type]; if (!k) continue; const inp = tb.querySelector(`input[data-i="${op.i}"][data-k="${k}"]`); if (inp) { inp.classList.add('mcc'); inp.title = `Valeur de « ${nm} » (multi-configuration : ${op.v.map(v => v === Infinity ? '∞' : typeof v === 'number' ? fmt(v, 6) : v).join(' / ')})`; } } }
  if (App.focus) { const f = App.focus; App.focus = null; const inp = tb.querySelector(`input[data-i="${f.i}"][data-k="${f.k}"]`); if (inp && !inp.disabled) { inp.focus(); inp.select(); } }
}
/** colonnes asphériques affichées : A4…A10, et A12…A20 dès qu'une surface les utilise (ou App.hiAsph) */
const asphKeys = () => App.hiAsph || App.sys.surfaces.some(x => OE.ASPK.slice(4).some(a => +x[a])) ? OE.ASPK : OE.ASPK.slice(0, 4);
const LKEYS = () => ['comment', 'r', 't', 'glass', 'sd', 'k', ...(App.showAsph ? asphKeys() : [])];
function commitCell(i, k, raw) {
  const s = App.sys.surfaces[i]; if (!s) return false;
  let v;
  switch (k) {
    case 'elem': {
      if (elemOf(s) === raw) return false;
      commit(S => {
        const x = S.surfaces[i], wasM = OE.isMirror(x);
        x.elem = ({ grating: 'grating', rgrating: 'grating', ideal: 'ideal', polarizer: 'polarizer', waveplate: 'waveplate', doe: 'doe' })[raw] || '';
        if (x.elem === 'doe') { if (x.dm == null) x.dm = 1; if (!(x.dnr > 0)) x.dnr = Math.max(1, +(App.M && App.M.ok ? App.M.S[i].sd : 10).toPrecision(3)); if (!Array.isArray(x.da)) x.da = [0, 0, 0, 0]; }
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
      if (v === 0) v = Infinity; { const cur = s.rsolve && App.M && App.M.ok ? App.M.S[i].r : s.r; if (v === cur || (isFinite(v) && Math.abs(v - cur) < 1e-12 * Math.abs(v))) return false; }
      commit(S => { S.surfaces[i].r = v; S.surfaces[i].rsolve = ''; }); return true;
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
    const sb = e.target.closest('[data-solve]'); if (sb) { solvePop(sb, +sb.dataset.i, sb.dataset.solve); return; }
    const b = e.target.closest('[data-tog]');
    if (b) {
      const i = +b.dataset.i, k = b.dataset.tog;
      if (k === 'vg') { const s0 = App.sys.surfaces[i];
        if (!s0.vg) { if (OE.isAir(s0.glass) || OE.isMirror(s0)) { toast('Verre variable : seulement pour une surface suivie d\'un verre (pas l\'air ni un miroir)'); return; }
          const mg = OE.parseModel(s0.glass) ? s0.glass : OE.toModel(s0.glass); if (!mg) { toast('Verre inconnu : impossible d\'en faire un verre modèle'); return; }
          commit(S => { S.surfaces[i].vg = true; S.surfaces[i].glass = mg; }); toast(`Verre S${i} variable : modèle ${mg} (nd/νd)`); }
        else commit(S => { S.surfaces[i].vg = false; });
        if ($('#ovars')) openOptim(); return; }
      commit(S => { const s = S.surfaces[i]; if (k === 'tsolve') { s.tsolve = s.tsolve === 'M' ? '' : 'M'; if (s.tsolve === 'M') s.vt = false; } else if (k === 'sdFixed') { if (!s.sdFixed && App.M && App.M.ok) s.sd = App.M.S[i].sd; s.sdFixed = !s.sdFixed; } else s[k] = !s[k]; });
      return;
    }
    const tr = e.target.closest('tr[data-i]'); if (tr && !e.target.closest('input')) selectRow(+tr.dataset.i, true);
  });
  tb.addEventListener('contextmenu', e => { const tr = e.target.closest('tr[data-i]'); if (!tr) return; e.preventDefault(); selectRow(+tr.dataset.i, true); ctxMenu(e.clientX, e.clientY, +tr.dataset.i); });
  tb.addEventListener('dblclick', e => { const td = e.target.closest('td.ty'); if (td) { const i = +td.parentElement.dataset.i; if (i > 0 && i < App.sys.surfaces.length - 1) setStop(i); } });
}
function selectRow(i, redraw = true) {
  i = Math.max(0, Math.min(App.sys.surfaces.length - 1, i));
  if (App.sel === i) return; App.sel = i;
  $$('#lde tr[data-i]').forEach(tr => tr.classList.toggle('sel', +tr.dataset.i === i));
  renderSide(); drawLayout(); GLW.refresh?.();
  if (App.panes.slice(0, App.grid).some(p => p.type === 'footprint' && p.si == null)) renderPanes();
}
/** menu contextuel (clic droit) d'une ligne de l'éditeur de lentilles */
function ctxMenu(x, y, i) {
  let m = $('#ctx'); if (!m) { m = document.createElement('div'); m.id = 'ctx'; m.className = 'menu ctx'; document.body.appendChild(m);
    m.addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (!b || b.disabled) return; hideCtx(); const c = b.dataset.c; if (c === 'glasses') openGlasses(); else if (c === 'qfocus') quickFocusUI(); else if (c === 'vg') $(`#lde button[data-tog="vg"][data-i="${App.sel}"]`)?.click(); else lde(c); });
    const off = e => { if (!e.target.closest || !e.target.closest('#ctx')) hideCtx(); };
    window.addEventListener('mousedown', off, true); window.addEventListener('blur', hideCtx); window.addEventListener('resize', hideCtx); document.addEventListener('scroll', hideCtx, true);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') hideCtx(); }); }
  const S = App.sys.surfaces, N = S.length - 1, s = S[i], opt = i > 0 && i < N, lens = opt && i + 1 < N && !OE.isAir(s.glass) && !OE.isMirror(s);
  const it = (c, l, on = true, kb = '', cls = '') => `<button data-c="${c}" class="${cls}" ${on ? '' : 'disabled'}>${l}${kb ? `<span class="kb">${kb}</span>` : ''}</button>`;
  m.innerHTML = `<div class="hint" style="padding:4px 10px 6px">Surface ${i}${i === 0 ? ' (objet)' : i === N ? ' (image)' : s.comment ? ' — ' + esc(s.comment) : ''}</div>`
    + it('insB', 'Insérer une surface avant', i > 0) + it('insA', 'Insérer une surface après', i < N, 'Inser') + it('addLens', 'Ajouter une lentille après', i < N)
    + '<hr>' + it('qfocus', 'Quick focus (meilleur foyer)', true, 'Ctrl+Maj+F') + it('glasses', 'Choisir le verre dans le catalogue', i < N) + it('vg', s.vg ? 'Verre fixe (retirer la variable)' : 'Verre variable (nd/νd, puis substitution)', opt && !OE.isAir(s.glass) && !OE.isMirror(s)) + it('stop', 'Définir comme diaphragme', opt && !s.stop) + it('mirror', OE.isMirror(s) ? 'Redevenir un dioptre' : 'Transformer en miroir', opt) + it('flip', 'Retourner l\'élément', i > 0 && i < N - 1)
    + '<hr>' + it('del', 'Supprimer la surface', opt && N > 2, 'Suppr', 'danger') + it('delEl', `Supprimer l'élément (surfaces ${i} et ${i + 1})`, lens && N > 3, '', 'danger');
  m.classList.add('open'); m.style.left = '0px'; m.style.top = '0px';
  const r = m.getBoundingClientRect(); m.style.left = Math.min(x, innerWidth - r.width - 6) + 'px'; m.style.top = Math.min(y, innerHeight - r.height - 6) + 'px';
}
function hideCtx() { const m = $('#ctx'); if (m) m.classList.remove('open'); }
function setStop(i) { commit(S => S.surfaces.forEach((s, j) => s.stop = j === i)); }
function lde(act) {
  const S = App.sys.surfaces, N = S.length - 1; let i = App.sel;
  switch (act) {
    case 'insB': if (i < 1) i = 1; commit(s => { s.surfaces.splice(i, 0, newSurf()); shiftRefs(s, i, 1); }); break;
    case 'insA': { const j = Math.min(i + 1, N); commit(s => { s.surfaces.splice(j, 0, newSurf()); shiftRefs(s, j, 1); }); App.sel = j; refresh(); break; }
    case 'addLens': { const j = Math.min(i + 1, N); commit(s => { s.surfaces.splice(j, 0, newSurf({ r: 50, t: 4, glass: 'N-BK7', comment: 'Lentille' }), newSurf({ r: -50, t: 10 })); shiftRefs(s, j, 2); }); App.sel = j; refresh(); break; }
    case 'del': if (i < 1 || i >= N) return toast('Impossible de supprimer l\'objet ou l\'image'); if (N <= 2) return toast('Il faut au moins une surface');
      commit(s => { const wasStop = s.surfaces[i].stop; s.surfaces.splice(i, 1); shiftRefs(s, i, -1); if (wasStop) s.surfaces[Math.min(i, s.surfaces.length - 2)].stop = true; });
      App.sel = Math.min(i, App.sys.surfaces.length - 1); refresh(); toast(`Surface ${i} supprimée — Ctrl+Z pour annuler`, 3000); break;
    case 'delEl': { if (i < 1 || i + 1 >= N) return toast('Sélectionnez la première surface d\'une lentille'); if (N <= 3) return toast('Il faut au moins une surface');
      commit(s => { const wasStop = s.surfaces[i].stop || s.surfaces[i + 1].stop; s.surfaces.splice(i, 2); shiftRefs(s, i, -2); if (wasStop) s.surfaces[Math.min(i, s.surfaces.length - 2)].stop = true; });
      App.sel = Math.min(i, App.sys.surfaces.length - 1); refresh(); toast(`Élément (surfaces ${i} et ${i + 1}) supprimé — Ctrl+Z pour annuler`, 3000); break; }
    case 'stop': if (i < 1 || i >= N) return toast('Sélectionnez une surface optique'); setStop(i); break;
    case 'mirror': if (i < 1 || i >= N) return; commit(s => { const x = s.surfaces[i]; x.glass = OE.isMirror(x) ? '' : 'MIRROR'; }); break;
    case 'flip': {
      if (i < 1 || i >= N - 1) return toast('Sélectionnez la première surface d\'une lentille');
      commit(s => {
        const a = s.surfaces[i], b = s.surfaces[i + 1]; const neg = v => (isFinite(v) ? -v : v);
        const ra = a.r, rb = b.r; a.r = neg(rb); b.r = neg(ra);
        for (const k of ['k']) { const t = a[k]; a[k] = b[k]; b[k] = t; }
        for (const k of OE.ASPK) { const t = a[k] || 0; a[k] = -(b[k] || 0); b[k] = -t; }
      }); toast('Élément retourné'); break;
    }
  }
}

/* ---------------- Panneau système ---------------- */
const AIMOPTS = [['none', 'Pupille paraxiale'], ['chief', 'Rayon principal au diaphragme (CODE V)'], ['full', 'Réelle : tous les rayons (ray aiming)']];
function setAim(v) { commit(s => { s.rayAiming = v === 'full'; if (v === 'chief') s.aimMode = 'chief'; else delete s.aimMode; }); }
const APTYPES = [['EPD', 'Diamètre pupille d\'entrée (mm)'], ['FNO', 'F/# image (EFL / EPD)'], ['WFNO', 'F/# de travail paraxial (FNO de CODE V)'], ['NA', 'Ouverture numérique objet'], ['NAI', 'Ouverture numérique image'], ['STOP', 'Demi-diamètre du diaphragme (mm)']];
/** change le type de champ ; convert : recalcule les valeurs pour garder les mêmes points de champ (CODE V « Convert Fields ») */
function setFieldType(to, convert) {
  const s = App.sys, from = ftypeOf(s); if (to === from) return;
  let v = null;
  if (convert) { try { v = OE.convertFields(s, to); } catch (e) { toast('Conversion impossible : ' + e.message, 4000); renderSide(); return; } }
  const r = x => +(+x).toPrecision(10);
  commit(S => { S.ftype = to; if (v) S.fields = S.fields.map((f, i) => ({ ...f, x: r(v[i].x), y: r(v[i].y) })); });
  toast(`Champs : ${OE.FTYPES[to].l.toLowerCase()}${v ? ' (mêmes points de champ)' : ' (valeurs inchangées)'}`);
}
const closedCards = new Set();
function card(id, title, body) { return `<div class="card ${closedCards.has(id) ? 'closed' : ''}" data-card="${id}"><h3>${title}<span class="chev">▾</span></h3><div class="cb">${body}</div></div>`; }
function renderSide() {
  const s = App.sys, M = App.M, ap = s.aperture;
  const objInf = !isFinite(s.surfaces[0].t) || Math.abs(s.surfaces[0].t) > 1e10;
  const apOpts = APTYPES.filter(o => !(objInf && o[0] === 'NA'));
  if (!apOpts.find(o => o[0] === ap.type)) ap.type = 'EPD';
  const ft = ftypeOf(s), fu = OE.FTYPES[ft].u;
  const el = document.activeElement; const keep = el && el.closest && el.closest('#side') && el.dataset.f ? `[data-f="${el.dataset.f}"]${el.dataset.k ? `[data-k="${el.dataset.k}"]` : ''}${el.dataset.i != null ? `[data-i="${el.dataset.i}"]` : ''}` : null;
  let h = `<div class="sidebar-h"><button class="bt" data-act="sysdata" title="Données système façon CODE V : pupille, longueurs d'onde, champs et vignetage, température et pression, dn/dT, avancé (Ctrl+Maj+D)">⚙ Données système</button><span class="grow"></span><button class="x" data-help="systeme" title="Aide : ouverture, champs, longueurs d'onde">?</button>${App.fw.side ? '' : '<button class="x" data-fw="side" title="Détacher ce panneau dans une fenêtre flottante">⧉</button>'}</div>`;
  h += card('gen', 'Système', `
    <div class="row"><input class="in" style="flex:1" data-f="title" value="${esc(s.title)}" placeholder="Titre du système"></div>`);
  h += inspector();
  h += card('ap', 'Ouverture', `
    <div class="row"><select class="in" style="flex:1" data-f="apType">${apOpts.map(o => `<option value="${o[0]}" ${o[0] === ap.type ? 'selected' : ''}>${o[1]}</option>`).join('')}</select></div>
    <div class="row"><label>Valeur</label><input class="in mini" data-f="apVal" value="${fmt(ap.value, 6)}"></div>
    <div class="row"><label>Obstruction centrale (rayon rel.)</label><input class="in mini" data-f="obs" value="${fmt(ap.obscuration || 0, 4)}"></div>
    <div class="row"><label title="Visée des rayons : pupille d'entrée paraxiale, rayon principal itéré au centre du diaphragme (défaut de CODE V), ou chaque rayon itéré sur le diaphragme">Visée</label><select class="in" data-f="aimSel" style="flex:1">${AIMOPTS.map(([k, l]) => `<option value="${k}" ${OE.aimMode(s) === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>`);
  h += card('fi', `Champs — ${OE.FTYPES[ft].l.toLowerCase()} (${fu})`, `
    <div class="row"><select class="in" style="flex:1" data-f="ftype" title="Type de champ (CODE V : YAN, YOB, YIM, YRI). Les valeurs sont converties pour garder les mêmes points de champ.">${Object.entries(OE.FTYPES).filter(([k]) => !(objInf && k === 'obj')).map(([k, v]) => `<option value="${k}" ${k === ft ? 'selected' : ''}>${v.l} (${v.cv})</option>`).join('')}</select></div>
    <table class="mt"><tr><th></th><th>X (${fu})</th><th>Y (${fu})</th><th>Poids</th><th></th></tr>
    ${s.fields.map((f, i) => `<tr><td><button class="cpk" data-cpk="f" data-i="${i}" style="background:${hexCol(fcol(i))}" title="Couleur du champ ${i + 1} (clic pour la changer)" aria-label="Couleur du champ ${i + 1}"></button></td><td><input class="in" data-f="fx" data-i="${i}" value="${fmt(f.x || 0, 6)}"></td><td><input class="in" data-f="fy" data-i="${i}" value="${fmt(f.y, 6)}"></td><td><input class="in" data-f="fw" style="width:44px" data-i="${i}" value="${fmt(f.w ?? 1, 4)}"></td><td><button class="x" data-a="fdel" data-i="${i}" title="Supprimer">✕</button></td></tr>`).join('')}
    </table><button class="add" data-a="fadd">+ Ajouter un champ</button>
    <div class="chips"><button class="chip" data-a="fspread">Répartir 0 · 0.7 · 1</button><button class="chip" data-a="sdfld" title="Vignetage (VUY, VLY, VUX, VLX), génération et conversion des champs">Vignetage</button></div>${s.fields.some(f => +f.vuy || +f.vly || +f.vux || +f.vlx) ? '<div class="hint">Facteurs de vignetage actifs (voir Données système).</div>' : ''}`);
  h += card('wl', 'Longueurs d\'onde (µm)', `
    <table class="mt"><tr><th></th><th>λ (µm)</th><th>Poids</th><th title="Primaire">Prim.</th><th></th></tr>
    ${s.wavelengths.map((w, i) => `<tr><td><button class="cpk" data-cpk="w" data-i="${i}" style="background:${hexCol(wlCol(w.um))}" title="Couleur de λ${i + 1} (clic pour la changer)" aria-label="Couleur de la longueur d'onde ${i + 1}"></button></td><td><input class="in" data-f="wum" data-i="${i}" value="${fmt(w.um, 7)}"></td><td><input class="in" data-f="ww" style="width:48px" data-i="${i}" value="${fmt(w.w ?? 1, 4)}"></td><td style="text-align:center"><input type="radio" name="prim" data-f="wp" data-i="${i}" ${i === s.primary ? 'checked' : ''}></td><td><button class="x" data-a="wdel" data-i="${i}">✕</button></td></tr>`).join('')}
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
      ${objInf ? '' : `<span>F/# à l'infini (EFL/EPD)</span><span>${fx(p.fno, 3)}</span>`}
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
      <div class="hint" style="margin-top:6px">Positions relatives : PE / 1ʳᵉ surface, PS / plan image. Hauteur image et grandissement au plan image paraxial (comme CODE V).</div>`);
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
var GLW = { pick: null, refresh: null };
/** données étendues d'un verre (mises en cache) : propriétés, Pg,F */
function glassExt(g) {
  GLW.ext = GLW.ext || new Map(); if (GLW.ext.has(g.name)) return GLW.ext.get(g.name);
  const n = l => OE.glassN(g.name, l), nF = n(0.4861327), nC = n(0.6562725), ng = n(0.4358343), p = OE.glassProps(g.name) || {};
  const o = { pgf: (ng - nF) / (nF - nC), dens: p.dens, cost: p.cost, res: p.res, dpgf: p.dpgf, it: p.it };
  GLW.ext.set(g.name, o); return o;
}
function openGlasses() {
  const cats = OE.cats(); GLW.pick = null; GLW.view = GLW.view || 'list'; GLW.tl = GLW.tl || 0.4; GLW.col = GLW.col || 'cat'; GLW.ax = GLW.ax || 'nd';
  dlg(`<h2>Catalogue de verres <button class="x" data-d="close">✕</button></h2><div class="db" style="display:flex;flex-direction:column">
    <div class="row" style="flex-wrap:wrap;gap:6px"><span class="seg sm"><button data-gv="list" class="${GLW.view === 'list' ? 'on' : ''}">Liste</button><button data-gv="map" class="${GLW.view === 'map' ? 'on' : ''}">Diagramme</button></span>
      <input class="in" id="gq" style="flex:1;min-width:140px" placeholder="Rechercher (nom, ex. BK7, LAH, FK…)"><select class="in" id="gc"><option value="">Tous les catalogues</option>${cats.map(c => `<option>${c}</option>`).join('')}</select>
      <label class="hint"><input type="checkbox" id="gp"> préférentiels</label><label class="hint"><input type="checkbox" id="go"> obsolètes</label>
      <label class="hint" title="Longueur d'onde de la transmission interne affichée">τ à <input class="in" id="gtl" value="${GLW.tl}" style="width:46px"> µm</label>
      <label class="hint" title="Transmission interne minimale pour 10 mm (0 à 1) ; vide = pas de filtre">τ₁₀ ≥ <input class="in" id="gtm" value="${GLW.tm ?? ''}" style="width:42px" placeholder="—"></label>
      <button class="bt" data-d="agf">Importer un AGF</button></div>
    <div class="row" id="gmapopt" style="display:${GLW.view === 'map' ? 'flex' : 'none'};gap:8px"><label class="hint">Axes <select class="in" id="gax"><option value="nd" ${GLW.ax === 'nd' ? 'selected' : ''}>nd / νd</option><option value="pgf" ${GLW.ax === 'pgf' ? 'selected' : ''}>Pg,F / νd (dispersion partielle)</option></select></label>
      <label class="hint">Couleur <select class="in" id="gcol">${[['cat', 'catalogue'], ['tau', 'transmission τ₁₀'], ['cost', 'prix relatif'], ['dens', 'densité'], ['dpgf', 'ΔPg,F']].map(([k, l]) => `<option value="${k}" ${GLW.col === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label><span class="hint">survol : détails · clic : choisir · molette : zoom · glisser : déplacer · double-clic : vue entière</span></div>
    <div class="hint" id="gn"></div>
    <div id="gwrap" style="flex:1 1 auto;min-height:120px;overflow:auto;border:1px solid var(--line);border-radius:8px;margin-top:6px;position:relative"><table class="mt gtab" id="gt" style="font-size:12px"></table><canvas id="gmap" style="display:none;width:100%;height:100%"></canvas><div id="gtip" class="gtip" style="display:none"></div></div>
    <div class="hint" style="margin-top:6px">Cliquez sur un verre pour le sélectionner, puis validez pour l'affecter à la surface sélectionnée dans l'éditeur (milieu après la surface) ; la fenêtre reste ouverte, vous pouvez changer de surface. τ₁₀ : transmission interne pour 10 mm d'épaisseur ; prix relatif à N-BK7 (fourni par les fichiers AGF des fabricants).</div>
    <div class="df" id="gconf"></div>`, true, { h: 680 });
  const surf = () => { const j = App.sel, N = App.sys.surfaces.length - 1; return j >= 0 && j < N ? j : -1; };
  const key = n => String(n || '').toUpperCase().replace(/[\s\-_]/g, '');
  const conf = () => {
    const el = $('#gconf'); if (!el) return; const j = surf(), g = GLW.pick && OE.catalog().find(x => x.name === GLW.pick);
    const cur = j >= 0 ? (App.sys.surfaces[j].glass || 'air') : '';
    if (!g) { el.innerHTML = `<span class="hint" style="margin-right:auto">${j >= 0 ? `Surface ${j} — verre actuel : <b>${esc(cur)}</b>. Sélectionnez un verre dans la liste ou le diagramme.` : 'Sélectionnez une surface (pas l\'image) dans l\'éditeur de lentilles.'}</span>`; return; }
    const e = glassExt(g), tau = OE.glassTau(g.name, GLW.tl, 10);
    el.innerHTML = `<span style="margin-right:auto">${j >= 0 ? `Affecter <b>${esc(g.name)}</b> <span class="hint">(${g.cat} · nd ${g.nd.toFixed(5)} · νd ${g.vd.toFixed(2)}${isFinite(tau) ? ` · τ₁₀ ${fx(tau, 3)} à ${GLW.tl} µm` : ''}${e.cost != null ? ` · prix ×${fmt(e.cost, 3)}` : ''})</span> à la surface <b>${j}</b> <span class="hint">— actuellement ${esc(cur)}</span>` : 'Sélectionnez une surface (pas l\'image).'}</span>
      <button class="bt" id="gno">Annuler</button><button class="tb pri" id="gyes" ${j >= 0 ? '' : 'disabled'}>Valider</button>`;
    $('#gno').onclick = () => { GLW.pick = null; mark(); conf(); };
    $('#gyes').onclick = () => { const jj = surf(); if (jj < 0) return toast('Sélectionnez une surface (pas l\'image)'); const n = GLW.pick; commit(S => S.surfaces[jj].glass = n, { label: `S${jj} verre → ${n}` }); toast(`${n} → surface ${jj}`); GLW.pick = null; mark(); conf(); };
  };
  const mark = () => { const j = surf(), cur = j >= 0 ? key(App.sys.surfaces[j].glass) : ''; $$('#gt tr[data-g]').forEach(tr => { tr.classList.toggle('gsel', tr.dataset.g === GLW.pick); tr.classList.toggle('gcur', !!cur && key(tr.dataset.g) === cur); }); if (GLW.view === 'map') drawMap(); };
  const list = () => {
    const q = key($('#gq').value.trim()), c = $('#gc').value, ob = $('#go').checked, pf = $('#gp').checked, tm = parseFloat(String($('#gtm').value).replace(',', '.'));
    return OE.catalog().filter(g => (!c || g.cat === c) && (ob || g.st !== 'o') && (!pf || g.st === 'p') && (!q || key(g.name).includes(q)) && (!(tm > 0) || OE.glassTau(g.name, GLW.tl, 10) >= tm));
  };
  const resTxt = r => r && r.some(v => v >= 0) ? r.map(v => v >= 0 ? fmt(v, 2) : '–').join(' / ') : '—';
  const drawList = L => {
    $('#gt').innerHTML = `<tr><th>Nom</th><th>Catalogue</th><th>nd</th><th>νd</th><th title="Dispersion partielle relative">Pg,F</th><th title="Transmission interne pour 10 mm à ${GLW.tl} µm">τ₁₀ (${GLW.tl} µm)</th><th title="Prix relatif à N-BK7 (fichiers AGF)">Prix</th><th>Densité</th><th title="Résistances chimiques CR / FR / SR / AR / PR (plus petit = meilleur)">Résistances</th><th>Domaine (µm)</th><th>Statut</th></tr>` + L.slice(0, 400).map(g => { const e = glassExt(g), t = OE.glassTau(g.name, GLW.tl, 10);
      return `<tr data-g="${esc(g.name)}" tabindex="-1"><td><b>${esc(g.name)}</b></td><td><span class="sw" style="background:${catCol(g.cat)}"></span> ${g.cat}</td><td class="mono">${g.nd.toFixed(5)}</td><td class="mono">${g.vd.toFixed(2)}</td><td class="mono">${isFinite(e.pgf) ? e.pgf.toFixed(4) : '—'}</td><td class="mono" style="${isFinite(t) && t < 0.9 ? 'color:var(--warn)' : ''}">${isFinite(t) ? t.toFixed(3) : '—'}</td><td class="mono">${e.cost != null ? '×' + fmt(e.cost, 3) : '—'}</td><td class="mono">${e.dens ? fx(e.dens, 2) : '—'}</td><td class="mono" style="font-size:11px">${resTxt(e.res)}</td><td class="mono">${g.lmin ?? '—'} – ${g.lmax ?? '—'}</td><td>${{ s: 'standard', p: 'préférentiel', o: 'obsolète', i: 'inquiry' }[g.st] || g.st}</td></tr>`; }).join('');
  };
  // --- diagramme interactif ---
  const val = g => { const e = glassExt(g); return GLW.col === 'tau' ? OE.glassTau(g.name, GLW.tl, 10) : GLW.col === 'cost' ? e.cost : GLW.col === 'dens' ? e.dens : GLW.col === 'dpgf' ? e.dpgf : null; };
  const yOf = g => GLW.ax === 'pgf' ? glassExt(g).pgf : g.nd;
  let pts = [], view = null;
  const drawMap = () => {
    const cv = $('#gmap'); if (!cv || GLW.view !== 'map') return; readTheme(); const { c, w, h } = prepCanvas(cv); const L = GLW.L || [];
    if (!view) { const ys = L.map(yOf).filter(isFinite); view = { x: [100, 15], y: GLW.ax === 'pgf' ? [Math.min(...ys, 0.5) - 0.005, Math.max(...ys, 0.6) + 0.005] : [1.4, 2.08] }; }
    const A = axes(c, { x: 0, y: 0, w, h }, view.x, view.y, { xl: 'Constringence νd', yl: GLW.ax === 'pgf' ? 'Pg,F' : 'nd', title: `${L.length} verres — ${({ cat: 'couleur : catalogue', tau: `couleur : τ₁₀ à ${GLW.tl} µm (rouge < 0,9)`, cost: 'couleur : prix relatif (AGF)', dens: 'couleur : densité', dpgf: 'couleur : ΔPg,F' })[GLW.col]}` });
    GLW.A = A; const vs = L.map(val).filter(v => v != null && isFinite(v)), v0 = Math.min(...vs), v1 = Math.max(...vs), Lc = lut('vir');
    const colOf = g => { if (GLW.col === 'cat') return catCol(g.cat); const v = val(g); if (v == null || !isFinite(v)) return 'rgba(140,140,140,.35)';
      if (GLW.col === 'tau') return v < 0.9 ? '#dc2626' : v < 0.98 ? '#f59e0b' : '#16a34a'; const k = Math.round(255 * (v - v0) / Math.max(1e-12, v1 - v0)); return `rgb(${Lc[k * 3]},${Lc[k * 3 + 1]},${Lc[k * 3 + 2]})`; };
    clip(c, A.P); pts = [];
    for (const g of L) { const y = yOf(g); if (!isFinite(y)) continue; const X = A.X(g.vd), Y = A.Y(y); pts.push([X, Y, g]); c.globalAlpha = g.st === 'o' ? 0.35 : 0.8; c.fillStyle = colOf(g); c.beginPath(); c.arc(X, Y, g.st === 'p' ? 3.2 : 2.4, 0, 7); c.fill(); }
    c.globalAlpha = 1;
    const used = new Set(App.sys.surfaces.map(x => OE.glassKey(x.glass)).filter(Boolean));
    for (const [X, Y, g] of pts) { const sel = g.name === GLW.pick, u = used.has(g.name); if (!sel && !u) continue; c.strokeStyle = sel ? TH.acc : '#ea580c'; c.lineWidth = 2; c.beginPath(); c.arc(X, Y, sel ? 7 : 5.5, 0, 7); c.stroke(); text(c, g.name, X + 8, Y - 7, { size: 10.5, col: sel ? TH.acc : '#ea580c', b: true }); }
    c.restore();
    if (GLW.col !== 'cat' && GLW.col !== 'tau' && vs.length) cbar(c, w - 26, 40, 10, Math.max(40, h - 90), v0, v1, 'vir', '');
    if (GLW.col === 'cat') legend(c, 56, h - 8, [...new Set(L.map(g => g.cat))].map(k => ({ col: catCol(k), l: k })));
  };
  const near = (mx, my) => { let b = null, bd = 9; for (const p of pts) { const d = Math.hypot(p[0] - mx, p[1] - my); if (d < bd) { bd = d; b = p; } } return b; };
  const draw = () => {
    const L = GLW.L = list(); $('#gn').textContent = `${L.length} verres`;
    $('#gt').style.display = GLW.view === 'list' ? '' : 'none'; $('#gmap').style.display = GLW.view === 'map' ? 'block' : 'none'; $('#gmapopt').style.display = GLW.view === 'map' ? 'flex' : 'none'; $('#gwrap').style.overflow = GLW.view === 'map' ? 'hidden' : 'auto';
    if (GLW.view === 'list') drawList(L); else drawMap(); mark();
  };
  GLW.refresh = () => { if (!$('#gconf')) return (GLW.refresh = null); mark(); conf(); };
  $('#gq').addEventListener('input', draw); $('#gc').addEventListener('change', draw); $('#go').addEventListener('change', draw); $('#gp').addEventListener('change', draw);
  $('#gtl').addEventListener('change', e => { const v = parseFloat(String(e.target.value).replace(',', '.')); if (v > 0.2 && v < 3) GLW.tl = v; else e.target.value = GLW.tl; draw(); conf(); });
  $('#gtm').addEventListener('change', e => { const v = parseFloat(String(e.target.value).replace(',', '.')); GLW.tm = v > 0 && v <= 1 ? v : null; draw(); });
  $('#gax').addEventListener('change', e => { GLW.ax = e.target.value; view = null; drawMap(); });
  $('#gcol').addEventListener('change', e => { GLW.col = e.target.value; drawMap(); });
  $$('#dlg [data-gv]').forEach(b => b.addEventListener('click', () => { GLW.view = b.dataset.gv; $$('#dlg [data-gv]').forEach(x => x.classList.toggle('on', x === b)); draw(); }));
  $('#gt').addEventListener('mousedown', e => { const tr = e.target.closest('[data-g]'); if (!tr || e.button !== 0) return; GLW.pick = tr.dataset.g; mark(); conf(); });
  $('#gt').addEventListener('dblclick', e => { if (e.target.closest('[data-g]')) $('#gyes')?.focus(); });
  const cv = $('#gmap'), tip = $('#gtip');
  cv.addEventListener('mousemove', e => { const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    if (GLW.drag) { const A = GLW.A, dx = (mx - GLW.drag.x) / A.P.w * (view.x[1] - view.x[0]), dy = (my - GLW.drag.y) / A.P.h * (view.y[1] - view.y[0]); view = { x: [GLW.drag.v.x[0] - dx, GLW.drag.v.x[1] - dx], y: [GLW.drag.v.y[0] + dy, GLW.drag.v.y[1] + dy] }; GLW.drag.moved = true; drawMap(); return; }
    const p = near(mx, my); if (!p) { tip.style.display = 'none'; cv.style.cursor = 'crosshair'; return; } cv.style.cursor = 'pointer';
    const g = p[2], ex = glassExt(g), t = OE.glassTau(g.name, GLW.tl, 10);
    tip.innerHTML = `<b>${esc(g.name)}</b> <span class="hint">${g.cat} · ${{ s: 'standard', p: 'préférentiel', o: 'obsolète' }[g.st] || g.st}</span><br>nd ${g.nd.toFixed(5)} · νd ${g.vd.toFixed(2)} · Pg,F ${isFinite(ex.pgf) ? ex.pgf.toFixed(4) : '—'}<br>τ₁₀ ${isFinite(t) ? t.toFixed(3) : '—'} à ${GLW.tl} µm · densité ${ex.dens ? fx(ex.dens, 2) : '—'}${ex.cost != null ? ` · prix ×${fmt(ex.cost, 3)}` : ''}`;
    tip.style.display = 'block'; tip.style.left = Math.min(mx + 14, r.width - 230) + 'px'; tip.style.top = Math.max(4, my - 10) + 'px'; });
  cv.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
  cv.addEventListener('mousedown', e => { const r = cv.getBoundingClientRect(); GLW.drag = { x: e.clientX - r.left, y: e.clientY - r.top, v: JSON.parse(JSON.stringify(view)), moved: false }; });
  window.addEventListener('mouseup', function up(e) { if (!GLW.drag) return; const d = GLW.drag; GLW.drag = null; if (!d.moved) { const p = near(d.x, d.y); if (p) { GLW.pick = p[2].name; mark(); conf(); } } if (!$('#gmap')) window.removeEventListener('mouseup', up); });
  cv.addEventListener('wheel', e => { e.preventDefault(); const A = GLW.A, r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, k = e.deltaY < 0 ? 0.8 : 1.25;
    const vx = view.x[0] + (mx - A.P.x) / A.P.w * (view.x[1] - view.x[0]), vy = view.y[0] + (A.P.y + A.P.h - my) / A.P.h * (view.y[1] - view.y[0]);
    const span = Math.abs(view.x[1] - view.x[0]) * k; if (span < 2 || span > 170) return; // de 2 à 170 unités de νd
    view = { x: [vx + (view.x[0] - vx) * k, vx + (view.x[1] - vx) * k], y: [vy + (view.y[0] - vy) * k, vy + (view.y[1] - vy) * k] }; drawMap(); }, { passive: false });
  cv.addEventListener('dblclick', () => { view = null; drawMap(); });
  draw(); conf(); $('#gq').focus();
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
  } else if (e === 'doe') {
    const A = Array.isArray(x.da) ? x.da : [], M = App.M, l = M && M.ok ? M.wls[M.pw] : 0.5876, R = +x.dnr > 0 ? +x.dnr : 10, m = x.dm ?? 1, P = -m * l * 1e-3 * (+A[0] || 0) / (Math.PI * R * R);
    h = head('Surface diffractive (DOE, phase de révolution)') + inp('dm', 'Ordre de diffraction', 'm', m) + inp('dnr', 'Rayon de normalisation', 'mm', R)
      + [0, 1, 2, 3, 4, 5].map(k => `<div class="row"><label>A${k + 1} <span style="opacity:.7">(ρ${['²', '⁴', '⁶', '⁸', '¹⁰', '¹²'][k]}, rad)</span></label><input class="in mini" data-f="doe" data-k="${k}" value="${fmt(+A[k] || 0, 7)}"></div>`).join('')
      + `<div class="row"><label>Variables (optimisation)</label><select class="in mini" data-f="vdoe"><option value="0">aucune</option>${[1, 2, 3, 4].map(n => `<option value="${n}" ${(+x.vdoe || 0) === n ? 'selected' : ''}>A1…A${n}</option>`).join('')}</select></div>`
      + `<div class="hint">Phase φ = Σ Aᵢ ρ²ⁱ (radians), ρ = r / R ; le rayon reçoit en plus le gradient de m·λ·φ/2π (comme la surface « Binary 2 » de Zemax). Puissance paraxiale à ${fmt(l * 1000, 5)} nm : <b>${P ? fmt(P * 1000, 4) + ' dioptries (f = ' + fmt(1 / P, 5) + ' mm)' : '0'}</b>, proportionnelle à λ (dispersion opposée à celle des verres : νd équivalent ≈ −3,45). A1 &lt; 0 : convergente pour m = 1.</div>`;
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
      <option value="ZERN" ${ty === 'ZERN' ? 'selected' : ''}>Zernike (Fringe)</option>
      <option value="TOR" ${ty === 'TOR' ? 'selected' : ''}>Torique / cylindrique (biconique)</option></select></div>`;
  if (ty === 'TOR') { const rx = x.rx === undefined ? x.r : x.rx;
    h += `<div class="row"><label>Rayon X <span style="opacity:.7">(mm)</span></label><input class="in mini" data-f="tor" data-k="rx" value="${isFinite(+rx) && +rx ? fmt(+rx, 7) : 'Infini'}"><button class="tg ${x.vrx ? 'on' : ''}" data-a="vrx" title="Variable (optimisation)">V</button></div>
      <div class="row"><label>Conique X</label><input class="in mini" data-f="tor" data-k="kx" value="${fmt(+x.kx || 0, 6)}"></div>
      <div class="chips"><button class="chip" data-a="torcyl">Cylindre (Rx = ∞)</button><button class="chip" data-a="torsph">Rx = R (sphère)</button></div>
      <div class="hint">Le rayon et la conique de l'éditeur s'appliquent à la section Y ; ceux-ci à la section X. Rx infini : cylindre de puissance en Y. Asphères A4… sur r². Le paraxial et les Seidel utilisent la section Y.</div>`; }
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
      case 'fspread': commit(s => { const m = Math.max(...s.fields.map(f => Math.hypot(f.x || 0, f.y))) || 1; const old = s.fields; s.fields = [0, 0.7, 1].map((k, i) => ({ x: 0, y: +(m * k).toPrecision(6), w: 1, ...(old[i] && old[i].col ? { col: old[i].col } : {}) })); }); break;
      case 'sdfld': openSysData('fld'); break;
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
      case 'vrx': commit(s => { const x = s.surfaces[App.sel]; x.vrx = !x.vrx; if (x.vrx && !(isFinite(+x.rx) && +x.rx)) x.rx = 1e4; }); break;
      case 'torcyl': commit(s => { s.surfaces[App.sel].rx = Infinity; }); break;
      case 'torsph': commit(s => { const x = s.surfaces[App.sel]; x.rx = x.r; x.kx = x.k || 0; }); break;
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
      case 'aimSel': setAim(t.value); break;
      case 'ftype': setFieldType(t.value, true); break;
      case 'fy': if ((v = num()) != null) commit(s => s.fields[i].y = v); break;
      case 'fx': if ((v = num()) != null) commit(s => s.fields[i].x = v); break;
      case 'dmode': commit(s => s.surfaces[App.sel].dmode = t.value); break;
      case 'stype': commit(s => { const x = s.surfaces[App.sel]; x.type = t.value; if (t.value === 'TOR' && x.rx === undefined) { x.rx = Infinity; x.kx = 0; } if (t.value === 'ZERN' && !x.zr) x.zr = Math.max(1, App.M && App.M.ok ? +App.M.S[App.sel].sd.toPrecision(3) : 10); }); break;
      case 'dec': if ((v = num()) != null) commit(s => s.surfaces[App.sel][t.dataset.k] = v); break;
      case 'src': { const k = t.dataset.k; if (k === 'type' || k === 'fib') { commit(s => { s.src[k] = t.value; if (k === 'fib' && t.value === 'sm' && s.src.core > 12) Object.assign(s.src, { core: 8.2, na: 0.14 }); }); break; }
        if (t.value.trim() === '') { commit(s => s.src[k] = null); break; } if ((v = num(x => x > 0)) != null) commit(s => s.src[k] = v); break; }
      case 'det': { const k = t.dataset.k; if (k === 'on' || k === 'noise') { commit(s => s.det[k] = t.checked); break; } if ((v = num(x => x > 0)) != null) commit(s => s.det[k] = ['nx', 'ny', 'bits'].includes(k) ? Math.round(v) : v); break; }
      case 'tor': { const k = t.dataset.k; v = k === 'rx' ? parseNum(t.value, true) : parseNum(t.value, false); if (!(isFinite(v) || (k === 'rx' && Math.abs(v) === Infinity))) { toast('Valeur invalide'); renderSide(); break; } commit(s => s.surfaces[App.sel][k] = v); break; }
      case 'doe': { v = t.value.trim() === '' ? 0 : parseNum(t.value, false); if (!isFinite(v)) { toast('Valeur invalide'); renderSide(); break; } const k = +t.dataset.k; commit(s => { const x = s.surfaces[App.sel]; x.da = Array.isArray(x.da) ? x.da : []; while (x.da.length <= k) x.da.push(0); x.da[k] = v; }); break; }
      case 'vdoe': commit(s => { s.surfaces[App.sel].vdoe = +t.value || 0; }); break;
      case 'ep': if ((v = num()) != null) { if (t.dataset.k === 'fid' && v === 0) { toast('Focale non nulle requise'); renderSide(); break; } commit(s => s.surfaces[App.sel][t.dataset.k] = v); } break;
      case 'coef': { const k = t.dataset.k; v = t.value.trim() === '' ? 0 : parseNum(t.value, false); if (!isFinite(v)) { toast('Valeur invalide'); renderSide(); break; }
        commit(s => { const x = s.surfaces[App.sel]; if (k === 'zr') x.zr = v; else if (k.startsWith('z')) { x.zc = x.zc || []; x.zc[+k.slice(1)] = v; } else { x.xy = x.xy || {}; if (v) x.xy[k] = v; else delete x.xy[k]; } }); break; }
      case 'fw': if ((v = num(x => x >= 0)) != null) commit(s => s.fields[i].w = v); break;
      case 'wum': if ((v = num(x => x > 0.15 && x < 25)) != null) commit(s => s.wavelengths[i].um = v); break;
      case 'ww': if ((v = num(x => x >= 0)) != null) commit(s => s.wavelengths[i].w = v); break;
      case 'wp': commit(s => s.primary = i); break;
      case 'fcol': commit(s => s.fields[i].col = t.value); break;
      case 'wcol': commit(s => s.wavelengths[i].col = t.value); break;
    }
  });
}

/* ---------------- Outils de tracé ---------------- */
let TH = {};
const LIGHT_TH = { fg: '#1c2430', mut: '#6b7686', line: '#dde3ea', grid: '#eef1f5', acc: '#2563eb', panel: '#ffffff', lens: 'rgba(96,165,250,.20)', lensE: '#3b82f6', bg: '#eef1f5' };
function readTheme() { if (App.forceLight) { TH = { ...LIGHT_TH }; return; } const g = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim(); TH = { fg: g('--fg'), mut: g('--mut'), line: g('--line'), grid: g('--grid'), acc: g('--acc'), panel: g('--panel'), lens: g('--lens'), lensE: g('--lensE'), bg: g('--bg') }; }
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
/** zoom à la molette des graphiques : p.zv = { k (1…PZMAX), ox, oy (début de la fenêtre en fraction de la plage d'origine) } */
const AXZ = { on: false, p: null, list: [] }, PZMAX = 20, PZMIN = 0.5, NOZOOM = new Set(['psf', 'wfe', 'imgsim', 'detector', 'source', 'seidel', 'polar']);
function zoomRender(p, fn) { AXZ.on = !NOZOOM.has(p.type); AXZ.p = p; AXZ.list = []; try { return fn(); } finally { if (AXZ.on) p._ax = AXZ.list; AXZ.on = false; AXZ.p = null; } }
function zoomBadge(p, c, w) {
  if (!p.zv || Math.abs(p.zv.k - 1) < 1e-6 || !p._ax || !p._ax.length) return; const P = p._ax[0].P, t = `×${p.zv.k.toFixed(1)} · glisser · double-clic : ×1`;
  c.save(); c.font = '10px Inter, sans-serif'; const tw = c.measureText(t).width + 10, narrow = P.w < tw + 8, x = narrow ? w - tw - 4 : P.x + P.w - tw - 3, y = narrow ? 2 : P.y + 3; c.fillStyle = TH.panel || '#fff'; c.globalAlpha = 0.88; c.fillRect(x, y, tw, 15); c.globalAlpha = 1; c.strokeStyle = TH.acc; c.lineWidth = 1; c.strokeRect(x + 0.5, y + 0.5, tw - 1, 14); c.fillStyle = TH.acc; c.fillText(t, x + 5, y + 11); c.restore();
}
function axes(c, R, xr, yr, o = {}) {
  const ml = o.ml ?? 50, mb = o.mb ?? (o.xl ? 32 : 20), mt = o.title ? 20 : 8, mr = o.mr ?? 10;
  const P = { x: R.x + ml, y: R.y + mt, w: Math.max(10, R.w - ml - mr), h: Math.max(10, R.h - mt - mb) };
  if (o.equal) {
    const sx = P.w / (xr[1] - xr[0]), sy = P.h / (yr[1] - yr[0]), s = Math.min(sx, sy);
    const cx = (xr[0] + xr[1]) / 2, cy = (yr[0] + yr[1]) / 2;
    xr = [cx - P.w / s / 2, cx + P.w / s / 2]; yr = [cy - P.h / s / 2, cy + P.h / s / 2];
  }
  if (AXZ.on) { // zoom à la molette du panneau en cours de rendu : même fenêtre relative pour tous ses graphiques
    const z = AXZ.p && AXZ.p.zv; AXZ.list.push({ P, xr: xr.slice(), yr: yr.slice() });
    if (z && Math.abs(z.k - 1) > 1e-6) { const dx = xr[1] - xr[0], dy = yr[1] - yr[0]; xr = [xr[0] + z.ox * dx, xr[0] + (z.ox + 1 / z.k) * dx]; yr = [yr[0] + z.oy * dy, yr[0] + (z.oy + 1 / z.k) * dy]; }
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
  if (o.title) text(c, o.title, P.x, R.y + 4, { b: true, maxW: R.x + R.w - P.x - 4 });
  c.restore();
  return { X, Y, P, xr, yr };
}
function clip(c, P) { c.save(); c.beginPath(); c.rect(P.x, P.y, P.w, P.h); c.clip(); }
function pline(c, A, xs, ys, col, w = 1.6, dash) {
  clip(c, A.P); c.strokeStyle = col; c.lineWidth = w; c.setLineDash(dash || []); c.beginPath(); let pen = false;
  for (let i = 0; i < xs.length; i++) { if (!isFinite(xs[i]) || !isFinite(ys[i])) { pen = false; continue; } const x = A.X(xs[i]), y = A.Y(ys[i]); pen ? c.lineTo(x, y) : c.moveTo(x, y); pen = true; }
  c.stroke(); c.restore();
}
/** largeur utile (px CSS) d'un canvas, y compris les canvas hors écran du rapport */
const cssW = c => c.canvas.width / (c.getTransform().a || 1);
/** tronque s avec « … » pour tenir dans maxW avec la police courante */
function ellip(c, s, maxW) { if (c.measureText(s).width <= maxW) return s; let a = 0, b = s.length; while (a < b) { const m = (a + b + 1) >> 1; if (c.measureText(s.slice(0, m) + '…').width <= maxW) a = m; else b = m - 1; } return a ? s.slice(0, a) + '…' : ''; }
/** légende sur une ligne : réduit la police puis abrège les libellés si la place manque */
function legend(c, x, y, items) {
  c.save(); c.textBaseline = 'middle';
  const aw = cssW(c) - x - 4, need = sz => { c.font = sz + 'px Inter, sans-serif'; return items.reduce((a, it) => a + 30 + c.measureText(it.l).width, 0) - 6; };
  let sz = 10.5; while (sz > 9 && need(sz) > aw) sz -= 0.5; need(sz);
  let cx = x; const fit = need(sz) > aw;
  items.forEach((it, k) => {
    const left = items.length - k, room = aw - (cx - x) - 24, lab = fit ? ellip(c, it.l, Math.max(18, room / left * (left > 1 ? 1 : 1))) : it.l;
    if (!lab || cx + 18 > x + aw) return;
    c.strokeStyle = it.col; c.fillStyle = it.col; c.lineWidth = 2; c.setLineDash(it.dash || []); c.beginPath(); c.moveTo(cx, y); c.lineTo(cx + 14, y); c.stroke(); c.setLineDash([]);
    c.fillStyle = TH.mut; c.fillText(lab, cx + 18, y); cx += 24 + c.measureText(lab).width + 6;
  });
  c.restore();
}
/** texte ; o.maxW : réduit la police (jusqu'à 9 px) puis abrège pour tenir dans la largeur */
function text(c, s, x, y, o = {}) {
  c.save(); let sz = o.size || 11; const f = () => (o.b ? '600 ' : '') + sz + 'px ' + (o.mono ? 'JetBrains Mono, monospace' : 'Inter, sans-serif'); c.font = f();
  if (o.maxW) { while (sz > 9 && c.measureText(s).width > o.maxW) { sz -= 0.5; c.font = f(); } s = ellip(c, s, o.maxW); }
  c.fillStyle = o.col || TH.fg; c.textAlign = o.align || 'left'; c.textBaseline = o.base || 'top'; c.fillText(s, x, y); c.restore();
}
/** paragraphe renvoyé à la ligne dans la largeur w */
function wrapText(c, s, x, y, w, o = {}) {
  c.save(); c.font = (o.size || 11) + 'px Inter, sans-serif'; const words = s.split(' '), lines = []; let cur = '';
  for (const wd of words) { const t = cur ? cur + ' ' + wd : wd; if (c.measureText(t).width > w && cur) { lines.push(cur); cur = wd; } else cur = t; } if (cur) lines.push(cur); c.restore();
  lines.forEach((l, k) => text(c, l, x, y + k * ((o.size || 11) + 5), o)); return lines.length;
}
const CMAPS = {
  div: ['#1d3b8f', '#3f6fc4', '#8fb4e3', '#f5f5f4', '#f0a58d', '#d4553b', '#8c1a1a'],
  inferno: ['#000004', '#1b0c41', '#4a0c6b', '#781c6d', '#a52c60', '#cf4446', '#ed6925', '#fb9b06', '#f7d13d', '#fcffa4'],
  vir: ['#440154', '#46327e', '#365c8d', '#277f8e', '#1fa187', '#4ac16d', '#a0da39', '#fde725'],
  jet: ['#0000b4', '#0028ff', '#0096ff', '#00dcdc', '#20d060', '#a0e020', '#ffd000', '#ff7000', '#e00000'],
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
/** points de la pupille relative tracés dans le layout : éventail Y (méridien), éventails X et Y (« XY fan » de Zemax),
    anneau (bord de pupille + rayon principal) ou grille carrée dans la pupille */
const RAY3 = [['xy', 'Éventails X et Y'], ['y', 'Éventail Y (méridien)'], ['ring', 'Anneau (bord de pupille)'], ['grid', 'Grille dans la pupille']];
function pupilPattern(kind, n, obs = 0) {
  const P = [], ok = (x, y) => Math.hypot(x, y) >= obs - 1e-9, lin = k => n === 1 ? 0 : -1 + 2 * k / (n - 1);
  if (kind === 'ring') { P.push([0, 0]); for (let k = 0; k < Math.max(4, n); k++) { const a = 2 * Math.PI * k / Math.max(4, n); P.push([Math.cos(a), Math.sin(a)]); } return P.filter(([x, y]) => ok(x, y) || (!x && !y && !obs)); }
  if (kind === 'grid') { const m = Math.min(n, 15); for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) { const x = m === 1 ? 0 : -1 + 2 * i / (m - 1), y = m === 1 ? 0 : -1 + 2 * j / (m - 1); if (x * x + y * y <= 1 + 1e-9 && ok(x, y)) P.push([x, y]); } return P; }
  for (let k = 0; k < n; k++) { const p = lin(k); if (Math.abs(p) >= obs - 1e-9) P.push([0, p]); }
  if (kind === 'xy') for (let k = 0; k < n; k++) { const p = lin(k); if (p && Math.abs(p) >= obs - 1e-9) P.push([p, 0]); }
  return P;
}
function layoutRays(M, n, three) {
  const out = [], S = M.sys, G = layoutGeom(M);
  S.fields.forEach((f, fi) => {
    const P = pupilPattern(three ? App.ray3 : 'y', n, M.obs);
    for (const [px, py] of P) {
      const pts = []; const r = OE.ray(M, M.pw, f, px, py, { pts });
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
function drawLayout(tgt) {
  readTheme();
  const cv = $('#lay'), { c, w, h } = tgt || prepCanvas(cv), M = App.M;
  if (!tgt) $('#legend').innerHTML = App.sys.fields.map((f, i) => `<span><span class="sw" style="background:${fcol(i)}"></span> ${M && M.ok ? fLabel(M, i) : fmt(f.y, 4)}</span>`).join('');
  $$('#laySeg button').forEach(x => x.classList.toggle('on', x.dataset.m === App.mode));
  { const r3 = $('#ray3'); if (r3) { r3.style.display = App.mode === '3d' ? '' : 'none'; if (r3.value !== App.ray3) r3.value = App.ray3; } }
  if (!M || !M.ok) { text(c, (M && M.errors || ['Erreur']).join('  ·  '), 14, 14, { col: '#dc2626' }); return; }
  const G = layoutGeom(M);
  if (App.mode === '3d') return draw3D(c, w, h, M, G);
  const V = App.view;
  { const zr = G.zmax - G.zmin, yr = (G.ymax - G.ymin) * 1.15; V.s0 = Math.min((w - 40) / (zr || 1), (h - 30) / (yr || 1)); }
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
  // enveloppe convexe 2D (chaîne monotone) des points projetés
  const hull = pts => { const q = pts.slice().sort((u, v) => u[0] - v[0] || u[1] - v[1]); if (q.length < 3) return q; const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = []; for (const p of q) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); } for (let i = q.length - 1; i >= 0; i--) { const p = q[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
    return lo.slice(0, -1).concat(up.slice(0, -1)); };
  const fillPoly = (Q, fill, stroke, lw = 1) => { if (!Q.length) return; c.beginPath(); Q.forEach((t, k) => k ? c.lineTo(t[0], t[1]) : c.moveTo(t[0], t[1])); c.closePath(); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); } };
  // point d'une surface au rayon r (au-delà de son demi-diamètre : collerette plane au niveau du bord)
  const sp = (s, H, a, r) => { const x = r * Math.cos(a), y = r * Math.sin(a), k = r > s.sd ? s.sd / r : 1; return G3(s.j, [x, y, s.sz(x * k, y * k)]); };
  const NA = 48, ang = Array.from({ length: NA }, (_, k) => 2 * Math.PI * k / NA);
  const elems = [];
  for (let j = 1; j < N; j++) {
    if (OE.isAir(S[j].glass) || OE.isMirror(S[j])) continue;
    const a = G.surfs[j - 1], b = G.surfs[j], H = Math.max(a.sd, b.sd), pts = [];
    for (const s of [a, b]) { pts.push(T(sp(s, H, 0, 0))); for (const f of [0.35, 0.7, 1]) for (const t of ang) pts.push(T(sp(s, H, t, f * H))); }
    elems.push({ j, a, b, H, hull: hull(pts) });
  }
  // 1) corps des lentilles (verre translucide), miroirs et plan image, sous les rayons
  for (const e of elems) fillPoly(e.hull, TH.lens);
  for (const s of G.surfs) {
    const mir = OE.isMirror(S[s.j]), img = s.j === N; if (!mir && !img) continue;
    const Q = hull([T(sp(s, s.sd, 0, 0)), ...ang.map(t => T(sp(s, s.sd, t, s.sd))), ...ang.map(t => T(sp(s, s.sd, t, 0.6 * s.sd)))]);
    fillPoly(Q, mir ? 'rgba(148,163,184,.30)' : 'rgba(148,163,184,.10)');
  }
  // 2) rayons
  c.lineWidth = 1;
  const rays = layoutRays(M, Math.max(3, App.nRays), true);
  c.globalAlpha = 0.85;
  for (const r of rays) { c.strokeStyle = fcol(r.fi); poly(r.pts); }
  c.globalAlpha = 1;
  // 3) contours : silhouette de chaque lentille (ses deux dioptres reliés par la tranche), bords des dioptres, méridiens discrets
  for (const e of elems) {
    const sel = App.sel === e.j || App.sel === e.j + 1;
    fillPoly(e.hull, null, sel ? '#f59e0b' : TH.lensE, sel ? 1.8 : 1.2);
    c.globalAlpha = 0.75; c.strokeStyle = sel ? '#f59e0b' : TH.lensE; c.lineWidth = 0.9;
    for (const s of [e.a, e.b]) { if (s.sd < e.H - 1e-9) poly(ang.concat([0]).map(t => sp(s, e.H, t, e.H))); } // bord de la collerette
    c.globalAlpha = 1;
  }
  for (const s of G.surfs) {
    const sel = s.j === App.sel, mir = OE.isMirror(S[s.j]), sd = s.sd, stop = S[s.j].stop;
    c.strokeStyle = sel ? '#f59e0b' : mir ? TH.fg : s.j === N ? TH.mut : stop ? TH.fg : TH.lensE; c.lineWidth = sel ? 2.2 : stop ? 1.6 : 1.1;
    poly(Array.from({ length: 65 }, (_, k) => { const a = 2 * Math.PI * k / 64, x = sd * Math.cos(a), y = sd * Math.sin(a); return G3(s.j, [x, y, s.sz(x, y)]); }));
    if (stop && OE.isAir(S[s.j].glass) && OE.isAir(S[s.j - 1].glass)) { // diaphragme : lame annulaire
      const R2 = sd * 1.35, Q = [...ang.map(t => T(G3(s.j, [R2 * Math.cos(t), R2 * Math.sin(t), 0]))), ...ang.slice().reverse().map(t => T(G3(s.j, [sd * Math.cos(t), sd * Math.sin(t), 0])))];
      c.beginPath(); Q.forEach((t, k) => k ? c.lineTo(t[0], t[1]) : c.moveTo(t[0], t[1])); c.closePath(); c.fillStyle = 'rgba(148,163,184,.22)'; c.fill('evenodd');
    }
    c.globalAlpha = 0.35; c.lineWidth = 0.7;
    for (let m = 0; m < 2; m++) { const a = Math.PI * m / 2; poly(Array.from({ length: 31 }, (_, k) => { const r = -sd + 2 * sd * k / 30, x = r * Math.cos(a), y = r * Math.sin(a); return G3(s.j, [x, y, s.sz(x, y)]); })); }
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
    e.preventDefault(); let k = Math.exp(-e.deltaY * 0.0015); const V = App.view;
    // zoom borné : de ×0,2 à ×50 par rapport à la vue « Ajuster »
    if (App.mode === '2d') { const s0 = V.s0 || V.s, sn = Math.min(s0 * LAYZ[1], Math.max(s0 * LAYZ[0], V.s * k)); k = sn / V.s; if (Math.abs(k - 1) < 1e-9) { if (k === 1) toast(V.s >= s0 * LAYZ[1] * 0.999 ? 'Zoom maximal (×25)' : 'Zoom minimal (×0,2)', 1200); return; }
      const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top; V.auto = false; V.ox = mx - (mx - V.ox) * k; V.oy = my - (my - V.oy) * k; V.s *= k; }
    else V.s3 = Math.min(LAYZ[1], Math.max(LAYZ[0], (V.s3 || 1) * k));
    drawLayout();
  }, { passive: false });
  cv.addEventListener('dblclick', () => fitView());
}
const LAYZ = [0.2, 25];
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
  mtf: { l: 'FTM / MTF polychromatique', job: p => ({ name: 'mtf', args: { o: { geo: p.mt === 'geo', dl: p.gdl !== false, N: +p.ns || 64, fmax: +p.fmax || 0 } } }) },
  tfmtf: { l: 'FTM through-focus (meilleur foyer)', job: p => ({ name: 'tfmtf', args: { o: { freq: +p.tff || 30, half: p.tfh ? p.tfh / 1000 : 0, n: 21, N: +p.ns || 32 } } }) },
  mtffield: { l: 'FTM selon le champ', job: p => ({ name: 'mtffield', args: { o: { freqs: mffList(p), n: 11, N: +p.ns || 32 } } }) },
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
  thermal: { l: 'Analyse thermique (focale, foyer, qualité vs T)', f: 1, job: p => ({ name: 'thermal', args: { o: { T1: p.t1 ?? -20, T2: p.t2 ?? 60, n: 9, fi: p.fi || 0 } } }) },
  relillum: { l: 'Éclairement relatif', w: 1, job: (p, M) => ({ name: 'relillum', args: { o: { n: 21, wi: p.wi ?? M.pw, grid: 40 } } }) },
  distgrid: { l: 'Grille de distorsion', w: 1 },
  mcsum: { l: 'Multi-configuration : synthèse', html: 1 },
  ghost: { l: 'Images fantômes (réflexions doubles)', html: 1 },
};
/** section (et repère) de l'aide pour chaque type d'analyse */
const HELPAN = { ghost: ['analyses', 'Images fantômes'], tfmtf: ['analyses', 'FTM through-focus'], mtffield: ['analyses', 'FTM selon le champ'], relillum: ['analyses', 'Éclairement relatif'], distgrid: ['analyses', 'Grille de distorsion'], mcsum: ['multiconfig'], spot: ['analyses', 'Diagramme de spot'], rayfan: ['analyses', 'Ray fan'], opdfan: ['analyses', 'OPD fan'], wfe: ['analyses', 'Carte WFE'], zern: ['analyses', 'Zernike'], psf: ['analyses', 'PSF'],
  mtf: ['analyses', 'FTM / MTF'], ee: ['analyses', 'Énergie encerclée'], footprint: ['analyses', 'Footprint'], field: ['analyses', 'Courbure de champ'], seidel: ['analyses', 'Seidel'], chrom: ['analyses', 'Décalage focal chromatique'],
  glass: ['analyses', 'Carte des verres'], polar: ['polarisation'], detector: ['detecteur'], source: ['source'], imgsim: ['imgsim'], presc: ['analyses', 'Prescription'], thermal: ['donnees', 'Analyse thermique'] };
/** aide des fenêtres (par titre) */
const HELPDLG = [['Catalogue de verres', 'verres'], ['Optimisation', 'optimisation'], ['Données système', 'donnees'], ['Tolérancement', 'tolerancement'], ['Rapport', 'rapport'], ['Export', 'fichiers'], ['Import', 'fichiers'], ['Assistant', 'assistant'], ['Multi-configuration', 'multiconfig'], ['Historique', 'historique'], ['Plans de fabrication', 'plans'], ['Rapport de tolérancement', 'tolerancement'], ['À propos', 'demarrage']];
/** choix du nombre de termes de Zernike Fringe (ordre radial et azimutal) */
const ZNOPTS = [[4, 'défocalisation'], [9, '3ᵉ ordre'], [16, '5ᵉ ordre'], [25, '7ᵉ ordre'], [36, '9ᵉ ordre'], [37, '9ᵉ ordre + sphérique 11ᵉ']];
/** groupes du menu des fenêtres d'analyse */
const PTG = [
  ['Image et aberrations', ['spot', 'rayfan', 'opdfan', 'wfe', 'zern']],
  ['Diffraction', ['psf', 'mtf', 'tfmtf', 'mtffield', 'ee']],
  ['Système', ['field', 'distgrid', 'relillum', 'ghost', 'seidel', 'chrom', 'footprint', 'thermal', 'polar', 'mcsum']],
  ['Capteur et simulation', ['detector', 'source', 'imgsim']],
  ['Données et outils', ['glass', 'presc']],
];
const newPaneEl = i => { const d = document.createElement('div'); d.className = 'pane'; d.dataset.i = i; d.innerHTML = `<div class="ph"></div><div class="pb"><canvas></canvas><div class="phtml"></div></div>`; return d; };
function buildPanes() {
  const el = $('#panes'); el.innerHTML = '';
  $$('#floats .fwin[data-fw^="p"]').forEach(w => w.remove());
  const docked = []; for (let i = 0; i < App.grid; i++) if (!App.fw['p' + i]) docked.push(i);
  el.className = 'g' + (docked.length <= 1 ? 1 : docked.length <= 2 ? 2 : docked.length <= 4 ? 4 : 6);
  for (const i of docked) el.appendChild(newPaneEl(i));
  for (const id of Object.keys(App.fw)) if (/^p\d+$/.test(id)) { const i = +id.slice(1); if (!App.panes[i]) { delete App.fw[id]; continue; } fwCreate(id, newPaneEl(i)); }
  fwLayout();
  $$('#gridSeg button').forEach(b => b.classList.toggle('on', +b.dataset.g === App.grid));
  renderPanes();
}
function paneHeader(pi) {
  const p = App.panes[pi], t = PT[p.type] || PT.spot, s = App.sys, M = App.M;
  const opt = k => `<option value="${k}" ${k === p.type ? 'selected' : ''}>${PT[k].l}</option>`, inG = new Set(PTG.flatMap(g => g[1]));
  let h = `<select class="pt" data-p="type">${PTG.map(([g, ks]) => `<optgroup label="${g}">${ks.map(opt).join('')}</optgroup>`).join('')}${Object.keys(PT).filter(k => !inG.has(k)).map(opt).join('')}</select>`;
  if (t.f) { p.fi = Math.min(p.fi || 0, s.fields.length - 1); h += `<select data-p="fi">${s.fields.map((f, i) => `<option value="${i}" ${i === p.fi ? 'selected' : ''}>Champ ${i + 1} (${M && M.ok ? fLabel(M, i) : fmt(f.y, 4)})</option>`).join('')}</select>`; }
  if (t.w) { if (p.wi != null && p.wi >= s.wavelengths.length) p.wi = null; const we = p.wi ?? s.primary; h += `<select data-p="wi">${s.wavelengths.map((w, i) => `<option value="${i}" ${i === we ? 'selected' : ''}>${fmt(w.um * 1000, 5)} nm</option>`).join('')}</select>`; }
  if (t.s) h += `<select data-p="si"><option value="">Surface sélectionnée</option>${s.surfaces.map((x, i) => i ? `<option value="${i}" ${p.si === i ? 'selected' : ''}>Surface ${i}${x.comment ? ' · ' + esc(x.comment) : ''}</option>` : '').join('')}</select>`;
  if (p.type === 'detector') h += `<select data-p="phase"><option value="centre" ${(p.phase || 'centre') === 'centre' ? 'selected' : ''}>centrée sur un pixel</option><option value="coin" ${p.phase === 'coin' ? 'selected' : ''}>centrée sur un coin</option></select>`;
  if (p.type === 'source') {
    const S = src(); h += `<span class="hint">Source : <b>${S.type === 'fiber' ? ({ si: 'fibre SI', gi: 'fibre GI', sm: 'fibre monomode' })[S.fib] + ' ' + fmt(S.core, 4) + ' µm, ON ' + fmt(S.na, 3) : (SRCT.find(q => q[0] === S.type) || [0, ''])[1]}</b></span><button class="bt" data-p="srccfg" style="height:24px">Configurer</button>`;
    if (det().on) h += `<label><input type="checkbox" data-p="pix" ${p.pix ? 'checked' : ''}>pixels</label>`;
  }
  if (p.type === 'imgsim' && det().on) h += `<label title="Échantillonner l'image sur les pixels du détecteur (bruit inclus si activé)"><input type="checkbox" data-p="det" ${p.det !== false ? 'checked' : ''}>détecteur</label>`;
  if (p.type === 'polar') h += `<select data-p="st">${[['X', 'Linéaire X'], ['Y', 'Linéaire Y'], ['P45', 'Linéaire +45°'], ['M45', 'Linéaire −45°'], ['RCP', 'Circulaire droite'], ['LCP', 'Circulaire gauche'], ['NONE', 'Non polarisée']].map(([k, l]) => `<option value="${k}" ${(p.st || 'X') === k ? 'selected' : ''}>${l}</option>`).join('')}</select><label title="Pertes et déphasages de Fresnel aux dioptres non traités"><input type="checkbox" data-p="fresnel" ${p.fresnel !== false ? 'checked' : ''}>Fresnel</label>`;
  if (p.type === 'imgsim') h += `<select data-p="src">${SIMSRC.map(([k, l]) => `<option value="${k}" ${(p.src || 'mire') === k ? 'selected' : ''}>${l}</option>`).join('')}${App.userImg ? `<option value="user" ${p.src === 'user' ? 'selected' : ''}>${esc(App.userImg.name)}</option>` : ''}</select><button class="bt" data-p="load" style="height:24px">Image</button>
    <select data-p="res">${[128, 192, 256, 384].map(r => `<option value="${r}" ${(p.res || 192) == r ? 'selected' : ''}>${r} px</option>`).join('')}</select>
    <label title="Demi-champ objet couvert par l'image (vide : champ max du système)">½ champ <input class="in" data-p="fov" style="width:52px;height:22px" value="${p.fov || ''}" placeholder="auto"></label>
    <label><input type="checkbox" data-p="upright" ${p.upright ? 'checked' : ''}>redresser</label><button class="bt" data-p="run" style="height:24px">▶ Simuler</button>`;
  if (p.type === 'glass') h += `<select data-p="cat"><option value="">Tous les catalogues</option>${OE.cats().map(k => `<option ${p.cat === k ? 'selected' : ''}>${k}</option>`).join('')}</select>`;
  if (p.type === 'psf' && det().on) h += `<label title="PSF intégrée sur les pixels du détecteur"><input type="checkbox" data-p="pix" ${p.pix ? 'checked' : ''}>pixels</label>`;
  if (p.type === 'psf') h += `<span class="seg sm"><button data-p="view2" class="${p.view === '3d' ? '' : 'on'}" title="Carte 2D">2D</button><button data-p="view3" class="${p.view === '3d' ? 'on' : ''}" title="Surface 3D (glisser pour tourner)">3D</button></span><label><input type="checkbox" data-p="log" ${p.log ? 'checked' : ''}>log</label><label class="zr" title="Zoom continu de ×0,5 à ×5 (ou molette sur la PSF)">zoom <input type="range" data-p="zoom" min="0.5" max="5" step="0.05" value="${psfZoom(p)}"><span class="zv">×${psfZoom(p).toFixed(2)}</span></label><button class="bt" data-p="zfit" style="height:24px" title="Ajuster : zoom ×1${p.view === '3d' ? ' et orientation 3D par défaut' : ''} (ou double-clic sur la PSF)">Ajuster</button>`;
  if (p.type === 'wfe') h += `<select data-p="zres" title="Afficher le front d'onde complet ou le résidu après ajustement des premiers termes de Zernike (ordres supérieurs)"><option value="0">Front d'onde</option>${ZNOPTS.map(([n, l]) => `<option value="${n}" ${+p.zres === n ? 'selected' : ''}>Résidu après Z${n} (${l})</option>`).join('')}</select>${+p.zres > 0 ? '' : `<label><input type="checkbox" data-p="tilt" ${p.tilt !== false ? 'checked' : ''}>sans tilt</label>`}`;
  if (p.type === 'zern') h += `<select data-p="nz" title="Nombre de termes de Zernike Fringe ajustés">${ZNOPTS.map(([n, l]) => `<option value="${n}" ${(+p.nz || 16) === n ? 'selected' : ''}>Z1…Z${n} — ${l}</option>`).join('')}</select>`;
  if (p.type === 'mtf') h += `<select data-p="mt" title="Méthode de calcul de la FTM"><option value="diff" ${p.mt !== 'geo' ? 'selected' : ''}>Diffraction</option><option value="geo" ${p.mt === 'geo' ? 'selected' : ''}>Géométrique</option></select>${p.mt === 'geo' ? `<label title="Multiplier par la FTM d'une pupille parfaite (recommandé)"><input type="checkbox" data-p="gdl" ${p.gdl !== false ? 'checked' : ''}>× diffraction</label>` : `<select data-p="ns" title="Échantillonnage de la pupille (front d'onde N×N)">${[32, 64, 128, 256].map(n => `<option value="${n}" ${(+p.ns || 64) === n ? 'selected' : ''}>${n}×${n}</option>`).join('')}</select>`}<label>f max <input class="in" data-p="fmax" style="width:56px;height:22px" value="${p.fmax || ''}" placeholder="auto"></label>`;
  if (p.type === 'spot') h += `<label><input type="checkbox" data-p="chief" ${p.chief ? 'checked' : ''}>réf. principal</label>`;
  const nsSel = d => `<select data-p="ns" title="Échantillonnage de la pupille (front d'onde N×N) : 32 rapide, 64 précis">${[32, 64, 128].map(n => `<option value="${n}" ${(+p.ns || d) === n ? 'selected' : ''}>${n}×${n}</option>`).join('')}</select>`;
  if (p.type === 'ghost') h += `<select data-p="coat" title="Réflectance des dioptres"><option value="0" ${!+p.coat ? 'selected' : ''}>Non traités (Fresnel)</option>${[[0.01, 'AR 1 %'], [0.005, 'AR 0,5 %'], [0.0025, 'AR 0,25 %'], [0.001, 'AR 0,1 %']].map(([v, l]) => `<option value="${v}" ${+p.coat === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
  if (p.type === 'tfmtf') h += `<label>f <input class="in" data-p="tff" style="width:46px;height:22px" value="${p.tff || 30}"> cy/mm</label><label title="Demi-étendue de la défocalisation (vide : automatique, au moins 8 λF² et englobant le meilleur foyer)">± <input class="in" data-p="tfh" style="width:52px;height:22px" value="${p.tfh || ''}" placeholder="auto"> µm</label>${nsSel(32)}<button class="bt" data-p="tfapply" style="height:24px" title="Déplacer le plan image au meilleur foyer trouvé (épaisseur avant l'image)">Appliquer le meilleur foyer</button>`;
  if (p.type === 'mtffield') h += `<label title="Fréquences spatiales (cycles/mm), séparées par des virgules ou des espaces">f <input class="in" data-p="mff" style="width:96px;height:22px" value="${esc(mffList(p).join(', '))}"> cy/mm</label>${nsSel(32)}`;
  if (p.type === 'distgrid') h += `<select data-p="dgn" title="Nombre de lignes de la grille">${[7, 11, 15, 21].map(n => `<option value="${n}" ${(+p.dgn || 11) === n ? 'selected' : ''}>${n}×${n}</option>`).join('')}</select><label title="Coché : les coins de la grille correspondent au champ maximal (diagonale du capteur). Décoché : le bord de la grille correspond au champ maximal."><input type="checkbox" data-p="diag" ${p.diag !== false ? 'checked' : ''}>coins = champ max</label><label title="Amplifier les écarts pour les rendre visibles"><input type="checkbox" data-p="dgx" ${p.dgx ? 'checked' : ''}>écarts ×10</label>`;
  if (p.type === 'thermal') h += `<label>de <input class="in" data-p="t1" style="width:46px;height:22px" value="${p.t1 ?? -20}"></label><label>à <input class="in" data-p="t2" style="width:46px;height:22px" value="${p.t2 ?? 60}"> °C</label>`;
  const fl = !!App.fw['p' + pi];
  h += `<span class="grow"></span><button class="x hb" data-help="${(HELPAN[p.type] || ['analyses'])[0]}" data-ha="${esc((HELPAN[p.type] || [])[1] || '')}" title="Aide sur cette analyse">?</button>${t.html ? '' : '<button class="x" data-p="png" title="Enregistrer l\'image (PNG)">⤓</button>'}${fl ? '' : `<button class="x" data-fw="p${pi}" title="Détacher dans une fenêtre flottante (déplaçable, redimensionnable)">⧉</button><button class="x" data-p="max" title="Agrandir / réduire">⤢</button>`}`;
  return h;
}
function setupPanes() {
  for (const el of [$('#panes'), $('#floats')]) setupPaneEvents(el);
  new ResizeObserver(() => { clearTimeout(App._rz); App._rz = setTimeout(() => { drawLayout(); renderPanes(); }, 80); }).observe(document.body);
  setupFloats();
}
function setupPaneEvents(el) {
  const later = pi => { cancelAnimationFrame(App._pz); App._pz = requestAnimationFrame(() => renderPane(pi)); };
  el.addEventListener('input', e => { const t = e.target; if (t.dataset.p !== 'zoom' || !t.closest('.pane')) return; const pi = +t.closest('.pane').dataset.i; App.panes[pi].zoom = +t.value; const z = t.parentElement.querySelector('.zv'); if (z) z.textContent = '×' + (+t.value).toFixed(2);
    const p = App.panes[pi]; if (p.view === '3d') { p._drag = true; clearTimeout(App._zs); App._zs = setTimeout(() => { delete p._drag; paneBody(pi); }, 250); } paneBody(pi); });
  el.addEventListener('wheel', e => { const pane = e.target.closest('.pane'); if (!pane || !e.target.closest('.pb canvas')) return; const pi = +pane.dataset.i, p = App.panes[pi]; if (!p || PT[p.type].html || p.type === 'psf' || NOZOOM.has(p.type)) return;
    const cv = e.target.closest('canvas'), r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, A = (p._ax || []).find(a => mx >= a.P.x && mx <= a.P.x + a.P.w && my >= a.P.y && my <= a.P.y + a.P.h);
    if (!A) return; e.preventDefault();
    const z = p.zv || { k: 1, ox: 0, oy: 0 }; let k2 = Math.min(PZMAX, Math.max(PZMIN, z.k * (e.deltaY < 0 ? 1.2 : 1 / 1.2))); if ((z.k - 1) * (k2 - 1) < 0) k2 = 1; // passage par ×1
    if (k2 === z.k) { toast(k2 === PZMAX ? `Zoom maximal (×${PZMAX})` : `Dézoom maximal (×${PZMIN.toLocaleString('fr-FR')})`, 1200); return; }
    const fx = (mx - A.P.x) / A.P.w, fy = (A.P.y + A.P.h - my) / A.P.h, gx = z.ox + fx / z.k, gy = z.oy + fy / z.k, cl = (v, k) => Math.min(Math.max(0, 1 - 1 / k), Math.max(Math.min(0, 1 - 1 / k), v));
    p.zv = Math.abs(k2 - 1) < 1e-4 ? null : { k: k2, ox: cl(gx - fx / k2, k2), oy: cl(gy - fy / k2, k2) };
    cancelAnimationFrame(App._pz); App._pz = requestAnimationFrame(() => renderPane(pi)); clearTimeout(App._zsv); App._zsv = setTimeout(save, 400); }, { passive: false });
  el.addEventListener('dblclick', e => { const pane = e.target.closest('.pane'); if (!pane || !e.target.closest('.pb canvas')) return; const pi = +pane.dataset.i, p = App.panes[pi]; if (p && p.zv) { p.zv = null; renderPane(pi); save(); } });
  el.addEventListener('mousedown', e => { const pane = e.target.closest('.pane'); if (!pane || e.button !== 0 || !e.target.closest('.pb canvas')) return; const pi = +pane.dataset.i, p = App.panes[pi]; if (!p || !p.zv || p.type === 'psf') return;
    const cv = e.target.closest('canvas'), r = cv.getBoundingClientRect(), A = (p._ax || []).find(a => e.clientX - r.left >= a.P.x && e.clientX - r.left <= a.P.x + a.P.w && e.clientY - r.top >= a.P.y && e.clientY - r.top <= a.P.y + a.P.h); if (!A) return;
    e.preventDefault(); const x0 = e.clientX, y0 = e.clientY, z0 = { ...p.zv }, cl = v => Math.min(Math.max(0, 1 - 1 / z0.k), Math.max(Math.min(0, 1 - 1 / z0.k), v)); cv.style.cursor = 'grabbing';
    const mv = ev => { p.zv = { k: z0.k, ox: cl(z0.ox - (ev.clientX - x0) / A.P.w / z0.k), oy: cl(z0.oy + (ev.clientY - y0) / A.P.h / z0.k) }; cancelAnimationFrame(App._pz); App._pz = requestAnimationFrame(() => renderPane(pi)); };
    const up = () => { cv.style.cursor = ''; window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); save(); };
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up); });
  el.addEventListener('wheel', e => { const pane = e.target.closest('.pane'); if (!pane || !e.target.closest('.pb')) return; const pi = +pane.dataset.i, p = App.panes[pi]; if (!p || p.type !== 'psf') return;
    e.preventDefault(); p.zoom = Math.min(5, Math.max(0.5, psfZoom(p) * (e.deltaY < 0 ? 1.08 : 1 / 1.08))); const r = pane.querySelector('input[data-p="zoom"]'); if (r) { r.value = p.zoom; r.parentElement.querySelector('.zv').textContent = '×' + p.zoom.toFixed(2); }
    if (p.view === '3d') p._drag = true; paneBody(pi); clearTimeout(App._zs); App._zs = setTimeout(() => { if (p._drag) { delete p._drag; paneBody(pi); } save(); }, 300); }, { passive: false });
  el.addEventListener('mousedown', e => { const pane = e.target.closest('.pane'); if (!pane || e.button !== 0 || !e.target.closest('.pb canvas')) return; const pi = +pane.dataset.i, p = App.panes[pi]; if (!p || p.type !== 'psf' || p.view !== '3d') return;
    e.preventDefault(); const x0 = e.clientX, y0 = e.clientY, a0 = p.yaw ?? -35, b0 = p.pitch ?? 28;
    const mv = ev => { p._drag = true; p.yaw = a0 + (ev.clientX - x0) * 0.5; p.pitch = Math.max(5, Math.min(89, b0 + (ev.clientY - y0) * 0.4)); paneBody(pi); }, up = () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); delete p._drag; paneBody(pi); save(); };
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up); });
  const zfit = pi => { const p = App.panes[pi]; p.zoom = 1; delete p.yaw; delete p.pitch; save(); renderPane(pi); };
  el.addEventListener('click', e => { const z = e.target.closest('[data-p="zfit"]'); if (z) { zfit(+z.closest('.pane').dataset.i); return; } });
  el.addEventListener('dblclick', e => { const pane = e.target.closest('.pane'); if (!pane || !e.target.closest('.pb canvas')) return; const pi = +pane.dataset.i; if (App.panes[pi] && App.panes[pi].type === 'psf') zfit(pi); });
  el.addEventListener('click', e => { const b = e.target.closest('[data-p="view2"],[data-p="view3"]'); if (!b) return; const pi = +b.closest('.pane').dataset.i; App.panes[pi].view = b.dataset.p === 'view3' ? '3d' : '2d'; save(); renderPane(pi); });
  void later;
  el.addEventListener('change', e => {
    const t = e.target, k = t.dataset.p; if (!k || !t.closest('.pane')) return; const pi = +t.closest('.pane').dataset.i, p = App.panes[pi];
    if (k === 'zoom') { p.zoom = Math.min(5, Math.max(0.5, +t.value)); save(); paneBody(pi); return; }
    if (k === 'type') { App.panes[pi] = { type: t.value }; }
    else if (['log', 'tilt', 'chief', 'fresnel', 'upright', 'pix', 'det', 'grid', 'gdl', 'diag', 'dgx'].includes(k)) p[k] = t.checked;
    else if (k === 'tff' || k === 'tfh') { const v = parseFloat(String(t.value).replace(',', '.')); p[k] = isFinite(v) && v > 0 ? v : null; }
    else if (k === 'mff') p.mff = t.value;
    else if (k === 'coat') p.coat = +t.value;
    else if (['stype', 'phase', 'mt'].includes(k)) p[k] = t.value;
    else if (['sd', 'sna', 'sw', 'sh'].includes(k)) { const v = parseFloat(String(t.value).replace(',', '.')); p[k] = isFinite(v) && v >= 0 ? v : null; }
    else if (k === 'st' || k === 'src') p[k] = t.value;
    else if (k === 'fov') { const v = parseFloat(String(t.value).replace(',', '.')); p.fov = isFinite(v) && v > 0 ? v : null; }
    else if (k === 'si') p.si = t.value === '' ? null : +t.value;
    else if (k === 'cat') p.cat = t.value;
    else if (k === 'fmax') { const v = parseFloat(t.value); p.fmax = isFinite(v) && v > 0 ? v : null; }
    else if (k === 't1' || k === 't2') { const v = parseFloat(String(t.value).replace(',', '.')); p[k] = isFinite(v) && v > -273 ? v : null; }
    else p[k] = +t.value;
    save(); renderPane(pi);
  });
  el.addEventListener('click', e => {
    const sc = e.target.closest('[data-p="srccfg"]'); if (sc) { closedCards.delete('src'); renderSide(); const el2 = $('#side [data-card="src"]'); if (el2) { el2.scrollIntoView({ behavior: 'smooth', block: 'start' }); el2.style.outline = '2px solid var(--acc)'; setTimeout(() => el2.style.outline = '', 1200); } return; }
    const ld = e.target.closest('[data-p="load"]'); if (ld) { App.simPane = +ld.closest('.pane').dataset.i; $('#imgIn').click(); return; }
    const tfa = e.target.closest('[data-p="tfapply"]'); if (tfa) { const p = App.panes[+tfa.closest('.pane').dataset.i], d = App.M && App.M.ok ? JCACHE.get(jobSpec(p, App.M).key) : null;
      if (!d || d.err || !isFinite(d.best)) { toast('Attendez la fin du calcul'); return; }
      const j = App.sys.surfaces.length - 2; if (App.sys.surfaces[j].tsolve === 'M') { toast('L\'épaisseur avant l\'image est pilotée par un solve M : retirez-le d\'abord'); return; }
      commit(s => { s.surfaces[j].t = +(d.t0 + d.best).toFixed(6); }); toast(`Plan image déplacé de ${fx(d.best * 1000, 1)} µm (meilleur foyer à ${fmt(d.freq, 4)} cy/mm)`); return; }
    const run = e.target.closest('[data-p="run"]'); if (run) { const pi = +run.closest('.pane').dataset.i; SIM.cache.clear(); SIM.force = true; renderPane(pi); return; }
    const g = e.target.closest('[data-p="png"]');
    if (g) { const pane = g.closest('.pane'), cv = pane.querySelector('canvas'), p = App.panes[+pane.dataset.i]; const o = document.createElement('canvas'); o.width = cv.width; o.height = cv.height; const oc = o.getContext('2d'); oc.fillStyle = TH.panel || '#fff'; oc.fillRect(0, 0, o.width, o.height); oc.drawImage(cv, 0, 0); o.toBlob(b => download(`${fileBase()}_${p.type}.png`, b)); return; }
    const b = e.target.closest('[data-p="max"]'); if (b) { const pane = b.closest('.pane'); pane.classList.toggle('max'); renderPane(+pane.dataset.i); } });
  el.addEventListener('dblclick', e => { if (e.target.closest('.ph') && !e.target.closest('select,input') && !e.target.closest('.fwin')) { const pane = e.target.closest('.pane'); pane.classList.toggle('max'); renderPane(+pane.dataset.i); } });
}
function renderPanesIf(type) { $$('.pane[data-i]').forEach(d => { if (App.panes[+d.dataset.i] && App.panes[+d.dataset.i].type === type) renderPane(+d.dataset.i); }); }
function renderPanes() { readTheme(); const t0 = performance.now(); $$('.pane[data-i]').forEach(d => { if (!d.closest('.fwin.min')) renderPane(+d.dataset.i); }); App.lastPanes = performance.now() - t0; status(); }
/** redessine le contenu d'un panneau sans reconstruire son en-tête (curseurs, rotation 3D) */
function paneBody(pi) {
  const d = document.querySelector(`.pane[data-i="${pi}"]`), p = App.panes[pi], M = App.M; if (!d || !M || !M.ok || PT[p.type].html) return;
  const cv = d.querySelector('canvas'); try { const { c, w, h } = prepCanvas(cv); zoomRender(p, () => { if (PT[p.type].job) { const dd = JCACHE.get(jobSpec(p, M).key); if (dd && !dd.err) R[p.type](p, M, c, w, h, dd); } else R[p.type](p, M, c, w, h); }); zoomBadge(p, c, w); } catch (err) { console.error(err); }
}
function renderPane(pi) {
  const d = document.querySelector(`.pane[data-i="${pi}"]`); if (!d) return;
  { const w = d.closest('.fwin'); if (w) { const t = w.querySelector('.fwh b'); if (t) t.textContent = (PT[App.panes[pi].type] || PT.spot).l; } }
  const p = App.panes[pi]; if (!PT[p.type]) p.type = 'spot';
  d.querySelector('.ph').innerHTML = paneHeader(pi);
  const cv = d.querySelector('canvas'), hd = d.querySelector('.phtml'), M = App.M;
  const isH = !!PT[p.type].html;
  hd.style.display = isH ? 'block' : 'none'; cv.style.display = isH ? 'none' : 'block';
  if (!M || !M.ok) { if (isH) hd.innerHTML = '<p style="color:#dc2626">Système invalide</p>'; else { const { c } = prepCanvas(cv); text(c, 'Système invalide : ' + (M && M.errors || []).join(', '), 12, 12, { col: '#dc2626' }); } return; }
  try {
    if (isH) hd.innerHTML = R[p.type](p, M);
    else {
      const { c, w, h } = prepCanvas(cv);
      if (PT[p.type].job) {
        const dd = paneData(p, M);
        if (dd === undefined) drawWait(p, c, w, h, BG.pend && BG.pend.get(jobSpec(p, M).key));
        else if (!dd || dd.err) text(c, 'Erreur : ' + ((dd && dd.err) || 'calcul impossible'), 12, 12, { col: '#dc2626' });
        else { zoomRender(p, () => R[p.type](p, M, c, w, h, dd)); zoomBadge(p, c, w); }
      } else { zoomRender(p, () => R[p.type](p, M, c, w, h)); zoomBadge(p, c, w); }
    }
  } catch (err) {
    console.error(err);
    if (isH) hd.innerHTML = 'Erreur : ' + esc(err.message); else { const { c } = prepCanvas(cv); text(c, 'Erreur : ' + err.message, 12, 12, { col: '#dc2626' }); }
  }
}
/** type de champ effectif d'un système (ang, obj, pim, rim) */
const ftypeOf = s => { const inf = !isFinite(s.surfaces[0].t) || Math.abs(s.surfaces[0].t) > 1e10; return OE.FTYPES[s.ftype] ? s.ftype : (inf ? 'ang' : 'obj'); };
/** fréquences de l'analyse « FTM selon le champ » */
const mffList = p => { const v = String(p.mff ?? '10, 30, 50').split(/[\s,;]+/).map(x => parseFloat(x)).filter(x => isFinite(x) && x > 0).slice(0, 6); return v.length ? v : [10, 30, 50]; };
const fUnitOf = t => t === 'ang' ? '°' : t === 'obj' ? ' mm' : ' mm im.';
/* ---------------- PSF : zoom continu et vue 3D (surface façon CODE V « Diffraction Intensity Spread Function ») ---------------- */
const PSFC = new WeakMap();
const psfZoom = p => Math.min(5, Math.max(0.5, +p.zoom || 2));
function psf3d(p, M, c, w, h, g, ra) {
  const ps = g, ext = g.half * 1e3, m = g.m, mx = g.strehl || 1;
  const yaw = (p.yaw ?? -35) * Math.PI / 180, pit = (p.pitch ?? 28) * Math.PI / 180, log = !!p.log;
  // hauteurs aux nœuds du maillage (la PSF est calculée exactement en ces points)
  const Z = new Float64Array(m * m);
  for (let k = 0; k < m * m; k++) { const v = g.I[k] / mx; Z[k] = log ? (Math.log10(Math.max(v, 1e-6)) + 6) / 6 : v; }
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pit), sp = Math.sin(pit), H = 0.9;
  const pr = (x, y, z) => { const xr = x * cy - y * sy, yr = x * sy + y * cy; return [xr, z * H * cp + yr * sp, yr]; };
  // échelle : boîte [-1,1]² × [0,1] projetée dans la zone de tracé
  const pts = []; for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [0, 1]) pts.push(pr(x, y, z));
  const x0 = Math.min(...pts.map(q => q[0])), x1 = Math.max(...pts.map(q => q[0])), y0 = Math.min(...pts.map(q => q[1])), y1 = Math.max(...pts.map(q => q[1]));
  const L = 48, R0 = 70, T = 26, B = 40, sc = Math.min((w - L - R0) / (x1 - x0), (h - T - B) / (y1 - y0));
  const SX = q => L + (q[0] - x0) * sc + ((w - L - R0) - (x1 - x0) * sc) / 2, SY = q => T + (y1 - q[1]) * sc + ((h - T - B) - (y1 - y0) * sc) / 2;
  const P2 = (x, y, z) => { const q = pr(x, y, z); return [SX(q), SY(q)]; };
  text(c, `PSF 3D  Strehl ${fx(ps.strehl, 4)} · zoom ×${fmt(psfZoom(p), 2)}${log ? ' · log' : ''}`, 8, 4, { b: true });
  // parois du fond (les deux plus éloignées) et sol, graduations
  const far = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => [x, y, pr(x, y, 0)[2]]).sort((a, b) => b[2] - a[2]), fc = far[0];
  c.save(); c.lineWidth = 1;
  const poly = (Q, fill, stroke) => { c.beginPath(); Q.forEach((q, k) => k ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])); c.closePath(); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.stroke(); } };
  for (const [ax, ay] of [[-fc[0], fc[1]], [fc[0], -fc[1]]]) poly([P2(fc[0], fc[1], 0), P2(ax, ay, 0), P2(ax, ay, 1), P2(fc[0], fc[1], 1)], 'rgba(148,163,184,.13)', TH.line);
  poly([P2(-1, -1, 0), P2(1, -1, 0), P2(1, 1, 0), P2(-1, 1, 0)], null, TH.line);
  c.strokeStyle = TH.line; c.fillStyle = TH.mut; c.font = '10px Inter, sans-serif';
  for (const zt of [0, 0.25, 0.5, 0.75, 1]) { const a = P2(fc[0], fc[1], zt), b = P2(-fc[0], fc[1], zt), d = P2(fc[0], -fc[1], zt); c.beginPath(); c.moveTo(b[0], b[1]); c.lineTo(a[0], a[1]); c.lineTo(d[0], d[1]); c.stroke(); }
  // axe vertical gradué sur l'arête gauche visible
  const edges = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => [x, y, P2(x, y, 0)[0]]).sort((a, b) => a[2] - b[2]), ez = edges[0];
  c.textAlign = 'right'; c.textBaseline = 'middle';
  for (const zt of [0, 0.5, 1]) { const q = P2(ez[0], ez[1], zt); c.fillText(log ? String(Math.round(-6 + 6 * zt)) : String(Math.round(zt * 100)), q[0] - 5, q[1]); }
  { const q = P2(ez[0], ez[1], 0.55); c.save(); c.translate(q[0] - 30, q[1]); c.rotate(-Math.PI / 2); c.textAlign = 'center'; c.fillText(log ? 'log₁₀ I' : 'Intensité (%)', 0, 0); c.restore(); }
  // graduations X et Y (µm) sur les arêtes avant du sol
  const { t: tk, s: ts } = ticks(-ext, ext, 4);
  const near = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => [x, y, pr(x, y, 0)[2]]).sort((a, b) => a[2] - b[2])[0];
  c.textAlign = 'center'; c.textBaseline = 'top';
  for (const t of tk) { const u = t / ext; if (Math.abs(u) > 1.0001) continue; const qa = P2(u, near[1], 0), qb = P2(near[0], u, 0); c.fillText(tl(t, ts), qa[0], qa[1] + 4); c.fillText(tl(t, ts), qb[0], qb[1] + 4); }
  { const qa = P2(0, near[1] * 1.28, 0), qb = P2(near[0] * 1.28, 0, 0); c.fillStyle = TH.fg; c.fillText('X, µm', qa[0], qa[1] + 6); c.fillText('Y, µm', qb[0], qb[1] + 6); }
  // surface : mailles de la plus éloignée à la plus proche
  const U = g.xs.map(x => x / g.half), Lc = lut('jet'), G = (i, j) => [U[i], U[j]], quads = [];
  for (let j = 0; j < m - 1; j++) for (let i = 0; i < m - 1; i++) { const [xa, ya] = G(i, j), [xb, yb] = G(i + 1, j + 1); quads.push([i, j, pr((xa + xb) / 2, (ya + yb) / 2, 0)[2]]); }
  quads.sort((a, b) => b[2] - a[2]);
  // éclairage doux (normale de chaque maille, lumière fixe par rapport à l'observateur) pour lire le relief
  const lx = -0.45 * cy - 0.35 * sy, ly = 0.45 * sy - 0.35 * cy, lz = 0.82;
  c.lineJoin = 'round'; c.lineWidth = 0.6;
  for (const [i, j] of quads) {
    const z00 = Z[j * m + i], z10 = Z[j * m + i + 1], z11 = Z[(j + 1) * m + i + 1], z01 = Z[(j + 1) * m + i];
    const [xa, ya] = G(i, j), [xb, yb] = G(i + 1, j + 1), zm = Math.max(0, Math.min(1, (z00 + z10 + z11 + z01) / 4)), k = Math.round(zm * 255);
    const gx = H * ((z10 + z11) - (z00 + z01)) / (2 * (xb - xa)), gy = H * ((z01 + z11) - (z00 + z10)) / (2 * (yb - ya)), nn = Math.hypot(gx, gy, 1);
    const sh = Math.max(0.55, Math.min(1.15, 0.62 + 0.5 * (-gx * lx - gy * ly + lz) / nn));
    const col = `rgb(${Math.min(255, Lc[k * 3] * sh) | 0},${Math.min(255, Lc[k * 3 + 1] * sh) | 0},${Math.min(255, Lc[k * 3 + 2] * sh) | 0})`;
    poly([P2(xa, ya, z00), P2(xb, ya, z10), P2(xb, yb, z11), P2(xa, yb, z01)], col, col);
  }
  c.restore();
  cbar(c, w - 58, 30, 12, Math.max(40, h - 70), log ? -6 : 0, log ? 0 : 100, 'jet', log ? 'log₁₀' : '%');
  text(c, `glisser : tourner · molette : zoom · double-clic : ajuster · Ø Airy ${fx(2 * ra, 2)} µm`, 8, h - 14, { col: TH.mut, size: 10 });
}
const fLabel = (M, i) => { const f = (M.ufields || M.sys.fields)[i] || M.sys.fields[i], u = fUnitOf(M.ftype || (M.objInf ? 'ang' : 'obj')); return f.x ? `(${fmt(f.x, 4)}, ${fmt(f.y, 4)})${u}` : `${fmt(f.y, 4)}${u}`; };
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
    let wf = OE.wavefront(M, p.fi || 0, p.wi ?? M.pw, 64, p.tilt !== false), lbl = 'WFE';
    if (+p.zres > 0 && wf.ok) { const z = OE.zernFit(OE.wavefront(M, p.fi || 0, p.wi ?? M.pw, 64, false), +p.zres); wf = { ...wf, W: z.R, rms: z.rmsRes, pv: z.pvRes }; lbl = `Résidu après Z1…Z${z.nz}`; }
    let m = 0; for (const v of wf.W) if (isFinite(v)) m = Math.max(m, Math.abs(v)); m = m || 1e-3;
    const A = axes(c, { x: 0, y: 0, w: w - 70, h: h - 6 }, [-1.05, 1.05], [-1.05, 1.05], { equal: true, title: `${lbl}  RMS ${fx(wf.rms, 4)} λ · PV ${fx(wf.pv, 4)} λ ${lbl === 'WFE' && wf.rms <= 0.15 ? ` · Strehl (Maréchal) ≈ ${fx(Math.exp(-((2 * Math.PI * wf.rms) ** 2)), 3)}` : ''}`, ml: 40, mb: 22, zero: false });
    A.xr0 = -1; A.xr1 = 1; A.yr0 = -1; A.yr1 = 1;
    heat(c, A, wf.W, wf.N, wf.N, -m, m, 'div', false);
    c.strokeStyle = TH.line; c.beginPath(); c.arc(A.X(0), A.Y(0), A.X(1) - A.X(0), 0, 2 * Math.PI); c.stroke();
    cbar(c, w - 58, 30, 12, Math.max(40, h - 70), -m, m, 'div', 'λ');
    text(c, `λ = ${fmt(M.wls[p.wi ?? M.pw] * 1000, 5)} nm · champ ${fLabel(M, p.fi || 0)} · réf. sphère centrée sur le rayon principal`, 40, h - 14, { maxW: w - 48, col: TH.mut, size: 10 });
  },
  zern(p, M) {
    const nz = ZNOPTS.some(o => o[0] === +p.nz) ? +p.nz : 16, wf = OE.wavefront(M, p.fi || 0, p.wi ?? M.pw, 64, false);
    if (!wf.ok) return '<p class="hint">Front d\'onde indisponible pour ce champ (rayon principal arrêté).</p>';
    const z = OE.zernFit(wf, nz), mx = Math.max(...z.rmsTerm.slice(1)) || 1, expl = Math.sqrt(z.rmsTerm.slice(1).reduce((a, v) => a + v * v, 0));
    const rows = z.c.map((v, i) => `<tr><td>Z${i + 1}</td><td>${z.order[i]}</td><td style="text-align:left">${z.names[i]}</td><td>${(v >= 0 ? '+' : '') + v.toFixed(5)}</td><td>${i ? fx(z.rmsTerm[i], 5) : '—'}</td><td>${i ? `<div style="height:8px;width:${Math.min(140, z.rmsTerm[i] / mx * 140)}px;background:${v >= 0 ? '#d4553b' : '#3f6fc4'};border-radius:2px"></div>` : ''}</td></tr>`).join('');
    return `<div class="hint">Zernike Fringe Z1…Z${nz} (${ZNOPTS.find(o => o[0] === nz)[1]}), unités : ondes (λ = ${fmt(M.wls[p.wi ?? M.pw] * 1000, 5)} nm), champ ${fLabel(M, p.fi || 0)}. Pupille normalisée, θ depuis l'axe X ; n = ordre radial ; RMS = contribution du terme au front d'onde RMS.</div>
      <table style="margin-top:8px"><tr><th>Terme</th><th>n</th><th style="text-align:left">Aberration</th><th>Coef. (λ)</th><th>RMS (λ)</th><th></th></tr>${rows}</table>
      <div class="kv" style="margin-top:8px;max-width:440px"><span>RMS total (piston retiré)</span><span>${fx(z.rmsTot, 5)} λ</span><span>RMS des termes Z2…Z${nz}</span><span>${fx(expl, 5)} λ</span>
      <span><b>Résidu au-delà de Z${nz}</b> : RMS</span><span><b>${fx(z.rmsRes, 5)} λ</b></span><span>Résidu : PV</span><span>${fx(z.pvRes, 4)} λ</span>
      <span>Part de la variance expliquée</span><span>${fx(100 * (1 - (z.rmsRes / (z.rmsTot || 1)) ** 2), 3)} %</span></div>
      <p class="hint">Le résidu (front d'onde moins l'ajustement) contient les ordres supérieurs à ceux retenus ; sa carte s'affiche dans « Carte de front d'onde » (option « résidu après Z… »).</p>`;
  },
  psf(p, M, c, w, h) {
    const zoom = psfZoom(p), fi = p.fi || 0, wi = p.wi ?? M.pw, ra = 1.22 * M.ctxs[wi].lmm * M.par.wfno * 1e3;
    if (p.view === '3d') { // 3D : front d'onde 128×128 et PSF calculée directement sur la grille affichée (201×201, 81×81 pendant une rotation ou un zoom)
      let C = PSFC.get(p); if (!C || C.M !== M || C.fi !== fi || C.wi !== wi || !C.wf3) { C = { M, fi, wi, wf3: OE.wavefront(M, fi, wi, 128, false) }; PSFC.set(p, C); }
      const half = 16 * M.ctxs[wi].lmm * M.par.wfno / zoom, m = p._drag ? 81 : 201, key = zoom + '|' + m;
      C.gs = C.gs || new Map(); let g = C.gs.get(key); if (!g) { if (C.gs.size > 6) C.gs.clear(); const xs = Array.from({ length: m }, (_, k) => { const t = -1 + 2 * k / (m - 1); return half * Math.sign(t) * Math.pow(Math.abs(t), 1.7); }); // nœuds resserrés au centre (pic)
        g = OE.psfGrid(M, fi, wi, half, m, 128, C.wf3, xs); C.gs.set(key, g); }
      return psf3d(p, M, c, w, h, g, ra);
    }
    // 2D : pupille 64×64 dans une FFT 256² (512² au-delà de ×2,2)
    const P = zoom > 2.2 ? 512 : 256;
    let C = PSFC.get(p); if (!C || C.M !== M || C.fi !== fi || C.wi !== wi || C.P !== P) { C = { M, fi, wi, P, ps: OE.psf(M, fi, wi, 64, P) }; PSFC.set(p, C); }
    const ps = C.ps;
    const half = Math.max(4, Math.min(P >> 1, Math.round(P / 4 / zoom))), n = 2 * half, o = P / 2 - half, data = new Float64Array(n * n);
    let mx = 0;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const v = ps.I[(y + o) * P + x + o]; data[y * n + x] = v; mx = Math.max(mx, v); }
    const ext = half * ps.dx * 1e3, exX = half * (ps.dxX || ps.dx) * 1e3, exY = half * (ps.dxY || ps.dx) * 1e3; // pas anisotrope hors axe (F/# réels T et S)
    if (p.log) for (let i = 0; i < data.length; i++) data[i] = Math.log10(Math.max(data[i] / mx, 1e-6));
    const A = axes(c, { x: 0, y: 0, w: w - 70, h: h - 4 }, [-exX, exX], [-exY, exY], { equal: true, title: `PSF  Strehl ${fx(ps.strehl, 4)} · zoom ×${fmt(zoom, 2)}`, ml: 46, xl: 'µm', zero: false });
    A.xr0 = -exX; A.xr1 = exX; A.yr0 = -exY; A.yr1 = exY;
    heat(c, A, data, n, n, p.log ? -6 : 0, p.log ? 0 : mx, 'inferno', true);
    c.strokeStyle = 'rgba(255,255,255,.45)'; c.setLineDash([3, 3]); c.beginPath(); c.arc(A.X(0), A.Y(0), A.X(ra) - A.X(0), 0, 2 * Math.PI); c.stroke(); c.setLineDash([]);
    cbar(c, w - 58, 30, 12, Math.max(40, h - 70), p.log ? -6 : 0, p.log ? 0 : mx, 'inferno', p.log ? 'log₁₀' : 'Strehl');
    if (det().on) {
      const pu = det().p, bp = OE.binPSF(ps.I, ps.P, ps.dx, pu * 1e-3, 'centre', 3);
      if (p.pix) { const L = lut('inferno'); const nb = Math.ceil(ext / pu) * 2 + 1, b2 = OE.binPSF(ps.I, ps.P, ps.dx, pu * 1e-3, 'centre', nb); const m2 = Math.max(...b2.G);
        clip(c, A.P); for (let iy = 0; iy < nb; iy++) for (let ix = 0; ix < nb; ix++) { const v = b2.G[iy * nb + ix] / m2, k = Math.round(Math.max(0, Math.min(1, v)) * 255); c.fillStyle = `rgb(${L[k * 3]},${L[k * 3 + 1]},${L[k * 3 + 2]})`; const x0 = A.X((ix - (nb >> 1) - 0.5) * pu), y0 = A.Y((iy - (nb >> 1) + 0.5) * pu); c.fillRect(x0, y0, A.X(pu) - A.X(0) + 0.5, A.Y(0) - A.Y(pu) + 0.5); } c.restore(); }
      pixGrid(c, A, pu, 'rgba(255,255,255,.35)');
      text(c, `pixel ${pu} µm · énergie pixel central ${fx(bp.G[4] * 100, 1)} % · 3×3 ${fx(bp.G.reduce((a, b) => a + b, 0) * 100, 1)} %`, A.P.x + 4, A.P.y + A.P.h - 14, { col: '#fff', size: 10.5 });
    }
    text(c, 'molette : zoom · double-clic : ×1', A.P.x + A.P.w - 4, A.P.y + 4, { col: 'rgba(255,255,255,.55)', size: 9.5, align: 'right' });
  },
  mtf(p, M, c, w, h, d) {
    const geo = p.mt === 'geo', N = +p.ns || 64, sc = d.sc, res = d.res;
    const f = res[0].f;
    const A = axes(c, { x: 0, y: 0, w, h: h - 18 }, [0, f[f.length - 1]], [0, 1.02], { xl: 'Fréquence spatiale (cycles/mm)', yl: 'Module FTM', title: geo ? `FTM polychromatique géométrique (rayons${p.gdl !== false ? ' × limite de diffraction' : ''})` : `FTM polychromatique (diffraction, autocorrélation de la pupille ${N}×${N})` });
    { const pw = M.pw, fn = sc.map((a, i) => `F${i + 1} ${fx(1 / a[pw].dM, 2)}/${fx(1 / a[pw].dL, 2)}`).join(' · ');
      text(c, `F/# réels T/S (λ réf.) : ${fn}`, A.P.x + 6, A.P.y + 4, { col: TH.mut, size: 10, maxW: A.P.w - 12 }); }
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
    // rayon à 80 % d'énergie, interpolé linéairement
    const r80 = arr => { const k = arr.findIndex(v => v >= 0.8); if (k < 0) return NaN; if (k === 0) return r[0]; const t = (0.8 - arr[k - 1]) / (arr[k] - arr[k - 1] || 1); return r[k - 1] + t * (r[k] - r[k - 1]); };
    const A = axes(c, { x: 0, y: 0, w, h: h - 18 }, [0, r[r.length - 1]], [0, 1.02], { xl: 'Rayon (µm)', yl: 'Fraction d\'énergie', title: `Énergie encerclée · champ ${fLabel(M, p.fi || 0)} — r80 ${fx(r80(e.D), 2)} µm (diffr.) · ${fx(r80(e.G), 2)} µm (géom.)` });
    pline(c, A, r, e.D, '#2563eb', 1.8); pline(c, A, r, e.G, '#ea580c', 1.6, [6, 4]);
    const ra = e.airy * 1e3; c.strokeStyle = TH.mut; c.setLineDash([2, 3]); c.beginPath(); c.moveTo(A.X(ra), A.P.y); c.lineTo(A.X(ra), A.P.y + A.P.h); c.stroke(); c.setLineDash([]);
    legend(c, 8, h - 8, [{ col: '#2563eb', l: 'Diffraction (λ principale)' }, { col: '#ea580c', dash: [6, 4], l: 'Géométrique (polychromatique)' }, { col: TH.mut, dash: [2, 3], l: 'Rayon d\'Airy' }]);
  },
  footprint(p, M, c, w, h) {
    const si = Math.min(p.si ?? App.sel, M.N) || 1;
    const fp = OE.footprint(M, si, { n: 13 });
    let m = fp.sd; for (const f of fp.fields) for (const q of f.pts) m = Math.max(m, Math.abs(q[0]), Math.abs(q[1]));
    if (det().on && si === M.N) m = Math.max(m, det().nx * det().p * 5e-4, det().ny * det().p * 5e-4);
    m *= 1.08;
    const A = axes(c, { x: 0, y: 0, w, h: h - 18 }, [-m, m], [-m, m], { equal: true, xl: 'X (mm)', title: `Surface ${si}${M.S[si].comment ? ' · ' + M.S[si].comment : ''} — ½Ø ${fx(fp.sd, 3)} mm${M.S[si].sdFixed ? ' (fixe)' : ''}` });
    clip(c, A.P); c.strokeStyle = TH.fg; c.lineWidth = 1.4; c.beginPath(); c.arc(A.X(0), A.Y(0), A.X(fp.sd) - A.X(0), 0, 2 * Math.PI); c.stroke(); c.restore();
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
    text(c, `W040 = ${fx(sd.sum.SI / 8 / lm, 3)} λ · W131 = ${fx(sd.sum.SII / 2 / lm, 3)} λ · W222 = ${fx(sd.sum.SIII / 2 / lm, 3)} λ · W220 = ${fx((sd.sum.SIV) / 4 / lm, 3)} λ · W311 = ${fx(sd.sum.SV / 2 / lm, 3)} λ`, 8, h - 12, { col: TH.mut, size: 10.5, mono: true, maxW: w - 16 });
  },
  thermal(p, M, c, w, h, r) {
    const T1 = p.t1 ?? -20, T2 = p.t2 ?? 60, efl0 = M.par.efl, h1 = Math.round(h / 2), solve = App.sys.surfaces.some(x => x.tsolve === 'M');
    const dE = r.efl.map(v => (v - efl0) * 1000);
    let A = axes(c, { x: 0, y: 0, w, h: h1 - 20 }, [T1, T2], range([r.dz, dE], 0.1), { xl: '', yl: 'µm', title: solve ? 'Δ focale — solve de mise au point (M) actif : le plan image suit le foyer' : 'Défocalisation (foyer paraxial − plan image) et Δ focale' });
    pline(c, A, r.T, r.dz, TH.acc, 2); pline(c, A, r.T, dE, TH.mut, 1.6, [5, 4]);
    const T0 = M.env ? M.env.T : 20; c.strokeStyle = TH.mut; c.setLineDash([2, 3]); c.beginPath(); c.moveTo(A.X(T0), A.P.y); c.lineTo(A.X(T0), A.P.y + A.P.h); c.stroke(); c.setLineDash([]);
    legend(c, 8, h1 - 8, [{ col: TH.acc, l: 'Défocalisation (µm)' }, { col: TH.mut, dash: [5, 4], l: 'Δ focale par rapport à ' + fmt(T0, 4) + ' °C (µm)' }]);
    A = axes(c, { x: 0, y: h1 + 2, w, h: h - h1 - 22 }, [T1, T2], range([r.wfe], 0.1), { xl: 'Température (°C)', yl: 'RMS (λ)', title: `Qualité au plan image — champ ${fLabel(M, p.fi || 0)} : WFE RMS (λ) et spot RMS (µm, échelle à droite)` });
    pline(c, A, r.T, r.wfe, '#16a34a', 2);
    const sr = range([r.spot], 0.1), ys = v => A.P.y + A.P.h - (v - sr[0]) / (sr[1] - sr[0] || 1) * A.P.h;
    c.strokeStyle = '#f59e0b'; c.lineWidth = 1.6; c.setLineDash([4, 3]); c.beginPath(); r.T.forEach((t, i) => { const X = A.X(t), Y = ys(r.spot[i]); i ? c.lineTo(X, Y) : c.moveTo(X, Y); }); c.stroke(); c.setLineDash([]);
    text(c, `${fx(sr[1], 2)} µm`, A.P.x + A.P.w - 4, A.P.y + 2, { col: '#f59e0b', size: 10, align: 'right' });
    legend(c, 8, h - 8, [{ col: '#16a34a', l: 'WFE RMS (λ)' }, { col: '#f59e0b', dash: [4, 3], l: `Spot RMS (µm, ${fx(sr[0], 2)} à ${fx(sr[1], 2)})` }]);
  },
  tfmtf(p, M, c, w, h, d) {
    const X = d.dz.map(v => v * 1e3), F = M.sys.fields;
    const A = axes(c, { x: 0, y: 0, w, h: h - 18 }, [X[0], X[X.length - 1]], [0, 1.02], { xl: 'Défocalisation par rapport au plan image (µm)', yl: 'Module FTM', title: `FTM through-focus à ${fmt(d.freq, 4)} cy/mm — meilleur foyer ${d.best >= 0 ? '+' : ''}${fx(d.best * 1e3, 1)} µm (FTM moyenne ${fx(d.bestV, 3)})` });
    pline(c, A, X, d.DL, TH.fg, 1.2, [2, 2]);
    d.T.forEach((t, i) => { pline(c, A, X, t, fcol(i), 1.7); pline(c, A, X, d.S[i], fcol(i), 1.7, [6, 4]); });
    pline(c, A, X, d.avg, '#f59e0b', 2.6);
    const vl = (x, col, dash, lab) => { if (A.X(x) < A.P.x || A.X(x) > A.P.x + A.P.w) return; c.strokeStyle = col; c.lineWidth = 1.2; c.setLineDash(dash); c.beginPath(); c.moveTo(A.X(x), A.P.y); c.lineTo(A.X(x), A.P.y + A.P.h); c.stroke(); c.setLineDash([]); if (lab) text(c, lab, A.X(x) + 4, A.P.y + 4, { col, size: 10 }); };
    vl(0, TH.mut, [2, 3], 'plan image'); vl(d.best * 1e3, TH.acc, [5, 3], 'meilleur foyer');
    legend(c, 8, h - 8, [{ col: TH.fg, dash: [2, 2], l: 'Limite de diffraction' }, { col: '#f59e0b', l: 'Moyenne (T+S)/2 pondérée' }, { col: TH.mut, l: 'T' }, { col: TH.mut, dash: [6, 4], l: 'S' }, ...F.map((_, i) => ({ col: fcol(i), l: fLabel(M, i) }))]);
  },
  mtffield(p, M, c, w, h, d) {
    const u = d.u, xr = [0, Math.max(...u.filter(isFinite)) || 1], fc = ['#2563eb', '#16a34a', '#dc2626', '#9333ea', '#ea580c', '#0891b2'];
    const A = axes(c, { x: 0, y: 0, w, h: h - 18 }, xr, [0, 1.02], { xl: `Champ (${d.unit})`, yl: 'Module FTM', title: `FTM en fonction du champ — ${d.freqs.map(f => fmt(f, 4)).join(', ')} cy/mm (pupille ${+p.ns || 32}×${+p.ns || 32})` });
    d.freqs.forEach((f, q) => { const col = fc[q % fc.length]; pline(c, A, u, d.T[q], col, 1.8); pline(c, A, u, d.S[q], col, 1.8, [6, 4]); pline(c, A, u, d.DL[q], col, 0.9, [1, 3]); });
    if (!d.img) d.defF.forEach((v, i) => { if (A.X(v) < A.P.x - 1 || A.X(v) > A.P.x + A.P.w + 1) return; c.fillStyle = fcol(i); c.beginPath(); c.moveTo(A.X(v), A.P.y + A.P.h); c.lineTo(A.X(v) - 4, A.P.y + A.P.h + 6); c.lineTo(A.X(v) + 4, A.P.y + A.P.h + 6); c.fill(); });
    legend(c, 8, h - 8, [{ col: TH.mut, l: 'T' }, { col: TH.mut, dash: [6, 4], l: 'S' }, { col: TH.mut, dash: [1, 3], l: 'limite de diffraction' }, ...d.freqs.map((f, q) => ({ col: fc[q % fc.length], l: `${fmt(f, 4)} cy/mm` }))]);
  },
  relillum(p, M, c, w, h, d) {
    const u = d.u, xr = [0, Math.max(...u.filter(isFinite)) || 1], lo = Math.min(...d.ri.filter(isFinite), ...d.cos4.filter(isFinite));
    const A = axes(c, { x: 0, y: 0, w, h: h - 18 }, xr, [Math.min(0, Math.floor(lo * 10) / 10), 1.05], { xl: `Champ (${d.unit})`, yl: 'Éclairement relatif', title: `Éclairement relatif à ${fmt(d.wl * 1000, 5)} nm — bord du champ ${fx(100 * d.ri[d.ri.length - 1], 1)} %` });
    pline(c, A, u, d.cos4, TH.mut, 1.3, [5, 4]); pline(c, A, u, d.ri, TH.acc, 2.2);
    legend(c, 8, h - 8, [{ col: TH.acc, l: 'Éclairement relatif (vignetage et aberrations de pupille inclus)' }, { col: TH.mut, dash: [5, 4], l: 'cos⁴ θ′ du rayon principal' }]);
  },
  distgrid(p, M, c, w, h) {
    const g = OE.distGrid(M, { n: +p.dgn || 11, diag: p.diag !== false, wi: p.wi ?? M.pw }), n = g.n, amp = p.dgx ? 10 : 1;
    const P = g.R.map((q, k) => q ? [g.I[k][0] + amp * (q[0] - g.I[k][0]), g.I[k][1] + amp * (q[1] - g.I[k][1])] : null);
    let m = 0; for (const q of [...g.I, ...P]) if (q) m = Math.max(m, Math.abs(q[0]), Math.abs(q[1])); m *= 1.08;
    const A = axes(c, { x: 0, y: 0, w, h: h - 18 }, [-m, m], [-m, m], { equal: true, xl: 'X image (mm)', yl: 'Y image (mm)', title: `Grille de distorsion — max ${g.dmax >= 0 ? '+' : ''}${fx(g.dmax, 3)} %${g.dAt ? ` en (${fmt(g.dAt[0], 3)}, ${fmt(g.dAt[1], 3)})${g.unit === '°' ? '°' : ' mm'}` : ''}${amp > 1 ? ' · écarts ×10' : ''}` });
    const lines = (Q, col, lw, dash) => { c.strokeStyle = col; c.lineWidth = lw; c.setLineDash(dash || []);
      for (let j = 0; j < n; j++) for (const dir of [0, 1]) { c.beginPath(); let on = false; for (let i = 0; i < n; i++) { const q = Q[dir ? i * n + j : j * n + i]; if (!q) { on = false; continue; } const X = A.X(q[0]), Y = A.Y(q[1]); on ? c.lineTo(X, Y) : c.moveTo(X, Y); on = true; } c.stroke(); }
      c.setLineDash([]); };
    clip(c, A.P); lines(g.I, TH.mut, 0.8, [3, 3]); lines(P, TH.acc, 1.6);
    c.fillStyle = TH.acc; for (const q of P) if (q) { c.beginPath(); c.arc(A.X(q[0]), A.Y(q[1]), 1.8, 0, 7); c.fill(); } c.restore();
    legend(c, 8, h - 8, [{ col: TH.mut, dash: [3, 3], l: 'Grille idéale (paraxiale)' }, { col: TH.acc, l: 'Rayons principaux réels' }]);
  },
  ghost(p, M) {
    const g = OE.ghosts(M, { coat: +p.coat || 0 }); if (!g.rows.length) return '<div class="hint" style="padding:10px">Aucune paire de dioptres réfléchissants (au moins deux dioptres avec changement d\'indice).</div>';
    const lg = v => Math.log10(Math.max(v, 1e-12)), mx = lg(g.rows[0].rel), mn = Math.min(-9, mx - 4), w = v => Math.max(2, 100 * (lg(v) - mn) / Math.max(1e-9, mx - mn));
    const dof = 2 * M.ctxs[M.pw].lmm * M.par.wfno * M.par.wfno;
    return `<table style="width:100%"><tr><th>Réflexions</th><th title="Produit des réflectances Rᵢ·Rⱼ">R</th><th title="Demi-diamètre du faisceau fantôme sur l'image">Ø/2 sur image (mm)</th><th title="Position du foyer fantôme par rapport au plan image">Foyer (mm)</th><th style="text-align:left">Éclairement relatif estimé</th></tr>
      ${g.rows.slice(0, 40).map(r => { const near = Math.abs(r.dz) < Math.max(10 * dof, 0.5); return `<tr><td>S${r.j} → S${r.i}${r.inGlass != null ? ` <span title="Foyer intermédiaire dans le verre après S${r.inGlass} (risque pour les lasers de puissance)" style="color:var(--warn)">⚠ verre</span>` : ''}</td><td class="mono">${r.R.toExponential(2)}</td><td class="mono">${fx(r.y, 3)}</td><td class="mono" style="${near ? 'color:var(--err);font-weight:600' : ''}">${isFinite(r.dz) ? (r.dz >= 0 ? '+' : '') + fx(r.dz, 2) : '∞'}</td>
        <td style="text-align:left"><span style="display:inline-block;height:8px;width:${w(r.rel)}px;max-width:100px;background:${r.rel > 1e-4 ? 'var(--err)' : r.rel > 1e-6 ? 'var(--warn)' : 'var(--acc)'};border-radius:2px;vertical-align:middle"></span> <span class="mono">${r.rel.toExponential(2)}</span></td></tr>`; }).join('')}</table>
      <p class="hint">${g.n} paires de dioptres, triées par éclairement relatif estimé : R · (r_signal / max(r_signal, r_fantôme))², r_signal = ${fx(g.rs * 1e3, 2)} µm (max du rayon d'Airy et du spot RMS sur l'axe). Calcul paraxial du rayon marginal (λ primaire, sur l'axe). En rouge : foyer fantôme à moins de ${fx(Math.max(10 * dof, 0.5), 2)} mm du plan image (fantôme focalisé, le plus gênant). ⚠ verre : le faisceau fantôme focalise à l'intérieur d'une lentille.</p>`;
  },
  mcsum(p, M) {
    if (!OE.mcOn(App.sys)) return `<div class="hint" style="padding:10px">Ce système n'a qu'une configuration. Ouvrez <b>Système → Multi-configuration…</b> pour en créer plusieurs (zoom, mise au point, changement de filtre…).</div>`;
    const S = OE.mcSummary(App.sys), cur = App.sys.mc.cur | 0, nm = k => esc((App.sys.mc.names || [])[k] || `Config ${k + 1}`);
    const row = (l, f) => `<tr><th style="text-align:left">${l}</th>${S.map(o => `<td class="mono" style="text-align:right${o.k === cur ? ';background:var(--sel)' : ''}">${o.ok ? f(o) : '—'}</td>`).join('')}</tr>`;
    return `<table style="width:100%"><tr><th></th>${S.map(o => `<th style="text-align:right"><button class="bt" data-mcgo="${o.k}" style="height:22px${o.k === cur ? ';border-color:var(--acc);color:var(--acc)' : ''}">${nm(o.k)}</button></th>`).join('')}</tr>
      ${row('Focale (EFL), mm', o => fx(o.efl, 4))}${row('F/# de travail', o => fx(o.wfno, 3))}${row('Champ max', o => fmt(o.fmax, 4) + (App.M.objInf ? '°' : ' mm'))}${row('Hauteur image, mm', o => fx(o.imgH, 3))}${row('Tirage (BFL), mm', o => fx(o.bfl, 3))}${row('Longueur totale, mm', o => fx(o.ttl, 3))}${row('Spot RMS max, µm', o => fx(o.spot, 2))}${row('WFE RMS max, λ', o => fx(o.wfe, 3))}</table>
      <div class="hint" style="padding:6px 2px">Cliquez sur une configuration pour l'activer. Paramètres variables : ${App.sys.mc.ops.length} ligne(s) dans l'éditeur de multi-configuration.</div>`;
  },
  chrom(p, M, c, w, h) {
    const cs = OE.chromShift(M, 60);
    const A = axes(c, { x: 0, y: 0, w, h }, [cs.l[0], cs.l[cs.l.length - 1]], range([cs.dz], 0.1), { xl: 'Longueur d\'onde (µm)', yl: 'Décalage focal (µm)', title: `Décalage focal chromatique paraxial — étendue ${fx(Math.max(...cs.dz) - Math.min(...cs.dz), 2)} µm` });
    pline(c, A, cs.l, cs.dz, TH.acc, 2);
    clip(c, A.P); M.wls.forEach(l => { c.fillStyle = wlCol(l); const k = cs.l.reduce((b, v, i) => Math.abs(v - l) < Math.abs(cs.l[b] - l) ? i : b, 0); c.beginPath(); c.arc(A.X(l), A.Y(cs.dz[k]), 4, 0, 7); c.fill(); }); c.restore();
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
    if (!d.on) { wrapText(c, 'Activez un détecteur dans le panneau de gauche (carte « Détecteur »).', 14, 14, w - 28, { col: TH.mut }); return; }
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
    h += `<h4>Performances par champ (λ prim. ${fmt(M.wls[M.pw] * 1000, 5)} nm pour la WFE)</h4><table><tr><th>Champ</th><th>Spot RMS (µm)</th><th>Spot GEO (µm)</th><th>WFE RMS (λ)</th><th>WFE PV (λ)</th><th>Strehl</th></tr>`;
    M.sys.fields.forEach((f, i) => h += `<tr><td>${fLabel(M, i)}</td><td>${fx(sp[i].rms * 1e3, 2)}</td><td>${fx(sp[i].geo * 1e3, 2)}</td><td>${fx(wf[i].rms, 4)}</td><td>${fx(wf[i].pv, 3)}</td><td>${fx(OE.psf(M, i, M.pw, 48, 128).strehl, 3)}</td></tr>`);
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
function simKey(p, M) {
  const src = makeSource(p.src || 'mire'), size = p.res || 192, fm = p.fov || (M.par.fmax > 1e-6 ? M.par.fmax : 1);
  const dd = det(), onDet = dd.on && p.det !== false, pixD = onDet ? dd.p * 1e-3 : 0;
  const key = toJSON(App.sys) + '|' + [p.src, size, fm, pixD].join('|') + (p.src === 'user' && App.userImg ? App.userImg.name : '');
  return { src, size, fm, dd, onDet, pixD, key };
}
/** calcule la simulation d'image immédiatement (rapports) */
function simSync(p, M) { const k = simKey(p, M); if (!SIM.cache.has(k.key)) SIM.cache.set(k.key, OE.imageSim(M, k.src, { size: k.size, fm: k.fm, pix: k.pixD, maxS: Math.max(256, k.size * 2) })); }
function simPane(p, M, c, w, h) {
  const { src, size, fm, dd, onDet, pixD, key } = simKey(p, M);
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
  // une ligne si tout tient ; sinon libellé au-dessus de la valeur si la hauteur le permet ; sinon une ligne avec libellé abrégé
  const one = lw + vw + 16 <= w, two = !one && (!maxH || rows.length * 28 <= maxH);
  const lh = two ? 28 : 17, step = maxH ? Math.min(lh, maxH / rows.length) : lh;
  rows.forEach(([a, v], k) => {
    const yy = y + k * step;
    if (two) { text(c, a, x, yy, { col: TH.mut, size: 10.5, maxW: w }); text(c, v, x, yy + 13, { mono: true, size: 11, maxW: w }); }
    else {
      c.save(); c.font = '11px JetBrains Mono, monospace'; const vv = Math.min(c.measureText(v).width, w * 0.62); c.restore();
      text(c, v, x + w, yy, { mono: true, size: 11, align: 'right', maxW: w * 0.62 }); text(c, a, x, yy, { col: TH.mut, size: 11, maxW: Math.max(20, w - vv - 8) });
    }
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
const OPT = { running: false, st: null, hist: [], it: 0, snap: null, x0: null, maxIt: 100, gCyc: 10, gAmp: 20 };
/** colonnes de l'éditeur de fonction de mérite (comme le Merit Function Editor de Zemax) */
const MFC = [['s1', 'S1', 'Surface 1 (ou n° de ligne pour les opérations)'], ['s2', 'S2', 'Surface 2 (ou n° de ligne)'], ['w', 'λ', 'Longueur d\'onde (vide : primaire, ou polychromatique pour les RMS)'], ['hx', 'Hx', 'Champ normalisé X (−1…1)'], ['hy', 'Hy', 'Champ normalisé Y (−1…1)'], ['px', 'Px', 'Pupille normalisée X (−1…1)'], ['py', 'Py', 'Pupille normalisée Y (−1…1)'], ['p', 'Param.', 'Paramètre de l\'opérande']];
/** valeurs par défaut d'une ligne au choix d'un type */
function opDefaults(type, cur = {}) {
  const d = OE.OPS[type] || {}, o = { type, weight: cur.weight ?? 1, ...(cur.cfg ? { cfg: cur.cfg } : {}) }, c = d.cols || [];
  if (c.includes('p')) o.p = d.pdef ?? 0;
  if (['TRAX', 'TRAY', 'TRAR', 'OPDC', 'OPDX', 'LONA', 'RAID', 'RAED', 'REAY', 'REAX', 'REAR', 'REAB', 'RANG'].includes(type)) o.py = 1;
  if (['REAY', 'REAX', 'REAR', 'REAB', 'RANG', 'RAID', 'RAED', 'POWR', 'PARY', 'PARB', 'CTGT', 'CTLT', 'CTVA', 'ETGT', 'ETLT', 'ETVA', 'CVGT', 'CVLT', 'CVVA', 'COGT', 'COLT', 'COVA', 'DMGT', 'DMLT', 'DMVA'].includes(type)) o.s1 = 1;
  if (['RSCE', 'RSCH', 'RWCE', 'RWCH', 'STRH', 'DISG', 'FCGT', 'FCGS', 'ZERN'].includes(type)) o.hy = cur.hy ?? 0;
  const def = { MNCG: 1, MXCG: 20, MNEG: 1, MXEG: 30, MNCA: 0.5, MXCA: 200, MNEA: 0.3, MXEA: 200, MNCT: 0.3, MXCT: 200, MNET: 0.3, MXET: 200, MNSD: 1, MXSD: 50, RGLA: 0, MNIN: 1.45, MXIN: 2, MNAB: 20, MXAB: 90, STRH: 0.8, MTFT: 0.5, MTFS: 0.5, MTFA: 0.5, RELI: 0.5, RAID: 45, RAED: 45, GLTR: 0.9, DISM: 1, RSCE: 0, RSCH: 0, RWCE: 0, RWCH: 0, SPOT: 0, WFER: 0, CTGT: 1, ETGT: 1 };
  if (def[type] != null) o.target = def[type];
  else { try { const r = OE.residuals({ ...App.sys, merit: { v: 2, image: 'NONE', ops: [...(App.sys.merit.ops || []), o] } }); const v = r && r.parts[r.parts.length - 1].val; o.target = isFinite(v) ? +(+v).toPrecision(6) : 0; } catch (e) { o.target = 0; } }
  if (type === 'RGLA') o.weight = 0.002;
  return o;
}
const fmtCell = v => v == null || v === '' ? '' : String(v);
function openOptim() {
  const s = App.sys; OE.meritUpgrade(s); const mf = s.merit, wasOpen = !!$('#ovars'); mf.ops = mf.ops || [];
  if (!OPT.running && !OPT.x0) OPT.x0 = optSnapVars(s);
  const W = s.wavelengths, cen = OE.wlSel(s, 'central')[0], mc = OE.mcOn(s), pu = mf.pupil || { type: 'GQ', rings: 3, arms: 8 }, bnd = mf.bnd || {};
  const wlOpts = [['all', 'Toutes les λ (pondérées)'], ['central', `λ centrale (${fmt(W[cen].um * 1000, 5)} nm)`], ['primary', `λ primaire (${fmt(W[s.primary | 0].um * 1000, 5)} nm)`], ...W.map((w, i) => [String(i), `λ${i + 1} seule (${fmt(w.um * 1000, 5)} nm)`])];
  const wsel = mf.wl == null ? 'all' : String(mf.wl), sel = (id, cur, opts, attr = '') => `<select class="in" id="${id}" ${attr}>${opts.map(([k, l]) => `<option value="${k}" ${String(cur) === String(k) ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
  const num = (id, v, ph, w = 48, t = '') => `<input class="in" id="${id}" value="${v == null ? '' : v}" placeholder="${ph}" style="width:${w}px" title="${t}">`;
  const cyc = OPT.cyc || 'auto';
  const rowHTML = (o, i) => {
    const d = OE.OPS[o.type] || { label: '?', cols: [] }, cmp = o.cmp || d.kind, c = d.cols || [];
    const cell = k => { if (!c.includes(k)) return '<td></td>';
      if (k === 'w') return `<td><select class="in" data-o="w" data-i="${i}" style="width:38px" title="${MFC[2][2]}"><option value="">—</option>${W.map((_, j) => `<option value="${j + 1}" ${+o.w === j + 1 ? 'selected' : ''}>${j + 1}</option>`).join('')}</select></td>`;
      if (k === 'p' && d.f) return `<td><input class="in" data-o="p" data-i="${i}" value="${fmtCell(o.p ?? d.pdef)}" style="width:46px" title="${esc(d.pl || d.p || '')}"></td>`;
      return `<td><input class="in" data-o="${k}" data-i="${i}" value="${fmtCell(o[k] ?? (k === 'p' ? d.pdef : ''))}" style="width:${k === 'p' ? 44 : k === 's1' || k === 's2' ? 30 : 34}px" title="${esc(k === 'p' ? (d.pl || 'paramètre') : MFC.find(m => m[0] === k)[2])}"></td>`; };
    const fiSel = d.f ? `<select class="in" data-o="fi" data-i="${i}" style="width:54px" title="Champ (tous : la contrainte s'applique à chaque champ)"><option value="0">tous</option>${s.fields.map((_, k) => `<option value="${k + 1}" ${+o.fi === k + 1 ? 'selected' : ''}>C${k + 1}</option>`).join('')}</select>` : '';
    const desc = o.type === 'BLNK' ? `<input class="in" data-o="c" data-i="${i}" value="${esc(o.c || '')}" placeholder="commentaire" style="width:100%">` : `<span class="odesc" title="${esc(d.label + (d.aka ? ' — ' + d.aka : ''))}">${esc(d.label)}</span>${fiSel}`;
    const nores = d.nores;
    return `<tr data-row="${i}" class="${o.auto ? 'oauto' : ''}"><td class="onum">${i + 1}</td><td><button class="opb" data-d="opick" data-i="${i}" title="Changer l'opérande">${esc(o.type)}</button></td><td class="odc">${desc}</td>
      ${['s1', 's2', 'w', 'hx', 'hy', 'px', 'py', 'p'].map(cell).join('')}
      <td>${nores ? '' : `<select class="in" data-o="cmp" data-i="${i}" style="width:36px" title="Égal, au moins (≥) ou au plus (≤)">${[['eq', '='], ['ge', '≥'], ['le', '≤']].map(([k, l]) => `<option value="${k}" ${cmp === k ? 'selected' : ''}>${l}</option>`).join('')}</select>`}</td>
      <td>${nores || o.type === 'CONS' ? '' : `<input class="in" data-o="target" data-i="${i}" value="${fmtCell(o.target)}" style="width:58px">`}</td>
      <td>${nores ? '' : `<input class="in" data-o="weight" data-i="${i}" value="${o.lag ? '' : fmtCell(o.weight)}" ${o.lag ? 'disabled placeholder="—"' : ''} style="width:40px" title="Poids W : contribution W·(valeur − cible)² (0 : ligne calculée sans effet, utile pour les opérations)">`}</td>
      <td>${nores ? '' : `<input type="checkbox" data-o="lag" data-i="${i}" ${o.lag ? 'checked' : ''} title="Contrainte exacte (multiplicateurs de Lagrange, comme CODE V) : satisfaite à chaque cycle au lieu d'être pondérée">`}</td>
      ${mc ? `<td><select class="in" data-o="cfg" data-i="${i}" style="width:54px"><option value="0">toutes</option>${Array.from({ length: s.mc.n }, (_, k) => `<option value="${k + 1}" ${+o.cfg === k + 1 ? 'selected' : ''}>${k + 1}</option>`).join('')}</select></td>` : ''}
      <td class="ov" data-ov="${i}"></td><td class="ov" data-oc="${i}"></td>
      <td class="oact"><button class="x" data-d="oup" data-i="${i}" title="Monter">↑</button><button class="x" data-d="odn" data-i="${i}" title="Descendre">↓</button><button class="x" data-d="odel" data-i="${i}" title="Supprimer">✕</button></td></tr>`;
  };
  const imgLab = { SPOT: 'Spot RMS', WFE: 'Front d\'onde RMS', MTF: `Contraste 1 − FTM à ${mf.mtfF || 30} cy/mm`, NONE: 'aucun' }[mf.image || 'SPOT'];
  const puLab = pu.type === 'RA' ? `grille ${pu.grid || 8}×${pu.grid || 8}` : `Gauss ${pu.rings || 3} anneaux × ${pu.arms || 8} bras`;
  dlg(`<h2>Optimisation <span class="hint" style="font-weight:400;margin-left:8px">moindres carrés amortis · contraintes exactes de Lagrange</span><button class="x" data-d="close">✕</button></h2>
  <div class="db"><div class="ogrid">
    <div class="oL">
      <h4 class="th4" style="margin-top:0">Fonction de mérite par défaut</h4>
      <div class="ofrm">
        <label>Critère</label>${sel('mfImg', mf.image || 'SPOT', [['SPOT', 'RMS spot (rayon)'], ['WFE', 'RMS front d\'onde'], ['MTF', 'Contraste FTM (1 − FTM)'], ['NONE', 'Aucun (opérandes seuls)']])}
        <label>Référence</label>${sel('mfRef', mf.ref || 'centroid', [['centroid', 'Barycentre'], ['chief', 'Rayon principal']], mf.image === 'MTF' || mf.image === 'NONE' ? 'disabled' : '')}
        <label>Pupille</label><div class="row" style="gap:4px">${sel('mfPu', pu.type || 'GQ', [['GQ', 'Quadrature de Gauss'], ['RA', 'Grille rectangulaire']])}${pu.type === 'RA' ? num('mfGrid', pu.grid || 8, '8', 40, 'Nombre de rayons sur un diamètre') : num('mfRings', pu.rings || 3, '3', 36, 'Anneaux (1 à 20)') + num('mfArms', pu.arms || 8, '8', 36, 'Bras (2 à 36)')}</div>
        <label>Longueurs d'onde</label>${sel('mfWl', wsel, wlOpts)}
        ${mf.image === 'MTF' ? `<label>Fréquence</label><div class="row" style="gap:4px">${num('mfMtfF', mf.mtfF || 30, '30', 56)}<span class="hint">cycles/mm</span></div>` : ''}
        <label>Poids du critère</label>${num('mfIw', mf.iw ?? '', '1', 56, 'Poids total du critère image dans la fonction de mérite (0 : opérandes seuls)')}
      </div>
      <label class="ck"><input type="checkbox" id="mfSym" ${mf.sym !== false ? 'checked' : ''}> Symétrie axiale : demi-pupille si le système est de révolution</label>
      <div class="hint" style="margin-top:4px;font-weight:600;color:var(--fg)">Poids des champs et des λ <span style="font-weight:400">(vide = ceux du système)</span></div>
      <div class="owt">${s.fields.map((f, i) => `<label title="Poids du champ ${i + 1} dans le critère image">C${i + 1} <input class="in" data-ow="fw" data-i="${i}" value="${Array.isArray(mf.fw) && mf.fw[i] != null && mf.fw[i] !== '' ? mf.fw[i] : ''}" placeholder="${f.w ?? 1}"></label>`).join('')}</div>
      <div class="owt">${W.map((w, i) => `<label title="Poids de ${fmt(w.um * 1000, 5)} nm dans le critère image">λ${i + 1} <input class="in" data-ow="ww" data-i="${i}" value="${Array.isArray(mf.ww) && mf.ww[i] != null && mf.ww[i] !== '' ? mf.ww[i] : ''}" placeholder="${w.w ?? 1}"></label>`).join('')}</div>
      <h4 class="th4">Contraintes de bord <span class="hint">(lignes MNCG, MXCG, MNEG, MNCA, MXCA, MNEA)</span></h4>
      <table class="obnd"><tr><th></th><th>centre min</th><th>centre max</th><th>bord min</th></tr>
        <tr><td>Verre</td><td>${num('bgmin', bnd.gmin, '—', 52)}</td><td>${num('bgmax', bnd.gmax, '—', 52)}</td><td>${num('bgemin', bnd.gemin, '—', 52)}</td></tr>
        <tr><td>Air</td><td>${num('bamin', bnd.amin, '—', 52)}</td><td>${num('bamax', bnd.amax, '—', 52)}</td><td>${num('baemin', bnd.aemin, '—', 52)}</td></tr></table>
      <div class="row"><label class="ck" style="margin:0"><input type="checkbox" id="bLag" ${bnd.lag ? 'checked' : ''}> exactes</label><button class="bt" data-d="obnd" title="Écrit (ou remplace) les lignes de contraintes de bord dans l'éditeur de fonction de mérite">Écrire les contraintes</button></div>
      <h4 class="th4">Variables <span class="hint" id="onv"></span></h4>
      <div class="row" style="flex-wrap:wrap;gap:4px"><span class="hint">Variables en bloc :</span>${[['r', 'rayons'], ['ta', 'espaces d\'air'], ['tg', 'épaisseurs de verre'], ['k', 'coniques'], ['g', 'verres']].map(([k, l]) => { const on = varAllOn(s, k), n = varCands(s, k).length; return `<button class="bt vset ${on ? 'on' : ''}" data-d="ovset" data-k="${k}" style="height:22px" ${n ? '' : 'disabled'} aria-pressed="${on}" title="${on ? `Tous variables (${n}) — clic pour les retirer` : `Rendre variables : ${l} (${n} surface${n > 1 ? 's' : ''})`}">${on ? '✓ ' : ''}${l}</button>`; }).join('')}<button class="bt" data-d="ovclear" style="height:22px" title="Retire toutes les variables (V) du système">tout libérer</button></div>
      <div class="oscroll" id="ovars"></div>
      ${optGlassHTML()}
      <h4 class="th4">Mise au point</h4>
      <div class="row"><button class="bt" data-d="oqf">⌖ Quick focus</button><span class="hint">${App.qf.crit === 'WFE' ? 'front d\'onde' : 'spot'} RMS · ${qfWlLabel()}</span></div>
      <h4 class="th4">Meilleures solutions <span class="hint">(recherche globale)</span></h4>
      <div id="osols">${optSolsHTML()}</div>
    </div>
    <div class="oR">
      <div class="row" style="justify-content:space-between"><h4 class="th4" style="margin:0">Éditeur de fonction de mérite</h4><span class="hint">Critère : ${esc(imgLab)} · ${esc(puLab)}${mf.image === 'NONE' ? '' : ` · réf. ${mf.ref === 'chief' ? 'rayon principal' : 'barycentre'}`}</span></div>
      <div class="oscroll"><table class="mt otab"><thead><tr><th>#</th><th>Type</th><th>Description</th>${MFC.map(([k, l, t]) => `<th title="${esc(t)}">${l}</th>`).join('')}<th></th><th>Cible</th><th title="Poids">Poids</th><th title="Contrainte exacte (Lagrange)">Ex.</th>${mc ? '<th title="Configuration où la ligne s\'applique">Conf.</th>' : ''}<th>Valeur</th><th title="Part de la fonction de mérite">%</th><th></th></tr></thead><tbody>
      <tr class="oimg"><td class="onum">·</td><td><b>DMF</b></td><td class="odc" colspan="${MFC.length + 5 + (mc ? 1 : 0)}"><span class="odesc">Critère image : ${esc(imgLab)}${mf.image === 'NONE' ? '' : ` (${esc(puLab)}, ${mf.sym !== false ? 'symétrie exploitée si possible' : 'pupille entière'})`}${mc && s.mc.opt !== 'cur' ? ` — somme sur ${s.mc.n} configurations` : ''}</span></td><td class="ov" id="oimgv"></td><td class="ov" id="oimgc"></td><td></td></tr>
      ${mf.ops.map(rowHTML).join('')}</tbody></table></div>
      <div class="row" style="gap:6px"><button class="add" data-d="opick" data-i="-1" style="flex:none;width:auto;padding:0 14px">+ Ajouter un opérande</button><span class="hint">Noms Zemax (EFFL → EFL, TOTR → TTL…) et CODE V acceptés dans la recherche · Ex. : contrainte exacte · poids 0 : ligne calculée sans effet</span></div>
      <div style="display:flex;gap:16px;align-items:center;margin-top:8px">
        <div style="flex:none;width:190px"><div class="hint">Fonction de mérite <span title="√(Σ W·(valeur − cible)² / Σ W), convention Zemax">ⓘ</span></div><div class="big" id="mval">—</div><div class="hint" id="mcons"></div><div class="hint" id="mit"></div></div>
        <div style="flex:1;min-width:0;height:120px;position:relative"><canvas id="mchart"></canvas></div>
      </div>
    </div>
  </div>
  <div class="orow"><span>Cycles</span>${sel('oCyc', cyc, [['auto', 'Automatique'], ['1', '1'], ['5', '5'], ['10', '10'], ['50', '50'], ['200', '200']], 'style="width:auto"')}
    <span style="margin-left:10px">Dérivées</span>${sel('oDer', OPT.central ? 'cen' : 'fwd', [['fwd', 'avant'], ['cen', 'centrées (×2)']], 'style="width:auto"')}
    <span style="margin-left:18px">Recherche globale :</span>${sel('gMode', OPT.gMode || 'hammer', [['hammer', 'Perturbation du meilleur (Hammer)'], ['anneal', 'Recuit simulé'], ['multi', 'Départs multiples']], 'style="width:auto"')}<span class="hint">essais</span><input class="in" id="gCyc" value="${OPT.gCyc || 10}" style="width:50px"><span class="hint">amplitude</span><input class="in" id="gAmp" value="${OPT.gAmp || 20}" style="width:46px"><span class="hint">%</span></div>
  </div>
  <div class="df"><span class="hint grow" id="omsg"></span>
    <button class="bt" data-d="omfx" data-k="seq" title="Macro AUT de CODE V : contraintes (exactes, comme le défaut de CODE V) et commentaires pour le reste">Exporter → CODE V</button>
    <button class="bt" data-d="omfx" data-k="zmx" title="Tableau de l'éditeur de fonction de mérite de Zemax (texte tabulé : Type, Int1, Int2, Hx, Hy, Px, Py, Target, Weight)">Exporter → Zemax</button>
    <button class="bt" data-d="revert" title="Revient au système d'avant la dernière optimisation">Restaurer l'état initial</button>
    <button class="bt" data-d="stop">Arrêter</button>
    <button class="bt" data-d="glob" title="Perturbe aléatoirement les variables puis optimise, plusieurs fois, et garde le meilleur résultat">Recherche globale</button>
    <button class="tb pri" data-d="run">▶ Optimiser</button></div>`, true, { w: 1340, h: 780 });
  if (!OPT.running) { const r = OE.residuals(s), m = OE.meritR(r); if (!wasOpen || !OPT.hist.length) OPT.hist = isFinite(m) ? [m] : []; else if (isFinite(m) && m !== OPT.hist[OPT.hist.length - 1]) OPT.hist.push(m); }
  optLive();
}
/** sélecteur d'opérande (recherche par nom Focale, Zemax ou CODE V, et par description) */
function opPicker(btn, i) {
  $('#opick')?.remove();
  const el = document.createElement('div'); el.id = 'opick'; el.className = 'opick';
  el.innerHTML = `<input class="in" id="opq" placeholder="Rechercher : EFFL, MNCG, spot, distorsion…" style="width:100%"><div id="opl"></div>`;
  $('#dlg').appendChild(el);
  const r = btn.getBoundingClientRect(), d = $('#dlg').getBoundingClientRect();
  el.style.left = Math.max(8, Math.min(r.left - d.left, d.width - 460)) + 'px'; el.style.top = Math.min(r.bottom - d.top + 4, d.height - 420) + 'px';
  const draw = () => {
    const q = $('#opq').value.trim().toLowerCase(), E = Object.entries(OE.OPS).filter(([k, v]) => !v.hide);
    $('#opl').innerHTML = OE.OPG.map(([g, gl]) => { const L = E.filter(([k, v]) => v.g === g && (!q || (k + ' ' + v.label + ' ' + (v.aka || '')).toLowerCase().includes(q)));
      return L.length ? `<div class="opg">${esc(gl)}</div>` + L.map(([k, v]) => `<button data-opk="${k}"><b>${k}</b><span>${esc(v.label)}</span>${v.aka ? `<i>${esc(v.aka)}</i>` : ''}</button>`).join('') : ''; }).join('') || '<div class="hint" style="padding:8px">Aucun opérande</div>';
  };
  draw(); $('#opq').focus();
  $('#opq').addEventListener('input', draw);
  $('#opq').addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); el.remove(); } if (e.key === 'Enter') { const b = el.querySelector('[data-opk]'); if (b) b.click(); } });
  el.addEventListener('click', e => { const b = e.target.closest('[data-opk]'); if (!b) return; const k = b.dataset.opk; el.remove();
    commit(s => { const L = s.merit.ops; if (i < 0) L.push(opDefaults(k)); else { const o = L[i]; L[i] = { ...opDefaults(k, o), ...(o.lag ? { lag: true } : {}) }; } }); openOptim(); });
  setTimeout(() => { const off = e => { if (!el.contains(e.target)) { el.remove(); document.removeEventListener('mousedown', off, true); } }; document.addEventListener('mousedown', off, true); }, 0);
}
/** écrit les contraintes de bord (lignes « auto ») */
function optWriteBounds() {
  const g = id => { const v = String($('#' + id)?.value ?? '').trim(); return v === '' ? null : parseFloat(v.replace(',', '.')); };
  const b = { gmin: g('bgmin'), gmax: g('bgmax'), gemin: g('bgemin'), amin: g('bamin'), amax: g('bamax'), aemin: g('baemin'), lag: !!$('#bLag')?.checked };
  const rows = [['MNCG', b.gmin], ['MXCG', b.gmax], ['MNEG', b.gemin], ['MNCA', b.amin], ['MXCA', b.amax], ['MNEA', b.aemin]].filter(([, v]) => v != null && isFinite(v));
  commit(s => { s.merit.bnd = b; s.merit.ops = s.merit.ops.filter(o => o.auto !== 'bnd'); for (const [t, v] of rows) s.merit.ops.push({ type: t, target: v, weight: 1, auto: 'bnd', ...(b.lag ? { lag: true } : {}) }); });
  toast(rows.length ? `${rows.length} contrainte(s) de bord écrite(s)` : 'Contraintes de bord retirées'); openOptim();
}
/** variables « en bloc » : surfaces concernées pour r rayons, ta espaces d'air, tg épaisseurs de verre, k coniques, g verres → [[j, drapeau]] */
function varCands(sys, k) {
  const L = sys.surfaces, N = L.length - 1, out = [];
  for (let j = 1; j < N; j++) { const s = L[j], prev = L[j - 1], glass = !OE.isAir(s.glass) && !OE.isMirror(s), boundary = OE.isMirror(s) || glass || (!OE.isAir(prev.glass) && !OE.isMirror(prev));
    const fold = OE.isMirror(s) && !(isFinite(s.r) && s.r) && (+s.tx || +s.ty); if (s.elem === 'ideal' || s.elem === 'grating') continue;
    if (k === 'r' && boundary && !fold && !s.rsolve) out.push([j, 'vr']);
    if (k === 'k' && boundary && isFinite(s.r) && s.r) out.push([j, 'vk']);
    if (k === 'ta' && OE.isAir(s.glass) && !OE.isMirror(s) && !s.tsolve) out.push([j, 'vt']);
    if (k === 'tg' && glass && !s.tsolve) out.push([j, 'vt']);
    if (k === 'g' && glass && (OE.parseModel(s.glass) || OE.toModel(s.glass))) out.push([j, 'vg']); }
  return out;
}
const varAllOn = (sys, k) => { const c = varCands(sys, k); return c.length > 0 && c.every(([j, f]) => sys.surfaces[j][f]); };
/** bascule une famille de variables : toutes actives → retirées ; sinon toutes ajoutées */
function optSetVars(k) {
  const on = varAllOn(App.sys, k), lab = { r: 'rayons', ta: 'espaces d\'air', tg: 'épaisseurs de verre', k: 'coniques', g: 'verres' }[k]; let n = 0;
  commit(S => { for (const [j, f] of varCands(S, k)) { const s = S.surfaces[j]; if (on) { if (s[f]) { s[f] = false; n++; } } else if (!s[f]) { if (f === 'vg') { const mg = OE.parseModel(s.glass) ? s.glass : OE.toModel(s.glass); if (!mg) continue; s.glass = mg; } s[f] = true; n++; } } });
  toast(on ? `Variables retirées : ${lab} (${n})` : n ? `Variables ajoutées : ${lab} (${n})` : `Aucune surface concernée (${lab})`); OPT.x0 = null; openOptim();
}
/** section « verres variables » de la fenêtre d'optimisation */
function optGlassHTML() {
  const s = App.sys, G = s.surfaces.map((x, j) => [x, j]).filter(([x, j]) => x.vg && j > 0 && j < s.surfaces.length - 1);
  const g = { cats: null, pref: false, k: 6, passes: 2, ...(s.merit.gsub || {}) }, all = OE.cats(), on = new Set(g.cats && g.cats.length ? g.cats : all);
  const hasR = (s.merit.ops || []).some(o => o.type === 'RGLA');
  return `<h4 class="th4">Verres variables (${G.length})</h4>
    ${G.length ? `<table class="mt" style="font-size:12px">${G.map(([x, j]) => { const m = OE.parseModel(x.glass), near = m ? OE.glassNearest(m.nd, m.vd, { ...g, k: 1 })[0] : null;
      return `<tr><td>S${j}</td><td style="font-family:var(--mono)">${esc(x.glass)}</td><td class="hint">${m ? `modèle · proche ${near ? `${esc(near.name)} (${fx(near.d, 2)})` : '—'}` : 'réel'}</td></tr>`; }).join('')}</table>` : '<div class="hint">Bouton <b>V</b> de la colonne Verre : le verre devient un verre modèle (nd, νd variables).</div>'}
    <div class="hint" style="margin-top:4px">Catalogues de substitution</div>
    <div class="chips">${all.map(c => `<label class="ck" style="margin:0 8px 0 0"><input type="checkbox" data-gs="cat" value="${esc(c)}" ${on.has(c) ? 'checked' : ''}> ${esc(c)}</label>`).join('')}</div>
    <label class="ck"><input type="checkbox" data-gs="pref" ${g.pref ? 'checked' : ''}> verres préférentiels seulement</label>
    <div class="row"><span class="hint">candidats / surface</span><input class="in" data-gs="k" value="${g.k}" style="width:44px"><span class="hint">passes</span><input class="in" data-gs="passes" value="${g.passes}" style="width:36px"></div>
    <div class="row" style="flex-wrap:wrap"><button class="bt" data-d="gsub" ${G.length ? '' : 'disabled'} title="Remplace chaque verre variable par le verre réel qui donne la meilleure fonction de mérite (réoptimisation à chaque essai)">Substituer par des verres réels</button>${hasR ? '' : '<button class="bt" data-d="grgla" title="Ajoute l\'opérande RGLA : garde les verres modèles près des verres existants">+ Opérande RGLA</button>'}</div>`;
}
/** substitution : chaque verre variable est remplacé par le meilleur verre réel parmi ses voisins dans le diagramme nd/νd */
async function runSubst() {
  if (OPT.running) return; const s0 = App.sys, g = { cats: null, pref: false, k: 6, passes: 2, ...(s0.merit.gsub || {}) };
  const J = s0.surfaces.map((x, j) => j).filter(j => s0.surfaces[j].vg && j > 0 && j < s0.surfaces.length - 1); if (!J.length) return;
  OPT.snap = toJSON(App.sys); OPT.x0 = optSnapVars(App.sys); OPT.running = true; const msg = t => { const o = $('#omsg'); if (o) o.textContent = t; };
  let best = structuredClone(s0), bm = Infinity; const log = [];
  try {
    for (let p = 0; p < g.passes && OPT.running; p++) {
      let changed = false;
      for (const j of J) {
        if (!OPT.running) break;
        const cur = best.surfaces[j].glass, m = OE.parseModel(cur), gi = m || OE.glassInfo(cur);
        const cands = OE.glassNearest(gi.nd, gi.vd, { ...g, k: g.k }).map(c => c.name); if (!m && !cands.includes(OE.glassKey(cur) || cur)) cands.unshift(cur);
        if (!cands.length) { msg('Aucun verre dans les catalogues choisis'); break; }
        let pick = null;
        for (let c = 0; c < cands.length && OPT.running; c++) {
          msg(`Substitution — passe ${p + 1}/${g.passes} · S${j} : essai ${c + 1}/${cands.length} (${cands[c]})`); await tick();
          const r = OE.subTry(best, j, cands[c], 12); if (!pick || r.m < pick.m) pick = { ...r, name: cands[c] };
          OPT.hist.push(Math.min(bm, pick.m)); if ($('#mchart')) drawMerit();
        }
        if (pick && (m || pick.m < bm * (1 - 1e-9))) { if (pick.name !== cur) { log.push(`S${j} : ${cur} → ${pick.name}`); changed = true; } best = pick.sys; bm = pick.m; App.sys = structuredClone(best); App.M = OE.prepare(App.sys); App.sysKey = null; renderLDE(); drawLayout(); if ($('#ovars')) optLive(); }
      }
      if (!changed && p > 0) break;
    }
  } finally {
    OPT.running = false; App.sys = best; pushHist(); refresh({ fast: true });
    if ($('#ovars')) openOptim(); const t = `Substitution terminée${isFinite(bm) ? ` — mérite ${bm.toExponential(4)}` : ''}${log.length ? ' · ' + log.join(' · ') : ' · aucun changement'}`; msg(t); toast(t, 6000);
  }
}
/** valeurs des variables (pour afficher l'écart depuis le début) */
const optVarKey = v => v.kind + v.si + (v.mc != null ? '@' + v.cfg : '');
function optSnapVars(s) { const o = {}; for (const v of OE.getVars(s)) o[optVarKey(v)] = optVarVal(s, v); return o; }
function optVarVal(s, v) { if (v.mc != null) { const y = OE.getVal(s, v); return v.kind === 'c' ? (y ? 1 / y : Infinity) : y; } const x = s.surfaces[v.si]; if (v.kind === 'nd' || v.kind === 'vd') return (OE.parseModel(x.glass) || {})[v.kind]; return v.kind === 'c' ? x.r : v.kind === 't' ? x.t : v.kind === 'k' ? (x.k || 0) : (+x[v.kind] || 0); }
const optVarLab = v => v.mc != null ? `${v.kind === 'c' ? 'R' : v.kind === 't' ? 'T' : 'K'}${v.si} · ${mcName(App.sys, v.cfg)}` : v.kind === 'c' ? `R${v.si}` : v.kind === 't' ? `T${v.si}` : v.kind === 'k' ? `K${v.si}` : v.kind === 'nd' ? `nd S${v.si}` : v.kind === 'vd' ? `νd S${v.si}` : `${v.kind.toUpperCase()} S${v.si}`;
/** met à jour variables, valeurs des opérandes, contributions et courbe de mérite */
function optLive() {
  const s = App.sys, vars = OE.getVars(s), r = OE.residuals(s), x0 = OPT.x0 || {};
  const ev = $('#ovars'); if (!ev) return;
  $('#onv').textContent = `(${vars.length})`;
  ev.innerHTML = vars.length ? `<table class="mt" style="font-size:12px"><tr><th>Variable</th><th>Valeur</th><th>Écart</th></tr>${vars.map(v => { const x = optVarVal(s, v), a = x0[optVarKey(v)]; const d = a != null && isFinite(a) && isFinite(x) ? x - a : NaN;
    return `<tr><td>${optVarLab(v)}</td><td style="font-family:var(--mono)">${fmt(x, 7)}</td><td style="font-family:var(--mono);color:var(--mut)">${isFinite(d) && Math.abs(d) > 1e-12 ? (d > 0 ? '+' : '') + fmt(d, 4) : ''}</td></tr>`; }).join('')}</table>` : '<em class="hint">aucune variable définie</em>';
  if (!r) { $('#mval').textContent = '—'; return; }
  const m2 = r.f.reduce((a, b) => a + b * b, 0) || 1;
  $('#mval').textContent = OE.meritR(r).toExponential(4);
  const nc = r.parts.filter(p => p.lag), bad = nc.filter(p => p.ok === false).length, mc = $('#mcons');
  if (mc) { mc.textContent = nc.length ? `Contraintes exactes : ${nc.length - bad}/${nc.length} satisfaites` : ''; mc.style.color = bad ? 'var(--warn)' : ''; }
  for (const p of r.parts) {
    const o = s.merit.ops[p.i], d = OE.OPS[o.type] || {}, cv = $(`[data-ov="${p.i}"]`), cc = $(`[data-oc="${p.i}"]`);
    if (cv) { cv.textContent = p.val == null || !isFinite(p.val) ? '—' : fmt(p.val, 6) + (d.u ? ' ' + d.u : ''); cv.style.color = p.ok === false ? 'var(--warn)' : p.ok === true && o.lag ? 'var(--ok, #3fb950)' : ''; cv.title = p.ok === false ? 'Contrainte non satisfaite' : ''; }
    if (cc) cc.textContent = p.lag ? 'exacte' : p.r2 ? fx(100 * p.r2 / m2, 1) : '';
  }
  const iv = $('#oimgv'), ic = $('#oimgc');
  const iw = r.imgW || 0, ir = iw ? Math.sqrt(r.img2 / iw) : NaN;
  if (iv) iv.textContent = s.merit.image === 'NONE' || !iw ? '—' : s.merit.image === 'SPOT' ? `${fmt(ir * 1e3, 5)} µm` : s.merit.image === 'WFE' ? `${fmt(ir, 4)} λ` : `${fmt(ir, 4)}`;
  if (ic) ic.textContent = fx(100 * r.img2 / m2, 1);
  drawMerit();
}
/* ---------------- Fenêtres détachables : panneau système, éditeur, layout, analyses ----------------
   Chaque zone peut être détachée dans une fenêtre flottante (déplaçable, redimensionnable, réductible) puis ré-ancrée.
   App.fw[id] = { l, t, w, h, min } (id : side, lde, lay, p0…pN) — mémorisé dans focale.ui. */
const FWDEF = {
  side: { t: 'Système', el: () => $('#side'), dock: el => $('#ws').insertBefore(el, $('#center')), w: 330, h: 640 },
  lde: { t: 'Éditeur de lentilles', el: () => $('#ldeBox'), dock: el => $('#center').insertBefore(el, $('#hs')), w: 900, h: 360 },
  lay: { t: 'Layout', el: () => $('#layBox'), dock: el => $('#center').appendChild(el), w: 760, h: 460 },
};
let fwZ = 60;
function fwCreate(id, el) {
  let w = document.querySelector(`#floats .fwin[data-fw="${id}"]`);
  const isP = /^p\d+$/.test(id), i = isP ? +id.slice(1) : -1, extra = isP && i >= App.grid;
  if (!w) {
    w = document.createElement('div'); w.className = 'fwin'; w.dataset.fw = id;
    const title = isP ? (PT[(App.panes[i] || {}).type] || PT.spot).l : FWDEF[id].t;
    w.innerHTML = `<div class="fwh"><b>${esc(title)}</b><span class="grow"></span><button class="wb" data-fwa="min" title="Réduire / restaurer (double-clic sur la barre)">–</button>${extra ? '' : '<button class="wb" data-fwa="dock" title="Ré-ancrer dans la fenêtre principale">⇲</button>'}${isP ? `<button class="wb" data-fwa="close" title="${extra ? 'Fermer cette fenêtre d\'analyse' : 'Fermer (ré-ancrer)'}">✕</button>` : ''}</div><div class="fwb"></div><div class="grip" title="Redimensionner"></div>`;
    $('#floats').appendChild(w);
  }
  w.querySelector('.fwb').appendChild(el);
  const g = App.fw[id] || {}, def = isP ? { w: 560, h: 420 } : FWDEF[id];
  const W = Math.min(g.w || def.w, innerWidth - 20), H = Math.min(g.h || def.h, innerHeight - 20);
  w.style.width = W + 'px'; w.style.height = H + 'px';
  const n = Object.keys(App.fw).indexOf(id);
  w.style.left = Math.max(0, Math.min(innerWidth - 80, g.l ?? (innerWidth - W) / 2 + 26 * n)) + 'px';
  w.style.top = Math.max(0, Math.min(innerHeight - 40, g.t ?? Math.max(56, (innerHeight - H) / 3) + 26 * n)) + 'px';
  w.classList.toggle('min', !!g.min); w.style.zIndex = ++fwZ > 88 ? (fwZ = 61) : fwZ;
  return w;
}
function fwSave(w) { const id = w.dataset.fw, r = w.getBoundingClientRect(); App.fw[id] = { ...(App.fw[id] || {}), l: Math.round(r.left), t: Math.round(r.top), ...(w.classList.contains('min') ? {} : { w: Math.round(r.width), h: Math.round(r.height) }), min: w.classList.contains('min') }; save(); }
/** grille de la fenêtre principale selon les zones encore ancrées */
function fwLayout() {
  const side = !App.fw.side, lde = !App.fw.lde, lay = !App.fw.lay, center = lde || lay, ws = $('#ws'), c = $('#center');
  // colonnes des seuls éléments encore présents dans la grille (un élément masqué ou détaché n'y occupe pas de place)
  ws.style.gridTemplateColumns = [side ? '268px' : null, center ? 'minmax(320px,1fr)' : null, center ? '6px' : null, center ? 'var(--anw,44%)' : '1fr'].filter(Boolean).join(' ');
  c.style.display = center ? '' : 'none'; $('#vs').style.display = center ? '' : 'none'; $('#side').style.borderRight = side ? '' : '0';
  c.style.gridTemplateRows = lde && lay ? 'var(--ldeh,45%) 6px 1fr' : '1fr';
  $('#hs').style.display = lde && lay ? '' : 'none';
}
function fwDetach(id, geo) {
  if (App.fw[id]) { const w = document.querySelector(`#floats .fwin[data-fw="${id}"]`); if (w) w.style.zIndex = ++fwZ; return; }
  App.fw[id] = geo || {};
  if (/^p\d+$/.test(id)) { const el = document.querySelector(`.pane[data-i="${+id.slice(1)}"]`); if (el) el.classList.remove('max'); save(); buildPanes(); return; }
  fwCreate(id, FWDEF[id].el()); fwLayout(); save(); setTimeout(() => { drawLayout(); renderPanes(); }, 30);
  toast(`${FWDEF[id].t} détaché — ⇲ pour le ré-ancrer`);
}
function fwDock(id) {
  const w = document.querySelector(`#floats .fwin[data-fw="${id}"]`);
  delete App.fw[id]; save();
  if (/^p\d+$/.test(id)) { if (w) w.remove(); buildPanes(); return; }
  if (w) { FWDEF[id].dock(FWDEF[id].el()); w.remove(); }
  fwLayout(); setTimeout(() => { drawLayout(); renderPanes(); }, 30);
}
function fwClose(id) {
  const i = +id.slice(1);
  if (i < App.grid) return fwDock(id);
  delete App.fw[id];
  if (i >= 6) { App.panes.splice(i, 1); const nfw = {}; for (const [k, v] of Object.entries(App.fw)) { const m = k.match(/^p(\d+)$/); nfw[m && +m[1] > i ? 'p' + (+m[1] - 1) : k] = v; } App.fw = nfw; }
  save(); buildPanes();
}
/** nouvelle fenêtre d'analyse flottante (en plus de la grille) */
function newFloatPane() { App.panes.push({ type: 'spot' }); const i = App.panes.length - 1; App.fw['p' + i] = {}; save(); buildPanes(); toast('Nouvelle fenêtre d\'analyse : choisissez l\'analyse dans sa liste'); }
function setupFloats() {
  const fl = $('#floats');
  const track = (e, fn, w) => { e.preventDefault(); const mv = ev => fn(ev), up = () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); document.body.classList.remove('wdrag'); fwSave(w); fwRefresh(w); }; document.body.classList.add('wdrag'); window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up); };
  fl.addEventListener('mousedown', e => {
    const w = e.target.closest('.fwin'); if (!w || e.button !== 0) return;
    w.style.zIndex = ++fwZ > 88 ? (fwZ = 61) : fwZ;
    if (e.target.classList.contains('grip')) { const r = w.getBoundingClientRect(), x0 = e.clientX, y0 = e.clientY; let t = 0;
      return track(e, ev => { w.style.width = Math.max(260, Math.min(innerWidth - r.left - 2, r.width + ev.clientX - x0)) + 'px'; w.style.height = Math.max(140, Math.min(innerHeight - r.top - 2, r.height + ev.clientY - y0)) + 'px'; clearTimeout(t); t = setTimeout(() => fwRefresh(w), 60); }, w); }
    const h = e.target.closest('.fwh'); if (!h || e.target.closest('button,select,input')) return;
    const r = w.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
    track(e, ev => { w.style.left = Math.max(-r.width + 80, Math.min(innerWidth - 80, ev.clientX - dx)) + 'px'; w.style.top = Math.max(0, Math.min(innerHeight - 30, ev.clientY - dy)) + 'px'; }, w);
  });
  fl.addEventListener('dblclick', e => { const h = e.target.closest('.fwh'); if (!h || e.target.closest('button')) return; const w = h.parentElement; w.classList.toggle('min'); fwSave(w); fwRefresh(w); });
  fl.addEventListener('click', e => { const b = e.target.closest('[data-fwa]'); if (!b) return; const w = b.closest('.fwin'), id = w.dataset.fw;
    if (b.dataset.fwa === 'min') { w.classList.toggle('min'); fwSave(w); fwRefresh(w); } else if (b.dataset.fwa === 'dock') fwDock(id); else if (b.dataset.fwa === 'close') fwClose(id); });
  // boutons ⧉ (détacher) présents dans le panneau système, l'éditeur, le layout et les en-têtes d'analyse
  document.addEventListener('click', e => { const b = e.target.closest('button[data-fw]'); if (!b || b.closest('.fwin')) return; fwDetach(b.dataset.fw); });
  for (const id of Object.keys(FWDEF)) if (App.fw[id]) fwCreate(id, FWDEF[id].el());
  fwLayout();
  window.addEventListener('resize', () => $$('#floats .fwin').forEach(w => { const r = w.getBoundingClientRect(); if (r.left > innerWidth - 60) w.style.left = (innerWidth - r.width - 10) + 'px'; if (r.top > innerHeight - 30) w.style.top = (innerHeight - 40) + 'px'; }));
}
function fwRefresh(w) { const id = w.dataset.fw; if (w.classList.contains('min')) return; if (id === 'lay') drawLayout(); else if (/^p\d+$/.test(id)) renderPane(+id.slice(1)); }

/* ---------------- Sélecteur de couleur avec validation (OK / Annuler) ---------------- */
const CPAL = ['#2563eb', '#16a34a', '#dc2626', '#9333ea', '#ea580c', '#0891b2', '#ca8a04', '#db2777', '#4f46e5', '#65a30d', '#0d9488', '#be123c', '#7c3aed', '#f59e0b', '#64748b', '#111827'];
function openColorPicker(btn) {
  closeColorPicker();
  const kind = btn.dataset.cpk, i = +btn.dataset.i, s = App.sys, item = kind === 'f' ? s.fields[i] : s.wavelengths[i]; if (!item) return;
  const old = hexCol(kind === 'f' ? fcol(i) : wlCol(item.um));
  const name = kind === 'f' ? `du champ ${i + 1}` : `de λ${i + 1} (${fmt(item.um * 1000, 5)} nm)`;
  let cur = old;
  const d = document.createElement('div'); d.id = 'cpop'; d.className = 'cpop';
  d.innerHTML = `<div class="cph">Couleur ${name}</div>
    <div class="cpg">${CPAL.map(c => `<button class="cps" data-c="${c}" style="background:${c}" title="${c}"></button>`).join('')}</div>
    <div class="cpr"><label class="hint">Autre <input type="color" id="cpNat" value="${old}"></label><input class="in" id="cpHex" value="${old}" maxlength="7" style="width:82px;font-family:var(--mono)"></div>
    <div class="cpr"><span class="hint">Avant</span><span class="cpv" style="background:${old}"></span><span class="hint">Après</span><span class="cpv" id="cpNew" style="background:${old}"></span></div>
    <div class="cpf"><button class="bt" id="cpDef" title="Revenir à la couleur automatique">Par défaut</button><span class="grow"></span><button class="bt" id="cpNo">Annuler</button><button class="tb pri" id="cpOk">OK</button></div>`;
  document.body.appendChild(d);
  const r = btn.getBoundingClientRect(), pr = d.getBoundingClientRect();
  d.style.left = Math.max(6, Math.min(innerWidth - pr.width - 6, r.left)) + 'px'; d.style.top = (r.bottom + pr.height + 8 < innerHeight ? r.bottom + 6 : Math.max(6, r.top - pr.height - 6)) + 'px';
  const set = c => { if (!/^#[0-9a-f]{6}$/i.test(c)) return; cur = c.toLowerCase(); d.querySelector('#cpNew').style.background = cur; d.querySelector('#cpHex').value = cur; d.querySelector('#cpNat').value = cur; d.querySelectorAll('.cps').forEach(b => b.classList.toggle('on', b.dataset.c === cur)); };
  const apply = c => { commit(S => { const it = kind === 'f' ? S.fields[i] : S.wavelengths[i]; if (!it) return; if (c) it.col = c; else delete it.col; }); closeColorPicker(); toast(c ? `Couleur ${name} : ${c}` : `Couleur ${name} : automatique`); };
  set(old);
  d.addEventListener('click', e => { const b = e.target.closest('.cps'); if (b) set(b.dataset.c); });
  d.addEventListener('dblclick', e => { const b = e.target.closest('.cps'); if (b) { set(b.dataset.c); apply(cur); } });
  d.querySelector('#cpNat').addEventListener('input', e => set(e.target.value));
  d.querySelector('#cpHex').addEventListener('input', e => { let v = e.target.value.trim(); if (!v.startsWith('#')) v = '#' + v; if (/^#[0-9a-f]{6}$/i.test(v)) { cur = v.toLowerCase(); d.querySelector('#cpNew').style.background = cur; d.querySelector('#cpNat').value = cur; } });
  d.querySelector('#cpOk').onclick = () => apply(cur);
  d.querySelector('#cpNo').onclick = closeColorPicker;
  d.querySelector('#cpDef').onclick = () => apply(null);
  d.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); apply(cur); } else if (e.key === 'Escape') { e.stopPropagation(); closeColorPicker(); } });
  d.querySelector('#cpOk').focus();
}
function closeColorPicker() { const d = $('#cpop'); if (d) d.remove(); }
document.addEventListener('mousedown', e => { if ($('#cpop') && !e.target.closest('#cpop') && !e.target.closest('[data-cpk]')) closeColorPicker(); }, true);
document.addEventListener('click', e => { const b = e.target.closest('button[data-cpk]'); if (b) { e.preventDefault(); openColorPicker(b); } });

/* ---------------- Données système (façon CODE V : System Data) ---------------- */
const SDT = [['pup', 'Pupille'], ['wl', 'Longueurs d\'onde'], ['fld', 'Champs / vignetage'], ['env', 'Température et pression'], ['mat', 'Matériaux (dn/dT, CTE)'], ['adv', 'Avancé']];
var SD = { tab: 'fld', conv: true, gen: { n: 5, mode: 'area' } };
const MOUNTS = [[23.6, 'Aluminium 6061'], [22.9, 'Aluminium 7075'], [17.3, 'Inox 303 / 304'], [9.9, 'Inox 416'], [8.6, 'Titane Ti-6Al-4V'], [18.7, 'Laiton'], [16.9, 'Cuivre'], [1.3, 'Invar 36'], [2.6, 'Carbure de silicium'], [56, 'Ultem (PEI)'], [65, 'Polycarbonate'], [70, 'PMMA']];
const objInfOf = s => !isFinite(s.surfaces[0].t) || Math.abs(s.surfaces[0].t) > 1e10;
function openSysData(tab) {
  if (tab) SD.tab = tab;
  dlg(`<h2>Données système <button class="x" data-d="close">✕</button></h2><div class="db sdw" id="sdw"></div>`, true, { w: 1000, h: 640 });
  renderSD();
}
function renderSD() {
  const el = $('#sdw'); if (!el) return;
  const a = document.activeElement, keep = a && a.closest && a.closest('#sdw') && a.dataset.sd ? `[data-sd="${a.dataset.sd}"]${a.dataset.i != null ? `[data-i="${a.dataset.i}"]` : ''}${a.dataset.g != null ? `[data-g="${CSS.escape(a.dataset.g)}"]` : ''}${a.dataset.k != null ? `[data-k="${a.dataset.k}"]` : ''}` : null;
  const sc = el.querySelector('.sdc') ? el.querySelector('.sdc').scrollTop : 0;
  let body; try { body = SDTAB[SD.tab](); } catch (e) { console.error(e); body = `<p class="err">Erreur : ${esc(e.message)}</p>`; }
  el.innerHTML = `<div class="sdg"><nav class="sdn">${SDT.map(([k, l]) => `<button data-sdt="${k}" class="${SD.tab === k ? 'on' : ''}">${l}</button>`).join('')}</nav><div class="sdc">${body}</div></div>`;
  el.querySelector('.sdc').scrollTop = sc;
  if (keep) { const e = el.querySelector(keep); if (e) e.focus(); }
}
const sdIn = (k, v, o = {}) => `<input class="in" data-sd="${k}"${o.i != null ? ` data-i="${o.i}"` : ''}${o.g != null ? ` data-g="${esc(o.g)}"` : ''}${o.k != null ? ` data-k="${o.k}"` : ''} style="width:${o.w || 86}px" value="${v == null || v === '' ? '' : esc(String(v))}"${o.ph != null ? ` placeholder="${esc(String(o.ph))}"` : ''}${o.title ? ` title="${esc(o.title)}"` : ''}>`;
const kvRows = rows => `<div class="kv" style="max-width:520px">${rows.map(([a, b]) => `<span>${a}</span><span>${b}</span>`).join('')}</div>`;
const SDTAB = {
  pup() {
    const s = App.sys, ap = s.aperture, M = App.M, inf = objInfOf(s);
    let h = `<h3>Ouverture du système</h3><div class="row"><label>Type</label><select class="in" data-sd="apType">${APTYPES.filter(o => !(inf && o[0] === 'NA')).map(o => `<option value="${o[0]}" ${o[0] === ap.type ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>
      <label style="margin-left:10px">Valeur</label>${sdIn('apVal', fmt(ap.value, 8))}<label style="margin-left:10px">Obstruction (rayon rel.)</label>${sdIn('obs', fmt(ap.obscuration || 0, 4), { w: 60 })}</div>
      <div class="hint">Équivalents CODE V : EPD, FNO, NAO (objet), NA (image) ; « demi-diamètre du diaphragme » = ouverture flottante sur le diaphragme (Zemax « Float by stop size »).</div>`;
    if (M && M.ok) { const p = M.par; h += `<h3>Résultat (paraxial)</h3>` + kvRows([['Diamètre pupille d\'entrée', `${fx(p.epd, 4)} mm`], ['F/# (EFL / EPD)', fx(p.fno, 4)], ['F/# de travail', fx(p.wfno, 4)], ['ON image', fx(p.imgSpaceNA, 5)], ...(inf ? [] : [['ON objet', fx(p.objNA, 5)]]), ['Ø diaphragme', `${fx(2 * p.stopR, 4)} mm`], ['Pupille d\'entrée / S1', `${fx(p.zE, 4)} mm`], ['Pupille de sortie / image', `${fx(p.xpZ, 4)} mm (Ø ${fx(p.xpD, 3)})`]]); }
    return h;
  },
  wl() {
    const s = App.sys;
    return `<h3>Longueurs d'onde</h3><table class="mt"><tr><th></th><th>#</th><th>λ (nm)</th><th>Poids</th><th>Référence</th><th>Couleur</th><th></th></tr>
      ${s.wavelengths.map((w, i) => `<tr><td><span class="sw" style="background:${wlCol(w.um)}"></span></td><td>W${i + 1}</td><td>${sdIn('wnm', fmt(w.um * 1000, 8), { i })}</td><td>${sdIn('ww', fmt(w.w ?? 1, 5), { i, w: 60 })}</td><td style="text-align:center"><input type="radio" name="sdprim" data-sd="wp" data-i="${i}" ${i === s.primary ? 'checked' : ''}></td><td><button class="cpk" data-cpk="w" data-i="${i}" style="background:${hexCol(wlCol(w.um))}" title="Couleur de λ${i + 1}"></button></td><td><button class="x" data-sda="wdel" data-i="${i}" title="Supprimer">✕</button></td></tr>`).join('')}</table>
      <button class="add" data-sda="wadd">+ Ajouter une longueur d'onde</button>
      <div class="chips"><button class="chip" data-sda="wpre" data-v="FdC">F, d, C</button><button class="chip" data-sda="wpre" data-v="vis">Visible 450–650</button><button class="chip" data-sda="wpre" data-v="hene">632,8 nm</button><button class="chip" data-sda="wpre" data-v="nir">NIR</button><button class="chip" data-sda="wpre" data-v="d">d seule</button></div>
      <div class="hint">Longueurs d'onde dans l'air du système (comme CODE V et Zemax). La référence sert au paraxial, aux solves et au rayon principal.</div>`;
  },
  fld() {
    const s = App.sys, M = App.M, inf = objInfOf(s), ft = ftypeOf(s), u = OE.FTYPES[ft].u, nat = inf ? 'ang' : 'obj';
    let eq = null, pim = null, rim = null; try { if (M && M.ok) { eq = OE.convertFields(s, nat); pim = OE.convertFields(s, 'pim'); try { rim = OE.convertFields(s, 'rim'); } catch (e) { rim = null; } } } catch (e) { }
    const vig = s.fields.some(f => +f.vuy || +f.vly || +f.vux || +f.vlx), nFix = s.surfaces.filter((x, j) => j > 0 && j < s.surfaces.length - 1 && x.sdFixed).length;
    let h = `<h3>Champs</h3><div class="row"><label>Type de champ</label><select class="in" data-sd="ftype">${Object.entries(OE.FTYPES).filter(([k]) => !(inf && k === 'obj')).map(([k, v]) => `<option value="${k}" ${k === ft ? 'selected' : ''}>${v.l} (${v.cv})</option>`).join('')}</select>
      <label class="hint" style="margin-left:10px" title="Recalcule les valeurs pour conserver les mêmes points de champ (CODE V « Convert Fields »). Décoché : les nombres sont gardés et réinterprétés."><input type="checkbox" data-sd="fconv" ${SD.conv ? 'checked' : ''}> convertir les valeurs</label></div>
      <div style="overflow:auto"><table class="mt sdt"><tr><th>#</th><th></th><th>X (${u})</th><th>Y (${u})</th><th>Poids</th><th title="Fraction du rayon de pupille coupée côté +Y">VUY</th><th title="… côté −Y">VLY</th><th title="… côté +X">VUX</th><th title="… côté −X">VLX</th>
        <th class="ro">${inf ? 'Angle (°)' : 'Objet (mm)'}</th><th class="ro">Image parax. (mm)</th><th class="ro">Image réelle (mm)</th><th></th></tr>
      ${s.fields.map((f, i) => `<tr><td>F${i + 1}</td><td><button class="cpk" data-cpk="f" data-i="${i}" style="background:${hexCol(fcol(i))}" title="Couleur du champ ${i + 1}"></button></td><td>${sdIn('fx', fmt(f.x || 0, 8), { i, w: 72 })}</td><td>${sdIn('fy', fmt(f.y, 8), { i, w: 72 })}</td><td>${sdIn('fw', fmt(f.w ?? 1, 4), { i, w: 48 })}</td>
        ${['vuy', 'vly', 'vux', 'vlx'].map(k => `<td>${sdIn('fv', fmt(+f[k] || 0, 5), { i, k, w: 70 })}</td>`).join('')}
        <td class="ro">${eq ? fx(eq[i].y, 4) : '—'}</td><td class="ro">${pim ? fx(pim[i].y, 4) : '—'}</td><td class="ro">${rim ? fx(rim[i].y, 4) : '—'}</td><td><button class="x" data-sda="fdel" data-i="${i}" title="Supprimer">✕</button></td></tr>`).join('')}</table></div>
      <div class="row" style="flex-wrap:wrap;gap:6px;margin-top:6px"><button class="bt" data-sda="fadd">+ Ajouter un champ</button>
        <span class="hint">Générer</span>${sdIn('gn', SD.gen.n, { w: 40, title: 'Nombre de champs' })}<span class="hint">champs de 0 à</span>${sdIn('gmax', SD.gen.max ?? fmt(Math.max(...s.fields.map(f => Math.hypot(f.x || 0, f.y))), 6), { w: 60 })}<span class="hint">${u}</span>
        <select class="in" data-sd="gmode"><option value="area" ${SD.gen.mode === 'area' ? 'selected' : ''}>à aires égales (√)</option><option value="lin" ${SD.gen.mode === 'lin' ? 'selected' : ''}>linéaire</option></select><button class="bt" data-sda="fgen">Générer</button></div>
      <h3>Vignetage</h3>
      <div class="row" style="gap:6px"><button class="bt" data-sda="setvig" title="CODE V SET VIGNETTING : rayons limites qui passent juste les ouvertures fixées (🔒)">Calculer le vignetage (SET VIG)</button><button class="bt" data-sda="clrvig" ${vig ? '' : 'disabled'}>Effacer le vignetage</button>
        <span class="hint">${nFix ? `${nFix} ouverture(s) fixée(s) 🔒` : 'Aucune ouverture fixée : verrouillez des demi-diamètres (🔒) dans l\'éditeur'}</span></div>
      <div class="hint" style="margin-top:6px">Convention CODE V : la pupille non vignettée va de −1 + VLY à 1 − VUY en Y (de −1 + VLX à 1 − VUX en X). Les coordonnées pupillaires relatives (ray fans, spots, optimisation) et les demi-diamètres automatiques suivent ce faisceau vignetté ; les calculs de diffraction (front d'onde, PSF, FTM) découpent la pupille réelle par cette ellipse. Valeurs négatives : pupille agrandie.</div>
      <div class="hint">Hauteur image paraxiale (YIM) : y = f·tan θ (objet à l'infini) ou grandissement × hauteur objet ; hauteur image réelle (YRI) : point d'impact du rayon principal réel, recherché par itération. En conjugué fini, l'angle est celui du rayon principal réel (visé au centre du diaphragme), comme dans CODE V.</div>`;
    return h;
  },
  env() {
    const s = App.sys, e = s.env || {}, M = App.M, T = e.T ?? 20, P = e.P ?? 1, mount = e.cteMount ?? 23.6;
    let h = `<h3>Température et pression</h3>
      <div class="row" style="flex-wrap:wrap;gap:6px"><label>Température du système</label>${sdIn('envT', fmt(T, 6), { w: 64 })}<span class="hint">°C</span>
        <label style="margin-left:10px">Pression</label>${sdIn('envP', fmt(P, 6), { w: 64 })}<span class="hint">atm (${fx(P * 1013.25, 1)} hPa)</span>
        <label style="margin-left:10px" title="Température à laquelle les rayons et épaisseurs de l'éditeur sont donnés">Prescription à</label>${sdIn('envTref', fmt(e.Tref ?? 20, 6), { w: 54 })}<span class="hint">°C</span></div>
      <div class="chips"><button class="chip" data-sda="envpre" data-t="20" data-p="1">Nominal 20 °C · 1 atm</button><button class="chip" data-sda="envpre" data-t="-40" data-p="1">−40 °C</button><button class="chip" data-sda="envpre" data-t="0" data-p="1">0 °C</button><button class="chip" data-sda="envpre" data-t="50" data-p="1">+50 °C</button><button class="chip" data-sda="envpre" data-t="70" data-p="1">+70 °C</button><button class="chip" data-sda="envpre" data-t="20" data-p="0">Vide</button><button class="chip" data-sda="envpre" data-t="-50" data-p="0.26">Altitude 10 km</button></div>
      <div class="row"><label><input type="checkbox" data-sd="expand" ${e.expand !== false ? 'checked' : ''}> Dilatation thermique de la lentille et des entretoises</label></div>
      <div class="row" style="gap:6px"><label>Matériau du barillet / des entretoises</label><select class="in" data-sd="mountSel"><option value="">— personnalisé —</option>${MOUNTS.map(([v, l]) => `<option value="${v}" ${+mount === v ? 'selected' : ''}>${l} (${v})</option>`).join('')}</select>${sdIn('cteMount', fmt(mount, 5), { w: 56 })}<span class="hint">10⁻⁶/K</span></div>`;
    if (M && M.ok) {
      const n = structuredClone(s); n.env = {}; const M0 = OE.prepare(n);
      if (M0.ok) { const p = M.par, p0 = M0.par, dz = p.imgDist - M.S[M.N - 1].t, dz0 = p0.imgDist - M0.S[M0.N - 1].t;
        h += `<h3>Effet de l'environnement (paraxial, λ de référence)</h3>` + kvRows([['Focale (EFL)', `${fx(p.efl, 6)} mm <span class="hint">(nominal ${fx(p0.efl, 6)}, Δ ${fx((p.efl - p0.efl) * 1000, 3)} µm)</span>`],
          ['Foyer paraxial − plan image', `${fx(dz * 1000, 3)} µm <span class="hint">(nominal ${fx(dz0 * 1000, 3)} µm)</span>`], ['Longueur totale', `${fx(p.ttl, 5)} mm <span class="hint">(Δ ${fx((p.ttl - p0.ttl) * 1000, 2)} µm)</span>`]]);
        if (M.S.some(x => x.tsolve === 'M')) h += '<div class="hint" style="color:var(--warn)">Un solve de mise au point (M) est actif : il refocalise à chaque température. Retirez-le pour voir la défocalisation au plan image fixe.</div>'; }
    }
    const S = s.surfaces, N = S.length - 1, gaps = [];
    for (let j = 1; j < N; j++) if (!OE.isSolid(S[j].glass)) gaps.push(j);
    h += `<h3>Entretoises et milieux d'air</h3><div class="hint">CTE de la monture qui fixe chaque espace d'air (vide : matériau du barillet). Pour un miroir, CTE du substrat.</div>
      <table class="mt"><tr><th>Surface</th><th>Commentaire</th><th>Épaisseur (mm)</th><th>CTE (10⁻⁶/K)</th></tr>${gaps.map(j => `<tr><td>S${j}${OE.isMirror(S[j]) ? ' (miroir)' : ''}</td><td>${esc(S[j].comment || '')}</td><td>${fx(S[j].t, 4)}</td><td>${sdIn('tce', S[j].tce ?? '', { i: j, w: 64, ph: fmt(mount, 4) })}</td></tr>`).join('')}</table>
      <div class="row" style="margin-top:8px"><button class="bt" data-sda="thpane">Analyse thermique dans un panneau</button></div>
      <div class="hint">Modèle : indices des verres par la formule dn/dT absolue de Schott (coefficients des catalogues), corrigés de l'indice de l'air (Edlén, T et P) ; λ ramenée à l'air du catalogue (20 °C, 1 atm). Rayons, épaisseurs, asphériques et ouvertures fixées dilatés de Tref à T (CTE du verre pour les lentilles, de la monture pour les espaces d'air).</div>`;
    return h;
  },
  mat() {
    const s = App.sys, M = App.M, l = M && M.ok ? M.wls[M.pw] : 0.5875618, mat = (s.env && s.env.mat) || {};
    const gl = [...new Set(s.surfaces.filter((x, j) => j < s.surfaces.length - 1 && OE.isSolid(x.glass)).map(x => (OE.glassRecord(x.glass) || {}).key || x.glass.trim()))];
    if (!gl.length) return '<h3>Matériaux</h3><p class="hint">Aucun verre dans le système.</p>';
    const mk = T => ({ T, P: 1, Tref: 20, sys: s, cache: new Map(), miss: new Set() });
    const K = ['D0', 'D1', 'D2', 'E0', 'E1', 'ltk'];
    let h = `<h3>dn/dT (formule de Schott) et dilatation</h3><div style="overflow:auto"><table class="mt sdt"><tr><th>Verre</th><th>Source</th>${K.map(k => `<th>${k === 'ltk' ? 'λTK (µm)' : k}</th>`).join('')}<th>T0 (°C)</th><th>CTE (10⁻⁶/K)</th><th class="ro" title="dn/dT absolu à λ de référence, 20 °C">dn/dT abs. (10⁻⁶/K)</th><th></th></tr>`;
    for (const g of gl) {
      const sysNo = structuredClone(s); if (sysNo.env && sysNo.env.mat) delete sysNo.env.mat[g];
      const base = OE.glassTherm(g, sysNo), d = OE.glassTherm(g, s), ov = mat[g] || {};
      const c0 = mk(19), c1 = mk(21), dn = (OE.envN(g, l, c1) * OE.nAir(l, 21, 1) - OE.envN(g, l, c0) * OE.nAir(l, 19, 1)) / 2 * 1e6;
      h += `<tr><td><b>${esc(g)}</b></td><td class="hint">${d ? d.src : '—'}</td>${K.map((k, i) => `<td>${sdIn('mat', ov[k] ?? '', { g, k, w: 74, ph: base ? fmt(base.D[i], 4) : '0' })}</td>`).join('')}
        <td>${sdIn('mat', ov.T0 ?? '', { g, k: 'T0', w: 44, ph: base ? fmt(base.T0, 4) : '20' })}</td><td>${sdIn('mat', ov.cte ?? '', { g, k: 'cte', w: 52, ph: base && base.cte ? fmt(base.cte * 1e6, 4) : '?' })}</td>
        <td class="ro">${d && d.dn ? fx(dn, 3) : '<span style="color:var(--warn)">inconnu</span>'}</td><td>${mat[g] ? `<button class="x" data-sda="matreset" data-g="${esc(g)}" title="Revenir aux valeurs du catalogue">↺</button>` : ''}</td></tr>`;
    }
    h += `</table></div><div class="hint">Champs vides : valeurs du catalogue (refractiveindex.info d'après Schott, Ohara, CDGM, Hoya, ou fichier AGF importé : lignes TD et ED). Saisissez des coefficients pour un verre modèle, une coulée particulière ou un matériau absent. Δn_abs(λ, T) = (n² − 1)/(2n) · [D0 ΔT + D1 ΔT² + D2 ΔT³ + (E0 ΔT + E1 ΔT²)/(λ² − λTK²)], ΔT = T − T0.</div>`;
    return h;
  },
  adv() {
    const s = App.sys, ap = s.apod || { type: 'none' };
    return `<h3>Visée des rayons</h3><div class="row"><select class="in" data-sd="aimSel">${AIMOPTS.map(([k, l]) => `<option value="${k}" ${OE.aimMode(s) === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="hint"><b>Pupille paraxiale</b> : rayons visés sur la pupille d'entrée paraxiale (Zemax sans « Ray Aiming »). <b>Rayon principal au diaphragme</b> : le rayon principal de chaque champ est itéré pour passer au centre du diaphragme, la pupille paraxiale étant translatée d'autant — comportement par défaut de CODE V (activé à l'import d'un .seq) ; à utiliser pour comparer avec CODE V, le vignetage VUY…VLX corrigeant le reste. <b>Réelle</b> : chaque rayon est itéré pour remplir exactement le diaphragme (grand angle, pupille très aberrante).</div>
      <h3>Apodisation de la pupille</h3><div class="row" style="gap:6px"><select class="in" data-sd="apodT"><option value="none" ${ap.type !== 'gauss' ? 'selected' : ''}>Uniforme</option><option value="gauss" ${ap.type === 'gauss' ? 'selected' : ''}>Gaussienne</option></select>
        ${ap.type === 'gauss' ? `<label>Intensité relative au bord de la pupille</label>${sdIn('apodI', fmt(ap.I ?? 0.135, 4), { w: 60 })}<span class="hint">0,135 = 1/e² (CODE V PUI)</span>` : ''}</div>
      <div class="hint">S'applique aux calculs de diffraction (PSF, FTM, énergie encerclée, Strehl).</div>
      <h3>Non pris en charge</h3><div class="hint">Mode afocal, conjugués multiples (zoom), couplage multi-environnement : signalés à l'import et ignorés.</div>`;
  },
};
function sdChange(t) {
  const k = t.dataset.sd, i = +t.dataset.i, num = (ok) => { const v = parseNum(t.value, false); if (!isFinite(v) || (ok && !ok(v))) { toast('Valeur invalide'); renderSD(); return null; } return v; };
  let v;
  switch (k) {
    case 'apType': commit(s => s.aperture.type = t.value); break;
    case 'apVal': if ((v = num(x => x > 0)) != null) commit(s => s.aperture.value = v); break;
    case 'obs': if ((v = num(x => x >= 0 && x < 0.95)) != null) commit(s => s.aperture.obscuration = v); break;
    case 'wnm': if ((v = num(x => x > 150 && x < 25000)) != null) commit(s => s.wavelengths[i].um = v / 1000); break;
    case 'ww': if ((v = num(x => x >= 0)) != null) commit(s => s.wavelengths[i].w = v); break;
    case 'wp': commit(s => s.primary = i); break;
    case 'wcol': commit(s => s.wavelengths[i].col = t.value); break;
    case 'ftype': setFieldType(t.value, SD.conv); break;
    case 'fconv': SD.conv = t.checked; break;
    case 'fx': if ((v = num()) != null) commit(s => s.fields[i].x = v); break;
    case 'fy': if ((v = num()) != null) commit(s => s.fields[i].y = v); break;
    case 'fw': if ((v = num(x => x >= 0)) != null) commit(s => s.fields[i].w = v); break;
    case 'fcol': commit(s => s.fields[i].col = t.value); break;
    case 'fv': if ((v = num(x => x > -1 && x < 1)) != null) commit(s => { if (v) s.fields[i][t.dataset.k] = v; else delete s.fields[i][t.dataset.k]; }); break;
    case 'gn': SD.gen.n = Math.max(2, Math.min(25, parseInt(t.value) || 5)); break;
    case 'gmax': { const x = parseNum(t.value, false); SD.gen.max = isFinite(x) ? x : null; break; }
    case 'gmode': SD.gen.mode = t.value; break;
    case 'envT': if ((v = num(x => x > -273)) != null) commit(s => s.env = { ...(s.env || {}), T: v }); break;
    case 'envP': if ((v = num(x => x >= 0 && x < 100)) != null) commit(s => s.env = { ...(s.env || {}), P: v }); break;
    case 'envTref': if ((v = num(x => x > -273)) != null) commit(s => s.env = { ...(s.env || {}), Tref: v }); break;
    case 'expand': commit(s => s.env = { ...(s.env || {}), expand: t.checked }); break;
    case 'mountSel': if (t.value) commit(s => s.env = { ...(s.env || {}), cteMount: +t.value }); break;
    case 'cteMount': if ((v = num()) != null) commit(s => s.env = { ...(s.env || {}), cteMount: v }); break;
    case 'tce': if (t.value.trim() === '') commit(s => { delete s.surfaces[i].tce; }); else if ((v = num()) != null) commit(s => s.surfaces[i].tce = v); break;
    case 'mat': { const g = t.dataset.g, kk = t.dataset.k;
      if (t.value.trim() === '') { commit(s => { const m = s.env && s.env.mat && s.env.mat[g]; if (m) { delete m[kk]; if (!Object.keys(m).length) delete s.env.mat[g]; } }); break; }
      if ((v = num()) != null) commit(s => { s.env = { ...(s.env || {}) }; s.env.mat = { ...(s.env.mat || {}) }; s.env.mat[g] = { ...(s.env.mat[g] || {}), [kk]: v }; }); break; }
    case 'aim': commit(s => s.rayAiming = t.checked); break;
    case 'aimSel': setAim(t.value); break;
    case 'apodT': commit(s => s.apod = t.value === 'gauss' ? { type: 'gauss', I: (s.apod && s.apod.I) || 0.135 } : { type: 'none' }); break;
    case 'apodI': if ((v = num(x => x > 0 && x < 1)) != null) commit(s => s.apod = { type: 'gauss', I: v }); break;
  }
}
function sdAction(b) {
  const a = b.dataset.sda, i = +b.dataset.i;
  switch (a) {
    case 'wadd': commit(s => s.wavelengths.push({ um: 0.55, w: 1 })); break;
    case 'wdel': if (App.sys.wavelengths.length > 1) commit(s => { s.wavelengths.splice(i, 1); s.primary = Math.min(s.primary, s.wavelengths.length - 1); }); break;
    case 'wpre': { const P = { FdC: [[0.4861327, 1], [0.5875618, 1], [0.6562725, 1], 1], vis: [[0.45, 1], [0.55, 1], [0.65, 1], 1], hene: [[0.6328, 1], 0], nir: [[0.78, 1], [0.85, 1], [0.94, 1], 1], d: [[0.5875618, 1], 0] }[b.dataset.v];
      commit(s => { s.primary = P.pop(); s.wavelengths = P.map(([um, w]) => ({ um, w })); }); break; }
    case 'fadd': commit(s => { const m = Math.max(...s.fields.map(f => f.y)); s.fields.push({ x: 0, y: +(m * 1.2 || 1).toFixed(4), w: 1 }); }); break;
    case 'fdel': if (App.sys.fields.length > 1) commit(s => s.fields.splice(i, 1)); break;
    case 'fgen': { const n = SD.gen.n || 5, mx = SD.gen.max ?? Math.max(...App.sys.fields.map(f => Math.hypot(f.x || 0, f.y))); if (!(mx > 0)) { toast('Indiquez un champ maximal'); break; }
      commit(s => { const old = s.fields; s.fields = Array.from({ length: n }, (_, k) => ({ x: 0, y: +(mx * (SD.gen.mode === 'lin' ? k / (n - 1) : Math.sqrt(k / (n - 1)))).toPrecision(6), w: 1, ...(old[k] && old[k].col ? { col: old[k].col } : {}) })); });
      toast(`${n} champs générés de 0 à ${fmt(mx, 5)}`); break; }
    case 'setvig': {
      try { const r = OE.setVignetting(App.sys); if (!r.clipped) { toast('Aucune ouverture fixée (🔒) : rien ne limite le faisceau', 4000); break; }
        commit(s => s.fields = s.fields.map((f, k) => { const o = { ...f }; for (const kk of ['vuy', 'vly', 'vux', 'vlx']) { if (r.fields[k][kk]) o[kk] = r.fields[k][kk]; else delete o[kk]; } return o; }));
        toast('Vignetage calculé sur les ouvertures fixées'); } catch (e) { toast('Vignetage : ' + e.message, 4000); } break; }
    case 'clrvig': commit(s => s.fields.forEach(f => { delete f.vuy; delete f.vly; delete f.vux; delete f.vlx; })); toast('Vignetage effacé'); break;
    case 'envpre': commit(s => s.env = { ...(s.env || {}), T: +b.dataset.t, P: +b.dataset.p }); break;
    case 'matreset': { const g = b.dataset.g; commit(s => { if (s.env && s.env.mat) delete s.env.mat[g]; }); break; }
    case 'thpane': { const pi = App.panes.findIndex((p, k) => k < App.grid && p.type === 'thermal'); const k = pi >= 0 ? pi : Math.min(App.grid - 1, 1); App.panes[k] = { type: 'thermal' }; save(); buildPanes(); toast('Analyse thermique affichée'); break; }
  }
}

/* Fenêtres : flottantes et non modales (on peut continuer à travailler derrière), déplaçables par la barre de titre,
   réductibles, agrandissables et redimensionnables (poignée en bas à droite). La géométrie est mémorisée par fenêtre. */
const WIN = { key: null, geo: new Map(), state: new Map() };
/** clé stable d'un élément de fenêtre : id, ou attributs data-* (data-o + data-i…), ou classe + rang */
function dlgKey(el, d) {
  if (el.id) return '#' + el.id;
  const a = [...el.attributes].filter(x => x.name.startsWith('data-') || x.name === 'name').map(x => `[${x.name}="${CSS.escape(x.value)}"]`).join('');
  if (a) return el.tagName.toLowerCase() + a;
  const c = el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).map(x => CSS.escape(x)).join('.') : '';
  const sel = el.tagName.toLowerCase() + c, all = [...d.querySelectorAll(sel)]; return { sel, k: all.indexOf(el) };
}
function dlgFind(d, k) { if (!k) return null; if (typeof k === 'string') { try { return d.querySelector(k); } catch (e) { return null; } } try { return d.querySelectorAll(k.sel)[k.k] || null; } catch (e) { return null; } }
function dlgState(d) {
  const sc = []; for (const el of d.querySelectorAll('*')) if (el.scrollTop || el.scrollLeft) sc.push([dlgKey(el, d), el.scrollTop, el.scrollLeft]);
  const a = document.activeElement, f = a && d.contains(a) && a !== d ? { k: dlgKey(a, d), s: a.selectionStart, e: a.selectionEnd } : null;
  return { sc, f };
}
function dlgRestore(d, st) {
  for (const [k, t, l] of st.sc) { const el = dlgFind(d, k); if (el) { el.scrollTop = t; el.scrollLeft = l; } }
  if (st.f) { const el = dlgFind(d, st.f.k); if (el && el.focus) { el.focus({ preventScroll: true }); try { if (st.f.s != null && el.setSelectionRange) el.setSelectionRange(st.f.s, st.f.e); } catch (e) { } } }
}
function dlg(html, wide, o = {}) {
  const d = $('#dlg'), m = $('#modal'), h2t = (html.match(/<h2>([^<]*)/) || [])[1] || '', key = h2t.trim();
  const same = m.classList.contains('open') && WIN.key === key;
  if (!same && m.classList.contains('open')) winSave();
  // même fenêtre redessinée (après une modification) : on garde les défilements et le champ actif, sinon la vue « saute » en haut
  const keep = same ? dlgState(d) : null;
  d.innerHTML = html; d.classList.toggle('wide', !!wide);
  if (keep) dlgRestore(d, keep);
  const h2 = d.querySelector(':scope > h2');
  if (h2) {
    const x = h2.querySelector('.x'), c = document.createElement('span'); c.className = 'wctl';
    const hs = key.startsWith('Aide') ? null : (HELPDLG.find(([t]) => key.startsWith(t)) || [])[1];
    c.innerHTML = (hs ? `<button class="wb" data-help="${hs}" title="Aide sur cette fenêtre" aria-label="Aide">?</button>` : '') + '<button class="wb" data-w="min" title="Réduire / restaurer (double-clic sur la barre de titre)" aria-label="Réduire">–</button><button class="wb" data-w="max" title="Agrandir / restaurer" aria-label="Agrandir">□</button>';
    if (x) { x.title = 'Fermer (Échap)'; x.setAttribute('aria-label', 'Fermer'); c.appendChild(x); } h2.appendChild(c);
  }
  const g = document.createElement('div'); g.className = 'grip'; g.title = 'Redimensionner'; d.appendChild(g);
  m.classList.add('open');
  if (same) return;
  WIN.key = key; d.classList.remove('min', 'maxi'); d.style.cssText = '';
  const st = WIN.geo.get(key);
  if (st) { Object.assign(d.style, st); if (st.height) d.style.maxHeight = 'none'; }
  else { if (o.w) d.style.width = `min(${o.w}px, 96vw)`; if (o.h) { d.style.height = `min(${o.h}px, 90vh)`; } const r = d.getBoundingClientRect(); d.style.left = Math.max(8, (innerWidth - r.width) / 2) + 'px'; d.style.top = Math.max(12, (innerHeight - r.height) / 2.4) + 'px'; }
  winClamp();
}
function winSave() { const d = $('#dlg'); if (!WIN.key) return; const { left, top, width, height } = d.style; WIN.geo.set(WIN.key, { left, top, width, height }); }
function winClamp() { const d = $('#dlg'), r = d.getBoundingClientRect(); let l = parseFloat(d.style.left) || r.left, t = parseFloat(d.style.top) || r.top; l = Math.max(0, Math.min(l, innerWidth - r.width)); t = Math.min(Math.max(t, 0), innerHeight - 40); d.style.left = l + 'px'; d.style.top = t + 'px'; }
function closeDlg() { if ($('#modal').classList.contains('open')) winSave(); $('#modal').classList.remove('open'); WIN.key = null; OPT.running = false; }
function setupWin() {
  const d = $('#dlg');
  const track = (e, fn) => { e.preventDefault(); const mv = ev => fn(ev), up = () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); document.body.classList.remove('wdrag'); winSave(); }; document.body.classList.add('wdrag'); window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up); };
  d.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    if (e.target.classList.contains('grip')) {
      const r = d.getBoundingClientRect(), x0 = e.clientX, y0 = e.clientY; d.classList.remove('maxi', 'min');
      return track(e, ev => { d.style.maxHeight = 'none'; d.style.width = Math.max(340, Math.min(innerWidth - r.left - 4, r.width + ev.clientX - x0)) + 'px'; d.style.height = Math.max(160, Math.min(innerHeight - r.top - 4, r.height + ev.clientY - y0)) + 'px'; });
    }
    const h2 = e.target.closest('#dlg > h2'); if (!h2 || e.target.closest('button,input,select,label,a')) return;
    if (d.classList.contains('maxi')) return;
    const r = d.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
    track(e, ev => { d.style.left = ev.clientX - dx + 'px'; d.style.top = ev.clientY - dy + 'px'; winClamp(); });
  });
  d.addEventListener('dblclick', e => { if (e.target.closest('#dlg > h2') && !e.target.closest('button,input,select')) d.classList.toggle('min'); });
  d.addEventListener('click', e => { const b = e.target.closest('[data-w]'); if (!b) return; if (b.dataset.w === 'min') { d.classList.remove('maxi'); d.classList.toggle('min'); } else { d.classList.remove('min'); d.classList.toggle('maxi'); } });
  window.addEventListener('resize', () => { if ($('#modal').classList.contains('open')) winClamp(); });
}
function setupDlg() {
  setupWin();
  $('#dlg').addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.t) {
      const k = t.dataset.t, ty = t.dataset.k, num = () => { const v = parseNum(t.value, false); return isFinite(v) ? v : null; };
      commit(s => { tolCfg(); const c = s.tol;
        if (k === 'on') c.types[ty].on = t.checked; else if (k === 'v') { const v = num(); if (v != null && v >= 0) c.types[ty].v = v; }
        else if (['comp', 'compVars', 'invRound'].includes(k)) c[k] = t.checked;
        else if (k === 'trials') c.trials = Math.max(5, Math.min(5000, parseInt(t.value) || 200));
        else if (k === 'compIt') c.compIt = Math.max(1, Math.min(10, parseInt(t.value) || 3));
        else if (['mtfF', 'spec', 'invVal'].includes(k)) { const v = num(); c[k] = t.value.trim() === '' ? null : v != null && (k === 'spec' || v > 0) ? v : c[k]; }
        else c[k] = t.value; });
      if (!['spec', 'invVal', 'invMode', 'invRound', 'trials', 'dist', 'seed'].includes(k)) TOL.stale = !!(TOL.sens || TOL.mc || TOL.inv);
      renderTolL(); renderTolRes(); return;
    }
    if (t.dataset.li != null) {
      const i = +t.dataset.li, k = t.dataset.lk;
      if (k === 'on') tolEditList(L => { L[i].on = t.checked; });
      else { const v = parseNum(t.value, false); if (!isFinite(v)) { toast('Valeur invalide'); renderTolL(); return; } tolEditList(L => { L[i][k] = v; }); }
      return;
    }
    if (t.id === 'mfImg') { commit(s => s.merit.image = t.value, { fast: false }); openOptim(); }
    if (t.id === 'mfRef') { commit(s => s.merit.ref = t.value); openOptim(); }
    if (t.id === 'mfSym') { commit(s => s.merit.sym = t.checked); openOptim(); }
    if (t.id === 'mfPu') { commit(s => { const p = s.merit.pupil = { type: 'GQ', rings: 3, arms: 8, grid: 8, ...(s.merit.pupil || {}) }; p.type = t.value; }); openOptim(); }
    if (t.id === 'mfRings' || t.id === 'mfArms' || t.id === 'mfGrid') { const k = t.id === 'mfRings' ? 'rings' : t.id === 'mfArms' ? 'arms' : 'grid', lim = { rings: [1, 20], arms: [2, 36], grid: [2, 40] }[k], v = Math.max(lim[0], Math.min(lim[1], parseInt(t.value) || 0));
      if (!v) { toast('Valeur invalide'); return; } commit(s => { s.merit.pupil = { type: 'GQ', rings: 3, arms: 8, grid: 8, ...(s.merit.pupil || {}) }; s.merit.pupil[k] = v; }); openOptim(); }
    if (t.id === 'mfMtfF') { const v = parseFloat(String(t.value).replace(',', '.')); if (v > 0) { commit(s => s.merit.mtfF = v); openOptim(); } }
    if (t.id === 'mfIw') { const raw = String(t.value).trim(), v = parseFloat(raw.replace(',', '.')); commit(s => { if (raw === '') delete s.merit.iw; else if (v >= 0) s.merit.iw = v; }); openOptim(); }
    if (t.id === 'oCyc') { OPT.cyc = t.value; OPT.maxIt = t.value === 'auto' ? 500 : +t.value; }
    if (t.id === 'oDer') OPT.central = t.value === 'cen';
    if (t.id === 'mfWl') { commit(s => s.merit.wl = t.value === 'all' ? 'all' : /^\d+$/.test(t.value) ? +t.value : t.value, { fast: false }); openOptim(); }
    if (t.dataset.gs) { const k = t.dataset.gs; commit(s => { const g = s.merit.gsub = { cats: null, pref: false, k: 6, passes: 2, ...(s.merit.gsub || {}) };
      if (k === 'cat') { const all = OE.cats(), cur = new Set(g.cats && g.cats.length ? g.cats : all); t.checked ? cur.add(t.value) : cur.delete(t.value); g.cats = cur.size === all.length ? null : [...cur]; }
      else if (k === 'pref') g.pref = t.checked; else g[k] = Math.max(1, Math.min(k === 'k' ? 30 : 5, parseInt(t.value) || g[k])); }); openOptim(); }
    if (t.dataset.ow) { const k = t.dataset.ow, i = +t.dataset.i, raw = t.value.trim(), v = raw === '' ? null : parseFloat(raw.replace(',', '.')); if (raw !== '' && !(v >= 0)) { toast('Poids invalide'); return; }
      commit(s => { const a = s.merit[k] = Array.isArray(s.merit[k]) ? s.merit[k] : []; a[i] = v; if (a.every(x => x == null)) delete s.merit[k]; }); openOptim(); }
    if (t.id === 'gMode') OPT.gMode = t.value;
    if (t.id === 'gCyc') OPT.gCyc = Math.max(1, Math.min(200, parseInt(t.value) || 10));
    if (t.id === 'gAmp') OPT.gAmp = Math.max(1, Math.min(100, parseFloat(String(t.value).replace(',', '.')) || 20));
    if (t.dataset.o) { const i = +t.dataset.i, k = t.dataset.o; commit(s => { const o = s.merit.ops[i]; if (!o) return; delete o.auto;
      if (k === 'cmp') o.cmp = t.value; else if (k === 'lag') { if (t.checked) o.lag = true; else delete o.lag; } else if (k === 'c') o.c = t.value;
      else { const raw = String(t.value).trim(); if (raw === '') delete o[k]; else { const v = parseFloat(raw.replace(',', '.')); if (isFinite(v)) o[k] = v; } } }); openOptim(); }
  });
  $('#dlg').addEventListener('change', e => { if (e.target.dataset.dw != null || e.target.dataset.dws != null) drwEvent(e.target); if (e.target.dataset.sd) sdChange(e.target); if (e.target.closest('#mcw')) mcEvent(e); });
  $('#dlg').addEventListener('click', e => { const b = e.target.closest('#mcw [data-mcact]'); if (b) mcAction(b); const h = e.target.closest('#hw [data-hgo]'); if (h) histGo(+h.dataset.hgo); const ha = e.target.closest('#hw [data-hact]'); if (ha) histAction(ha); });
  $('#dlg').addEventListener('click', e => { const t = e.target.closest('[data-sdt]'); if (t) { SD.tab = t.dataset.sdt; renderSD(); return; } const b = e.target.closest('[data-sda]'); if (b) sdAction(b); });
  $('#dlg').addEventListener('click', e => {
    const tb = e.target.closest('[data-tl],[data-tr]'); if (tb) { if (tb.dataset.tl) { TOL.tabL = tb.dataset.tl; renderTolL(); } else { TOL.tabR = tb.dataset.tr; renderTolRes(); } return; }
    const b = e.target.closest('[data-d]'); if (!b) return;
    const a = b.dataset.d;
    if (a === 'close') closeDlg();
    if (a === 'rgen') genReport();
    if (a === 'dwgen') genDrawings();
    if (a === 'trgen') genReport(tolRptOverride());
    if (a === 'tolopen') openTol();
    if (a === 'dwopen') openDrawings();
    if (a === 'tsens') runSens();
    if (a === 'tmc') runMC();
    if (a === 'tinv') runInv();
    if (a === 'tstop') { TOL.running = false; bgCancel('tol'); }
    if (a === 'tcopy') { const r = tolReport(); navigator.clipboard?.writeText(r).then(() => toast('Rapport copié (CSV, séparateur ;)'), () => download(fileBase() + '_tolerances.csv', r, 'text/csv')); }
    if (a === 'tgen') { commit(s => { const c = tolCfg(); c.list = OE.tolGen(s, c).map(x => ({ ...x })); }); TOL.stale = !!(TOL.sens || TOL.mc || TOL.inv); TOL.tabL = 'list'; renderTolL(); renderTolRes(); toast('Liste détaillée créée depuis les valeurs par défaut'); }
    if (a === 'tlauto') { commit(s => { tolCfg().list = null; }); TOL.stale = !!(TOL.sens || TOL.mc || TOL.inv); renderTolL(); renderTolRes(); }
    if (a === 'tldel') { const i = +b.dataset.i; tolEditList(L => L.splice(i, 1)); }
    if (a === 'tladd') { const ty = $('#tlType').value, j = parseInt($('#tlJ').value), N = App.sys.surfaces.length - 1; if (!(j >= 1 && j < N)) { toast('Surface invalide'); return; }
      if (!OE.tolApplicable(App.sys.surfaces, ty, j, tolCfg().comp)) toast('Attention : cette tolérance ne s\'applique pas à cette surface (elle sera ignorée)');
      const v = tolCfg().types[ty].v || OE.TOLT[ty].def; tolEditList(L => L.push({ type: ty, j, min: -v, max: v, on: true })); }
    if (a === 'tinvApply' && TOL.inv) { const only = $('#tinvTight')?.checked; const I = TOL.inv;
      tolEditList(L => { for (const r of I.rows) { if (only && !(r.tr < r.it.tol * 0.999)) continue; const e = L.find(x => x.type === r.it.type && x.j === r.it.j); if (e) { e.min = -r.tr; e.max = r.tr; } } }); toast('Tolérances proposées appliquées à la liste détaillée'); }
    if (a === 'tload') tolLoad(b.dataset.k);
    if (a === 'opick') opPicker(b, +b.dataset.i);
    if (a === 'oup' || a === 'odn') { const i = +b.dataset.i, j = a === 'oup' ? i - 1 : i + 1; if (j < 0 || j >= App.sys.merit.ops.length) return; commit(s => { const L = s.merit.ops; [L[i], L[j]] = [L[j], L[i]]; }); openOptim(); }
    if (a === 'obnd') optWriteBounds();
    if (a === 'omfx') exportMerit(b.dataset.k);
    if (a === 'ovset') optSetVars(b.dataset.k);
    if (a === 'odel') { commit(s => s.merit.ops.splice(+b.dataset.i, 1)); openOptim(); }
    if (a === 'run') runOpt();
    if (a === 'glob') runGlobal();
    if (a === 'osol') { const q = (OPT.sols || [])[+b.dataset.i]; if (q) { App.sys = normalize(fromJSON(q.sys)); pushHist(`Solution chargée (${q.m.toExponential(3)})`); refresh(); optLive(); toast('Solution chargée (Ctrl+Z pour revenir)'); } }
    if (a === 'osolclr') { OPT.sols = []; const el = $('#osols'); if (el) el.innerHTML = optSolsHTML(); }
    if (a === 'oqf') quickFocusUI();
    if (a === 'ovclear') { commit(s => s.surfaces.forEach(x => { x.vr = x.vt = x.vk = x.vg = false; for (const k of OE.ASPK) x['v' + k] = false; })); OPT.x0 = null; openOptim(); }
    if (a === 'gsub') runSubst();
    if (a === 'grgla') { commit(s => { s.merit.ops.push({ type: 'RGLA', target: 0, weight: 0.002, cmp: 'le' }); }); openOptim(); }
    if (a === 'stop') { OPT.running = false; bgCancel('optg'); }
    if (a === 'revert') { if (OPT.snap) { OPT.running = false; App.sys = fromJSON(OPT.snap); pushHist('Retour à l\'état d\'avant l\'optimisation'); refresh(); OPT.x0 = optSnapVars(App.sys); toast('État initial restauré'); openOptim(); } }
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
  OPT.snap = toJSON(App.sys); OPT.x0 = optSnapVars(App.sys); OPT.st = { sys: structuredClone(App.sys), mu: 1e-3, central: !!OPT.central }; OPT.it = 0; OPT.running = true;
  const maxIt = OPT.maxIt = (OPT.cyc || 'auto') === 'auto' ? 500 : Math.max(1, +OPT.cyc || 100);
  $('#omsg').textContent = 'Optimisation en cours…';
  let lastPane = 0;
  const loop = () => {
    if (!OPT.running) { finish('Arrêté'); return; }
    const t = performance.now(); let r;
    do { r = OE.optStep(OPT.st); OPT.it++; if (r.merit != null) OPT.hist.push(r.merit); } while (!r.done && OPT.it < maxIt && performance.now() - t < 90);
    App.sys = OPT.st.sys; App.M = OE.prepare(App.sys); App.sysKey = null; renderLDE(); renderSide(); drawLayout();
    if (performance.now() - lastPane > 600) { renderPanes(); lastPane = performance.now(); }
    if ($('#mval')) { optLive(); $('#mit').textContent = `itération ${OPT.it}`; }
    if (r.done || OPT.it >= maxIt) { OPT.running = false; finish(r.msg || (OPT.it >= maxIt ? ((OPT.cyc || 'auto') === 'auto' ? 'Nombre max d\'itérations atteint' : `${maxIt} cycle(s) effectué(s)`) : 'Convergé')); return; }
    setTimeout(loop, 0);
  };
  const finish = (msg) => { pushHist('Optimisation (' + msg + ')'); refresh({ fast: true }); optLive(); const o = $('#omsg'); if (o) o.textContent = msg + ` — ${OPT.it} itérations`; toast('Optimisation : ' + msg); };
  setTimeout(loop, 0);
}
/** recherche globale : perturbations aléatoires des variables + moindres carrés, on garde le meilleur (type « Hammer ») */
/** perturbation aléatoire des variables (amplitude relative amp) */
function optPerturb(s, amp) {
  for (const v of OE.getVars(s)) { const g = 2 * Math.random() - 1, x = OE.getVal(s, v), o = s.surfaces[v.si];
    if (v.kind === 'nd' || v.kind === 'vd') { const m = OE.parseModel(o.glass); if (m) { m[v.kind] += v.kind === 'nd' ? amp * g * 0.3 : amp * g * 40; o.glass = OE.fmtModel(Math.min(2.2, Math.max(1.35, m.nd)), Math.min(100, Math.max(15, m.vd))); } continue; }
    const nx = v.kind === 'c' || v.kind === 'cx' ? x * (1 + amp * g) + (Math.abs(x) < 1e-6 ? amp * g * 0.01 : 0) : v.kind === 't' ? Math.sign(x || 1) * Math.max(0.05, Math.abs(x) * (1 + amp * g)) : v.kind === 'k' ? x + amp * g * 2 : x * (1 + amp * g) + (Math.abs(x) < 1e-12 ? amp * g * 1e-6 : 0);
    OE.setVal(s, v, nx); }
  return s;
}
/** meilleures solutions distinctes trouvées par la recherche globale */
function optKeep(sys, m, tag) {
  if (!isFinite(m)) return; const L = OPT.sols = OPT.sols || [];
  if (L.some(q => Math.abs(q.m - m) <= 1e-6 * Math.max(m, 1e-12))) return;
  L.push({ m, sys: toJSON(sys), tag, t: new Date().toLocaleTimeString('fr-FR') }); L.sort((a, b) => a.m - b.m); L.length = Math.min(L.length, 12);
  const el = $('#osols'); if (el) el.innerHTML = optSolsHTML();
}
function optSolsHTML() {
  const L = OPT.sols || []; if (!L.length) return '<div class="hint">Lancez une recherche globale : les 12 meilleures solutions distinctes s\'affichent ici et peuvent être rechargées.</div>';
  return L.map((q, k) => `<div class="osol"><b>${k + 1}</b><span class="mono">${q.m.toExponential(4)}</span><span class="hint grow">${esc(q.tag)} · ${q.t}</span><button class="bt" data-d="osol" data-i="${k}" style="height:22px" title="Charger cette solution dans l'éditeur (Ctrl+Z pour revenir)">Charger</button></div>`).join('') + '<div class="row"><button class="bt" data-d="osolclr" style="height:22px">Effacer la liste</button></div>';
}
/**
 * Recherche globale, essais calculés en parallèle dans les workers :
 *  hammer : perturbation du meilleur point, gardé s'il s'améliore ;
 *  anneal : recuit simulé (on accepte parfois un point moins bon, température décroissante) ;
 *  multi  : départs multiples, perturbations fortes du point de départ.
 */
async function runGlobal() {
  if (OPT.running) return; const vars = OE.getVars(App.sys);
  if (!vars.length) { $('#omsg').textContent = 'Définissez au moins une variable (bouton V).'; return; }
  const mode = OPT.gMode = ($('#gMode') && $('#gMode').value) || OPT.gMode || 'hammer';
  const cyc = OPT.gCyc = Math.max(1, Math.min(500, parseInt($('#gCyc').value) || 10)), amp = (OPT.gAmp = Math.max(1, Math.min(100, parseFloat(String($('#gAmp').value).replace(',', '.')) || 20))) / 100, maxIt = (OPT.cyc || 'auto') === 'auto' ? 100 : Math.max(5, Math.min(200, +OPT.cyc || 100));
  OPT.snap = toJSON(App.sys); OPT.x0 = optSnapVars(App.sys); OPT.running = true; OPT.it = 0;
  const msg = t => { if ($('#omsg')) $('#omsg').textContent = t; };
  const local = (sys, tag) => runJob('optLocal', { sys, maxIt, central: !!OPT.central }, { group: 'optg' }).then(r => { OPT.it += r.it; optKeep(r.sys, r.merit, tag); return r; });
  try {
    msg('Recherche globale : optimisation locale du point de départ…');
    const r0 = await local(structuredClone(App.sys), 'départ');
    let best = r0.sys, bm = r0.merit, cur = r0.sys, cm = r0.merit, improved = 0, done = 0; const start = r0.sys;
    OPT.hist.push(bm); App.sys = structuredClone(best); App.M = OE.prepare(App.sys); App.sysKey = null; renderLDE(); drawLayout(); optLive();
    const B = BG.ok === false ? 1 : bgMax(), T0 = 0.3;
    while (done < cyc && OPT.running) {
      const nb = Math.min(B, cyc - done), temp = T0 * (1 - done / cyc);
      const base = mode === 'anneal' ? cur : mode === 'multi' ? start : best, a = mode === 'multi' ? Math.min(1, amp * 2.5) : mode === 'anneal' ? amp * (0.4 + 0.6 * (1 - done / cyc)) : amp;
      const res = await Promise.all(Array.from({ length: nb }, (_, k) => local(optPerturb(structuredClone(base), a), `${({ hammer: 'perturbation', anneal: 'recuit', multi: 'départ' })[mode]} ${done + k + 1}`).catch(e => { if (e && e.cancel) throw e; return null; })));
      for (const r of res) {
        done++; if (!r || !isFinite(r.merit)) continue;
        if (r.merit < bm * (1 - 1e-6)) { bm = r.merit; best = r.sys; improved++; App.sys = structuredClone(best); App.M = OE.prepare(App.sys); App.sysKey = null; renderLDE(); drawLayout(); }
        if (mode === 'anneal') { const d = (r.merit - cm) / Math.max(cm, 1e-15); if (d < 0 || Math.random() < Math.exp(-d / Math.max(temp, 1e-6))) { cur = r.sys; cm = r.merit; } }
      }
      OPT.hist.push(bm); if ($('#mval')) { optLive(); $('#mit').textContent = `essai ${done} / ${cyc}`; }
      msg(`Recherche globale (${({ hammer: 'perturbation du meilleur', anneal: `recuit, T = ${temp.toFixed(3)}`, multi: 'départs multiples' })[mode]}) : ${done} / ${cyc} essais${B > 1 ? ` · ${B} en parallèle` : ''} — ${improved} amélioration(s), meilleur ${bm.toExponential(4)}`);
    }
    App.sys = best; const fin = `Recherche globale terminée — ${improved} amélioration(s), mérite ${bm.toExponential(4)}`; msg(fin); toast(fin);
  } catch (e) { if (!(e && e.cancel)) { console.error(e); msg('Erreur : ' + e.message); } else msg('Recherche globale arrêtée — meilleure solution gardée'); }
  OPT.running = false; pushHist('Recherche globale'); refresh({ fast: true }); optLive();
}
/** libellé de la sélection de longueurs d'onde du quick focus */
function qfWlLabel() { const s = App.sys, k = App.qf.wl, W = s.wavelengths; if (k === 'all') return 'toutes les λ'; const i = OE.wlSel(s, k)[0]; return `${k === 'central' ? 'λ centrale' : k === 'primary' ? 'λ primaire' : 'λ' + (i + 1)} ${fmt(W[i].um * 1000, 5)} nm`; }
/** Quick focus : ajuste l'épaisseur avant l'image au meilleur foyer (critère et λ choisis dans ▾) */
function quickFocusUI() {
  if (!App.M || !App.M.ok) return toast('Système invalide');
  const N = App.sys.surfaces.length - 1, had = App.sys.surfaces[N - 1].tsolve === 'M', q = OE.quickFocus(App.sys, App.qf), u = q.kind === 'WFE' ? 'λ' : 'µm', k = 1;
  if (!isFinite(q.t)) return toast('Quick focus impossible (système invalide)');
  commit(s => { const x = s.surfaces[q.j]; x.t = q.t; x.tsolve = ''; });
  toast(`Quick focus (${q.kind === 'WFE' ? 'front d\'onde' : 'spot'} RMS, ${qfWlLabel()}) : Δ ${q.dt >= 0 ? '+' : ''}${fx(q.dt * 1e3, 1)} µm · ${fx(q.before * k, 3)} → ${fx(q.after * k, 3)} ${u}${had ? ` · solve M de S${q.j} retiré` : ''}`, 4500);
  if ($('#ovars')) optLive();
}
/** menu des options du quick focus */
function qfMenu(btn) {
  let m = $('#qfm'); if (!m) { m = document.createElement('div'); m.id = 'qfm'; m.className = 'menu ctx'; document.body.appendChild(m);
    m.addEventListener('click', e => { const b = e.target.closest('[data-qf]'); if (!b) return; const [k, v] = b.dataset.qf.split(':'); if (k === 'go') { m.classList.remove('open'); quickFocusUI(); return; } App.qf[k] = k === 'wl' && /^\d+$/.test(v) ? +v : v; save(); qfMenu(btn); });
    window.addEventListener('mousedown', e => { if (!e.target.closest('#qfm') && !e.target.closest('[data-act="qfopt"]')) m.classList.remove('open'); }, true); }
  const s = App.sys, W = s.wavelengths, cen = OE.wlSel(s, 'central')[0], it = (key, l, on) => `<button data-qf="${key}">${on ? '● ' : '○ '}${l}</button>`;
  m.innerHTML = `<div class="hint" style="padding:4px 10px">Critère</div>${it('crit:SPOT', 'Spot RMS (barycentre)', App.qf.crit !== 'WFE')}${it('crit:WFE', 'Front d\'onde RMS', App.qf.crit === 'WFE')}<hr>
    <div class="hint" style="padding:4px 10px">Longueur d'onde</div>${it('wl:central', `Centrale (${fmt(W[cen].um * 1000, 5)} nm)`, App.qf.wl === 'central')}${it('wl:primary', `Primaire (${fmt(W[s.primary | 0].um * 1000, 5)} nm)`, App.qf.wl === 'primary')}${it('wl:all', 'Toutes (pondérées)', App.qf.wl === 'all')}
    ${W.map((w, i) => it('wl:' + i, `λ${i + 1} = ${fmt(w.um * 1000, 5)} nm`, App.qf.wl === i)).join('')}<hr><button data-qf="go:1"><b>⌖ Mettre au point</b><span class="kb">Ctrl+Maj+F</span></button>`;
  m.classList.add('open'); const r = btn.getBoundingClientRect(); m.style.left = '0px'; m.style.top = '0px'; const mr = m.getBoundingClientRect();
  m.style.left = Math.min(r.left, innerWidth - mr.width - 6) + 'px'; m.style.top = Math.min(r.bottom + 4, innerHeight - mr.height - 6) + 'px';
}
function drawMerit() {
  const cv = $('#mchart'); if (!cv) return; readTheme(); const { c, w, h } = prepCanvas(cv);
  const H = OPT.hist.filter(isFinite); if (H.length < 1) return;
  const ly = H.map(v => Math.log10(Math.max(v, 1e-12)));
  const A = axes(c, { x: 0, y: 0, w, h }, [0, Math.max(1, H.length - 1)], range([ly], 0.1), { ml: 36, mb: 18, title: 'log₁₀(mérite)' });
  pline(c, A, ly.map((_, i) => i), ly, TH.acc, 2);
}

/* ---------------- Tolérancement ---------------- */
const TOL = { running: false, sens: null, inv: null, mc: null, stale: false, tabL: 'set', tabR: 'sens' };
const tick = () => new Promise(r => setTimeout(r, 0));
/* ---------------- Aperçu des PDF (rapports, plans) avant téléchargement ---------------- */
const PV = { doc: null, bytes: null, name: '', imgs: null, zoom: 'fit', obs: null };
async function previewPDF(doc, bytes, name, title) {
  PV.doc = doc; PV.bytes = bytes; PV.name = name; PV.imgs = null;
  let el = $('#pvw');
  if (!el) {
    el = document.createElement('div'); el.id = 'pvw'; el.className = 'pvw'; document.body.appendChild(el);
    el.addEventListener('click', e => { const b = e.target.closest('[data-pv]'); if (!b) return; const a = b.dataset.pv;
      if (a === 'close') pvClose(); if (a === 'dl') pvDownload(); if (a === 'zin' || a === 'zout') { const z = PV.zoom === 'fit' ? 1 : PV.zoom; PV.zoom = Math.max(0.5, Math.min(3, z * (a === 'zin' ? 1.25 : 0.8))); pvLayout(); } if (a === 'fit') { PV.zoom = 'fit'; pvLayout(); } });
    window.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#pvw') && $('#pvw').classList.contains('open')) { e.stopPropagation(); pvClose(); } }, true);
    new ResizeObserver(() => { if (el.classList.contains('open') && PV.zoom === 'fit') pvLayout(); }).observe(el);
  }
  const n = doc.pages.length;
  el.innerHTML = `<div class="pvh"><b>Aperçu</b><span class="hint grow" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(title || name)} · ${n} page${n > 1 ? 's' : ''} · ${Math.round(bytes.length / 1024)} Ko</span>
    <span class="hint" id="pvpg"></span><button class="bt" data-pv="zout" title="Réduire">−</button><button class="bt" data-pv="fit" title="Ajuster à la largeur">Ajuster</button><button class="bt" data-pv="zin" title="Agrandir">+</button>
    <button class="tb pri" data-pv="dl" title="Télécharger ce PDF">⤓ Télécharger le PDF</button><button class="x" data-pv="close" title="Fermer l'aperçu (Échap)">✕</button></div>
    <div class="pvb" id="pvb">${Array.from({ length: n }, (_, k) => `<div class="pvp" data-k="${k}"><canvas></canvas><span class="pvn">${k + 1} / ${n}</span></div>`).join('')}</div>`;
  el.classList.add('open');
  PV.imgs = await PDF.decodeImages(doc);
  if (PV.doc !== doc) return;
  if (PV.obs) PV.obs.disconnect();
  PV.obs = new IntersectionObserver(es => { for (const e of es) if (e.isIntersecting) { pvDraw(+e.target.dataset.k); const pg = $('#pvpg'); if (pg) pg.textContent = `page ${+e.target.dataset.k + 1}`; } }, { root: $('#pvb'), rootMargin: '400px 0px' });
  $$('#pvb .pvp').forEach(p => PV.obs.observe(p));
  pvLayout();
}
function pvScale() { const b = $('#pvb'); const wFit = Math.max(200, Math.min(900, (b ? b.clientWidth : 800) - 40)); return (PV.zoom === 'fit' ? wFit : 700 * PV.zoom) / PDF.W; }
function pvLayout() { const s = pvScale(); $$('#pvb .pvp').forEach(p => { p.style.width = Math.round(PDF.W * s) + 'px'; p.style.height = Math.round(PDF.H * s) + 'px'; p.dataset.done = ''; }); $$('#pvb .pvp').forEach(p => { const r = p.getBoundingClientRect(), br = $('#pvb').getBoundingClientRect(); if (r.bottom > br.top - 400 && r.top < br.bottom + 400) pvDraw(+p.dataset.k); }); }
function pvDraw(k) {
  const p = $(`#pvb .pvp[data-k="${k}"]`); if (!p || !PV.doc) return; const s = pvScale(), key = String(s); if (p.dataset.done === key) return; p.dataset.done = key;
  const cv = p.querySelector('canvas'), d = window.devicePixelRatio || 1; cv.width = Math.round(PDF.W * s * d); cv.height = Math.round(PDF.H * s * d); cv.style.width = Math.round(PDF.W * s) + 'px'; cv.style.height = Math.round(PDF.H * s) + 'px';
  try { PDF.renderPage(PV.doc, k, cv.getContext('2d'), s * d, PV.imgs); } catch (e) { console.error(e); }
}
function pvClose() { const el = $('#pvw'); if (el) el.classList.remove('open'); if (PV.obs) PV.obs.disconnect(); }
async function pvDownload() {
  if (!PV.bytes) return; await download(PV.name, new Blob([PV.bytes], { type: 'application/pdf' }));
}
/* ---------------- Multi-configuration (zoom) ---------------- */
const mcName = (s, k) => (s.mc && s.mc.names && s.mc.names[k]) || `Config ${k + 1}`;
function mcGo(k) {
  const s = App.sys; if (!OE.mcOn(s)) return; const n = s.mc.n;
  if (k === 'prev') k = ((s.mc.cur | 0) - 1 + n) % n; else if (k === 'next') k = ((s.mc.cur | 0) + 1) % n;
  commit(x => OE.mcSet(x, +k), { fast: true });
}
function renderMCBar() {
  const el = $('#mcbar'); if (!el) return; const s = App.sys;
  if (!OE.mcOn(s)) { el.innerHTML = ''; el.style.display = 'none'; return; }
  el.style.display = ''; const cur = s.mc.cur | 0;
  el.innerHTML = `<button class="tb" data-mcgo="prev" title="Configuration précédente (Ctrl+Maj+Page préc.)">◀</button><select data-mcsel title="Configuration active (multi-configuration)">${Array.from({ length: s.mc.n }, (_, k) => `<option value="${k}" ${k === cur ? 'selected' : ''}>${esc(mcName(s, k))} (${k + 1}/${s.mc.n})</option>`).join('')}</select><button class="tb" data-mcgo="next" title="Configuration suivante (Ctrl+Maj+Page suiv.)">▶</button>`;
}
function openMC() { dlg(`<h2>Multi-configuration <button class="x" data-d="close">✕</button></h2><div class="db" id="mcw"></div>`, true, { w: 900, h: 560 }); renderMC(); }
function renderMC() {
  const el = $('#mcw'); if (!el) return; const s = App.sys, mc = s.mc || { n: 1, cur: 0, ops: [] }, n = mc.n, cur = mc.cur | 0;
  const nS = s.surfaces.length - 1, T = OE.MCT;
  const idxOpts = (type, i) => { const D = T[type]; let L = [];
    if (D.s) L = s.surfaces.map((x, j) => [j, `S${j}${x.comment ? ' · ' + x.comment : ''}`]).filter(([j]) => j > 0 && (type !== 'THI' || j < nS) || (type === 'THI' && j === 0));
    else if (D.f) L = s.fields.map((_, j) => [j, `Champ ${j + 1}`]); else if (D.w) L = s.wavelengths.map((w, j) => [j, `λ${j + 1} (${fmt(w.um * 1000, 5)} nm)`]); else return '<span class="hint">—</span>';
    return `<select data-mca="i" data-mco="__O__">${L.map(([j, l]) => `<option value="${j}" ${j === i ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`; };
  const typeSel = (t, o) => `<select data-mca="type" data-mco="${o}">${Object.entries(T).map(([k, d]) => `<option value="${k}" ${k === t ? 'selected' : ''}>${esc(d.l)}${d.u ? ' (' + d.u + ')' : ''}</option>`).join('')}</select>`;
  const cell = (op, oi, k) => { const D = T[op.type], v = op.v ? op.v[k] : '', vs = v === Infinity ? 'Infini' : v == null ? '' : D.num ? fmt(+v, 8) : String(v);
    return `<td style="${k === cur ? 'background:var(--sel)' : ''}"><div style="display:flex;gap:3px;align-items:center"><input class="in" data-mcv="${oi}" data-k="${k}" value="${esc(vs)}" style="flex:1;min-width:62px">${D.var ? `<label title="Variable d'optimisation pour cette configuration" style="font-size:10px;display:inline-flex;align-items:center;white-space:nowrap"><input type="checkbox" data-mcvv="${oi}" data-k="${k}" ${op.vv && op.vv[k] ? 'checked' : ''}>V</label>` : ''}</div></td>`; };
  el.innerHTML = `<div class="row" style="gap:8px;flex-wrap:wrap;align-items:center">
      <b>${n} configuration${n > 1 ? 's' : ''}</b><button class="bt" data-mcact="addcfg" title="Ajoute une configuration, copie de la configuration active">+ Configuration</button>
      <button class="bt" data-mcact="delcfg" ${n < 2 ? 'disabled' : ''} title="Supprime la configuration active">− Supprimer la config. active</button>
      <span class="grow"></span><label title="La fonction de mérite additionne les résidus de toutes les configurations (zoom optimisé d'un seul tenant)"><input type="radio" name="mco" data-mcopt="all" ${mc.opt !== 'cur' ? 'checked' : ''}> optimiser toutes les configurations</label><label><input type="radio" name="mco" data-mcopt="cur" ${mc.opt === 'cur' ? 'checked' : ''}> la configuration active seulement</label></div>
    <div style="overflow:auto;margin-top:8px"><table class="mct" style="width:100%"><tr><th style="text-align:left">Paramètre</th><th style="text-align:left">Élément</th>${Array.from({ length: n }, (_, k) => `<th style="${k === cur ? 'background:var(--sel)' : ''}"><input class="in" data-mcn="${k}" value="${esc(mcName(s, k))}" style="width:100%;font-weight:600;text-align:center" title="Nom de la configuration"><button class="bt" data-mcgo="${k}" style="height:20px;margin-top:2px;width:100%" ${k === cur ? 'disabled' : ''}>${k === cur ? 'active' : 'activer'}</button></th>`).join('')}<th></th></tr>
      ${mc.ops.map((op, oi) => `<tr><td>${typeSel(op.type, oi)}</td><td>${idxOpts(op.type, op.i).replace('__O__', oi)}</td>${Array.from({ length: n }, (_, k) => cell(op, oi, k)).join('')}<td><button class="x" data-mcact="delop" data-mco="${oi}" title="Supprimer la ligne">✕</button></td></tr>`).join('')}
      <tr><td colspan="${n + 3}"><button class="bt" data-mcact="addop" title="Ajoute un paramètre qui change d'une configuration à l'autre">+ Paramètre</button> <button class="bt" data-mcact="addvar" title="Ajoute les épaisseurs marquées V dans l'éditeur de lentilles (typique d'un zoom : espaces entre groupes)">+ Épaisseurs variables (V) de l'éditeur</button></td></tr></table></div>
    <p class="hint" style="margin-top:10px">Chaque ligne est un paramètre qui prend une valeur par configuration (zoom, mise au point, changement de filtre ou de longueur d'onde, température…). L'éditeur de lentilles, le layout et les analyses montrent toujours la <b>configuration active</b> ; une valeur modifiée dans l'éditeur est enregistrée dans cette configuration. Cochez <b>V</b> pour rendre une valeur variable dans une configuration donnée ; l'optimiseur additionne alors les fonctions de mérite de toutes les configurations (un opérande peut être réservé à une configuration, colonne « Config. » de la fonction de mérite). Le tolérancement porte sur la configuration active.</p>`;
}
function mcNum(raw) { const t = String(raw).trim().replace(',', '.'); if (/^inf/i.test(t)) return Infinity; const v = parseFloat(t); return isFinite(v) ? v : null; }
function mcEvent(e) {
  const t = e.target, s0 = App.sys, cur = s0.mc ? s0.mc.cur | 0 : 0;
  if (t.dataset.mcv != null) { const oi = +t.dataset.mcv, k = +t.dataset.k, op = s0.mc.ops[oi], D = OE.MCT[op.type], v = D.num ? mcNum(t.value) : t.value.trim();
    if (D.num && v == null) { toast('Valeur invalide'); renderMC(); return; }
    commit(s => { OE.mcSync(s); const o = s.mc.ops[oi]; o.v[k] = v; if (k === (s.mc.cur | 0)) D.set(s, o.i, v); }); return; }
  if (t.dataset.mcvv != null) { const oi = +t.dataset.mcvv, k = +t.dataset.k; commit(s => { const o = s.mc.ops[oi]; o.vv = o.vv || []; while (o.vv.length < s.mc.n) o.vv.push(false); o.vv[k] = t.checked; }); return; }
  if (t.dataset.mcn != null) { const k = +t.dataset.mcn; commit(s => { s.mc.names = s.mc.names || []; s.mc.names[k] = t.value.trim(); }); return; }
  if (t.dataset.mcopt) { commit(s => { s.mc.opt = t.dataset.mcopt; }); return; }
  if (t.dataset.mca) { const oi = +t.dataset.mco; commit(s => { OE.mcSync(s); const o = s.mc.ops[oi]; if (t.dataset.mca === 'type') { o.type = t.value; const D = OE.MCT[o.type]; if (D.s && !(o.i > 0)) o.i = 1; if ((D.f && o.i >= s.fields.length) || (D.w && o.i >= s.wavelengths.length)) o.i = 0; if (!D.var) delete o.vv; } else o.i = +t.value;
    if (o.type === 'THI' && s.surfaces[o.i] && s.surfaces[o.i].tsolve) { const M = OE.prepare(s); if (M.ok) s.surfaces[o.i].t = M.S[o.i].t; s.surfaces[o.i].tsolve = ''; }
    const v = OE.MCT[o.type].get(s, o.i); o.v = Array.from({ length: s.mc.n }, () => v); }); return; }
}
function mcAction(b) {
  const a = b.dataset.mcact, nS = App.sys.surfaces.length - 1;
  if (a === 'addcfg') commit(s => { if (!s.mc) s.mc = { n: 1, cur: 0, ops: [], names: [] }; OE.mcSync(s); const c = s.mc.cur | 0; s.mc.ops.forEach(o => { o.v.push(o.v[c]); if (o.vv) o.vv.push(false); }); s.mc.names = s.mc.names || []; s.mc.names[s.mc.n] = ''; s.mc.n++; OE.mcLoad(s, s.mc.n - 1); });
  if (a === 'delcfg') commit(s => { if (!s.mc || s.mc.n < 2) return; const k = s.mc.cur | 0; s.mc.ops.forEach(o => { o.v.splice(k, 1); if (o.vv) o.vv.splice(k, 1); }); if (s.mc.names) s.mc.names.splice(k, 1); s.mc.n--; OE.mcLoad(s, Math.min(k, s.mc.n - 1)); if (s.mc.n === 1 && !s.mc.ops.length) delete s.mc; });
  if (a === 'addop') commit(s => { if (!s.mc) s.mc = { n: 1, cur: 0, ops: [], names: [] }; OE.mcSync(s); OE.mcAddOp(s, 'THI', Math.max(1, Math.min(nS - 1, App.sel))); });
  if (a === 'addvar') { let k = 0; commit(s => { if (!s.mc) s.mc = { n: 1, cur: 0, ops: [], names: [] }; OE.mcSync(s); s.surfaces.forEach((x, j) => { if (x.vt && !s.mc.ops.some(o => o.type === 'THI' && o.i === j)) { const o = OE.mcAddOp(s, 'THI', j); o.vv = Array.from({ length: s.mc.n }, () => true); x.vt = false; k++; } }); }); toast(k ? `${k} épaisseur(s) ajoutée(s), variables dans chaque configuration` : 'Aucune épaisseur marquée V dans l\'éditeur'); }
  if (a === 'delop') { const oi = +b.dataset.mco; commit(s => { s.mc.ops.splice(oi, 1); if (s.mc.n === 1 && !s.mc.ops.length) delete s.mc; }); }
}
/* ---------------- Calculs en tâche de fond (Web Workers, repli dans la page) ----------------
   runJob(nom, args, { group, key, want, onProg, onPart }) → Promise ; les tâches sont définies dans jobs.js (JOBS).
   Les workers sont créés à partir du code source des scripts de la page (moteur + verres + tâches). */
const BG = { workers: [], queue: [], seq: 0, ok: null, url: null, mainBusy: false, prog: new Map(), done: 0 };
const bgMax = () => Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1));
function bgSource() {
  const t = id => (document.getElementById(id) || {}).textContent || '';
  return [t('js-glasses'), t('js-glassth'), t('js-glassprop'), t('js-engine'), t('js-jobs')].join('\n;\n') + `
;self.onmessage = async e => { const m = e.data; if (m.ping) { self.postMessage({ pong: 1 }); return; }
  try { if (m.ug && m.ug.length) OE.addGlasses(m.ug, true); const r = await JOBS[m.name](m.args, (d, n, part) => { self.postMessage({ id: m.id, prog: [d, n], part }); }); self.postMessage({ id: m.id, res: r }); }
  catch (err) { self.postMessage({ id: m.id, err: String(err && err.message || err) }); } };`;
}
/** verres utilisateur (AGF, saisis) à transmettre au worker */
function bgGlasses(sys) {
  const out = [], seen = new Set();
  for (const x of (sys && sys.surfaces) || []) { const r = OE.glassRecord(x.glass); if (r && r.user && !seen.has(r.key)) { seen.add(r.key); try { const c = structuredClone({ ...r }); delete c.ndv; out.push(c); } catch (e) { } } }
  return out;
}
function bgSpawn() {
  try {
    if (!BG.url) BG.url = URL.createObjectURL(new Blob([bgSource()], { type: 'text/javascript' }));
    const w = new Worker(BG.url), W = { w, job: null };
    w.onmessage = e => bgMsg(W, e.data);
    w.onerror = e => { if (e.preventDefault) e.preventDefault(); bgFail(W, e.message || 'erreur du worker'); };
    BG.workers.push(W);
    if (BG.ok === null && !BG.pinging) { BG.pinging = true; w.postMessage({ ping: 1 }); BG.pingT = setTimeout(() => { if (BG.ok === null) bgDisable(); }, 5000); }
    return W;
  } catch (e) { bgDisable(); return null; }
}
/** workers indisponibles (politique de sécurité de l'hébergeur…) : tout est calculé dans la page */
function bgDisable() {
  if (BG.ok === false) return; BG.ok = false; clearTimeout(BG.pingT);
  for (const W of BG.workers) { try { W.w.terminate(); } catch (e) { } if (W.job) BG.queue.unshift(W.job); }
  BG.workers = []; bgPump();
}
function bgMsg(W, m) {
  if (m.pong) { BG.ok = true; clearTimeout(BG.pingT); bgPump(); return; }
  const j = W.job; if (!j || m.id !== j.id) return;
  if (m.prog) { BG.prog.set(j.id, m.prog); if (j.onProg) j.onProg(m.prog[0], m.prog[1]); if (m.part && j.onPart) j.onPart(m.part); bgStatus(); return; }
  W.job = null; BG.prog.delete(j.id); BG.done++;
  if (m.err) j.reject(new Error(m.err)); else j.resolve(m.res);
  bgPump();
}
function bgFail(W, msg) {
  if (BG.ok !== true) { bgDisable(); return; }
  const j = W.job; W.job = null; try { W.w.terminate(); } catch (e) { } BG.workers = BG.workers.filter(x => x !== W);
  if (j) { BG.prog.delete(j.id); j.reject(new Error(msg)); }
  bgPump();
}
async function bgMain(j) {
  BG.mainBusy = true; BG.mainJob = j; bgStatus(); let t = performance.now();
  try {
    const r = await JOBS[j.name](j.args, async (d, n, part) => {
      if (j.cancelled) throw Object.assign(new Error('annulé'), { cancel: true });
      BG.prog.set(j.id, [d, n]); if (j.onProg) j.onProg(d, n); if (part && j.onPart) j.onPart(part);
      if (performance.now() - t > 60) { bgStatus(); await tick(); t = performance.now(); }
    });
    if (j.cancelled) throw Object.assign(new Error('annulé'), { cancel: true });
    j.resolve(r);
  } catch (e) { j.reject(e); }
  finally { BG.prog.delete(j.id); BG.mainBusy = false; BG.mainJob = null; BG.done++; bgPump(); }
}
function bgPump() {
  for (;;) {
    // tâches devenues inutiles (panneau changé entre-temps)
    while (BG.queue.length && BG.queue[0].want && !BG.queue[0].want()) { const j = BG.queue.shift(); j.reject(Object.assign(new Error('obsolète'), { stale: true })); }
    if (!BG.queue.length) break;
    if (BG.ok === false) { if (BG.mainBusy) break; bgMain(BG.queue.shift()); break; }
    let W = BG.workers.find(x => !x.job);
    if (!W && (BG.workers.length < (BG.ok ? bgMax() : 1))) W = bgSpawn();
    if (BG.ok !== true || !W) break;
    const j = BG.queue.shift(); W.job = j; j.started = true;
    W.w.postMessage({ id: j.id, name: j.name, args: j.args, ug: j.ug });
  }
  bgStatus();
}
function runJob(name, args, o = {}) {
  return new Promise((resolve, reject) => {
    const j = { id: ++BG.seq, name, args, ug: bgGlasses(args.sys || (args.B && args.B.base)), resolve, reject, ...o };
    BG.queue.push(j); bgPump();
  });
}
/** annule les tâches d'un groupe (en attente, dans les workers et dans la page) */
function bgCancel(group) {
  const err = () => Object.assign(new Error('annulé'), { cancel: true });
  BG.queue = BG.queue.filter(j => { if (j.group === group) { j.reject(err()); return false; } return true; });
  for (const W of [...BG.workers]) if (W.job && W.job.group === group) { const j = W.job; try { W.w.terminate(); } catch (e) { } BG.workers = BG.workers.filter(x => x !== W); BG.prog.delete(j.id); j.reject(err()); }
  if (BG.mainJob && BG.mainJob.group === group) BG.mainJob.cancelled = true; // arrêt au prochain point d'avancement
  bgPump();
}
function bgStatus() {
  const el = document.getElementById('bgst'); if (!el) return;
  const run = BG.workers.filter(W => W.job).length + (BG.mainBusy ? 1 : 0), n = run + BG.queue.length;
  if (!n) { el.innerHTML = ''; el.title = ''; return; }
  const pr = [...BG.prog.values()], pc = pr.length ? Math.round(100 * pr.reduce((a, q) => a + q[0] / Math.max(1, q[1]), 0) / pr.length) : 0;
  el.innerHTML = `<span class="bgspin"></span> ${n} calcul${n > 1 ? 's' : ''} <span class="k">${pc} %</span>`;
  el.title = BG.ok === false ? 'Calculs dans la page (Web Workers indisponibles ici)' : `Calculs en tâche de fond : ${run} en cours sur ${BG.workers.length} worker(s), ${BG.queue.length} en attente`;
}
/* --- analyses calculées en tâche de fond : PT[type].job(p, M) → { name, args, key } ; résultats en cache --- */
const JCACHE = new Map();
const sysKey = () => App.sysKey || (App.sysKey = toJSON(App.sys));
function jobSpec(p, M) { const J = PT[p.type].job(p, M); J.key = J.name + '|' + JSON.stringify(J.args.o || {}) + '|' + sysKey(); J.args.sys = J.args.sys || App.sys; return J; }
function paneWants(key) { return $$('.pane[data-i]').some(d => { const p = App.panes[+d.dataset.i]; return p && PT[p.type] && PT[p.type].job && App.M && App.M.ok && jobSpec(p, App.M).key === key; }); }
function rerenderKey(key) { $$('.pane[data-i]').forEach(d => { const pi = +d.dataset.i, p = App.panes[pi]; if (p && PT[p.type] && PT[p.type].job && App.M && App.M.ok && jobSpec(p, App.M).key === key) renderPane(pi); }); }
/** données d'une analyse : le résultat (ou { err }) s'il est en cache, sinon undefined et lancement du calcul */
function paneData(p, M) {
  const J = jobSpec(p, M);
  if (JCACHE.has(J.key)) return JCACHE.get(J.key);
  if (!BG.pend) BG.pend = new Map();
  if (!BG.pend.has(J.key)) {
    const key = J.key; BG.pend.set(key, 0);
    runJob(J.name, J.args, { key, group: 'pane', want: () => paneWants(key), onProg: (d, n) => { BG.pend.set(key, d / Math.max(1, n)); drawWaitKey(key); } })
      .then(r => { JCACHE.set(key, r); }, e => { if (!e.stale && !e.cancel) JCACHE.set(key, { err: e.message }); })
      .finally(() => { BG.pend.delete(key); while (JCACHE.size > 40) JCACHE.delete(JCACHE.keys().next().value); rerenderKey(key); });
  }
  return undefined;
}
function drawWait(p, c, w, h, frac) {
  c.clearRect(0, 0, w, h);
  text(c, PT[p.type].l, 10, 8, { b: true });
  const bw = Math.min(260, w - 40), x = (w - bw) / 2, y = h / 2;
  text(c, `Calcul en tâche de fond… ${Math.round(100 * (frac || 0))} %`, w / 2, y - 22, { align: 'center', col: TH.mut });
  c.fillStyle = TH.line; c.fillRect(x, y, bw, 6); c.fillStyle = TH.acc; c.fillRect(x, y, bw * Math.min(1, frac || 0), 6);
  text(c, BG.ok === false ? 'calcul dans la page' : 'l\'interface reste utilisable pendant le calcul', w / 2, y + 14, { align: 'center', col: TH.mut, size: 10 });
}
function drawWaitKey(key) {
  $$('.pane[data-i]').forEach(d => { const p = App.panes[+d.dataset.i]; if (p && PT[p.type] && PT[p.type].job && App.M && App.M.ok && jobSpec(p, App.M).key === key) { const cv = d.querySelector('canvas'); const { c, w, h } = prepCanvas(cv); drawWait(p, c, w, h, BG.pend.get(key)); } });
}
function tolCfg() {
  const d = OE.tolDefaults(), s = App.sys; s.tol = { ...d, ...(s.tol || {}) };
  s.tol.types = Object.fromEntries(Object.keys(d.types).map(k => [k, { ...d.types[k], ...((s.tol.types || {})[k] || {}) }]));
  return s.tol;
}
const tolUnit = k => (OE.TOLC[k] || OE.TOLC.WFE).unit;
const tolCritLabel = c => c.crit === 'MTF' ? `FTM moyenne T/S à ${fmt(+c.mtfF || 30, 4)} cycles/mm` : c.crit === 'SPOT' ? 'spot RMS (µm)' : 'front d\'onde RMS (λ)';
const tolOpts = c => ({ mtfF: +c.mtfF || 30, vars: !!c.compVars, it: Math.max(1, Math.min(10, +c.compIt || 3)) });
const tolCompLabel = c => [c.comp ? 'mise au point' : '', c.compVars ? `variables de l'optimiseur (${OE.getVars(App.sys).length})` : ''].filter(Boolean).join(' + ') || 'aucun';
/** liste détaillée : celle de l'utilisateur, sinon générée depuis les valeurs par défaut */
const tolList = c => Array.isArray(c.list) ? c.list : OE.tolGen(App.sys, c);
const fxT = (v, u) => u === '%' || u === 'fr' ? fmt(v, 4) : fmt(v, 4);
function openTol() {
  tolCfg();
  dlg(`<h2>Tolérancement <button class="x" data-d="close">✕</button></h2>
  <div class="db"><div class="tolg">
    <div class="tolL"><div class="seg tseg">${[['set', 'Réglages'], ['list', 'Liste détaillée'], ['mcs', 'Monte-Carlo']].map(([k, l]) => `<button data-tl="${k}" class="${TOL.tabL === k ? 'on' : ''}">${l}</button>`).join('')}</div><div id="tolL"></div></div>
    <div class="tolR"><div class="seg tseg">${[['sens', 'Sensibilité'], ['inv', 'Tolérances inverses'], ['mc', 'Monte-Carlo']].map(([k, l]) => `<button data-tr="${k}" class="${TOL.tabR === k ? 'on' : ''}">${l}</button>`).join('')}</div><div id="tolres"></div></div>
  </div></div>
  <div class="df"><span class="hint grow" id="tmsg"></span><button class="bt" data-d="tcopy" title="Copie le rapport (CSV) dans le presse-papiers">Exporter CSV</button><button class="bt" data-d="tstop">Arrêter</button><button class="bt" data-d="tsens">Sensibilité</button><button class="bt" data-d="tinv">Calcul inverse</button><button class="tb pri" data-d="tmc">▶ Monte-Carlo</button></div>`, true, { w: 1180, h: 760 });
  renderTolL(); renderTolRes();
}
function renderTolL() {
  const el = $('#tolL'); if (!el) return; const c = tolCfg(), T = OE.TOLT, nv = OE.getVars(App.sys).length;
  $$('#dlg [data-tl]').forEach(b => b.classList.toggle('on', b.dataset.tl === TOL.tabL));
  if (TOL.tabL === 'set') {
    const custom = Array.isArray(c.list);
    el.innerHTML = `<div class="row"><label style="width:96px">Critère</label><select class="in grow" data-t="crit">${Object.entries(OE.TOLC).map(([k, v]) => `<option value="${k}" ${c.crit === k ? 'selected' : ''}>${v.label}${v.unit ? ` (${v.unit})` : ''}</option>`).join('')}</select></div>
      ${c.crit === 'MTF' ? `<div class="row"><label style="width:96px">Fréquence</label><input class="in mini" data-t="mtfF" value="${c.mtfF}"><span class="hint">cycles/mm${App.sys.det && App.sys.det.on ? ` · Nyquist détecteur ${fmt(1000 / (2 * App.sys.det.p), 4)}` : ''}</span></div>` : ''}
      <h4 class="th4">Compensateurs</h4>
      <label class="ck"><input type="checkbox" data-t="comp" ${c.comp ? 'checked' : ''}> Mise au point (épaisseur avant l'image)</label>
      <label class="ck" title="${nv ? 'Les paramètres marqués V dans l\'éditeur sont réajustés (moindres carrés amortis) pour chaque système perturbé' : 'Marquez des paramètres avec V dans l\'éditeur de lentilles pour les utiliser comme compensateurs'}"><input type="checkbox" data-t="compVars" ${c.compVars ? 'checked' : ''} ${nv ? '' : 'disabled'}> Variables de l'optimiseur (${nv})</label>
      ${c.compVars && nv ? `<div class="row" style="padding-left:22px"><label>Itérations par évaluation</label><input class="in mini" data-t="compIt" value="${c.compIt}"></div>` : ''}
      <h4 class="th4">Valeurs par défaut</h4>
      <table class="mt"><tr><th></th><th>Tolérance</th><th>±</th><th></th></tr>${Object.entries(T).map(([k, v]) => `<tr><td><input type="checkbox" data-t="on" data-k="${k}" ${c.types[k].on ? 'checked' : ''}></td><td title="${esc(v.desc || '')}">${v.label} <span class="hint">${k}</span></td><td><input class="in" style="width:70px" data-t="v" data-k="${k}" value="${c.types[k].v}"></td><td class="hint">${v.unit}</td></tr>`).join('')}</table>
      <div class="hint" style="margin-top:6px">${custom ? '<b>Liste détaillée personnalisée</b> : ces valeurs ne s\'y appliquent qu\'en la régénérant.' : 'La liste détaillée suit automatiquement ces valeurs tant que vous ne la modifiez pas.'}</div>
      <div class="row"><button class="bt" data-d="tgen">${custom ? 'Régénérer la liste depuis ces valeurs' : 'Personnaliser la liste…'}</button></div>
      <div class="hint">Franges à λ = 632,8 nm sur l'ouverture utile de chaque surface. Rayon en %, épaisseurs et décentrements en mm, bascules en degrés ; les bascules d'élément pivotent autour du sommet de sa première surface.</div>`;
  } else if (TOL.tabL === 'list') {
    const L = tolList(c), custom = Array.isArray(c.list), N = App.sys.surfaces.length - 1;
    const bad = L.filter(it => !OE.tolApplicable(App.sys.surfaces, it.type, it.j, c.comp)).length;
    el.innerHTML = `<div class="hint" style="margin-bottom:4px">${L.filter(i => i.on !== false).length} actives / ${L.length} · ${custom ? 'liste <b>personnalisée</b>' : 'liste <b>automatique</b> (une modification la rend personnalisée)'}${bad ? ` · <span style="color:var(--warn)">${bad} ne s'appliquent plus (ignorées)</span>` : ''}</div>
      <div style="max-height:calc(100% - 92px);overflow:auto;border:1px solid var(--line);border-radius:8px"><table class="mt tlist"><tr><th></th><th>Tolérance</th><th>Min</th><th>Max</th><th></th><th></th></tr>
      ${L.map((it, i) => { const t = T[it.type] || { label: it.type, unit: '' }, ok = OE.tolApplicable(App.sys.surfaces, it.type, it.j, c.comp); return `<tr class="${ok ? '' : 'off'}"><td><input type="checkbox" data-li="${i}" data-lk="on" ${it.on !== false ? 'checked' : ''}></td><td title="${esc(t.desc || '')}">${esc(OE.tolLabel(it.type, it.j))}</td><td><input class="in" data-li="${i}" data-lk="min" value="${fmt(it.min, 5)}"></td><td><input class="in" data-li="${i}" data-lk="max" value="${fmt(it.max, 5)}"></td><td class="hint">${t.unit}</td><td><button class="x" data-d="tldel" data-i="${i}" title="Supprimer">✕</button></td></tr>`; }).join('')}</table></div>
      <div class="row" style="margin-top:6px"><select class="in" id="tlType">${Object.entries(T).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}</select><span class="hint">surface</span><input class="in" id="tlJ" style="width:48px" value="${Math.min(Math.max(1, App.sel), N - 1)}"><button class="bt" data-d="tladd">+ Ajouter</button>${custom ? '<button class="bt" data-d="tlauto" title="Revenir à la liste générée automatiquement">Liste automatique</button>' : ''}</div>`;
  } else {
    el.innerHTML = `<div class="row"><label style="width:120px">Tirages</label><input class="in mini" data-t="trials" value="${c.trials}"></div>
      <div class="row"><label style="width:120px">Distribution</label><select class="in grow" data-t="dist">${[['normal', 'Gaussienne (σ = demi-intervalle / 2, tronquée)'], ['uniform', 'Uniforme'], ['para', 'Parabolique (extrêmes favorisés)'], ['end', 'Extrêmes seulement (min ou max)']].map(([k, l]) => `<option value="${k}" ${c.dist === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="row"><label style="width:120px">Graine</label><input class="in mini" data-t="seed" value="${esc(String(c.seed ?? ''))}" placeholder="aléatoire"><span class="hint">même graine = mêmes tirages</span></div>
      <div class="row"><label style="width:120px">Spécification</label><input class="in mini" data-t="spec" value="${c.spec ?? ''}" placeholder="—"><span class="hint">${OE.TOLC[c.crit].up ? 'FTM minimale' : 'valeur maximale'} ${tolUnit(c.crit)} → rendement</span></div>
      <div class="hint" style="margin-top:8px">Chaque tirage perturbe <b>simultanément</b> toutes les tolérances actives de la liste détaillée (valeur tirée entre min et max), puis réajuste les compensateurs. La distribution parabolique (p ∝ x²) représente une fabrication qui tend vers les limites de tolérance ; « extrêmes seulement » donne un cas défavorable.</div>`;
  }
}
function tolMsg(t) { const e = $('#tmsg'); if (e) e.textContent = t; }
/** fige la liste détaillée (passe en mode personnalisé) puis applique fn */
function tolEditList(fn) { commit(s => { const c = tolCfg(); if (!Array.isArray(c.list)) c.list = OE.tolGen(s, c).map(x => ({ ...x })); fn(c.list, c); }); TOL.stale = !!(TOL.sens || TOL.mc || TOL.inv); renderTolL(); renderTolRes(); }
/** découpe [0, n) en lots pour les workers (équilibrage : ~3 lots par worker) */
function tolChunks(n) { const w = BG.ok === false ? 1 : bgMax(), k = Math.max(1, Math.min(n, w * 3)), out = []; for (let i = 0; i < k; i++) { const a = Math.floor(i * n / k), b = Math.floor((i + 1) * n / k); if (b > a) out.push([a, b]); } return out; }
const tolErr = e => { if (!e || !e.cancel) { console.error(e); tolMsg('Erreur : ' + (e && e.message)); } };
async function tolPrep(c) {
  tolMsg('Préparation (système nominal' + (c.comp ? ', mise au point' : '') + ')…');
  const B = await runJob('tolBase', { sys: App.sys, crit: c.crit, comp: c.comp, o: tolOpts(c) }, { group: 'tol' });
  return { B, items: OE.tolItems(B.base, c) };
}
/** exécute une tâche de tolérancement répartie sur les workers ; onPart(k, r) à chaque élément terminé */
async function tolRun(name, n, mk, onPart, label) {
  let done = 0, tl = 0; const t0 = performance.now();
  await Promise.all(tolChunks(n).map(([a, b]) => runJob(name, mk(a, b), { group: 'tol', onPart: p => { done++; onPart(p.k, p.r);
    if (performance.now() - tl > 150) { tl = performance.now(); renderTolRes(); const el = (performance.now() - t0) / 1000; tolMsg(`${label} : ${done} / ${n} · reste ≈ ${Math.ceil(el / done * (n - done))} s${BG.ok ? ` · ${BG.workers.length} calcul(s) en parallèle` : ''}`); } } })));
}
async function runSens() {
  if (TOL.running) return; const c = structuredClone(tolCfg()); TOL.running = true; TOL.stale = false; TOL.tabR = 'sens';
  try {
    const { B, items } = await tolPrep(c), o = tolOpts(c), arr = new Array(items.length);
    TOL.sens = { B, rows: [], c, n: items.length, items };
    await tolRun('tolSens', items.length, (a, b) => ({ B, items: items.slice(a, b), k0: a, crit: c.crit, comp: c.comp, o }), (k, r) => { arr[k] = r; TOL.sens.rows = arr.filter(Boolean); }, 'Sensibilité');
    tolMsg(`Sensibilité terminée — ${TOL.sens.rows.length} tolérances`);
  } catch (e) { tolErr(e); if (e && e.cancel) tolMsg(`Arrêté — ${TOL.sens ? TOL.sens.rows.length : 0} tolérances calculées`); }
  TOL.running = false; renderTolRes();
}
/** dégradation admissible par tolérance pour le calcul inverse */
function tolDmax(c, nominal, n) {
  const v = +c.invVal; if (!isFinite(v) || v <= 0) return NaN;
  if (c.invMode === 'item') return v;
  const room = OE.tolWorse(c.crit, v, nominal); return room > 0 ? room / Math.sqrt(Math.max(1, n)) : NaN;
}
async function runInv() {
  if (TOL.running) return; const c = structuredClone(tolCfg()); TOL.tabR = 'inv'; renderTolRes();
  if (!(+c.invVal > 0)) { tolMsg('Indiquez d\'abord la cible du calcul inverse (onglet « Tolérances inverses »).'); return; }
  TOL.running = true; TOL.stale = false;
  try {
    const { B, items } = await tolPrep(c), o = tolOpts(c), dmax = tolDmax(c, B.nominal, items.length);
    if (!(dmax > 0)) { TOL.running = false; tolMsg(`Cible inatteignable : le nominal (${fx(B.nominal, 4)} ${tolUnit(c.crit)}) est déjà ${OE.TOLC[c.crit].up ? 'sous' : 'au-dessus de'} la cible.`); return; }
    const S = TOL.sens && !TOL.stale && TOL.sens.c.crit === c.crit && TOL.sens.c.comp === c.comp ? TOL.sens : null, arr = new Array(items.length);
    const d0 = items.map(it => { const sr = S && S.rows.find(r => r.it.type === it.type && r.it.j === it.j && r.it.tol === it.tol); return sr && sr.lo && sr.hi && Math.abs(it.min + it.max) < 1e-12 ? Math.max(sr.lo.d, sr.hi.d) : undefined; });
    TOL.inv = { B, rows: [], c, dmax, n: items.length };
    await tolRun('tolInv', items.length, (a, b) => ({ B, items: items.slice(a, b), d0: d0.slice(a, b), k0: a, crit: c.crit, comp: c.comp, dmax, o }),
      (k, r) => { arr[k] = { it: items[k], t: r.t, tr: c.invRound ? OE.niceDown(r.t) : r.t, d: r.d, capped: r.capped }; TOL.inv.rows = arr.filter(Boolean); }, 'Calcul inverse');
    tolMsg(`Calcul inverse terminé — Δ admissible ${fx(dmax, 4)} ${tolUnit(c.crit)} par tolérance`);
  } catch (e) { tolErr(e); if (e && e.cancel) tolMsg('Arrêté'); }
  TOL.running = false; renderTolRes();
}
async function runMC() {
  if (TOL.running) return; const c = structuredClone(tolCfg()); TOL.running = true; TOL.stale = false; TOL.tabR = 'mc';
  try {
    const { B, items } = await tolPrep(c), n = Math.max(5, Math.min(5000, +c.trials || 200)), o = tolOpts(c);
    const sd = String(c.seed ?? '').trim(), rnd = sd !== '' ? OE.rng(parseInt(sd, 10) || [...sd].reduce((a, ch) => a * 31 + ch.charCodeAt(0) >>> 0, 7)) : Math.random;
    // tirages générés ici, dans l'ordre : même graine = mêmes systèmes, quel que soit le nombre de workers
    const D = Array.from({ length: n }, () => items.map(it => OE.tolValue(it, OE.tolDraw(c.dist, rnd))));
    const vals = [], foc = [], bore = [], draws = []; TOL.mc = { B, vals, foc, bore, draws, c, n, items };
    await tolRun('tolMC', n, (a, b) => ({ B, items, draws: D.slice(a, b), k0: a, crit: c.crit, comp: c.comp, o }),
      (k, r) => { if (isFinite(r.c)) { vals.push(r.c); foc.push(r.dt); bore.push(r.bore); draws.push(Float64Array.from(D[k])); } }, 'Monte-Carlo');
    tolMsg(`Monte-Carlo terminé — ${vals.length} tirages`);
  } catch (e) { tolErr(e); if (e && e.cancel) tolMsg(`Arrêté — ${TOL.mc ? TOL.mc.vals.length : 0} tirages`); }
  TOL.running = false; renderTolRes();
}
const pct = (arr, q) => { if (!arr.length) return NaN; const a = arr.slice().sort((x, y) => x - y), i = Math.min(a.length - 1, Math.max(0, q * (a.length - 1))), lo = Math.floor(i), f = i - lo; return a[lo] * (1 - f) + (a[lo + 1] ?? a[lo]) * f; };
/** statistiques Monte-Carlo ; « q » = centile dans le sens « pire » (FTM : centiles bas) */
function mcStats(MC) {
  const v = MC.vals, up = !!OE.TOLC[MC.c.crit].up, n = v.length || 1, mean = v.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, n - 1));
  const q = p => pct(v, up ? 1 - p : p), spec = MC.c.spec !== '' && MC.c.spec != null && isFinite(+MC.c.spec) ? +MC.c.spec : null;
  const yieldP = spec == null ? null : v.filter(x => up ? x >= spec : x <= spec).length / n;
  const order = v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]), worst = (up ? order[0] : order[order.length - 1])?.[1], best = (up ? order[order.length - 1] : order[0])?.[1], med = order[Math.floor(order.length / 2)]?.[1];
  return { mean, sd, q, spec, yieldP, worst, best, med, up, min: Math.min(...v), max: Math.max(...v) };
}
/** contributions estimées au Monte-Carlo : R² de la régression du critère sur le carré de la valeur tirée (normalisée) */
function mcContrib(MC) {
  const v = MC.vals, n = v.length; if (n < 20) return [];
  const mv = v.reduce((a, b) => a + b, 0) / n, sv = Math.sqrt(v.reduce((a, b) => a + (b - mv) ** 2, 0)); if (!(sv > 0)) return [];
  return MC.items.map((it, k) => {
    const x = MC.draws.map(d => { const u = (d[k] - (it.min + it.max) / 2) / ((it.max - it.min) / 2 || 1); return u * u; }), mx = x.reduce((a, b) => a + b, 0) / n;
    let sxy = 0, sxx = 0; x.forEach((xi, i) => { sxy += (xi - mx) * (v[i] - mv); sxx += (xi - mx) ** 2; });
    const r = sxx > 0 ? sxy / Math.sqrt(sxx) / sv : 0; return { it, r2: r * r * Math.sign(r) };
  }).sort((a, b) => b.r2 - a.r2);
}
function renderTolRes() {
  const el = $('#tolres'); if (!el) return;
  $$('#dlg [data-tr]').forEach(b => b.classList.toggle('on', b.dataset.tr === TOL.tabR));
  let h = TOL.stale ? '<div class="hint" style="color:var(--warn);margin-bottom:6px">Le système ou les réglages ont changé depuis le dernier calcul.</div>' : '';
  const cfg = tolCfg(), mono = 'font-family:var(--mono)';
  if (TOL.tabR === 'sens') {
    const S = TOL.sens;
    if (!S) h += `<div class="hint" style="padding:24px 0">L'<b>analyse de sensibilité</b> applique chaque tolérance seule, à sa valeur min puis max, réajuste les compensateurs et mesure la dégradation du critère. Elle identifie les tolérances critiques et donne une estimation RSS de la performance de fabrication.</div>`;
    else {
      const u = tolUnit(S.c.crit), rows = S.rows.map(r => ({ ...r, w: Math.max(r.lo ? r.lo.d : -Infinity, r.hi ? r.hi.d : -Infinity), b: Math.max(r.lo ? r.lo.bore : 0, r.hi ? r.hi.bore : 0) }));
      const rss = Math.sqrt(rows.reduce((a, r) => a + Math.max(0, r.w) ** 2, 0)), est = OE.TOLC[S.c.crit].up ? S.B.nominal - rss : S.B.nominal + rss;
      const top = rows.slice().sort((a, b) => b.w - a.w), mx = Math.max(1e-12, ...top.map(r => Math.abs(r.w))), cum = []; let acc = 0; top.forEach(r => { acc += Math.max(0, r.w) ** 2; cum.push(rss > 0 ? acc / (rss * rss) : 0); });
      h += `<div class="tkpi"><div><div class="hint">Nominal${S.c.comp || S.c.compVars ? ' (compensé)' : ''}</div><div class="big">${fx(S.B.nominal, 4)} ${u}</div></div><div><div class="hint">Estimation RSS</div><div class="big">${fx(est, 4)} ${u}</div></div><div><div class="hint">Dégradation RSS</div><div class="big">${fx(rss, 4)} ${u}</div></div>${S.c.comp ? `<div><div class="hint">Mise au point nominale</div><div class="big">${fx(S.B.focus * 1e3, 1)} µm</div></div>` : ''}</div>
      <div class="hint">Critère : ${tolCritLabel(S.c)} · compensateurs : ${tolCompLabel(S.c)} · ${rows.length}/${S.n} tolérances, triées par dégradation (> 0 = pire) · <b>cumul</b> = part de la dégradation RSS expliquée</div>
      <div class="tscroll"><table class="mt" style="font-size:12px"><tr><th>Tolérance</th><th>Min</th><th>Max</th><th>Δ (min)</th><th>Δ (max)</th><th style="width:96px"></th><th>Cumul</th><th title="Déplacement du rayon principal du 1er champ sur l'image">Visée (µm)</th>${S.c.comp ? '<th>Foyer (µm)</th>' : ''}</tr>
      ${top.map((r, i) => `<tr><td>${esc(r.it.label)}</td><td style="${mono}">${fmt(r.it.min, 4)}</td><td style="${mono}">${fmt(r.it.max, 4)}</td><td style="${mono}">${r.lo ? fx(r.lo.d, 4) : '—'}</td><td style="${mono}">${r.hi ? fx(r.hi.d, 4) : '—'}</td><td><div style="height:7px;border-radius:3px;background:${r.w > 0 ? '#ea580c' : '#16a34a'};width:${Math.max(2, Math.abs(r.w) / mx * 92)}px"></div></td><td style="${mono}">${fx(100 * cum[i], 0)} %</td><td style="${mono}">${fx(r.b * 1e3, 1)}</td>${S.c.comp ? `<td style="${mono}">${r.lo ? fx(r.lo.dt * 1e3, 0) : '—'} / ${r.hi ? fx(r.hi.dt * 1e3, 0) : '—'}</td>` : ''}</tr>`).join('')}</table></div>`;
    }
  } else if (TOL.tabR === 'inv') {
    const up = !!OE.TOLC[cfg.crit].up;
    h += `<div class="row" style="flex-wrap:wrap"><select class="in" data-t="invMode"><option value="budget" ${cfg.invMode !== 'item' ? 'selected' : ''}>Budget : critère visé après fabrication</option><option value="item" ${cfg.invMode === 'item' ? 'selected' : ''}>Dégradation max par tolérance</option></select>
      <input class="in mini" data-t="invVal" value="${cfg.invVal ?? ''}" placeholder="${cfg.invMode === 'item' ? 'Δ' : up ? 'FTM min' : 'cible'}"><span class="hint">${tolUnit(cfg.crit)}</span>
      <label class="ck"><input type="checkbox" data-t="invRound" ${cfg.invRound ? 'checked' : ''}> arrondir (1 · 1,5 · 2 · 2,5 · 3 · 4 · 5 · 6 · 8)</label></div>
      <div class="hint">${cfg.invMode === 'item' ? 'Chaque tolérance est calculée pour dégrader le critère de Δ au plus (pire des deux signes).' : `La marge entre le nominal et la cible est répartie également en RSS : Δ par tolérance = |cible − nominal| / √n.`} Le calcul suppose des tolérances symétriques (±) ; il réutilise l'analyse de sensibilité si elle est à jour.</div>`;
    const I = TOL.inv;
    if (I) {
      const u = tolUnit(I.c.crit), loose = I.rows.filter(r => r.tr < r.it.tol * 0.999).length;
      h += `<div class="tkpi" style="margin-top:8px"><div><div class="hint">Nominal</div><div class="big">${fx(I.B.nominal, 4)} ${u}</div></div><div><div class="hint">Δ admissible / tolérance</div><div class="big">${fx(I.dmax, 4)} ${u}</div></div><div><div class="hint">Trop larges actuellement</div><div class="big" style="color:${loose ? '#ea580c' : 'inherit'}">${loose} / ${I.rows.length}</div></div></div>
      <div class="tscroll"><table class="mt" style="font-size:12px"><tr><th>Tolérance</th><th>Actuelle</th><th>Calculée</th><th>Proposée</th><th>Δ obtenu</th><th></th></tr>
      ${I.rows.map(r => { const tight = r.tr < r.it.tol * 0.999, un = OE.TOLT[r.it.type].unit; return `<tr><td>${esc(r.it.label)}</td><td style="${mono}">±${fmt(r.it.tol, 4)} ${un}</td><td style="${mono}">${r.capped ? '> ' : ''}±${fmt(r.t, 4)}</td><td style="${mono};font-weight:600;color:${tight ? '#ea580c' : '#16a34a'}">±${fmt(r.tr, 3)}</td><td style="${mono}">${fx(r.d, 4)}</td><td class="hint">${r.capped ? 'peu sensible' : tight ? 'à resserrer' : 'peut être élargie'}</td></tr>`; }).join('')}</table></div>
      <div class="row" style="margin-top:6px"><button class="bt" data-d="tinvApply">Appliquer les valeurs proposées à la liste détaillée</button><label class="ck"><input type="checkbox" id="tinvTight"> seulement celles à resserrer</label></div>`;
    } else h += `<div class="hint" style="padding:18px 0">Le <b>calcul inverse</b> détermine, pour chaque tolérance, la valeur maximale compatible avec une dégradation donnée (Zemax « Inverse Limit »). Indiquez la cible puis cliquez sur « Calcul inverse ».</div>`;
  } else {
    const MC = TOL.mc;
    if (!MC) h += `<div class="hint" style="padding:24px 0">Le <b>Monte-Carlo</b> fabrique virtuellement des centaines de systèmes en tirant au hasard toutes les tolérances à la fois, puis réajuste les compensateurs. On obtient la distribution réelle de la performance et, avec une spécification, le <b>rendement</b> de fabrication.</div>`;
    else if (MC.vals.length) {
      const u = tolUnit(MC.c.crit), st = mcStats(MC), up = st.up, ctb = mcContrib(MC).slice(0, 8), bmean = MC.bore.reduce((a, b) => a + b, 0) / MC.bore.length;
      h += `<div class="tkpi"><div><div class="hint">Tirages</div><div class="big">${MC.vals.length} / ${MC.n}</div></div><div><div class="hint">Nominal</div><div class="big">${fx(MC.B.nominal, 4)} ${u}</div></div><div><div class="hint">Moyenne ± σ</div><div class="big">${fx(st.mean, 4)} ± ${fx(st.sd, 3)}</div></div>${st.yieldP != null ? `<div><div class="hint">Rendement (${up ? '≥' : '≤'} ${fmt(st.spec, 4)} ${u})</div><div class="big" style="color:${st.yieldP >= 0.9 ? '#16a34a' : st.yieldP >= 0.7 ? '#d97706' : '#dc2626'}">${fx(100 * st.yieldP, 1)} %</div></div>` : ''}</div>
      <div style="display:flex;gap:14px;align-items:stretch;margin-top:6px;flex-wrap:wrap"><div style="flex:1 1 380px;min-width:0;height:230px;position:relative"><canvas id="mcchart"></canvas></div>
      <table class="mt" style="width:auto;${mono};font-size:12px"><tr><th>${up ? 'Au moins' : 'Au plus'}…</th><th>${u}</th></tr>
      ${[0.5, 0.8, 0.9, 0.95, 0.98].map(p => `<tr><td>${p * 100} % des systèmes</td><td>${fx(st.q(p), 4)}</td></tr>`).join('')}
      <tr><td>Meilleur / pire</td><td>${fx(up ? st.max : st.min, 4)} / ${fx(up ? st.min : st.max, 4)}</td></tr>${MC.c.comp ? `<tr><td>Course de mise au point</td><td>${fx(Math.min(...MC.foc) * 1e3, 0)} … ${fx(Math.max(...MC.foc) * 1e3, 0)} µm</td></tr>` : ''}
      <tr><td>Dérive de visée</td><td>moy. ${fx(bmean * 1e3, 1)} · max ${fx(Math.max(...MC.bore) * 1e3, 1)} µm</td></tr></table></div>
      <div class="row" style="margin-top:6px;flex-wrap:wrap"><span class="hint">Charger dans l'éditeur (Ctrl+Z pour revenir) :</span><button class="bt" data-d="tload" data-k="worst">Pire tirage</button><button class="bt" data-d="tload" data-k="med">Tirage médian</button><button class="bt" data-d="tload" data-k="best">Meilleur tirage</button></div>
      ${ctb.length ? `<div class="hint" style="margin-top:8px">Principaux contributeurs (corrélation du critère avec l'écart tiré, R² signé ; indicatif, il faut assez de tirages)</div><table class="mt" style="font-size:12px">${ctb.map(o => `<tr><td>${esc(o.it.label)}</td><td style="width:130px"><div style="height:7px;border-radius:3px;background:#ea580c;width:${Math.max(2, Math.max(0, o.r2) / Math.max(1e-9, ctb[0].r2) * 120)}px"></div></td><td style="${mono};width:60px">${fx(o.r2, 2)}</td></tr>`).join('')}</table>` : ''}`;
    }
  }
  el.innerHTML = h;
  if (TOL.tabR === 'mc' && TOL.mc && TOL.mc.vals.length) drawMC();
}
/** histogramme + fonction de répartition (%) + nominal + spécification */
function drawMC(tgt) {
  const cv = $('#mcchart'); if (!cv && !tgt) return; readTheme(); const { c, w, h } = tgt || prepCanvas(cv), MC = TOL.mc, v = MC.vals.slice().sort((a, b) => a - b), st = mcStats(MC);
  let lo = Math.min(MC.B.nominal, v[0], st.spec ?? Infinity), hi = Math.max(v[v.length - 1], MC.B.nominal, st.spec ?? -Infinity); const pad = (hi - lo) * 0.04 || 1e-6; lo -= pad; hi += pad;
  const nb = Math.max(8, Math.min(40, Math.round(Math.sqrt(v.length) * 1.5))), bw = (hi - lo) / nb;
  const bins = new Array(nb).fill(0); for (const x of v) bins[Math.min(nb - 1, Math.max(0, Math.floor((x - lo) / bw)))]++;
  const mb = Math.max(...bins) * 1.1;
  const A = axes(c, { x: 0, y: 0, w: w - 34, h }, [lo, hi], [0, mb], { xl: `${OE.TOLC[MC.c.crit].label}${tolUnit(MC.c.crit) ? ' (' + tolUnit(MC.c.crit) + ')' : ''}`, yl: 'tirages', ml: 40, mb: 30, title: ' ' });
  c.fillStyle = TH.acc; c.globalAlpha = 0.5; bins.forEach((b, i) => { const x0 = A.X(lo + i * bw), x1 = A.X(lo + (i + 1) * bw); c.fillRect(x0 + 0.5, A.Y(b), x1 - x0 - 1, A.Y(0) - A.Y(b)); }); c.globalAlpha = 1;
  // fonction de répartition (axe de droite, %)
  const Yp = p => A.P.y + A.P.h * (1 - p);
  c.strokeStyle = '#ea580c'; c.lineWidth = 1.8; c.beginPath(); v.forEach((x, i) => { const px = A.X(x), py = Yp((i + 1) / v.length); i ? c.lineTo(px, py) : c.moveTo(px, py); }); c.stroke();
  for (const p of [0, 0.5, 1]) text(c, `${p * 100} %`, A.P.x + A.P.w + 4, Yp(p) - 5, { col: '#ea580c', size: 9.5 });
  c.strokeStyle = TH.fg; c.setLineDash([3, 3]); c.beginPath(); c.moveTo(A.X(MC.B.nominal), A.P.y); c.lineTo(A.X(MC.B.nominal), A.P.y + A.P.h); c.stroke(); c.setLineDash([]);
  if (st.spec != null) { c.strokeStyle = '#dc2626'; c.lineWidth = 2; c.beginPath(); c.moveTo(A.X(st.spec), A.P.y); c.lineTo(A.X(st.spec), A.P.y + A.P.h); c.stroke(); }
  legend(c, A.P.x, A.P.y - 11, [{ col: TH.acc, l: 'histogramme' }, { col: '#ea580c', l: 'cumul (%)' }, { col: TH.fg, dash: [3, 3], l: 'nominal' }, ...(st.spec != null ? [{ col: '#dc2626', l: 'spécification' }] : [])]);
}
function tolReport() {
  const L = [`Focale — rapport de tolérancement — ${App.sys.title || ''}`], f = v => isFinite(v) ? (+v).toPrecision(6) : '';
  if (TOL.sens) { const S = TOL.sens; L.push('', `Critère;${tolCritLabel(S.c)}`, `Compensateurs;${tolCompLabel(S.c)}`, `Nominal;${f(S.B.nominal)}`, '', 'Sensibilité', 'Tolérance;Type;Surface;Min;Max;Unité;Δ(min);Δ(max);Visée max (µm);Foyer min (µm);Foyer max (µm)');
    S.rows.forEach(r => L.push([r.it.label, r.it.type, r.it.j, r.it.min, r.it.max, OE.TOLT[r.it.type].unit, f(r.lo?.d), f(r.hi?.d), f(1e3 * Math.max(r.lo?.bore || 0, r.hi?.bore || 0)), f(1e3 * r.lo?.dt), f(1e3 * r.hi?.dt)].join(';'))); }
  if (TOL.inv) { const I = TOL.inv; L.push('', `Tolérances inverses;Δ admissible ${f(I.dmax)}`, 'Tolérance;Actuelle;Calculée;Proposée;Δ obtenu'); I.rows.forEach(r => L.push([r.it.label, r.it.tol, f(r.t), r.tr, f(r.d)].join(';'))); }
  if (TOL.mc && TOL.mc.vals.length) { const M = TOL.mc, st = mcStats(M); L.push('', `Monte-Carlo;${M.vals.length} tirages;distribution ${M.c.dist}${M.c.seed !== '' ? `;graine ${M.c.seed}` : ''}`, `Moyenne;${f(st.mean)}`, `Écart-type;${f(st.sd)}`);
    [0.5, 0.8, 0.9, 0.95, 0.98].forEach(p => L.push(`${p * 100} %;${f(st.q(p))}`)); if (st.yieldP != null) L.push(`Rendement (spéc. ${st.spec});${(100 * st.yieldP).toFixed(1)} %`);
    L.push('', 'Tirages', ['#', 'Critère', 'Foyer (µm)', ...M.items.map(i => i.label)].join(';')); M.vals.forEach((v, k) => L.push([k + 1, f(v), f(1e3 * M.foc[k]), ...Array.from(M.draws[k], x => f(x))].join(';'))); }
  return L.join('\n');
}
/** charge un tirage Monte-Carlo (pire / médian / meilleur) dans l'éditeur */
function tolLoad(k) {
  const MC = TOL.mc; if (!MC) return; const st = mcStats(MC), i = st[k]; if (i == null) return;
  const s = OE.tolRebuild(MC.B, MC.items, MC.draws[i], MC.c.crit, MC.c.comp, tolOpts(MC.c)); s.title = `${App.sys.title || 'Système'} — tirage ${k === 'worst' ? 'le pire' : k === 'best' ? 'le meilleur' : 'médian'} (${fx(MC.vals[i], 4)} ${tolUnit(MC.c.crit)})`;
  s.tol = structuredClone(App.sys.tol); loadSystem(s, 'Tirage chargé (indices et constringences perturbés inclus) — Ctrl+Z pour revenir');
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
  if (dl) download(fileBase() + ext, r.text, 'text/plain');
  if (r.warnings.length) ioReport(`Export ${kind === 'zmx' ? 'Zemax (.zmx)' : 'CODE V (.seq)'}`, r.warnings, dl ? '' : '');
  return r.text;
}
/** exporte la fonction de mérite : CODE V (macro AUT .seq) ou Zemax (tableau de l'éditeur de fonction de mérite, texte tabulé) */
function exportMerit(kind) {
  const r = kind === 'zmx' ? IO.meritToZemax(structuredClone(App.sys)) : IO.meritToCodeV(structuredClone(App.sys));
  download(fileBase() + (kind === 'zmx' ? '_MFE_zemax.txt' : '_AUT.seq'), r.text, 'text/plain');
  if (r.warnings.length) toast(r.warnings.join(' · '), 7000);
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
  <div class="df"><button class="bt" data-d="pick">Choisir un fichier</button><button class="tb pri" data-d="load">Importer</button></div>`);
}
function openHelp(id, anchor) {
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
  show(id);
  if (anchor) { const a = anchor.toLowerCase(), el = [...$$('#hbody td:first-child, #hbody h4, #hbody b')].find(e => e.textContent.trim().toLowerCase().startsWith(a));
    if (el) { const row = el.closest('tr, li') || el; row.scrollIntoView({ block: 'center' }); row.classList.add('hflash'); setTimeout(() => row.classList.remove('hflash'), 2200); } }
  else $('#hq').focus();
}
// bouton d'aide contextuel (fenêtres d'analyse, dialogues, éditeur, layout, panneau système) : section (et repère) de l'aide générale
document.addEventListener('click', e => { const b = e.target.closest('[data-help]'); if (!b) return; e.preventDefault(); e.stopPropagation(); openHelp(b.dataset.help, b.dataset.ha || ''); }, true);
/* ---------------- Fichiers (ouvrir / enregistrer / glisser-déposer) ---------------- */
const FS = { handle: null };
const TOP = (() => { try { return window.top === window; } catch (e) { return false; } })();
const fileBase = () => (App.sys.title || 'systeme').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w\-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'systeme';
function sysJSON() { const s = structuredClone(App.sys); if (typeof usedUserGlasses === 'function') { const u = usedUserGlasses(s); if (Object.keys(u).length) s.userGlass = u; } return toJSON(s); }
/** capacité « downloads » de l'hébergeur claude.ai (null ailleurs) */
const DLCAP = { ns: undefined, p: null };
function dlCap() {
  if (DLCAP.ns !== undefined) return Promise.resolve(DLCAP.ns);
  if (!DLCAP.p) DLCAP.p = (async () => { try { DLCAP.ns = (!TOP && window.claude && typeof window.claude.use === 'function') ? (await window.claude.use('downloads')) || null : null; } catch (e) { DLCAP.ns = null; } return DLCAP.ns; })();
  return DLCAP.p;
}
const DL_OK = /\.(gif|png|jpe?g|webp|mp4|webm|txt|json|md|docx|pptx|epub|csv|html|svg|pdf|xlsx|zip)$/i;
const MIME = { pdf: 'application/pdf', json: 'application/json', csv: 'text/csv', png: 'image/png', svg: 'image/svg+xml', html: 'text/html', txt: 'text/plain', seq: 'text/plain', zmx: 'text/plain', agf: 'text/plain', len: 'text/plain' };
const DLDESC = { pdf: 'Document PDF', json: 'Système Focale', csv: 'Tableau CSV', png: 'Image PNG', seq: 'Fichier CODE V', zmx: 'Fichier Zemax', svg: 'Image SVG', txt: 'Texte' };
const extOf = n => ((/\.([a-z0-9]+)$/i.exec(n) || [])[1] || '').toLowerCase();
/** fenêtre « Enregistrer sous » interne (navigateurs sans sélecteur natif, ou Focale ouvert dans claude.ai) : nom modifiable, extension conservée */
function askSaveName(name) {
  return new Promise(res => {
    const ext = extOf(name), base = ext ? name.slice(0, -ext.length - 1) : name;
    const ov = document.createElement('div'); ov.className = 'svov';
    ov.innerHTML = `<div class="svbox" role="dialog" aria-label="Enregistrer sous"><h3>Enregistrer sous</h3>
      <label>Nom du fichier</label><div class="row" style="gap:4px;align-items:center"><input class="in" id="svName" style="flex:1" spellcheck="false" value="${esc(base)}">${ext ? `<span class="hint">.${esc(ext)}</span>` : ''}</div>
      ${ext ? `<label style="margin-top:8px">Type</label><div>${esc(DLDESC[ext] || 'Fichier ' + ext.toUpperCase())} (*.${esc(ext)})</div>` : ''}
      <div class="hint" style="margin-top:8px">${TOP ? 'Ce navigateur ne permet pas de choisir le dossier depuis la page : le fichier va dans le dossier de téléchargement. Pour choisir l\'emplacement à chaque fois, activez « Demander où enregistrer chaque fichier » dans les réglages de téléchargement du navigateur (Chrome / Edge ouvrent directement l\'explorateur).' : 'Dans claude.ai, le fichier passe par la fenêtre de téléchargement de Claude puis par votre navigateur. Pour choisir le dossier, activez « Demander où enregistrer chaque fichier » dans les réglages du navigateur, ou ouvrez Focale depuis GitHub Pages / l\'application installée (l\'explorateur de fichiers s\'ouvre alors directement).'}</div>
      <div class="row" style="justify-content:flex-end;gap:6px;margin-top:12px"><button class="tb" data-sv="0">Annuler</button><button class="tb pri" data-sv="1">Enregistrer</button></div></div>`;
    document.body.appendChild(ov);
    const inp = ov.querySelector('#svName'); inp.focus(); inp.select();
    const done = ok => { const v = inp.value.trim().replace(/[\\/:*?"<>|]+/g, '_'); ov.remove(); document.removeEventListener('keydown', key, true); res(ok && v ? (ext && !v.toLowerCase().endsWith('.' + ext) ? `${v}.${ext}` : v) : null); };
    const key = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(false); } else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); done(true); } };
    document.addEventListener('keydown', key, true);
    ov.addEventListener('mousedown', e => { if (e.target === ov) done(false); });
    ov.querySelectorAll('[data-sv]').forEach(b => b.onclick = () => done(b.dataset.sv === '1'));
  });
}
/** enregistre un fichier : sélecteur natif (dossier + nom) si disponible, sinon fenêtre « Enregistrer sous » puis téléchargement.
    Renvoie le nom enregistré, ou false si l'utilisateur annule. */
async function download(name, text, type = 'application/json') {
  const ext = extOf(name), b = text instanceof Blob ? text : new Blob([text], { type: MIME[ext] || type });
  if (TOP && window.showSaveFilePicker) {
    try {
      const mime = MIME[ext] && MIME[ext] !== 'text/plain' ? MIME[ext] : 'text/plain';
      const h = await showSaveFilePicker({ suggestedName: name, types: ext ? [{ description: `${DLDESC[ext] || 'Fichier ' + ext.toUpperCase()} (*.${ext})`, accept: { [mime]: ['.' + ext] } }] : undefined });
      const w = await h.createWritable(); await w.write(b); await w.close(); toast('Enregistré : ' + h.name); return h.name;
    } catch (e) { if (e && e.name === 'AbortError') { toast('Enregistrement annulé'); return false; } /* sinon (sécurité, activation perdue…) : fenêtre interne */ }
  }
  const fn0 = await askSaveName(name); if (!fn0) { toast('Enregistrement annulé'); return false; }
  const ns = TOP ? null : await dlCap();
  if (ns) {
    // extensions hors liste (.zmx, .seq, .agf…) : enregistrées en .txt (à renommer)
    const fn = DL_OK.test(fn0) ? fn0 : fn0 + '.txt';
    try { await ns.save({ filename: fn, data: b }); toast(fn !== fn0 ? `Enregistré sous ${fn} : retirez « .txt » pour retrouver ${fn0}` : `${fn} : confirmez dans la fenêtre de Claude`, 5000); return fn; }
    catch (e) { const c = e && e.code; if (c === 'declined') { toast('Téléchargement annulé'); return false; } if (c === 'rate_limited') { toast('Une demande de téléchargement est déjà ouverte'); return false; } }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(b); a.download = fn0; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  toast(`${fn0} téléchargé`); return fn0;
}
async function openFile() {
  if (window.showOpenFilePicker && TOP) {
    try {
      const [h] = await showOpenFilePicker({ types: [{ description: 'Systèmes optiques et catalogues (*.json, *.zmx, *.seq, *.agf, *.txt)', accept: { 'application/json': ['.json'], 'text/plain': ['.zmx', '.seq', '.agf', '.txt'] } }] });
      const f = await h.getFile(); await readAndImport(f); FS.handle = /\.json$/i.test(f.name) ? h : null;
    } catch (e) { if (e.name !== 'AbortError') toast('Ouverture impossible : ' + e.message); }
  } else $('#fileIn').click();
}
async function saveFile(as) {
  const txt = sysJSON();
  if (window.showSaveFilePicker && TOP) {
    try {
      if (!FS.handle || as) FS.handle = await showSaveFilePicker({ suggestedName: fileBase() + '.json', types: [{ description: 'Système Focale (*.json)', accept: { 'application/json': ['.json'] } }] });
      const w = await FS.handle.createWritable(); await w.write(txt); await w.close(); toast('Enregistré : ' + FS.handle.name); return;
    } catch (e) { if (e.name === 'AbortError') return; }
  }
  await download(fileBase() + '.json', txt);
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
/** menus de la barre d'outils : placés en position fixe sous leur bouton (la barre peut défiler horizontalement) */
function placeMenu(m, btn) {
  if (!m.closest('header')) { m.style.left = m.style.top = ''; return; }
  const r = btn.getBoundingClientRect(), w = m.offsetWidth;
  m.style.top = Math.round(r.bottom + 4) + 'px'; m.style.left = Math.round(Math.max(4, Math.min(r.left, innerWidth - w - 6))) + 'px';
}
function init() {
  window.addEventListener('error', e => { if (e && e.message && !/ResizeObserver/.test(e.message)) toast('Erreur : ' + e.message, 6000); });
  window.addEventListener('unhandledrejection', e => { const m = e && e.reason && (e.reason.message || String(e.reason)); if (m && !(e.reason && (e.reason.cancel || e.reason.stale))) toast('Erreur : ' + m, 6000); });
  setTimeout(dlCap, 0);
  document.addEventListener('click', e => { const g = e.target.closest('[data-mcgo]'); if (g && !g.disabled) { const v = g.dataset.mcgo; mcGo(v === 'prev' || v === 'next' ? v : +v); } });
  document.addEventListener('change', e => { if (e.target.matches('[data-mcsel]')) mcGo(+e.target.value); });
  loadStoredAGF(); rebuildGlassList();
  { const cats = SAMPLES._cats || [['Exemples', Object.keys(SAMPLES)]], seen = new Set(cats.flatMap(c => c[1]));
    const rest = Object.keys(SAMPLES).filter(k => !seen.has(k)); if (rest.length) cats.push(['Autres', rest]);
    $('#mSamp').innerHTML = `<button data-act="new" title="Système vide : objet, diaphragme et image, sans lentille">Système vide</button>` + cats.map(([c, ks]) => `<div class="mcat">${esc(c)}</div>` + ks.filter(k => SAMPLES[k]).map(k => `<button data-samp="${esc(k)}" title="${esc(SAMPLES[k]().title || k)}">${esc(k)}</button>`).join('')).join(''); }
  load();
  if (!App.sys) App.sys = normalize(SAMPLES['Triplet de Cooke f=50 F/5']());
  App.showAsph = App.sys.surfaces.some(s => OE.ASPK.some(a => +s[a])); $('#showAsph').checked = App.showAsph;
  setupLDE(); setupSide(); setupLayout(); setupPanes(); setupDlg();
  pushHist('Ouverture de Focale'); buildPanes(); refresh(); applyAsstPref();
  // header
  { const hd = $('header'); if (hd) {
    hd.addEventListener('wheel', e => { if (hd.scrollWidth <= hd.clientWidth + 1 || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; e.preventDefault(); hd.scrollLeft += e.deltaY; }, { passive: false });
    hd.addEventListener('scroll', () => $$('header .menu.open').forEach(m => m.classList.remove('open')));
    window.addEventListener('resize', () => $$('header .menu.open').forEach(m => m.classList.remove('open'))); } }
  document.addEventListener('click', e => {
    const mb = e.target.closest('[data-menu]');
    $$('.menu').forEach(m => { if (!mb || m.id !== mb.dataset.menu) m.classList.remove('open'); });
    if (mb) { const m = $('#' + mb.dataset.menu); m.classList.toggle('open'); if (m.classList.contains('open')) placeMenu(m, mb); return; }
    const sb = e.target.closest('[data-samp]'); if (sb) { loadSystem(SAMPLES[sb.dataset.samp](), 'Exemple chargé'); return; }
    const a = e.target.closest('[data-act]'); if (!a) return;
    switch (a.dataset.act) {
      case 'new': FS.handle = null; loadSystem({ title: 'Nouveau système', aperture: { type: 'EPD', value: 10, obscuration: 0 }, fields: [{ y: 0, w: 1 }, { y: 5, w: 1 }], wavelengths: [{ um: 0.4861327, w: 1 }, { um: 0.5875618, w: 1 }, { um: 0.6562725, w: 1 }], primary: 1, rayAiming: false, merit: { image: 'SPOT', ops: [] },
        surfaces: [newSurf({ t: Infinity, comment: 'Objet' }), newSurf({ t: 10, stop: true, comment: 'Diaphragme' }), newSurf({ t: 0, comment: 'Image' })] }, 'Nouveau système vide : ajoutez des lentilles (+ Lentille) ou partez d\'un exemple'); break;
      case 'import': openImport(); break;
      case 'export': openExport(); break;
      case 'open': openFile(); break;
      case 'save': saveFile(false); break;
      case 'saveAs': saveFile(true); break;
      case 'dlSeq': exportAs('seq'); break;
      case 'mfSeq': exportMerit('seq'); break;
      case 'mfZmx': exportMerit('zmx'); break;
      case 'dlZmx': exportAs('zmx'); break;
      case 'about': openAbout(); break;
      case 'install': if (deferredInstall) { deferredInstall.prompt(); deferredInstall.userChoice.finally(() => { deferredInstall = null; $('#btnInstall').style.display = 'none'; }); } break;
      case 'undo': undo(); break; case 'redo': redo(); break;
      case 'optim': openOptim(); break;
      case 'tol': openTol(); break;
      case 'report': openReport(); break;
      case 'assistant': openAssistant(); break;
      case 'asstShow': App.asst = !App.asst; applyAsstPref(); save(); toast(App.asst ? 'Bouton Assistant affiché' : 'Bouton Assistant masqué (Fichier pour le réafficher)'); break;
      case 'glasses': openGlasses(); break;
      case 'sysdata': openSysData(); break;
      case 'mconf': openMC(); break;
      case 'hist': openHist(); break;
      case 'drawings': openDrawings(); break;
      case 'tolrpt': openTolReport(); break;
      case 'newpane': newFloatPane(); break;
      case 'qfocus': quickFocusUI(); break;
      case 'qfopt': qfMenu(a); break;
      case 'theme': { const d = document.documentElement; d.dataset.theme = d.dataset.theme === 'dark' ? '' : 'dark'; save(); readTheme(); drawLayout(); renderPanes(); break; }
      case 'help': openHelp(); break;
      case 'fit': fitView(); break;
      default: lde(a.dataset.act);
    }
  });
  $('#gridSeg').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { App.grid = +b.dataset.g; save(); buildPanes(); } });
  { const r3 = $('#ray3'); r3.innerHTML = RAY3.map(([k, l]) => `<option value="${k}">${l}</option>`).join(''); r3.value = App.ray3; r3.addEventListener('change', () => { App.ray3 = r3.value; save(); drawLayout(); }); }
  $('#laySeg').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; App.mode = b.dataset.m; drawLayout(); });
  { const nr = $('#nRays'); nr.value = App.nRays;
    const setN = (draw) => { const v = Math.round(parseNum(nr.value, false)); if (!isFinite(v)) { nr.value = App.nRays; return; } const n = Math.max(3, Math.min(100, v)); if (String(n) !== nr.value) nr.value = n; if (n !== App.nRays) { App.nRays = n; save(); if (draw) drawLayout(); } };
    nr.addEventListener('change', () => setN(true)); nr.addEventListener('input', () => { const v = +nr.value; if (Number.isInteger(v) && v >= 3 && v <= 100) setN(true); });
    nr.addEventListener('keydown', e => { if (e.key === 'Enter') { setN(true); nr.blur(); } });
    $('#nRaysMenu').addEventListener('click', e => { const b = e.target.closest('[data-nr]'); if (!b) return; nr.value = b.dataset.nr; setN(true); $('#nRaysMenu').classList.remove('open'); }); }
  $('#showAsph').addEventListener('change', e => { App.showAsph = e.target.checked; if (!App.showAsph) { App.hiAsph = false; $('#showHi').checked = false; } renderLDE(); });
  $('#showHi').addEventListener('change', e => { App.hiAsph = e.target.checked; if (App.hiAsph) { App.showAsph = true; $('#showAsph').checked = true; } renderLDE(); });
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
    else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'f') { e.preventDefault(); quickFocusUI(); }
    else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'a') { e.preventDefault(); openAssistant(); }
    else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'd') { e.preventDefault(); openSysData(); }
    else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'm') { e.preventDefault(); openMC(); }
    else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'h') { e.preventDefault(); openHist(); }
    else if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'PageUp' || e.key === 'PageDown') && OE.mcOn(App.sys)) { e.preventDefault(); mcGo(e.key === 'PageUp' ? 'prev' : 'next'); }
    else if (e.key === 'Insert') { e.preventDefault(); lde('insA'); }
    else if ((e.ctrlKey || e.metaKey) && e.key === 'Delete') { e.preventDefault(); lde('del'); }
    else if (e.key === 'Delete' && !inInput && !e.target.closest?.('#dlg')) { e.preventDefault(); lde('del'); }
    else if (e.key === 'Escape') { closeDlg(); $$('.pane.max').forEach(p => { p.classList.remove('max'); renderPane(+p.dataset.i); }); }
  });
  // séparateurs
  const drag = (el, fn) => el.addEventListener('mousedown', e => { e.preventDefault(); el.classList.add('drag'); const mv = ev => fn(ev); const up = () => { el.classList.remove('drag'); window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); drawLayout(); renderPanes(); }; window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up); });
  drag($('#hs'), ev => { const r = $('#center').getBoundingClientRect(); const v = Math.max(80, Math.min(r.height - 120, ev.clientY - r.top)); $('#center').style.setProperty('--ldeh', v + 'px'); });
  drag($('#vs'), ev => { const r = $('#ws').getBoundingClientRect(); const v = Math.max(280, Math.min(r.width - 600, r.right - ev.clientX)); $('#ws').style.setProperty('--anw', v + 'px'); });
}
init();
