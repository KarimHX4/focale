'use strict';
/* =====================================================================
   FOCALE — plans de fabrication des lentilles selon ISO 10110 (PDF)
   Un plan par lentille : coupe cotée (épaisseur au centre, épaisseur au bord, diamètres, rayons),
   tableau ISO 10110 (surface gauche | matériau | surface droite) et cartouche.
   Tolérances reprises du tolérancement (liste détaillée) quand elles existent, sinon valeurs par défaut.
   ===================================================================== */
const DRW_DEF = { author: '', margin: 1, chamfer: 0.2, coat: 'AR (λ de travail)', imp: '3×0,16', laser: '', bub: '1/ 3×0,16', inh: '2/ 1;1', stress: '0/ 20', cent: 3, fr: 3, irr: 1, dt: 0.05, dn: 0.001, dv: 0.8, sel: null };
function drwCfg() { if (!DRW.cfg) { try { DRW.cfg = { ...DRW_DEF, ...JSON.parse(localStorage.getItem('focale.drw') || '{}') }; } catch (e) { DRW.cfg = { ...DRW_DEF }; } } return DRW.cfg; }
const DRW = { cfg: null };
function drwSave() { try { localStorage.setItem('focale.drw', JSON.stringify(DRW.cfg)); } catch (e) { } }
/** lentilles du système : paires (i, i+1) dont le milieu entre les deux dioptres est un verre */
function lensElems(M) {
  const S = M.S, out = []; let n = 0;
  for (let i = 1; i < M.N - 1; i++) {
    if (OE.isAir(S[i].glass) || OE.isMirror(S[i]) || S[i].elem === 'ideal') continue;
    n++; out.push({ n, i, k: i + 1, glass: S[i].glass, cemL: i > 1 && !OE.isAir(S[i - 1].glass) && !OE.isMirror(S[i - 1]), cemR: !OE.isAir(S[i + 1].glass) && !OE.isMirror(S[i + 1]) && i + 1 < M.N - 1 });
  }
  return out;
}
/** tolérances de fabrication d'une lentille, d'après la liste de tolérancement (sinon valeurs par défaut du plan) */
function drwTols(e, cf) {
  let L = []; try { const c = tolCfg(); L = (Array.isArray(c.list) ? c.list : OE.tolGen(App.sys, c)).filter(it => it.on !== false); } catch (err) { L = []; }
  const tv = (type, j) => { const it = L.find(q => q.type === type && q.j === j); return it ? Math.max(Math.abs(+it.min || 0), Math.abs(+it.max || 0)) : null; };
  const surf = j => { const fr = tv('TFRN', j), ir = tv('TIRR', j), tl = Math.max(tv('TSTX', j) || 0, tv('TSTY', j) || 0, tv('TETX', e.i) || 0, tv('TETY', e.i) || 0);
    return { fr: fr ?? cf.fr, ir: ir ?? cf.irr, cent: tl ? tl * 60 : cf.cent, src: fr != null || ir != null || tl ? 'tol' : 'def' }; };
  return { s1: surf(e.i), s2: surf(e.k), dt: tv('TTHI', e.i) ?? cf.dt, dn: tv('TIND', e.i) ?? cf.dn, dv: tv('TABB', e.i) ?? cf.dv, ed: Math.max(tv('TEDX', e.i) || 0, tv('TEDY', e.i) || 0), fromTol: L.length > 0 };
}
function openDrawings() {
  const M = App.M; if (!M || !M.ok) { toast('Système invalide'); return; }
  const E = lensElems(M), cf = drwCfg(); if (!E.length) { toast('Aucune lentille dans le système'); return; }
  const sel = cf.sel && cf.sel.length === E.length ? cf.sel : E.map(() => true);
  const inp = (k, l, w = 90, title = '') => `<label class="row" title="${esc(title)}" style="gap:6px"><span style="width:190px">${l}</span><input class="in" data-dw="${k}" value="${esc(String(cf[k] ?? ''))}" style="width:${w}px"></label>`;
  dlg(`<h2>Plans de fabrication (ISO 10110) <button class="x" data-d="close">✕</button></h2><div class="db" style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px">
    <div><h4 class="th4" style="margin-top:0">Lentilles</h4>
      ${E.map((e, k) => { const t = drwTols(e, cf); return `<label class="row" style="gap:8px"><input type="checkbox" data-dws="${k}" ${sel[k] ? 'checked' : ''}><b>L${e.n}</b> S${e.i}–S${e.k} · ${esc(e.glass)} · ${fmt(Math.abs(M.S[e.i].t), 5)} mm${e.cemR ? ' · collée à la suivante' : ''}<span class="hint">${t.fromTol ? ' (tolérances du tolérancement)' : ''}</span></label>`; }).join('')}
      <p class="hint">Un plan A4 par lentille : coupe à l'échelle cotée (épaisseur au centre avec sa tolérance, épaisseur au bord, diamètre extérieur, diamètres utiles, rayons CX/CC, chanfreins), tableau ISO 10110 à trois colonnes et cartouche. Les tolérances de forme (3/), de centrage (4/), d'épaisseur et de matériau viennent de la liste du tolérancement quand elle existe (puissance et irrégularité en franges à 632,8 nm), sinon des valeurs ci-contre.</p></div>
    <div><h4 class="th4" style="margin-top:0">Indications par défaut</h4>
      ${inp('author', 'Dessinateur', 150)}${inp('margin', 'Surépaisseur de bord (mm, sur le rayon)', 60, 'Diamètre extérieur = diamètre utile maximal + 2 × cette valeur')}${inp('chamfer', 'Chanfreins de protection (mm)', 60)}
      ${inp('fr', '3/ Puissance (franges)', 60)}${inp('irr', '3/ Irrégularité (franges)', 60)}${inp('cent', '4/ Centrage (minutes d\'arc)', 60)}${inp('dt', 'Épaisseur au centre ± (mm)', 60)}
      ${inp('dn', 'Indice nd ±', 60)}${inp('dv', 'Constringence νd ± (%)', 60)}${inp('imp', '5/ Défauts de surface', 90, 'ISO 10110-7, ex. 3×0,16')}${inp('coat', 'Traitement', 150)}
      ${inp('stress', 'Biréfringence (0/, nm/cm)', 90)}${inp('bub', 'Bulles et inclusions (1/)', 90)}${inp('inh', 'Homogénéité, stries (2/)', 90)}${inp('laser', '6/ Tenue au flux laser', 150, 'Laisser vide si sans objet')}</div></div>
    <div class="df"><span class="hint grow" id="dwmsg"></span><button class="tb pri" data-d="dwgen">Générer le PDF</button></div>`, true, { w: 980, h: 640 });
}
function drwEvent(t) {
  const cf = drwCfg();
  if (t.dataset.dw) { const k = t.dataset.dw, num = ['margin', 'chamfer', 'fr', 'irr', 'cent', 'dt', 'dn', 'dv'].includes(k); if (num) { const v = parseFloat(String(t.value).replace(',', '.')); if (!(v >= 0)) { toast('Valeur invalide'); t.value = cf[k]; return; } cf[k] = v; } else cf[k] = t.value; drwSave(); }
  if (t.dataset.dws != null) { const E = lensElems(App.M); cf.sel = cf.sel && cf.sel.length === E.length ? cf.sel : E.map(() => true); cf.sel[+t.dataset.dws] = t.checked; drwSave(); }
}
async function genDrawings() {
  const M = App.M, cf = drwCfg(), E = lensElems(M), sel = cf.sel && cf.sel.length === E.length ? cf.sel : E.map(() => true), msg = t => { const e = $('#dwmsg'); if (e) e.textContent = t; };
  const doc = new PDF.Doc(), W = PDF.W, H = PDF.H, ctx = M.ctxs[M.pw], date = new Date().toLocaleDateString('fr-FR'), INK = '#111827', MUT = '#6b7686', LN = '#9aa3af', ACC = '#2563eb';
  const f = (v, d = 3) => fmt(+(+v).toFixed(d), 8).replace('.', ',');
  let pages = 0;
  for (let q = 0; q < E.length; q++) {
    if (!sel[q]) continue; const e = E[q], S = M.S, s1 = ctx.s[e.i], s2 = ctx.s[e.k], t = S[e.i].t, sg = t < 0 ? -1 : 1, tc = Math.abs(t);
    const sd1 = S[e.i].sd, sd2 = S[e.k].sd, Rout = Math.max(sd1, sd2) + cf.margin, T = drwTols(e, cf);
    const sagC = (sf, y, lim) => { let z = OE.sag(sf, 0, Math.min(Math.abs(y), lim)); return isFinite(z) ? z : 0; };
    const lim1 = (() => { let y = Rout; while (y > 0 && !isFinite(OE.sag(s1, 0, y))) y *= 0.98; return y; })(), lim2 = (() => { let y = Rout; while (y > 0 && !isFinite(OE.sag(s2, 0, y))) y *= 0.98; return y; })();
    const z1 = y => sg * sagC(s1, y, lim1), z2 = y => tc + sg * sagC(s2, y, lim2);
    const te = z2(Rout) - z1(Rout), zmin = Math.min(...[0, Rout * 0.5, Rout].map(y => z1(y))), zmax = Math.max(...[0, Rout * 0.5, Rout].map(y => z2(y)));
    // échelle normalisée (1 mm = 72/25,4 pt)
    const mm = 72 / 25.4, boxW = 250, boxH = 280, kRaw = Math.min(boxW / ((zmax - zmin) * mm), boxH / (2 * Rout * mm));
    const nice = [0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 4, 5, 10, 20].filter(v => v <= kRaw).pop() || 0.1, k = nice * mm, sc = nice >= 1 ? `${f(nice, 2)}:1` : `1:${f(1 / nice, 2)}`;
    const cx = 230, cy = 250, X = z => cx + (z - (zmin + zmax) / 2) * k, Y = y => cy - y * k;
    doc.addPage(); pages++;
    // cadre
    doc.rect(18, 18, W - 36, H - 36, { stroke: INK, w: 0.8 }); doc.rect(24, 24, W - 48, H - 48, { stroke: INK, w: 0.4 });
    doc.text(36, 46, `Lentille L${e.n} — ${S[e.i].comment || App.sys.title || ''}`.slice(0, 80), { size: 13, font: 'bold', color: INK });
    doc.text(W - 36, 46, 'ISO 10110', { size: 9, color: MUT, align: 'right' });
    // contour de la lentille
    const N = 60, P = [];
    for (let a = 0; a <= N; a++) { const y = -Rout + 2 * Rout * a / N; P.push([X(z1(y)), Y(y)]); }
    for (let a = N; a >= 0; a--) { const y = -Rout + 2 * Rout * a / N; P.push([X(z2(y)), Y(y)]); }
    doc.poly(P, { fill: '#e6effc', stroke: INK, w: 0.9, close: true });
    // zones utiles (diamètres utiles) : traits épais sur chaque face
    const zone = (zf, sd) => { const Q = []; for (let a = 0; a <= 30; a++) { const y = -sd + 2 * sd * a / 30; Q.push([X(zf(y)), Y(y)]); } doc.poly(Q, { stroke: ACC, w: 2.2 }); };
    zone(z1, sd1); zone(z2, sd2);
    // axe optique
    doc.line(X(zmin) - 30, cy, X(zmax) + 30, cy, { color: INK, w: 0.4, dash: [10, 2, 2, 2] });
    // cotes
    const arrow = (x, y, dx, dy) => { const L = 5, w = 1.8, n = Math.hypot(dx, dy) || 1, ux = dx / n, uy = dy / n; doc.poly([[x, y], [x - ux * L - uy * w, y - uy * L + ux * w], [x - ux * L + uy * w, y - uy * L - ux * w]], { fill: INK, close: true }); };
    const dimH = (za, zb, yy, lab, ext) => { const xa = X(za), xb = X(zb); if (ext) { doc.line(xa, ext[0], xa, yy - 3, { color: LN, w: 0.4 }); doc.line(xb, ext[1], xb, yy - 3, { color: LN, w: 0.4 }); } doc.line(xa, yy, xb, yy, { color: INK, w: 0.5 }); arrow(xa, yy, xa - xb, 0); arrow(xb, yy, xb - xa, 0); doc.text((xa + xb) / 2, yy - 4, lab, { size: 8.5, color: INK, align: 'center' }); };
    const dimV = (x, ya, yb, lab, side = 1) => { doc.line(x, Y(ya), x, Y(yb), { color: INK, w: 0.5 }); arrow(x, Y(ya), 0, Y(ya) - Y(yb)); arrow(x, Y(yb), 0, Y(yb) - Y(ya)); doc.text(x + side * 5, cy - 3, lab, { size: 8.5, color: INK, align: side > 0 ? 'left' : 'right' }); };
    const topY = Y(Rout) - 26, botY = Y(-Rout) + 26;
    dimH(z1(0), z2(0), topY, `${f(tc, 3)} ± ${f(T.dt, 3)}`, [cy - 4, cy - 4]);
    doc.line(X(z1(0)), cy, X(z1(0)), topY + 3, { color: LN, w: 0.4 }); doc.line(X(z2(0)), cy, X(z2(0)), topY + 3, { color: LN, w: 0.4 });
    dimH(z1(-Rout), z2(-Rout), botY, `${f(te, 3)} (réf.)`, [Y(-Rout) + 2, Y(-Rout) + 2]);
    doc.line(X(z1(-Rout)), Y(-Rout), X(z1(-Rout)), botY - 3, { color: LN, w: 0.4 }); doc.line(X(z2(-Rout)), Y(-Rout), X(z2(-Rout)), botY - 3, { color: LN, w: 0.4 });
    const xr = Math.max(X(zmax), X(z2(Rout))) + 40;
    doc.line(X(z2(Rout)), Y(Rout), xr + 4, Y(Rout), { color: LN, w: 0.4 }); doc.line(X(z2(-Rout)), Y(-Rout), xr + 4, Y(-Rout), { color: LN, w: 0.4 });
    dimV(xr, Rout, -Rout, `Ø ${f(2 * Rout, 2)} h9`, 1);
    const xl = Math.min(X(zmin), X(z1(Rout))) - 40;
    doc.line(X(z1(sd1)), Y(sd1), xl - 4, Y(sd1), { color: LN, w: 0.4, dash: [2, 2] }); doc.line(X(z1(-sd1)), Y(-sd1), xl - 4, Y(-sd1), { color: LN, w: 0.4, dash: [2, 2] });
    dimV(xl, sd1, -sd1, `Ø utile ${f(2 * sd1, 2)}`, -1);
    // rayons
    const rl = (r, sfz, side) => { const isF = !isFinite(r) || Math.abs(r) > 1e8, conv = isF ? '' : ((side < 0 ? r > 0 : r < 0) ? ' CX' : ' CC'); return isF ? 'R ∞ (plan)' : `R ${f(Math.abs(r), 3)}${conv}`; };
    const yR = Rout * 0.62;
    doc.line(X(z1(yR)), Y(yR), X(z1(yR)) - 48, Y(yR) - 40, { color: INK, w: 0.4 }); doc.text(X(z1(yR)) - 50, Y(yR) - 43, rl(sg * S[e.i].r, z1, -1), { size: 9, font: 'bold', color: INK, align: 'right' });
    doc.line(X(z2(yR)), Y(yR), X(z2(yR)) + 48, Y(yR) - 40, { color: INK, w: 0.4 }); doc.text(X(z2(yR)) + 50, Y(yR) - 43, rl(sg * S[e.k].r, z2, 1), { size: 9, font: 'bold', color: INK });
    if (OE.ASPK.some(a => S[e.i][a]) || S[e.i].k) doc.text(X(z1(yR)) - 50, Y(yR) - 32, `asphérique (k = ${f(S[e.i].k || 0, 4)})`, { size: 7.5, color: MUT, align: 'right' });
    if (OE.ASPK.some(a => S[e.k][a]) || S[e.k].k) doc.text(X(z2(yR)) + 50, Y(yR) - 32, `asphérique (k = ${f(S[e.k].k || 0, 4)})`, { size: 7.5, color: MUT });
    doc.text(36, 468, `Chanfreins de protection : ${f(cf.chamfer, 2)} × 45° max. · Échelle ${sc} · Cotes en mm${te <= 0.3 ? ' · ⚠ épaisseur au bord faible' : ''}${e.cemR ? ` · collée à L${e.n + 1} (face S${e.k})` : ''}${e.cemL ? ` · collée à L${e.n - 1} (face S${e.i})` : ''}`, { size: 8.5, color: te <= 0.3 ? '#b45309' : MUT });
    // tableau ISO 10110
    const tx = 36, ty = 484, tw = W - 72, cw = tw / 3, rh = 15;
    const g = OE.glassInfo(e.glass) || {}, rec = OE.glassRecord(e.glass);
    const col1 = [['Surface gauche', `S${e.i}`], ['R', rl(sg * S[e.i].r, z1, -1).replace('R ', '')], ['Ø utile', f(2 * sd1, 2)], ['Traitement', cf.coat || '—'], ['3/', `${f(T.s1.fr, 2)}(${f(T.s1.ir, 2)})`], ['4/', `${f(T.s1.cent, 1)}′`], ['5/', cf.imp || '—'], ['6/', cf.laser || '—']];
    const col2 = [['Matériau', `${e.glass}${rec ? ' (' + rec.cat + ')' : ''}`], ['nd', `${isFinite(g.nd) ? f(g.nd, 5) : '—'} ± ${f(T.dn, 4)}`], ['νd', `${isFinite(g.vd) ? f(g.vd, 2) : '—'} ± ${f(T.dv, 2)} %`], ['0/', cf.stress || '—'], ['1/', (cf.bub || '—').replace(/^1\/\s*/, '')], ['2/', (cf.inh || '—').replace(/^2\/\s*/, '')], ['Épaisseur', `${f(tc, 3)} ± ${f(T.dt, 3)}`], ['Centrage', T.ed ? `décentrement ≤ ${f(T.ed, 3)} mm` : '—']];
    const col3 = [['Surface droite', `S${e.k}`], ['R', rl(sg * S[e.k].r, z2, 1).replace('R ', '')], ['Ø utile', f(2 * sd2, 2)], ['Traitement', e.cemR ? 'collage' : (cf.coat || '—')], ['3/', `${f(T.s2.fr, 2)}(${f(T.s2.ir, 2)})`], ['4/', `${f(T.s2.cent, 1)}′`], ['5/', cf.imp || '—'], ['6/', cf.laser || '—']];
    [col1, col2, col3].forEach((C, ci) => { const x0 = tx + ci * cw; C.forEach(([a, b], ri) => { const yy = ty + ri * rh; if (ri === 0) doc.rect(x0, yy, cw, rh, { fill: '#eef2f7' }); doc.rect(x0, yy, cw, rh, { stroke: LN, w: 0.4 });
      doc.text(x0 + 4, yy + 10.5, a, { size: 8, font: ri === 0 ? 'bold' : 'reg', color: ri === 0 ? INK : MUT }); doc.text(x0 + cw - 4, yy + 10.5, String(b).slice(0, 32), { size: 8.5, font: ri === 0 ? 'bold' : 'mono', color: INK, align: 'right' }); }); });
    doc.para(tx, ty + 8 * rh + 14, tw, `3/ A(B) : écart de puissance A et irrégularité B en franges (λ = 632,8 nm) sur le diamètre utile. 4/ : erreur de centrage (inclinaison de la surface par rapport à l'axe de référence). 5/ : défauts de surface (ISO 10110-7). 0/ biréfringence (nm/cm), 1/ bulles et inclusions, 2/ homogénéité et stries. Tolérances ${T.fromTol ? 'issues de la liste de tolérancement de Focale' : 'par défaut (aucune liste de tolérancement)'}.`, { size: 7.5, color: MUT, lh: 10 });
    // cartouche
    const bx = W - 36 - 300, by = H - 36 - 72;
    doc.rect(bx, by, 300, 72, { stroke: INK, w: 0.6 }); doc.line(bx, by + 24, bx + 300, by + 24, { color: INK, w: 0.4 }); doc.line(bx, by + 48, bx + 300, by + 48, { color: INK, w: 0.4 }); doc.line(bx + 150, by + 24, bx + 150, by + 72, { color: INK, w: 0.4 });
    doc.text(bx + 6, by + 16, `${App.sys.title || 'Système'} — L${e.n} (S${e.i}–S${e.k})`.slice(0, 60), { size: 10, font: 'bold', color: INK });
    doc.text(bx + 6, by + 40, `Échelle ${sc}`, { size: 8.5, color: INK }); doc.text(bx + 156, by + 40, `Date ${date}`, { size: 8.5, color: INK });
    doc.text(bx + 6, by + 64, `Dessinateur : ${cf.author || '—'}`.slice(0, 34), { size: 8.5, color: INK }); doc.text(bx + 156, by + 64, `Feuille ${pages} · Focale`, { size: 8.5, color: INK });
    doc.text(36, H - 36 - 86, 'Dimensions en mm · tolérances générales ISO 2768-m · indications selon ISO 10110', { size: 7.5, color: MUT });
    msg(`Plan L${e.n}…`); await tick();
  }
  if (!pages) { msg('Aucune lentille sélectionnée'); return; }
  const bytes = doc.build({ title: `Plans de fabrication — ${App.sys.title || ''}`, author: cf.author }); App._lastDrw = bytes;
  await download(`${fileBase()}_plans_ISO10110.pdf`, new Blob([bytes], { type: 'application/pdf' }));
  msg(`PDF généré : ${pages} plan(s)`);
}
