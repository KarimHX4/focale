'use strict';
/* =====================================================================
   FOCALE — composition et génération des rapports PDF
   ===================================================================== */
const RPT_DEF = {
  title: 'Rapport de conception optique', author: '', notes: '',
  sec: { cover: true, system: true, presc: true, layout: true, perf: true, seidel: true, panes: false, det: true, src: true, tol: true },
  an: { spot: true, mtf: true, field: true, wfe: false, psf: false, rayfan: false, opdfan: false, zern: false, ee: false, footprint: false, chrom: false, polar: false, detector: false, source: false, imgsim: false, glass: false },
  perField: false,
};
function rptCfg() {
  if (!App.rpt) { try { App.rpt = JSON.parse(localStorage.getItem('focale.rpt') || 'null'); } catch (e) { } }
  const d = structuredClone(RPT_DEF), r = App.rpt || {};
  App.rpt = { ...d, ...r, sec: { ...d.sec, ...(r.sec || {}) }, an: { ...d.an, ...(r.an || {}) } };
  return App.rpt;
}
function rptSave() { try { localStorage.setItem('focale.rpt', JSON.stringify(App.rpt)); } catch (e) { } }
const RPT_SEC = [['cover', 'Page de garde et notes'], ['system', 'Données du système et paraxial'], ['presc', 'Prescription (surfaces)'], ['layout', 'Layout 2D'], ['perf', 'Performances par champ'],
  ['seidel', 'Coefficients de Seidel'], ['panes', 'Fenêtres d\'analyse ouvertes (avec leurs réglages)'], ['det', 'Détecteur (si actif)'], ['src', 'Source / fibre (si définie)'], ['tol', 'Tolérancement (si calculé)']];
