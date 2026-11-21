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
{ const B = OE.tolBase(S['Miroir parabolique f/4 (Newton)'](), 'WFE', true);
  near('Tolérancement : parabole nominale au foyer', B.focus, 0, 1e-4);
  const c = S['Triplet de Cooke f=50 F/5'](), T = OE.tolBase(c, 'WFE', true), items = OE.tolItems(T.base, OE.tolDefaults());
  near('Tolérancement : nombre de tolérances (Cooke)', items.length, 50, 0);
  near('Tolérancement : perturbation nulle = nominal', OE.tolEval(OE.tolApply(structuredClone(T.base), items[0], 0), 'WFE', true, T.h0).c, T.nominal, 1e-6); }
console.log(fail ? `${fail} échec(s)` : 'Tous les tests passent'); process.exit(fail ? 1 : 0);
