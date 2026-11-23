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
  const ACC = '#2563eb', ACC2 = '#1e3a8a', INK = '#111827', MUT = '#6b7686', LINE = '#dde3ea', SOFT = '#f4f7fb', DARK = '#0f172a';
  const date = new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
  let y = 0, secN = 0, figN = 0;
  const toc = []; // { t, n, pg, sub }
  const savedView = { ...App.view }, savedMode = App.mode;
  App.forceLight = true; readTheme();
  const page = (cover = false) => {
    doc.addPage();
    if (cover) { y = 0; return; }
    doc.rect(0, 0, PDF.W, 5, { fill: ACC });
    lensMark(doc, L, 20, 0.75); doc.text(L + 21, 31.5, 'Focale', { size: 10, font: 'bold', color: INK });
    doc.text(Rr, 31, `${cf.title || 'Rapport'} — ${sys.title || ''}`.slice(0, 95), { size: 8, color: MUT, align: 'right' });
    doc.line(L, 42, Rr, 42, { color: LINE }); y = 66;
  };
  let pendH1 = null; // titre de section en attente : imprimé avec le premier contenu qui le suit
  const need = h => {
    const extra = pendH1 ? 40 : 0; if (y + h + extra > BOT) page();
    if (pendH1) {
      const t = pendH1; pendH1 = null; secN++;
      doc.rrect(L, y - 8, 24, 24, 5, { fill: ACC }); doc.text(L + 12, y + 8.5, String(secN), { size: 12, font: 'bold', color: '#ffffff', align: 'center' });
      doc.text(L + 34, y + 9, t, { size: 15, font: 'bold', color: INK });
      doc.line(L + 34 + PDF.measure(t, 15, 'bold') + 10, y + 4, Rr, y + 4, { color: LINE, w: 0.6 });
      toc.push({ t, n: secN, pg: doc.pages.length }); y += 36;
    }
  };
  const h1 = t => { pendH1 = t; };
  const h2 = (t, keep = 0, inToc = false) => {
    need(30 + keep); doc.rect(L, y - 7.5, 2.6, 11, { fill: ACC });
    doc.text(L + 8, y + 2, t, { size: 11, font: 'bold', color: '#1f2937' });
    if (inToc) toc.push({ t, pg: doc.pages.length, sub: true }); y += 17;
  };
  const para = (t, o = {}) => { need(30); y += doc.para(L, y, CW, t, { size: o.size || 9.5, color: o.color || '#374151' }) + 4; };
  const note = t => { need(24); y += doc.para(L, y, CW, t, { size: 8.3, color: MUT, lh: 11 }) + 6; };
  /** tableau ; cols : [{ t: titre, w: largeur, a: 'left'|'right', mono }] ; o.total : dernière ligne = total */
  const table = (cols, rows, o = {}) => {
    const fs = o.size || 8.5, rh = fs + 7.5, tx = (c, x) => c.a === 'right' ? x + c.w - 5 : x + 5, al = c => c.a === 'right' ? 'right' : 'left';
    const head = () => { doc.rrect(L, y, CW, rh + 2, 3, { fill: '#e8eefb' }); let x = L; cols.forEach(c => { doc.text(tx(c, x), y + fs + 2.6, c.t, { size: fs - 0.3, font: 'bold', color: ACC2, align: al(c) }); x += c.w; }); y += rh + 2; };
    need(rh * 3 + 2); head();
    rows.forEach((r, i) => {
      if (y + rh > BOT) { page(); head(); }
      const tot = o.total && i === rows.length - 1;
      if (tot) { doc.line(L, y, Rr, y, { color: '#9aa8bd', w: 0.7 }); doc.rect(L, y, CW, rh, { fill: '#eef2f7' }); }
      else if (i % 2) doc.rect(L, y, CW, rh, { fill: '#f7f9fc' });
      let x = L; cols.forEach((c, k) => { let v = r[k] == null ? '' : String(r[k]); const maxw = c.w - 9, f = tot ? 'bold' : c.mono ? 'mono' : 'reg'; while (v.length > 3 && PDF.measure(v, fs, f) > maxw) v = v.slice(0, -2) + '…';
        doc.text(tx(c, x), y + fs + 2, v, { size: fs, font: f, color: k === 0 ? '#334155' : INK, align: al(c) }); x += c.w; });
      y += rh;
    });
    doc.line(L, y, Rr, y, { color: LINE }); y += 12;
  };
  /** données clé / valeur dans un cadre clair, en une ou deux colonnes */
  const kv = (rows) => {
    const two = rows.length > 2 && rows.every(([a, b]) => PDF.measure(a, 8.6) + PDF.measure(b, 8.6, 'mono') + 30 < CW / 2 - 14);
    const half = two ? Math.ceil(rows.length / 2) : rows.length, cw = two ? CW / 2 : CW, rh = 14, hh = half * rh + 10; need(hh + 6);
    doc.rrect(L, y, CW, hh, 4, { fill: SOFT }); if (two) doc.line(L + cw, y + 6, L + cw, y + hh - 6, { color: LINE });
    rows.forEach(([a, b], i) => { const c = i < half ? 0 : 1, row = i < half ? i : i - half, yy = y + 5 + row * rh, x0 = L + c * cw;
      if (row) doc.line(x0 + 10, yy, x0 + cw - 10, yy, { color: '#e6ebf2', w: 0.4 });
      doc.text(x0 + 10, yy + 9.8, a, { size: 8.6, color: MUT }); doc.text(x0 + cw - 10, yy + 9.8, b, { size: 8.6, font: 'mono', color: INK, align: 'right' }); });
    y += hh + 12; };
  /** cartes d'indicateurs : [{ l, v, u }] */
  const cards = (items, o = {}) => {
    const n = items.length, gap = 8, w = (CW - gap * (n - 1)) / n, hh = o.h || 50; need(hh + 8);
    items.forEach((it, i) => { const x = L + i * (w + gap);
      doc.rrect(x, y, w, hh, 5, { fill: o.fill || SOFT, stroke: o.stroke || '#e3e9f2' }); doc.rect(x + 8, y + 8, 14, 2, { fill: it.c || ACC });
      doc.text(x + 8, y + 22, it.l, { size: 7.6, color: MUT });
      let vs = 15; while (vs > 8 && PDF.measure(it.v, vs, 'bold') + (it.u ? PDF.measure(' ' + it.u, 8.5) : 0) > w - 14) vs -= 0.5;
      doc.text(x + 8, y + hh - 10, it.v, { size: vs, font: 'bold', color: INK });
      if (it.u) doc.text(x + 8 + PDF.measure(it.v, vs, 'bold') + 3, y + hh - 10, it.u, { size: 8.5, color: MUT }); });
    y += hh + 14;
  };
  const image = (cv, caption) => {
    const w = CW, h = CW * cv.height / cv.width; need(h + (caption ? 22 : 8));
    doc.jpeg(PDF.canvasJPEG(cv, 0.9), cv.width, cv.height, L, y, w, h); doc.rrect(L - 0.5, y - 0.5, w + 1, h + 1, 3, { stroke: LINE, w: 0.7 });
    y += h + 4;
    if (caption) { figN++; const lab = `Figure ${figN}. `; doc.text(L, y + 9, lab, { size: 8.3, font: 'bold', color: '#334155' }); y += doc.para(L + PDF.measure(lab, 8.3, 'bold'), y + 9, CW - 60, caption, { size: 8.3, color: MUT, lh: 11 }) + 18; }
    else y += 14;
  };
  const step = async t => { msg(t); await tick(); };
  const fl = i => fLabel(M, i), p = M.par;
  const fmax = () => `${fmt(Math.max(...(M.ufields || M.sys.fields).map(f => Math.hypot(f.x || 0, f.y || 0))), 4)}${fUnitOf(M.ftype)}`;
  let tocBox = null;
  try {
    // ---------------- page de garde ----------------
    if (cf.sec.cover) {
      page(true);
      doc.rect(0, 0, PDF.W, 196, { fill: DARK }); doc.rect(0, 196, PDF.W, 4, { fill: ACC });
      for (let k = 0; k < 5; k++) doc.line(PDF.W - 230 + k * 34, 0, PDF.W - 120 + k * 34, 196, { color: '#1b2a45', w: 0.8 });
      lensMark(doc, L, 46, 1.6); doc.text(L + 42, 64, 'FOCALE', { size: 9.5, font: 'bold', color: '#93b4f0' }); doc.text(L + 42, 76, 'Conception optique', { size: 8, color: '#8090aa' });
      doc.para(L, 122, CW - 40, cf.title || 'Rapport de conception optique', { size: 24, font: 'bold', color: '#ffffff', lh: 28 });
      doc.text(L, 172, sys.title || 'Système sans titre', { size: 13, color: '#93b4f0' });
      y = 228;
      const wlr = sys.wavelengths.map(w => w.um * 1000), wlS = wlr.length > 1 ? `${fmt(Math.min(...wlr), 4)}–${fmt(Math.max(...wlr), 4)}` : fmt(wlr[0], 5);
      cards([{ l: 'Focale effective', v: fx(p.efl, 3), u: 'mm' }, { l: 'Ouverture (F/# trav.)', v: 'F/' + fx(p.wfno, 2) }, { l: 'Champ max', v: fmax() }, { l: 'Spectre', v: wlS, u: 'nm' }, { l: 'Longueur totale', v: fx(p.ttl, 2), u: 'mm' }], { h: 54 });
      kv([['Auteur', cf.author || '—'], ['Date', date], ['Logiciel', `Focale ${typeof FOCALE_VERSION !== 'undefined' ? FOCALE_VERSION : ''}`], ['Surfaces', String(sys.surfaces.length - 2)],
        ['Objet', M.objInf ? 'à l\'infini' : `à ${fx(M.t0, 2)} mm`], ...(M.env ? [['Environnement', `${fmt(M.env.T, 4)} °C, ${fmt(M.env.P, 4)} atm`]] : [['Type de champ', OE.FTYPES[M.ftype || 'ang'] ? OE.FTYPES[M.ftype || 'ang'].l : '—']])]);
      if (cf.notes && cf.notes.trim()) {
        const t = cf.notes.trim(), n0 = doc.page.length, hh = doc.para(0, 0, CW - 30, t, { size: 9.5 }); doc.page.length = n0; // mesure seule
        y += 2; doc.text(L, y + 2, 'NOTES', { size: 8, font: 'bold', color: ACC }); y += 10;
        doc.rrect(L, y, CW, hh + 14, 4, { fill: '#f7f9fc' }); doc.rect(L, y, 3, hh + 14, { fill: ACC });
        doc.para(L + 14, y + 16, CW - 30, t, { size: 9.5, color: '#374151' }); y += hh + 30;
      }
      y += 4; doc.text(L, y + 2, 'SOMMAIRE', { size: 8, font: 'bold', color: ACC }); y += 14;
      tocBox = { y0: y };
      page();
    } else page();
    // ---------------- système ----------------
    if (cf.sec.system) {
      await step('Données du système…'); h1('Données du système');
      const ap = sys.aperture;
      kv([['Ouverture', `${({ EPD: 'Ø pupille d\'entrée', FNO: 'F/# image', NA: 'ON objet', NAI: 'ON image', STOP: 'demi-diamètre du diaphragme' })[ap.type]} = ${fmt(ap.value, 6)}`], ['Obstruction centrale', fmt(ap.obscuration || 0, 4)],
        ['Objet', M.objInf ? 'à l\'infini' : `à ${fx(M.t0, 3)} mm`], ['Visée des rayons', ({ none: 'pupille paraxiale', chief: 'rayon principal au centre du diaphragme', full: 'réelle (tous les rayons)' })[OE.aimMode(sys)]],
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
      const AK = ['a4', 'a6', 'a8', 'a10', 'a12', 'a14', 'a16', 'a18', 'a20'], asph = M.S.map((s, i) => [i, s]).filter(([, s]) => AK.some(k => s[k]));
      if (asph.length) {
        const used = AK.filter(k => asph.some(([, s]) => s[k])), ks = used.length > 4 ? used : AK.slice(0, Math.max(4, AK.indexOf(used[used.length - 1]) + 1)), wa = (CW - 40) / ks.length;
        h2('Coefficients asphériques'); table([{ t: '#', w: 40 }, ...ks.map(k => ({ t: k.toUpperCase(), w: wa, a: 'right', mono: true }))], asph.map(([i, s]) => [i, ...ks.map(k => s[k] ? s[k].toExponential(ks.length > 6 ? 3 : 5) : '0')]), { size: ks.length > 6 ? 7.6 : 8.5 });
      }
      const dec = M.S.map((s, i) => [i, s]).filter(([, s]) => isDec(s));
      if (dec.length) { h2('Décentrements et bascules'); const w6 = (CW - 90) / 6; table([{ t: '#', w: 40 }, { t: 'Mode', w: 50 }, ...['X (mm)', 'Y (mm)', 'Z (mm)', 'α (°)', 'β (°)', 'γ (°)'].map(t => ({ t, w: w6, a: 'right', mono: true }))], dec.map(([i, s]) => [i, s.dmode || 'DEC', fmt(s.dx, 6), fmt(s.dy, 6), fmt(s.dz, 6), fmt(s.tx, 6), fmt(s.ty, 6), fmt(s.tz, 6)])); }
    }
    // ---------------- layout ----------------
    if (cf.sec.layout) {
      await step('Layout…'); h1('Layout');
      App.view = { ...App.view, auto: true }; App.mode = '2d';
      const cv = rptCanvas((c, w, h) => { drawLayout({ c, w, h }); legend(c, 10, h - 10, sys.fields.map((_, i) => ({ col: fcol(i), l: `champ ${fl(i)}` }))); }, 780, 360);
      image(cv, `Coupe méridienne (plan YZ) — rayons de chaque champ à λ = ${fmt(M.wls[M.pw] * 1000, 5)} nm.`);
    }
    // ---------------- performances ----------------
    if (cf.sec.perf) {
      await step('Performances…'); h1('Performances');
      const V = sys.fields.map((_, i) => ({ sp: OE.spot(M, i, 21), wf: OE.wavefront(M, i, M.pw, 48), st: OE.psf(M, i, M.pw, 64, 256).strehl }));
      const rows = V.map((o, i) => [fl(i), fx(o.sp.rms * 1e3, 2), fx(o.sp.geo * 1e3, 2), fx(o.wf.rms, 4), fx(o.wf.pv, 3), fx(o.st, 3), o.sp.nv ? `${Math.round(100 * o.sp.nv / o.sp.ntot)} %` : '0 %']);
      const mx = f => Math.max(...V.map(f)), mn = f => Math.min(...V.map(f)), ra = 1.22 * M.ctxs[M.pw].lmm * p.wfno * 1e3, wmax = mx(o => o.wf.rms);
      cards([{ l: 'Spot RMS max', v: fx(mx(o => o.sp.rms * 1e3), 2), u: 'µm' }, { l: 'Rayon d\'Airy', v: fx(ra, 2), u: 'µm' }, { l: 'WFE RMS max', v: fx(wmax, 3), u: 'λ', c: wmax <= 0.0714 ? '#16a34a' : '#f59e0b' }, { l: 'Strehl min', v: fx(mn(o => o.st), 3), c: mn(o => o.st) >= 0.8 ? '#16a34a' : '#f59e0b' }]);
      const w7 = CW / 7; table(['Champ', 'Spot RMS (µm)', 'Spot GEO (µm)', 'WFE RMS (λ)', 'WFE PV (λ)', 'Strehl (FFT)', 'Vignetage'].map((t, k) => ({ t, w: w7, a: k ? 'right' : 'left', mono: k > 0 })), rows);
      note(`Front d'onde à λ = ${fmt(M.wls[M.pw] * 1000, 5)} nm, tilt retiré ; spot polychromatique par rapport au barycentre. Critère de Maréchal : WFE RMS ≤ 0,0714 λ (Strehl ≥ 0,8) — repère vert sur les cartes.`);
    }
    if (cf.sec.seidel) {
      await step('Seidel…'); h1('Aberrations du 3ᵉ ordre (Seidel)');
      const sd = OE.seidel(M), keys = ['SI', 'SII', 'SIII', 'SIV', 'SV', 'CL', 'CT'], w8 = (CW - 40) / 7;
      table([{ t: 'Surf.', w: 40 }, ...['Sphérique', 'Coma', 'Astigm.', 'Petzval', 'Distorsion', 'Chrom. ax.', 'Chrom. lat.'].map(t => ({ t, w: w8, a: 'right', mono: true }))],
        [...sd.rows.map(r => [r.j, ...keys.map(k => r[k].toExponential(3))]), ['Σ', ...keys.map(k => sd.sum[k].toExponential(3))]], { size: 8, total: true });
      const lm = sd.lmm; note(`Équivalents en front d'onde : W040 = ${fx(sd.sum.SI / 8 / lm, 3)} λ · W131 = ${fx(sd.sum.SII / 2 / lm, 3)} λ · W222 = ${fx(sd.sum.SIII / 2 / lm, 3)} λ · W220 = ${fx(sd.sum.SIV / 4 / lm, 3)} λ · W311 = ${fx(sd.sum.SV / 2 / lm, 3)} λ.`);
    }
    // ---------------- analyses ----------------
    const renderAn = async (pp, title) => {
      await step(`Analyse : ${title}…`);
      if (pp.type === 'zern') { const wf = OE.wavefront(M, pp.fi || 0, pp.wi ?? M.pw, 64, false), z = OE.zernFit(wf, +pp.nz || 16); h2(title, 80, true);
        table([{ t: 'Terme', w: 50 }, { t: 'n', w: 30, a: 'right' }, { t: 'Aberration', w: CW - 260 }, { t: 'Coef. (λ)', w: 90, a: 'right', mono: true }, { t: 'RMS (λ)', w: 90, a: 'right', mono: true }], z.c.map((v, i) => [`Z${i + 1}`, z.order[i], z.names[i], (v >= 0 ? '+' : '') + v.toFixed(5), i ? z.rmsTerm[i].toFixed(5) : '—']));
        kv([['RMS total (piston retiré)', `${fx(z.rmsTot, 5)} λ`], [`Résidu au-delà de Z${z.nz} (RMS / PV)`, `${fx(z.rmsRes, 5)} λ / ${fx(z.pvRes, 4)} λ`]]); return; }
      if (pp.type === 'presc') return;
      if (pp.type === 'imgsim') simSync(pp, M);
      const tall = ['spot', 'rayfan', 'opdfan'].includes(pp.type) && sys.fields.length > 2;
      const cv = rptCanvas((c, w, h) => R[pp.type](pp, M, c, w, h), 780, tall ? 560 : 430);
      h2(title, CW * cv.height / cv.width + 6, true); image(cv);
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
    if (cf.sec.tol && (TOL.sens || TOL.mc || TOL.inv)) {
      await step('Tolérancement…'); h1('Tolérancement');
      const C0 = (TOL.sens || TOL.mc || TOL.inv).c;
      para(`Critère : ${tolCritLabel(C0)} · compensateurs : ${tolCompLabel(C0)}. Puissance et irrégularité en franges à 632,8 nm sur l'ouverture utile ; Δ > 0 = dégradation.`);
      if (TOL.sens) {
        const Sx = TOL.sens, u = tolUnit(Sx.c.crit), rows = Sx.rows.map(r => ({ r, w: Math.max(r.lo ? r.lo.d : -Infinity, r.hi ? r.hi.d : -Infinity), b: Math.max(r.lo ? r.lo.bore : 0, r.hi ? r.hi.bore : 0) })).sort((a, b) => b.w - a.w);
        const rss = Math.sqrt(rows.reduce((a, o) => a + Math.max(0, o.w) ** 2, 0)), est = OE.TOLC[Sx.c.crit].up ? Sx.B.nominal - rss : Sx.B.nominal + rss;
        kv([['Nominal' + (Sx.c.comp ? ' (compensé)' : ''), `${fx(Sx.B.nominal, 4)} ${u}`], ['Estimation RSS', `${fx(est, 4)} ${u}`], ['Dégradation RSS', `${fx(rss, 4)} ${u}`], ...(Sx.c.comp ? [['Mise au point nominale', `${fx(Sx.B.focus * 1e3, 1)} µm`]] : []), ['Tolérances analysées', String(rows.length)]]);
        h2(`Sensibilités (${Math.min(25, rows.length)} plus fortes)`, 140);
        table([{ t: 'Tolérance', w: CW - 330 }, { t: 'Min', w: 60, a: 'right', mono: true }, { t: 'Max', w: 60, a: 'right', mono: true }, { t: 'Δ (min)', w: 70, a: 'right', mono: true }, { t: 'Δ (max)', w: 70, a: 'right', mono: true }, { t: 'Visée µm', w: 70, a: 'right', mono: true }],
          rows.slice(0, 25).map(o => [o.r.it.label, fmt(o.r.it.min, 4), fmt(o.r.it.max, 4), o.r.lo ? fx(o.r.lo.d, 4) : '—', o.r.hi ? fx(o.r.hi.d, 4) : '—', fx(o.b * 1e3, 1)]));
      }
      if (TOL.inv) {
        const I = TOL.inv, u = tolUnit(I.c.crit);
        h2('Tolérances inverses', 140);
        para(`Δ admissible par tolérance : ${fx(I.dmax, 4)} ${u} (${I.c.invMode === 'item' ? 'valeur imposée' : `budget : cible ${fmt(I.c.invVal, 4)} ${u}, marge répartie en RSS sur ${I.rows.length} tolérances`}).`);
        table([{ t: 'Tolérance', w: CW - 300 }, { t: 'Actuelle', w: 75, a: 'right', mono: true }, { t: 'Calculée', w: 75, a: 'right', mono: true }, { t: 'Proposée', w: 75, a: 'right', mono: true }, { t: 'Δ obtenu', w: 75, a: 'right', mono: true }],
          I.rows.map(r => [r.it.label, '±' + fmt(r.it.tol, 4), (r.capped ? '> ±' : '±') + fmt(r.t, 4), '±' + fmt(r.tr, 3), fx(r.d, 4)]));
      }
      if (TOL.mc && TOL.mc.vals.length) {
        const MC = TOL.mc, u = tolUnit(MC.c.crit), st = mcStats(MC);
        h2(`Monte-Carlo (${MC.vals.length} tirages, distribution ${({ normal: 'gaussienne', uniform: 'uniforme', para: 'parabolique', end: 'extrêmes' })[MC.c.dist]}${MC.c.seed !== '' && MC.c.seed != null ? `, graine ${MC.c.seed}` : ''})`, 260);
        kv([['Moyenne ± écart-type', `${fx(st.mean, 4)} ± ${fx(st.sd, 4)} ${u}`], ...[0.5, 0.8, 0.9, 0.95, 0.98].map(p => [`${p * 100} % des systèmes ${st.up ? '≥' : '≤'}`, `${fx(st.q(p), 4)} ${u}`]), ['Meilleur / pire', `${fx(st.up ? st.max : st.min, 4)} / ${fx(st.up ? st.min : st.max, 4)} ${u}`],
          ...(st.yieldP != null ? [[`Rendement (spécification ${st.up ? '≥' : '≤'} ${fmt(st.spec, 4)} ${u})`, `${fx(100 * st.yieldP, 1)} %`]] : []), ...(MC.c.comp ? [['Course de mise au point', `${fx(Math.min(...MC.foc) * 1e3, 0)} … ${fx(Math.max(...MC.foc) * 1e3, 0)} µm`]] : [])]);
        image(rptCanvas((c, w, h) => drawMC({ c, w, h }), 780, 320), 'Histogramme des tirages, fonction de répartition (orange, %), valeur nominale (pointillés) et spécification (rouge).');
        const ctb = mcContrib(MC).slice(0, 10).filter(o => o.r2 > 0.005);
        if (ctb.length) { h2('Principaux contributeurs (Monte-Carlo)', 120); table([{ t: 'Tolérance', w: CW - 120 }, { t: 'R² signé', w: 120, a: 'right', mono: true }], ctb.map(o => [o.it.label, fx(o.r2, 3)])); }
      }
    }
    // pieds de page (pas sur la page de garde)
    const N = doc.pages.length, c0 = cf.sec.cover ? 1 : 0;
    doc.pages.forEach((pg, i) => {
      doc.page = pg;
      if (i < c0) { doc.text(L, PDF.H - 26, `${date}`, { size: 8, color: MUT }); doc.text(Rr, PDF.H - 26, `${N} pages`, { size: 8, color: MUT, align: 'right' }); return; }
      doc.line(L, PDF.H - 36, Rr, PDF.H - 36, { color: LINE }); doc.text(L, PDF.H - 22, `${sys.title || 'Focale'}`.slice(0, 80) + ` · ${date}`, { size: 7.8, color: MUT });
      const t = `${i + 1} / ${N}`, w = PDF.measure(t, 8, 'bold') + 14; doc.rrect(Rr - w, PDF.H - 32, w, 15, 7.5, { fill: '#e8eefb' }); doc.text(Rr - w / 2, PDF.H - 21.5, t, { size: 8, font: 'bold', color: ACC2, align: 'center' });
    });
    // sommaire avec numéros de page (sur la page de garde)
    if (tocBox) {
      doc.page = doc.pages[0]; let ty = tocBox.y0; const room = BOT - 10 - ty, main = toc.filter(e => !e.sub), sub = toc.filter(e => e.sub);
      const withSub = (main.length + sub.length) * 15 <= room, lh = Math.min(16, Math.max(11, room / Math.max(1, withSub ? main.length + sub.length : main.length)));
      for (const e of toc) {
        if (e.sub && !withSub) continue; if (ty > BOT - 4) break;
        const x = e.sub ? L + 30 : L, fs = e.sub ? 8.6 : 9.8, f = e.sub ? 'reg' : 'bold', col = e.sub ? '#4b5563' : INK;
        if (!e.sub) { doc.text(L, ty + 3, String(e.n).padStart(2, '0'), { size: 9.8, font: 'bold', color: ACC }); }
        const label = e.sub ? e.t : e.t, x0 = e.sub ? x : L + 22; doc.text(x0, ty + 3, label, { size: fs, font: f, color: col });
        const pg = String(e.pg), xe = Rr - PDF.measure(pg, fs, f) - 6, xs = x0 + PDF.measure(label, fs, f) + 6;
        for (let d = xs; d < xe; d += 4) doc.rect(d, ty + 1.8, 0.9, 0.9, { fill: '#b6c0ce' });
        doc.text(Rr, ty + 3, pg, { size: fs, font: f, color: col, align: 'right' }); ty += lh;
      }
    }
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