function openReport() {
  const c = rptCfg(), an = Object.keys(RPT_DEF.an).filter(k => PT[k]);
  dlg(`<h2>Rapport PDF <button class="x" data-d="close">✕</button></h2><div class="db">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div><div class="hint">Titre du rapport</div><input class="in" style="width:100%" data-r="title" value="${esc(c.title)}"></div>
      <div><div class="hint">Auteur</div><input class="in" style="width:100%" data-r="author" value="${esc(c.author)}" placeholder="Nom, laboratoire…"></div></div>
    <div class="hint" style="margin-top:8px">Notes (objectif, hypothèses, conclusions…)</div>
    <textarea data-r="notes" style="height:70px" placeholder="Texte libre inclus en tête du rapport">${esc(c.notes)}</textarea>
    <div class="hint" style="margin:10px 0 4px;font-weight:600;color:var(--fg)">Sections</div>
    <div class="rgrid">${RPT_SEC.map(([k, l]) => `<label><input type="checkbox" data-rs="${k}" ${c.sec[k] ? 'checked' : ''}>${l}</label>`).join('')}</div>
    <div class="hint" style="margin:10px 0 4px;font-weight:600;color:var(--fg)">Analyses à inclure</div>
    <div class="rgrid">${an.map(k => `<label><input type="checkbox" data-ra="${k}" ${c.an[k] ? 'checked' : ''}>${PT[k].l}</label>`).join('')}</div>
    <label class="hint" style="display:flex;gap:6px;margin-top:8px"><input type="checkbox" data-r="perField" ${c.perField ? 'checked' : ''}>Un graphique par champ pour les analyses qui dépendent du champ (front d'onde, PSF, énergie encerclée, polarisation…)</label>
    <div class="hint" style="margin-top:6px">Les analyses sont rendues en haute résolution sur fond blanc ; textes et tableaux sont vectoriels. Le rapport utilise le système et les réglages actuels (détecteur, source, tolérancement déjà calculé).</div></div>
    <div class="df"><span class="hint grow" id="rptMsg"></span><button class="tb pri" data-d="rgen">Générer le PDF</button></div>`, true);
  const box = $('#dlg');
  box.oninput = box.onchange = e => {
    const t = e.target, cf = rptCfg();
    if (t.dataset.r) cf[t.dataset.r] = t.type === 'checkbox' ? t.checked : t.value;
    if (t.dataset.rs) cf.sec[t.dataset.rs] = t.checked;
    if (t.dataset.ra) cf.an[t.dataset.ra] = t.checked;
    rptSave();
  };
}
/** rendu hors écran d'une fonction de dessin (thème clair, résolution ×2) */
function rptCanvas(fn, w = 780, h = 430, k = 2) {
  const cv = document.createElement('canvas'); cv.width = w * k; cv.height = h * k;
  const c = cv.getContext('2d'); c.setTransform(k, 0, 0, k, 0, 0); c.fillStyle = '#fff'; c.fillRect(0, 0, w, h);
  fn(c, w, h); return cv;
}
async function genReport() {
  if (!App.M || !App.M.ok) { toast('Système invalide : impossible de générer le rapport'); return; }
  const cf = rptCfg(), msg = t => { const e = $('#rptMsg'); if (e) e.textContent = t; };
  const M = App.M, sys = App.sys, doc = new PDF.Doc(), L = 42, Rr = PDF.W - 42, CW = Rr - L, BOT = PDF.H - 48;
  const ACC = '#2563eb', MUT = '#6b7686', LINE = '#dde3ea';
  const date = new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
  let y = 0;
  const savedView = { ...App.view }, savedMode = App.mode;
  App.forceLight = true; readTheme();
  const page = () => {
    doc.addPage();
    lensMark(doc, L, 24, 0.7); doc.text(L + 20, 34, 'Focale', { size: 10, font: 'bold', color: ACC });
    doc.text(Rr, 33, `${cf.title || 'Rapport'} — ${sys.title || ''}`.slice(0, 95), { size: 8.5, color: MUT, align: 'right' });
    doc.line(L, 42, Rr, 42, { color: LINE }); y = 64;
  };
  let pendH1 = null; // titre de section en attente : imprimé avec le premier contenu qui le suit
  const need = h => { const extra = pendH1 ? 30 : 0; if (y + h + extra > BOT) page(); if (pendH1) { const t = pendH1; pendH1 = null; doc.text(L, y + 4, t, { size: 15, font: 'bold', color: '#111827' }); doc.rect(L, y + 10, 34, 2.2, { fill: ACC }); y += 30; } };
  const h1 = t => { pendH1 = t; };
  const h2 = (t, keep = 0) => { need(28 + keep); doc.text(L, y + 2, t, { size: 11.5, font: 'bold', color: '#1f2937' }); y += 18; };
  const para = (t, o = {}) => { need(30); y += doc.para(L, y, CW, t, { size: o.size || 9.5, color: o.color || '#374151' }) + 4; };
  /** tableau ; cols : [{ t: titre, w: largeur, a: 'left'|'right', mono }] */
  const table = (cols, rows, o = {}) => {
    const fs = o.size || 8.5, rh = fs + 6.5, head = () => { doc.rect(L, y, CW, rh, { fill: '#eef2f7' }); let x = L; cols.forEach(c => { doc.text(c.a === 'right' ? x + c.w - 4 : x + 4, y + fs + 1.5, c.t, { size: fs, font: 'bold', color: '#374151', align: c.a === 'right' ? 'right' : 'left' }); x += c.w; }); y += rh; };
    need(rh * 3); head();
    rows.forEach((r, i) => {
      if (y + rh > BOT) { page(); head(); }
      if (i % 2) doc.rect(L, y, CW, rh, { fill: '#f8fafc' });
      let x = L; cols.forEach((c, k) => { let v = r[k] == null ? '' : String(r[k]); const maxw = c.w - 8; while (v.length > 3 && PDF.measure(v, fs, c.mono ? 'mono' : 'reg') > maxw) v = v.slice(0, -2) + '…';
        doc.text(c.a === 'right' ? x + c.w - 4 : x + 4, y + fs + 1.5, v, { size: fs, font: c.mono ? 'mono' : 'reg', color: '#111827', align: c.a === 'right' ? 'right' : 'left' }); x += c.w; });
      y += rh;
    });
    doc.line(L, y, Rr, y, { color: LINE }); y += 10;
  };
  const kv = (rows) => {
    const two = rows.every(([a, b]) => PDF.measure(a, 8.8) + PDF.measure(b, 8.8, 'mono') + 20 < CW / 2 - 12);
    const half = two ? Math.ceil(rows.length / 2) : rows.length, cw = two ? CW / 2 : CW; need(Math.min(half, 12) * 13 + 6);
    rows.forEach(([a, b], i) => { const col = i < half ? 0 : 1, row = i < half ? i : i - half; const yy = y + row * 13; doc.text(L + col * cw, yy + 9, a, { size: 8.8, color: MUT }); doc.text(L + col * cw + cw - 12, yy + 9, b, { size: 8.8, font: 'mono', color: '#111827', align: 'right' }); });
    y += half * 13 + 8; };
  const image = (cv, caption) => {
    const w = CW, h = CW * cv.height / cv.width; need(h + (caption ? 18 : 6));
    doc.jpeg(PDF.canvasJPEG(cv, 0.9), cv.width, cv.height, L, y, w, h); doc.rect(L, y, w, h, { stroke: LINE });
    y += h + 4; if (caption) { doc.text(L, y + 8, caption, { size: 8.5, color: MUT }); y += 16; } else y += 6;
  };
  const step = async t => { msg(t); await tick(); };
  const fl = i => fLabel(M, i), uF = M.objInf ? '°' : ' mm', p = M.par;
  try {
    // ---------------- page de garde ----------------
    page();
    if (cf.sec.cover) {
      y = 150; lensMark(doc, L, y - 40, 2.2);
      doc.text(L + 90, y - 10, cf.title || 'Rapport de conception optique', { size: 22, font: 'bold', color: '#111827' });
      doc.text(L + 90, y + 14, sys.title || 'Système sans titre', { size: 13, color: ACC });
      y += 50; doc.line(L, y, Rr, y, { color: LINE }); y += 22;
      kv([['Auteur', cf.author || '—'], ['Date', date], ['Logiciel', `Focale ${typeof FOCALE_VERSION !== 'undefined' ? FOCALE_VERSION : ''}`], ['Surfaces', String(sys.surfaces.length - 2)],
        ['Focale (EFL)', `${fx(p.efl, 4)} mm`], ['F/# de travail', fx(p.wfno, 3)], ['Champ max', `${fmt(p.fmax, 4)}${uF}`], ['Longueur totale', `${fx(p.ttl, 2)} mm`]]);
      if (cf.notes && cf.notes.trim()) { h2('Notes'); para(cf.notes.trim(), { size: 10 }); }
      const toc = RPT_SEC.filter(([k]) => cf.sec[k] && k !== 'cover').map(([, l]) => l).concat(Object.keys(cf.an).filter(k => cf.an[k] && PT[k]).map(k => PT[k].l));
      h2('Contenu'); para(toc.map(t => '• ' + t).join('\n'), { size: 9.5 });
    }
    // ---------------- système ----------------
    if (cf.sec.system) {
      await step('Données du système…'); if (cf.sec.cover) page(); h1('Données du système');
      const ap = sys.aperture;
      kv([['Ouverture', `${({ EPD: 'Ø pupille d\'entrée', FNO: 'F/# image', NA: 'ON objet' })[ap.type]} = ${fmt(ap.value, 6)}`], ['Obstruction centrale', fmt(ap.obscuration || 0, 4)],
        ['Objet', M.objInf ? 'à l\'infini' : `à ${fx(M.t0, 3)} mm`], ['Visée réelle des rayons', sys.rayAiming ? 'oui' : 'non'],
        ['Champs', sys.fields.map((_, i) => fl(i)).join(' ; ')], ['Longueurs d\'onde (nm)', sys.wavelengths.map((w, i) => fmt(w.um * 1000, 5) + (i === sys.primary ? '*' : '')).join(' ; ')]]);
      h2('Données paraxiales');
      kv([['Focale effective (EFL)', `${fx(p.efl, 4)} mm`], ['Tirage (BFL)', `${fx(p.bfl, 4)} mm`], ['Distance image paraxiale', `${fx(p.imgDist, 4)} mm`], ['F/# (EFL/EPD)', fx(p.fno, 3)], ['F/# de travail', fx(p.wfno, 3)],
        ['ON image', fx(p.imgSpaceNA, 4)], ['Ø / position pupille d\'entrée', `${fx(p.epd, 3)} / ${fx(p.zE, 3)} mm`], ['Ø / position pupille de sortie', `${fx(p.xpD, 3)} / ${fx(p.xpZ, 3)} mm`],
        ['Ø diaphragme', `${fx(2 * p.stopR, 3)} mm`], ['Hauteur image paraxiale', `${fx(p.imgH, 4)} mm`], ['Longueur totale', `${fx(p.ttl, 3)} mm`], ['Invariant de Lagrange', fx(p.H, 5)]]);
    }
    // ---------------- prescription ----------------
    if (cf.sec.presc) {
      await step('Prescription…'); h1('Prescription');
      const rows = M.S.map((s, i) => {
        const el = s.elem ? ({ grating: `réseau ${fmt(s.lpmm, 5)} tr/mm m=${s.gm ?? 1}`, ideal: `lentille idéale f=${fmt(s.fid, 5)}`, polarizer: `polariseur ${fmt(s.pang || 0, 4)}°`, waveplate: `lame ${fmt(s.ret, 4)}λ à ${fmt(s.wang, 4)}°` })[s.elem] : '';
        const nd = OE.isMirror(s) ? 'miroir' : OE.isAir(s.glass) ? '' : fx(OE.glassN(s.glass, 0.5875618), 5);
        const flags = [s.stop ? 'STO' : '', isDec(s) ? (s.dmode || 'DEC') : '', s.type && s.type !== 'STD' ? s.type : '', s.tsolve === 'M' ? 'M' : ''].filter(Boolean).join(' ');
        return [i === 0 ? 'OBJ' : i === M.N ? 'IMA' : i, fmt(s.r, 7), fmt(s.t, 7), s.glass || '', nd, i ? fmt(s.sd, 5) : '', s.k ? fmt(s.k, 6) : '', flags, [s.comment, el].filter(Boolean).join(' · ')];
      });
      table([{ t: '#', w: 30 }, { t: 'Rayon', w: 66, a: 'right', mono: true }, { t: 'Épaisseur', w: 66, a: 'right', mono: true }, { t: 'Verre', w: 62 }, { t: 'nd', w: 46, a: 'right', mono: true }, { t: '½Ø', w: 46, a: 'right', mono: true }, { t: 'Conique', w: 48, a: 'right', mono: true }, { t: 'Options', w: 52 }, { t: 'Commentaire / élément', w: CW - 416 }], rows);
      const asph = M.S.map((s, i) => [i, s]).filter(([, s]) => s.a4 || s.a6 || s.a8 || s.a10);
      if (asph.length) { h2('Coefficients asphériques'); table([{ t: '#', w: 40 }, { t: 'A4', w: (CW - 40) / 4, a: 'right', mono: true }, { t: 'A6', w: (CW - 40) / 4, a: 'right', mono: true }, { t: 'A8', w: (CW - 40) / 4, a: 'right', mono: true }, { t: 'A10', w: (CW - 40) / 4, a: 'right', mono: true }], asph.map(([i, s]) => [i, fmt(s.a4, 6), fmt(s.a6, 6), fmt(s.a8, 6), fmt(s.a10, 6)])); }
      const dec = M.S.map((s, i) => [i, s]).filter(([, s]) => isDec(s));
      if (dec.length) { h2('Décentrements et bascules'); const w6 = (CW - 90) / 6; table([{ t: '#', w: 40 }, { t: 'Mode', w: 50 }, ...['X (mm)', 'Y (mm)', 'Z (mm)', 'α (°)', 'β (°)', 'γ (°)'].map(t => ({ t, w: w6, a: 'right', mono: true }))], dec.map(([i, s]) => [i, s.dmode || 'DEC', fmt(s.dx, 6), fmt(s.dy, 6), fmt(s.dz, 6), fmt(s.tx, 6), fmt(s.ty, 6), fmt(s.tz, 6)])); }
    }
    // ---------------- layout ----------------
    if (cf.sec.layout) {
      await step('Layout…'); h1('Layout');
      App.view = { ...App.view, auto: true }; App.mode = '2d';
      const cv = rptCanvas((c, w, h) => { drawLayout({ c, w, h }); legend(c, 10, h - 10, sys.fields.map((_, i) => ({ col: fcol(i), l: `champ ${fl(i)}` }))); }, 780, 360);
      image(cv, 'Coupe méridienne (plan YZ), rayons de chaque champ à la longueur d\'onde primaire.');
    }
    // ---------------- performances ----------------
    if (cf.sec.perf) {
      await step('Performances…'); h1('Performances');
      const rows = sys.fields.map((_, i) => { const sp = OE.spot(M, i, 21), wf = OE.wavefront(M, i, M.pw, 48); return [fl(i), fx(sp.rms * 1e3, 2), fx(sp.geo * 1e3, 2), fx(wf.rms, 4), fx(wf.pv, 3), fx(Math.exp(-((2 * Math.PI * wf.rms) ** 2)), 3), sp.nv ? `${Math.round(100 * sp.nv / sp.ntot)} %` : '0 %']; });
      const w7 = CW / 7; table(['Champ', 'Spot RMS (µm)', 'Spot GEO (µm)', 'WFE RMS (λ)', 'WFE PV (λ)', 'Strehl (Maréchal)', 'Vignetage'].map((t, k) => ({ t, w: w7, a: k ? 'right' : 'left', mono: k > 0 })), rows);
      para(`Front d'onde à λ = ${fmt(M.wls[M.pw] * 1000, 5)} nm, tilt retiré ; spot polychromatique par rapport au barycentre ; rayon d'Airy ${fx(1.22 * M.ctxs[M.pw].lmm * p.wfno * 1e3, 2)} µm.`, { size: 8.5, color: MUT });
    }
    if (cf.sec.seidel) {
      await step('Seidel…'); h1('Aberrations du 3ᵉ ordre (Seidel)');
      const sd = OE.seidel(M), keys = ['SI', 'SII', 'SIII', 'SIV', 'SV', 'CL', 'CT'], w8 = (CW - 40) / 7;
      table([{ t: 'Surf.', w: 40 }, ...['Sphérique', 'Coma', 'Astigm.', 'Petzval', 'Distorsion', 'Chrom. ax.', 'Chrom. lat.'].map(t => ({ t, w: w8, a: 'right', mono: true }))],
        [...sd.rows.map(r => [r.j, ...keys.map(k => r[k].toExponential(3))]), ['Σ', ...keys.map(k => sd.sum[k].toExponential(3))]], { size: 8 });
      const lm = sd.lmm; para(`Équivalents en front d'onde : W040 = ${fx(sd.sum.SI / 8 / lm, 3)} λ · W131 = ${fx(sd.sum.SII / 2 / lm, 3)} λ · W222 = ${fx(sd.sum.SIII / 2 / lm, 3)} λ · W220 = ${fx(sd.sum.SIV / 4 / lm, 3)} λ · W311 = ${fx(sd.sum.SV / 2 / lm, 3)} λ.`, { size: 8.5, color: MUT });
    }
    // ---------------- analyses ----------------
    const renderAn = async (pp, title) => {
      await step(`Analyse : ${title}…`);
      if (pp.type === 'zern') { const wf = OE.wavefront(M, pp.fi || 0, pp.wi ?? M.pw, 64, false); h2(title, 80); table([{ t: 'Terme', w: 60 }, { t: 'Aberration', w: CW - 160 }, { t: 'Coef. (λ)', w: 100, a: 'right', mono: true }], (wf.zern || []).map((v, i) => [`Z${i + 1}`, OE.ZN[i], (v >= 0 ? '+' : '') + v.toFixed(5)])); return; }
      if (pp.type === 'presc') return;
      if (pp.type === 'imgsim') simSync(pp, M);
      const tall = ['spot', 'rayfan', 'opdfan'].includes(pp.type) && sys.fields.length > 2;
      const cv = rptCanvas((c, w, h) => R[pp.type](pp, M, c, w, h), 780, tall ? 560 : 430);
      h2(title, CW * cv.height / cv.width + 6); image(cv);
    };
    const anKeys = Object.keys(cf.an).filter(k => cf.an[k] && PT[k]);
    if (anKeys.length) {
      h1('Analyses');
      for (const k of anKeys) {
        if (PT[k].f && cf.perField) for (let i = 0; i < sys.fields.length; i++) await renderAn({ type: k, fi: i, wi: M.pw }, `${PT[k].l} — champ ${fl(i)}`);
        else await renderAn({ type: k, fi: 0, wi: M.pw }, PT[k].l + (PT[k].f ? ` — champ ${fl(0)}` : ''));
      }
    }
    if (cf.sec.panes) {
      h1('Fenêtres d\'analyse');
      for (const pp of App.panes.slice(0, App.grid)) await renderAn({ ...pp }, PT[pp.type].l + (PT[pp.type].f ? ` — champ ${fl(pp.fi || 0)}` : '') + (PT[pp.type].w ? `, ${fmt(M.wls[pp.wi ?? M.pw] * 1000, 5)} nm` : ''));
    }
    // ---------------- détecteur, source ----------------
    const d = det();
    if (cf.sec.det && d.on) {
      await step('Détecteur…'); h1('Détecteur');
      const pm = d.p * 1e-3, lF = M.ctxs[M.pw].lmm * p.wfno;
      kv([['Pas des pixels', `${d.p} µm`], ['Format', `${d.nx} × ${d.ny} px`], ['Taille du capteur', `${fx(d.nx * pm, 2)} × ${fx(d.ny * pm, 2)} mm`], ['Facteur de remplissage', `${d.ff} %`],
        ['Nyquist', `${fx(1 / (2 * pm), 1)} cy/mm`], ['Coupure optique', `${fx(1 / lF, 1)} cy/mm`], ['Q = λF/p', fx(lF / pm, 2)], ['Ø Airy', `${fx(2.44 * lF / pm, 2)} px`],
        ['Puits / bruit de lecture', `${d.fw} e⁻ / ${d.rn} e⁻`], ['Numérisation', `${d.bits} bits`]]);
      const rows = sys.fields.map((_, i) => { const ps = OE.psf(M, i, M.pw, 64, 256), b = OE.binPSF(ps.I, ps.P, ps.dx, pm, 'centre', 3), sp = OE.spot(M, i, 21); return [fl(i), fx(b.G[4] * 100, 1) + ' %', fx(b.G.reduce((a, v) => a + v, 0) * 100, 1) + ' %', fx(sp.rms / pm, 2) + ' px', fx(ps.strehl, 3)]; });
      const w5 = CW / 5; table(['Champ', 'Énergie pixel central', 'Énergie 3×3', 'Spot RMS', 'Strehl'].map((t, k) => ({ t, w: w5, a: k ? 'right' : 'left', mono: k > 0 })), rows);
    }
    const S = src();
    if (cf.sec.src && S.type !== 'none') {
      await step('Source…'); h1('Source d\'entrée');
      const rows = [['Type', (SRCT.find(q => q[0] === S.type) || [0, S.type])[1]]];
      if (S.type === 'fiber') {
        const l = S.lc0 > 0 ? S.lc0 / 1000 : M.wls[M.pw], fi = OE.fiberInfo(S, l);
        rows.push(['Fibre', ({ si: 'multimode à saut d\'indice', gi: 'multimode à gradient d\'indice', sm: 'monomode' })[S.fib]], ['Ø cœur / gaine', `${fmt(S.core, 5)} / ${fmt(S.clad, 5)} µm`], ['Ouverture numérique', fmt(S.na, 4)],
          ['V à λ', `${fx(fi.V, 3)} (λ = ${fmt(l * 1000, 5)} nm)`], ['Longueur d\'onde de coupure', `${fx(fi.lc * 1000, 0)} nm`], ['Régime', fi.single ? 'monomode' : `multimode (~${fi.modes} modes)`]);
        if (S.fib === 'sm') rows.push(['Diamètre de mode', `${fx(fi.mfd, 2)} µm`]);
        if (S.len > 0 && S.att > 0) rows.push(['Transmission de la fibre', `${fx(100 * Math.pow(10, -S.att * S.len / 1e4), 2)} %`]);
      }
      if (S.lc0 > 0) rows.push(['Spectre', `${fmt(S.lc0, 5)} nm ± ${fmt((S.dl || 0) / 2, 4)} nm`]);
      kv(rows);
      await renderAn({ type: 'source', fi: 0, pix: false }, 'Image de la source');
    }
    // ---------------- tolérancement ----------------
    if (cf.sec.tol && (TOL.sens || TOL.mc)) {
      await step('Tolérancement…'); h1('Tolérancement');
      if (TOL.sens) {
        const Sx = TOL.sens, u = tolUnit(Sx.c.crit), rows = Sx.rows.map(r => ({ r, dp: r.cp - Sx.B.nominal, dm: r.cm - Sx.B.nominal })).map(o => ({ ...o, w: Math.max(o.dp, o.dm) })).sort((a, b) => b.w - a.w);
        const rss = Sx.B.nominal + Math.sqrt(rows.reduce((a, o) => a + Math.max(0, o.w) ** 2, 0));
        para(`Critère : ${Sx.c.crit === 'SPOT' ? 'spot RMS (µm)' : 'front d\'onde RMS (λ)'} · compensateur : ${Sx.c.comp ? 'mise au point' : 'aucun'} · nominal ${fx(Sx.B.nominal, 4)} ${u} · estimation RSS ${fx(rss, 4)} ${u}.`);
        h2('Sensibilités (20 plus fortes)');
        table([{ t: 'Tolérance', w: CW - 270 }, { t: 'Valeur', w: 70, a: 'right', mono: true }, { t: 'Δ (+)', w: 100, a: 'right', mono: true }, { t: 'Δ (−)', w: 100, a: 'right', mono: true }], rows.slice(0, 20).map(o => [o.r.it.label, '±' + o.r.it.tol, fx(o.dp, 4), fx(o.dm, 4)]));
      }
      if (TOL.mc && TOL.mc.vals.length) {
        const MC = TOL.mc, u = tolUnit(MC.c.crit), v = MC.vals, mean = v.reduce((a, b) => a + b, 0) / v.length;
        h2(`Monte-Carlo (${v.length} tirages, distribution ${({ normal: 'gaussienne', uniform: 'uniforme', end: 'extrêmes' })[MC.c.dist]})`);
        kv([['Moyenne', `${fx(mean, 4)} ${u}`], ['50 % des systèmes <', `${fx(pct(v, 0.5), 4)} ${u}`], ['80 % <', `${fx(pct(v, 0.8), 4)} ${u}`], ['90 % <', `${fx(pct(v, 0.9), 4)} ${u}`], ['98 % <', `${fx(pct(v, 0.98), 4)} ${u}`], ['Maximum', `${fx(Math.max(...v), 4)} ${u}`]]);
        image(rptCanvas((c, w, h) => drawMC({ c, w, h }), 780, 300), 'Histogramme des tirages, courbe cumulée (orange) et valeur nominale (pointillés).');
      }
    }
    // pieds de page
    const N = doc.pages.length;
    doc.pages.forEach((pg, i) => { doc.page = pg; doc.line(L, PDF.H - 34, Rr, PDF.H - 34, { color: LINE }); doc.text(L, PDF.H - 22, `Focale — ${sys.title || ''}`.slice(0, 90), { size: 8, color: MUT }); doc.text(Rr, PDF.H - 22, `${date} · page ${i + 1} / ${N}`, { size: 8, color: MUT, align: 'right' }); });
    await step('Écriture du PDF…');
    const bytes = doc.build({ title: `${cf.title} — ${sys.title || ''}`, author: cf.author });
    App._lastPDF = bytes;
    download(`${fileBase()}_rapport.pdf`, new Blob([bytes], { type: 'application/pdf' }));
    msg(`PDF généré : ${N} pages, ${Math.round(bytes.length / 1024)} Ko`); toast('Rapport PDF téléchargé');
  } catch (e) { console.error(e); msg('Erreur : ' + e.message); toast('Erreur pendant la génération du rapport'); }
  finally { App.forceLight = false; App.view = savedView; App.mode = savedMode; readTheme(); drawLayout(); }
}
/** pictogramme vectoriel (lentille + rayons) pour l'en-tête du rapport */
/** logo Focale « tache d'Airy » sur tuile sombre ; (x, y) coin haut-gauche, taille 20·k pt */
function lensMark(doc, x, y, k = 1) {
  const S = 20 * k, u = S / 100;
  const arc = (cx, cy, r, a0, a1, n = 8) => { const o = []; for (let i = 0; i <= n; i++) { const t = a0 + (a1 - a0) * i / n; o.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]); } return o; };
  const R = 22 * u, tile = [...arc(x + S - R, y + R, R, -Math.PI / 2, 0), ...arc(x + S - R, y + S - R, R, 0, Math.PI / 2), ...arc(x + R, y + S - R, R, Math.PI / 2, Math.PI), ...arc(x + R, y + R, R, Math.PI, 1.5 * Math.PI)];
  doc.poly(tile, { fill: '#0f172a', close: true });
  // anneaux d'Airy (repère 100×100) réduits à 74 % et centrés dans la tuile
  const cx = x + S / 2, cy = y + S / 2, q = 0.74 * u, ring = r => arc(cx, cy, r * q, 0, 2 * Math.PI, 48);
  doc.poly(ring(44), { stroke: '#263f64', w: 5 * q, close: true });
  doc.poly(ring(31), { stroke: '#3c659c', w: 6 * q, close: true });
  doc.poly(ring(16), { fill: '#60a5fa', close: true });
  doc.poly(ring(6), { fill: '#f59e0b', close: true });
}
