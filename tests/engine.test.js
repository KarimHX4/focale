// Tests de non-régression du moteur : node tests/engine.test.js
const OE = require('../src/engine.js'), S = require('../src/samples.js');
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
  near('Tolérancement : nombre de tolérances (Cooke)', items.length, 50, 0);
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
console.log(fail ? `${fail} échec(s)` : 'Tous les tests passent'); process.exit(fail ? 1 : 0);
