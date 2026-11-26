'use strict';
/* =====================================================================
   FOCALE — moteur optique (tracé séquentiel réel + paraxial + diffraction)
   Conventions : unités mm, longueurs d'onde en µm, axe optique z,
   champ dans le plan YZ, convention de signes type Zemax/CODE V
   (épaisseurs négatives après un miroir).
   ===================================================================== */
const OE = (() => {
  const DEG = Math.PI / 180;

  /* ---------------- Verres : registre (catalogues fabricants + verres importés AGF) ---------------- */
  const SPECIAL = [
    ['F_SILICA', [0, 0.6961663, 0.004679148, 0.4079426, 0.01351206, 0.8974794, 97.934003], 0.21, 6.7],
    ['CAF2', [0, 0.5675888, 0.00252643, 0.4710914, 0.01007833, 3.8484723, 1200.556], 0.23, 9.7],
  ];
  const ALIAS = { BK7: 'N-BK7', SK16: 'N-SK16', SF11: 'N-SF11', LAK9: 'N-LAK9', LASF9: 'N-LASF9', BAK1: 'N-BAK1', BAK4: 'N-BAK4', K5: 'N-K5', FK51A: 'N-FK51A', BAF10: 'N-BAF10', SF57: 'N-SF57',
    SILICA: 'F_SILICA', FUSEDSILICA: 'F_SILICA', SIO2: 'F_SILICA', SILICASPECIAL: 'F_SILICA', CAF2SPECIAL: 'CAF2' };
  const REG = new Map(), QUAL = new Map(), ALL = [], CATS = new Set(['SPECIAL']);
  const gnorm = s => String(s || '').toUpperCase().replace(/[\s\-_]/g, '');
  /** coefficients asphériques pairs A4…A20 (r⁴ … r²⁰) */
  const ASPK = ['a4', 'a6', 'a8', 'a10', 'a12', 'a14', 'a16', 'a18', 'a20'];
  let dbReady = false;
  function dispN(r, l) {
    const c = r.c, l2 = l * l;
    switch (r.f) {
      case 'R2': { let n2 = 1 + c[0]; for (let i = 1; i + 1 < c.length; i += 2) n2 += c[i] * l2 / (l2 - c[i + 1]); return Math.sqrt(n2); }
      case 'CY': return c[0] + c[1] / l2 + c[2] / (l2 * l2); // Cauchy (verres privés CODE V)
      case 'R3': { let n2 = c[0]; for (let i = 1; i + 1 < c.length; i += 2) n2 += c[i] * Math.pow(l, c[i + 1]); return Math.sqrt(n2); }
      case 'A1': return Math.sqrt(c[0] + c[1] * l2 + c[2] / l2 + c[3] / l2 ** 2 + c[4] / l2 ** 3 + c[5] / l2 ** 4);
      case 'A2': return Math.sqrt(1 + c[0] * l2 / (l2 - c[1]) + c[2] * l2 / (l2 - c[3]) + c[4] * l2 / (l2 - c[5]));
      case 'A3': { const L = 1 / (l2 - 0.028); return c[0] + c[1] * L + c[2] * L * L + c[3] * l2 + c[4] * l2 * l2 + c[5] * l2 ** 3; }
      case 'A4': return Math.sqrt(1 + c[0] + c[1] * l2 / (l2 - c[2] * c[2]) + c[3] / (l2 - c[4] * c[4]));
      case 'A5': return c[0] + c[1] / l + c[2] / Math.pow(l, 3.5);
      case 'A6': return Math.sqrt(1 + c[0] * l2 / (l2 - c[1]) + c[2] * l2 / (l2 - c[3]) + c[4] * l2 / (l2 - c[5]) + c[6] * l2 / (l2 - c[7]));
      case 'A7': return Math.sqrt(c[0] + c[1] / (l2 - c[2]) - c[3] * l2);
      case 'A8': return Math.sqrt(c[0] + c[1] * l2 / (l2 - c[2]) - c[3] * l2);
      case 'A9': return Math.sqrt(c[0] + c[1] * l2 / (l2 - c[2]) + c[3] * l2 / (l2 - c[4]));
      case 'A10': return Math.sqrt(c[0] + c[1] * l2 + c[2] / l2 + c[3] / l2 ** 2 + c[4] / l2 ** 3 + c[5] / l2 ** 4 + c[6] / l2 ** 5 + c[7] / l2 ** 6);
      case 'A11': return Math.sqrt(1 + c[0] * l2 / (l2 - c[1]) + c[2] * l2 / (l2 - c[3]) + c[4] * l2 / (l2 - c[5]) + c[6] * l2 / (l2 - c[7]) + c[8] * l2 / (l2 - c[9]));
      case 'A12': return Math.sqrt(c[0] + c[1] * l2 + c[2] / l2 + c[3] / l2 ** 2 + c[4] / l2 ** 3 + c[5] / l2 ** 4 + c[6] * l2 * l2 + c[7] * l2 ** 3);
      case 'A13': return Math.sqrt(c[0] + c[1] * l2 + c[2] * l2 * l2 + c[3] / l2 + c[4] / l2 ** 2 + c[5] / l2 ** 3 + c[6] / l2 ** 4 + c[7] / l2 ** 5 + c[8] / l2 ** 6);
    }
    return NaN;
  }
  /** ajoute des verres au registre ; replace : remplace un verre de même nom et même catalogue */
  function addGlasses(recs, replace) {
    let n = 0;
    for (const r0 of recs) {
      const r = { ...r0, cat: String(r0.cat || 'USER').toUpperCase() }, k = gnorm(r.name), qk = k + '@' + r.cat;
      CATS.add(r.cat);
      const old = QUAL.get(qk);
      if (old) { if (!replace) continue; Object.assign(old, r, { key: old.key }); delete old.ndv; n++; continue; }
      r.key = REG.has(k) ? `${r.name}_${r.cat}` : r.name;
      REG.set(gnorm(r.key), r); if (!REG.has(k)) REG.set(k, r); QUAL.set(qk, r); ALL.push(r); n++;
    }
    return n;
  }
  function ensureDB() {
    if (dbReady) return; dbReady = true;
    addGlasses(SPECIAL.map(([name, c, a, b]) => ({ name, cat: 'SPECIAL', f: 'R2', c, lmin: a, lmax: b })));
    let db = typeof GLASSDB !== 'undefined' ? GLASSDB : null;
    if (!db && typeof require === 'function') { try { db = require('./glasses.js'); } catch (e) { db = null; } }
    if (db) addGlasses(db.g.map(g => ({ name: g[0], cat: db.cats[g[1]], f: 'R' + g[2], c: g[3], lmin: g[4], lmax: g[5], nd: g[6], vd: g[7], st: g[8] })));
  }
  function glassRecord(name) {
    ensureDB();
    const u = String(name || '').trim(); if (!u) return null;
    let r = REG.get(gnorm(u)); if (r) return r;
    const m = u.match(/^(.+?)[\s_]*\(?([A-Za-z]+)\)?$/);
    if (m && CATS.has(m[2].toUpperCase())) { r = QUAL.get(gnorm(m[1]) + '@' + m[2].toUpperCase()); if (r) return r; }
    const al = ALIAS[gnorm(u)] || (m && ALIAS[gnorm(m[1])]); if (al) return REG.get(gnorm(al)) || null;
    return null;
  }
  function glassKey(name) { const r = glassRecord(name); return r ? r.key : null; }
  function isMirror(s) { return (s.glass || '').trim().toUpperCase() === 'MIRROR'; }
  function isAir(name) { const u = (name || '').trim().toUpperCase(); return u === '' || u === 'AIR'; }
  /** indice d'un milieu ; NaN si verre inconnu */
  function glassN(name, l) {
    if (isAir(name)) return 1;
    const r = glassRecord(name);
    if (r) return dispN(r, l);
    const m = String(name).match(/^\s*([0-9.]+)\s*[,\/;:]\s*([0-9.]+)\s*(?:[,\/;:]\s*(-?[0-9.]+)\s*)?$/); // modèle nd/νd[/ΔPgF]
    if (m) return modelN(+m[1], +m[2], m[3] != null ? +m[3] : 0, l);
    const v = parseFloat(name);
    if (isFinite(v) && v >= 1 && /^\s*[0-9.]+\s*$/.test(name)) return v;
    return NaN;
  }
  /**
   * Verre modèle (nd, νd, ΔPg,F) : n = A + B/λ² + C/λ⁴ ajusté sur nd, nF − nC = (nd − 1)/νd et la dispersion partielle
   * Pg,F = 0,6438 − 0,001682 νd + ΔPg,F (« ligne normale » de Schott, comme le verre modèle d'OpticStudio) :
   * la dispersion dans le bleu et le violet suit celle des verres réels.
   */
  const MODC = new Map();
  /* Verre fictif nd/νd : modèle « ligne normale » de CODE V — la forme normalisée (n(λ) − nd)/(nF − nC) est linéaire en νd
     (toutes les dispersions partielles sur une droite normale), écrite en coordonnée chromatique de Buchdahl ω (3 termes).
     Coefficients κk = p + q·νd étalonnés sur les indices CODE V (validation DigCamera, 656/589/430 nm, écart < 1 ppm).
     ΔPgF ajoute la déformation de la loi de Cauchy (nd et nF − nC conservés). */
  const MODP = [-4.88928951, 3.48615848, 1.28012392], MODQ = [-0.00491961, -0.0658905, -0.01222097];
  const bOm = l => { const d = l - 0.5875618; return d / (1 + 2.5 * d); };
  function modelN(nd, vd, dP, l) {
    const key = nd + '|' + vd + '|' + dP; let c = MODC.get(key);
    if (!c) {
      const D = vd > 0 ? (nd - 1) / vd : 0, k = MODP.map((p, i) => p + MODQ[i] * vd);
      const oF = bOm(0.4861327), oC = bOm(0.6562725), S = k.reduce((a, x, i) => a + x * (oF ** (i + 1) - oC ** (i + 1)), 0);
      let cd = [0, 0];
      if (dP) {
        const xd = 1 / 0.5875618 ** 2, xF = 1 / 0.4861327 ** 2, xC = 1 / 0.6562725 ** 2, xg = 1 / 0.4358343 ** 2;
        const a11 = xF - xC, a12 = xF * xF - xC * xC, a21 = xg - xF, a22 = xg * xg - xF * xF, det = a11 * a22 - a12 * a21;
        cd = [-dP * D * a12 / det, a11 * dP * D / det]; cd.push(xd);
      }
      c = { D, k: k.map(x => x / S), cd }; if (MODC.size > 500) MODC.clear(); MODC.set(key, c);
    }
    const w = bOm(l); let n = nd + c.D * (c.k[0] * w + c.k[1] * w * w + c.k[2] * w * w * w);
    if (dP) { const x = 1 / (l * l), xd = c.cd[2]; n += c.cd[0] * (x - xd) + c.cd[1] * (x * x - xd * xd); }
    return n;
  }
  function recInfo(r) {
    if (!r.ndv) { const nd = dispN(r, 0.5875618), nF = dispN(r, 0.4861327), nC = dispN(r, 0.6562725); r.ndv = { nd, vd: (nd - 1) / (nF - nC) }; }
    return r.ndv;
  }
  function glassInfo(name) {
    const r = glassRecord(name); if (r) return recInfo(r);
    const nd = glassN(name, 0.5875618), nF = glassN(name, 0.4861327), nC = glassN(name, 0.6562725);
    return { nd, vd: (nd - 1) / (nF - nC) };
  }
  const catalog = () => { ensureDB(); return ALL.map(r => ({ name: r.key, base: r.name, cat: r.cat, st: r.st || 's', user: !!r.user, lmin: r.lmin, lmax: r.lmax, ...recInfo(r) })); };
  /* ---------------- Environnement : température, pression, dn/dT (Schott), dilatation ---------------- */
  /* ---------------- Propriétés des verres : densité, résistances, prix relatif, transmission interne ---------------- */
  let PROPDB = null;
  function propDB() { if (PROPDB) return PROPDB; PROPDB = typeof GLASSPROP !== 'undefined' ? { P: GLASSPROP, L: GLASSPROP_L } : null;
    if (!PROPDB && typeof require === 'function') { try { const m = require('./glassprop.js'); PROPDB = { P: m.GLASSPROP, L: m.GLASSPROP_L }; } catch (e) { PROPDB = { P: {}, L: [] }; } }
    return PROPDB || (PROPDB = { P: {}, L: [] }); }
  /** propriétés d'un verre : dens (g/cm³), dpgf, res [CR, FR, SR, AR, PR], cost (prix relatif à N-BK7, AGF), it [[λ µm, τ pour 10 mm]] */
  function glassProps(name) {
    const r = glassRecord(name); if (!r) return null; const D = propDB(), p = D.P[r.cat] && D.P[r.cat][r.name];
    const o = { name: r.key, cat: r.cat, st: r.st || 's', dens: r.dens ?? (p && p[0] ? p[0] : null), dpgf: p ? p[1] : null, res: r.res || (p ? p.slice(2, 7) : null), cost: r.cost ?? null, it: null };
    if (r.it && r.it.length) o.it = r.it.slice().sort((a, b) => a[0] - b[0]);
    else if (p && p[7]) o.it = D.L.map((l, k) => [l, p[7][k] / 1000]).filter(q => q[1] >= 0);
    return o;
  }
  /** transmission interne d'un verre (sans réflexions) pour une épaisseur d (mm) à λ (µm) ; NaN si inconnue */
  function glassTau(name, l, d = 10) {
    if (!name || isAir(name) || String(name).toUpperCase() === 'MIRROR') return 1;
    const p = glassProps(name); if (!p || !p.it || !p.it.length) return NaN; const T = p.it;
    if (l < T[0][0] - 1e-9 || l > T[T.length - 1][0] + 1e-9) return NaN;
    let t10 = T[T.length - 1][1]; for (let k = 0; k + 1 < T.length; k++) if (l >= T[k][0] && l <= T[k + 1][0]) { const f = (l - T[k][0]) / (T[k + 1][0] - T[k][0] || 1); t10 = T[k][1] + f * (T[k + 1][1] - T[k][1]); break; }
    return Math.pow(Math.max(1e-9, t10), Math.abs(d) / 10);
  }
  /** transmission interne du système le long de l'axe (produit des verres traversés) */
  function sysTau(sys, l) { let t = 1; const S = sys.surfaces; for (let j = 1; j < S.length - 1; j++) { if (isAir(S[j].glass) || isMirror(S[j])) continue; const v = glassTau(S[j].glass, l, S[j].t); if (isFinite(v)) t *= v; else return NaN; } return t; }
  let THDB = null;
  const THSPECIAL = { F_SILICA: [2.4e-5, 0, 0, 0, 0, 0, 0.51e-6, 1], CAF2: [-2.9e-5, 0, 0, 0, 0, 0, 18.85e-6, 1] }; // valeurs approchées
  function thDB() {
    if (THDB) return THDB;
    THDB = typeof GLASSTH !== 'undefined' ? GLASSTH : null;
    if (!THDB && typeof require === 'function') { try { THDB = require('./glassth.js'); } catch (e) { THDB = {}; } }
    return THDB || (THDB = {});
  }
  /** matériaux sans données thermiques (milieux d'air, miroir) */
  const isSolid = g => !isAir(g) && String(g || '').trim().toUpperCase() !== 'MIRROR';
  /**
   * Données thermiques d'un verre : { D: [D0, D1, D2, E0, E1, λTK], T0, cte (/K), dn (dn/dT disponible), src }.
   * Ordre de priorité : valeurs saisies dans sys.env.mat[clé], fichier AGF importé (TD/ED), base des catalogues fabricants.
   */
  function glassTherm(name, sys) {
    if (!isSolid(name)) return null;
    const r = glassRecord(name), key = r ? r.key : String(name).trim();
    let d = null;
    if (r && (r.th || r.cte)) d = { D: (r.th || [0, 0, 0, 0, 0, 0]).slice(0, 6), T0: r.th ? r.th[6] : 20, cte: r.cte || 0, dn: !!r.th, src: 'AGF' };
    else if (r) {
      const t = r.cat === 'SPECIAL' ? THSPECIAL[r.name] : (thDB()[r.cat] || {})[r.name];
      if (t) d = { D: t.slice(0, 6), T0: 20, cte: t[6] || 0, dn: !!t[7], src: r.cat === 'SPECIAL' ? 'approché' : r.cat };
    }
    const ov = sys && sys.env && sys.env.mat && sys.env.mat[key];
    if (ov) {
      const D = ['D0', 'D1', 'D2', 'E0', 'E1', 'ltk'].map((k, i) => isFinite(+ov[k]) && ov[k] !== '' && ov[k] != null ? +ov[k] : (d ? d.D[i] : 0));
      d = { D, T0: isFinite(+ov.T0) && ov.T0 != null ? +ov.T0 : (d ? d.T0 : 20), cte: isFinite(+ov.cte) && ov.cte != null ? +ov.cte * 1e-6 : (d ? d.cte : 0), dn: D.some(v => v) , src: 'saisi' };
    }
    return d;
  }
  /** indice de l'air (Zemax / Edlén simplifié) ; λ en µm, T en °C, P en atmosphères */
  function nAir(l, T, P) {
    const l2 = l * l, nr = 1 + 1e-8 * (6432.8 + 2949810 * l2 / (146 * l2 - 1) + 25540 * l2 / (41 * l2 - 1));
    return 1 + (nr - 1) * P / (1 + 3.4785e-3 * (T - 15));
  }
  /** contexte d'environnement (null aux conditions nominales 20 °C, 1 atm, prescription à 20 °C) */
  function envCtx(sys) {
    const e = sys.env || {}, f = (v, d) => (v != null && v !== '' && isFinite(+v) ? +v : d);
    const T = f(e.T, 20), P = f(e.P, 1), Tref = f(e.Tref, 20);
    if (Math.abs(T - 20) < 1e-12 && Math.abs(P - 1) < 1e-12 && Math.abs(Tref - 20) < 1e-12) return null;
    return { T, P, Tref, expand: e.expand !== false, mount: f(e.cteMount, 23.6) * 1e-6, sys, cache: new Map(), miss: new Set() };
  }
  /** indice relatif à l'air du système (T, P) — dn/dT absolu selon la formule de Schott, λ ramenée à l'air du catalogue */
  function envN(name, l, E) {
    if (!E || isAir(name)) return glassN(name, l);
    const key = name + '|' + l, c = E.cache.get(key); if (c != null) return c;
    const d = glassTherm(name, E.sys), T0 = d ? d.T0 : 20;
    const na = nAir(l, E.T, E.P), na0 = nAir(l, T0, 1), lr = l * na / na0;
    const n0 = glassN(name, lr);
    let v = n0;
    if (isFinite(n0)) {
      let dn = 0;
      if (d && d.dn) { const [D0, D1, D2, E0, E1, ltk] = d.D, dT = E.T - T0, den = lr * lr - ltk * ltk;
        dn = (n0 * n0 - 1) / (2 * n0) * (D0 * dT + D1 * dT * dT + D2 * dT * dT * dT + (Math.abs(den) > 1e-9 ? (E0 * dT + E1 * dT * dT) / den : 0)); }
      else if (Math.abs(E.T - T0) > 1e-9 && isSolid(name)) E.miss.add(name);
      v = (n0 * na0 + dn) / na;
    }
    E.cache.set(key, v); return v;
  }
  /** dilatation thermique de la prescription (rayons, épaisseurs, asphériques, demi-diamètres fixés) de Tref à T */
  function expandLens(S, E, warn) {
    const dT = E.T - E.Tref; if (!E.expand || Math.abs(dT) < 1e-12) return;
    const N = S.length - 1, unk = new Set();
    const tce = s => (s.tce != null && s.tce !== '' && isFinite(+s.tce) ? +s.tce * 1e-6 : null);
    const aG = (g, s) => { const o = s ? tce(s) : null; if (o != null) return o; const d = glassTherm(g, E.sys); if (d && d.cte) return d.cte; unk.add(g); return 0; };
    const k = S.map(() => 1), kt = S.map(() => 1);
    for (let j = 1; j < N; j++) {
      const s = S[j], a = S[j].glass, b = S[j - 1].glass;
      const ar = isSolid(a) ? aG(a, s) : isSolid(b) && j > 1 ? aG(b, S[j - 1]) : (tce(s) ?? E.mount);
      const at = isSolid(a) ? aG(a, s) : (tce(s) ?? E.mount);
      k[j] = 1 + ar * dT; kt[j] = 1 + at * dT;
    }
    for (let j = 1; j < N; j++) {
      const s = S[j], q = k[j];
      if (isFinite(s.r)) s.r *= q;
      ASPK.forEach((a, i) => { if (s[a]) s[a] *= Math.pow(q, -(3 + 2 * i)); });
      if (s.sdFixed) s.sd *= q;
      if (s.xy) for (const kk of Object.keys(s.xy)) { const [p, r] = kk.split(',').map(Number); s.xy[kk] *= Math.pow(q, 1 - p - r); }
      if (s.zc) { s.zc = s.zc.map(v => v * q); s.zr = (+s.zr || 1) * q; }
      if (isFinite(s.t) && s.tsolve !== 'M') s.t *= kt[j];
    }
    if (unk.size) warn.push(`Dilatation : coefficient (CTE) inconnu pour ${[...unk].join(', ')} — pris égal à 0`);
  }

  /** lecture d'un catalogue Zemax AGF (formules 1 à 13) */
  function parseAGF(text, cat) {
    const recs = []; let cur = null;
    for (const line of String(text).split(/\r?\n/)) {
      const t = line.trim().split(/\s+/), k = (t[0] || '').toUpperCase();
      if (k === 'NM') { cur = { name: t[1], f: 'A' + Math.round(+t[2]), c: [], nd: +t[4], vd: +t[5], cat, user: true, st: ({ 0: 's', 1: 'p', 2: 'o', 3: 's', 4: 's', 5: 'o' })[t[7]] || 's' }; recs.push(cur); }
      else if (k === 'CD' && cur) cur.c = t.slice(1).map(Number);
      else if (k === 'LD' && cur) { cur.lmin = +t[1]; cur.lmax = +t[2]; }
      else if (k === 'TD' && cur) { const v = t.slice(1).map(Number); if (v.length >= 6 && v.slice(0, 6).some(x => x)) cur.th = [...v.slice(0, 6), isFinite(v[6]) ? v[6] : 20]; }
      else if (k === 'ED' && cur) { const v = +t[1]; if (isFinite(v) && v) cur.cte = v * 1e-6; const d = +t[3]; if (isFinite(d) && d > 0) cur.dens = d; }
      else if (k === 'OD' && cur) { const v = t.slice(1).map(Number); if (isFinite(v[0]) && v[0] >= 0) cur.cost = v[0]; if (v.length >= 6) cur.res = v.slice(1, 6).map(x => isFinite(x) ? x : -1); }
      else if (k === 'IT' && cur) { const l = +t[1], tau = +t[2], th = +t[3]; if (l > 0 && tau > 0 && th > 0) (cur.it = cur.it || []).push([l, Math.pow(Math.min(1, tau), 10 / th)]); }
    }
    return recs.filter(r => r.name && r.c.length && isFinite(dispN(r, 0.5875618)));
  }

  /* ---------------- Surfaces ---------------- */
  const curv = s => (s.elem === 'ideal') ? 0 : (isFinite(s.r) && s.r !== 0) ? 1 / s.r : 0;
  function sagR(sf, r2) {
    const c = sf.c; let z = 0;
    if (c !== 0) {
      const a = 1 - (1 + sf.k) * c * c * r2;
      if (a < 0) return NaN;
      z = c * r2 / (1 + Math.sqrt(a));
    }
    if (sf.asph) z += r2 * r2 * (sf.a4 + r2 * (sf.a6 + r2 * (sf.a8 + r2 * (sf.a10 + (sf.hi ? r2 * (sf.a12 + r2 * (sf.a14 + r2 * (sf.a16 + r2 * (sf.a18 + r2 * sf.a20)))) : 0)))));
    return z;
  }
  /** dz/d(r²) * 2  →  dz/dx = x * g */
  function sagG(sf, r2) {
    let g = 0;
    if (sf.c !== 0) {
      const a = 1 - (1 + sf.k) * sf.c * sf.c * r2;
      if (a <= 0) return NaN;
      g = sf.c / Math.sqrt(a);
    }
    if (sf.asph) g += r2 * (4 * sf.a4 + r2 * (6 * sf.a6 + r2 * (8 * sf.a8 + r2 * (10 * sf.a10 + (sf.hi ? r2 * (12 * sf.a12 + r2 * (14 * sf.a14 + r2 * (16 * sf.a16 + r2 * (18 * sf.a18 + r2 * 20 * sf.a20)))) : 0)))));
    return g;
  }

  /** termes de forme libre (polynôme XY, Zernike) — 0 pour une surface standard */
  function ffZ(sf, x, y) { const b = zernBasis(x / sf.zr, y / sf.zr); let z = 0; for (let k = 0; k < sf.zc.length; k++) if (sf.zc[k]) z += sf.zc[k] * b[k]; return z; }
  function ffSag(sf, x, y) {
    let z = 0;
    if (sf.xyT) for (const [i, j, c] of sf.xyT) z += c * Math.pow(x, i) * Math.pow(y, j);
    if (sf.zc) z += ffZ(sf, x, y);
    return z;
  }
  function ffGrad(sf, x, y) {
    let gx = 0, gy = 0;
    if (sf.xyT) for (const [i, j, c] of sf.xyT) { if (i) gx += c * i * Math.pow(x, i - 1) * Math.pow(y, j); if (j) gy += c * j * Math.pow(x, i) * Math.pow(y, j - 1); }
    if (sf.zc) { const h = 1e-6 * sf.zr; gx += (ffZ(sf, x + h, y) - ffZ(sf, x - h, y)) / (2 * h); gy += (ffZ(sf, x, y + h) - ffZ(sf, x, y - h)) / (2 * h); }
    return [gx, gy];
  }
  /** termes de forme libre d'une surface (polynôme XY "i,j" → c, ou Zernike Fringe zc[0..15] sur le rayon zr) */
  function ffTerms(s) {
    const xyT = (s.type === 'XY' || s.type === 'TOR') && s.xy ? Object.entries(s.xy || {}).map(([k, c]) => { const [i, j] = k.split(',').map(Number); return [i, j, +c || 0]; }).filter(t => t[2] && t[0] + t[1] > 0) : null;
    const zc = s.type === 'ZERN' && Array.isArray(s.zc) && s.zc.some(v => +v) ? Array.from({ length: 16 }, (_, k) => +s.zc[k] || 0) : null;
    return { xyT: xyT && xyT.length ? xyT : null, zc, zr: +s.zr > 0 ? +s.zr : 1, ff: !!((xyT && xyT.length) || zc) };
  }
  /** terme polynomial pair (A4…A20) et sa dérivée par rapport à r² (×2) */
  const polyZ = (sf, r2) => r2 * r2 * ((sf.a4 || 0) + r2 * ((sf.a6 || 0) + r2 * ((sf.a8 || 0) + r2 * ((sf.a10 || 0) + r2 * ((sf.a12 || 0) + r2 * ((sf.a14 || 0) + r2 * ((sf.a16 || 0) + r2 * ((sf.a18 || 0) + r2 * (sf.a20 || 0)))))))));
  const polyG = (sf, r2) => r2 * (4 * (sf.a4 || 0) + r2 * (6 * (sf.a6 || 0) + r2 * (8 * (sf.a8 || 0) + r2 * (10 * (sf.a10 || 0) + r2 * (12 * (sf.a12 || 0) + r2 * (14 * (sf.a14 || 0) + r2 * (16 * (sf.a16 || 0) + r2 * (18 * (sf.a18 || 0) + r2 * 20 * (sf.a20 || 0)))))))));
  /** biconique (torique / cylindrique) : z = (cx x² + cy y²) / (1 + √(1 − (1+kx) cx² x² − (1+ky) cy² y²)) + A4 r⁴ + … */
  function torSag(sf, x, y) {
    const F = sf.cx * x * x + sf.c * y * y, A = 1 - (1 + sf.kx) * sf.cx * sf.cx * x * x - (1 + sf.k) * sf.c * sf.c * y * y;
    if (A < 0) return NaN; return F / (1 + Math.sqrt(A)) + polyZ(sf, x * x + y * y);
  }
  function torGrad(sf, x, y) {
    const F = sf.cx * x * x + sf.c * y * y, A = 1 - (1 + sf.kx) * sf.cx * sf.cx * x * x - (1 + sf.k) * sf.c * sf.c * y * y;
    if (A <= 0) return [NaN, NaN]; const q = Math.sqrt(A), D = 1 + q, pg = polyG(sf, x * x + y * y);
    const dqx = -(1 + sf.kx) * sf.cx * sf.cx * x / q, dqy = -(1 + sf.k) * sf.c * sf.c * y / q;
    return [(2 * sf.cx * x * D - F * dqx) / (D * D) + x * pg, (2 * sf.c * y * D - F * dqy) / (D * D) + y * pg];
  }
  /** flèche locale z(x, y) */
  function sag(sf, x, y) { const z = sf.tor ? torSag(sf, x, y) : sagR(sf, x * x + y * y); return sf.ff ? z + ffSag(sf, x, y) : z; }
  /** pente locale [dz/dx, dz/dy] */
  function sGrad(sf, x, y) {
    if (sf.tor) { const t = torGrad(sf, x, y); if (!sf.ff) return t; const f = ffGrad(sf, x, y); return [t[0] + f[0], t[1] + f[1]]; }
    const g = sagG(sf, x * x + y * y); if (!sf.ff) return [x * g, y * g];
    const f = ffGrad(sf, x, y); return [x * g + f[0], y * g + f[1]];
  }

  /** indices signés (paraxial) pour une longueur d'onde */
  function indices(S, l, E) {
    const n = new Array(S.length), gN = E ? (g, x) => envN(g, x, E) : glassN;
    n[0] = gN(S[0].glass, l);
    let sg = 1;
    for (let j = 1; j < S.length; j++) {
      if (isMirror(S[j])) { sg = -sg; n[j] = sg * Math.abs(n[j - 1]); }
      else {
        let v = gN(S[j].glass, l);
        if (!isAir(S[j].glass)) { if (+S[j].dv) { const nd = gN(S[j].glass, 0.5875618); v = nd + (v - nd) / (1 + S[j].dv / 100); } v += +S[j].dn || 0; }
        n[j] = sg * v;
      }
    }
    n.lmm = l * 1e-3; // longueur d'onde (mm) : puissance paraxiale des surfaces diffractives
    return n;
  }

  /* ---------------- Paraxial ---------------- */
  function ptrace(S, n, y1, u0) {
    const N = S.length - 1, y = new Float64Array(N + 1), nu = new Float64Array(N + 1);
    nu[0] = n[0] * u0; y[1] = y1;
    for (let j = 1; j <= N; j++) {
      if (j > 1) y[j] = y[j - 1] + S[j - 1].t * nu[j - 1] / n[j - 1];
      nu[j] = nu[j - 1] - y[j] * curv(S[j]) * (n[j] - n[j - 1]);
      if (S[j].elem === 'ideal' && +S[j].fid) nu[j] -= y[j] * n[j] / +S[j].fid;
      if (S[j].elem === 'doe' && n.lmm) { const R = +S[j].dnr > 0 ? +S[j].dnr : 10, A1 = Array.isArray(S[j].da) ? +S[j].da[0] || 0 : 0, m = S[j].dm == null || S[j].dm === '' ? 1 : +S[j].dm; nu[j] += y[j] * m * n.lmm * A1 / (Math.PI * R * R); }
    }
    return { y, nu };
  }
  function maxField(sys) { return Math.max(1e-9, ...sys.fields.map(f => Math.hypot(+f.x || 0, +f.y || 0))); }

  function paraxial(sys, n, stopIdx, objInf) {
    const S = sys.surfaces, N = S.length - 1;
    const t0 = objInf ? 0 : S[0].t;
    const ra = ptrace(S, n, 1, 0), rb = ptrace(S, n, 0, 1);
    const a = ra.y[stopIdx], b = rb.y[stopIdx];
    const zE = Math.abs(a) > 1e-14 ? b / a : 0;
    const nuK = ra.nu[N - 1];
    const efl = Math.abs(nuK) > 1e-15 ? -1 / nuK : Infinity;
    const ap = sys.aperture;
    let epd = ap.value;
    if (ap.type === 'FNO') epd = Math.abs(efl) / ap.value; // F/# image (Zemax « Image Space F/# ») : EPD = EFL / F#, en conjugué fini aussi
    if (ap.type === 'NA' && !objInf) {
      const um = Math.asin(Math.min(0.9999, ap.value / Math.abs(n[0])));
      epd = 2 * Math.tan(um) * Math.abs(zE + t0);
    }
    if (ap.type === 'NAI' || ap.type === 'STOP' || ap.type === 'WFNO') { // ON image, F/# de travail paraxial (CODE V FNO), ou demi-diamètre du diaphragme
      let m1; if (objInf) m1 = ptrace(S, n, 0.5, 0); else { const u0 = 0.5 / (zE + t0); m1 = ptrace(S, n, u0 * t0, u0); }
      if (ap.type === 'WFNO') { const w1 = Math.abs(m1.nu[N - 1]); epd = w1 > 1e-15 && ap.value > 0 ? 1 / (2 * w1 * ap.value) : 1; }
      else if (ap.type === 'NAI') { const nI = Math.abs(n[N - 1]), uM1 = m1.nu[N - 1] / nI; epd = Math.abs(uM1) > 1e-15 ? Math.tan(Math.asin(Math.min(0.9999, ap.value / nI))) / Math.abs(uM1) : 1; }
      else { const y1 = Math.abs(m1.y[stopIdx]); epd = y1 > 1e-15 ? ap.value / y1 : 1; }
    }
    let mar;
    if (objInf) mar = ptrace(S, n, epd / 2, 0);
    else { const u0 = (epd / 2) / (zE + t0); mar = ptrace(S, n, u0 * t0, u0); }
    const fm = maxField(sys);
    const chiefFor = fy => {
      if (objInf) { const u0 = Math.tan(fy * DEG); return ptrace(S, n, -u0 * zE, u0); }
      const u0 = -fy / (zE + t0); return ptrace(S, n, fy + u0 * t0, u0);
    };
    const chf = chiefFor(fm);
    const unit = objInf ? ptrace(S, n, -zE, 1) : chiefFor(1);
    const nI = n[N - 1];
    const uM = mar.nu[N - 1] / nI;
    const imgDist = Math.abs(uM) > 1e-15 ? -mar.y[N - 1] / uM : Infinity;
    const uC = unit.nu[N - 1] / nI;
    const xpZ = Math.abs(uC) > 1e-15 ? -unit.y[N] / uC : Infinity;
    const xpD = isFinite(xpZ) ? 2 * Math.abs(mar.y[N] + uM * xpZ) : Infinity;
    const H = chf.nu[0] * mar.y[1] - mar.nu[0] * chf.y[1];
    let ttl = 0; for (let j = 1; j < N; j++) ttl += S[j].t;
    // hauteur image et grandissement paraxiaux au plan image paraxial (CODE V « PARAXIAL IMAGE HT », Zemax PIMH)
    const atP = r => { const u = r.nu[N - 1] / nI; return isFinite(imgDist) ? r.y[N - 1] + u * imgDist : r.y[N]; };
    // pupille de sortie relative au dernier dioptre
    return {
      efl, epd, zE, stopR: Math.abs(mar.y[stopIdx]), mar, chf, unit, imgDist,
      bfl: (() => { const k = ra.nu[N - 1] / nI; return Math.abs(k) > 1e-15 ? -ra.y[N - 1] / k : Infinity; })(),
      wfno: 1 / (2 * Math.abs(mar.nu[N - 1])), fno: Math.abs(efl) / epd,
      xpZ, xpD, H, ttl, imgH: atP(chf), imgHs: chf.y[N], unitImgH: unit.y[N],
      mag: objInf ? 0 : atP(chiefFor(1)),
      objNA: objInf ? 0 : Math.abs(n[0]) * Math.sin(Math.atan(Math.abs(mar.nu[0] / n[0]))),
      fmax: fm, imgSpaceNA: Math.abs(Math.sin(Math.atan(uM))) * Math.abs(nI),
    };
  }

  /* ---------------- Repères (décentrements / bascules) ---------------- */
  const I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  function mmul(A, B) { const C = new Array(9); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i * 3 + j] = A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j]; return C; }
  const mv = (A, v) => [A[0] * v[0] + A[1] * v[1] + A[2] * v[2], A[3] * v[0] + A[4] * v[1] + A[5] * v[2], A[6] * v[0] + A[7] * v[1] + A[8] * v[2]];
  const mtv = (A, v) => [A[0] * v[0] + A[3] * v[1] + A[6] * v[2], A[1] * v[0] + A[4] * v[1] + A[7] * v[2], A[2] * v[0] + A[5] * v[1] + A[8] * v[2]];
  function rotXYZ(ax, ay, az) {
    const a = ax * DEG, b = ay * DEG, g = az * DEG;
    const Rx = [1, 0, 0, 0, Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a)];
    const Ry = [Math.cos(b), 0, Math.sin(b), 0, 1, 0, -Math.sin(b), 0, Math.cos(b)];
    const Rz = [Math.cos(g), -Math.sin(g), 0, Math.sin(g), Math.cos(g), 0, 0, 0, 1];
    return mmul(mmul(Rx, Ry), Rz);
  }
  const isId = R => Math.abs(R[0] - 1) + Math.abs(R[4] - 1) + Math.abs(R[8] - 1) + Math.abs(R[1]) + Math.abs(R[2]) + Math.abs(R[3]) + Math.abs(R[5]) + Math.abs(R[6]) + Math.abs(R[7]) < 1e-15;
  /**
   * Repère (origine o, matrice r local→global) de chaque surface.
   * DEC : les surfaces suivantes suivent le nouvel axe ; DAR : décentrement et retour ;
   * BEN : pliage (l'axe suit la réflexion : la bascule est appliquée deux fois). Rotations : main droite, ordre X puis Y puis Z.
   */
  function frames(S) {
    const N = S.length - 1, fr = [null];
    let O = [0, 0, 0], Rm = I3;
    for (let j = 1; j <= N; j++) {
      const s = S[j], dec = !!(s.dx || s.dy || s.dz || s.tx || s.ty || s.tz);
      let SO = O, SR = Rm;
      if (dec) { const d = mv(Rm, [s.dx || 0, s.dy || 0, s.dz || 0]); SO = [O[0] + d[0], O[1] + d[1], O[2] + d[2]]; SR = mmul(Rm, rotXYZ(s.tx || 0, s.ty || 0, s.tz || 0)); }
      fr[j] = { o: SO, r: SR, id: isId(SR) };
      if (dec && s.dmode !== 'DAR') { O = SO; Rm = s.dmode === 'BEN' ? mmul(SR, rotXYZ(s.tx || 0, s.ty || 0, s.tz || 0)) : SR; }
      if (j < N) { const t = isFinite(s.t) ? s.t : 0, d = mv(Rm, [0, 0, t]); O = [O[0] + d[0], O[1] + d[1], O[2] + d[2]]; }
    }
    return fr;
  }
  const toGlobal = (F, p) => { const q = mv(F.r, p); return [q[0] + F.o[0], q[1] + F.o[1], q[2] + F.o[2]]; };

  /* ---------------- Types de champ (CODE V : YAN, YOB, YIM, YRI) ---------------- */
  const FTYPES = { ang: { l: 'Angle objet', u: '°', cv: 'YAN' }, obj: { l: 'Hauteur objet', u: 'mm', cv: 'YOB' }, pim: { l: 'Hauteur image paraxiale', u: 'mm', cv: 'YIM' }, rim: { l: 'Hauteur image réelle', u: 'mm', cv: 'YRI' } };
  /** champs en hauteur image réelle : chaque point est ajusté pour que le rayon principal réel arrive à la hauteur demandée */
  function realImageFields(M) {
    const bad = [];
    M.sys.fields.forEach((f, i) => {
      const tx = M.ufields[i].x || 0, ty = M.ufields[i].y || 0;
      const im = g => { const r = ray(M, M.pw, g, 0, 0); return r.vig ? null : [r.x, r.y]; };
      let g = { ...f }, ok = true;
      for (let it = 0; it < 30; it++) {
        const e0 = im(g); if (!e0) { ok = false; break; }
        const ex = e0[0] - tx, ey = e0[1] - ty; if (Math.hypot(ex, ey) < 1e-10 * Math.max(1, Math.hypot(tx, ty))) break;
        const h = 1e-6 * Math.max(1, Math.hypot(g.x, g.y));
        const py = im({ ...g, y: g.y + h }); if (!py) { ok = false; break; }
        const j22 = (py[1] - e0[1]) / h, j12 = (py[0] - e0[0]) / h;
        if (tx || g.x) {
          const px = im({ ...g, x: g.x + h }); if (!px) { ok = false; break; }
          const j11 = (px[0] - e0[0]) / h, j21 = (px[1] - e0[1]) / h, det = j11 * j22 - j12 * j21; if (Math.abs(det) < 1e-30) { ok = false; break; }
          g = { ...g, x: g.x - (j22 * ex - j12 * ey) / det, y: g.y - (-j21 * ex + j11 * ey) / det };
        } else { if (Math.abs(j22) < 1e-30) { ok = false; break; } g = { ...g, y: g.y - ey / j22 }; }
      }
      if (ok) { f.x = g.x; f.y = g.y; } else bad.push(i + 1);
    });
    M.aimCache.clear();
    if (bad.length) M.warnings.push(`Hauteur image réelle non atteinte pour le(s) champ(s) ${bad.join(', ')} : valeur paraxiale utilisée`);
    M.par = paraxial(M.sys, M.nW[M.pw], M.stopIdx, M.objInf); M.epr = M.par.epd / 2;
  }
  /** champs angulaires avec objet à distance finie : hauteur objet telle que le rayon principal RÉEL (visé au centre du
      diaphragme) fasse l'angle demandé dans l'espace objet (convention CODE V ; la conversion paraxiale passe par la pupille d'entrée paraxiale) */
  function realAngleFields(M) {
    const bad = [], ctx = M.ctxs[M.pw];
    M.sys.fields.forEach((f, i) => {
      const tx = Math.tan((M.ufields[i].x || 0) * DEG), ty = Math.tan((M.ufields[i].y || 0) * DEG);
      if (!tx && !ty) return;
      const dir = g => { const a = chiefAim(M, ctx, g), st = startAt(M, ctx, g, a[0], a[1]); return Math.abs(st.d[2]) > 1e-12 ? [st.d[0] / st.d[2], st.d[1] / st.d[2]] : null; };
      let g = { ...f }, ok = true;
      for (let it = 0; it < 30; it++) {
        const e0 = dir(g); if (!e0) { ok = false; break; }
        const ex = e0[0] - tx, ey = e0[1] - ty; if (Math.hypot(ex, ey) < 1e-13) break;
        const h = 1e-6 * Math.max(1, Math.hypot(g.x, g.y));
        const py = dir({ ...g, y: g.y + h }), px = dir({ ...g, x: g.x + h }); if (!py || !px) { ok = false; break; }
        const j11 = (px[0] - e0[0]) / h, j21 = (px[1] - e0[1]) / h, j12 = (py[0] - e0[0]) / h, j22 = (py[1] - e0[1]) / h, det = j11 * j22 - j12 * j21;
        if (!(Math.abs(det) > 1e-30)) { ok = false; break; }
        g = { ...g, x: g.x - (j22 * ex - j12 * ey) / det, y: g.y - (-j21 * ex + j11 * ey) / det };
      }
      if (ok && isFinite(g.x) && isFinite(g.y)) { f.x = g.x; f.y = g.y; } else bad.push(i + 1);
    });
    M.aimCache.clear();
    if (bad.length) M.warnings.push(`Angle réel du rayon principal non atteint pour le(s) champ(s) ${bad.join(', ')} : conversion paraxiale utilisée`);
    M.par = paraxial(M.sys, M.nW[M.pw], M.stopIdx, M.objInf); M.epr = M.par.epd / 2;
  }
  /** facteurs de vignetage CODE V (VUY, VLY, VUX, VLX) → ellipse { cx, cy, hx, hy } dans la pupille d'entrée normalisée */
  function vigMap(f) {
    const a = +f.vuy || 0, b = +f.vly || 0, c = +f.vux || 0, d = +f.vlx || 0;
    if (!(a || b || c || d)) return null;
    return { cy: (b - a) / 2, hy: Math.max(1e-3, 1 - (a + b) / 2), cx: (d - c) / 2, hx: Math.max(1e-3, 1 - (c + d) / 2) };
  }

  /* ---------------- Préparation du modèle ---------------- */
  function prepare(sys0) {
    const sys = structuredClone(sys0);
    const S = sys.surfaces, N = S.length - 1;
    for (const s of S) {
      s.k = +s.k || 0; for (const a of ASPK) s[a] = +s[a] || 0; s.sd = +s.sd || 0;
      for (const k of ['dx', 'dy', 'dz', 'tx', 'ty', 'tz']) s[k] = +s[k] || 0;
      if (!['DEC', 'DAR', 'BEN'].includes(s.dmode)) s.dmode = 'DEC';
    }
    for (const f of sys.fields) { f.x = +f.x || 0; f.y = +f.y || 0; }
    const ufields = sys.fields.map(f => ({ ...f }));
    const wls = sys.wavelengths.map(w => w.um);
    const pw = Math.min(Math.max(0, sys.primary | 0), wls.length - 1);
    let stopIdx = S.findIndex(s => s.stop); if (stopIdx < 1 || stopIdx >= N) stopIdx = 1;
    const objInf = !isFinite(S[0].t) || Math.abs(S[0].t) > 1e10;
    const warnings = [];
    const E = envCtx(sys);
    if (E) expandLens(S, E, warnings);
    const nW = wls.map(l => indices(S, l, E));
    const errors = [];
    nW.forEach((n, wi) => n.forEach((v, j) => { if (!isFinite(v)) errors.push(`Verre inconnu « ${S[j].glass} » (surface ${j})`); }));
    if (errors.length) return { sys, errors: [...new Set(errors)], ok: false };
    if (E && E.miss.size) warnings.push(`dn/dT inconnu pour ${[...E.miss].join(', ')} : indice à ${E.T} °C non corrigé (renseignez-le dans Données système → Matériaux)`);
    if (objInf && sys.aperture.type === 'NA') warnings.push('Ouverture « ON objet » impossible avec un objet à l\'infini : la valeur est prise comme diamètre de pupille (choisissez EPD ou F/#)');
    S.forEach((s, j) => { const r = glassRecord(s.glass); if (r && r.lmin && r.lmax) { const out = wls.filter(l => l < r.lmin - 1e-9 || l > r.lmax + 1e-9); if (out.length) warnings.push(`${r.key} (S${j}) : λ hors domaine ${r.lmin}–${r.lmax} µm`); } });
    let par;
    // solves : pickups (rayon, épaisseur), courbure par F/# ou angle marginal, épaisseur M (foyer paraxial) — résolus ensemble par itération
    const nSolve = S.filter(s => s.tsolve || s.rsolve).length, n0 = nW[pw];
    const pickups = () => { let ch = false;
      for (let j = 1; j < N; j++) { const s = S[j];
        if (s.rsolve === 'P') { const k = Math.round(+s.rpk), src = S[k]; if (src && k !== j) { const c = curv(src) / (+s.rps || 1), r = Math.abs(c) < 1e-15 ? Infinity : 1 / c; if (r !== s.r && !(Math.abs(r - s.r) < 1e-12 * Math.abs(r))) { s.r = r; ch = true; } } }
        if (s.tsolve === 'P') { const k = Math.round(+s.tpk), src = S[k]; if (src && k !== j && isFinite(src.t)) { const t = (s.tps == null || s.tps === '' ? 1 : +s.tps) * src.t + (+s.tpo || 0); if (Math.abs(t - s.t) > 1e-12) { s.t = t; ch = true; } } } }
      return ch; };
    for (let it = 0; it < Math.min(40, 2 * nSolve + 2); it++) {
      let ch = pickups();
      par = paraxial(sys, nW[pw], stopIdx, objInf);
      for (let j = 1; j < N; j++) { const s = S[j]; if (s.rsolve !== 'F' && s.rsolve !== 'U') continue;
        const uT = s.rsolve === 'F' ? -1 / (2 * (+s.rsv || 1)) : +s.rsv || 0, dn = n0[j] - n0[j - 1], y = par.mar.y[j];
        if (Math.abs(y * dn) < 1e-15) continue;
        const c = (par.mar.nu[j - 1] - n0[j] * uT) / (y * dn), r = Math.abs(c) < 1e-15 ? Infinity : 1 / c;
        if (r !== s.r && !(Math.abs(r - s.r) < 1e-12 * Math.abs(r))) { s.r = r; ch = true; par = paraxial(sys, nW[pw], stopIdx, objInf); } }
      for (let j = 1; j < N; j++) if (S[j].tsolve === 'M') {
        const u = par.mar.nu[j] / nW[pw][j];
        if (Math.abs(u) > 1e-15) { const t = -par.mar.y[j] / u; if (Math.abs(t - S[j].t) > 1e-12) { S[j].t = t; ch = true; } }
        par = paraxial(sys, nW[pw], stopIdx, objInf);
      }
      if (!ch) break;
    }
    // type de champ : conversion vers la représentation interne (angles si objet à l'infini, hauteurs objet sinon)
    const ftype = FTYPES[sys.ftype] ? sys.ftype : (objInf ? 'ang' : 'obj');
    if (ftype === 'ang' && !objInf) { const L = S[0].t + par.zE; for (const f of sys.fields) { f.x = -L * Math.tan(f.x * DEG); f.y = -L * Math.tan(f.y * DEG); } }
    else if (ftype === 'obj' && objInf) warnings.push('Champs en hauteur objet avec un objet à l\'infini : valeurs prises comme des angles');
    else if (ftype === 'pim' || ftype === 'rim') {
      const k = par.unitImgH;
      if (!(Math.abs(k) > 1e-15)) warnings.push('Champs en hauteur image : grandissement nul, conversion impossible');
      else for (const f of sys.fields) { f.x = objInf ? Math.atan(f.x / k) / DEG : f.x / k; f.y = objInf ? Math.atan(f.y / k) / DEG : f.y / k; }
    }
    if (ftype !== (objInf ? 'ang' : 'obj')) par = paraxial(sys, nW[pw], stopIdx, objInf);
    const fr = frames(S);
    const zg = new Float64Array(N + 1);
    for (let j = 1; j <= N; j++) zg[j] = fr[j].o[2];
    const ctxs = wls.map((l, wi) => {
      const n = nW[wi];
      return {
        wi, l, lmm: l * 1e-3, n, nAbs: n.map(Math.abs),
        s: S.map(s => { const f = ffTerms(s), hi = !!(s.a12 || s.a14 || s.a16 || s.a18 || s.a20); return { c: curv(s), k: s.k, a4: s.a4, a6: s.a6, a8: s.a8, a10: s.a10, a12: s.a12, a14: s.a14, a16: s.a16, a18: s.a18, a20: s.a20, hi, ...f,
          asph: !!(s.a4 || s.a6 || s.a8 || s.a10 || hi || f.ff || s.type === 'TOR'), t: s.t,
          tor: s.type === 'TOR', cx: s.type === 'TOR' && isFinite(+s.rx) && +s.rx ? 1 / +s.rx : 0, kx: +s.kx || 0,
          dm: s.dm == null || s.dm === '' ? 1 : +s.dm, dnr: +s.dnr > 0 ? +s.dnr : 10, da: Array.isArray(s.da) ? s.da.map(v => +v || 0) : [], mirror: isMirror(s), sd: s.sd, clip: !!s.sdFixed,
          elem: s.elem || '', lpmm: +s.lpmm || 0, gm: s.gm == null ? 1 : +s.gm, gang: (+s.gang || 0) * DEG, fid: +s.fid || 100,
          pang: (+s.pang || 0) * DEG, ret: s.ret == null ? 0.25 : +s.ret, wang: (+s.wang || 0) * DEG }; }),
      };
    });
    const M = { sys, S, N, wls, pw, stopIdx, objInf, nW, par, zg, fr, ctxs, aimCache: new Map(), ok: true, errors: [], warnings,
      t0: objInf ? 0 : S[0].t, obs: Math.max(0, Math.min(0.95, +sys.aperture.obscuration || 0)), env: E, ftype, ufields };
    M.epr = par.epd / 2;
    // lentilles idéales : distance objet (le long de la propagation) du faisceau incident, d'après le rayon marginal paraxial (λ primaire)
    for (let j = 1; j < N; j++) if (S[j].elem === 'ideal') {
      const nu = par.mar.nu[j - 1], y = par.mar.y[j], nn = Math.abs(nW[pw][j - 1]), s0 = Math.abs(nu) > 1e-15 ? y * nn / nu : Infinity;
      ctxs.forEach(c => { c.s[j].s0 = s0; });
    }
    if (ftype === 'rim') realImageFields(M);
    else if (ftype === 'ang' && !objInf && sys.realAng !== false) realAngleFields(M);
    computeSD(M);
    M.warnings = [...new Set(warnings)];
    return M;
  }

  /* ---------------- Tracé réel ---------------- */
  function intersect(sf, x0, y0, z0, L, Mm, Nn) {
    const c = sf.c; let t;
    // propagation préalable au plan tangent au sommet (choix de la bonne racine / nappe)
    let t0 = 0, x = x0, y = y0, z = z0;
    if (Math.abs(Nn) > 1e-12) { t0 = -z0 / Nn; x = x0 + t0 * L; y = y0 + t0 * Mm; z = 0; }
    if (c === 0) { if (Math.abs(Nn) < 1e-15) return NaN; t = -z / Nn; }
    else {
      const kk = 1 + sf.k;
      const A = c * (L * L + Mm * Mm + kk * Nn * Nn);
      const b = c * (x * L + y * Mm + kk * z * Nn) - Nn;
      const C = c * (x * x + y * y + kk * z * z) - 2 * z;
      const disc = b * b - A * C;
      if (disc < 0) return NaN;
      const den = b + (b >= 0 ? 1 : -1) * Math.sqrt(disc);
      if (Math.abs(den) < 1e-300) return NaN;
      t = -C / den;
    }
    if (sf.asph) {
      for (let it = 0; it < 40; it++) {
        const px = x + t * L, py = y + t * Mm, pz = z + t * Nn;
        const f = pz - sag(sf, px, py), g = sGrad(sf, px, py);
        if (!isFinite(f) || !isFinite(g[0]) || !isFinite(g[1])) return NaN;
        const fp = Nn - (g[0] * L + g[1] * Mm);
        const dt = f / fp; t -= dt;
        if (Math.abs(dt) < 1e-13) break;
      }
    } else if (c !== 0) {
      const px = x + t * L, py = y + t * Mm;
      if (1 - (1 + sf.k) * c * c * (px * px + py * py) < 0) return NaN;
    }
    return t + t0;
  }

  /**
   * Trace un rayon depuis le repère de la surface 1.
   * opts: upto (indice de surface final), pts (tableau à remplir en coordonnées globales), noClip
   */
  function trace(M, ctx, p, d, opl0, opts = {}) {
    const upto = opts.upto ?? M.N, pts = opts.pts, clip = !opts.noClip, fr = M.fr;
    let x = p[0], y = p[1], z = p[2], L = d[0], Mm = d[1], Nn = d[2], opl = opl0;
    for (let j = 1; j <= upto; j++) {
      const sf = ctx.s[j], F = fr[j], r = F.r;
      // passage dans le repère local de la surface
      const qx = x - F.o[0], qy = y - F.o[1], qz = z - F.o[2];
      let lx, ly, lz, dL, dM, dN;
      if (F.id) { lx = qx; ly = qy; lz = qz; dL = L; dM = Mm; dN = Nn; }
      else {
        lx = r[0] * qx + r[3] * qy + r[6] * qz; ly = r[1] * qx + r[4] * qy + r[7] * qz; lz = r[2] * qx + r[5] * qy + r[8] * qz;
        dL = r[0] * L + r[3] * Mm + r[6] * Nn; dM = r[1] * L + r[4] * Mm + r[7] * Nn; dN = r[2] * L + r[5] * Mm + r[8] * Nn;
      }
      const pol = opts.pol;
      let Ex, Ey, Ez, Fx, Fy, Fz; // champ électrique (re, im) dans le repère local
      if (pol) {
        const E = pol.E;
        if (F.id) { Ex = E[0]; Ey = E[1]; Ez = E[2]; Fx = E[3]; Fy = E[4]; Fz = E[5]; }
        else { Ex = r[0] * E[0] + r[3] * E[1] + r[6] * E[2]; Ey = r[1] * E[0] + r[4] * E[1] + r[7] * E[2]; Ez = r[2] * E[0] + r[5] * E[1] + r[8] * E[2]; Fx = r[0] * E[3] + r[3] * E[4] + r[6] * E[5]; Fy = r[1] * E[3] + r[4] * E[4] + r[7] * E[5]; Fz = r[2] * E[3] + r[5] * E[4] + r[8] * E[5]; }
      }
      const t = intersect(sf, lx, ly, lz, dL, dM, dN);
      if (!isFinite(t)) return { vig: j, why: 'miss' };
      lx += t * dL; ly += t * dM; lz += t * dN;
      x += t * L; y += t * Mm; z += t * Nn;
      opl += ctx.nAbs[j - 1] * t;
      if (clip && sf.clip && lx * lx + ly * ly > sf.sd * sf.sd * (1 + 1e-9)) return { vig: j, why: 'clip' };
      if (pts) pts.push([x, y, z, lx, ly]);
      if (j === M.N) { if (opts.rec) opts.rec.push([lx, ly, lz, dL, dM, dN, NaN, NaN]); return { vig: 0, x: lx, y: ly, z: lz, L: dL, M: dM, N: dN, opl, gx: x, gy: y, gz: z, E: pol ? [Ex, Ey, Ez, Fx, Fy, Fz] : null }; }
      // normale locale
      const g = sGrad(sf, lx, ly);
      let nx = -g[0], ny = -g[1], nz = 1;
      const nn = Math.hypot(nx, ny, nz); nx /= nn; ny /= nn; nz /= nn;
      let cosI = -(dL * nx + dM * ny + dN * nz);
      if (cosI < 0) { nx = -nx; ny = -ny; nz = -nz; cosI = -cosI; }
      const iL = dL, iM = dM, iN = dN, n1 = ctx.nAbs[j - 1], n2 = ctx.nAbs[j];
      let cosT = cosI, mode = 0; // 0 réfraction, 1 miroir, 2 sans perte (réseau, lentille idéale)
      if (sf.elem === 'ideal') {
        const sg = dN >= 0 ? 1 : -1, az = Math.abs(dN) || 1e-12, tx = dL / az, ty = dM / az, f = sf.fid;
        const tx2 = tx - lx / f, ty2 = ty - ly / f, q = Math.hypot(tx2, ty2, 1), s0 = sf.s0;
        if (isFinite(s0) && Math.abs(s0) < 1e8) {
          // conjugué fini (distance objet s0 du rayon marginal paraxial) : lentille parfaite pour ce conjugué. Le chemin ajouté rend égaux,
          // pour chaque point objet O, les chemins O → lentille → image O′ ; référence : le rayon passant par le centre de la lentille.
          if (Math.abs(s0) > 1e-9) {
            const n2 = ctx.nAbs[j], tcx = (s0 * tx - lx) / s0, tcy = (s0 * ty - ly) / s0, rc = Math.hypot(tcx, tcy, 1), s1i = 1 / f - 1 / s0;
            let ph = n1 * s0 * (rc - Math.hypot(tx, ty, 1));
            if (Math.abs(s1i) > 1e-8) ph += n2 / s1i * (rc - q); else ph += n2 * (lx * tcx + ly * tcy) / rc; // image à l'infini : onde plane
            opl += ph;
          }
        } else {
          const Lq = Math.hypot(f * tx - lx, f * ty - ly, f), Lq0 = Math.abs(f) * Math.hypot(tx, ty, 1);
          opl += n1 * (-(lx * dL + ly * dM) - Math.sign(f) * (Lq - Lq0));
        }
        dL = tx2 / q; dM = ty2 / q; dN = sg / q; mode = 2;
      } else if (sf.elem === 'grating' && sf.lpmm) {
        const fx = -nx, fy = -ny, fz = -nz; // normale dans le sens de propagation
        const ux0 = -Math.sin(sf.gang), uy0 = Math.cos(sf.gang), ud = ux0 * fx + uy0 * fy;
        let ux = ux0 - ud * fx, uy = uy0 - ud * fy, uz = -ud * fz; const un = Math.hypot(ux, uy, uz); ux /= un; uy /= un; uz /= un;
        const G = sf.gm * ctx.lmm * sf.lpmm, dd = dL * fx + dM * fy + dN * fz;
        const tx = n1 * (dL - dd * fx) + G * ux, ty = n1 * (dM - dd * fy) + G * uy, tz = n1 * (dN - dd * fz) + G * uz;
        const t2 = tx * tx + ty * ty + tz * tz, no = sf.mirror ? n1 : n2;
        if (t2 >= no * no) return { vig: j, why: 'evan' };
        const w = Math.sqrt(no * no - t2) * (sf.mirror ? -1 : 1);
        dL = (tx + w * fx) / no; dM = (ty + w * fy) / no; dN = (tz + w * fz) / no;
        opl += G * (lx * ux0 + ly * uy0); mode = 2;
      } else if (sf.mirror) { dL += 2 * cosI * nx; dM += 2 * cosI * ny; dN += 2 * cosI * nz; mode = 1; }
      else {
        const mu = n1 / n2;
        const k = 1 - mu * mu * (1 - cosI * cosI);
        if (k < 0) return { vig: j, why: 'tir' };
        cosT = Math.sqrt(k);
        const a = mu * cosI - cosT;
        dL = mu * dL + a * nx; dM = mu * dM + a * ny; dN = mu * dN + a * nz;
      }
      const dn = Math.hypot(dL, dM, dN); dL /= dn; dM /= dn; dN /= dn;
      if (sf.elem === 'doe' && sf.da.length) { // surface diffractive : phase φ = Σ Aᵢ ρ²ⁱ (rad), ψ = m λ φ / 2π ajouté au chemin optique
        const R2 = sf.dnr * sf.dnr, q = (lx * lx + ly * ly) / R2; let ph = 0, dp = 0, qq = 1;
        for (let i = 0; i < sf.da.length; i++) { const A = sf.da[i]; if (A) { dp += (i + 1) * A * qq; ph += A * qq * q; } qq *= q; }
        const K = sf.dm * ctx.lmm / (2 * Math.PI), Gx = K * dp * 2 * lx / R2, Gy = K * dp * 2 * ly / R2, no = sf.mirror ? n1 : n2;
        const gn = Gx * nx + Gy * ny, gtx = Gx - gn * nx, gty = Gy - gn * ny, gtz = -gn * nz, dd = dL * nx + dM * ny + dN * nz;
        const tx = no * (dL - dd * nx) + gtx, ty = no * (dM - dd * ny) + gty, tz = no * (dN - dd * nz) + gtz, t2 = tx * tx + ty * ty + tz * tz;
        if (t2 >= no * no) return { vig: j, why: 'evan' };
        const w = Math.sqrt(no * no - t2) * (dd >= 0 ? 1 : -1);
        dL = (tx + w * nx) / no; dM = (ty + w * ny) / no; dN = (tz + w * nz) / no; opl += K * ph;
      }
      if (opts.rec) opts.rec.push([lx, ly, lz, dL, dM, dN, cosI, mode === 0 ? cosT : cosI]);
      if (pol) {
        const P = polStep([Ex, Ey, Ez, Fx, Fy, Fz], [iL, iM, iN], [dL, dM, dN], [nx, ny, nz], n1, n2, cosI, cosT, mode, pol.fresnel, sf);
        if (F.id) pol.E = P; else pol.E = [r[0] * P[0] + r[1] * P[1] + r[2] * P[2], r[3] * P[0] + r[4] * P[1] + r[5] * P[2], r[6] * P[0] + r[7] * P[1] + r[8] * P[2], r[0] * P[3] + r[1] * P[4] + r[2] * P[5], r[3] * P[3] + r[4] * P[4] + r[5] * P[5], r[6] * P[3] + r[7] * P[4] + r[8] * P[5]];
      }
      if (F.id) { L = dL; Mm = dM; Nn = dN; }
      else { L = r[0] * dL + r[1] * dM + r[2] * dN; Mm = r[3] * dL + r[4] * dM + r[5] * dN; Nn = r[6] * dL + r[7] * dM + r[8] * dN; }
    }
    return { vig: 0, x, y, z, L, M: Mm, N: Nn, opl, partial: true };
  }

  /* ---------------- Polarisation (champ E complexe 3D le long du rayon) ---------------- */
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const nrm = v => { const n = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / n, v[1] / n, v[2] / n]; };
  const cdot = (E, v) => [E[0] * v[0] + E[1] * v[1] + E[2] * v[2], E[3] * v[0] + E[4] * v[1] + E[5] * v[2]];
  /** a·u + b·v avec a, b complexes [re, im] et u, v réels */
  const comb = (a, u, b, v) => [a[0] * u[0] + b[0] * v[0], a[0] * u[1] + b[0] * v[1], a[0] * u[2] + b[0] * v[2], a[1] * u[0] + b[1] * v[0], a[1] * u[1] + b[1] * v[1], a[1] * u[2] + b[1] * v[2]];
  const cmul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
  const sc = (a, k) => [a[0] * k, a[1] * k];
  function sBasis(d, N) { let s = cross(d, N); if (Math.hypot(s[0], s[1], s[2]) < 1e-9) s = Math.abs(d[0]) < 0.9 ? cross(d, [1, 0, 0]) : cross(d, [0, 1, 0]); return nrm(s); }
  function polStep(E, dIn, dOut, N, n1, n2, cosI, cosT, mode, fresnel, sf) {
    const s = sBasis(dIn, N), pIn = cross(dIn, s), pOut = cross(dOut, s);
    let Es = cdot(E, s), Ep = cdot(E, pIn);
    if (mode === 1) Es = sc(Es, -1);
    else if (mode === 0 && fresnel) {
      const ts = 2 * n1 * cosI / (n1 * cosI + n2 * cosT), tp = 2 * n1 * cosI / (n2 * cosI + n1 * cosT), k = Math.sqrt(n2 * cosT / (n1 * cosI));
      Es = sc(Es, ts * k); Ep = sc(Ep, tp * k);
    }
    let O = comb(Es, s, Ep, pOut);
    if (sf.elem === 'polarizer') {
      let a = [Math.cos(sf.pang), Math.sin(sf.pang), 0]; const ad = a[0] * dOut[0] + a[1] * dOut[1]; a = nrm([a[0] - ad * dOut[0], a[1] - ad * dOut[1], -ad * dOut[2]]);
      O = comb(cdot(O, a), a, [0, 0], a);
    } else if (sf.elem === 'waveplate') {
      let f = [Math.cos(sf.wang), Math.sin(sf.wang), 0]; const fd = f[0] * dOut[0] + f[1] * dOut[1]; f = nrm([f[0] - fd * dOut[0], f[1] - fd * dOut[1], -fd * dOut[2]]);
      const g = cross(dOut, f), ph = 2 * Math.PI * sf.ret;
      O = comb(cdot(O, f), f, cmul(cdot(O, g), [Math.cos(ph), Math.sin(ph)]), g);
    }
    return O;
  }
  const POLSTATES = { X: [[1, 0], [0, 0]], Y: [[0, 0], [1, 0]], P45: [[Math.SQRT1_2, 0], [Math.SQRT1_2, 0]], M45: [[Math.SQRT1_2, 0], [-Math.SQRT1_2, 0]], RCP: [[Math.SQRT1_2, 0], [0, -Math.SQRT1_2]], LCP: [[Math.SQRT1_2, 0], [0, Math.SQRT1_2]] };
  function polInput(d, state) {
    const J = POLSTATES[state] || POLSTATES.X;
    const ex = nrm([1 - d[0] * d[0], -d[0] * d[1], -d[0] * d[2]]), ey = cross(d, ex);
    return comb(J[0], ex, J[1], ey);
  }
  /** état de sortie (repère local de l'image) : intensité, Stokes, orientation ψ et ellipticité χ */
  function polOut(E) {
    const ax = E[0], bx = E[3], ay = E[1], by = E[4];
    const Ix = ax * ax + bx * bx, Iy = ay * ay + by * by, I = Ix + Iy + E[2] * E[2] + E[5] * E[5];
    const S1 = Ix - Iy, S2 = 2 * (ax * ay + bx * by), S3 = 2 * (bx * ay - ax * by), S0 = Ix + Iy || 1e-30;
    return { I, S: [S0, S1, S2, S3], psi: 0.5 * Math.atan2(S2, S1), chi: 0.5 * Math.asin(Math.max(-1, Math.min(1, S3 / S0))) };
  }
  function polPupil(M, fi, wi, state, n = 15, fresnel = true) {
    const f = typeof fi === 'object' ? fi : M.sys.fields[fi], pts = [];
    const states = state === 'NONE' ? ['X', 'Y'] : [state];
    let sI = 0, cnt = 0;
    for (const [px, py] of pupilGrid(n, M.obs)) {
      let I = 0, last = null;
      for (const st of states) { const r = ray(M, wi, f, px, py, { polState: st, fresnel }); if (r.vig) { last = null; I = 0; break; } const o = polOut(r.E); I += o.I / states.length; last = o; }
      pts.push({ px, py, I, o: state === 'NONE' ? null : last });
      sI += I; cnt++;
    }
    return { pts, T: sI / (cnt || 1) };
  }

  /** point de départ d'un rayon visant (ax, ay) dans le plan de la pupille d'entrée */
  function fieldDir(f) { const a = Math.tan((f.x || 0) * DEG), b = Math.tan((f.y || 0) * DEG), n = Math.hypot(a, b, 1); return [a / n, b / n, 1 / n]; }
  function startAt(M, ctx, f, ax, ay) {
    if (M.objInf) return { p: [ax, ay, M.par.zE], d: fieldDir(f) };
    const ox = f.x || 0, oy = f.y || 0, oz = -M.t0;
    let dx = ax - ox, dy = ay - oy, dz = M.par.zE - oz;
    const dn = Math.hypot(dx, dy, dz) * Math.sign(dz || 1);
    return { p: [ox, oy, oz], d: [dx / dn, dy / dn, dz / dn] };
  }
  /** mode de visée : 'none' (pupille d'entrée paraxiale), 'chief' (rayon principal itéré au centre du diaphragme, pupille paraxiale translatée — défaut de CODE V), 'full' (chaque rayon itéré sur le diaphragme) */
  const aimMode = sys => sys.rayAiming ? 'full' : sys.aimMode === 'chief' ? 'chief' : 'none';
  function aimRay(M, ctx, f, px, py) {
    let ax = px * M.epr, ay = py * M.epr;
    const mode = aimMode(M.sys);
    if (mode === 'none') return [ax, ay];
    if (mode === 'chief' && (px || py)) { const c = chiefAim(M, ctx, f); return [ax + c[0], ay + c[1]]; }
    const tx = px * M.par.stopR, ty = py * M.par.stopR;
    const h = 1e-6 * Math.max(1, M.epr);
    const ev = (a, b) => { const s = startAt(M, ctx, f, a, b); const r = trace(M, ctx, s.p, s.d, 0, { upto: M.stopIdx, noClip: true }); return r.vig ? null : [r.x - tx, r.y - ty]; };
    // départ : visée du rayon principal en cache
    const key = (f.x || 0) + '|' + (f.y || 0) + '|' + ctx.wi;
    const c0 = M.aimCache.get(key);
    if (c0) { ax += c0[0]; ay += c0[1]; }
    for (let it = 0; it < 15; it++) {
      const e = ev(ax, ay); if (!e) return [px * M.epr, py * M.epr];
      if (Math.hypot(e[0], e[1]) < 1e-11 * Math.max(1, M.par.stopR)) break;
      const ex = ev(ax + h, ay), ey = ev(ax, ay + h); if (!ex || !ey) break;
      const j11 = (ex[0] - e[0]) / h, j21 = (ex[1] - e[1]) / h, j12 = (ey[0] - e[0]) / h, j22 = (ey[1] - e[1]) / h;
      const det = j11 * j22 - j12 * j21; if (Math.abs(det) < 1e-20) break;
      ax -= (j22 * e[0] - j12 * e[1]) / det; ay -= (-j21 * e[0] + j11 * e[1]) / det;
    }
    return [ax, ay];
  }
  function chiefAim(M, ctx, f) {
    const key = (f.x || 0) + '|' + (f.y || 0) + '|' + ctx.wi;
    if (aimMode(M.sys) === 'none') return [0, 0];
    if (M.aimCache.has(key)) return M.aimCache.get(key);
    const a = aimRay(M, ctx, f, 0, 0); M.aimCache.set(key, a); return a;
  }
  /** rayon réel pour un champ {x, y} et une pupille normalisée (px, py) */
  function ray(M, wi, f, px, py, opts) {
    if (typeof f === 'number') f = { x: 0, y: f };
    const v = (opts && opts.noVig) || (px === 0 && py === 0) ? null : vigMap(f); // le rayon principal passe toujours au centre du diaphragme (CODE V)
    if (v) {
      if (opts && opts.vigClip) { if (((px - v.cx) / v.hx) ** 2 + ((py - v.cy) / v.hy) ** 2 > 1 + 1e-9) return { vig: 1, why: 'vigf' }; }
      else { px = v.cx + v.hx * px; py = v.cy + v.hy * py; }
    }
    const ctx = M.ctxs[wi];
    const ca = chiefAim(M, ctx, f);
    const a = (px === 0 && py === 0) ? ca : aimRay(M, ctx, f, px, py);
    const s = startAt(M, ctx, f, a[0], a[1]);
    let opl0 = 0;
    if (M.objInf) opl0 = ctx.nAbs[0] * ((a[0] - ca[0]) * s.d[0] + (a[1] - ca[1]) * s.d[1]);
    if (opts && opts.polState) opts = { ...opts, pol: { E: polInput(s.d, opts.polState), fresnel: !!opts.fresnel } };
    return trace(M, ctx, s.p, s.d, opl0, opts);
  }

  function computeSD(M) {
    const S = M.S, N = M.N, mx = new Float64Array(N + 1);
    const nA = 24;
    for (const f of M.sys.fields) for (let wi = 0; wi < M.wls.length; wi++) {
      for (let k = -1; k < nA; k++) {
        const px = k < 0 ? 0 : Math.cos(2 * Math.PI * k / nA), py = k < 0 ? 0 : Math.sin(2 * Math.PI * k / nA);
        const pts = [];
        ray(M, wi, f, px, py, { pts, noClip: true });
        pts.forEach((p, i) => { const rr = Math.hypot(p[3], p[4]); if (rr > mx[i + 1]) mx[i + 1] = rr; });
      }
    }
    for (let j = 1; j <= N; j++) if (!S[j].sdFixed) {
      const v = mx[j] > 0 ? mx[j] : (S[j].sd || 1);
      S[j].sd = v; M.ctxs.forEach(c => c.s[j].sd = v);
    }
  }

  /* ---------------- Échantillonnage pupille ---------------- */
  function pupilGrid(n, obs) {
    const out = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const px = n === 1 ? 0 : -1 + 2 * j / (n - 1), py = n === 1 ? 0 : -1 + 2 * i / (n - 1);
      const r = Math.hypot(px, py); if (r <= 1 + 1e-12 && r >= obs) out.push([px, py]);
    }
    return out;
  }
  function pupilHex(rings, obs) {
    const out = [];
    if (obs <= 0) out.push([0, 0]);
    for (let i = 1; i <= rings; i++) {
      const r = i / rings; if (r < obs) continue;
      const nk = 6 * i;
      for (let k = 0; k < nk; k++) { const a = 2 * Math.PI * k / nk + Math.PI / 2; out.push([r * Math.cos(a), r * Math.sin(a)]); }
    }
    return out;
  }

  /* ---------------- Front d'onde (OPD) ---------------- */
  function opdRef(M, wi, fy) {
    const c = ray(M, wi, fy, 0, 0);
    if (c.vig) return null;
    const nI = M.ctxs[wi].nAbs[M.N - 1], lmm = M.ctxs[wi].lmm;
    const xpZ = M.par.xpZ;
    const plane = !isFinite(xpZ) || Math.abs(xpZ) > 1e7;
    let s0 = 0, R = Infinity;
    if (!plane) { s0 = (xpZ - c.z) / c.N; R = Math.abs(s0); }
    const ref = c.opl + nI * s0;
    const W = r => {
      if (!r || r.vig) return NaN;
      let s;
      if (plane) { s = ((c.x - r.x) * c.L + (c.y - r.y) * c.M + (c.z - r.z) * c.N) / (r.L * c.L + r.M * c.M + r.N * c.N); }
      else {
        const qx = r.x - c.x, qy = r.y - c.y, qz = r.z - c.z;
        const b = r.L * qx + r.M * qy + r.N * qz, cc = qx * qx + qy * qy + qz * qz - R * R;
        const disc = b * b - cc; if (disc < 0) return NaN;
        s = s0 < 0 ? -b - Math.sqrt(disc) : -b + Math.sqrt(disc);
      }
      // convention CODE V / Zemax : OPD > 0 = front d'onde en avance (chemin optique plus court que le rayon principal)
      return (ref - r.opl - nI * s) / lmm;
    };
    return { chief: c, W, R };
  }

  /* ---------------- Analyses ---------------- */
  function spot(M, fi, n = 21, wsel = null) {
    const fy = typeof fi === 'object' ? fi : M.sys.fields[fi], pts = [], grid = pupilGrid(n, M.obs);
    let sx = 0, sy = 0, sw = 0, nv = 0;
    const wlist = wsel == null ? M.wls.map((_, i) => i) : [wsel];
    const chiefP = ray(M, M.pw, fy, 0, 0);
    for (const wi of wlist) {
      const w = M.sys.wavelengths[wi].w ?? 1;
      for (const [px, py] of grid) {
        const r = ray(M, wi, fy, px, py);
        if (r.vig) { nv++; continue; }
        pts.push({ wi, x: r.x, y: r.y }); sx += w * r.x; sy += w * r.y; sw += w;
      }
    }
    const cx = sx / sw, cy = sy / sw;
    let s2 = 0, geo = 0, ww = 0;
    for (const p of pts) { const w = M.sys.wavelengths[p.wi].w ?? 1; const d2 = (p.x - cx) ** 2 + (p.y - cy) ** 2; s2 += w * d2; ww += w; geo = Math.max(geo, Math.sqrt(d2)); }
    return { pts, cx, cy, rms: Math.sqrt(s2 / ww), geo, nv, ntot: grid.length * wlist.length,
      chief: chiefP.vig ? null : [chiefP.x, chiefP.y], airy: 1.22 * M.ctxs[M.pw].lmm * M.par.wfno };
  }

  function rayFan(M, fi, n = 61) {
    const fy = M.sys.fields[fi];
    const c = ray(M, M.pw, fy, 0, 0);
    const out = [];
    for (let wi = 0; wi < M.wls.length; wi++) {
      const T = [], Sg = [], P = [];
      for (let i = 0; i < n; i++) {
        const p = -1 + 2 * i / (n - 1); P.push(p);
        const inObs = Math.abs(p) < M.obs;
        const rt = inObs ? { vig: 1 } : ray(M, wi, fy, 0, p), rs = inObs ? { vig: 1 } : ray(M, wi, fy, p, 0);
        T.push(rt.vig || c.vig ? NaN : (rt.y - c.y)); Sg.push(rs.vig || c.vig ? NaN : (rs.x - c.x));
      }
      out.push({ wi, P, T, S: Sg });
    }
    return out;
  }
  function opdFan(M, fi, n = 61) {
    const fy = M.sys.fields[fi], out = [];
    for (let wi = 0; wi < M.wls.length; wi++) {
      const ref = opdRef(M, wi, fy); const T = [], Sg = [], P = [];
      for (let i = 0; i < n; i++) {
        const p = -1 + 2 * i / (n - 1); P.push(p);
        const inObs = Math.abs(p) < M.obs;
        T.push(ref && !inObs ? ref.W(ray(M, wi, fy, 0, p)) : NaN);
        Sg.push(ref && !inObs ? ref.W(ray(M, wi, fy, p, 0)) : NaN);
      }
      out.push({ wi, P, T, S: Sg });
    }
    return out;
  }

  const ZN = [
    'Piston', 'Basculement X', 'Basculement Y', 'Défocalisation', 'Astigmatisme 0°', 'Astigmatisme 45°',
    'Coma X', 'Coma Y', 'Sphérique 3e ordre', 'Trèfle 0°', 'Trèfle 30°', 'Astig. 5e ordre 0°', 'Astig. 5e ordre 45°',
    'Coma 5e ordre X', 'Coma 5e ordre Y', 'Sphérique 5e ordre'];
  function zernBasis(x, y) {
    const r2 = x * x + y * y, x2y2 = x * x - y * y, xy2 = 2 * x * y;
    return [1, x, y, 2 * r2 - 1, x2y2, xy2, (3 * r2 - 2) * x, (3 * r2 - 2) * y, 6 * r2 * r2 - 6 * r2 + 1,
      x * x * x - 3 * x * y * y, 3 * x * x * y - y * y * y, (4 * r2 - 3) * x2y2, (4 * r2 - 3) * xy2,
      (10 * r2 * r2 - 12 * r2 + 3) * x, (10 * r2 * r2 - 12 * r2 + 3) * y, 20 * r2 * r2 * r2 - 30 * r2 * r2 + 12 * r2 - 1];
  }
  /* Zernike Fringe Z1…Z37 (θ depuis l'axe X) : [n, m, cos|sin, polynôme radial en ρ²] — les 16 premiers sont ceux de zernBasis */
  const ZF = [[0, 0], [1, 1, 'c'], [1, 1, 's'], [2, 0], [2, 2, 'c'], [2, 2, 's'], [3, 1, 'c'], [3, 1, 's'], [4, 0], [3, 3, 'c'], [3, 3, 's'], [4, 2, 'c'], [4, 2, 's'], [5, 1, 'c'], [5, 1, 's'], [6, 0],
    [4, 4, 'c'], [4, 4, 's'], [5, 3, 'c'], [5, 3, 's'], [6, 2, 'c'], [6, 2, 's'], [7, 1, 'c'], [7, 1, 's'], [8, 0], [5, 5, 'c'], [5, 5, 's'], [6, 4, 'c'], [6, 4, 's'], [7, 3, 'c'], [7, 3, 's'], [8, 2, 'c'], [8, 2, 's'], [9, 1, 'c'], [9, 1, 's'], [10, 0], [12, 0]];
  const ZN37 = ['Piston', 'Basculement X', 'Basculement Y', 'Défocalisation', 'Astigmatisme 0°', 'Astigmatisme 45°', 'Coma X', 'Coma Y', 'Sphérique 3e ordre',
    'Trèfle 0°', 'Trèfle 30°', 'Astig. 5e ordre 0°', 'Astig. 5e ordre 45°', 'Coma 5e ordre X', 'Coma 5e ordre Y', 'Sphérique 5e ordre',
    'Tétrafoil 0°', 'Tétrafoil 22,5°', 'Trèfle 5e ordre 0°', 'Trèfle 5e ordre 30°', 'Astig. 7e ordre 0°', 'Astig. 7e ordre 45°', 'Coma 7e ordre X', 'Coma 7e ordre Y', 'Sphérique 7e ordre',
    'Pentafoil 0°', 'Pentafoil 18°', 'Tétrafoil 7e ordre 0°', 'Tétrafoil 7e ordre 22,5°', 'Trèfle 7e ordre 0°', 'Trèfle 7e ordre 30°', 'Astig. 9e ordre 0°', 'Astig. 9e ordre 45°', 'Coma 9e ordre X', 'Coma 9e ordre Y', 'Sphérique 9e ordre', 'Sphérique 11e ordre'];
  /** polynôme radial de Zernike R_n^m(ρ) */
  function zRad(n, m, r) { let v = 0; for (let k = 0; k <= (n - m) / 2; k++) { const num = ((k % 2) ? -1 : 1) * fact(n - k), den = fact(k) * fact((n + m) / 2 - k) * fact((n - m) / 2 - k); v += num / den * Math.pow(r, n - 2 * k); } return v; }
  const FACT = [1]; function fact(n) { while (FACT.length <= n) FACT.push(FACT[FACT.length - 1] * FACT.length); return FACT[n]; }
  function zernBasis37(x, y, nz = 37) { const r = Math.hypot(x, y), t = Math.atan2(y, x), out = new Array(nz); for (let k = 0; k < nz; k++) { const [n, m, cs] = ZF[k], R = zRad(n, m, r); out[k] = m === 0 ? R : R * (cs === 'c' ? Math.cos(m * t) : Math.sin(m * t)); } return out; }
  /** RMS sur le disque unité d'un terme Fringe de coefficient 1 : 1/√(n+1) (m = 0) ou 1/√(2(n+1)) */
  const zRms = k => { const [n, m] = ZF[k]; return 1 / Math.sqrt((n + 1) * (m ? 2 : 1)); };
  /**
   * Ajustement de Zernike Fringe sur les nz premiers termes (4 à 37) d'un front d'onde (wavefront()) :
   * coefficients, RMS de chaque terme, et résidu = front d'onde − ajustement (termes au-delà de Z_nz et ordres non représentés).
   */
  function zernFit(wf, nz = 16) {
    nz = Math.max(1, Math.min(37, nz | 0)); const N = wf.N, S = [];
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const w = wf.W[i * N + j]; if (isFinite(w)) S.push([-1 + (2 * j + 1) / N, -1 + (2 * i + 1) / N, w, i * N + j]); }
    const AtA = Array.from({ length: nz }, () => new Array(nz).fill(0)), Atb = new Array(nz).fill(0), B = [];
    for (const [x, y, w] of S) { const z = zernBasis37(x, y, nz); B.push(z); for (let a = 0; a < nz; a++) { Atb[a] += z[a] * w; for (let b = 0; b < nz; b++) AtA[a][b] += z[a] * z[b]; } }
    const c = S.length > nz ? (solveLin(AtA, Atb) || new Array(nz).fill(0)) : new Array(nz).fill(0);
    const R = new Float64Array(N * N).fill(NaN); let m = 0, s2 = 0, t2 = 0, tm = 0, mn = Infinity, mx = -Infinity;
    S.forEach(([x, y, w, q], k) => { let f = 0; for (let a = 0; a < nz; a++) f += c[a] * B[k][a]; R[q] = w - f; m += w - f; tm += w; });
    m /= S.length || 1; tm /= S.length || 1;
    S.forEach(([x, y, w, q]) => { const v = R[q] - m; R[q] = v; s2 += v * v; t2 += (w - tm) ** 2; mn = Math.min(mn, v); mx = Math.max(mx, v); });
    const n = S.length || 1;
    return { c, nz, names: ZN37.slice(0, nz), rmsTerm: c.map((v, k) => Math.abs(v) * zRms(k)), R, N, rmsRes: Math.sqrt(s2 / n), pvRes: S.length ? mx - mn : NaN, rmsTot: Math.sqrt(t2 / n), order: ZF.slice(0, nz).map(z => z[0]) };
  }
  function solveLin(A, b) {
    const n = b.length; const a = A.map((r, i) => [...r, b[i]]);
    for (let i = 0; i < n; i++) {
      let p = i; for (let k = i + 1; k < n; k++) if (Math.abs(a[k][i]) > Math.abs(a[p][i])) p = k;
      [a[i], a[p]] = [a[p], a[i]];
      if (Math.abs(a[i][i]) < 1e-300) return null;
      for (let k = i + 1; k < n; k++) { const f = a[k][i] / a[i][i]; for (let j = i; j <= n; j++) a[k][j] -= f * a[i][j]; }
    }
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) { let s = a[i][n]; for (let j = i + 1; j < n; j++) s -= a[i][j] * x[j]; x[i] = s / a[i][i]; }
    return x;
  }
  const VCLIP = { vigClip: true };
  function wavefront(M, fi, wi, N = 64, removeTilt = true) {
    const fy = typeof fi === 'object' ? fi : M.sys.fields[fi], ref = opdRef(M, wi, fy);
    const W = new Float64Array(N * N).fill(NaN);
    if (!ref) return { N, W, rms: NaN, pv: NaN, zern: [], ok: false };
    const samples = [];
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const px = -1 + (2 * j + 1) / N, py = -1 + (2 * i + 1) / N;
      const r = Math.hypot(px, py); if (r > 1 || r < M.obs) continue;
      const w = ref.W(ray(M, wi, fy, px, py, VCLIP));
      if (isFinite(w)) { W[i * N + j] = w; samples.push([px, py, w, i * N + j]); }
    }
    // ajustement Zernike (Fringe 16)
    const nz = 16, AtA = Array.from({ length: nz }, () => new Array(nz).fill(0)), Atb = new Array(nz).fill(0);
    for (const [x, y, w] of samples) { const z = zernBasis(x, y); for (let a = 0; a < nz; a++) { Atb[a] += z[a] * w; for (let b = 0; b < nz; b++) AtA[a][b] += z[a] * z[b]; } }
    const zern = samples.length > nz ? (solveLin(AtA, Atb) || []) : [];
    let mean = 0;
    for (const s of samples) { if (removeTilt && zern.length) { s[2] -= zern[1] * s[0] + zern[2] * s[1]; } mean += s[2]; }
    mean /= samples.length || 1;
    let s2 = 0, mn = Infinity, mxv = -Infinity;
    for (const s of samples) { const v = s[2] - mean; W[s[3]] = v; s2 += v * v; mn = Math.min(mn, v); mxv = Math.max(mxv, v); }
    return { N, W, rms: Math.sqrt(s2 / (samples.length || 1)), pv: mxv - mn, zern, ok: samples.length > 0, n: samples.length };
  }

  /* FFT radix-2 */
  function fft1(re, im, inv) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = 2 * Math.PI / len * (inv ? 1 : -1), wr = Math.cos(ang), wi = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < len / 2; k++) {
          const a = i + k, b = a + len / 2;
          const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
          re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
          const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
        }
      }
    }
  }
  function fft2(re, im, n, inv) {
    const rr = new Float64Array(n), ri = new Float64Array(n);
    for (let y = 0; y < n; y++) { for (let x = 0; x < n; x++) { rr[x] = re[y * n + x]; ri[x] = im[y * n + x]; } fft1(rr, ri, inv); for (let x = 0; x < n; x++) { re[y * n + x] = rr[x]; im[y * n + x] = ri[x]; } }
    for (let x = 0; x < n; x++) { for (let y = 0; y < n; y++) { rr[y] = re[y * n + x]; ri[y] = im[y * n + x]; } fft1(rr, ri, inv); for (let y = 0; y < n; y++) { re[y * n + x] = rr[y]; im[y * n + x] = ri[y]; } }
  }
  /**
   * Ouverture réelle côté image pour un champ et une λ (comme les « X and Y F-numbers » de CODE V) :
   * écarts de cosinus directeurs (repère local de l'image) entre les rayons de bord de pupille ±Y et ±X, × indice image.
   * Sur l'axe : 2·ON = 1/F#. Hors axe, ils intègrent les aberrations de pupille, l'obliquité et l'inclinaison du plan image.
   * Fréquence de coupure : fc = ΔM/λ (tangentiel), ΔL/λ (sagittal) ; pas de la PSF : λN/(P·Δ).
   */
  function pupilScale(M, f, wi) {
    const o = { noVig: true, noClip: true }, n = M.ctxs[wi].nAbs[M.N - 1] || 1, d0 = 1 / M.par.wfno;
    const a = ray(M, wi, f, 0, 1, o), b = ray(M, wi, f, 0, -1, o), c = ray(M, wi, f, 1, 0, o), d = ray(M, wi, f, -1, 0, o);
    const dM = !a.vig && !b.vig ? Math.abs(a.M - b.M) * n : NaN, dL = !c.vig && !d.vig ? Math.abs(c.L - d.L) * n : NaN;
    return { dM: dM > 1e-9 ? dM : d0, dL: dL > 1e-9 ? dL : d0 };
  }
  /**
   * Apodisation de la pupille d'entrée par l'émission d'une source à distance finie (amplitude en fonction de la pupille normalisée) :
   * mode gaussien (fibre monomode, tache gaussienne) exp(−ρ² ON²/θ₀²) avec θ₀ = λ/(π w₀) (MFD à la λ du calcul) ; gradient d'indice √(1 − ρ²k²), k = ON objet / ON fibre ;
   * saut d'indice, disque ou fente d'ON inférieure à l'ON objet : pupille tronquée au rayon ON/ON objet. Émetteur lambertien ou objet à l'infini : null (uniforme).
   */
  function srcApod(M, src, wi) {
    if (!src || M.objInf || !src.type || src.type === 'none') return null;
    const NAs = M.par.objNA, l = M.wls[wi ?? M.pw]; if (!(NAs > 0) || !(l > 0)) return null;
    const t = src.type === 'fiber' ? (src.fib || 'si') : src.type;
    if (t === 'sm' || t === 'gauss') {
      const d = t === 'sm' ? (+src.mfd > 0 ? +src.mfd : fiberInfo(src, l).mfd) : +src.d; if (!(d > 0)) return null;
      const t0 = l / (Math.PI * d / 2), k = NAs * NAs / (t0 * t0); if (k < 1e-9) return null;
      return (x, y) => Math.exp(-(x * x + y * y) * k);
    }
    const na = +src.na; if (!(na > 0)) return null;
    if (t === 'gi') { const k = NAs / na; return (x, y) => Math.sqrt(Math.max(0, 1 - (x * x + y * y) * k * k)); }
    const rm = na / NAs; if (rm >= 1) return null;
    return (x, y) => (x * x + y * y <= rm * rm ? 1 : 0);
  }
  /** intensité relative au bord de la pupille d'une apodisation gaussienne (pour l'export PUI / GFAC) ; null si non gaussienne */
  function apodEdgeI(M, wi) {
    const a = M.sys.apod; if (!a) return null;
    if (a.type === 'gauss') return Math.min(1, Math.max(1e-6, +a.I || 0.135));
    if (a.type === 'src') { const s = M.sys.src || {}, t = s.type === 'fiber' ? s.fib : s.type; if (t !== 'sm' && t !== 'gauss') return null; const f = srcApod(M, s, wi); return f ? f(1, 0) ** 2 : null; }
    return null;
  }
  /**
   * apodisation de la pupille du système, à la longueur d'onde wi : gaussienne (CODE V PUI : intensité relative I au bord → amplitude I^(ρ²/2))
   * ou « selon la source » (émission de la source définie dans la carte Source / fibre, voir srcApod)
   */
  function sysApod(M, wi) {
    const a = M.sys.apod; if (!a) return null;
    if (a.type === 'src') return srcApod(M, M.sys.src, wi);
    if (a.type !== 'gauss') return null;
    const I = Math.min(1, Math.max(1e-6, +a.I || 0.135)); if (I >= 1) return null;
    return (x, y) => Math.pow(I, (x * x + y * y) / 2);
  }
  function psf(M, fi, wi, N = 64, P = 256, wfIn, apod) {
    if (apod === undefined) apod = sysApod(M, wi);
    const wf = wfIn || wavefront(M, fi, wi, N, false);
    const re = new Float64Array(P * P), im = new Float64Array(P * P);
    const o = (P - N) >> 1; let sa = 0;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const w = wf.W[i * N + j]; if (!isFinite(w)) continue;
      const A = apod ? apod(-1 + (2 * j + 1) / N, -1 + (2 * i + 1) / N) : 1; if (!(A > 0)) continue;
      const ph = -2 * Math.PI * w; re[(i + o) * P + j + o] = A * Math.cos(ph); im[(i + o) * P + j + o] = A * Math.sin(ph); sa += A;
    }
    fft2(re, im, P, false);
    const I = new Float64Array(P * P), h = P >> 1, norm = sa * sa || 1;
    let pk = 0;
    for (let y = 0; y < P; y++) for (let x = 0; x < P; x++) {
      const v = (re[y * P + x] ** 2 + im[y * P + x] ** 2) / norm;
      const yy = (y + h) % P, xx = (x + h) % P; I[yy * P + xx] = v; if (v > pk) pk = v;
    }
    const f = typeof fi === 'object' ? fi : M.sys.fields[fi], sc = pupilScale(M, f, wi), lmm = M.ctxs[wi].lmm;
    const dxX = lmm * N / (P * sc.dL), dxY = lmm * N / (P * sc.dM);
    return { I, P, N, dx: Math.sqrt(dxX * dxY), dxX, dxY, sc, strehl: pk, wf };
  }
  /**
   * PSF sur une grille choisie (transformée de Fourier matricielle) : m×m points couvrant [−half, half] mm dans le plan image,
   * à partir d'un front d'onde N×N (wf facultatif). Même normalisation que psf() : le maximum vaut le rapport de Strehl.
   * Résolution indépendante d'une FFT : utile pour la vue 3D et les zooms.
   */
  function psfGrid(M, fi, wi, half, m, N = 128, wfIn, xsIn) {
    const wf = wfIn || wavefront(M, fi, wi, N, false), apod = sysApod(M, wi);
    const sc = pupilScale(M, typeof fi === 'object' ? fi : M.sys.fields[fi], wi), lmm = M.ctxs[wi].lmm;
    const dx = 2 * half / (m - 1), xs = xsIn || Array.from({ length: m }, (_, k) => -half + k * dx);
    const Ar = new Float64Array(N * N), Ai = new Float64Array(N * N); let sa = 0;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const w = wf.W[i * N + j]; if (!isFinite(w)) continue;
      const A = apod ? apod(-1 + (2 * j + 1) / N, -1 + (2 * i + 1) / N) : 1; if (!(A > 0)) continue;
      const ph = -2 * Math.PI * w; Ar[i * N + j] = A * Math.cos(ph); Ai[i * N + j] = A * Math.sin(ph); sa += A;
    }
    // noyau e^{−2πi (j − N/2) x / (λF N)} (même convention que la FFT de psf())
    const ker = D => { const Kr = new Float64Array(m * N), Ki = new Float64Array(m * N); for (let k = 0; k < m; k++) { const x = xs[k]; for (let j = 0; j < N; j++) { const a = -2 * Math.PI * (j - N / 2) * x * D / (lmm * N); Kr[k * N + j] = Math.cos(a); Ki[k * N + j] = Math.sin(a); } } return [Kr, Ki]; };
    let [Kr, Ki] = ker(sc.dL);
    // T = A · Kxᵀ  (N × m), puis E = Ky · T (m × m)
    const Tr = new Float64Array(N * m), Ti = new Float64Array(N * m);
    for (let i = 0; i < N; i++) for (let k = 0; k < m; k++) { let sr = 0, si = 0; const o = i * N, q = k * N; for (let j = 0; j < N; j++) { const ar = Ar[o + j]; if (!ar && !Ai[o + j]) continue; const ai = Ai[o + j], kr = Kr[q + j], ki = Ki[q + j]; sr += ar * kr - ai * ki; si += ar * ki + ai * kr; } Tr[i * m + k] = sr; Ti[i * m + k] = si; }
    [Kr, Ki] = ker(sc.dM);
    const I = new Float64Array(m * m), norm = sa * sa || 1; let pk = 0;
    for (let r = 0; r < m; r++) for (let k = 0; k < m; k++) { let sr = 0, si = 0; const q = r * N; for (let i = 0; i < N; i++) { const tr = Tr[i * m + k], ti = Ti[i * m + k], kr = Kr[q + i], ki = Ki[q + i]; sr += kr * tr - ki * ti; si += kr * ti + ki * tr; } const v = (sr * sr + si * si) / norm; I[r * m + k] = v; if (v > pk) pk = v; }
    return { I, m, dx, half, xs, strehl: pk, wf };
  }
  /**
   * OTF complexe d'un champ à une λ : FFT de la PSF (= autocorrélation discrète exacte de la pupille, P ≥ 2N),
   * fréquences propres à chaque direction (fcT = ΔM/λ, fcS = ΔL/λ), et limite de diffraction sur la même pupille.
   */
  function mtfOne(M, fi, wi, N = 64, P = 128) {
    const p = psf(M, fi, wi, N, P);
    const otf = I => { const re = Float64Array.from(I), im = new Float64Array(P * P); fft2(re, im, P, false); return { re, im }; };
    const O = otf(p.I), W0 = Float64Array.from(p.wf.W, v => isFinite(v) ? 0 : NaN), D = otf(psf(M, fi, wi, N, P, { W: W0 }).I);
    const a0 = Math.hypot(O.re[0], O.im[0]) || 1, d0 = Math.hypot(D.re[0], D.im[0]) || 1, lmm = M.ctxs[wi].lmm;
    const fcT = p.sc.dM / lmm, fcS = p.sc.dL / lmm, Tr = [], Ti = [], Sr = [], Si = [], DT = [], DS = [], T = [], S = [];
    for (let k = 0; k <= N; k++) {
      // le décalage (−1)^k vient du centrage de la PSF au milieu du tableau ; commun à toutes les λ, il est retiré
      const sg = k % 2 ? -1 : 1, iy = (k % P) * P, ix = k % P;
      Tr.push(sg * O.re[iy] / a0); Ti.push(sg * O.im[iy] / a0); Sr.push(sg * O.re[ix] / a0); Si.push(sg * O.im[ix] / a0);
      T.push(Math.hypot(O.re[iy], O.im[iy]) / a0); S.push(Math.hypot(O.re[ix], O.im[ix]) / a0);
      DT.push(Math.hypot(D.re[iy], D.im[iy]) / d0); DS.push(Math.hypot(D.re[ix], D.im[ix]) / d0);
    }
    const fT = T.map((_, k) => k * fcT / N), fS = S.map((_, k) => k * fcS / N), c = ray(M, wi, typeof fi === 'object' ? fi : M.sys.fields[fi], 0, 0);
    return { fT, fS, T, S, Tr, Ti, Sr, Si, DT, DS, fcT, fcS, fc: Math.max(fcT, fcS), strehl: p.strehl, chief: c.vig ? null : [c.x, c.y], sc: p.sc };
  }
  /**
   * OTF par autocorrélation directe de la pupille (méthode de Hopkins, comme CODE V) aux fréquences demandées :
   * OTF(s) = Σ A(x) A(x−s) e^{2πi [W(x) − W(x−s)]} / Σ A², décalage s = 2 f / fc en pupille normalisée, fractionnaire
   * (front d'onde et masque interpolés linéairement) — donc aucune limite de résolution en fréquence.
   * fcT = ΔM/λ et fcS = ΔL/λ (ouverture réelle du champ). Renvoie aussi la limite de diffraction sur la même pupille.
   */
  function otfAC(M, fi, wi, freqs, N = 64) {
    const f = typeof fi === 'object' ? fi : M.sys.fields[fi], wf = wavefront(M, f, wi, N, false), apod = sysApod(M, wi);
    const A = new Float64Array(N * N), W = new Float64Array(N * N);
    let norm = 0;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const w = wf.W[i * N + j]; if (!isFinite(w)) continue; const a = apod ? apod(-1 + (2 * j + 1) / N, -1 + (2 * i + 1) / N) : 1; if (!(a > 0)) continue; A[i * N + j] = a; W[i * N + j] = w; norm += a * a; }
    const sc = pupilScale(M, f, wi), lmm = M.ctxs[wi].lmm, fcT = sc.dM / lmm, fcS = sc.dL / lmm;
    const out = { Tr: [], Ti: [], Sr: [], Si: [], DT: [], DS: [], fcT, fcS, fc: Math.max(fcT, fcS), strehl: NaN };
    const at = (i, j) => (i >= 0 && j >= 0 && i < N && j < N ? i * N + j : -1);
    const one = (fr, fc, alongY) => {
      const sh = fr * N / fc; if (!(sh < N)) return [0, 0, 0];
      const k0 = Math.floor(sh), t = sh - k0; let re = 0, im = 0, dl = 0;
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
        const q = i * N + j, a = A[q]; if (!a) continue;
        const q1 = alongY ? at(i - k0, j) : at(i, j - k0), q0 = alongY ? at(i - k0 - 1, j) : at(i, j - k0 - 1);
        const a1 = q1 >= 0 ? A[q1] : 0, a0 = q0 >= 0 ? A[q0] : 0, b = (1 - t) * a1 + t * a0; if (!b) continue;
        const w2 = a1 && a0 ? (1 - t) * W[q1] + t * W[q0] : a1 ? W[q1] : W[q0];
        const ph = 2 * Math.PI * (W[q] - w2), ab = a * b; re += ab * Math.cos(ph); im += ab * Math.sin(ph); dl += ab;
      }
      return [re / norm, im / norm, dl / norm];
    };
    for (const fr of freqs) { const T = one(fr, fcT, true), S = one(fr, fcS, false); out.Tr.push(T[0]); out.Ti.push(T[1]); out.DT.push(T[2]); out.Sr.push(S[0]); out.Si.push(S[1]); out.DS.push(S[2]); }
    const c = ray(M, wi, f, 0, 0); out.chief = c.vig ? null : [c.x, c.y];
    return out;
  }
  /** interpolation cubique (Catmull-Rom) d'échantillons réguliers ys(x = k·h) ; 0 au-delà du dernier point */
  function cubic(ys, h, x) {
    const n = ys.length - 1, u = x / h; if (u < 0 || u > n) return 0;
    const k = Math.min(n - 1, Math.floor(u)), t = u - k, y = j => ys[Math.max(0, Math.min(n, j))];
    const p0 = y(k - 1), p1 = y(k), p2 = y(k + 1), p3 = y(k + 2);
    return p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
  }
  /**
   * FTM polychromatique par diffraction : somme pondérée des OTF complexes, chacune déphasée de la position de son
   * rayon principal par rapport à celui de la λ de référence (le chromatisme latéral réduit donc la FTM, comme dans CODE V
   * et OpticStudio), puis module. opts : N (échantillonnage pupille, 64 par défaut), fmax, freqs (fréquences imposées).
   */
  function mtf(M, fi, opts = {}) {
    const N = opts.N || 64, f0 = typeof fi === 'object' ? fi : M.sys.fields[fi];
    let fmax = opts.fmax; if (!fmax && !opts.freqs) fmax = Math.max(...M.wls.map((_, wi) => { const sc = pupilScale(M, f0, wi); return Math.max(sc.dM, sc.dL) / M.ctxs[wi].lmm; }));
    const f = opts.freqs || Array.from({ length: 121 }, (_, i) => fmax * i / 120);
    const per = M.wls.map((_, wi) => otfAC(M, f0, wi, f, N));
    const W = M.sys.wavelengths.map(w => w.w ?? 1), Wt = W.reduce((a, b) => a + b, 0) || 1, c0 = per[M.pw].chief || [0, 0];
    const T = [], Sg = [], DL = [];
    f.forEach((fr, k) => {
      let tr = 0, ti = 0, sr = 0, si = 0, d = 0;
      per.forEach((p, wi) => {
        const w = W[wi], dx = p.chief ? p.chief[0] - c0[0] : 0, dy = p.chief ? p.chief[1] - c0[1] : 0, pt = -2 * Math.PI * fr * dy, ps = -2 * Math.PI * fr * dx;
        const ar = p.Tr[k], ai = p.Ti[k], br = p.Sr[k], bi = p.Si[k];
        tr += w * (ar * Math.cos(pt) - ai * Math.sin(pt)); ti += w * (ar * Math.sin(pt) + ai * Math.cos(pt));
        sr += w * (br * Math.cos(ps) - bi * Math.sin(ps)); si += w * (br * Math.sin(ps) + bi * Math.cos(ps));
        d += w * (p.DT[k] + p.DS[k]) / 2;
      });
      T.push(Math.min(1, Math.hypot(tr, ti) / Wt)); Sg.push(Math.min(1, Math.hypot(sr, si) / Wt)); DL.push(Math.min(1, d / Wt));
    });
    // FTM monochromatiques (module) pour l'affichage par longueur d'onde
    per.forEach(p => { p.T = p.Tr.map((r, k) => Math.hypot(r, p.Ti[k])); p.S = p.Sr.map((r, k) => Math.hypot(r, p.Si[k])); });
    return { f, T, S: Sg, DL, per, N, method: 'diff' };
  }
  /**
   * FTM géométrique (CODE V / OpticStudio « Geometric MTF ») : transformée de Fourier des impacts de rayons
   * MTF_T(f) = |Σ w e^{−2πi f y}| / Σ w (MTF_S en x), toutes λ pondérées autour du rayon principal de référence ;
   * dl : multipliée par la FTM d'une pupille parfaite (fc réelle du champ). Adaptée aux systèmes très aberrants (≫ λ).
   */
  function mtfGeo(M, fi, opts = {}) {
    const f0 = typeof fi === 'object' ? fi : M.sys.fields[fi], n = opts.n || 41, grid = pupilGrid(n, M.obs);
    const c0r = ray(M, M.pw, f0, 0, 0), c0 = c0r.vig ? [0, 0] : [c0r.x, c0r.y];
    const pts = [], W = M.sys.wavelengths.map(w => w.w ?? 1);
    let fcT = 0, fcS = 0, wsum = 0;
    M.wls.forEach((_, wi) => {
      const sc = pupilScale(M, f0, wi), lmm = M.ctxs[wi].lmm; fcT += W[wi] * sc.dM / lmm; fcS += W[wi] * sc.dL / lmm; wsum += W[wi];
      const rs = grid.map(([px, py]) => ray(M, wi, f0, px, py)).filter(r => !r.vig), w = W[wi] / (rs.length || 1);
      for (const r of rs) pts.push([r.x - c0[0], r.y - c0[1], w]);
    });
    fcT /= wsum || 1; fcS /= wsum || 1;
    const fmax = opts.fmax || Math.max(fcT, fcS), f = opts.freqs || Array.from({ length: 101 }, (_, i) => fmax * i / 100);
    const tot = pts.reduce((a, q) => a + q[2], 0) || 1, T = [], Sg = [], DL = [];
    for (const fr of f) {
      let tr = 0, ti = 0, sr = 0, si = 0; const k = 2 * Math.PI * fr;
      for (const [x, y, w] of pts) { tr += w * Math.cos(k * y); ti -= w * Math.sin(k * y); sr += w * Math.cos(k * x); si -= w * Math.sin(k * x); }
      const dT = mtfDL(fr / fcT), dS = mtfDL(fr / fcS), dl = opts.dl !== false;
      T.push(Math.hypot(tr, ti) / tot * (dl ? dT : 1)); Sg.push(Math.hypot(sr, si) / tot * (dl ? dS : 1)); DL.push((dT + dS) / 2);
    }
    return { f, T, S: Sg, DL, n: pts.length, method: 'geo' };
  }
  function mtfDL(nu) { if (nu >= 1) return 0; return (2 / Math.PI) * (Math.acos(nu) - nu * Math.sqrt(1 - nu * nu)); }
  function interp(xs, ys, x) {
    if (x <= xs[0]) return ys[0]; if (x >= xs[xs.length - 1]) return 0;
    let i = 1; while (xs[i] < x) i++; const t = (x - xs[i - 1]) / (xs[i] - xs[i - 1]); return ys[i - 1] * (1 - t) + ys[i] * t;
  }
  function encircled(M, fi) {
    const ps = psf(M, fi, M.pw, 64, 256);
    const P = ps.P, h = P >> 1; let tot = 0; const rad = [];
    for (let y = 0; y < P; y++) for (let x = 0; x < P; x++) { const v = ps.I[y * P + x]; tot += v; rad.push([Math.hypot((x - h) * ps.dxX, (y - h) * ps.dxY), v]); }
    rad.sort((a, b) => a[0] - b[0]);
    const rmax = 8 * 1.22 * M.ctxs[M.pw].lmm * M.par.wfno;
    const sp = spot(M, fi, 31);
    const gr = sp.pts.map(q => Math.hypot(q.x - sp.cx, q.y - sp.cy)).sort((a, b) => a - b);
    const R = Math.max(rmax, gr.length ? gr[gr.length - 1] * 1.05 : rmax);
    const nr = 100, r = [], D = [], G = [];
    let k = 0, acc = 0, kg = 0;
    for (let i = 0; i <= nr; i++) {
      const rr = R * i / nr; r.push(rr);
      while (k < rad.length && rad[k][0] <= rr) { acc += rad[k][1]; k++; }
      while (kg < gr.length && gr[kg] <= rr) kg++;
      D.push(acc / tot); G.push(gr.length ? kg / gr.length : NaN);
    }
    return { r, D, G, airy: 1.22 * M.ctxs[M.pw].lmm * M.par.wfno };
  }

  function footprint(M, si, opts = {}) {
    const out = [];
    const ring = 72;
    M.sys.fields.forEach((f, fi) => {
      const pts = [];
      const grid = pupilGrid(opts.n || 15, M.obs);
      const all = grid.concat(Array.from({ length: ring }, (_, k) => [Math.cos(2 * Math.PI * k / ring), Math.sin(2 * Math.PI * k / ring)]));
      for (const [px, py] of all) {
        const P = []; const r = ray(M, M.pw, f, px, py, { pts: P, upto: si });
        if (!r.vig && P.length >= si) pts.push([P[si - 1][3], P[si - 1][4]]);
      }
      out.push({ fi, pts });
    });
    return { fields: out, sd: M.S[si].sd, si };
  }

  function fieldCurves(M, n = 30) {
    const fm = M.par.fmax, res = { f: [], dist: [], per: M.wls.map(() => ({ T: [], S: [] })) };
    const eps = 0.02;
    for (let i = 0; i <= n; i++) {
      const fv = fm * i / n, fy = { x: 0, y: fv }; res.f.push(fv);
      M.wls.forEach((_, wi) => {
        const c = ray(M, wi, fy, 0, 0);
        const fz = (a, b) => {
          const r1 = ray(M, wi, fy, a, b), r2 = ray(M, wi, fy, -a, -b);
          if (c.vig || r1.vig || r2.vig) return NaN;
          const z1 = b ? -(r1.y - c.y) / (r1.M / r1.N - c.M / c.N) : -(r1.x - c.x) / (r1.L / r1.N - c.L / c.N);
          const z2 = b ? -(r2.y - c.y) / (r2.M / r2.N - c.M / c.N) : -(r2.x - c.x) / (r2.L / r2.N - c.L / c.N);
          return (z1 + z2) / 2;
        };
        res.per[wi].T.push(fz(0, eps)); res.per[wi].S.push(fz(eps, 0));
        if (wi === M.pw) {
          const ypar = M.objInf ? M.par.unitImgH * Math.tan(fv * DEG) : M.par.unitImgH * fv;
          res.dist.push(c.vig || Math.abs(ypar) < 1e-12 ? (i === 0 ? 0 : NaN) : 100 * (c.y - ypar) / ypar);
        }
      });
    }
    return res;
  }

  function seidel(M) {
    const S = M.S, N = M.N, n = M.nW[M.pw], m = M.par.mar, c = M.par.chf, H = M.par.H;
    // dispersion : plus courte et plus longue longueur d'onde
    let ls = Math.min(...M.wls), ll = Math.max(...M.wls);
    if (ls === ll) { ls = 0.4861327; ll = 0.6562725; }
    const ns = indices(S, ls, M.env), nl = indices(S, ll, M.env);
    const rows = []; const sum = { SI: 0, SII: 0, SIII: 0, SIV: 0, SV: 0, CL: 0, CT: 0 };
    for (let j = 1; j < N; j++) {
      const cj = curv(S[j]), y = m.y[j], yb = c.y[j];
      const n0 = n[j - 1], n1 = n[j];
      const u = m.nu[j - 1] / n0, u1 = m.nu[j] / n1, ub = c.nu[j - 1] / n0;
      const A = n0 * (y * cj + u), Ab = n0 * (yb * cj + ub);
      const dun = u1 / n1 - u / n0, d1n = 1 / n1 - 1 / n0;
      let SI = -A * A * y * dun, SII = -A * Ab * y * dun, SIII = -Ab * Ab * y * dun, SIV = -H * H * cj * d1n;
      let SV = Math.abs(A) > 1e-14 ? (Ab / A) * (SIII + SIV) : 0;
      const b4 = (S[j].k || 0) * cj * cj * cj / 8 + (S[j].a4 || 0);
      if (b4) { const dl = 8 * b4 * (n1 - n0); SI += dl * y ** 4; SII += dl * y ** 3 * yb; SIII += dl * y * y * yb * yb; SV += dl * y * yb ** 3; }
      const dn0 = ns[j - 1] - nl[j - 1], dn1 = ns[j] - nl[j];
      const dd = dn1 / n1 - dn0 / n0;
      const CL = -A * y * dd, CT = -Ab * y * dd;
      const row = { j, SI, SII, SIII, SIV, SV, CL, CT };
      rows.push(row); for (const k in sum) sum[k] += row[k];
    }
    return { rows, sum, lmm: M.ctxs[M.pw].lmm };
  }

  function chromShift(M, n = 40) {
    let a = Math.min(...M.wls), b = Math.max(...M.wls);
    if (b - a < 0.05) { a = Math.max(0.35, a - 0.1); b = b + 0.1; }
    const ref = M.par.imgDist, l = [], dz = [];
    for (let i = 0; i <= n; i++) {
      const lam = a + (b - a) * i / n; l.push(lam);
      const nn = indices(M.S, lam, M.env);
      const p = paraxial(M.sys, nn, M.stopIdx, M.objInf);
      dz.push((p.imgDist - ref) * 1000);
    }
    return { l, dz };
  }

  /* ---------------- Simulation d'image ---------------- */
  /**
   * src : { w, h, ch: [R, G, B] Float32Array 0..1 } ; opt : { size, fm (demi-champ objet), np (grille de PSF) }
   * Distorsion par les rayons principaux, PSF (diffraction ou géométrique) variable dans le champ par canal, vignetage.
   */
  function imageSim(M, src, opt = {}) {
    let S = opt.size || 256; const fm = opt.fm || M.par.fmax, NP = opt.np || 5, GM = 17;
    const order = M.wls.map((l, i) => [l, i]).sort((a, b) => a[0] - b[0]).map(a => a[1]);
    const chW = [order[order.length - 1], order[Math.floor(order.length / 2)], order[0]];
    // objet à l'infini : un point de la scène en haut (+v) est vu sous un angle de champ négatif (rayons descendants)
    const uniq = [...new Set(chW)], sg = M.objInf ? -1 : 1, fobj = (u, v) => ({ x: sg * u * fm, y: sg * v * fm });
    // 1. cartographie objet → image (rayons principaux)
    const maps = {}; let H = 0;
    for (const wi of uniq) {
      const m = new Float64Array(GM * GM * 2).fill(NaN);
      for (let i = 0; i < GM; i++) for (let j = 0; j < GM; j++) {
        const r = ray(M, wi, fobj(-1 + 2 * j / (GM - 1), -1 + 2 * i / (GM - 1)), 0, 0);
        if (!r.vig) { m[(i * GM + j) * 2] = r.x; m[(i * GM + j) * 2 + 1] = r.y; H = Math.max(H, Math.abs(r.x), Math.abs(r.y)); }
      }
      maps[wi] = m;
    }
    if (!(H > 0)) return null;
    H *= 1.06; let pix = 2 * H / S;
    let under = false;
    if (opt.pix > 0) { const need = Math.ceil(2 * H / opt.pix), mx = opt.maxS || 512; if (need <= mx) { pix = opt.pix; S = Math.max(16, need); H = S * pix / 2; } else { S = mx; pix = 2 * H / S; under = true; } }
    // 2. PSF sur une grille NP × NP du champ
    const raw = {}; let Rmax = 0;
    const tot = pupilGrid(32, M.obs).length;
    for (const wi of uniq) {
      raw[wi] = [];
      for (let i = 0; i < NP; i++) for (let j = 0; j < NP; j++) {
        const f = fobj(-1 + 2 * j / (NP - 1), -1 + 2 * i / (NP - 1));
        const wf = wavefront(M, f, wi, 32, false); let pts = [];
        if (wf.ok) {
          const T = Math.min(1, wf.n / tot);
          if (wf.rms > 1.5) {
            const sp = spot(M, f, 41, wi); if (sp.chief && sp.pts.length) { const w = T / sp.pts.length; pts = sp.pts.map(q => [q.x - sp.chief[0], q.y - sp.chief[1], w]); }
          } else {
            const ps = psf(M, f, wi, 32, 128, wf), P = ps.P, h = P >> 1; let sum = 0, mx = 0;
            for (const v of ps.I) { sum += v; if (v > mx) mx = v; }
            for (let y = 0; y < P; y++) for (let x = 0; x < P; x++) { const v = ps.I[y * P + x]; if (v > mx * 1e-4) pts.push([(x - h) * ps.dx, (y - h) * ps.dx, v / sum * T]); }
          }
          // rayon à 99 % d'énergie
          const rr = pts.map(q => [Math.hypot(q[0], q[1]), q[2]]).sort((a, b) => a[0] - b[0]); let acc = 0; const et = rr.reduce((a, b) => a + b[1], 0);
          for (const [r, w] of rr) { acc += w; if (acc >= 0.99 * et) { Rmax = Math.max(Rmax, r); break; } }
        }
        raw[wi].push(pts);
      }
    }
    const half = Math.max(1, Math.min(15, Math.ceil(Rmax / pix) + 1)), K = 2 * half + 1;
    const kern = {};
    for (const wi of uniq) kern[wi] = raw[wi].map(pts => {
      const k = new Float32Array(K * K);
      for (const [dx, dy, w] of pts) {
        const cx = dx / pix + half, cy = half - dy / pix, x0 = Math.floor(cx), y0 = Math.floor(cy), fx = cx - x0, fy = cy - y0;
        const add = (xx, yy, ww) => { if (xx >= 0 && xx < K && yy >= 0 && yy < K) k[yy * K + xx] += ww; };
        add(x0, y0, w * (1 - fx) * (1 - fy)); add(x0 + 1, y0, w * fx * (1 - fy)); add(x0, y0 + 1, w * (1 - fx) * fy); add(x0 + 1, y0 + 1, w * fx * fy);
      }
      const idx = []; for (let q = 0; q < K * K; q++) if (k[q] > 1e-7) idx.push(q);
      return { k, off: Int32Array.from(idx.map(q => (Math.floor(q / K) - half) * S + (q % K - half))), dr: Int32Array.from(idx.map(q => Math.floor(q / K) - half)), dc: Int32Array.from(idx.map(q => q % K - half)), w: Float32Array.from(idx.map(q => k[q])) };
    });
    // 3. échantillonnage de l'objet et projection géométrique (distorsion, couleur latérale)
    const Sin = 2 * S, m2 = Math.max(src.w, src.h), out = [];
    const bil = (A, x, y) => { const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, W = src.w, Hh = src.h; const g = (xx, yy) => A[Math.min(Hh - 1, Math.max(0, yy)) * W + Math.min(W - 1, Math.max(0, xx))]; return g(x0, y0) * (1 - fx) * (1 - fy) + g(x0 + 1, y0) * fx * (1 - fy) + g(x0, y0 + 1) * (1 - fx) * fy + g(x0 + 1, y0 + 1) * fx * fy; };
    const geo = {};
    for (const wi of uniq) {
      const m = maps[wi], val = [new Float32Array(S * S), new Float32Array(S * S), new Float32Array(S * S)], wgt = new Float32Array(S * S);
      for (let b = 0; b < Sin; b++) for (let a = 0; a < Sin; a++) {
        const u = -1 + (2 * a + 1) / Sin, v = 1 - (2 * b + 1) / Sin;
        const sx = u * m2 / 2 + src.w / 2 - 0.5, sy = -v * m2 / 2 + src.h / 2 - 0.5;
        if (sx < -0.5 || sy < -0.5 || sx > src.w - 0.5 || sy > src.h - 0.5) continue;
        const gu = (u + 1) / 2 * (GM - 1), gv = (v + 1) / 2 * (GM - 1), i0 = Math.min(GM - 2, Math.floor(gv)), j0 = Math.min(GM - 2, Math.floor(gu)), fu = gu - j0, fv = gv - i0;
        const P = (i, j, c) => m[((i0 + i) * GM + j0 + j) * 2 + c];
        const x = P(0, 0, 0) * (1 - fu) * (1 - fv) + P(0, 1, 0) * fu * (1 - fv) + P(1, 0, 0) * (1 - fu) * fv + P(1, 1, 0) * fu * fv;
        const y = P(0, 0, 1) * (1 - fu) * (1 - fv) + P(0, 1, 1) * fu * (1 - fv) + P(1, 0, 1) * (1 - fu) * fv + P(1, 1, 1) * fu * fv;
        if (!isFinite(x) || !isFinite(y)) continue;
        const cc = (x + H) / pix - 0.5, rr = (H - y) / pix - 0.5, c0 = Math.floor(cc), r0 = Math.floor(rr), fc = cc - c0, fr = rr - r0;
        const vs = [0, 1, 2].map(c => chW[c] === wi ? bil(src.ch[c], sx, sy) : 0);
        const sp = (cI, rI, w) => { if (cI < 0 || rI < 0 || cI >= S || rI >= S) return; const q = rI * S + cI; wgt[q] += w; for (let c = 0; c < 3; c++) if (vs[c]) val[c][q] += w * vs[c]; };
        sp(c0, r0, (1 - fc) * (1 - fr)); sp(c0 + 1, r0, fc * (1 - fr)); sp(c0, r0 + 1, (1 - fc) * fr); sp(c0 + 1, r0 + 1, fc * fr);
      }
      for (let c = 0; c < 3; c++) for (let q = 0; q < S * S; q++) if (wgt[q] > 1e-6) val[c][q] /= wgt[q]; else val[c][q] = 0;
      geo[wi] = val;
    }
    // 4. convolution par la PSF locale (interpolation bilinéaire entre les 4 PSF voisines)
    const ctr = uniq.map(wi => { const m = maps[wi], c = (GM - 1) / 2; return [wi, m[(c * GM + GM - 1) * 2], m[((GM - 1) * GM + c) * 2 + 1]]; });
    for (let c = 0; c < 3; c++) {
      const wi = chW[c], img = geo[wi][c], o = new Float32Array(S * S), Kw = kern[wi];
      const [, Ex, Ey] = ctr.find(q => q[0] === wi);
      for (let row = 0; row < S; row++) for (let col = 0; col < S; col++) {
        const x = -H + (col + 0.5) * pix, y = H - (row + 0.5) * pix;
        const u = Math.max(-1, Math.min(1, x / (Ex || 1))), v = Math.max(-1, Math.min(1, y / (Ey || 1)));
        const gu = (u + 1) / 2 * (NP - 1), gv = (v + 1) / 2 * (NP - 1), i0 = Math.min(NP - 2, Math.floor(gv)), j0 = Math.min(NP - 2, Math.floor(gu)), fu = gu - j0, fv = gv - i0;
        let acc = 0;
        const W4 = [[i0, j0, (1 - fu) * (1 - fv)], [i0, j0 + 1, fu * (1 - fv)], [i0 + 1, j0, (1 - fu) * fv], [i0 + 1, j0 + 1, fu * fv]];
        const p = row * S + col;
        for (const [ii, jj, ww] of W4) {
          if (ww < 1e-6) continue; const kk = Kw[ii * NP + jj]; let a = 0;
          for (let q = 0; q < kk.w.length; q++) { const rr = row - kk.dr[q], cc = col - kk.dc[q]; if (rr >= 0 && rr < S && cc >= 0 && cc < S) a += img[p - kk.off[q]] * kk.w[q]; }
          acc += ww * a;
        }
        o[p] = acc;
      }
      out.push(o);
    }
    return { S, ch: out, pix, H, fm, K, chW, under };
  }

  /* ---------------- Détecteur ---------------- */
  /** intègre une PSF (grille P×P, pas dx mm, centrée en P/2) sur des pixels de pas p (mm) ; phase 'centre' ou 'coin' */
  /** fraction d'un échantillon (centre u ∈ [0, 1[ dans le pixel, demi-largeur hw en pixels) recouvrant la zone active [½ − half, ½ + half] */
  const ffW = (u, hw, half) => Math.max(0, Math.min(u + hw, 0.5 + half) - Math.max(u - hw, 0.5 - half)) / (2 * hw);
  /** ff : taux de remplissage (0–1) : seule la zone active carrée centrée de côté p·√ff collecte la lumière (recouvrement exact échantillon / zone active) */
  function binPSF(I, P, dx, p, phase = 'centre', nb = 9, ff = 1) {
    const h = P >> 1, off = phase === 'coin' ? 0 : 0.5, G = new Float64Array(nb * nb), c = nb >> 1, half = Math.sqrt(Math.min(1, Math.max(1e-4, ff))) / 2, hw = Math.min(0.5, dx / p / 2); let tot = 0;
    for (let y = 0; y < P; y++) for (let x = 0; x < P; x++) {
      const v = I[y * P + x]; if (!v) continue; tot += v;
      const ux = (x - h) * dx / p + off, uy = (y - h) * dx / p + off, fx0 = Math.floor(ux), fy0 = Math.floor(uy), ix = fx0 + c, iy = fy0 + c;
      const wf = half < 0.5 ? ffW(ux - fx0, hw, half) * ffW(uy - fy0, hw, half) : 1; if (!wf) continue;
      if (ix >= 0 && iy >= 0 && ix < nb && iy < nb) G[iy * nb + ix] += v * wf;
    }
    for (let k = 0; k < G.length; k++) G[k] /= tot || 1;
    return { G, nb };
  }
  /** FTM d'un pixel : zone active carrée de côté p·√ff (ff = taux de remplissage surfacique, 0–1), |sinc(π f p √ff)| */
  const detMTF = (f, p, ff = 1) => { const a = Math.PI * f * p * Math.sqrt(Math.min(1, Math.max(1e-4, ff))); return a < 1e-9 ? 1 : Math.abs(Math.sin(a) / a); };

  /* ---------------- Fibres optiques ---------------- */
  /** grandeurs d'une fibre à la longueur d'onde l (µm) : V, coupure, MFD (Marcuse), nombre de modes, régime */
  function fiberInfo(fb, l) {
    const a = (+fb.core || 0) / 2, na = +fb.na || 0, V = 2 * Math.PI * a * na / l, lc = 2 * Math.PI * a * na / 2.405;
    const w = V > 0 ? a * (0.65 + 1.619 * Math.pow(V, -1.5) + 2.879 * Math.pow(V, -6)) : NaN;
    const mfd = fb.fib === 'sm' && +fb.mfd > 0 ? +fb.mfd : 2 * w;
    const modes = fb.fib === 'gi' ? V * V / 4 : V * V / 2;
    return { V, lc, mfd, modes: V < 2.405 ? 1 : Math.round(modes), single: V < 2.405, etendue: Math.PI * a * a * Math.PI * na * na };
  }

  /* ---------------- Couplage source → système → récepteur (tracé de rayons réels) ---------------- */
  /**
   * Description physique d'une source pour le couplage. o : { type: 'fiber'|'disk'|'gauss'|'rect'|'point', fib 'si'|'gi'|'sm', core (µm), na, mfd (µm), d (µm), w, h (µm) }.
   * Renvoie { pts: [[dx, dy (mm), poids, ON locale]], I(s², naLoc, l) intensité par élément d²s (sinus directeurs), tot(naLoc, l) = ∫ I d²s, coherent, mfd(l) }.
   * Luminance : fibre à saut d'indice / disque = uniforme dans le cône d'ON ; gradient d'indice = ON locale NA·√(1 − r²/a²) et
   * densité de puissance ∝ 1 − r²/a² ; monomode / tache gaussienne = mode gaussien, divergence θ0 = λ/(π w0).
   */
  function srcModelDesc(o, NAdef, opts) {
    const t = o.type === 'fiber' ? (o.fib || 'si') : o.type || 'point', na = +o.na > 0 ? Math.min(1, +o.na) : NAdef, pts = [];
    if (t === 'sm' || t === 'gauss') {
      const mfd = l => t === 'sm' ? (+o.mfd > 0 ? +o.mfd : fiberInfo(o, l).mfd) : (+o.d || 10);
      return { kind: t, coherent: true, pts: [[0, 0, 1, 0]], mfd, I: (s2, _, l) => { const th = l / (Math.PI * mfd(l) / 2); return Math.exp(-2 * s2 / (th * th)); }, tot: (_, l) => { const th = l / (Math.PI * mfd(l) / 2); return Math.PI * th * th / 2; } };
    }
    if (t === 'point') return { kind: t, pts: [[0, 0, 1, na]], I: (s2, nl, l, ws) => cone(s2, na, ws), tot: () => Math.PI * na * na };
    if (t === 'rect') { const w = (+o.w || 0) * 1e-3, h = (+o.h || 0) * 1e-3; for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) pts.push([i * w / 3, j * h / 3, 1 / 9, 0]);
      return { kind: t, pts, I: (s2, nl, l, ws) => cone(s2, na, ws), tot: () => Math.PI * na * na }; }
    const a = (t === 'si' || t === 'gi' ? +o.core : +o.d) / 2 * 1e-3 || 0, gi = t === 'gi';
    // quadrature du disque : anneaux d'aires égales (milieu en u = r²/a²), 4·(i+1) points chacun, décalés d'un anneau à l'autre ;
    // poids ∝ aire × densité de puissance (1 − u pour le gradient d'indice), ON locale NA·√(1 − u) (gradient) ou NA (saut d'indice)
    const NR = opts && opts.rings || 4;
    if (a <= 0) pts.push([0, 0, 1, na]);
    else { let sw = 0; for (let i = 0; i < NR; i++) { const u = (i + 0.5) / NR, r = a * Math.sqrt(u), nk = 4 * (i + 1), w = gi ? 1 - u : 1; sw += w;
      for (let k = 0; k < nk; k++) { const q = 2 * Math.PI * (k + 0.5 * (i % 2)) / nk; pts.push([r * Math.cos(q), r * Math.sin(q), w / nk, gi ? na * Math.sqrt(1 - u) : na]); } }
      for (const q of pts) q[2] /= sw; }
    return { kind: t, pts, I: (s2, nl, l, ws) => cone(s2, nl, ws), tot: nl => Math.PI * nl * nl };
  }
  /** indicatrice du cône |s| ≤ NA lissée sur une cellule de largeur ws (fraction couverte au 1ᵉʳ ordre : bord rectiligne) — supprime le crénelage */
  function cone(s2, na, ws) { const r = Math.sqrt(s2); if (!(ws > 0)) return r <= na ? 1 : 0; return Math.max(0, Math.min(1, 0.5 + (na - r) / ws)); }
  /** sinus directeurs (x, y) du rayon lancé vers la pupille (px, py) depuis le point objet f */
  function launchSin(M, ctx, f, px, py) { const a = (px === 0 && py === 0) ? chiefAim(M, ctx, f) : aimRay(M, ctx, f, px, py), s = startAt(M, ctx, f, a[0], a[1]); return [s.d[0], s.d[1]]; }
  /**
   * Pavage de la pupille d'entrée en n × n cellules : pour chaque cellule (fraction couverte f ∈ ]0, 1], obstruction exclue), le rayon central tracé
   * sans facteurs de vignetage, ses sinus directeurs de départ, et l'aire de la cellule dans l'espace des sinus objet (dS, polygone des 4 coins —
   * la jacobienne pupille ↔ direction est ainsi exacte au 2ᵉ ordre, y compris avec la visée réelle) ; out : aussi l'aire dans l'espace des sinus image (dO).
   */
  function pupilCells(M, wi, f, n, out) {
    const ctx = M.ctxs[wi], dp = 2 / n, obs = M.obs || 0, C = [], inf = M.objInf;
    const cs = new Array((n + 1) * (n + 1)), co = out ? new Array((n + 1) * (n + 1)) : null;
    const corner = (i, j) => { const k = j * (n + 1) + i; if (cs[k] === undefined) { const px = -1 + i * dp, py = -1 + j * dp; cs[k] = inf ? null : launchSin(M, ctx, f, px, py); if (out) { const r = ray(M, wi, f, px, py, { noVig: true }); co[k] = r.vig ? null : [r.L, r.M]; } } return k; };
    const area = q => q.some(v => !v) ? NaN : Math.abs((q[0][0] - q[2][0]) * (q[1][1] - q[3][1]) - (q[1][0] - q[3][0]) * (q[0][1] - q[2][1])) / 2;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      let fr = 0; for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) { const x = -1 + (i + (a + 0.5) / 4) * dp, y = -1 + (j + (b + 0.5) / 4) * dp, r = Math.hypot(x, y); if (r <= 1 && r >= obs) fr++; }
      if (!fr) continue; fr /= 16;
      const px = -1 + (i + 0.5) * dp, py = -1 + (j + 0.5) * dp, K = [corner(i, j), corner(i + 1, j), corner(i + 1, j + 1), corner(i, j + 1)];
      const r = ray(M, wi, f, px, py, { noVig: true });
      const s = inf ? [0, 0] : launchSin(M, ctx, f, px, py), dS = inf ? dp * dp * M.epr * M.epr : area(K.map(k => cs[k]));
      C.push({ px, py, fr, s, dS, r, dO: out ? area(K.map(k => co[k])) : NaN });
    }
    return C;
  }
  /**
   * Couplage d'une source (objet à distance finie) dans le système, par rayons réels : pour chaque point de quadrature de la source et chaque cellule
   * de la pupille d'entrée, l'énergie est I(direction) × aire de la cellule dans l'espace des sinus ; elle est comptée si le rayon atteint l'image
   * sans être arrêté (diaphragmes, ouvertures fixes). η = puissance à l'image / puissance émise ; « pupille » = part dirigée vers la pupille d'entrée
   * (troncature par l'ON objet), « vig » = part de celle-ci non arrêtée en chemin.
   * rcv (optionnel) : fibre réceptrice multimode { core (µm), na, gi } centrée sur l'image du centre de la source (λ primaire), axe = rayon principal.
   */
  function srcCoupling(M, f0, o, opts = {}) {
    if (M.objInf) return null;
    const n = opts.n || 24, desc = srcModelDesc(o, 1, opts), W = M.sys.wavelengths.map(w => w.w ?? 1), Wt = W.reduce((a, b) => a + b, 0) || 1, rcv = opts.rcv;
    const c0 = ray(M, M.pw, f0, 0, 0, { noVig: true }); if (c0.vig) return null;
    let eta = 0, etaPupil = 0, etaR = 0; const per = [];
    M.wls.forEach((l, wi) => {
      let acc = 0, accP = 0, accR = 0, tot = 0;
      for (const [dx, dy, wp, nl] of desc.pts) {
        const f = { x: (f0.x || 0) + dx, y: (f0.y || 0) + dy }, T = desc.tot(nl, l); tot += wp; if (!(T > 0)) continue;
        let sa = 0, sp = 0, sr = 0;
        for (const c of pupilCells(M, wi, f, n, !!rcv)) {
          if (!isFinite(c.dS)) continue; const I = desc.I(c.s[0] * c.s[0] + c.s[1] * c.s[1], nl, l, Math.sqrt(c.dS)); if (!(I > 0)) continue;
          const e = I * c.dS * c.fr; sp += e; if (c.r.vig) continue; sa += e;
          if (rcv) { const r = c.r, rr = Math.hypot(r.x - c0.x, r.y - c0.y), ar = rcv.core / 2e3; if (rr <= ar) { const cosA = r.L * c0.L + r.M * c0.M + r.N * c0.N, sA = Math.sqrt(Math.max(0, 1 - cosA * cosA)), nar = rcv.gi ? rcv.na * Math.sqrt(Math.max(0, 1 - (rr / ar) ** 2)) : rcv.na; sr += e * cone(sA * sA, nar, isFinite(c.dO) ? Math.sqrt(c.dO) : 0); } }
        }
        acc += wp * Math.min(1, sa / T); accP += wp * Math.min(1, sp / T); accR += wp * Math.min(1, sr / T);
      }
      const e = tot ? acc / tot : 0, ep = tot ? accP / tot : 0, er = tot ? accR / tot : 0;
      per.push({ l, eta: e, pupil: ep, rcv: er }); eta += W[wi] / Wt * e; etaPupil += W[wi] / Wt * ep; etaR += W[wi] / Wt * er;
    });
    return { eta, pupil: etaPupil, vig: etaPupil > 0 ? eta / etaPupil : 0, rcv: rcv ? etaR : null, per, kind: desc.kind, NAs: M.par.objNA };
  }
  /** transmission : absorption interne des verres (sur l'axe) et, si fresnel, pertes de Fresnel en incidence normale à chaque dioptre non traité */
  function sysTransmission(M, wi, fresnel) {
    const tau = sysTau(M.sys, M.wls[wi]); let tf = 1;
    if (fresnel) { const n = M.ctxs[wi].nAbs; for (let j = 1; j < M.N; j++) { const s = M.S[j]; if (isMirror(s) || s.elem) continue; const a = n[j - 1], b = n[j]; if (Math.abs(a - b) > 1e-9) tf *= 1 - ((a - b) / (a + b)) ** 2; } }
    return { tau: isFinite(tau) ? tau : 1, fres: tf };
  }
  /**
   * Couplage dans une fibre réceptrice monomode par intégrale de recouvrement des champs dans la pupille (méthode des calculs de couplage fibré de CODE V) :
   * η = |Σ √(I dS) · g(s′) · √dO · e^{i2πW}|² / (Σ I dS · π θr² / 2), W = écart de front d'onde réel (λ) par rapport à la sphère centrée sur l'image du point,
   * g = champ lointain gaussien du mode reçu (θr = λ / (π w_r), MFD = 2 w_r) centré sur le rayon principal, dS / dO = aires des cellules dans les espaces
   * des sinus objet / image. Source : mode gaussien (monomode, tache gaussienne), sinon pupille uniformément éclairée (point, objet à l'infini).
   */
  function smCoupling(M, f, o, mfdR, opts = {}) {
    const n = opts.n || 32, desc = srcModelDesc(o || { type: 'point' }, 1), W = M.sys.wavelengths.map(w => w.w ?? 1), Wt = W.reduce((a, b) => a + b, 0) || 1;
    const c0 = ray(M, M.pw, f, 0, 0, { noVig: true }); if (c0.vig || !(mfdR > 0)) return null;
    const gauss = !M.objInf && (desc.kind === 'sm' || desc.kind === 'gauss');
    let eta = 0; const per = [];
    M.wls.forEach((l, wi) => {
      const ref = opdRef(M, wi, f); if (!ref) { per.push({ l, eta: 0 }); return; }
      const cw = ref.chief, thR = l / (Math.PI * mfdR / 2), nI = M.ctxs[wi].nAbs[M.N - 1];
      let re = 0, im = 0, Is = 0;
      for (const c of pupilCells(M, wi, f, n, true)) {
        if (!isFinite(c.dS)) continue;
        const I = gauss ? desc.I(c.s[0] * c.s[0] + c.s[1] * c.s[1], 1, l) : 1, m = I * c.dS * c.fr; Is += m;
        if (c.r.vig || !isFinite(c.dO)) continue; const w = ref.W(c.r); if (!isFinite(w)) continue;
        const sx = nI * (c.r.L - cw.L), sy = nI * (c.r.M - cw.M), g = Math.exp(-(sx * sx + sy * sy) / (thR * thR));
        const a = Math.sqrt(m) * g * Math.sqrt(c.dO * c.fr * nI * nI), ph = 2 * Math.PI * w; re += a * Math.cos(ph); im += a * Math.sin(ph);
      }
      if (gauss) Is = Math.max(Is, desc.tot(1, l)); // l'énergie hors pupille compte dans le dénominateur
      const e = Is > 0 ? Math.min(1, (re * re + im * im) / (Is * Math.PI * thR * thR / 2)) : 0;
      per.push({ l, eta: e }); eta += W[wi] / Wt * e;
    });
    return { eta, per };
  }
  /* ---------------- Source étendue (fibre, fente…) ---------------- */
  /**
   * o : { type: 'point'|'disk'|'gauss'|'rect', d (diamètre / MFD), w, h, na }. Unités objet : µm (objet à distance finie) ou secondes d'arc (objet à l'infini).
   * Image = (source projetée par la jacobienne locale des rayons principaux) ⊗ PSF (pupille apodisée par l'émission de la source), polychromatique.
   */
  function extSource(M, fi, o) {
    const f = typeof fi === 'object' ? fi : M.sys.fields[fi], inf = M.objInf;
    const uo = inf ? 1 / 3600 : 1e-3; // unité objet → degré ou mm
    const c0 = ray(M, M.pw, f, 0, 0); if (c0.vig) return null;
    const dl = inf ? 1e-3 : 1e-3, cx = ray(M, M.pw, { x: f.x + dl, y: f.y }, 0, 0), cy = ray(M, M.pw, { x: f.x, y: f.y + dl }, 0, 0);
    const J = [(cx.x - c0.x) / dl * uo, (cy.x - c0.x) / dl * uo, (cx.y - c0.y) / dl * uo, (cy.y - c0.y) / dl * uo]; // mm image / unité objet
    const NAs = inf ? 0 : M.par.objNA;
    let type = o.type || 'disk';
    const fb = type === 'fiber' ? o : null, fkind = fb ? (fb.fib || 'si') : null;
    if (fb) { o = { ...o, d: fkind === 'sm' ? fiberInfo(fb, M.wls[M.pw]).mfd : +fb.core, na: +fb.na }; type = fkind === 'sm' ? 'gauss' : fkind === 'gi' ? 'gi' : 'disk'; }
    const W = M.sys.wavelengths.map(w => w.w ?? 1), Wt = W.reduce((a, b) => a + b, 0);
    // demi-étendue de la source dans l'image
    let sh = 0; const d = +o.d || 0, ww = +o.w || 0, hh = +o.h || 0;
    const corners = type === 'rect' ? [[ww / 2, hh / 2], [-ww / 2, hh / 2]] : type === 'gauss' ? [[d, 0], [0, d]] : [[d / 2, 0], [0, d / 2]];
    o.type = type;
    for (const [u, v] of corners) { sh = Math.max(sh, Math.hypot(J[0] * u + J[1] * v, J[2] * u + J[3] * v)); }
    // PSF par longueur d'onde
    const psfs = []; let r99 = 0, dxMin = Infinity; const coup = [];
    M.wls.forEach((l, wi) => {
      const lmm = M.ctxs[wi].lmm; let apod = null, cp = 1;
      if (!inf && type === 'disk' && +o.na > 0 && NAs > 0) { const rm = Math.min(1, o.na / NAs); apod = (x, y) => (x * x + y * y <= rm * rm ? 1 : 0); cp = Math.min(1, (NAs / o.na) ** 2); }
      if (!inf && type === 'gi' && +o.na > 0 && NAs > 0) { const k = NAs / o.na; apod = (x, y) => Math.sqrt(Math.max(0, 1 - (x * x + y * y) * k * k)); const t = Math.min(1, k); cp = 2 * t * t - t ** 4; }
      if (!inf && type === 'gauss' && d > 0 && NAs > 0) {
        const dd = fkind === 'sm' && !(+fb.mfd > 0) ? fiberInfo(fb, l).mfd : d; // MFD dépend de λ
        const t0 = lmm / (Math.PI * dd * 1e-3 / 2); apod = (x, y) => Math.exp(-((x * x + y * y) * NAs * NAs) / (t0 * t0)); cp = 1 - Math.exp(-2 * NAs * NAs / (t0 * t0)); }
      coup.push(cp);
      const wf = wavefront(M, f, wi, 64, false), cw = ray(M, wi, f, 0, 0);
      const sh0 = cw.vig ? [0, 0] : [cw.x - c0.x, cw.y - c0.y];
      let pts = [];
      if (wf.rms > 1.5) {
        for (const [px, py] of pupilGrid(41, M.obs)) { const A = apod ? apod(px, py) : 1; if (!(A > 0)) continue; const r = ray(M, wi, f, px, py); if (!r.vig) pts.push([r.x - c0.x, r.y - c0.y, A * A]); }
      } else {
        const ps = psf(M, f, wi, 64, 256, wf, apod), P = ps.P, h = P >> 1; let mx = 0; for (const v of ps.I) mx = Math.max(mx, v);
        for (let y = 0; y < P; y++) for (let x = 0; x < P; x++) { const v = ps.I[y * P + x]; if (v > mx * 1e-5) pts.push([(x - h) * ps.dx + sh0[0], (y - h) * ps.dx + sh0[1], v]); }
        dxMin = Math.min(dxMin, ps.dx);
      }
      let sw = pts.reduce((a, q) => a + q[2], 0) || 1; pts.forEach(q => q[2] *= W[wi] / Wt / sw);
      const rr = pts.map(q => [Math.hypot(q[0], q[1]), q[2]]).sort((a, b) => a[0] - b[0]); let acc = 0;
      for (const [r, w] of rr) { acc += w; if (acc >= 0.995 * W[wi] / Wt) { r99 = Math.max(r99, r); break; } }
      psfs.push(pts);
    });
    // grille de sortie
    const Q = 256, ext = 2 * (sh + r99) * 1.12 || 1e-3;
    const pq = Math.max(ext / Q, isFinite(dxMin) ? Math.min(dxMin, ext / 64) : ext / Q);
    const Qe = Q, P2 = 2 * Qe, h = Qe >> 1;
    const ker = new Float64Array(P2 * P2), src = new Float64Array(P2 * P2);
    for (const pts of psfs) for (const [x, y, w] of pts) {
      const cx = x / pq, cy = y / pq, x0 = Math.floor(cx), y0 = Math.floor(cy), fx = cx - x0, fy = cy - y0;
      const add = (i, j, v) => { const ii = ((i % P2) + P2) % P2, jj = ((j % P2) + P2) % P2; ker[jj * P2 + ii] += v; };
      add(x0, y0, w * (1 - fx) * (1 - fy)); add(x0 + 1, y0, w * fx * (1 - fy)); add(x0, y0 + 1, w * (1 - fx) * fy); add(x0 + 1, y0 + 1, w * fx * fy);
    }
    // source projetée (inverse de la jacobienne), suréchantillonnée 4×4
    const det = J[0] * J[3] - J[1] * J[2], Ji = [J[3] / det, -J[1] / det, -J[2] / det, J[0] / det], ns = 4;
    const inside = (u, v) => type === 'point' ? 0 : type === 'rect' ? (Math.abs(u) <= ww / 2 && Math.abs(v) <= hh / 2 ? 1 : 0) : type === 'gauss' ? Math.exp(-2 * (u * u + v * v) / ((d / 2) ** 2)) : type === 'gi' ? Math.max(0, 1 - (u * u + v * v) / ((d / 2) ** 2)) : (u * u + v * v <= (d / 2) ** 2 ? 1 : 0);
    let ssum = 0;
    if (type === 'point' || sh < pq * 0.25) { src[h * P2 + h] = 1; ssum = 1; }
    else for (let j = 0; j < Qe; j++) for (let i = 0; i < Qe; i++) {
      let v = 0;
      for (let a = 0; a < ns; a++) for (let b = 0; b < ns; b++) { const x = (i - h + (a + 0.5) / ns - 0.5) * pq, y = (j - h + (b + 0.5) / ns - 0.5) * pq; v += inside(Ji[0] * x + Ji[1] * y, Ji[2] * x + Ji[3] * y); }
      if (v) { src[j * P2 + i] = v; ssum += v; }
    }
    for (let k = 0; k < src.length; k++) src[k] /= ssum || 1;
    // convolution par FFT
    const ar = Float64Array.from(src), ai = new Float64Array(P2 * P2), br = Float64Array.from(ker), bi = new Float64Array(P2 * P2);
    fft2(ar, ai, P2, false); fft2(br, bi, P2, false);
    for (let k = 0; k < ar.length; k++) { const r = ar[k] * br[k] - ai[k] * bi[k], m = ar[k] * bi[k] + ai[k] * br[k]; ar[k] = r; ai[k] = m; }
    fft2(ar, ai, P2, true);
    const img = new Float64Array(Qe * Qe), sImg = new Float64Array(Qe * Qe); let tot = 0, pk = 0, cxm = 0, cym = 0;
    for (let j = 0; j < Qe; j++) for (let i = 0; i < Qe; i++) { const v = Math.max(0, ar[j * P2 + i] / (P2 * P2)); img[j * Qe + i] = v; sImg[j * Qe + i] = src[j * P2 + i]; tot += v; pk = Math.max(pk, v); cxm += v * i; cym += v * j; }
    cxm /= tot; cym /= tot;
    // métriques
    const prof = (horiz) => { const out = new Float64Array(Qe), r0 = Math.round(cym), c0i = Math.round(cxm); for (let k = 0; k < Qe; k++) out[k] = horiz ? img[r0 * Qe + k] : img[k * Qe + c0i]; return out; };
    const fwhm = a => { let m = 0, im = 0; a.forEach((v, k) => { if (v > m) { m = v; im = k; } }); const hm = m / 2; let l = im, r = im; while (l > 0 && a[l] > hm) l--; while (r < a.length - 1 && a[r] > hm) r++;
      const lx = l + (hm - a[l]) / ((a[l + 1] - a[l]) || 1), rx = r - (hm - a[r]) / ((a[r - 1] - a[r]) || 1); return (rx - lx) * pq; };
    const px = prof(true), py = prof(false);
    const rad = []; for (let j = 0; j < Qe; j++) for (let i = 0; i < Qe; i++) { const v = img[j * Qe + i]; if (v) rad.push([Math.hypot(i - cxm, j - cym) * pq, v]); }
    rad.sort((a, b) => a[0] - b[0]); let acc = 0, d80 = NaN, d50 = NaN, d95 = NaN;
    for (const [r, v] of rad) { acc += v / tot; if (isNaN(d50) && acc >= 0.5) d50 = 2 * r; if (isNaN(d80) && acc >= 0.8) d80 = 2 * r; if (isNaN(d95) && acc >= 0.95) { d95 = 2 * r; break; } }
    const coupling = coup.reduce((a, c, i) => a + c * W[i], 0) / Wt;
    return { type, Q: Qe, pq, img, src: sImg, tot, peak: pk, dEff: d, cx: (cxm - h) * pq, cy: (cym - h) * pq, px, py, fwhmX: fwhm(px), fwhmY: fwhm(py), d50, d80, d95, coupling, J, inf, NAs, sh };
  }
  /** énergie d'une image (grille Q×Q, pas pq) intégrée sur des pixels de pas p centrés sur (cx, cy) */
  function binImage(img, Q, pq, p, cx, cy, nb = 9, phase = 'centre', ff = 1) {
    const h = Q >> 1, off = phase === 'coin' ? 0 : 0.5, c = nb >> 1, G = new Float64Array(nb * nb), half = Math.sqrt(Math.min(1, Math.max(1e-4, ff))) / 2, hw = Math.min(0.5, pq / p / 2); let tot = 0;
    for (let j = 0; j < Q; j++) for (let i = 0; i < Q; i++) {
      const v = img[j * Q + i]; if (!v) continue; tot += v;
      const ux = ((i - h) * pq - cx) / p + off, uy = ((j - h) * pq - cy) / p + off, fx0 = Math.floor(ux), fy0 = Math.floor(uy), ix = fx0 + c, iy = fy0 + c;
      const wf = half < 0.5 ? ffW(ux - fx0, hw, half) * ffW(uy - fy0, hw, half) : 1; if (!wf) continue;
      if (ix >= 0 && iy >= 0 && ix < nb && iy < nb) G[iy * nb + ix] += v * wf;
    }
    for (let k = 0; k < G.length; k++) G[k] /= tot || 1;
    return { G, nb };
  }

  /* ---------------- Optimisation (moindres carrés amortis) ---------------- */
  /**
   * Opérandes de la fonction de mérite (noms Zemax OpticStudio, équivalents CODE V dans « aka »).
   * kind : contrainte par défaut (eq : =, ge : ≥ cible, le : ≤ cible), modifiable par ligne (op.cmp).
   * cols : colonnes utilisées dans l'éditeur — s1, s2 (surfaces, ou n° de lignes pour les opérations), w (λ : 1…n, 0 = poly/primaire),
   *        hx, hy (champ normalisé), px, py (pupille normalisée), p (paramètre, libellé pl, défaut pdef), fi (n° de champ).
   * list : la contrainte s'applique à chaque élément d'une plage. hide : ancien opérande, masqué du sélecteur (fichiers existants).
   */
  const OPG = [['first', 'Premier ordre'], ['img', 'Qualité d\'image'], ['ray', 'Rayons réels et paraxiaux'], ['aber', 'Aberrations'], ['thk', 'Épaisseurs et dimensions'], ['shape', 'Courbures, coniques, diamètres'], ['glass', 'Verres'], ['math', 'Opérations sur les lignes']];
  const RF = ['w', 'hx', 'hy', 'px', 'py'], FLD = ['w', 'hx', 'hy'], RNG = ['s1', 's2'];
  const OPS = {
    // ---- premier ordre (paraxial) ----
    EFL: { g: 'first', label: 'Focale effective', kind: 'eq', u: 'mm', cols: ['w'], aka: 'Zemax EFFL · CODE V EFL' },
    ISFN: { g: 'first', label: 'F/# image (EFL / EPD)', kind: 'eq', aka: 'Zemax ISFN · CODE V FNO (infini)' },
    WFNO: { g: 'first', label: 'F/# de travail paraxial', kind: 'eq', cols: ['w'], aka: 'Zemax WFNO · CODE V FNO' },
    PMAG: { g: 'first', label: 'Grandissement paraxial', kind: 'eq', cols: ['w'], aka: 'Zemax PMAG · CODE V RED' },
    TTL: { g: 'first', label: 'Longueur totale (1ʳᵉ surface → image)', kind: 'eq', u: 'mm', aka: 'Zemax TOTR · CODE V TOT' },
    OAL: { g: 'first', label: 'Longueur de la 1ʳᵉ à la dernière surface', kind: 'eq', u: 'mm', aka: 'CODE V OAL' },
    BFL: { g: 'first', label: 'Tirage paraxial (dernière surface → foyer)', kind: 'eq', u: 'mm', cols: ['w'], aka: 'CODE V BFL · Zemax PARZ image' },
    IMGH: { g: 'first', label: 'Hauteur image paraxiale (champ max)', kind: 'eq', u: 'mm', aka: 'Zemax PIMH · CODE V HT' },
    ENPP: { g: 'first', label: 'Position pupille d\'entrée (/ 1ʳᵉ surface)', kind: 'eq', u: 'mm', aka: 'Zemax ENPP · CODE V ENP' },
    ENPD: { g: 'first', label: 'Diamètre pupille d\'entrée', kind: 'eq', u: 'mm', aka: 'CODE V EPD' },
    EXPP: { g: 'first', label: 'Position pupille de sortie (/ image)', kind: 'eq', u: 'mm', aka: 'Zemax EXPP · CODE V EXP' },
    EXPD: { g: 'first', label: 'Diamètre pupille de sortie', kind: 'eq', u: 'mm', aka: 'Zemax EXPD' },
    LINV: { g: 'first', label: 'Invariant de Lagrange', kind: 'eq', u: 'mm', aka: 'Zemax LINV · CODE V INV' },
    POWR: { g: 'first', label: 'Puissance de la surface s1', kind: 'eq', u: '1/mm', cols: ['s1', 'w'], aka: 'Zemax POWR' },
    TTHI: { g: 'first', label: 'Somme des épaisseurs s1 … s2', kind: 'eq', u: 'mm', cols: RNG, aka: 'Zemax TTHI · CODE V OAL Si..j' },
    // ---- qualité d'image ----
    RSCE: { g: 'img', label: 'Spot RMS (barycentre) à un champ', kind: 'le', u: 'mm', cols: [...FLD, 'p'], pl: 'anneaux', pdef: 3, aka: 'Zemax RSCE' },
    RSCH: { g: 'img', label: 'Spot RMS (rayon principal) à un champ', kind: 'le', u: 'mm', cols: [...FLD, 'p'], pl: 'anneaux', pdef: 3, aka: 'Zemax RSCH' },
    RWCE: { g: 'img', label: 'Front d\'onde RMS (barycentre : piston + tilt retirés)', kind: 'le', u: 'λ', cols: [...FLD, 'p'], pl: 'anneaux', pdef: 3, aka: 'Zemax RWCE · CODE V WAV' },
    RWCH: { g: 'img', label: 'Front d\'onde RMS (rayon principal : piston retiré)', kind: 'le', u: 'λ', cols: [...FLD, 'p'], pl: 'anneaux', pdef: 3, aka: 'Zemax RWCH' },
    STRH: { g: 'img', label: 'Strehl (Maréchal, depuis le front d\'onde RMS)', kind: 'ge', cols: FLD, aka: 'Zemax STRH' },
    SPOT: { g: 'img', label: 'Spot RMS polychromatique (n° de champ)', kind: 'le', u: 'µm', f: 1, aka: 'CODE V SPOT' },
    WFER: { g: 'img', label: 'Front d\'onde RMS λ primaire (n° de champ)', kind: 'le', u: 'λ', f: 1, aka: 'CODE V WAV' },
    MTFT: { g: 'img', label: 'FTM tangentielle (n° de champ)', kind: 'ge', p: 'cycles/mm', pl: 'cycles/mm', pdef: 30, f: 1, aka: 'Zemax MTFT · CODE V MTF' },
    MTFS: { g: 'img', label: 'FTM sagittale (n° de champ)', kind: 'ge', p: 'cycles/mm', pl: 'cycles/mm', pdef: 30, f: 1, aka: 'Zemax MTFS · CODE V MTF' },
    MTFA: { g: 'img', label: 'FTM moyenne T/S (champs pondérés)', kind: 'ge', p: 'cycles/mm', pl: 'cycles/mm', pdef: 30, aka: 'Zemax MTFA' },
    ZERN: { g: 'img', label: 'Coefficient de Zernike Fringe n° p', kind: 'eq', u: 'λ', cols: [...FLD, 'p'], pl: 'terme', pdef: 9, aka: 'Zemax ZERN · CODE V ZFR' },
    RELI: { g: 'img', label: 'Éclairement relatif au bord du champ', kind: 'ge', aka: 'Zemax RELI' },
    // ---- rayons ----
    REAX: { g: 'ray', label: 'Coordonnée x réelle sur s1 (0 = image)', kind: 'eq', u: 'mm', cols: ['s1', ...RF], aka: 'Zemax REAX · CODE V X' },
    REAY: { g: 'ray', label: 'Coordonnée y réelle sur s1 (0 = image)', kind: 'eq', u: 'mm', cols: ['s1', ...RF], aka: 'Zemax REAY · CODE V Y' },
    REAR: { g: 'ray', label: 'Rayon (distance à l\'axe) réel sur s1', kind: 'eq', u: 'mm', cols: ['s1', ...RF], aka: 'Zemax REAR' },
    REAB: { g: 'ray', label: 'Cosinus directeur y après s1', kind: 'eq', cols: ['s1', ...RF], aka: 'Zemax REAB · CODE V TANY (≈)' },
    RANG: { g: 'ray', label: 'Angle du rayon / axe après s1', kind: 'eq', u: '°', cols: ['s1', ...RF], aka: 'Zemax RANG (en degrés ici)' },
    RAID: { g: 'ray', label: 'Angle d\'incidence sur s1', kind: 'le', u: '°', cols: ['s1', ...RF], aka: 'Zemax RAID · CODE V AOI' },
    RAED: { g: 'ray', label: 'Angle d\'émergence sur s1', kind: 'le', u: '°', cols: ['s1', ...RF], aka: 'Zemax RAED · CODE V AOR' },
    RIMH: { g: 'ray', label: 'Hauteur image réelle (rayon principal, champ max)', kind: 'eq', u: 'mm', aka: 'CODE V RIH' },
    TRAX: { g: 'ray', label: 'Aberration transverse x (/ rayon principal)', kind: 'eq', u: 'mm', cols: RF, aka: 'Zemax TRAX · CODE V DX' },
    TRAY: { g: 'ray', label: 'Aberration transverse y (/ rayon principal)', kind: 'eq', u: 'mm', cols: RF, aka: 'Zemax TRAY · CODE V DY' },
    TRAR: { g: 'ray', label: 'Aberration transverse radiale (/ rayon principal)', kind: 'le', u: 'mm', cols: RF, aka: 'Zemax TRAR' },
    OPDC: { g: 'ray', label: 'Différence de marche (/ rayon principal)', kind: 'eq', u: 'λ', cols: RF, aka: 'Zemax OPDC · CODE V OPD' },
    OPDX: { g: 'ray', label: 'Différence de marche (piston + tilt retirés)', kind: 'eq', u: 'λ', cols: RF, aka: 'Zemax OPDX' },
    LONA: { g: 'ray', label: 'Aberration longitudinale (zone py, / foyer paraxial)', kind: 'eq', u: 'mm', cols: ['w', 'py'], aka: 'Zemax LONA · CODE V LA' },
    PARY: { g: 'ray', label: 'Hauteur d\'un rayon paraxial sur s1 (hy, py)', kind: 'eq', u: 'mm', cols: ['s1', 'w', 'hy', 'py'], aka: 'Zemax PARY · CODE V HMY/HCY' },
    PARB: { g: 'ray', label: 'Angle d\'un rayon paraxial après s1 (u)', kind: 'eq', cols: ['s1', 'w', 'hy', 'py'], aka: 'Zemax PARB · CODE V UMY/UCY' },
    // ---- aberrations ----
    AXCL: { g: 'aber', label: 'Chromatisme axial (foyer λmax − λmin)', kind: 'eq', u: 'mm', aka: 'Zemax AXCL · CODE V CLA' },
    LACL: { g: 'aber', label: 'Chromatisme latéral (λmax − λmin, champ max)', kind: 'eq', u: 'mm', aka: 'Zemax LACL · CODE V CTR' },
    DIST: { g: 'aber', label: 'Distorsion réelle au champ max', kind: 'eq', u: '%', aka: 'CODE V DIS' },
    DISG: { g: 'aber', label: 'Distorsion réelle à un champ (hx, hy)', kind: 'eq', u: '%', cols: FLD, aka: 'Zemax DISG' },
    DISM: { g: 'aber', label: 'Distorsion max |%| sur tout le champ', kind: 'le', u: '%', aka: 'Zemax DIMX' },
    FCGT: { g: 'aber', label: 'Courbure de champ tangentielle à un champ', kind: 'eq', u: 'mm', cols: FLD, aka: 'Zemax FCGT · CODE V FCT' },
    FCGS: { g: 'aber', label: 'Courbure de champ sagittale à un champ', kind: 'eq', u: 'mm', cols: FLD, aka: 'Zemax FCGS · CODE V FCS' },
    SPHA: { g: 'aber', label: 'Sphérique de Seidel W040 (s1 ; 0 = somme)', kind: 'eq', u: 'λ', cols: ['s1'], aka: 'Zemax SPHA · CODE V SA' },
    COMA: { g: 'aber', label: 'Coma de Seidel W131 (s1 ; 0 = somme)', kind: 'eq', u: 'λ', cols: ['s1'], aka: 'Zemax COMA · CODE V TCO' },
    ASTI: { g: 'aber', label: 'Astigmatisme de Seidel W222 (s1 ; 0 = somme)', kind: 'eq', u: 'λ', cols: ['s1'], aka: 'Zemax ASTI · CODE V TAS' },
    FCUR: { g: 'aber', label: 'Courbure de Petzval W220 (s1 ; 0 = somme)', kind: 'eq', u: 'λ', cols: ['s1'], aka: 'Zemax FCUR · CODE V PTZ' },
    // ---- épaisseurs ----
    CTGT: { g: 'thk', label: 'Épaisseur au centre de s1 ≥', kind: 'ge', u: 'mm', cols: ['s1'], aka: 'Zemax CTGT · CODE V MNT' },
    CTLT: { g: 'thk', label: 'Épaisseur au centre de s1 ≤', kind: 'le', u: 'mm', cols: ['s1'], aka: 'Zemax CTLT · CODE V MXT' },
    CTVA: { g: 'thk', label: 'Épaisseur au centre de s1 =', kind: 'eq', u: 'mm', cols: ['s1'], aka: 'Zemax CTVA · CODE V THI' },
    ETGT: { g: 'thk', label: 'Épaisseur au bord de s1 ≥', kind: 'ge', u: 'mm', cols: ['s1'], aka: 'Zemax ETGT · CODE V MNE' },
    ETLT: { g: 'thk', label: 'Épaisseur au bord de s1 ≤', kind: 'le', u: 'mm', cols: ['s1'], aka: 'Zemax ETLT · CODE V MXE' },
    ETVA: { g: 'thk', label: 'Épaisseur au bord de s1 =', kind: 'eq', u: 'mm', cols: ['s1'], aka: 'Zemax ETVA · CODE V ETH' },
    MNCT: { g: 'thk', label: 'Épaisseur centre min (toutes, s1 … s2)', kind: 'ge', u: 'mm', list: 1, cols: RNG, aka: 'Zemax MNCT · CODE V MNT' },
    MXCT: { g: 'thk', label: 'Épaisseur centre max (toutes, s1 … s2)', kind: 'le', u: 'mm', list: 1, cols: RNG, aka: 'Zemax MXCT · CODE V MXT' },
    MNET: { g: 'thk', label: 'Épaisseur bord min (toutes, s1 … s2)', kind: 'ge', u: 'mm', list: 1, cols: RNG, aka: 'Zemax MNET · CODE V MNE' },
    MXET: { g: 'thk', label: 'Épaisseur bord max (toutes, s1 … s2)', kind: 'le', u: 'mm', list: 1, cols: RNG, aka: 'Zemax MXET · CODE V MXE' },
    MNCG: { g: 'thk', label: 'Verre : épaisseur centre min', kind: 'ge', u: 'mm', list: 1, cols: RNG, aka: 'Zemax MNCG · CODE V MNT (verre)' },
    MXCG: { g: 'thk', label: 'Verre : épaisseur centre max', kind: 'le', u: 'mm', list: 1, cols: RNG, aka: 'Zemax MXCG · CODE V MXT (verre)' },
    MNEG: { g: 'thk', label: 'Verre : épaisseur bord min', kind: 'ge', u: 'mm', list: 1, cols: RNG, aka: 'Zemax MNEG · CODE V MNE (verre)' },
    MXEG: { g: 'thk', label: 'Verre : épaisseur bord max', kind: 'le', u: 'mm', list: 1, cols: RNG, aka: 'Zemax MXEG' },
    MNCA: { g: 'thk', label: 'Air : espace centre min', kind: 'ge', u: 'mm', list: 1, cols: RNG, aka: 'Zemax MNCA · CODE V MNA' },
    MXCA: { g: 'thk', label: 'Air : espace centre max', kind: 'le', u: 'mm', list: 1, cols: RNG, aka: 'Zemax MXCA · CODE V MXA' },
    MNEA: { g: 'thk', label: 'Air : espace bord min', kind: 'ge', u: 'mm', list: 1, cols: RNG, aka: 'Zemax MNEA · CODE V MNE (air)' },
    MXEA: { g: 'thk', label: 'Air : espace bord max', kind: 'le', u: 'mm', list: 1, cols: RNG, aka: 'Zemax MXEA' },
    // ---- formes ----
    CVGT: { g: 'shape', label: 'Courbure de s1 ≥', kind: 'ge', u: '1/mm', cols: ['s1'], aka: 'Zemax CVGT' },
    CVLT: { g: 'shape', label: 'Courbure de s1 ≤', kind: 'le', u: '1/mm', cols: ['s1'], aka: 'Zemax CVLT' },
    CVVA: { g: 'shape', label: 'Courbure de s1 =', kind: 'eq', u: '1/mm', cols: ['s1'], aka: 'Zemax CVVA · CODE V CUY' },
    COGT: { g: 'shape', label: 'Conique de s1 ≥', kind: 'ge', cols: ['s1'], aka: 'Zemax COGT' },
    COLT: { g: 'shape', label: 'Conique de s1 ≤', kind: 'le', cols: ['s1'], aka: 'Zemax COLT' },
    COVA: { g: 'shape', label: 'Conique de s1 =', kind: 'eq', cols: ['s1'], aka: 'Zemax COVA · CODE V K' },
    DMGT: { g: 'shape', label: 'Diamètre (2 × demi-diamètre) de s1 ≥', kind: 'ge', u: 'mm', cols: ['s1'], aka: 'Zemax DMGT' },
    DMLT: { g: 'shape', label: 'Diamètre de s1 ≤', kind: 'le', u: 'mm', cols: ['s1'], aka: 'Zemax DMLT · CODE V MXD' },
    DMVA: { g: 'shape', label: 'Diamètre de s1 =', kind: 'eq', u: 'mm', cols: ['s1'], aka: 'Zemax DMVA' },
    MNSD: { g: 'shape', label: 'Demi-diamètre min (s1 … s2)', kind: 'ge', u: 'mm', list: 1, cols: RNG, aka: 'Zemax MNSD' },
    MXSD: { g: 'shape', label: 'Demi-diamètre max (s1 … s2)', kind: 'le', u: 'mm', list: 1, cols: RNG, aka: 'Zemax MXSD · CODE V MXD' },
    // ---- verres ----
    RGLA: { g: 'glass', label: 'Verres modèles près des verres réels', kind: 'le', list: 1, aka: 'Zemax RGLA' },
    MNIN: { g: 'glass', label: 'Verres modèles : nd min (s1 … s2)', kind: 'ge', list: 1, cols: RNG, aka: 'Zemax MNIN' },
    MXIN: { g: 'glass', label: 'Verres modèles : nd max (s1 … s2)', kind: 'le', list: 1, cols: RNG, aka: 'Zemax MXIN' },
    MNAB: { g: 'glass', label: 'Verres modèles : νd min (s1 … s2)', kind: 'ge', list: 1, cols: RNG, aka: 'Zemax MNAB' },
    MXAB: { g: 'glass', label: 'Verres modèles : νd max (s1 … s2)', kind: 'le', list: 1, cols: RNG, aka: 'Zemax MXAB' },
    GLTR: { g: 'glass', label: 'Transmission interne des verres (axe)', kind: 'ge', p: 'λ (µm)', pl: 'λ (µm)', pdef: 0.4, aka: 'Zemax TRAN (≈)' },
    // ---- opérations sur les lignes (s1, s2 = n° de ligne) ----
    BLNK: { g: 'math', label: 'Ligne vide / commentaire', kind: 'eq', aka: 'Zemax BLNK', nores: 1 },
    CONS: { g: 'math', label: 'Constante (valeur = paramètre)', kind: 'eq', cols: ['p'], pl: 'valeur', pdef: 0, aka: 'Zemax CONS' },
    SUMM: { g: 'math', label: 'Somme des lignes s1 + s2', kind: 'eq', cols: RNG, math: 1, aka: 'Zemax SUMM' },
    DIFF: { g: 'math', label: 'Différence des lignes s1 − s2', kind: 'eq', cols: RNG, math: 1, aka: 'Zemax DIFF' },
    PROD: { g: 'math', label: 'Produit des lignes s1 × s2', kind: 'eq', cols: RNG, math: 1, aka: 'Zemax PROD' },
    DIVI: { g: 'math', label: 'Quotient des lignes s1 / s2', kind: 'eq', cols: RNG, math: 1, aka: 'Zemax DIVI' },
    ABSO: { g: 'math', label: 'Valeur absolue de la ligne s1', kind: 'eq', cols: ['s1'], math: 1, aka: 'Zemax ABSO' },
    SQRT: { g: 'math', label: 'Racine carrée de la ligne s1', kind: 'eq', cols: ['s1'], math: 1, aka: 'Zemax SQRT' },
    MINN: { g: 'math', label: 'Minimum des lignes s1 … s2', kind: 'eq', cols: RNG, math: 1, aka: 'Zemax MINN' },
    MAXX: { g: 'math', label: 'Maximum des lignes s1 … s2', kind: 'eq', cols: RNG, math: 1, aka: 'Zemax MAXX' },
    OPGT: { g: 'math', label: 'Ligne s1 ≥ cible', kind: 'ge', cols: ['s1'], math: 1, aka: 'Zemax OPGT' },
    OPLT: { g: 'math', label: 'Ligne s1 ≤ cible', kind: 'le', cols: ['s1'], math: 1, aka: 'Zemax OPLT' },
    OPVA: { g: 'math', label: 'Ligne s1 = cible', kind: 'eq', cols: ['s1'], math: 1, aka: 'Zemax OPVA' },
    // ---- anciens opérandes Focale (fichiers existants) ----
    CTHK: { g: 'thk', label: 'Épaisseur au centre de la surface j', kind: 'ge', u: 'mm', p: 'surface j', pl: 'surface j', pdef: 1, hide: 1 },
    ETHK: { g: 'thk', label: 'Épaisseur au bord entre j et j+1', kind: 'ge', u: 'mm', p: 'surface j', pl: 'surface j', pdef: 1, hide: 1 },
  };
  for (const d of Object.values(OPS)) { d.cols = d.cols || [...(d.p ? ['p'] : []), ...(d.f ? ['fi'] : [])]; if (d.p && !d.cols.includes('p')) d.cols.push('p'); }
  /** fonction de mérite d'avant la version 2 : MNCT/MXCT/MNET/MXET visaient le verre seul, CTHK/ETHK la surface « p », poids linéaires */
  function meritUpgrade(sys) {
    const mf = sys && sys.merit; if (!mf || mf.v >= 2) return sys;
    const ren = { MNCT: 'MNCG', MXCT: 'MXCG', MNET: 'MNEG', MXET: 'MXEG', CTHK: 'CTGT', ETHK: 'ETGT' };
    for (const o of mf.ops || []) {
      if (ren[o.type]) { if (o.type === 'CTHK' || o.type === 'ETHK') { o.s1 = Math.round(+o.p || 1); delete o.p; if (o.cmp === 'ge') delete o.cmp; } o.type = ren[o.type]; }
      if (+o.weight) o.weight = Math.pow(+o.weight, 2); // résidu w·r (ancien) → poids W·r² (Zemax)
    }
    mf.v = 2; return sys;
  }
  /* ---------------- Verres variables (verre modèle nd/νd) ---------------- */
  const MODEL_RE = /^\s*([0-9.]+)\s*[,\/;:]\s*([0-9.]+)\s*$/;
  /** verre modèle « nd/νd » → { nd, vd } (null pour un verre de catalogue) */
  function parseModel(name) { const m = String(name || '').match(MODEL_RE); return m ? { nd: +m[1], vd: +m[2] } : null; }
  const fmtModel = (nd, vd) => `${(+nd).toFixed(6)}/${(+vd).toFixed(4)}`;
  /** écart normalisé dans le diagramme nd/νd : 0,01 sur nd ≈ 1,5 sur νd */
  const gdist = (a, b) => Math.hypot((a.nd - b.nd) / 0.01, (a.vd - b.vd) / 1.5);
  let GCACHE = null;
  /** verres réels candidats (catalogues autorisés, préférentiels seulement, sans obsolètes) */
  function glassPool(o = {}) {
    if (!GCACHE || GCACHE.n !== catalog().length) GCACHE = { n: catalog().length, all: catalog().filter(g => isFinite(g.nd) && isFinite(g.vd) && g.vd > 0) };
    const cats = o.cats && o.cats.length ? new Set(o.cats) : null;
    return GCACHE.all.filter(g => g.st !== 'o' && (!cats || cats.has(g.cat)) && (!o.pref || g.st === 'p'));
  }
  /** les k verres réels les plus proches d'un point (nd, νd) */
  function glassNearest(nd, vd, o = {}) { return glassPool(o).map(g => ({ name: g.name, cat: g.cat, nd: g.nd, vd: g.vd, d: gdist(g, { nd, vd }) })).sort((a, b) => a.d - b.d).slice(0, o.k || 8); }
  /** verre de départ d'une surface rendue variable : son nd/νd */
  function toModel(name) { const g = glassInfo(name); return isFinite(g.nd) && isFinite(g.vd) ? fmtModel(g.nd, g.vd) : null; }
  /** essai de substitution : verre réel sur la surface j, puis quelques itérations de moindres carrés sur les autres variables */
  function subTry(sys, j, name, it = 12) {
    const s = structuredClone(sys); s.surfaces[j].glass = name;
    const st = { sys: s, mu: 1e-3 }; for (let i = 0; i < it; i++) { const r = optStep(st); if (r.done) break; }
    const r = residuals(st.sys); return { sys: st.sys, m: r ? meritR(r) * (1 + 1e6 * consViol(r.cons)) : Infinity };
  }
  const ASPH = ASPK;
  function getVars(sys) {
    const v = [], ctl = (k, i) => mcCtl(sys, k, i);
    sys.surfaces.forEach((s, i) => {
      if (s.vr && !s.rsolve && !ctl('c', i)) v.push({ si: i, kind: 'c' });
      if (s.vt && !s.tsolve && !ctl('t', i)) v.push({ si: i, kind: 't' });
      if (s.vk && !ctl('k', i)) v.push({ si: i, kind: 'k' });
      for (const a of ASPH) if (s['v' + a]) v.push({ si: i, kind: a });
      if (s.vg && !isMirror(s) && parseModel(s.glass)) { v.push({ si: i, kind: 'nd' }); v.push({ si: i, kind: 'vd' }); }
      if (s.type === 'TOR' && s.vrx) v.push({ si: i, kind: 'cx' });
      if (s.elem === 'doe' && s.vdoe) { const n = Math.max(1, Math.min(6, +s.vdoe || 2)); for (let k = 0; k < n; k++) v.push({ si: i, kind: 'da' + k }); }
    });
    // variables de la multi-configuration : une par configuration cochée
    if (mcOn(sys)) sys.mc.ops.forEach((op, oi) => { const T = MCT[op.type]; if (!T || !T.var || !Array.isArray(op.vv)) return; for (let k = 0; k < sys.mc.n; k++) if (op.vv[k]) v.push({ si: op.i, kind: T.var, mc: oi, cfg: k }); });
    return v;
  }
  function getVal(sys, v) {
    if (v.mc != null && v.cfg !== (sys.mc.cur | 0)) { const x = +sys.mc.ops[v.mc].v[v.cfg]; return v.kind === 'c' ? (Math.abs(x) > 1e12 || !isFinite(x) ? 0 : 1 / x) : x; }
    const s = sys.surfaces[v.si]; if (v.kind === 'nd' || v.kind === 'vd') return (parseModel(s.glass) || {})[v.kind];
    if (v.kind === 'cx') return isFinite(+s.rx) && +s.rx ? 1 / +s.rx : 0;
    if (v.kind.startsWith('da')) return Array.isArray(s.da) ? +s.da[+v.kind.slice(2)] || 0 : 0; return v.kind === 'c' ? curv(s) : v.kind === 't' ? s.t : v.kind === 'k' ? (s.k || 0) : (+s[v.kind] || 0); }
  function setVal(sys, v, x) {
    if (v.mc != null) { const op = sys.mc.ops[v.mc]; op.v[v.cfg] = v.kind === 'c' ? (Math.abs(x) < 1e-12 ? Infinity : 1 / x) : x; if (v.cfg !== (sys.mc.cur | 0)) return; }
    const s = sys.surfaces[v.si];
    if (v.kind === 'nd' || v.kind === 'vd') { const m = parseModel(s.glass) || { nd: 1.5, vd: 60 }; m[v.kind] = v.kind === 'nd' ? Math.min(2.2, Math.max(1.35, x)) : Math.min(100, Math.max(15, x)); s.glass = fmtModel(m.nd, m.vd); return; }
    if (v.kind === 'cx') { s.rx = Math.abs(x) < 1e-12 ? Infinity : 1 / x; return; }
    if (v.kind.startsWith('da')) { s.da = Array.isArray(s.da) ? s.da : []; const k = +v.kind.slice(2); while (s.da.length <= k) s.da.push(0); s.da[k] = x; return; }
    if (v.kind === 'c') s.r = Math.abs(x) < 1e-12 ? Infinity : 1 / x; else if (v.kind === 't') s.t = x; else if (v.kind === 'k') s.k = x; else s[v.kind] = x;
  }
  /** indices des longueurs d'onde retenues : 'all' (toutes pondérées), 'central' (la plus proche du milieu de la bande), 'primary', ou un indice */
  function wlSel(sys, sel) {
    const W = sys.wavelengths, n = W.length;
    if (sel === 'central') { const ls = W.map(w => w.um), mid = (Math.min(...ls) + Math.max(...ls)) / 2; let b = 0; ls.forEach((l, i) => { if (Math.abs(l - mid) < Math.abs(ls[b] - mid) - 1e-12) b = i; }); return [b]; }
    if (sel === 'primary') return [Math.min(Math.max(0, sys.primary | 0), n - 1)];
    if (sel !== '' && sel != null && sel !== 'all' && Number.isInteger(+sel) && +sel >= 0 && +sel < n) return [+sel];
    return W.map((_, i) => i);
  }
  const GQ = [[0.3357107, 5 / 18], [0.7071068, 8 / 18], [0.9419651, 5 / 18]];
  /** nœuds et poids de Gauss-Legendre sur [−1, 1] */
  const GLC = new Map();
  function gaussLegendre(n) {
    if (GLC.has(n)) return GLC.get(n);
    const x = [], w = [];
    for (let i = 1; i <= n; i++) {
      let z = Math.cos(Math.PI * (i - 0.25) / (n + 0.5)), pp = 1;
      for (let it = 0; it < 100; it++) { let p1 = 1, p2 = 0; for (let j = 1; j <= n; j++) { const p3 = p2; p2 = p1; p1 = ((2 * j - 1) * z * p2 - (j - 1) * p3) / j; } pp = n * (z * p1 - p2) / (z * z - 1); const z1 = z; z = z1 - p1 / pp; if (Math.abs(z - z1) < 1e-15) break; }
      x.push(z); w.push(2 / ((1 - z * z) * pp * pp));
    }
    const r = { x, w }; GLC.set(n, r); return r;
  }
  /**
   * échantillonnage de la pupille de la fonction de mérite : quadrature de Gauss (anneaux × bras, Zemax « Gaussian quadrature »)
   * ou grille rectangulaire (Zemax « Rectangular array », CODE V DEL). half : demi-pupille px ≥ 0 (symétrie), poids doublés.
   * Renvoie [[px, py, w]] (Σw = 1).
   */
  function meritPupil(pu, obs = 0, half = false) {
    const out = [];
    if (pu && pu.type === 'RA') {
      const n = Math.max(2, Math.min(40, pu.grid | 0 || 8)); for (const [px, py] of pupilGrid(n, obs)) out.push([px, py, 1]);
    } else {
      const nr = Math.max(1, Math.min(20, (pu && pu.rings) | 0 || 3)), na = Math.max(2, Math.min(36, (pu && pu.arms) | 0 || 8)), g = gaussLegendre(nr), o2 = obs * obs;
      for (let i = 0; i < nr; i++) { const r = Math.sqrt(o2 + (1 - o2) * (g.x[i] + 1) / 2); for (let a = 0; a < na; a++) { const th = 2 * Math.PI * (a + 0.5) / na; out.push([r * Math.cos(th), r * Math.sin(th), g.w[i] / 2 / na]); } }
    }
    let P = out;
    if (half) { P = []; for (const [x, y, w] of out) { if (x < -1e-12) continue; P.push([x, y, x > 1e-12 ? 2 * w : w]); } }
    const s = P.reduce((a, q) => a + q[2], 0) || 1; return P.map(([x, y, w]) => [x, y, w / s]);
  }
  /** système de révolution et champs dans le plan méridien : la demi-pupille suffit */
  function axisSym(M) {
    for (let j = 1; j <= M.N; j++) { const F = M.fr[j], s = M.S[j]; if (!F.id || Math.abs(F.o[0]) > 1e-12 || Math.abs(F.o[1]) > 1e-12) return false; if (s.type && s.type !== 'STD') return false; if (s.elem === 'grating') return false; }
    return M.sys.fields.every(f => Math.abs(+f.x || 0) < 1e-12 && (+f.vux || 0) === (+f.vlx || 0));
  }
  /** champ normalisé (hx, hy) → champ interne ; normalisation par le champ radial max (Zemax) */
  const fieldAt = (M, hx, hy) => { const R = Math.max(0, ...M.sys.fields.map(f => Math.hypot(+f.x || 0, +f.y || 0))); return { x: (+hx || 0) * R, y: (+hy || 0) * R }; };
  /** n° de longueur d'onde de l'opérande (1…n ; 0 ou vide → primaire) */
  const wOf = (M, w) => { const k = Math.round(+w || 0); return k >= 1 && k <= M.wls.length ? k - 1 : M.pw; };
  /** rayon avec relevé surface par surface : rec[j−1] = [x, y, z (locaux), L, M, N (après la surface, locaux), cos i, cos i′] */
  function rayRec(M, wi, f, px, py) { const rec = []; const r = ray(M, wi, f, px, py, { rec }); return { r, rec }; }
  /** RMS du spot à un champ (référence barycentre ou rayon principal), λ wi ou polychromatique (wi < 0) */
  function spotRms(M, f, wi, rings, ref, pu) {
    const P = meritPupil(pu || { rings, arms: Math.max(6, 2 * rings) }, M.obs), W = M.sys.wavelengths, wl = wi >= 0 ? [wi] : W.map((_, i) => i);
    const pts = []; let sx = 0, sy = 0, sw = 0;
    for (const k of wl) { const ww = wi >= 0 ? 1 : (W[k].w ?? 1); for (const [px, py, w] of P) { const r = ray(M, k, f, px, py); if (r.vig) continue; pts.push([r.x, r.y, w * ww]); sx += w * ww * r.x; sy += w * ww * r.y; sw += w * ww; } }
    if (!sw) return NaN;
    let cx = sx / sw, cy = sy / sw; if (ref === 'chief') { const c = ray(M, M.pw, f, 0, 0); if (c.vig) return NaN; cx = c.x; cy = c.y; }
    let s2 = 0; for (const [x, y, w] of pts) s2 += w * ((x - cx) ** 2 + (y - cy) ** 2); return Math.sqrt(s2 / sw);
  }
  /** front d'onde échantillonné (λ) sur P, ajusté en piston (tilt : false), piston + tilt X/Y ('xy') ou piston + tilt Y ('y', demi-pupille) ;
      S[k] = [px, py, w, W] dans l'ordre de P (W = NaN si le rayon est vignetté) */
  function wfSample(M, f, wi, P, tilt) {
    const ref = opdRef(M, wi, f); if (!ref) return null; const S = []; // opdRef.W : en ondes
    for (const [px, py, w] of P) { const v = ref.W(ray(M, wi, f, px, py)); S.push([px, py, w, isFinite(v) ? v : NaN]); }
    const G = S.filter(q => isFinite(q[3])); if (!G.length) return null;
    let a = 0, b = 0, c = 0;
    if (tilt) { const nb = tilt === 'y' ? 2 : 3, A = Array.from({ length: nb }, () => new Array(nb).fill(0)), B = new Array(nb).fill(0);
      for (const [x, y, w, v] of G) { const z = tilt === 'y' ? [1, y] : [1, x, y]; for (let i = 0; i < nb; i++) { B[i] += w * z[i] * v; for (let j = 0; j < nb; j++) A[i][j] += w * z[i] * z[j]; } }
      for (let i = 0; i < nb; i++) A[i][i] += 1e-14; const q = solveLin(A, B) || new Array(nb).fill(0); if (tilt === 'y') [a, c] = q; else [a, b, c] = q; }
    else { let sw = 0; for (const [, , w, v] of G) { a += w * v; sw += w; } a /= sw || 1; }
    return { S, n: G.length, a, b, c, fit: (x, y) => a + b * x + c * y };
  }
  function wfRms(M, f, wi, rings, tilt) {
    const P = meritPupil({ rings, arms: Math.max(6, 2 * rings) }, M.obs), wl = wi >= 0 ? [wi] : M.wls.map((_, i) => i), W = M.sys.wavelengths;
    let acc = 0, ws = 0;
    for (const k of wl) { const q = wfSample(M, f, k, P, tilt ? 'xy' : false); if (!q) return NaN; let s2 = 0, sw = 0; for (const [x, y, w, v] of q.S) { if (!isFinite(v)) continue; s2 += w * (v - q.fit(x, y)) ** 2; sw += w; } const ww = wi >= 0 ? 1 : (W[k].w ?? 1); acc += ww * s2 / (sw || 1); ws += ww; }
    return Math.sqrt(acc / (ws || 1));
  }
  /** foyers tangentiel / sagittal (mm, / surface image) pour un champ et une λ */
  function fcAt(M, wi, f, tang) {
    const c = ray(M, wi, f, 0, 0), e = 0.02, a = tang ? 0 : e, b = tang ? e : 0, r1 = ray(M, wi, f, a, b), r2 = ray(M, wi, f, -a, -b);
    if (c.vig || r1.vig || r2.vig) return NaN;
    const z = r => b ? -(r.y - c.y) / (r.M / r.N - c.M / c.N) : -(r.x - c.x) / (r.L / r.N - c.L / c.N); return (z(r1) + z(r2)) / 2;
  }
  /** valeur d'un opérande : { val } ou { list } ; rows : valeurs des lignes précédentes (opérations) */
  function opValue(M, op, rows = []) {
    const S = M.S, N = M.N, sys = M.sys, wl = M.wls;
    const sagAt = (j, r) => { const s = M.ctxs[M.pw].s[j]; const v = sag(s, 0, r); return isFinite(v) ? v : 0; };
    const chief = wi => { const fy = M.par.fmax; const c = ray(M, wi, { x: 0, y: fy }, 0, 0); return c.vig ? NaN : c.y; };
    const lmin = wl.indexOf(Math.min(...wl)), lmax = wl.indexOf(Math.max(...wl));
    const edge = (j, k) => { const r = Math.max(S[j].sd, S[k].sd); return S[j].t + sagAt(k, r) - sagAt(j, r); };
    const sj = (v, d = 1) => { const k = Math.round(+v); return k >= 0 && k <= N ? k : d; }, s1 = sj(op.s1, 1), surfN = k => (k === 0 ? N : k);
    const range = (a0 = 1, b0 = N - 2) => { let a = Math.round(+op.s1 || 0), b = Math.round(+op.s2 || 0); if (!a && !b) { a = a0; b = b0; } else if (!b) b = a; if (a > b) [a, b] = [b, a]; return [Math.max(1, a), Math.min(N - 1, b)]; };
    const wi = wOf(M, op.w), f = fieldAt(M, op.hx, op.hy), px = +op.px || 0, py = +op.py || 0;
    const parW = () => wi === M.pw ? M.par : paraxial(sys, M.nW[wi], M.stopIdx, M.objInf);
    const glass = j => !isAir(S[j].glass) && !isMirror(S[j]), air = j => isAir(S[j].glass) && !isMirror(S[j]) && S[j].tsolve !== 'M';
    const row = k => { const v = rows[Math.round(+k) - 1]; return v == null ? NaN : v; };
    const list = [];
    switch (op.type) {
      case 'EFL': return { val: parW().efl };
      case 'ISFN': return { val: M.par.fno };
      case 'WFNO': return { val: parW().wfno };
      case 'TTL': return { val: M.par.ttl };
      case 'OAL': return { val: M.par.ttl - S[N - 1].t };
      case 'BFL': return { val: parW().imgDist };
      case 'PMAG': return { val: parW().mag };
      case 'IMGH': return { val: M.par.imgH };
      case 'ENPP': return { val: M.par.zE };
      case 'ENPD': return { val: M.par.epd };
      case 'EXPP': return { val: M.par.xpZ };
      case 'EXPD': return { val: M.par.xpD };
      case 'LINV': return { val: M.par.H };
      case 'POWR': { const j = Math.max(1, Math.min(N - 1, s1)), n = M.ctxs[wi].nAbs, c = curv(S[j]); return { val: isMirror(S[j]) ? -2 * n[j - 1] * c : (n[j] - n[j - 1]) * c }; }
      case 'TTHI': { const [a, b] = range(1, N - 1); let t = 0; for (let j = a; j <= b; j++) t += S[j].t; return { val: t }; }
      case 'RIMH': return { val: chief(M.pw) };
      case 'DIST': { const fy = M.par.fmax, c = ray(M, M.pw, { x: 0, y: fy }, 0, 0); const yp = M.objInf ? M.par.unitImgH * Math.tan(fy * DEG) : M.par.unitImgH * fy; return { val: c.vig ? 0 : 100 * (c.y - yp) / yp }; }
      case 'DISG': { const R = Math.hypot(f.x, f.y); if (!R) return { val: 0 }; const c = ray(M, wi, f, 0, 0); if (c.vig) return { val: NaN }; const k = M.objInf ? M.par.unitImgH * Math.tan(R * DEG) / R : M.par.unitImgH; const rp = Math.hypot(k * f.x, k * f.y); return { val: 100 * (Math.hypot(c.x, c.y) - rp) / rp }; }
      case 'AXCL': { if (lmin === lmax) return { val: 0 }; const d = l => paraxial(sys, indices(S, l, M.env), M.stopIdx, M.objInf).imgDist; return { val: d(wl[lmax]) - d(wl[lmin]) }; }
      case 'LACL': return { val: lmin === lmax ? 0 : chief(lmax) - chief(lmin) };
      case 'FCGT': case 'FCGS': return { val: fcAt(M, wi, f, op.type === 'FCGT') };
      case 'SPHA': case 'COMA': case 'ASTI': case 'FCUR': { const sd = seidel(M), lm = M.ctxs[M.pw].lmm, k = Math.round(+op.s1 || 0), q = k > 0 ? (sd.rows.find(r => r.j === k) || {}) : sd.sum;
        const v = op.type === 'SPHA' ? (q.SI || 0) / 8 : op.type === 'COMA' ? (q.SII || 0) / 2 : op.type === 'ASTI' ? (q.SIII || 0) / 2 : (q.SIV || 0) / 4; return { val: v / lm }; }
      case 'MTFA': return { val: criterion(M, 'MTF', { mtfF: +op.p > 0 ? +op.p : 30 }) };
      case 'MTFT': case 'MTFS': case 'SPOT': case 'WFER': {
        const fis = +op.fi > 0 ? [Math.min(+op.fi, sys.fields.length) - 1] : sys.fields.map((_, i) => i), fr = +op.p > 0 ? +op.p : 30;
        const v = fis.map(fi => op.type === 'SPOT' ? spot(M, fi, 13).rms * 1e3 : op.type === 'WFER' ? (w => w.ok ? w.rms : 10)(wavefront(M, fi, M.pw, 24)) : (r => op.type === 'MTFT' ? r.T[0] : r.S[0])(mtf(M, fi, { freqs: [fr], N: 24 })));
        return fis.length === 1 ? { val: v[0] } : { list: v }; }
      case 'RSCE': case 'RSCH': return { val: spotRms(M, f, Math.round(+op.w || 0) > 0 ? wi : -1, Math.max(1, Math.min(20, Math.round(+op.p || 3))), op.type === 'RSCH' ? 'chief' : 'centroid') };
      case 'RWCE': case 'RWCH': return { val: wfRms(M, f, Math.round(+op.w || 0) > 0 ? wi : -1, Math.max(1, Math.min(20, Math.round(+op.p || 3))), op.type === 'RWCE') };
      case 'STRH': { const s = wfRms(M, f, wi, 4, true); return { val: isFinite(s) ? Math.exp(-((2 * Math.PI * s) ** 2)) : 0 }; }
      case 'ZERN': { const n = Math.max(1, Math.min(37, Math.round(+op.p || 9))), wf = wavefront(M, f, wi, 32, false); if (!wf.ok) return { val: NaN }; return { val: zernFit(wf, Math.max(n, 16)).c[n - 1] }; }
      case 'DISM': { const d = fieldCurves(M, 10).dist.filter(isFinite).map(Math.abs); return { val: d.length ? Math.max(...d) : 0 }; }
      case 'RELI': { const F = sys.fields, k = F.reduce((b, q, i) => Math.hypot(q.x || 0, q.y || 0) > Math.hypot(F[b].x || 0, F[b].y || 0) ? i : b, 0), a0 = beamArea(M, { x: 0, y: 0 }, M.pw, 14).A; return { val: a0 > 0 ? beamArea(M, F[k], M.pw, 14).A / a0 : 0 }; }
      case 'REAX': case 'REAY': case 'REAR': case 'REAB': case 'RANG': case 'RAID': case 'RAED': {
        const j = surfN(sj(op.s1, 0)), q = rayRec(M, wi, f, px, py); if (q.r.vig || !q.rec[j - 1]) return { val: NaN }; const e = q.rec[j - 1];
        const v = op.type === 'REAX' ? e[0] : op.type === 'REAY' ? e[1] : op.type === 'REAR' ? Math.hypot(e[0], e[1]) : op.type === 'REAB' ? e[4] : op.type === 'RANG' ? Math.acos(Math.min(1, Math.abs(e[5]))) / DEG : op.type === 'RAID' ? Math.acos(Math.min(1, Math.abs(e[6]))) / DEG : Math.acos(Math.min(1, Math.abs(e[7]))) / DEG;
        return { val: v }; }
      case 'TRAX': case 'TRAY': case 'TRAR': { const r = ray(M, wi, f, px, py), c = ray(M, M.pw, f, 0, 0); if (r.vig || c.vig) return { val: NaN }; const dx = r.x - c.x, dy = r.y - c.y; return { val: op.type === 'TRAX' ? dx : op.type === 'TRAY' ? dy : Math.hypot(dx, dy) }; }
      case 'OPDC': { const ref = opdRef(M, wi, f); if (!ref) return { val: NaN }; return { val: ref.W(ray(M, wi, f, px, py)) }; }
      case 'OPDX': { const q = wfSample(M, f, wi, meritPupil({ rings: 4, arms: 8 }, M.obs), 'xy'), ref = opdRef(M, wi, f); if (!q || !ref) return { val: NaN }; return { val: ref.W(ray(M, wi, f, px, py)) - q.fit(px, py) }; }
      case 'LONA': { const pz = py || 1, r = ray(M, wi, { x: 0, y: 0 }, 0, pz); if (r.vig || Math.abs(r.M) < 1e-15) return { val: NaN }; const zc = r.z - r.y * r.N / r.M, p = parW(); return { val: zc - (p.imgDist - S[N - 1].t) }; }
      case 'PARY': case 'PARB': { const p = parW(), j = Math.max(1, Math.min(N, sj(op.s1, 1))), hy = +op.hy || 0, n = M.nW[wi];
        return { val: op.type === 'PARY' ? py * p.mar.y[j] + hy * p.chf.y[j] : (py * p.mar.nu[Math.min(j, N - 1)] + hy * p.chf.nu[Math.min(j, N - 1)]) / n[Math.min(j, N - 1)] }; }
      case 'GLTR': { const v = sysTau(sys, +op.p > 0 ? +op.p : 0.4); return { val: isFinite(v) ? v : 1 }; }
      case 'CTGT': case 'CTLT': case 'CTVA': { const j = Math.max(1, Math.min(N - 1, s1)); return { val: Math.abs(S[j].t) }; }
      case 'ETGT': case 'ETLT': case 'ETVA': { const j = Math.max(1, Math.min(N - 1, s1)); return { val: edge(j, j + 1) }; }
      case 'CTHK': { const j = Math.max(1, Math.min(N - 1, Math.round(+op.p || 1))); return { val: Math.abs(S[j].t) }; }
      case 'ETHK': { const j = Math.max(1, Math.min(N - 2, Math.round(+op.p || 1))); return { val: edge(j, j + 1) }; }
      case 'CVGT': case 'CVLT': case 'CVVA': return { val: curv(S[Math.max(1, Math.min(N, s1))]) };
      case 'COGT': case 'COLT': case 'COVA': return { val: +S[Math.max(1, Math.min(N, s1))].k || 0 };
      case 'DMGT': case 'DMLT': case 'DMVA': return { val: 2 * (S[Math.max(1, Math.min(N, s1))].sd || 0) };
      case 'MNSD': case 'MXSD': { const [a, b] = range(1, N - 1); for (let j = a; j <= b; j++) list.push(S[j].sd || 0); break; }
      case 'MNCT': case 'MXCT': { const [a, b] = range(); for (let j = a; j <= b; j++) if (!isMirror(S[j]) && S[j].tsolve !== 'M') list.push(Math.abs(S[j].t)); break; }
      case 'MNET': case 'MXET': { const [a, b] = range(); for (let j = a; j <= b; j++) if (!isMirror(S[j]) && j + 1 < N + 1 && S[j].tsolve !== 'M') list.push(edge(j, j + 1)); break; }
      case 'MNCG': case 'MXCG': { const [a, b] = range(); for (let j = a; j <= b; j++) if (glass(j)) list.push(Math.abs(S[j].t)); break; }
      case 'MNEG': case 'MXEG': { const [a, b] = range(); for (let j = a; j <= b; j++) if (glass(j)) list.push(edge(j, j + 1)); break; }
      case 'MNCA': case 'MXCA': { const [a, b] = range(); for (let j = a; j <= b; j++) if (air(j)) list.push(Math.abs(S[j].t)); break; }
      case 'MNEA': case 'MXEA': { const [a, b] = range(); for (let j = a; j <= b; j++) if (air(j) && j + 1 <= N) list.push(edge(j, j + 1)); break; }
      case 'RGLA': { const o = (sys.merit && sys.merit.gsub) || {}; for (let j = 1; j < N; j++) if (S[j].vg) { const m = parseModel(S[j].glass); if (m) list.push(glassNearest(m.nd, m.vd, { ...o, k: 1 })[0]?.d ?? 0); } break; }
      case 'MNIN': case 'MXIN': case 'MNAB': case 'MXAB': { const [a, b] = range(1, N - 1); for (let j = a; j <= b; j++) { const m = parseModel(S[j].glass); if (m && !isMirror(S[j])) list.push(op.type.endsWith('IN') ? m.nd : m.vd); } break; }
      case 'BLNK': return { val: null };
      case 'CONS': return { val: +op.p || 0 };
      case 'SUMM': return { val: row(op.s1) + row(op.s2) };
      case 'DIFF': return { val: row(op.s1) - row(op.s2) };
      case 'PROD': return { val: row(op.s1) * row(op.s2) };
      case 'DIVI': { const d = row(op.s2); return { val: d ? row(op.s1) / d : NaN }; }
      case 'ABSO': return { val: Math.abs(row(op.s1)) };
      case 'SQRT': return { val: Math.sqrt(Math.abs(row(op.s1))) };
      case 'MINN': case 'MAXX': { let a = Math.round(+op.s1 || 1), b = Math.round(+op.s2 || a); if (a > b) [a, b] = [b, a]; const v = []; for (let k = a; k <= b; k++) { const x = row(k); if (isFinite(x)) v.push(x); } return { val: v.length ? (op.type === 'MINN' ? Math.min(...v) : Math.max(...v)) : NaN }; }
      case 'OPGT': case 'OPLT': case 'OPVA': return { val: row(op.s1) };
    }
    return { list };
  }
  /** résidus de la fonction de mérite ; en multi-configuration (mc.opt ≠ 'cur') : somme sur toutes les configurations.
      f : résidus pondérés (Σ f² = Σ W·r²), wt : somme des poids (fonction de mérite = √(Σ f² / wt), convention Zemax),
      cons : contraintes exactes (multiplicateurs de Lagrange, CODE V), parts : valeur et part de chaque ligne */
  function residuals(sys) {
    meritUpgrade(sys);
    if (!mcOn(sys) || sys.mc.opt === 'cur') return residuals1(sys, null);
    const f = [], byOp = new Map(), cons = []; let img2 = 0, M = null, wt = 0, imgW = 0;
    for (let k = 0; k < sys.mc.n; k++) {
      const r = residuals1(k === (sys.mc.cur | 0) ? sys : mcApply(sys, k), k); if (!r) return null;
      for (const v of r.f) f.push(v); img2 += r.img2; wt += r.wt; imgW += r.imgW;
      for (const c of r.cons) cons.push({ ...c, key: c.key + '@' + k });
      if (k === (sys.mc.cur | 0)) M = r.M;
      for (const p of r.parts) { const op = (sys.merit.ops || [])[p.i], own = op && +op.cfg ? +op.cfg - 1 === k : k === (sys.mc.cur | 0); if (own) byOp.set(p.i, { ...p, r2: (byOp.get(p.i)?.r2 || 0) + p.r2 }); else if (byOp.has(p.i)) byOp.get(p.i).r2 += p.r2; else byOp.set(p.i, { ...p, val: null, ok: null }); }
    }
    return { f, M, img2, wt, imgW, cons, parts: [...byOp.values()].sort((a, b) => a.i - b.i) };
  }
  function residuals1(sys, cfg) {
    const M = prepare(sys);
    if (!M.ok) return null;
    const f = [], cons = [];
    const mf = sys.merit || { image: 'SPOT', ops: [] };
    const F = sys.fields, Wl = sys.wavelengths, sel = wlSel(sys, mf.wl);
    // poids du critère : ceux de la fonction de mérite (mf.fw, mf.ww) s'ils sont définis, sinon ceux des champs et longueurs d'onde
    const fw = F.map((x, i) => Array.isArray(mf.fw) && mf.fw[i] != null && mf.fw[i] !== '' ? +mf.fw[i] : (x.w ?? 1)); let ww = Wl.map((x, i) => sel.includes(i) ? (Array.isArray(mf.ww) && mf.ww[i] != null && mf.ww[i] !== '' ? +mf.ww[i] : (x.w ?? 1)) : 0);
    if (!ww.some(v => v > 0)) ww = Wl.map((_, i) => sel.includes(i) ? 1 : 0);
    const half = mf.sym !== false && axisSym(M), P = meritPupil(mf.pupil || { type: 'GQ', rings: 3, arms: 8 }, M.obs, half), chiefRef = mf.ref === 'chief';
    const IW = mf.image === 'NONE' ? 0 : Math.max(0, mf.iw == null || mf.iw === '' ? 1 : +mf.iw || 0), sq = Math.sqrt(IW);
    if (IW && (mf.image === 'SPOT' || mf.image === 'WFE')) {
      const Wsum = fw.reduce((a, b) => a + b, 0) * ww.reduce((a, b) => a + b, 0) || 1;
      F.forEach((fd, fi) => {
        if (!fw[fi]) return;
        if (mf.image === 'SPOT') {
          const rs = []; let sx = 0, sy = 0, sw = 0;
          sel.forEach(wi => { if (!ww[wi]) return; P.forEach(([px, py, w]) => { const r = ray(M, wi, fd, px, py); rs.push([r, wi, w]); if (!r.vig) { sx += ww[wi] * w * r.x; sy += ww[wi] * w * r.y; sw += ww[wi] * w; } }); });
          let cx = sw ? sx / sw : 0, cy = sw ? sy / sw : 0;
          if (chiefRef) { const c = ray(M, M.pw, fd, 0, 0); if (!c.vig) { cx = c.x; cy = c.y; } } else if (half) cx = 0;
          for (const [r, wi, w] of rs) { const k = sq * Math.sqrt(fw[fi] * ww[wi] * w / Wsum); if (r.vig) f.push(k, k); else f.push(k * (r.x - cx), k * (r.y - cy)); }
        } else {
          sel.forEach(wi => {
            if (!ww[wi]) return; const q = wfSample(M, fd, wi, P, chiefRef ? false : half ? 'y' : 'xy');
            P.forEach(([px, py, w], k) => { const c = sq * Math.sqrt(fw[fi] * ww[wi] * w / Wsum), e = q && q.S[k]; f.push(e && isFinite(e[3]) ? c * (e[3] - q.fit(px, py)) : c * 3); });
          });
        }
      });
    } else if (IW && mf.image === 'MTF') {
      const fr = +mf.mtfF > 0 ? +mf.mtfF : 30, Ws = fw.reduce((a, b) => a + b, 0) || 1;
      F.forEach((fd, fi) => { if (!fw[fi]) return; const r = mtf(M, fi, { freqs: [fr], N: 32 }), k = sq * Math.sqrt(fw[fi] / Ws / 2); f.push(k * (1 - (isFinite(r.T[0]) ? r.T[0] : 0)), k * (1 - (isFinite(r.S[0]) ? r.S[0] : 0))); });
    }
    let img2 = 0; for (const v of f) img2 += v * v;
    let wt = IW && mf.image !== 'NONE' ? IW : 0; const imgW = wt;
    const parts = [], rows = [];
    (mf.ops || []).forEach((op, oi) => {
      const def = OPS[op.type]; if (!def) { rows.push(NaN); return; }
      const cmp = op.cmp || def.kind, tg = +op.target || 0, W = Math.max(0, +op.weight || 0), n0 = f.length;
      if (cfg != null && +op.cfg && +op.cfg - 1 !== cfg) { rows.push(NaN); return; }
      const o = opValue(M, op, rows);
      const res = v => !isFinite(v) ? 1e3 : cmp === 'ge' ? Math.max(0, tg - v) : cmp === 'le' ? Math.max(0, v - tg) : v - tg;
      let shown = o.val; const vals = o.val != null ? [o.val] : (o.list || []);
      if (o.val == null && o.list && o.list.length) shown = cmp === 'le' ? Math.max(...o.list) : cmp === 'ge' ? Math.min(...o.list) : o.list.reduce((a, b) => Math.abs(b - tg) > Math.abs(a - tg) ? b : a, o.list[0]);
      rows.push(shown == null ? NaN : shown);
      if (def.nores || shown == null) { parts.push({ i: oi, val: null, r2: 0, ok: null }); return; }
      if (op.lag) vals.forEach((v, e) => cons.push({ i: oi, key: oi + ':' + e, v, t: tg, cmp }));
      else if (W) { wt += W; const k = Math.sqrt(W); for (const v of vals) f.push(k * res(v)); }
      let r2 = 0; for (let k = n0; k < f.length; k++) r2 += f[k] * f[k];
      parts.push({ i: oi, val: shown, r2, lag: !!op.lag, ok: (cmp === 'eq' && !op.lag) || shown == null || !isFinite(shown) ? null : Math.abs(res(shown)) <= 1e-9 + 1e-6 * Math.abs(tg) + (op.lag && cmp === 'eq' ? 1e-6 * Math.max(1, Math.abs(tg)) : 0) });
    });
    return { f, M, img2, wt, imgW, cons, parts };
  }
  /** fonction de mérite (Zemax) : √(Σ W·r² / Σ W) ; f déjà pondérés */
  const meritOf = (f, wt = 1) => Math.sqrt(f.reduce((a, b) => a + b * b, 0) / (wt > 0 ? wt : 1));
  const meritR = r => r ? meritOf(r.f, r.wt) : NaN;
  /** écart aux contraintes exactes (actives) : Σ (violation / échelle)² */
  const consViol = cons => { let s = 0; for (const c of cons) { const d = c.cmp === 'ge' ? Math.max(0, c.t - c.v) : c.cmp === 'le' ? Math.max(0, c.v - c.t) : c.v - c.t; s += (isFinite(d) ? d : 1e3) ** 2 / Math.max(1, Math.abs(c.t)) ** 2; } return s; };
  /** pas de dérivation numérique d'une variable */
  function varStep(M, v, x) {
    if (v.kind === 'c' || v.kind === 'cx') return Math.max(1e-7, Math.abs(x) * 1e-5);
    if (v.kind === 't' || v.kind === 'k') return 1e-4; if (v.kind === 'nd') return 1e-5; if (v.kind === 'vd') return 1e-3;
    if (v.kind.startsWith('da')) return Math.max(1e-3, Math.abs(x) * 1e-5);
    const sdv = Math.max(1e-3, (M.S[v.si] && M.S[v.si].sd) || 1); return 1e-6 / Math.pow(sdv, +v.kind.slice(1));
  }
  /**
   * Un cycle de moindres carrés amortis (Levenberg-Marquardt, amortissement diagonal de Marquardt).
   * Contraintes exactes (op.lag) : système KKT [JᵀJ + μD, Cᵀ ; C, 0] (multiplicateurs de Lagrange, comme CODE V) ;
   * une contrainte d'inégalité n'est active que si elle est violée. state : { sys, mu, central }.
   */
  function optStep(state) {
    const { sys } = state, vars = getVars(sys);
    if (!vars.length) return { done: true, msg: 'Aucune variable' };
    const r0 = residuals(sys); if (!r0) return { done: true, msg: 'Système invalide' };
    const f0 = r0.f, m0 = meritOf(f0, r0.wt), nv = vars.length, nf = f0.length;
    const act = r0.cons.filter(c => c.cmp === 'eq' || (c.cmp === 'ge' ? c.v < c.t : c.v > c.t) || !isFinite(c.v)), na = act.length, V0 = consViol(r0.cons);
    const x0 = vars.map(v => getVal(sys, v)), J = [], C = [];
    const cmap = r => { const m = new Map(); for (const c of r.cons) m.set(c.key, c.v); return m; };
    for (let k = 0; k < nv; k++) {
      const v = vars[k], h = varStep(r0.M, v, x0[k]);
      const s2 = structuredClone(sys); setVal(s2, v, x0[k] + h); const r = residuals(s2), col = new Float64Array(nf), cc = new Float64Array(na);
      let rm = null; if (state.central) { const s3 = structuredClone(sys); setVal(s3, v, x0[k] - h); rm = residuals(s3); if (rm && rm.f.length !== nf) rm = null; }
      if (r && r.f.length === nf) { for (let i = 0; i < nf; i++) col[i] = rm ? (r.f[i] - rm.f[i]) / (2 * h) : (r.f[i] - f0[i]) / h; const cm = cmap(r), cmm = rm ? cmap(rm) : null; act.forEach((c, i) => { const a = cm.get(c.key); cc[i] = isFinite(a) ? (cmm && isFinite(cmm.get(c.key)) ? (a - cmm.get(c.key)) / (2 * h) : (a - c.v) / h) : 0; }); }
      J.push(col); C.push(cc);
    }
    const JtJ = Array.from({ length: nv }, (_, a) => Array.from({ length: nv }, (_, b) => { let s = 0; for (let i = 0; i < nf; i++) s += J[a][i] * J[b][i]; return s; }));
    const Jtf = Array.from({ length: nv }, (_, a) => { let s = 0; for (let i = 0; i < nf; i++) s += J[a][i] * f0[i]; return s; });
    const cres = act.map(c => c.v - c.t);
    // échelle de l'amortissement : diagonale de JᵀJ (ou des contraintes si une variable ne pèse que sur elles)
    const dg = JtJ.map((row, a) => { let d = row[a]; if (d <= 1e-30) { let s = 0; for (let i = 0; i < na; i++) s += C[a][i] ** 2; d = s || 1e-12; } return d; });
    let mu = state.mu ?? 1e-3, al = 1; // al : fraction de la correction des contraintes demandée à ce pas (réduite si le pas est refusé)
    for (let tr = 0; tr < 14; tr++) {
      const n = nv + na, A = Array.from({ length: n }, () => new Array(n).fill(0)), b = new Array(n).fill(0);
      for (let a = 0; a < nv; a++) { for (let c = 0; c < nv; c++) A[a][c] = JtJ[a][c]; A[a][a] += mu * dg[a] + 1e-18; b[a] = -Jtf[a]; }
      for (let i = 0; i < na; i++) { for (let a = 0; a < nv; a++) { A[nv + i][a] = C[a][i]; A[a][nv + i] = C[a][i]; } b[nv + i] = -al * cres[i]; }
      let dx = solveLin(A, b);
      if (!dx && na) { // contraintes incompatibles ou redondantes : pénalité forte
        const B = JtJ.map((row, a) => row.map((v, c) => { let s = v; for (let i = 0; i < na; i++) s += 1e6 * C[a][i] * C[c][i]; return a === c ? s + mu * dg[a] + 1e-18 : s; }));
        dx = solveLin(B, Jtf.map((v, a) => { let s = -v; for (let i = 0; i < na; i++) s -= 1e6 * C[a][i] * al * cres[i]; return s; }));
      }
      if (dx) {
        const s2 = structuredClone(sys); vars.forEach((v, k) => setVal(s2, v, x0[k] + dx[k]));
        const r = residuals(s2);
        if (r && r.f.length === nf) {
          const m1 = meritOf(r.f, r.wt), V1 = consViol(r.cons), tolV = 1e-14;
          const ok = na || V0 > tolV ? (V1 < V0 * 0.98 && m1 < m0 * 2 + 1e-12) || (V1 <= Math.max(V0, tolV) * 1.0001 && m1 < m0) : m1 < m0;
          if (ok) { state.sys = s2; state.mu = Math.max(1e-9, mu / 4); state.merit = m1; state.viol = V1; return { done: V1 <= 1e-12 && (m0 - m1) / Math.max(m0, 1e-300) < 1e-7, merit: m1, viol: V1 }; }
        }
      }
      mu *= 6; if (na) al *= 0.5;
    }
    state.mu = mu; state.merit = m0; state.viol = V0;
    return { done: true, merit: m0, viol: V0, msg: V0 > 1e-10 ? 'Contraintes exactes non satisfaites (incompatibles ou hors d\'atteinte des variables)' : 'Minimum local atteint' };
  }

  /**
   * Quick focus : meilleure mise au point (épaisseur avant l'image) pour un critère (SPOT : spot RMS au barycentre, WFE : front d'onde RMS)
   * et une sélection de longueurs d'onde (central par défaut). Renvoie la nouvelle épaisseur et le critère avant/après.
   */
  function quickFocus(sys, o = {}) {
    const fz = tolFreeze(sys), N = fz.surfaces.length - 1, sel = wlSel(fz, o.wl ?? 'central'), kind = o.crit === 'WFE' ? 'WFE' : 'SPOT';
    const s = structuredClone(fz); s.wavelengths = sel.map(i => ({ ...fz.wavelengths[i], w: sel.length === 1 ? 1 : (fz.wavelengths[i].w ?? 1) }));
    s.primary = Math.max(0, sel.indexOf(fz.primary | 0));
    const before = criterion(prepare(s), kind), bf = bestFocus(s, kind, focusStep(s));
    return { t: fz.surfaces[N - 1].t + bf.dt, dt: bf.dt, before, after: bf.c, kind, wls: sel.map(i => fz.wavelengths[i].um), j: N - 1 };
  }

  /* ---------------- Tolérancement ---------------- */
  /** λ d'essai des franges (interféromètre He-Ne), mm */
  const LT = 0.6328e-3;
  /** types de tolérances (codes proches de Zemax) ; on = actif par défaut */
  const TOLT = {
    TFRN: { label: 'Puissance', unit: 'fr', def: 3, on: true, desc: 'Écart de rayon exprimé en franges de Newton (λ = 632,8 nm) sur l\'ouverture utile : Δc = F·λ/h²' },
    TRAD: { label: 'Rayon', unit: '%', def: 0.2, on: false, desc: 'Variation relative du rayon de courbure' },
    TIRR: { label: 'Irrégularité', unit: 'fr', def: 1, on: true, desc: 'Défaut de forme en franges (PV = F·λ/2) : moitié sphérique, moitié astigmatisme' },
    TCON: { label: 'Conique', unit: 'Δk', def: 0.01, on: true, desc: 'Constante de conicité (surfaces coniques ou asphériques seulement)' },
    TTHI: { label: 'Épaisseur', unit: 'mm', def: 0.05, on: true, desc: 'Épaisseur ou espace d\'air' },
    TIND: { label: 'Indice', unit: 'Δn', def: 0.0005, on: true, desc: 'Indice de réfraction du verre (décalage à toutes les λ)' },
    TABB: { label: 'Constringence', unit: '%', def: 0.5, on: true, desc: 'Nombre d\'Abbe νd (dispersion autour de nd)' },
    TSDX: { label: 'Décentrement surface X', unit: 'mm', def: 0.02, on: true }, TSDY: { label: 'Décentrement surface Y', unit: 'mm', def: 0.02, on: true },
    TSTX: { label: 'Bascule surface α', unit: '°', def: 0.02, on: true }, TSTY: { label: 'Bascule surface β', unit: '°', def: 0.02, on: true },
    TEDX: { label: 'Décentrement élément X', unit: 'mm', def: 0.02, on: true }, TEDY: { label: 'Décentrement élément Y', unit: 'mm', def: 0.02, on: true },
    TETX: { label: 'Bascule élément α', unit: '°', def: 0.02, on: true }, TETY: { label: 'Bascule élément β', unit: '°', def: 0.02, on: true },
  };
  /** critères : unité et sens (MTF : plus grand = meilleur) */
  const TOLC = { WFE: { label: 'Front d\'onde RMS', unit: 'λ' }, SPOT: { label: 'Spot RMS', unit: 'µm' }, MTF: { label: 'FTM moyenne', unit: '', up: true } };
  const tolDefaults = () => ({ crit: 'WFE', mtfF: 30, comp: true, compVars: false, compIt: 3, trials: 200, dist: 'normal', seed: '', spec: null,
    invMode: 'budget', invVal: null, invRound: true, types: Object.fromEntries(Object.entries(TOLT).map(([k, v]) => [k, { on: v.on !== false, v: v.def }])), list: null });
  /** dégradation (> 0 = pire) */
  const tolWorse = (kind, c, nom) => TOLC[kind] && TOLC[kind].up ? nom - c : c - nom;
  /** fige les solves (épaisseurs calculées) pour que le compensateur soit numérique */
  function tolFreeze(sys) {
    const M = prepare(sys), s = structuredClone(sys); delete s.mc;
    if (M.ok) s.surfaces.forEach((x, j) => { if (x.tsolve) x.t = M.S[j].t; x.tsolve = ''; if (x.rsolve) x.r = M.S[j].r; x.rsolve = ''; }); // épaisseurs saisies conservées (la dilatation thermique est réappliquée par prepare)
    return s;
  }
  /** la tolérance « type » a-t-elle un sens sur la surface j ? */
  function tolApplicable(S, type, j, comp) {
    const N = S.length - 1, s = S[j]; if (!s || j < 1 || j >= N) return false;
    const curved = isFinite(s.r) && s.r !== 0, glass = !isAir(s.glass) && !isMirror(s);
    const optical = curved || isMirror(s) || (s.type && s.type !== 'STD') || glass || (j > 1 && !isAir(S[j - 1].glass) && !isMirror(S[j - 1]));
    switch (type) {
      case 'TRAD': return curved;
      case 'TFRN': case 'TIRR': return optical && s.elem !== 'ideal';
      case 'TCON': return curved && (!!s.k || ASPK.some(a => s[a]));
      case 'TTHI': return j < N - 1 || !comp;
      case 'TIND': case 'TABB': return glass;
      case 'TSDX': case 'TSDY': case 'TSTX': case 'TSTY': return curved || isMirror(s) || (s.type && s.type !== 'STD');
      case 'TEDX': case 'TEDY': case 'TETX': case 'TETY': return glass && j + 1 < N;
    }
    return false;
  }
  const tolLabel = (type, j) => `${TOLT[type] ? TOLT[type].label : type} ${type.startsWith('TE') || type === 'TIND' || type === 'TABB' ? `S${j}-${j + 1}` : `S${j}`}`;
  /** liste générée à partir des valeurs par défaut de chaque type */
  function tolGen(sys, cfg) {
    const S = sys.surfaces, N = S.length - 1, T = cfg.types, out = [];
    for (let j = 1; j < N; j++) for (const type of Object.keys(TOLT)) {
      const t = T[type]; if (!t || !t.on || !(+t.v) || !tolApplicable(S, type, j, cfg.comp)) continue;
      out.push({ type, j, min: -Math.abs(+t.v), max: Math.abs(+t.v), on: true });
    }
    return out;
  }
  /** éléments actifs : liste détaillée de l'utilisateur (si définie) sinon liste générée ; ouverture utile h pour les franges */
  function tolItems(sys, cfg) {
    const S = sys.surfaces, src = Array.isArray(cfg.list) ? cfg.list : tolGen(sys, cfg), M = prepare(sys);
    return src.filter(it => it.on !== false && TOLT[it.type] && tolApplicable(S, it.type, it.j, cfg.comp) && (+it.min || +it.max))
      .map(it => { const mn = Math.min(+it.min || 0, +it.max || 0), mx = Math.max(+it.min || 0, +it.max || 0);
        return { type: it.type, j: it.j, min: mn, max: mx, tol: Math.max(Math.abs(mn), Math.abs(mx)), h: M.ok ? Math.max(1e-6, M.S[it.j].sd) : 1, label: tolLabel(it.type, it.j) }; });
  }
  function addDec(s, k, v) { if (!(s.dx || s.dy || s.dz || s.tx || s.ty || s.tz)) s.dmode = 'DAR'; s[k] = (+s[k] || 0) + v; }
  /** ajoute à la surface un défaut de forme Δz = A·(½ ρ⁴ + ½ ρy²), ρ = r/h (moitié sphérique, moitié astigmatisme) */
  function addIrr(s, A, h) {
    if (s.type === 'ZERN') {
      const zr = +s.zr > 0 ? +s.zr : h, k4 = (zr / h) ** 4, k2 = (zr / h) ** 2; s.zc = Array.from({ length: 16 }, (_, k) => +((s.zc || [])[k]) || 0);
      // ρ⁴ = Z9/6 + Z4/2 + cte ; ρ² sin²θ = (Z4 + 1)/4 − Z5/2
      s.zc[8] += 0.5 * A * k4 / 6; s.zc[3] += 0.5 * A * k4 / 2 + 0.5 * A * k2 / 4; s.zc[4] -= 0.5 * A * k2 / 2; return;
    }
    if (s.type === 'TOR') s.xy = { ...(s.xy || {}) }; // défaut ajouté à la biconique
    else if (s.type !== 'XY') { s.type = 'XY'; s.xy = {}; } else s.xy = { ...(s.xy || {}) };
    const add = (k, v) => { s.xy[k] = (+s.xy[k] || 0) + v; }, h2 = h * h, h4 = h2 * h2;
    add('4,0', 0.5 * A / h4); add('0,4', 0.5 * A / h4); add('2,2', A / h4); add('0,2', 0.5 * A / h2);
  }
  function tolApply(sys, it, v) {
    const S = sys.surfaces, s = S[it.j], n = S[it.j + 1], h = it.h || 1;
    switch (it.type) {
      case 'TRAD': s.r = s.r * (1 + v / 100); break;
      case 'TFRN': { // franges de puissance : écart de flèche exact F·λ/2 au bord de l'ouverture utile (conique comprise)
        const k = +s.k || 0, sg = c => { const a = 1 - (1 + k) * c * c * h * h; return a > 0 ? c * h * h / (1 + Math.sqrt(a)) : NaN; };
        const c0 = curv(s), z = sg(c0) + v * LT / 2; let c = c0 + v * LT / (h * h);
        for (let i = 0; i < 8; i++) { const e = 1e-9 / (h * h), f = sg(c) - z, d = (sg(c + e) - sg(c - e)) / (2 * e); if (!isFinite(f) || !d) break; c -= f / d; if (Math.abs(f) < 1e-13) break; }
        s.r = Math.abs(c) < 1e-15 ? Infinity : 1 / c; break; }
      case 'TIRR': addIrr(s, v * LT / 2, h); break;
      case 'TCON': s.k = (+s.k || 0) + v; break;
      case 'TTHI': s.t += v; break;
      case 'TIND': s.dn = (+s.dn || 0) + v; break;
      case 'TABB': s.dv = (+s.dv || 0) + v; break;
      case 'TSDX': addDec(s, 'dx', v); break; case 'TSDY': addDec(s, 'dy', v); break;
      case 'TSTX': addDec(s, 'tx', v); break; case 'TSTY': addDec(s, 'ty', v); break;
      case 'TEDX': addDec(s, 'dx', v); addDec(n, 'dx', v); break;
      case 'TEDY': addDec(s, 'dy', v); addDec(n, 'dy', v); break;
      case 'TETX': { const a = v * DEG; addDec(s, 'tx', v); addDec(n, 'tx', v); addDec(n, 'dy', -s.t * Math.sin(a)); addDec(n, 'dz', s.t * (Math.cos(a) - 1)); break; }
      case 'TETY': { const b = v * DEG; addDec(s, 'ty', v); addDec(n, 'ty', v); addDec(n, 'dx', s.t * Math.sin(b)); addDec(n, 'dz', s.t * (Math.cos(b) - 1)); break; }
    }
    return sys;
  }
  /** FTM polychromatique (moyenne T/S) à la fréquence nu (cycles/mm) pour un champ */
  function mtfAt(M, f, nu) { const r = mtf(M, f, { N: 32, freqs: [nu] }); return (r.T[0] + r.S[0]) / 2; }
  /** critère : WFE RMS (λ, piston et tilt retirés) ou spot RMS (µm), moyenne quadratique pondérée sur les champs ; MTF : moyenne pondérée */
  function criterion(M, kind, opts = {}) {
    if (!M.ok) return kind === 'MTF' ? 0 : Infinity;
    const F = M.sys.fields, Wl = M.sys.wavelengths, nArm = 8, pts = [];
    if (kind === 'MTF') { let a = 0, ws = 0; F.forEach(f => { const w = f.w ?? 1; a += w * mtfAt(M, f, +opts.mtfF || 30); ws += w; }); return a / (ws || 1); }
    for (const [r, w] of GQ) for (let a = 0; a < nArm; a++) { const th = 2 * Math.PI * (a + 0.5) / nArm; pts.push([r * Math.cos(th), r * Math.sin(th), w / nArm]); }
    let acc = 0, wsum = 0;
    F.forEach(f => {
      const wf = f.w ?? 1; let cf = 0, cw = 0;
      if (kind === 'SPOT') {
        const rs = []; let sx = 0, sy = 0, sw = 0;
        Wl.forEach((wl, wi) => pts.forEach(([px, py, w]) => { const r = ray(M, wi, f, px, py); const ww = (wl.w ?? 1) * w; if (r.vig) return; rs.push([r.x, r.y, ww]); sx += ww * r.x; sy += ww * r.y; sw += ww; }));
        if (!sw) { cf = 1e3; cw = 1; } else { const cx = sx / sw, cy = sy / sw; for (const [x, y, w] of rs) { cf += w * ((x - cx) ** 2 + (y - cy) ** 2); cw += w; } cf = Math.sqrt(cf / cw) * 1e3; cw = 1; }
        acc += wf * cf * cf; wsum += wf; return;
      }
      Wl.forEach((wl, wi) => {
        const ref = opdRef(M, wi, f); const vals = [];
        if (ref) pts.forEach(([px, py, w]) => { const v = ref.W(ray(M, wi, f, px, py)); if (isFinite(v)) vals.push([px, py, v, w]); });
        if (vals.length < 6) { acc += wf * (wl.w ?? 1) * 100; wsum += wf * (wl.w ?? 1); return; }
        // retrait piston + tilt (moindres carrés pondérés)
        const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], b = [0, 0, 0];
        for (const [x, y, v, w] of vals) { const z = [1, x, y]; for (let i = 0; i < 3; i++) { b[i] += w * z[i] * v; for (let k = 0; k < 3; k++) A[i][k] += w * z[i] * z[k]; } }
        const c = solveLin(A, b) || [0, 0, 0];
        let s2 = 0, sw = 0; for (const [x, y, v, w] of vals) { const d = v - c[0] - c[1] * x - c[2] * y; s2 += w * d * d; sw += w; }
        acc += wf * (wl.w ?? 1) * (s2 / sw); wsum += wf * (wl.w ?? 1);
      });
    });
    return Math.sqrt(acc / (wsum || 1));
  }
  /** compensateur : recherche du meilleur foyer sur l'épaisseur avant l'image (critère FTM : foyer au meilleur front d'onde, plus robuste et rapide) */
  function bestFocus(sys, kind, h0) {
    const fk = kind === 'MTF' ? 'WFE' : kind;
    const N = sys.surfaces.length - 1, t0 = sys.surfaces[N - 1].t, memo = new Map();
    const ev = dt => { if (memo.has(dt)) return memo.get(dt); const s2 = structuredClone(sys); s2.surfaces[N - 1].t = t0 + dt; const v = criterion(prepare(s2), fk); memo.set(dt, v); return v; };
    let a = -h0, b = 0, c = h0, fa = ev(a), fb = ev(b), fc = ev(c), k = 0;
    // encadrement du minimum
    while (k++ < 25 && !(fb <= fa && fb <= fc)) {
      if (fa < fc) { c = b; fc = fb; b = a; fb = fa; a = b - (c - b) * 1.8; fa = ev(a); }
      else { a = b; fa = fb; b = c; fb = fc; c = b + (b - a) * 1.8; fc = ev(c); }
    }
    // section dorée
    for (let i = 0; i < 12; i++) {
      const x = (c - b > b - a) ? b + 0.381966 * (c - b) : b - 0.381966 * (b - a), fx = ev(x);
      if (fx < fb) { if (x > b) a = b; else c = b; b = x; fb = fx; } else { if (x > b) c = x; else a = x; }
    }
    return { dt: b, c: fb };
  }
  /** compensation complète : variables de l'optimiseur (quelques itérations DLS sur le critère) puis mise au point */
  function compensate(sys, kind, comp, h0, opts = {}) {
    let s = sys, nv = 0;
    if (opts.vars && getVars(s).length) {
      const st = { sys: structuredClone(s), mu: 1e-3 }; st.sys.merit = { image: kind === 'SPOT' ? 'SPOT' : 'WFE', ops: [] }; nv = getVars(s).length;
      for (let i = 0; i < (opts.it || 3); i++) { const r = optStep(st); if (r.done) break; }
      s = st.sys; s.merit = sys.merit;
    }
    let dt = 0;
    if (comp) { const N = s.surfaces.length - 1, bf = bestFocus(s, kind, h0); dt = bf.dt; if (dt) { s = s === sys ? structuredClone(s) : s; s.surfaces[N - 1].t += dt; } }
    return { sys: s, dt, nv };
  }
  /** position du rayon principal du premier champ sur l'image (dérive de visée) */
  function boresight(M) { if (!M.ok) return [NaN, NaN]; const r = ray(M, M.pw, M.sys.fields[0], 0, 0); return r.vig ? [NaN, NaN] : [r.x, r.y]; }
  /** système de base pour le tolérancement : solves figés et, si compensateur, nominal au meilleur foyer */
  function tolBase(sys, kind, comp, opts = {}) {
    // le nominal passe par la même compensation que les systèmes perturbés (variables puis mise au point)
    const fz = tolFreeze(sys), h0 = focusStep(fz), r = compensate(fz, kind, comp, h0, { ...opts, it: Math.max(10, opts.it || 3) }), base = r.sys === fz ? fz : structuredClone(r.sys);
    const M = prepare(base);
    return { base, h0, nominal: criterion(M, kind, opts), focus: r.dt, bore: boresight(M) };
  }
  /** évalue un système perturbé : critère après compensation, mouvement du compensateur et dérive de visée */
  function tolEval(sys, kind, comp, h0, opts = {}) {
    const r = compensate(sys, kind, comp, h0, opts), M = prepare(r.sys), b = boresight(M);
    return { c: criterion(M, kind, opts), dt: r.dt, bx: b[0], by: b[1], sys: opts.keep ? r.sys : undefined };
  }
  /** sensibilité d'un élément : critère aux bornes min et max */
  function tolSens(B, it, kind, comp, opts = {}) {
    const ev = v => { const r = tolEval(tolApply(structuredClone(B.base), it, v), kind, comp, B.h0, opts); return { ...r, d: tolWorse(kind, r.c, B.nominal), bore: Math.hypot(r.bx - B.bore[0], r.by - B.bore[1]) }; };
    return { it, lo: it.min ? ev(it.min) : null, hi: it.max ? ev(it.max) : null };
  }
  /**
   * tolérance inverse : valeur symétrique ±t telle que la dégradation (pire des deux signes) vaille dmax.
   * Modèle Δ ∝ t^p (p ajusté à chaque itération, initialement 2), 5 itérations au plus.
   */
  function tolInverse(B, it, kind, comp, dmax, opts = {}) {
    const ev = t => { const w = [t, -t].map(v => tolWorse(kind, tolEval(tolApply(structuredClone(B.base), it, v), kind, comp, B.h0, opts).c, B.nominal)); return Math.max(...w.map(x => isFinite(x) ? x : 1e9)); };
    let t0 = it.tol, d0 = opts.d0 != null ? opts.d0 : ev(t0), p = 2, n = opts.d0 != null ? 0 : 1;
    if (!(d0 > 1e-12)) return { t: t0 * 1000, d: d0, n, capped: true };
    let t = t0, d = d0;
    for (let k = 0; k < 5; k++) {
      if (Math.abs(d - dmax) < 0.05 * dmax) break;
      let t1 = t * Math.pow(dmax / Math.max(d, 1e-15), 1 / p); t1 = Math.min(t0 * 1000, Math.max(t0 / 1000, t1));
      const d1 = ev(t1); n++;
      if (d1 > 1e-12 && d > 1e-12 && Math.abs(Math.log(t1 / t)) > 1e-6) p = Math.min(4, Math.max(0.7, Math.log(d1 / d) / Math.log(t1 / t)));
      t = t1; d = d1;
    }
    return { t, d, n, capped: t >= t0 * 999 };
  }
  /** arrondi « fabricant » vers le bas : 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8 × 10ⁿ */
  function niceDown(x) { if (!(x > 0)) return x; const e = Math.floor(Math.log10(x)), m = x / 10 ** e, steps = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]; let b = 1; for (const q of steps) if (q <= m + 1e-9) b = q; return +(b * 10 ** e).toPrecision(3); }
  function focusStep(sys) { const M = prepare(sys); return M.ok ? Math.max(1e-4, 2 * M.ctxs[M.pw].lmm * M.par.wfno * M.par.wfno) : 0.01; }
  function gaussTrunc(rnd) { let v; do { const u = 1 - rnd(), w = rnd(); v = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * w) / 2; } while (Math.abs(v) > 1); return v; }
  /** tirage normalisé dans [−1, 1] : gaussienne (σ = ½, tronquée à ±2σ), uniforme, parabolique (extrêmes favorisés, p ∝ x²), extrêmes */
  function tolDraw(dist, rnd) {
    if (dist === 'uniform') return 2 * rnd() - 1;
    if (dist === 'end') return rnd() < 0.5 ? -1 : 1;
    if (dist === 'para') { const u = 2 * rnd() - 1; return Math.sign(u) * Math.cbrt(Math.abs(u)); }
    return gaussTrunc(rnd);
  }
  /** valeur tirée entre min et max d'un élément */
  const tolValue = (it, d) => (it.min + it.max) / 2 + d * (it.max - it.min) / 2;
  /** générateur pseudo-aléatoire reproductible (mulberry32) */
  function rng(seed) { let a = (seed >>> 0) || 0x9e3779b9; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  /** un tirage Monte-Carlo : renvoie le critère, le compensateur et les valeurs tirées */
  function tolTrial(B, items, kind, comp, dist, rnd, opts = {}) {
    const s = structuredClone(B.base), draws = new Float64Array(items.length);
    items.forEach((it, k) => { const v = tolValue(it, tolDraw(dist, rnd)); draws[k] = v; tolApply(s, it, v); });
    const r = tolEval(s, kind, comp, B.h0, opts);
    return { c: r.c, dt: r.dt, bore: Math.hypot(r.bx - B.bore[0], r.by - B.bore[1]), draws, sys: r.sys };
  }
  /** reconstruit le système d'un tirage (valeurs tirées connues), compensateurs appliqués */
  function tolRebuild(B, items, draws, kind, comp, opts = {}) {
    const s = structuredClone(B.base); items.forEach((it, k) => tolApply(s, it, draws[k]));
    return compensate(s, kind, comp, B.h0, opts).sys;
  }

  /* ---------------- Outils « Données système » (CODE V) ---------------- */
  /**
   * SET VIGNETTING : pour chaque champ, rayons limites ±Y, ±X qui passent juste toutes les ouvertures fixées
   * (CIR) → facteurs VUY, VLY, VUX, VLX. Renvoie { fields: [{vuy, vly, vux, vlx}], clipped: nb de surfaces à ouverture fixée }.
   */
  function setVignetting(sys, wl) {
    const M = prepare(sys); if (!M.ok) throw new Error(M.errors.join(', '));
    const wi = wl == null ? M.pw : wl, nFix = M.S.filter((s, j) => j > 0 && j < M.N && s.sdFixed).length;
    const pass = (f, px, py) => !ray(M, wi, f, px, py, { noVig: true }).vig;
    // bord du faisceau le long de (dx, dy) depuis (x0, y0) : plus grand t ∈ [0, 1] transmis
    const edge = (f, dx, dy, x0 = 0, y0 = 0) => {
      const P = t => pass(f, x0 + t * dx, y0 + t * dy), full = Math.abs(dx) ? 1 - dx * x0 : 1 - dy * y0;
      if (P(full)) return full;
      if (!P(0)) { let lo = -1, hi = full; for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (P(m)) hi = m; else lo = m; } return P(hi) ? hi : -1; }
      let lo = 0, hi = full; for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (P(m)) lo = m; else hi = m; }
      return lo;
    };
    const r6 = v => Math.min(1, Math.max(0, Math.ceil(v * 1e6 - 1e-6) / 1e6)); // arrondi vers le haut : le rayon limite reste transmis
    return { clipped: nFix, fields: M.sys.fields.map(f => {
      const vuy = r6(1 - edge(f, 0, 1)), vly = r6(1 - edge(f, 0, -1)), cy = (vly - vuy) / 2; // X mesuré sur la ligne du centre vignetté
      return { vuy, vly, vux: r6(1 - edge(f, 1, 0, 0, cy)), vlx: r6(1 - edge(f, -1, 0, 0, cy)) };
    }) };
  }
  /** exprime les mêmes points de champ dans un autre type (ang, obj, pim, rim) ; renvoie les nouvelles valeurs {x, y} */
  function convertFields(sys, to) {
    const M = prepare(sys); if (!M.ok) throw new Error(M.errors.join(', '));
    if (to === 'obj' && M.objInf) throw new Error('Objet à l\'infini : les champs ne peuvent pas être des hauteurs objet');
    const L = M.t0 + M.par.zE, k = M.par.unitImgH;
    return M.sys.fields.map(f => {
      if (to === 'ang') return M.objInf ? { x: f.x, y: f.y } : { x: Math.atan(-f.x / L) / DEG, y: Math.atan(-f.y / L) / DEG };
      if (to === 'obj') return { x: f.x, y: f.y };
      if (to === 'pim') return M.objInf ? { x: Math.tan(f.x * DEG) * k, y: Math.tan(f.y * DEG) * k } : { x: f.x * k, y: f.y * k };
      const r = ray(M, M.pw, f, 0, 0); if (r.vig) throw new Error('Rayon principal arrêté : conversion en hauteur image réelle impossible');
      return { x: Math.abs(r.x) < 1e-12 ? 0 : r.x, y: Math.abs(r.y) < 1e-12 ? 0 : r.y };
    });
  }
  /** balayage en température : focale, défocalisation (foyer paraxial − plan image), RMS spot et front d'onde au plan image fixe */
  /* ---------------- Multi-configuration (zoom) ----------------
   * sys.mc = { n, cur, names: [], ops: [{ type, i, v: [valeur par config], vv: [variable par config] }], opt: 'all' | 'cur' }
   * Le système principal porte toujours les valeurs de la configuration courante ; mcSync les recopie dans ops[].v[cur].
   */
  const MCT = {
    THI: { l: 'Épaisseur', u: 'mm', s: 1, get: (S, i) => S.surfaces[i] && S.surfaces[i].t, set: (S, i, x) => { const q = S.surfaces[i]; if (q) { q.t = +x; if (q.tsolve) q.tsolve = ''; } }, num: 1, zmx: 'THIC', cv: 'THI', var: 't' },
    RAD: { l: 'Rayon', u: 'mm', s: 1, get: (S, i) => S.surfaces[i] && S.surfaces[i].r, set: (S, i, x) => { const q = S.surfaces[i]; if (q) { q.r = +x; if (q.rsolve) q.rsolve = ''; } }, num: 1, cv: 'RDY', var: 'c' },
    CNC: { l: 'Conique', s: 1, get: (S, i) => S.surfaces[i] && (S.surfaces[i].k || 0), set: (S, i, x) => { if (S.surfaces[i]) S.surfaces[i].k = +x; }, num: 1, zmx: 'CONN', cv: 'K', var: 'k' },
    GLA: { l: 'Verre', s: 1, get: (S, i) => S.surfaces[i] && (S.surfaces[i].glass || ''), set: (S, i, x) => { if (S.surfaces[i]) S.surfaces[i].glass = String(x || ''); }, zmx: 'GLSS', cv: 'GLA' },
    SD: { l: '½ diamètre', u: 'mm', s: 1, get: (S, i) => S.surfaces[i] && S.surfaces[i].sd, set: (S, i, x) => { const q = S.surfaces[i]; if (q) { q.sd = +x; q.sdFixed = true; } }, num: 1, zmx: 'SDIA', cv: 'CIR' },
    DX: { l: 'Décentrement X', u: 'mm', s: 1, get: (S, i) => S.surfaces[i] && (S.surfaces[i].dx || 0), set: (S, i, x) => { if (S.surfaces[i]) S.surfaces[i].dx = +x; }, num: 1, cv: 'XDE' },
    DY: { l: 'Décentrement Y', u: 'mm', s: 1, get: (S, i) => S.surfaces[i] && (S.surfaces[i].dy || 0), set: (S, i, x) => { if (S.surfaces[i]) S.surfaces[i].dy = +x; }, num: 1, cv: 'YDE' },
    TX: { l: 'Bascule α', u: '°', s: 1, get: (S, i) => S.surfaces[i] && (S.surfaces[i].tx || 0), set: (S, i, x) => { if (S.surfaces[i]) S.surfaces[i].tx = +x; }, num: 1, cv: 'ADE' },
    TY: { l: 'Bascule β', u: '°', s: 1, get: (S, i) => S.surfaces[i] && (S.surfaces[i].ty || 0), set: (S, i, x) => { if (S.surfaces[i]) S.surfaces[i].ty = +x; }, num: 1, cv: 'BDE' },
    APE: { l: 'Ouverture (valeur)', get: S => S.aperture.value, set: (S, i, x) => { S.aperture.value = +x; }, num: 1, zmx: 'APER' },
    FY: { l: 'Champ Y', f: 1, get: (S, i) => S.fields[i] && S.fields[i].y, set: (S, i, x) => { if (S.fields[i]) S.fields[i].y = +x; }, num: 1, zmx: 'YFIE' },
    FX: { l: 'Champ X', f: 1, get: (S, i) => S.fields[i] && (S.fields[i].x || 0), set: (S, i, x) => { if (S.fields[i]) S.fields[i].x = +x; }, num: 1, zmx: 'XFIE' },
    WL: { l: 'Longueur d\'onde', u: 'µm', w: 1, get: (S, i) => S.wavelengths[i] && S.wavelengths[i].um, set: (S, i, x) => { if (S.wavelengths[i]) S.wavelengths[i].um = +x; }, num: 1, zmx: 'WAVE' },
    WW: { l: 'Poids λ', w: 1, get: (S, i) => S.wavelengths[i] && (S.wavelengths[i].w ?? 1), set: (S, i, x) => { if (S.wavelengths[i]) S.wavelengths[i].w = +x; }, num: 1, zmx: 'WLWT', cv: 'WTW' },
    TEM: { l: 'Température', u: '°C', get: S => (S.env && S.env.T != null ? S.env.T : 20), set: (S, i, x) => { S.env = { ...(S.env || {}), T: +x }; }, num: 1, zmx: 'TEMP', cv: 'TEM' },
    PRE: { l: 'Pression', u: 'atm', get: S => (S.env && S.env.P != null ? S.env.P : 1), set: (S, i, x) => { S.env = { ...(S.env || {}), P: +x }; }, num: 1, zmx: 'PRES', cv: 'PRE' },
  };
  const mcOn = sys => !!(sys && sys.mc && sys.mc.n > 1 && Array.isArray(sys.mc.ops));
  /** recopie les valeurs du système (configuration courante) dans la table multi-configuration */
  function mcSync(sys) {
    if (!sys || !sys.mc || !Array.isArray(sys.mc.ops)) return sys;
    const mc = sys.mc, k = Math.min(Math.max(0, mc.cur | 0), (mc.n || 1) - 1); mc.cur = k;
    for (const op of mc.ops) { const T = MCT[op.type]; if (!T) continue; if (!Array.isArray(op.v)) op.v = []; while (op.v.length < mc.n) op.v.push(op.v.length ? op.v[op.v.length - 1] : T.get(sys, op.i)); op.v.length = mc.n; const v = T.get(sys, op.i); if (v !== undefined) op.v[k] = v; }
    return sys;
  }
  /** passe le système (en place) sur la configuration k */
  function mcSet(sys, k) { if (!sys.mc) return sys; mcSync(sys); return mcLoad(sys, k); }
  /** charge les valeurs de la configuration k dans le système (sans recopier d'abord la configuration courante) */
  function mcLoad(sys, k) {
    k = Math.min(Math.max(0, k | 0), sys.mc.n - 1);
    for (const op of sys.mc.ops) { const T = MCT[op.type]; if (T && op.v && op.v[k] !== undefined && op.v[k] !== null && op.v[k] !== '') T.set(sys, op.i, op.v[k]); }
    sys.mc.cur = k; return sys;
  }
  /** copie du système dans la configuration k */
  const mcApply = (sys, k) => mcSet(structuredClone(sys), k);
  /** le paramètre (type de variable, surface) est-il piloté par la multi-configuration ? */
  const mcCtl = (sys, kind, si) => mcOn(sys) && sys.mc.ops.some(op => MCT[op.type] && MCT[op.type].var === kind && op.i === si);
  /** ajoute une ligne de multi-configuration (valeurs initialisées à la valeur actuelle) */
  function mcAddOp(sys, type, i) {
    const T = MCT[type]; if (!T) return null; if (!sys.mc) sys.mc = { n: 1, cur: 0, ops: [], names: [] };
    // une épaisseur pilotée par la multi-configuration ne peut plus être résolue (solve M) : valeur résolue figée
    if (type === 'THI' && sys.surfaces[i] && sys.surfaces[i].tsolve) { const M = prepare(sys); if (M.ok) sys.surfaces[i].t = M.S[i].t; sys.surfaces[i].tsolve = ''; }
    const v = T.get(sys, i); const op = { type, i: i | 0, v: Array.from({ length: sys.mc.n }, () => v) }; sys.mc.ops.push(op); return op;
  }
  /** résumé par configuration (paraxial, qualité) */
  function mcSummary(sys) {
    const out = []; if (!sys.mc) return out;
    for (let k = 0; k < sys.mc.n; k++) {
      const M = prepare(mcApply(sys, k)); if (!M.ok) { out.push({ k, ok: false }); continue; }
      const sp = M.sys.fields.map((_, i) => spot(M, i, 15).rms * 1e3), wf = M.sys.fields.map((_, i) => { const w = wavefront(M, i, M.pw, 32); return w.ok ? w.rms : NaN; });
      out.push({ k, ok: true, efl: M.par.efl, wfno: M.par.wfno, bfl: M.par.imgDist, ttl: M.par.ttl, imgH: M.par.imgH, fmax: M.par.fmax, spot: Math.max(...sp), wfe: Math.max(...wf.filter(isFinite)), M });
    }
    return out;
  }

  /* ---------------- FTM through-focus, FTM selon le champ ---------------- */
  /** champs internes répartis de 0 au champ max selon Y (facteurs de vignetage interpolés) ; u = abscisse affichée */
  function fieldSweep(M, n = 11) {
    const F = M.sys.fields, r = F.map(f => Math.hypot(f.x || 0, f.y || 0)), rm = Math.max(...r, 0), order = r.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
    const vk = ['vuy', 'vly', 'vux', 'vlx'], img = M.ftype === 'pim' || M.ftype === 'rim', out = [];
    for (let k = 0; k < n; k++) {
      const y = n === 1 ? rm : rm * k / (n - 1), f = { x: 0, y };
      let a = order[0], b = order[order.length - 1];
      for (let q = 0; q < order.length - 1; q++) if (y >= order[q][0] && y <= order[q + 1][0]) { a = order[q]; b = order[q + 1]; break; }
      const t = b[0] > a[0] ? Math.min(1, Math.max(0, (y - a[0]) / (b[0] - a[0]))) : 0;
      for (const key of vk) { const va = +F[a[1]][key] || 0, vb = +F[b[1]][key] || 0; if (va || vb) f[key] = va + t * (vb - va); }
      let u = y; if (img) { const c = ray(M, M.pw, f, 0, 0, { noVig: true }); u = c.vig ? NaN : Math.hypot(c.x, c.y); }
      out.push({ f, u });
    }
    return { pts: out, unit: img ? 'mm (image)' : M.objInf ? '°' : 'mm (objet)', img };
  }
  /** FTM (T, S) à une fréquence en fonction de la défocalisation, pour chaque champ ; meilleur foyer = max de la moyenne (T+S)/2 */
  async function throughFocus(sys, o = {}, prog) {
    const fz = tolFreeze(sys), N = fz.surfaces.length - 1, t0 = fz.surfaces[N - 1].t, M0 = prepare(fz);
    if (!M0.ok) return null;
    const dof = M0.ctxs[M0.pw].lmm * M0.par.wfno * M0.par.wfno, freq = +o.freq || 30, half = +o.half || Math.max(8 * dof, 1.4 * Math.abs(bestFocus(fz, 'WFE', focusStep(fz)).dt || 0)), n = Math.max(5, Math.min(61, o.n | 0 || 21)), Np = o.N || 32;
    const dz = Array.from({ length: n }, (_, k) => -half + 2 * half * k / (n - 1)), nf = fz.fields.length;
    const T = Array.from({ length: nf }, () => []), S = Array.from({ length: nf }, () => []), DL = [];
    for (let k = 0; k < n; k++) {
      const s = structuredClone(fz); s.surfaces[N - 1].t = t0 + dz[k];
      const M = prepare(s); let dl = 0;
      for (let i = 0; i < nf; i++) {
        if (!M.ok) { T[i].push(NaN); S[i].push(NaN); continue; }
        const r = mtf(M, i, { freqs: [freq], N: Np }); T[i].push(r.T[0]); S[i].push(r.S[0]); dl = Math.max(dl, r.DL[0]);
      }
      DL.push(dl);
      if (prog) await prog(k + 1, n);
    }
    const W = fz.fields.map(f => f.w ?? 1), Wt = W.reduce((a, b) => a + b, 0) || 1;
    const avg = dz.map((_, k) => W.reduce((a, w, i) => a + w * (T[i][k] + S[i][k]) / 2, 0) / Wt);
    let kb = 0; avg.forEach((v, k) => { if (v > avg[kb]) kb = k; });
    let best = dz[kb];
    if (kb > 0 && kb < n - 1) { const a = avg[kb - 1], b = avg[kb], c = avg[kb + 1], den = a - 2 * b + c; if (den < 0) best = dz[kb] + 0.5 * (a - c) / den * (dz[1] - dz[0]); }
    return { dz, T, S, DL, avg, best, bestV: avg[kb], freq, half, t0 };
  }
  /** FTM (T, S) à quelques fréquences en fonction du champ */
  async function mtfField(sys, o = {}, prog) {
    const M = prepare(sys); if (!M.ok) return null;
    const freqs = (o.freqs && o.freqs.length ? o.freqs : [10, 30, 50]).map(Number).filter(v => v > 0), sw = fieldSweep(M, o.n || 11), Np = o.N || 32;
    const T = freqs.map(() => []), S = freqs.map(() => []), DL = freqs.map(() => []);
    for (let k = 0; k < sw.pts.length; k++) {
      const r = mtf(M, sw.pts[k].f, { freqs, N: Np });
      freqs.forEach((_, q) => { T[q].push(r.T[q]); S[q].push(r.S[q]); DL[q].push(r.DL[q]); });
      if (prog) await prog(k + 1, sw.pts.length);
    }
    return { u: sw.pts.map(p => p.u), unit: sw.unit, freqs, T, S, DL, defF: sys.fields.map(f => Math.hypot(f.x || 0, f.y || 0)), img: sw.img };
  }

  /* ---------------- Éclairement relatif, grille de distorsion ---------------- */
  /** aire du faisceau dans l'espace des cosinus directeurs image (rayons non vignetés, pupille découpée en n×n mailles) */
  function beamArea(M, f, wi, n = 40) {
    const P = []; let cos = NaN;
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) { const r = ray(M, wi, f, -1 + 2 * i / n, -1 + 2 * j / n); P.push(r.vig ? null : [r.L, r.M]); }
    const c = ray(M, wi, f, 0, 0); if (!c.vig) cos = Math.abs(c.N);
    const h = 2 / n, obs = M.obs || 0; let A = 0;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const a = P[j * (n + 1) + i], b = P[j * (n + 1) + i + 1], d = P[(j + 1) * (n + 1) + i], e = P[(j + 1) * (n + 1) + i + 1];
      if (!a || !b || !d || !e) continue;
      // fraction de la maille dans la pupille (4×4 sous-points)
      let fr = 0; for (let q = 0; q < 16; q++) { const x = -1 + (i + ((q & 3) + 0.5) / 4) * h, y = -1 + (j + ((q >> 2) + 0.5) / 4) * h, rr = Math.hypot(x, y); if (rr <= 1 && rr >= obs) fr++; }
      if (!fr) continue;
      const ar = Math.abs((b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0])) / 2 + Math.abs((b[0] - e[0]) * (d[1] - e[1]) - (b[1] - e[1]) * (d[0] - e[0])) / 2;
      A += ar * fr / 16;
    }
    return { A, cos };
  }
  /** éclairement relatif (aire du faisceau image dans l'espace des cosinus directeurs, rapportée à l'axe) en fonction du champ */
  async function relIllum(sys, o = {}, prog) {
    const M = prepare(sys); if (!M.ok) return null;
    const sw = fieldSweep(M, o.n || 21), wi = o.wi ?? M.pw, ng = o.grid || 40, A = [], C = [];
    for (let k = 0; k < sw.pts.length; k++) { const b = beamArea(M, sw.pts[k].f, wi, ng); A.push(b.A); C.push(b.cos); if (prog) await prog(k + 1, sw.pts.length); }
    const a0 = A[0] || 1, c0 = C[0] || 1;
    return { u: sw.pts.map(p => p.u), unit: sw.unit, ri: A.map(v => v / a0), cos4: C.map(v => (v / c0) ** 4), img: sw.img, wl: M.wls[wi] };
  }
  /** grille de distorsion : rayons principaux réels vs grille idéale (paraxiale) ; diag = le coin de la grille correspond au champ max */
  function distGrid(M, o = {}) {
    const n = Math.max(3, o.n | 0 || 11), F = M.sys.fields, rm = Math.max(...F.map(f => Math.hypot(f.x || 0, f.y || 0)), 1e-9), hs = o.diag === false ? rm : rm / Math.SQRT2, k = M.par.unitImgH, wi = o.wi ?? M.pw;
    const ideal = (x, y) => M.objInf ? [k * Math.tan(x * DEG), k * Math.tan(y * DEG)] : [k * x, k * y];
    const c0 = ray(M, wi, { x: 0, y: 0 }, 0, 0, { noVig: true }), ox = c0.vig ? 0 : c0.x, oy = c0.vig ? 0 : c0.y;
    const R = [], I = []; let dmax = 0, dAt = null;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const fx = -hs + 2 * hs * i / (n - 1), fy = -hs + 2 * hs * j / (n - 1), c = ray(M, wi, { x: fx, y: fy }, 0, 0, { noVig: true }), q = ideal(fx, fy);
      I.push(q); const p = c.vig ? null : [c.x - ox, c.y - oy]; R.push(p);
      const ri = Math.hypot(q[0], q[1]);
      if (p && ri > 1e-12) { const d = 100 * (Math.hypot(p[0], p[1]) - ri) / ri; if (Math.abs(d) > Math.abs(dmax)) { dmax = d; dAt = [fx, fy]; } }
    }
    return { n, R, I, dmax, dAt, hs, unit: M.objInf ? '°' : 'mm' };
  }
  /* ---------------- Images fantômes (réflexions doubles, analyse paraxiale façon « Ghost Focus ») ---------------- */
  /**
   * Pour chaque paire de dioptres (i < j) : le rayon marginal se réfléchit sur j, revient, se réfléchit sur i puis repart vers l'image.
   * Renvoie la hauteur du faisceau fantôme sur l'image (|y|), la position de son foyer par rapport au plan image (dz),
   * le produit des réflexions R = Rᵢ·Rⱼ (Fresnel en incidence normale ou traitement imposé) et un éclairement relatif estimé
   * R · (r_signal / max(r_signal, r_fantôme))², r_signal = max(rayon d'Airy, spot RMS sur l'axe).
   */
  function ghosts(M, o = {}) {
    const S = M.S, N = M.N, n = M.nW[M.pw], par = M.par, mar = par.mar, c = j => curv(S[j]);
    const Rf = j => { if (o.coat > 0) return o.coat; const a = Math.abs(n[j - 1]), b = Math.abs(n[j]); return ((a - b) / (a + b)) ** 2; };
    const ok = j => j >= 1 && j < N && !isMirror(S[j]) && Math.abs(Math.abs(n[j - 1]) - Math.abs(n[j])) > 1e-6 && S[j].elem !== 'ideal';
    const rA = 1.22 * M.ctxs[M.pw].lmm * par.wfno, sp = (() => { try { return spot(M, 0, 13).rms; } catch (e) { return 0; } })(), rs = Math.max(rA, sp || 0);
    const out = [];
    for (let j = 2; j < N; j++) for (let i = 1; i < j; i++) {
      if (!ok(i) || !ok(j)) continue;
      let y = mar.y[j], nu = mar.nu[j - 1];
      nu = nu - y * c(j) * (-n[j - 1] - n[j - 1]);                 // réflexion sur j (retour dans le milieu j−1)
      let zmin = Infinity, zin = null;
      for (let k = j - 1; k >= i; k--) {                            // retour de j vers i
        const y0 = y; y = y + S[k].t * nu / n[k];
        if (y0 * y < 0) { const f = y0 / (y0 - y); zin = { k, f }; }
        if (k > i) nu = nu - y * c(k) * (-n[k - 1] + n[k]);
      }
      nu = nu - y * c(i) * (n[i] + n[i]);                           // réflexion sur i (repart vers l'image)
      for (let k = i + 1; k <= N; k++) { const y0 = y; y = y + S[k - 1].t * nu / n[k - 1]; if (k < N && y0 * y < 0 && !zin) zin = { k: k - 1, f: y0 / (y0 - y), fwd: true }; if (k < N) nu = nu - y * c(k) * (n[k] - n[k - 1]); }
      const u = nu / n[N - 1], dz = Math.abs(u) > 1e-15 ? -y / u : Infinity, R = Rf(i) * Rf(j), ry = Math.abs(y);
      out.push({ i, j, R, y: ry, dz, rel: R * (rs / Math.max(rs, ry)) ** 2, inGlass: zin && !isAir(S[zin.k].glass) ? zin.k : null });
      void zmin;
    }
    out.sort((a, b) => b.rel - a.rel);
    return { rows: out, rs, rA, n: out.length };
  }
  /** tirage Monte-Carlo à valeurs imposées (tirages générés à part, pour le calcul parallèle reproductible) */
  function tolTrialD(B, items, kind, comp, draws, opts = {}) {
    const s = structuredClone(B.base); items.forEach((it, k) => tolApply(s, it, draws[k]));
    const r = tolEval(s, kind, comp, B.h0, opts);
    return { c: r.c, dt: r.dt, bore: Math.hypot(r.bx - B.bore[0], r.by - B.bore[1]) };
  }

  function thermalScan(sys, o = {}) {
    const T1 = o.T1 ?? -20, T2 = o.T2 ?? 60, n = o.n || 9, out = { T: [], efl: [], dz: [], spot: [], wfe: [], fi: o.fi || 0 };
    for (let i = 0; i < n; i++) {
      const T = T1 + (T2 - T1) * i / (n - 1), s = structuredClone(sys); s.env = { ...(s.env || {}), T };
      const M = prepare(s); out.T.push(T);
      if (!M.ok) { out.efl.push(NaN); out.dz.push(NaN); out.spot.push(NaN); out.wfe.push(NaN); continue; }
      const fi = Math.min(out.fi, M.sys.fields.length - 1);
      out.efl.push(M.par.efl); out.dz.push((M.par.imgDist - M.S[M.N - 1].t) * 1000);
      out.spot.push(spot(M, fi, 15).rms * 1000);
      const wf = wavefront(M, fi, M.pw, 32); out.wfe.push(wf.ok ? wf.rms : NaN);
    }
    return out;
  }

  return { ghosts, MCT, mcOn, mcSync, mcSet, mcLoad, mcApply, mcCtl, mcAddOp, mcSummary, fieldSweep, throughFocus, mtfField, beamArea, relIllum, distGrid, tolTrialD, DEG, fiberInfo, binPSF, detMTF, extSource, binImage, imageSim, polPupil, polOut, POLSTATES, TOLT, TOLC, LT, quickFocus, wlSel, opValue, parseModel, fmtModel, glassNearest, glassPool, toModel, subTry, tolBase, tolDefaults, tolFreeze, tolItems, tolGen, tolApplicable, tolLabel, tolApply, tolWorse, tolSens, tolInverse, tolTrial, tolRebuild, tolValue, niceDown, rng, mtfAt, compensate, criterion, bestFocus, tolEval, focusStep, tolDraw, frames, toGlobal, mv, sGrad, fieldDir, catalog, glassN, glassRecord, glassProps, glassTau, sysTau, addGlasses, parseAGF, cats: () => [...CATS], dispN, glassInfo, glassKey, isMirror, isAir, curv, sag, prepare, ray, trace, spot, rayFan, opdFan,
    wavefront, zernFit, ZN37, psf, psfGrid, mtf, mtfGeo, pupilScale, otfAC, mtfOne, mtfDL, encircled, footprint, fieldCurves, seidel, chromShift, ZN, zernBasis,
    srcCoupling, smCoupling, sysTransmission, srcModelDesc, pupilCells, srcApod, sysApod, apodEdgeI, OPS, OPG, meritUpgrade, meritPupil, gaussLegendre, meritR, consViol, getVars, getVal, setVal, residuals, meritOf, optStep, pupilGrid, indices, paraxial,
    ASPK, FTYPES, vigMap, modelN, aimMode, setVignetting, convertFields, thermalScan, glassTherm, nAir, envN, envCtx, isSolid };
})();
if (typeof module !== 'undefined') module.exports = OE;
