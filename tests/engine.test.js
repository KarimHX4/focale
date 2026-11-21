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
console.log(fail ? `${fail} échec(s)` : 'Tous les tests passent'); process.exit(fail ? 1 : 0);
