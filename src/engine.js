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
    const m = String(name).match(/^\s*([0-9.]+)\s*[,\/;:]\s*([0-9.]+)\s*$/); // modèle nd/vd
    if (m) {
      const nd = +m[1], vd = +m[2];
      const lF = 0.4861327, lC = 0.6562725, ld = 0.5875618;
      const B = ((nd - 1) / vd) / (1 / (lF * lF) - 1 / (lC * lC));
      return nd - B / (ld * ld) + B / (l * l);
    }
    const v = parseFloat(name);
    if (isFinite(v) && v >= 1 && /^\s*[0-9.]+\s*$/.test(name)) return v;
    return NaN;
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
      else if (k === 'ED' && cur) { const v = +t[1]; if (isFinite(v) && v) cur.cte = v * 1e-6; }
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
    const xyT = s.type === 'XY' ? Object.entries(s.xy || {}).map(([k, c]) => { const [i, j] = k.split(',').map(Number); return [i, j, +c || 0]; }).filter(t => t[2] && t[0] + t[1] > 0) : null;
    const zc = s.type === 'ZERN' && Array.isArray(s.zc) && s.zc.some(v => +v) ? Array.from({ length: 16 }, (_, k) => +s.zc[k] || 0) : null;
    return { xyT: xyT && xyT.length ? xyT : null, zc, zr: +s.zr > 0 ? +s.zr : 1, ff: !!((xyT && xyT.length) || zc) };
  }
  /** flèche locale z(x, y) */
  function sag(sf, x, y) { const z = sagR(sf, x * x + y * y); return sf.ff ? z + ffSag(sf, x, y) : z; }
  /** pente locale [dz/dx, dz/dy] */
  function sGrad(sf, x, y) {
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
    if (ap.type === 'NAI' || ap.type === 'STOP') { // ON image, ou ouverture fixée par le demi-diamètre du diaphragme
      let m1; if (objInf) m1 = ptrace(S, n, 0.5, 0); else { const u0 = 0.5 / (zE + t0); m1 = ptrace(S, n, u0 * t0, u0); }
      if (ap.type === 'NAI') { const nI = Math.abs(n[N - 1]), uM1 = m1.nu[N - 1] / nI; epd = Math.abs(uM1) > 1e-15 ? Math.tan(Math.asin(Math.min(0.9999, ap.value / nI))) / Math.abs(uM1) : 1; }
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
    // pupille de sortie relative au dernier dioptre
    return {
      efl, epd, zE, stopR: Math.abs(mar.y[stopIdx]), mar, chf, unit, imgDist,
      bfl: (() => { const k = ra.nu[N - 1] / nI; return Math.abs(k) > 1e-15 ? -ra.y[N - 1] / k : Infinity; })(),
      wfno: 1 / (2 * Math.abs(mar.nu[N - 1])), fno: Math.abs(efl) / epd,
      xpZ, xpD, H, ttl, imgH: chf.y[N], unitImgH: unit.y[N],
      mag: objInf ? 0 : chiefFor(1).y[N],
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
    const nSolve = S.filter(s => s.tsolve === 'M').length;
    for (let it = 0; it < nSolve + 2; it++) {
      par = paraxial(sys, nW[pw], stopIdx, objInf);
      let ch = false;
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
          asph: !!(s.a4 || s.a6 || s.a8 || s.a10 || hi || f.ff), t: s.t, mirror: isMirror(s), sd: s.sd, clip: !!s.sdFixed,
          elem: s.elem || '', lpmm: +s.lpmm || 0, gm: s.gm == null ? 1 : +s.gm, gang: (+s.gang || 0) * DEG, fid: +s.fid || 100,
          pang: (+s.pang || 0) * DEG, ret: s.ret == null ? 0.25 : +s.ret, wang: (+s.wang || 0) * DEG }; }),
      };
    });
    const M = { sys, S, N, wls, pw, stopIdx, objInf, nW, par, zg, fr, ctxs, aimCache: new Map(), ok: true, errors: [], warnings,
      t0: objInf ? 0 : S[0].t, obs: Math.max(0, Math.min(0.95, +sys.aperture.obscuration || 0)), env: E, ftype, ufields };
    M.epr = par.epd / 2;
    if (ftype === 'rim') realImageFields(M);
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
      if (j === M.N) return { vig: 0, x: lx, y: ly, z: lz, L: dL, M: dM, N: dN, opl, gx: x, gy: y, gz: z, E: pol ? [Ex, Ey, Ez, Fx, Fy, Fz] : null };
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
        const tx2 = tx - lx / f, ty2 = ty - ly / f, q = Math.hypot(tx2, ty2, 1);
        const Lq = Math.hypot(f * tx - lx, f * ty - ly, f), Lq0 = Math.abs(f) * Math.hypot(tx, ty, 1);
        opl += n1 * (-(lx * dL + ly * dM) - Math.sign(f) * (Lq - Lq0));
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
  function aimRay(M, ctx, f, px, py) {
    let ax = px * M.epr, ay = py * M.epr;
    if (!M.sys.rayAiming) return [ax, ay];
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
    if (!M.sys.rayAiming) return [0, 0];
    if (M.aimCache.has(key)) return M.aimCache.get(key);
    const a = aimRay(M, ctx, f, 0, 0); M.aimCache.set(key, a); return a;
  }
  /** rayon réel pour un champ {x, y} et une pupille normalisée (px, py) */
  function ray(M, wi, f, px, py, opts) {
    if (typeof f === 'number') f = { x: 0, y: f };
    const v = opts && opts.noVig ? null : vigMap(f);
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
  /** apodisation gaussienne de la pupille (CODE V PUI) : intensité relative I au bord → amplitude I^(ρ²/2) */
  function sysApod(M) {
    const a = M.sys.apod; if (!a || a.type !== 'gauss') return null;
    const I = Math.min(1, Math.max(1e-6, +a.I || 0.135)); if (I >= 1) return null;
    return (x, y) => Math.pow(I, (x * x + y * y) / 2);
  }
  function psf(M, fi, wi, N = 64, P = 256, wfIn, apod) {
    if (apod === undefined) apod = sysApod(M);
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
    const dx = M.ctxs[wi].lmm * M.par.wfno * N / P;
    return { I, P, N, dx, strehl: pk, wf };
  }
  /**
   * PSF sur une grille choisie (transformée de Fourier matricielle) : m×m points couvrant [−half, half] mm dans le plan image,
   * à partir d'un front d'onde N×N (wf facultatif). Même normalisation que psf() : le maximum vaut le rapport de Strehl.
   * Résolution indépendante d'une FFT : utile pour la vue 3D et les zooms.
   */
  function psfGrid(M, fi, wi, half, m, N = 128, wfIn, xsIn) {
    const wf = wfIn || wavefront(M, fi, wi, N, false), apod = sysApod(M);
    const lF = M.ctxs[wi].lmm * M.par.wfno, dx = 2 * half / (m - 1), xs = xsIn || Array.from({ length: m }, (_, k) => -half + k * dx);
    const Ar = new Float64Array(N * N), Ai = new Float64Array(N * N); let sa = 0;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const w = wf.W[i * N + j]; if (!isFinite(w)) continue;
      const A = apod ? apod(-1 + (2 * j + 1) / N, -1 + (2 * i + 1) / N) : 1; if (!(A > 0)) continue;
      const ph = -2 * Math.PI * w; Ar[i * N + j] = A * Math.cos(ph); Ai[i * N + j] = A * Math.sin(ph); sa += A;
    }
    // noyau e^{−2πi (j − N/2) x / (λF N)} (même convention que la FFT de psf())
    const Kr = new Float64Array(m * N), Ki = new Float64Array(m * N);
    for (let k = 0; k < m; k++) { const x = xs[k]; for (let j = 0; j < N; j++) { const a = -2 * Math.PI * (j - N / 2) * x / (lF * N); Kr[k * N + j] = Math.cos(a); Ki[k * N + j] = Math.sin(a); } }
    // T = A · Kxᵀ  (N × m), puis E = Ky · T (m × m)
    const Tr = new Float64Array(N * m), Ti = new Float64Array(N * m);
    for (let i = 0; i < N; i++) for (let k = 0; k < m; k++) { let sr = 0, si = 0; const o = i * N, q = k * N; for (let j = 0; j < N; j++) { const ar = Ar[o + j]; if (!ar && !Ai[o + j]) continue; const ai = Ai[o + j], kr = Kr[q + j], ki = Ki[q + j]; sr += ar * kr - ai * ki; si += ar * ki + ai * kr; } Tr[i * m + k] = sr; Ti[i * m + k] = si; }
    const I = new Float64Array(m * m), norm = sa * sa || 1; let pk = 0;
    for (let r = 0; r < m; r++) for (let k = 0; k < m; k++) { let sr = 0, si = 0; const q = r * N; for (let i = 0; i < N; i++) { const tr = Tr[i * m + k], ti = Ti[i * m + k], kr = Kr[q + i], ki = Ki[q + i]; sr += kr * tr - ki * ti; si += kr * ti + ki * tr; } const v = (sr * sr + si * si) / norm; I[r * m + k] = v; if (v > pk) pk = v; }
    return { I, m, dx, half, xs, strehl: pk, wf };
  }
  function mtfOne(M, fi, wi, N = 64, P = 256) {
    const p = psf(M, fi, wi, N, P);
    const otf = I => { const re = Float64Array.from(I), im = new Float64Array(P * P); fft2(re, im, P, false); return (x, y) => Math.hypot(re[y * P + x], im[y * P + x]); };
    const mag = otf(p.I);
    // limite de diffraction : même pupille (obstruction centrale, vignetage) avec un front d'onde parfait
    const W0 = Float64Array.from(p.wf.W, v => isFinite(v) ? 0 : NaN), dl = otf(psf(M, fi, wi, N, P, { W: W0 }).I);
    const m0 = mag(0, 0) || 1, d0 = dl(0, 0) || 1, fc = 1 / (M.ctxs[wi].lmm * M.par.wfno), f = [], T = [], Sg = [], DT = [], DS = [];
    for (let k = 0; k <= N; k++) { f.push(k * fc / N); T.push(mag(0, k % P) / m0); Sg.push(mag(k % P, 0) / m0); DT.push(dl(0, k % P) / d0); DS.push(dl(k % P, 0) / d0); }
    return { f, T, S: Sg, DT, DS, fc, strehl: p.strehl };
  }
  function mtfDL(nu) { if (nu >= 1) return 0; return (2 / Math.PI) * (Math.acos(nu) - nu * Math.sqrt(1 - nu * nu)); }
  function interp(xs, ys, x) {
    if (x <= xs[0]) return ys[0]; if (x >= xs[xs.length - 1]) return 0;
    let i = 1; while (xs[i] < x) i++; const t = (x - xs[i - 1]) / (xs[i] - xs[i - 1]); return ys[i - 1] * (1 - t) + ys[i] * t;
  }
  function mtf(M, fi, opts = {}) {
    const N = opts.N || 48, P = opts.P || 128;
    const per = M.wls.map((_, wi) => mtfOne(M, fi, wi, N, P));
    const fmax = opts.fmax || Math.max(...per.map(p => p.fc));
    const nf = 80, f = [], T = [], Sg = [], DL = [];
    const W = M.sys.wavelengths.map(w => w.w ?? 1), Wt = W.reduce((a, b) => a + b, 0);
    for (let i = 0; i <= nf; i++) {
      const fr = fmax * i / nf; f.push(fr);
      let t = 0, s = 0, d = 0;
      per.forEach((p, wi) => { t += W[wi] * interp(p.f, p.T, fr); s += W[wi] * interp(p.f, p.S, fr); d += W[wi] * (interp(p.f, p.DT, fr) + interp(p.f, p.DS, fr)) / 2; });
      T.push(t / Wt); Sg.push(s / Wt); DL.push(d / Wt);
    }
    return { f, T, S: Sg, DL, per };
  }

  function encircled(M, fi) {
    const ps = psf(M, fi, M.pw, 64, 256);
    const P = ps.P, h = P >> 1; let tot = 0; const rad = [];
    for (let y = 0; y < P; y++) for (let x = 0; x < P; x++) { const v = ps.I[y * P + x]; tot += v; rad.push([Math.hypot(x - h, y - h) * ps.dx, v]); }
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
  function binPSF(I, P, dx, p, phase = 'centre', nb = 9) {
    const h = P >> 1, off = phase === 'coin' ? 0 : 0.5, G = new Float64Array(nb * nb), c = nb >> 1; let tot = 0;
    for (let y = 0; y < P; y++) for (let x = 0; x < P; x++) {
      const v = I[y * P + x]; if (!v) continue; tot += v;
      const ix = Math.floor((x - h) * dx / p + off) + c, iy = Math.floor((y - h) * dx / p + off) + c;
      if (ix >= 0 && iy >= 0 && ix < nb && iy < nb) G[iy * nb + ix] += v;
    }
    for (let k = 0; k < G.length; k++) G[k] /= tot || 1;
    return { G, nb };
  }
  /** FTM d'un pixel (ouverture rectangulaire de largeur ff·p) */
  const detMTF = (f, p, ff = 1) => { const a = Math.PI * f * p * ff; return a < 1e-9 ? 1 : Math.abs(Math.sin(a) / a); };

  /* ---------------- Fibres optiques ---------------- */
  /** grandeurs d'une fibre à la longueur d'onde l (µm) : V, coupure, MFD (Marcuse), nombre de modes, régime */
  function fiberInfo(fb, l) {
    const a = (+fb.core || 0) / 2, na = +fb.na || 0, V = 2 * Math.PI * a * na / l, lc = 2 * Math.PI * a * na / 2.405;
    const w = V > 0 ? a * (0.65 + 1.619 * Math.pow(V, -1.5) + 2.879 * Math.pow(V, -6)) : NaN;
    const mfd = fb.fib === 'sm' && +fb.mfd > 0 ? +fb.mfd : 2 * w;
    const modes = fb.fib === 'gi' ? V * V / 4 : V * V / 2;
    return { V, lc, mfd, modes: V < 2.405 ? 1 : Math.round(modes), single: V < 2.405, etendue: Math.PI * a * a * Math.PI * na * na };
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
  function binImage(img, Q, pq, p, cx, cy, nb = 9, phase = 'centre') {
    const h = Q >> 1, off = phase === 'coin' ? 0 : 0.5, c = nb >> 1, G = new Float64Array(nb * nb); let tot = 0;
    for (let j = 0; j < Q; j++) for (let i = 0; i < Q; i++) {
      const v = img[j * Q + i]; if (!v) continue; tot += v;
      const ix = Math.floor(((i - h) * pq - cx) / p + off) + c, iy = Math.floor(((j - h) * pq - cy) / p + off) + c;
      if (ix >= 0 && iy >= 0 && ix < nb && iy < nb) G[iy * nb + ix] += v;
    }
    for (let k = 0; k < G.length; k++) G[k] /= tot || 1;
    return { G, nb };
  }

  /* ---------------- Optimisation (moindres carrés amortis) ---------------- */
  /**
   * Opérandes de la fonction de mérite. kind = contrainte par défaut (eq : égal, ge : ≥ cible, le : ≤ cible),
   * modifiable par opérande (op.cmp). list : contrainte appliquée à chaque élément (épaisseurs). p : paramètre.
   */
  const OPS = {
    EFL: { label: 'Focale (EFL)', kind: 'eq', u: 'mm' }, WFNO: { label: 'F/# de travail (paraxial)', kind: 'eq' },
    TTL: { label: 'Longueur totale (1ʳᵉ surface → image)', kind: 'eq', u: 'mm' }, BFL: { label: 'Distance image paraxiale (dernière surface → foyer)', kind: 'eq', u: 'mm' },
    PMAG: { label: 'Grandissement paraxial', kind: 'eq' }, IMGH: { label: 'Hauteur image paraxiale (champ max)', kind: 'eq', u: 'mm' },
    RIMH: { label: 'Hauteur image réelle (rayon principal, champ max)', kind: 'eq', u: 'mm' },
    DIST: { label: 'Distorsion réelle au champ max', kind: 'eq', u: '%' },
    AXCL: { label: 'Chromatisme axial (foyer λmax − λmin)', kind: 'eq', u: 'mm' }, LACL: { label: 'Chromatisme latéral (λmax − λmin, champ max)', kind: 'eq', u: 'mm' },
    SPHA: { label: 'Sphérique de Seidel W040', kind: 'eq', u: 'λ' }, COMA: { label: 'Coma de Seidel W131', kind: 'eq', u: 'λ' },
    ASTI: { label: 'Astigmatisme de Seidel W222', kind: 'eq', u: 'λ' }, FCUR: { label: 'Courbure de champ (Petzval) W220', kind: 'eq', u: 'λ' },
    MTFA: { label: 'FTM moyenne T/S à une fréquence', kind: 'ge', p: 'cycles/mm', pdef: 30 },
    MNCT: { label: 'Épaisseur centre verre min', kind: 'ge', u: 'mm', list: 1 }, MXCT: { label: 'Épaisseur centre verre max', kind: 'le', u: 'mm', list: 1 },
    MNET: { label: 'Épaisseur bord verre min', kind: 'ge', u: 'mm', list: 1 }, MXET: { label: 'Épaisseur bord verre max', kind: 'le', u: 'mm', list: 1 },
    MNCA: { label: 'Espace d\'air centre min', kind: 'ge', u: 'mm', list: 1 }, MXCA: { label: 'Espace d\'air centre max', kind: 'le', u: 'mm', list: 1 },
    MNEA: { label: 'Espace d\'air bord min', kind: 'ge', u: 'mm', list: 1 },
    RGLA: { label: 'Verre modèle réaliste (écart au verre réel le plus proche)', kind: 'le', list: 1 },
  };
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
    const r = residuals(st.sys); return { sys: st.sys, m: r ? meritOf(r.f) : Infinity };
  }
  const ASPH = ASPK;
  function getVars(sys) {
    const v = [];
    sys.surfaces.forEach((s, i) => {
      if (s.vr) v.push({ si: i, kind: 'c' });
      if (s.vt && s.tsolve !== 'M') v.push({ si: i, kind: 't' });
      if (s.vk) v.push({ si: i, kind: 'k' });
      for (const a of ASPH) if (s['v' + a]) v.push({ si: i, kind: a });
      if (s.vg && !isMirror(s) && parseModel(s.glass)) { v.push({ si: i, kind: 'nd' }); v.push({ si: i, kind: 'vd' }); }
    });
    return v;
  }
  function getVal(sys, v) { const s = sys.surfaces[v.si]; if (v.kind === 'nd' || v.kind === 'vd') return (parseModel(s.glass) || {})[v.kind]; return v.kind === 'c' ? curv(s) : v.kind === 't' ? s.t : v.kind === 'k' ? (s.k || 0) : (+s[v.kind] || 0); }
  function setVal(sys, v, x) {
    const s = sys.surfaces[v.si];
    if (v.kind === 'nd' || v.kind === 'vd') { const m = parseModel(s.glass) || { nd: 1.5, vd: 60 }; m[v.kind] = v.kind === 'nd' ? Math.min(2.2, Math.max(1.35, x)) : Math.min(100, Math.max(15, x)); s.glass = fmtModel(m.nd, m.vd); return; }
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
  /** valeur d'un opérande : { val } ou { list } */
  function opValue(M, op) {
    const S = M.S, N = M.N, sys = M.sys, wl = M.wls;
    const sagAt = (j, r) => { const s = M.ctxs[M.pw].s[j]; const v = sag(s, 0, r); return isFinite(v) ? v : 0; };
    const chief = wi => { const fy = M.par.fmax; const c = ray(M, wi, { x: 0, y: fy }, 0, 0); return c.vig ? NaN : c.y; };
    const lmin = wl.indexOf(Math.min(...wl)), lmax = wl.indexOf(Math.max(...wl));
    const edge = (j, k) => { const r = Math.max(S[j].sd, S[k].sd); return S[j].t + sagAt(k, r) - sagAt(j, r); };
    const list = [];
    switch (op.type) {
      case 'EFL': return { val: M.par.efl };
      case 'WFNO': return { val: M.par.wfno };
      case 'TTL': return { val: M.par.ttl };
      case 'BFL': return { val: M.par.imgDist };
      case 'PMAG': return { val: M.par.mag };
      case 'IMGH': return { val: M.par.imgH };
      case 'RIMH': return { val: chief(M.pw) };
      case 'DIST': { const fy = M.par.fmax, c = ray(M, M.pw, { x: 0, y: fy }, 0, 0); const yp = M.objInf ? M.par.unitImgH * Math.tan(fy * DEG) : M.par.unitImgH * fy; return { val: c.vig ? 0 : 100 * (c.y - yp) / yp }; }
      case 'AXCL': { if (lmin === lmax) return { val: 0 }; const d = l => paraxial(sys, indices(S, l), M.stopIdx, M.objInf).imgDist; return { val: d(wl[lmax]) - d(wl[lmin]) }; }
      case 'LACL': return { val: lmin === lmax ? 0 : chief(lmax) - chief(lmin) };
      case 'SPHA': case 'COMA': case 'ASTI': case 'FCUR': { const sd = seidel(M).sum, lm = M.ctxs[M.pw].lmm;
        return { val: op.type === 'SPHA' ? sd.SI / 8 / lm : op.type === 'COMA' ? sd.SII / 2 / lm : op.type === 'ASTI' ? sd.SIII / 2 / lm : sd.SIV / 4 / lm }; }
      case 'MTFA': return { val: criterion(M, 'MTF', { mtfF: +op.p > 0 ? +op.p : 30 }) };
      case 'MNCT': case 'MXCT': for (let j = 1; j < N - 1; j++) if (!isAir(S[j].glass) && !isMirror(S[j])) list.push(Math.abs(S[j].t)); break;
      case 'MNCA': case 'MXCA': for (let j = 1; j < N - 1; j++) if (isAir(S[j].glass) && !isMirror(S[j]) && S[j].tsolve !== 'M') list.push(Math.abs(S[j].t)); break;
      case 'MNET': case 'MXET': for (let j = 1; j < N - 1; j++) if (!isAir(S[j].glass) && !isMirror(S[j])) list.push(edge(j, j + 1)); break;
      case 'RGLA': { const o = (sys.merit && sys.merit.gsub) || {}; for (let j = 1; j < N; j++) if (S[j].vg) { const m = parseModel(S[j].glass); if (m) list.push(glassNearest(m.nd, m.vd, { ...o, k: 1 })[0]?.d ?? 0); } break; }
      case 'MNEA': for (let j = 1; j < N - 1; j++) if (isAir(S[j].glass) && !isMirror(S[j]) && S[j].tsolve !== 'M' && j + 1 < N) list.push(edge(j, j + 1)); break;
    }
    return { list };
  }
  /** résidus de la fonction de mérite (critère image + opérandes) ; parts = valeur et part de chaque opérande */
  function residuals(sys) {
    const M = prepare(sys);
    if (!M.ok) return null;
    const f = [];
    const mf = sys.merit || { image: 'SPOT', ops: [] };
    const F = sys.fields, Wl = sys.wavelengths, sel = wlSel(sys, mf.wl);
    const fw = F.map(x => x.w ?? 1); let ww = Wl.map((x, i) => sel.includes(i) ? (x.w ?? 1) : 0);
    if (!ww.some(v => v > 0)) ww = Wl.map((_, i) => sel.includes(i) ? 1 : 0);
    const nArm = 8;
    const ray0 = [];
    for (const [r, w] of GQ) for (let a = 0; a < nArm; a++) { const th = 2 * Math.PI * (a + 0.5) / nArm; ray0.push([r * Math.cos(th), r * Math.sin(th), w / nArm]); }
    if (mf.image === 'SPOT' || mf.image === 'WFE') {
      const Wsum = fw.reduce((a, b) => a + b, 0) * ww.reduce((a, b) => a + b, 0);
      F.forEach((fd, fi) => {
        if (mf.image === 'SPOT') {
          const rs = [];
          let sx = 0, sy = 0, sw = 0;
          sel.forEach(wi => ray0.forEach(([px, py, w]) => { const r = ray(M, wi, fd, px, py); rs.push([r, wi, w]); if (!r.vig) { sx += ww[wi] * w * r.x; sy += ww[wi] * w * r.y; sw += ww[wi] * w; } }));
          const cx = sx / sw, cy = sy / sw;
          for (const [r, wi, w] of rs) { const k = Math.sqrt(fw[fi] * ww[wi] * w / Wsum); if (r.vig) { f.push(k * 1, k * 1); } else { f.push(k * (r.x - cx), k * (r.y - cy)); } }
        } else {
          sel.forEach(wi => {
            const ref = opdRef(M, wi, fd); const vals = [];
            ray0.forEach(([px, py, w]) => vals.push([ref ? ref.W(ray(M, wi, fd, px, py)) : NaN, w]));
            let m = 0, s = 0; vals.forEach(([v, w]) => { if (isFinite(v)) { m += v * w; s += w; } }); m /= s || 1;
            vals.forEach(([v, w]) => { const k = Math.sqrt(fw[fi] * ww[wi] * w / Wsum) * M.ctxs[wi].lmm; f.push(isFinite(v) ? k * (v - m) : k * 10); });
          });
        }
      });
    }
    let img2 = 0; for (const v of f) img2 += v * v;
    const parts = [];
    (mf.ops || []).forEach((op, oi) => {
      const w = +op.weight || 0, tg = +op.target || 0, def = OPS[op.type]; if (!def) return;
      const cmp = op.cmp || def.kind, o = opValue(M, op), n0 = f.length;
      const res = v => cmp === 'ge' ? Math.max(0, tg - v) : cmp === 'le' ? Math.max(0, v - tg) : v - tg;
      let shown = o.val;
      if (o.val != null) { if (w) f.push(w * res(o.val)); }
      else if (o.list && o.list.length) { shown = cmp === 'le' ? Math.max(...o.list) : Math.min(...o.list); if (w) for (const v of o.list) f.push(w * res(v)); }
      let r2 = 0; for (let k = n0; k < f.length; k++) r2 += f[k] * f[k];
      parts.push({ i: oi, val: shown, r2, ok: cmp === 'eq' || shown == null || !isFinite(shown) ? null : res(shown) <= 1e-9 + 1e-6 * Math.abs(tg) });
    });
    return { f, M, img2, parts };
  }
  const meritOf = f => Math.sqrt(f.reduce((a, b) => a + b * b, 0));
  function optStep(state) {
    const { sys } = state, vars = getVars(sys);
    if (!vars.length) return { done: true, msg: 'Aucune variable' };
    const r0 = residuals(sys); if (!r0) return { done: true, msg: 'Système invalide' };
    const f0 = r0.f, m0 = meritOf(f0), nv = vars.length, nf = f0.length;
    const x0 = vars.map(v => getVal(sys, v));
    const J = [];
    for (let k = 0; k < nv; k++) {
      const v = vars[k], sdv = Math.max(1e-3, r0.M.S[v.si].sd || 1), h = v.kind === 'c' ? Math.max(1e-7, Math.abs(x0[k]) * 1e-5) : v.kind === 't' || v.kind === 'k' ? 1e-4 : v.kind === 'nd' ? 1e-5 : v.kind === 'vd' ? 1e-3 : 1e-6 / Math.pow(sdv, +v.kind.slice(1));
      const s2 = structuredClone(sys); setVal(s2, v, x0[k] + h);
      const r = residuals(s2); const col = new Float64Array(nf);
      if (r && r.f.length === nf) for (let i = 0; i < nf; i++) col[i] = (r.f[i] - f0[i]) / h;
      J.push(col);
    }
    const JtJ = Array.from({ length: nv }, (_, a) => Array.from({ length: nv }, (_, b) => { let s = 0; for (let i = 0; i < nf; i++) s += J[a][i] * J[b][i]; return s; }));
    const Jtf = Array.from({ length: nv }, (_, a) => { let s = 0; for (let i = 0; i < nf; i++) s += J[a][i] * f0[i]; return s; });
    let mu = state.mu ?? 1e-3;
    for (let tr = 0; tr < 10; tr++) {
      const A = JtJ.map((row, a) => row.map((v, b) => a === b ? v * (1 + mu) + 1e-18 : v));
      const dx = solveLin(A, Jtf.map(v => -v));
      if (dx) {
        const s2 = structuredClone(sys); vars.forEach((v, k) => setVal(s2, v, x0[k] + dx[k]));
        const r = residuals(s2);
        if (r && r.f.length === nf) {
          const m1 = meritOf(r.f);
          if (m1 < m0) { state.sys = s2; state.mu = Math.max(1e-9, mu / 4); state.merit = m1; return { done: (m0 - m1) / m0 < 1e-7, merit: m1 }; }
        }
      }
      mu *= 6;
    }
    state.mu = mu; state.merit = m0;
    return { done: true, merit: m0, msg: 'Minimum local atteint' };
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
    const M = prepare(sys), s = structuredClone(sys);
    if (M.ok) s.surfaces.forEach((x, j) => { x.t = M.S[j].t; x.tsolve = ''; });
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
    if (s.type !== 'XY') { s.type = 'XY'; s.xy = {}; } else s.xy = { ...(s.xy || {}) };
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
  function mtfAt(M, f, nu) {
    const W = M.sys.wavelengths.map(w => w.w ?? 1); let acc = 0, ws = 0;
    M.wls.forEach((_, wi) => {
      const N = 32, P = 128, p = psf(M, f, wi, N, P), fc = 1 / (M.ctxs[wi].lmm * M.par.wfno);
      let v = 0;
      if (nu < fc && p.wf.ok) {
        const re = Float64Array.from(p.I), im = new Float64Array(P * P); fft2(re, im, P, false);
        const mag = (x, y) => Math.hypot(re[y * P + x], im[y * P + x]), m0 = mag(0, 0) || 1, k = nu / (fc / N), k0 = Math.floor(k), t = k - k0;
        const T = (1 - t) * mag(0, k0 % P) + t * mag(0, (k0 + 1) % P), Sg = (1 - t) * mag(k0 % P, 0) + t * mag((k0 + 1) % P, 0);
        v = (T + Sg) / 2 / m0;
      }
      acc += W[wi] * v; ws += W[wi];
    });
    return acc / (ws || 1);
  }
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

  return { DEG, fiberInfo, binPSF, detMTF, extSource, binImage, imageSim, polPupil, polOut, POLSTATES, TOLT, TOLC, LT, quickFocus, wlSel, opValue, parseModel, fmtModel, glassNearest, glassPool, toModel, subTry, tolBase, tolDefaults, tolFreeze, tolItems, tolGen, tolApplicable, tolLabel, tolApply, tolWorse, tolSens, tolInverse, tolTrial, tolRebuild, tolValue, niceDown, rng, mtfAt, compensate, criterion, bestFocus, tolEval, focusStep, tolDraw, frames, toGlobal, mv, sGrad, fieldDir, catalog, glassN, glassRecord, addGlasses, parseAGF, cats: () => [...CATS], dispN, glassInfo, glassKey, isMirror, isAir, curv, sag, prepare, ray, trace, spot, rayFan, opdFan,
    wavefront, psf, psfGrid, mtf, mtfDL, encircled, footprint, fieldCurves, seidel, chromShift, ZN, zernBasis,
    OPS, getVars, residuals, meritOf, optStep, pupilGrid, indices, paraxial,
    ASPK, FTYPES, vigMap, setVignetting, convertFields, thermalScan, glassTherm, nAir, envN, envCtx, isSolid };
})();
if (typeof module !== 'undefined') module.exports = OE;
