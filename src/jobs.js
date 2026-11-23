'use strict';
/* =====================================================================
   FOCALE — calculs longs exécutables en tâche de fond (Web Worker) ou, à défaut, dans la page.
   Chaque tâche : async (args, prog) → résultat clonable ; prog(fait, total, partiel?) signale l'avancement
   (et peut lever une exception pour interrompre le calcul dans la page).
   ===================================================================== */
const JOBS = {
  /** FTM (diffraction ou géométrique) de tous les champs du système */
  async mtf(a, prog) {
    const M = OE.prepare(a.sys); if (!M.ok) throw new Error('Système invalide');
    const F = M.sys.fields, o = a.o || {};
    const sc = F.map(f => M.wls.map((_, wi) => { const q = OE.pupilScale(M, f, wi); return { dM: q.dM, dL: q.dL }; }));
    const fmax = o.fmax || Math.max(...sc.flatMap(r => r.map((q, wi) => Math.max(q.dM, q.dL) / M.ctxs[wi].lmm)));
    const res = [];
    for (let i = 0; i < F.length; i++) {
      const r = o.geo ? OE.mtfGeo(M, i, { fmax, dl: o.dl !== false }) : OE.mtf(M, i, { fmax, N: o.N || 64 });
      res.push({ f: r.f, T: r.T, S: r.S, DL: r.DL }); if (prog) await prog(i + 1, F.length);
    }
    return { res, sc, fmax };
  },
  thermal: async (a, prog) => { if (prog) await prog(0, 1); return OE.thermalScan(a.sys, a.o); },
  tfmtf: (a, prog) => OE.throughFocus(a.sys, a.o, prog),
  mtffield: (a, prog) => OE.mtfField(a.sys, a.o, prog),
  relillum: (a, prog) => OE.relIllum(a.sys, a.o, prog),
  mcsum: async a => OE.mcSummary(a.sys).map(o => { const r = { ...o }; delete r.M; return r; }),
  /** tolérancement : système nominal compensé */
  tolBase: async a => OE.tolBase(a.sys, a.crit, a.comp, a.o),
  /** sensibilités d'une liste d'éléments */
  async tolSens(a, prog) {
    const out = [];
    for (let i = 0; i < a.items.length; i++) { const r = OE.tolSens(a.B, a.items[i], a.crit, a.comp, a.o); out.push(r); if (prog) await prog(i + 1, a.items.length, { k: a.k0 + i, r }); }
    return out;
  },
  /** tolérances inverses d'une liste d'éléments (d0 : dégradation déjà connue par la sensibilité) */
  async tolInv(a, prog) {
    const out = [];
    for (let i = 0; i < a.items.length; i++) { const r = OE.tolInverse(a.B, a.items[i], a.crit, a.comp, a.dmax, { ...a.o, d0: a.d0[i] }); out.push(r); if (prog) await prog(i + 1, a.items.length, { k: a.k0 + i, r }); }
    return out;
  },
  /** tirages Monte-Carlo à valeurs imposées */
  async tolMC(a, prog) {
    const out = [];
    for (let i = 0; i < a.draws.length; i++) { const r = OE.tolTrialD(a.B, a.items, a.crit, a.comp, a.draws[i], a.o); out.push(r); if (prog) await prog(i + 1, a.draws.length, { k: a.k0 + i, r }); }
    return out;
  },
};
if (typeof module !== 'undefined') module.exports = JOBS;
