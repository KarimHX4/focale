// Tests de non-régression du moteur : node tests/engine.test.js
const OE = require('../src/engine.js'), S = require('../src/samples.js'), IO = require('../src/io.js');
let fail = 0;
const near = (name, v, ref, tol) => { const ok = Math.abs(v - ref) <= tol; if (!ok) fail++; console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}: ${v.toFixed(6)} (attendu ${ref} ± ${tol})`); };
const g = OE.glassInfo('N-BK7'); near('N-BK7 nd', g.nd, 1.5168, 1e-4); near('N-BK7 vd', g.vd, 64.17, 0.02);
let M = OE.prepare(S['Triplet de Cooke f=50 F/5']()); near('Cooke EFL', M.par.efl, 50.0214, 1e-3);
M = OE.prepare(S['Doublet achromatique f=100']()); near('Doublet EFL', M.par.efl, 100.0711, 1e-3);
M = OE.prepare(S['Miroir parabolique f/4 (Newton)']()); near('Parabole Strehl axe', OE.psf(M, 0, 0, 64, 256).strehl, 1, 1e-3); near('Parabole SI', OE.seidel(M).sum.SI, 0, 1e-12);
M = OE.prepare(S['Télescope Cassegrain F/7.5']()); near('Cassegrain EFL', M.par.efl, 1500, 1e-6); near('Cassegrain WFE axe', OE.wavefront(M, 0, 0, 48).rms, 0, 1e-3);
const s = S['Triplet de Cooke f=50 F/5'](); s.rayAiming = true; M = OE.prepare(s);
const P = []; OE.ray(M, 1, 20, 0, 1, { pts: P }); near('Visée réelle sur diaphragme', P[3][1], M.par.stopR, 1e-6);
{ const A = OE.prepare(S['Miroir parabolique f/4 (Newton)']()), B = OE.prepare(S['Newton replié (miroir plan à 45°)']());
  near('Newton replié EFL', B.par.efl, A.par.efl, 1e-9); near('Image repliée Y', B.fr[B.N].o[1], -150, 1e-9); near('Newton replié spot axe (µm)', OE.spot(B, 0, 21).rms * 1e3, 0, 1e-6); }
{ const c = S['Triplet de Cooke f=50 F/5'](); c.fields = [{ x: 0, y: 20 }, { x: 20, y: 0 }]; const M = OE.prepare(c);
  near('Symétrie champ X / champ Y (µm)', OE.spot(M, 1, 21).rms * 1e3, OE.spot(M, 0, 21).rms * 1e3, 1e-6); }
{ const par = S['Miroir parabolique f/4 (Newton)'](); par.fields = [{ x: 0, y: 0, w: 1 }]; const B = OE.tolBase(par, 'WFE', true);
  near('Tolérancement : parabole nominale au foyer', B.focus, 0, 1e-4);
  const c = S['Triplet de Cooke f=50 F/5'](), T = OE.tolBase(c, 'WFE', true), items = OE.tolItems(T.base, OE.tolDefaults());
  near('Tolérancement : nombre de tolérances (Cooke)', items.length, 59, 0);
  near('Tolérancement : perturbation nulle = nominal', OE.tolEval(OE.tolApply(structuredClone(T.base), items[0], 0), 'WFE', true, T.h0).c, T.nominal, 1e-6); }
{ let bad = 0; for (const g of OE.catalog()) { const r = OE.glassRecord(g.name); if (r.nd && Math.abs(g.nd - r.nd) > 2e-4) bad++; }
  near('Catalogues : nd recalculé = nd fabricant (écarts)', bad, 0, 0); near('Catalogues : nombre de verres > 1000', Math.min(1, OE.catalog().length / 1000), 1, 0);
  near('Verre Ohara S-BSL7 nd', OE.glassInfo('S-BSL7').nd, 1.51633, 1e-4); near('Nom CODE V NBK7_SCHOTT', OE.glassInfo('NBK7_SCHOTT').nd, 1.5168, 1e-4);
  const r = OE.parseAGF('NM AGFTEST 2 517642 1.5168 64.17 0 0\nCD 1.03961212 0.00600069867 0.231792344 0.0200179144 1.01046945 103.560653 0 0 0 0\n', 'TESTCAT'); OE.addGlasses(r, true);
  near('Import AGF (Sellmeier) nd', OE.glassInfo('AGFTEST').nd, 1.5168, 1e-4); }
{ const zr = 10, c9 = 0.002, a = S['Lentille plan-convexe f=100'](), b = S['Lentille plan-convexe f=100']();
  Object.assign(a.surfaces[2], { type: 'ZERN', zr, zc: [0, 0, 0, 0, 0, 0, 0, 0, c9] });
  const k4 = 6 * c9 / zr ** 4, k2 = -6 * c9 / zr ** 2; Object.assign(b.surfaces[2], { type: 'XY', xy: { '4,0': k4, '0,4': k4, '2,2': 2 * k4, '2,0': k2, '0,2': k2 }, dz: c9, dmode: 'DAR' });
  const ra = OE.ray(OE.prepare(a), 1, { x: 0, y: 2 }, 0.3, 0.7), rb = OE.ray(OE.prepare(b), 1, { x: 0, y: 2 }, 0.3, 0.7);
  near('Surface Zernike ≡ polynôme XY équivalent (mm)', Math.hypot(ra.x - rb.x, ra.y - rb.y), 0, 1e-9); }
{ const Sf = (r, t, o = {}) => ({ r, t, glass: '', sd: 0, k: 0, ...o });
  const sys = s => ({ title: '', aperture: { type: 'EPD', value: 10, obscuration: 0 }, fields: [{ x: 0, y: 0, w: 1 }, { x: 0, y: 5, w: 1 }], wavelengths: [{ um: 0.55, w: 1 }], primary: 0, surfaces: s });
  let M = OE.prepare(sys([Sf(Infinity, Infinity), Sf(Infinity, 10, { stop: true }), Sf(Infinity, 50, { elem: 'grating', lpmm: 600, gm: 1 }), Sf(Infinity, 0)]));
  near('Réseau : sin θ = m λ / d', OE.ray(M, 0, { x: 0, y: 0 }, 0, 0).M, 0.33, 1e-9);
  M = OE.prepare(sys([Sf(Infinity, Infinity), Sf(Infinity, 100, { stop: true, elem: 'ideal', fid: 100 }), Sf(Infinity, 0)]));
  near('Lentille idéale : spot hors axe (µm)', OE.spot(M, 1, 21).rms * 1e3, 0, 1e-6); near('Lentille idéale : WFE hors axe (λ)', OE.wavefront(M, 1, 0, 32).rms, 0, 1e-6);
  M = OE.prepare(sys([Sf(Infinity, Infinity), Sf(Infinity, 10, { stop: true, elem: 'polarizer', pang: 30 }), Sf(Infinity, 10), Sf(Infinity, 0)]));
  near('Polariseur : loi de Malus', OE.polPupil(M, 0, 0, 'X', 5, false).T, 0.75, 1e-6);
  M = OE.prepare(sys([Sf(Infinity, Infinity), Sf(Infinity, 10, { stop: true, elem: 'waveplate', ret: 0.25, wang: 45 }), Sf(Infinity, 10), Sf(Infinity, 0)]));
  const o = OE.polPupil(M, 0, 0, 'X', 3, false).pts.find(q => !q.px && !q.py).o; near('Lame λ/4 à 45° : circulaire |S3/S0|', Math.abs(o.S[3] / o.S[0]), 1, 1e-9);
  M = OE.prepare(sys([Sf(Infinity, Infinity), Sf(Infinity, 5, { stop: true, glass: 'N-BK7' }), Sf(Infinity, 10), Sf(Infinity, 0)])); const n = OE.glassN('N-BK7', 0.55);
  near('Fresnel : lame N-BK7 à incidence normale', OE.polPupil(M, 0, 0, 'X', 3, true).pts.find(q => !q.px && !q.py).I, (1 - ((n - 1) / (n + 1)) ** 2) ** 2, 1e-9);
  M = OE.prepare(S['Spectrographe à réseau 600 traits/mm']()); near('Spectrographe : 550 nm centré', OE.ray(M, 1, { x: 0, y: 0 }, 0, 0).y, 0, 0.01); }
{ const M = OE.prepare(S['Système fini 1:1 (relais)']());
  near('Source : couplage fibre ON 0,22 dans ON 0,05', OE.extSource(M, 0, { type: 'disk', d: 50, na: 0.22 }).coupling, (0.05 / 0.22) ** 2, 1e-3);
  near('Source : taille géométrique fente 100 µm (grandissement 1)', OE.extSource(M, 0, { type: 'rect', w: 20, h: 100 }).fwhmY * 1e3, 100, 2);
  const s = S['Miroir parabolique f/4 (Newton)'](); s.fields = [{ x: 0, y: 0 }]; const P = OE.prepare(s);
  near('Source ponctuelle : FWHM = 1,029 λF (µm)', OE.extSource(P, 0, { type: 'point' }).fwhmX * 1e3, 1.029 * 0.5875618 * 4, 0.05);
  near('Pixel : FTM à Nyquist = 2/π', OE.detMTF(1 / (2 * 0.003), 0.003, 1), 2 / Math.PI, 1e-9);
  const ps = OE.psf(P, 0, 0, 64, 256); near('Pixel : somme des énergies 41×41 ≈ 1', OE.binPSF(ps.I, ps.P, ps.dx, 0.003, 'centre', 41).G.reduce((a, b) => a + b, 0), 1, 0.01); }
{ const fi = OE.fiberInfo({ fib: 'sm', core: 8.2, na: 0.14 }, 1.55); near('Fibre : V (SMF-28, 1550 nm)', fi.V, 2 * Math.PI * 4.1 * 0.14 / 1.55, 1e-9); near('Fibre : coupure (nm)', fi.lc * 1000, 1500, 2);
  const M = OE.prepare(S['Système fini 1:1 (relais)']()), t = 0.05 / 0.22;
  near('Fibre GI : couplage 2t² − t⁴', OE.extSource(M, 0, { type: 'fiber', fib: 'gi', core: 50, na: 0.22 }).coupling, 2 * t * t - t ** 4, 1e-3);
  near('Fibre SI : couplage (ON sys / ON fibre)²', OE.extSource(M, 0, { type: 'fiber', fib: 'si', core: 50, na: 0.22 }).coupling, t * t, 1e-3); }
{ const sig = s => { s = structuredClone(s); s.aperture.obscuration = 0; const M = OE.prepare(s); return M.sys.fields.map((f, i) => OE.spot(M, i, 11).rms).concat([M.par.efl]); };
  const diff = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));
  for (const k of ['Triplet de Cooke f=50 F/5', 'Newton replié (miroir plan à 45°)', 'Spectrographe à réseau 600 traits/mm', 'Télescope Cassegrain F/7.5', 'Système fini 1:1 (relais)']) {
    const s = S[k](); s.surfaces.forEach(x => { for (const q of ['dx', 'dy', 'dz', 'tx', 'ty', 'tz']) x[q] = x[q] || 0; x.dmode = x.dmode || 'DEC'; }); s.fields = s.fields.map(f => ({ x: 0, ...f }));
    near(`Aller-retour Zemax : ${k}`, diff(sig(s), sig(IO.parseZMX(IO.toZMX(s).text).sys)), 0, 1e-6);
    if (!k.startsWith('Spectro')) near(`Aller-retour CODE V : ${k}`, diff(sig(s), sig(IO.parseSeq(IO.toSeq(s).text).sys)), 0, 1e-6);
  }
  const txt = IO.toZMX(S['Triplet de Cooke f=50 F/5']()).text, b = Buffer.concat([Buffer.from([0xFF, 0xFE]), Buffer.from(txt, 'utf16le')]);
  near('Zemax UTF-16 : EFL', OE.prepare(IO.parseZMX(IO.decode(b)).sys).par.efl, 50.0214, 1e-3);
  IO.parseSeq("WL 656.3 587.6 486.1\nPRV\nPWL 656.3 587.6 486.1\n'TESTPRV' 1.51432 1.51680 1.52238\nEND\nSO 0 1e18\nSTO 50 4 'TESTPRV'\nS -50 45\nSI 0 0");
  near('CODE V : verre privé PRV (nd)', OE.glassInfo('TESTPRV').nd, 1.5168, 2e-4); }
// Conventions CODE V / Zemax et diffraction
{ const s = S['Lentille plan-convexe f=100'](); s.aperture.value = 4; s.fields = [{ y: 0 }]; s.wavelengths = [{ um: 0.5875618, w: 1 }]; s.primary = 0;
  const M = OE.prepare(s), SI = OE.seidel(M).sum.SI, W = OE.wavefront(M, 0, 0, 64, true);
  near('OPD : signe CODE V/Zemax, W040 (Z9×6) = SI/8 (λ)', W.zern[8] * 6, SI / 8 / 0.5875618e-3, 2e-4);
  const r = OE.ray(M, 0, { x: 0, y: 0 }, 0, 1).y, uK = M.par.mar.nu[M.N - 1]; near('Seidel : aberration transverse = SI/(2 n′u′)', r, SI / (2 * uK), 2e-5);
  const f = S['Système fini 1:1 (relais)'](); f.aperture = { type: 'FNO', value: 8, obscuration: 0 }; const F = OE.prepare(f);
  near('F/# en conjugué fini : EPD = EFL / F#', F.par.epd, Math.abs(F.par.efl) / 8, 1e-9);
  const o = S['Miroir parabolique f/4 (Newton)'](); o.fields = [{ y: 0 }]; o.aperture.obscuration = 0.4; const O = OE.prepare(o), m = OE.mtf(O, 0, { fmax: 1 / (0.5875618e-3 * 4) });
  near('FTM obstruée : courbe limite = FTM sans aberration (ν = 0,5 fc)', m.DL[40], m.T[40], 0.01);
  const e = OE.encircled(O, 0); near('Énergie encerclée croissante et ≤ 1', e.D.every((v, i) => v <= 1 + 1e-9 && (!i || v >= e.D[i - 1] - 1e-12)) ? 1 : 0, 1, 0); }
// Tolérancement : nouvelles tolérances, FTM, inverse, Monte-Carlo
{ const c = S['Triplet de Cooke f=50 F/5'](), B = OE.tolBase(c, 'WFE', true), base = B.base, items = OE.tolItems(base, OE.tolDefaults());
  const find = (t, j) => items.find(i => i.type === t && i.j === j);
  const fr = find('TFRN', 1), s1 = OE.tolApply(structuredClone(base), fr, 2).surfaces[1], h = fr.h, sag = r => (r2 => r2 / (s1.r + Math.sqrt(s1.r * s1.r - r2)))(h * h);
  const sag0 = (r => h * h / (r + Math.sqrt(r * r - h * h)))(base.surfaces[1].r);
  near('Puissance : 2 franges = écart de flèche λ (mm) au bord', sag() - sag0, 0.6328e-3, 2e-6);
  const ir = find('TIRR', 2), s2 = OE.tolApply(structuredClone(base), ir, 1), M2 = OE.prepare(s2), M0 = OE.prepare(base);
  const dz = (x, y) => OE.sag(M2.ctxs[0].s[2], x, y) - OE.sag(M0.ctxs[0].s[2], x, y);
  near('Irrégularité : 1 frange = λ/2 PV (bord, axe Y)', dz(0, ir.h), 0.6328e-3 / 2, 1e-9); near('Irrégularité : moitié sur l\'axe X', dz(ir.h, 0), 0.6328e-3 / 4, 1e-9);
  const ab = find('TABB', 1), sa = OE.tolApply(structuredClone(base), ab, 1), g = sa.surfaces[1].glass;
  const V = sys => { const M = OE.prepare(sys), n = l => OE.prepare({ ...sys, wavelengths: [{ um: l }], primary: 0 }).nW[0][1]; return (n(0.5875618) - 1) / (n(0.4861327) - n(0.6562725)); };
  near('Constringence : +1 % sur νd', V(sa) / V(base), 1.01, 1e-6);
  const ip = find('TSDY', 3), inv = OE.tolInverse(B, ip, 'WFE', true, 0.01);
  const chk = Math.max(...[inv.t, -inv.t].map(v => OE.tolWorse('WFE', OE.tolEval(OE.tolApply(structuredClone(base), ip, v), 'WFE', true, B.h0).c, B.nominal)));
  near('Tolérance inverse : Δ obtenu = Δ visé (0,01 λ)', chk, 0.01, 0.0008);
  const r1 = OE.rng(42), r2 = OE.rng(42); near('Monte-Carlo : graine reproductible', OE.tolTrial(B, items, 'WFE', true, 'normal', r1).c - OE.tolTrial(B, items, 'WFE', true, 'normal', r2).c, 0, 0);
  const r = OE.rng(7); let ext = 0; for (let k = 0; k < 4000; k++) if (Math.abs(OE.tolDraw('para', r)) > 0.5) ext++; near('Distribution parabolique : P(|x| > ½) = 7/8', ext / 4000, 0.875, 0.02);
  near('Arrondi fabricant', OE.niceDown(0.0347), 0.03, 1e-12);
  const o = S['Miroir parabolique f/4 (Newton)'](); o.fields = [{ y: 0 }]; const O = OE.prepare(o), nu = 0.5 / (0.5875618e-3 * 4);
  near('Critère FTM : parabole = limite de diffraction (ν = fc/2)', OE.criterion(O, 'MTF', { mtfF: nu }), OE.mtfDL(0.5), 0.015); }
// Optimisation : quick focus, longueur d'onde du critère, contraintes, variables asphériques
{ const d = S['Doublet achromatique f=100']();
  near('λ centrale (F, d, C) = d', OE.wlSel(d, 'central')[0], 1, 0); near('λ centrale (4 λ) = la plus proche du milieu', OE.wlSel({ ...d, wavelengths: [{ um: 0.4 }, { um: 0.5 }, { um: 0.62 }, { um: 0.7 }] }, 'central')[0], 1, 0);
  const q = OE.quickFocus(d, { crit: 'WFE', wl: 'central' }), s2 = structuredClone(d); s2.surfaces[3].tsolve = ''; s2.surfaces[3].t = OE.prepare(d).S[3].t; s2.surfaces[3].vt = true; s2.merit = { image: 'WFE', ops: [], wl: 'central' };
  const st = { sys: s2, mu: 1e-3 }; for (let i = 0; i < 40; i++) if (OE.optStep(st).done) break;
  near('Quick focus = optimisation de la dernière épaisseur sur la λ centrale (mm)', q.t, st.sys.surfaces[3].t, 2e-3);
  near('Quick focus : le critère ne se dégrade pas', Math.min(0, q.before - q.after), 0, 1e-12);
  const c = S['Triplet de Cooke f=50 F/5'](), M = OE.prepare(c), tt = M.par.ttl;
  c.merit = { image: 'NONE', ops: [{ type: 'TTL', target: tt + 5, weight: 1, cmp: 'le' }, { type: 'TTL', target: tt - 5, weight: 1, cmp: 'le' }, { type: 'TTL', target: tt + 5, weight: 1, cmp: 'ge' }] };
  const r = OE.residuals(c); near('Contrainte ≤ respectée : résidu nul', r.parts[0].r2, 0, 0); near('Contrainte ≤ violée de 5 mm', Math.sqrt(r.parts[1].r2), 5, 1e-9); near('Contrainte ≥ violée de 5 mm', Math.sqrt(r.parts[2].r2), 5, 1e-9);
  const ax = OE.opValue(M, { type: 'AXCL' }).val, cs = OE.chromShift(M, 40); near('AXCL = décalage focal λmax − λmin (mm)', ax, (cs.dz[cs.dz.length - 1] - cs.dz[0]) / 1000, 1e-6);
  const p = S['Lentille plan-convexe f=100'](); p.wavelengths = [{ um: 0.5875618, w: 1 }]; p.primary = 0; p.fields = [{ y: 0 }]; p.surfaces[1].va4 = true; p.merit = { image: 'WFE', ops: [] };
  const m0 = OE.meritOf(OE.residuals(p).f), sp = { sys: p, mu: 1e-3 }; for (let i = 0; i < 30; i++) if (OE.optStep(sp).done) break;
  near('Variable A4 : la sphérique est réduite d\'au moins 90 %', OE.meritOf(OE.residuals(sp.sys).f) / m0 < 0.1 ? 1 : 0, 1, 0); }
// Verres variables : verre modèle, RGLA, substitution
{ const d = S['Doublet achromatique f=100'](); d.surfaces[2].glass = OE.toModel('N-SF5'); d.surfaces[2].vg = true; [1, 2, 3].forEach(j => d.surfaces[j].vr = true);
  near('Verre modèle : nd de N-SF5 conservé', OE.parseModel(d.surfaces[2].glass).nd, 1.67271, 2e-5);
  near('Variables nd et νd ajoutées', OE.getVars(d).filter(v => v.kind === 'nd' || v.kind === 'vd').length, 2, 0);
  d.merit = { image: 'SPOT', wl: 'all', ops: [{ type: 'EFL', target: 100, weight: 1 }, { type: 'AXCL', target: 0, weight: 5 }, { type: 'RGLA', target: 0, weight: 0.002 }] };
  const st = { sys: d, mu: 1e-3 }; for (let i = 0; i < 80; i++) if (OE.optStep(st).done) break;
  near('Verre modèle optimisé : chromatisme axial annulé (µm)', OE.opValue(OE.prepare(st.sys), { type: 'AXCL' }).val * 1e3, 0, 0.5);
  const m = OE.parseModel(st.sys.surfaces[2].glass), c = OE.glassNearest(m.nd, m.vd, { k: 6 }); let best = null; for (const g of c) { const r = OE.subTry(st.sys, 2, g.name, 12); if (!best || r.m < best.m) best = { ...r, g: g.name }; }
  near('Substitution : verre réel du catalogue', OE.glassRecord(best.sys.surfaces[2].glass) ? 1 : 0, 1, 0);
  near('Substitution : chromatisme axial < 5 µm', Math.abs(OE.opValue(OE.prepare(best.sys), { type: 'AXCL' }).val * 1e3) < 5 ? 1 : 0, 1, 0);
  near('Catalogue filtré (préférentiels Schott)', OE.glassNearest(1.5168, 64.17, { cats: ['SCHOTT'], pref: true, k: 50 }).every(g => g.cat === 'SCHOTT') ? 1 : 0, 1, 0); }
// Données système (CODE V) : environnement, types de champ, vignetage, ouvertures, asphères d'ordre élevé
{ const mk = T => ({ T, P: 1, Tref: 20, sys: {}, cache: new Map(), miss: new Set() });
  const n20 = OE.envN('N-BK7', 0.5461, mk(20)), n40 = OE.envN('N-BK7', 0.5461, mk(40));
  near('N-BK7 dn/dT absolu 546 nm (Schott : 1,6e-6)', (n40 * OE.nAir(0.5461, 40, 1) - n20 * OE.nAir(0.5461, 20, 1)) / 20 * 1e6, 1.6, 0.1);
  near('N-BK7 dn/dT relatif 546 nm (Schott : 3,0e-6)', (n40 - n20) / 20 * 1e6, 3.0, 0.1);
  near('Indice de l\'air 550 nm, 15 °C', (OE.nAir(0.55, 15, 1) - 1) * 1e4, 2.778, 0.01);
  const p = S['Lentille plan-convexe f=100'](); p.wavelengths = [{ um: 0.5875618, w: 1 }]; p.primary = 0;
  const M0 = OE.prepare(p), q = structuredClone(p); q.env = { T: 40 }; const M1 = OE.prepare(q);
  const n0 = OE.glassN('N-BK7', 0.5875618), n1 = OE.envN('N-BK7', 0.5875618, mk(40)), a = OE.glassTherm('N-BK7').cte;
  near('Singulet chauffé : Δf = f (α ΔT − Δn / (n − 1)) (µm)', (M1.par.efl - M0.par.efl) * 1e3, M0.par.efl * (a * 20 - (n1 - n0) / (n0 - 1)) * 1e3, 0.05);
  const v = structuredClone(p); v.env = { P: 0 }; near('Vide : indice relatif ≈ n × n_air (plus la dispersion)', OE.prepare(v).nW[0][1] / M0.nW[0][1], OE.nAir(0.5875618, 20, 1), 1e-5); }
{ const r = S['Système fini 1:1 (relais)'](), M = OE.prepare(r), H = M.sys.fields.map(f => f.y);
  for (const ty of ['ang', 'pim', 'rim']) { const c = structuredClone(r), v = OE.convertFields(r, ty); c.ftype = ty; c.fields = c.fields.map((f, i) => ({ ...f, ...v[i] }));
    const Mc = OE.prepare(c); near(`Type de champ ${ty} : aller-retour vers la hauteur objet`, Math.max(...Mc.sys.fields.map((f, i) => Math.abs(f.y - H[i]))), 0, 1e-7); }
  const c = structuredClone(r); c.ftype = 'rim'; c.fields = [{ y: 0 }, { y: 3 }]; const Mr = OE.prepare(c);
  near('Hauteur image réelle : rayon principal à 3 mm', OE.ray(Mr, Mr.pw, Mr.sys.fields[1], 0, 0).y, 3, 1e-8);
  const k = structuredClone(S['Triplet de Cooke f=50 F/5']()); k.ftype = 'pim'; k.fields = [{ y: 0 }, { y: 10 }]; const Mk = OE.prepare(k);
  near('Hauteur image paraxiale : Y = f tan θ', Math.tan(Mk.sys.fields[1].y * Math.PI / 180) * Mk.par.efl, 10, 1e-9); }
{ const c = S['Triplet de Cooke f=50 F/5'](); let M = OE.prepare(c);
  c.surfaces.forEach((s, j) => { if (j > 0 && j < M.N) { s.sd = M.S[j].sd * 0.93; s.sdFixed = true; } });
  const V = OE.setVignetting(c); c.fields = c.fields.map((f, i) => ({ ...f, ...V.fields[i] })); M = OE.prepare(c);
  const f = M.sys.fields[M.sys.fields.length - 1];
  near('SET VIG : facteurs non nuls hors axe', V.fields[V.fields.length - 1].vuy + V.fields[V.fields.length - 1].vly > 0.02 ? 1 : 0, 1, 0);
  near('SET VIG : rayons limites ±Y transmis', [OE.ray(M, M.pw, f, 0, 1), OE.ray(M, M.pw, f, 0, -1), OE.ray(M, M.pw, f, 1, 0)].filter(r => r.vig).length, 0, 0);
  const vm = OE.vigMap(f); near('SET VIG : au-delà du bord, rayon arrêté', OE.ray(M, M.pw, f, 0, vm.cy + vm.hy + 0.02, { noVig: true }).vig ? 1 : 0, 1, 0); }
{ const c = S['Triplet de Cooke f=50 F/5'](); c.aperture = { type: 'NAI', value: 0.1, obscuration: 0 }; near('Ouverture ON image', OE.prepare(c).par.imgSpaceNA, 0.1, 1e-9);
  c.aperture = { type: 'STOP', value: 3, obscuration: 0 }; near('Ouverture fixée par le diaphragme (demi-diamètre)', OE.prepare(c).par.stopR, 3, 1e-9);
  const p = S['Lentille plan-convexe f=100'](); p.surfaces[1].a12 = 1e-14; const M = OE.prepare(p);
  near('Asphère A12 : flèche r¹²', OE.sag(M.ctxs[0].s[1], 0, 10) - OE.sag(OE.prepare(S['Lentille plan-convexe f=100']()).ctxs[0].s[1], 0, 10), 1e-14 * 1e12, 1e-12); }
// Import CODE V : qualificatifs de surface, vignetage, environnement, verres fictifs, asphères E…J, aller-retour
{ const r = IO.parseSeq(require('fs').readFileSync(__dirname + '/codev_cmds.seq', 'utf8')), S = r.sys.surfaces;
  near('.seq : THI S7 (qualificatif de surface)', S[7].t, 4, 0); near('.seq : CIR EDG ignoré, CIR lu', S[1].sd, 4.2, 0);
  near('.seq : SLB → commentaire', S[4].comment === 'L2' && S[1].comment === 'L1 avant' ? 1 : 0, 1, 0);
  near('.seq : verre fictif 743972.448504 → nd', OE.parseModel(S[1].glass).nd, 1.743972, 1e-9); near('.seq : GLC 0 → verre variable', S[1].vg ? 1 : 0, 1, 0);
  near('.seq : verre « 1.62:36.4 »', OE.parseModel(S[6].glass).vd, 36.4, 1e-9); near('.seq : coefficient E → A12', S[2].a12, 1e-10, 0);
  near('.seq : WTW W2 2', r.sys.wavelengths[1].w, 2, 0); near('.seq : VUY F3 / liste', r.sys.fields[2].vuy + r.sys.fields[2].vux, 0.2027 + 0.0228, 1e-12);
  near('.seq : TEM → environnement', r.sys.env.T, 25, 0); near('.seq : aucune « commande ignorée » non expliquée', r.warnings.filter(w => /ignorée$/.test(w)).length, 0, 0);
  const back = IO.parseSeq(IO.toSeq(r.sys).text).sys; near('.seq : aller-retour des champs et du vignetage', JSON.stringify(back.fields) === JSON.stringify(r.sys.fields) ? 1 : 0, 1, 0);
  const z = IO.parseZMX(IO.toZMX(r.sys).text).sys; near('.zmx : aller-retour vignetage VCY/VDY', Math.abs(z.fields[2].vly - 0.1112) + Math.abs(z.fields[2].vuy - 0.2027), 0, 1e-12);
  const c = S; const yim = IO.parseSeq('EPD 10\nWL 587.56\nYIM 0 5\nSO 0 1e20\nSTO 50 5 NBK7_SCHOTT\nS -50 90\nSI 0 0\nGO').sys; near('.seq : YIM → champs en hauteur image paraxiale', yim.ftype === 'pim' && yim.fields[1].y === 5 ? 1 : 0, 1, 0); }
console.log(fail ? `${fail} échec(s)` : 'Tous les tests passent'); process.exit(fail ? 1 : 0);
