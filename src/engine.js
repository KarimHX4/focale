'use strict';
/* =====================================================================
   FOCALE — moteur optique (tracé séquentiel réel + paraxial + diffraction)
   Conventions : unités mm, longueurs d'onde en µm, axe optique z,
   champ dans le plan YZ, convention de signes type Zemax/CODE V
   (épaisseurs négatives après un miroir).
   ===================================================================== */
const OE = (() => {
  const DEG = Math.PI / 180;

  /* ---------------- Catalogue de verres (Sellmeier B1,B2,B3,C1,C2,C3) ---------------- */
  const GL = {
    'N-BK7':  [1.03961212, 0.231792344, 1.01046945, 0.00600069867, 0.0200179144, 103.560653],
    'N-K5':   [1.08511833, 0.199562005, 0.930511663, 0.00661099503, 0.024110866, 111.982777],
    'N-BAK1': [1.12365662, 0.309276848, 0.881511957, 0.00644742752, 0.0222284402, 107.297751],
    'N-BAK4': [1.28834642, 0.132817724, 0.945395373, 0.00779980626, 0.0315631177, 105.965875],
    'N-SK16': [1.34317774, 0.241144399, 0.994317969, 0.00704687339, 0.0229005, 92.7508526],
    'N-FK51A':[0.971247817, 0.216901417, 0.904651666, 0.00472301995, 0.0153575612, 168.68133],
    'N-BAF10':[1.5851495, 0.143559385, 1.08521269, 0.00926681282, 0.0424489805, 105.613573],
    'N-LAK9': [1.46231905, 0.344399589, 1.15508372, 0.00724270156, 0.0243353131, 85.4686868],
    'N-LASF9':[2.00029547, 0.298926886, 1.80691843, 0.0121426017, 0.0538736236, 156.530829],
    'F2':     [1.34533359, 0.209073176, 0.937357162, 0.00997743871, 0.0470450767, 111.886764],
    'N-F2':   [1.39757037, 0.159201403, 1.2686543, 0.00995906143, 0.0546931752, 119.248346],
    'SF2':    [1.40301821, 0.231767504, 0.939056586, 0.0105795466, 0.0493226978, 112.405955],
    'N-SF5':  [1.52481889, 0.187085527, 1.42729015, 0.011254756, 0.0588995392, 129.141675],
    'N-SF6':  [1.77931763, 0.338149866, 2.08734474, 0.0133714182, 0.0617533621, 174.01759],
    'N-SF10': [1.62153902, 0.256287842, 1.64447552, 0.0122241457, 0.0595736775, 147.468793],
    'N-SF11': [1.73759695, 0.313747346, 1.89878101, 0.013188707, 0.0623068142, 155.23629],
    'N-SF57': [1.87543831, 0.37375749, 2.30001797, 0.0141749518, 0.0640509927, 177.389795],
    'F_SILICA':[0.6961663, 0.4079426, 0.8974794, 0.004679148, 0.01351206, 97.934003],
    'CAF2':   [0.5675888, 0.4710914, 3.8484723, 0.00252643, 0.01007833, 1200.5560],
  };
  const ALIAS = { 'BK7': 'N-BK7', 'SK16': 'N-SK16', 'SF5': 'N-SF5', 'SF6': 'N-SF6', 'SF11': 'N-SF11',
    'LAK9': 'N-LAK9', 'LASF9': 'N-LASF9', 'BAK1': 'N-BAK1', 'BAK4': 'N-BAK4', 'K5': 'N-K5',
    'SILICA': 'F_SILICA', 'FUSED_SILICA': 'F_SILICA', 'SIO2': 'F_SILICA', 'FK51A': 'N-FK51A', 'BAF10': 'N-BAF10', 'SF10': 'N-SF10', 'SF57': 'N-SF57' };

  function sellmeier(B, l) {
    const l2 = l * l;
    return Math.sqrt(1 + B[0] * l2 / (l2 - B[3]) + B[1] * l2 / (l2 - B[4]) + B[2] * l2 / (l2 - B[5]));
  }
  function glassKey(name) {
    const u = (name || '').trim().toUpperCase();
    return GL[u] ? u : (ALIAS[u] && GL[ALIAS[u]] ? ALIAS[u] : null);
  }
  function isMirror(s) { return (s.glass || '').trim().toUpperCase() === 'MIRROR'; }
  function isAir(name) { const u = (name || '').trim().toUpperCase(); return u === '' || u === 'AIR'; }
  /** indice d'un milieu ; NaN si verre inconnu */
  function glassN(name, l) {
    if (isAir(name)) return 1;
    const k = glassKey(name);
    if (k) return sellmeier(GL[k], l);
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
  function glassInfo(name) {
    const nd = glassN(name, 0.5875618), nF = glassN(name, 0.4861327), nC = glassN(name, 0.6562725);
    return { nd, vd: (nd - 1) / (nF - nC) };
  }
  const catalog = () => Object.keys(GL).map(k => ({ name: k, ...glassInfo(k) }));

  /* ---------------- Surfaces ---------------- */
  const curv = s => (isFinite(s.r) && s.r !== 0) ? 1 / s.r : 0;
  function sag(sf, r2) {
    const c = sf.c; let z = 0;
    if (c !== 0) {
      const a = 1 - (1 + sf.k) * c * c * r2;
      if (a < 0) return NaN;
      z = c * r2 / (1 + Math.sqrt(a));
    }
    if (sf.asph) z += r2 * r2 * (sf.a4 + r2 * (sf.a6 + r2 * (sf.a8 + r2 * sf.a10)));
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
    if (sf.asph) g += r2 * (4 * sf.a4 + r2 * (6 * sf.a6 + r2 * (8 * sf.a8 + r2 * 10 * sf.a10)));
    return g;
  }

  /** indices signés (paraxial) pour une longueur d'onde */
  function indices(S, l) {
    const n = new Array(S.length);
    n[0] = glassN(S[0].glass, l);
    let sg = 1;
    for (let j = 1; j < S.length; j++) {
      if (isMirror(S[j])) { sg = -sg; n[j] = sg * Math.abs(n[j - 1]); }
      else n[j] = sg * glassN(S[j].glass, l);
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
    }
    return { y, nu };
  }
  function maxField(sys) { return Math.max(1e-9, ...sys.fields.map(f => Math.abs(f.y))); }

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
    if (ap.type === 'FNO') epd = objInf ? Math.abs(efl) / ap.value : epd;
    if (ap.type === 'NA' && !objInf) {
      const um = Math.asin(Math.min(0.9999, ap.value / Math.abs(n[0])));
      epd = 2 * Math.tan(um) * Math.abs(zE + t0);
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

  /* ---------------- Préparation du modèle ---------------- */
  function prepare(sys0) {
    const sys = structuredClone(sys0);
    const S = sys.surfaces, N = S.length - 1;
    for (const s of S) { s.k = +s.k || 0; s.a4 = +s.a4 || 0; s.a6 = +s.a6 || 0; s.a8 = +s.a8 || 0; s.a10 = +s.a10 || 0; s.sd = +s.sd || 0; }
    const wls = sys.wavelengths.map(w => w.um);
    const pw = Math.min(Math.max(0, sys.primary | 0), wls.length - 1);
    let stopIdx = S.findIndex(s => s.stop); if (stopIdx < 1 || stopIdx >= N) stopIdx = 1;
    const objInf = !isFinite(S[0].t) || Math.abs(S[0].t) > 1e10;
    const nW = wls.map(l => indices(S, l));
    const errors = [];
    nW.forEach((n, wi) => n.forEach((v, j) => { if (!isFinite(v)) errors.push(`Verre inconnu « ${S[j].glass} » (surface ${j})`); }));
    if (errors.length) return { sys, errors: [...new Set(errors)], ok: false };
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
    const zg = new Float64Array(N + 1);
    for (let j = 2; j <= N; j++) zg[j] = zg[j - 1] + S[j - 1].t;
    const ctxs = wls.map((l, wi) => {
      const n = nW[wi];
      return {
        wi, l, lmm: l * 1e-3, n, nAbs: n.map(Math.abs),
        s: S.map(s => ({ c: curv(s), k: s.k, a4: s.a4, a6: s.a6, a8: s.a8, a10: s.a10,
          asph: !!(s.a4 || s.a6 || s.a8 || s.a10), t: s.t, mirror: isMirror(s), sd: s.sd, clip: !!s.sdFixed })),
      };
    });
    const M = { sys, S, N, wls, pw, stopIdx, objInf, nW, par, zg, ctxs, aimCache: new Map(), ok: true, errors: [],
      t0: objInf ? 0 : S[0].t, obs: Math.max(0, Math.min(0.95, +sys.aperture.obscuration || 0)) };
    M.epr = par.epd / 2;
    computeSD(M);
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
        const px = x + t * L, py = y + t * Mm, pz = z + t * Nn, r2 = px * px + py * py;
        const f = pz - sag(sf, r2), g = sagG(sf, r2);
        if (!isFinite(f) || !isFinite(g)) return NaN;
        const fp = Nn - g * (px * L + py * Mm);
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
    const upto = opts.upto ?? M.N, pts = opts.pts, clip = !opts.noClip;
    let x = p[0], y = p[1], z = p[2], L = d[0], Mm = d[1], Nn = d[2], opl = opl0;
    for (let j = 1; j <= upto; j++) {
      const sf = ctx.s[j];
      const t = intersect(sf, x, y, z, L, Mm, Nn);
      if (!isFinite(t)) return { vig: j, why: 'miss' };
      x += t * L; y += t * Mm; z += t * Nn;
      opl += ctx.nAbs[j - 1] * t;
      if (clip && sf.clip && x * x + y * y > sf.sd * sf.sd * (1 + 1e-9)) return { vig: j, why: 'clip' };
      if (pts) pts.push([x, y, z + M.zg[j]]);
      if (j < M.N) {
        // normale
        const r2 = x * x + y * y; const g = sagG(sf, r2);
        let nx = -x * g, ny = -y * g, nz = 1;
        const nn = Math.hypot(nx, ny, nz); nx /= nn; ny /= nn; nz /= nn;
        let cosI = -(L * nx + Mm * ny + Nn * nz);
        if (cosI < 0) { nx = -nx; ny = -ny; nz = -nz; cosI = -cosI; }
        if (sf.mirror) { L += 2 * cosI * nx; Mm += 2 * cosI * ny; Nn += 2 * cosI * nz; }
        else {
          const mu = ctx.nAbs[j - 1] / ctx.nAbs[j];
          const k = 1 - mu * mu * (1 - cosI * cosI);
          if (k < 0) return { vig: j, why: 'tir' };
          const a = mu * cosI - Math.sqrt(k);
          L = mu * L + a * nx; Mm = mu * Mm + a * ny; Nn = mu * Nn + a * nz;
        }
        const dn = Math.hypot(L, Mm, Nn); L /= dn; Mm /= dn; Nn /= dn;
        z -= sf.t;
      }
    }
    return { vig: 0, x, y, z, L, M: Mm, N: Nn, opl };
  }

  /** point de départ d'un rayon visant (ax, ay) dans le plan de la pupille d'entrée */
  function startAt(M, ctx, fy, ax, ay) {
    if (M.objInf) {
      const th = fy * DEG;
      return { p: [ax, ay, M.par.zE], d: [0, Math.sin(th), Math.cos(th)] };
    }
    const ox = 0, oy = fy, oz = -M.t0;
    let dx = ax - ox, dy = ay - oy, dz = M.par.zE - oz;
    const dn = Math.hypot(dx, dy, dz) * Math.sign(dz || 1);
    return { p: [ox, oy, oz], d: [dx / dn, dy / dn, dz / dn] };
  }
  function aimRay(M, ctx, fy, px, py) {
    let ax = px * M.epr, ay = py * M.epr;
    if (!M.sys.rayAiming) return [ax, ay];
    const tx = px * M.par.stopR, ty = py * M.par.stopR;
    const h = 1e-6 * Math.max(1, M.epr);
    const f = (a, b) => { const s = startAt(M, ctx, fy, a, b); const r = trace(M, ctx, s.p, s.d, 0, { upto: M.stopIdx, noClip: true }); return r.vig ? null : [r.x - tx, r.y - ty]; };
    // départ : visée du rayon principal en cache
    const key = fy + '|' + ctx.wi;
    const c0 = M.aimCache.get(key);
    if (c0) { ax += c0[0]; ay += c0[1]; }
    for (let it = 0; it < 15; it++) {
      const e = f(ax, ay); if (!e) return [px * M.epr, py * M.epr];
      if (Math.hypot(e[0], e[1]) < 1e-11 * Math.max(1, M.par.stopR)) break;
      const ex = f(ax + h, ay), ey = f(ax, ay + h); if (!ex || !ey) break;
      const j11 = (ex[0] - e[0]) / h, j21 = (ex[1] - e[1]) / h, j12 = (ey[0] - e[0]) / h, j22 = (ey[1] - e[1]) / h;
      const det = j11 * j22 - j12 * j21; if (Math.abs(det) < 1e-20) break;
      ax -= (j22 * e[0] - j12 * e[1]) / det; ay -= (-j21 * e[0] + j11 * e[1]) / det;
    }
    return [ax, ay];
  }
  function chiefAim(M, ctx, fy) {
    const key = fy + '|' + ctx.wi;
    if (!M.sys.rayAiming) return [0, 0];
    if (M.aimCache.has(key)) return M.aimCache.get(key);
    const a = aimRay(M, ctx, fy, 0, 0); M.aimCache.set(key, a); return a;
  }
  /** rayon réel pour un champ (valeur y) et une pupille normalisée */
  function ray(M, wi, fy, px, py, opts) {
    const ctx = M.ctxs[wi];
    const ca = chiefAim(M, ctx, fy);
    const a = (px === 0 && py === 0) ? ca : aimRay(M, ctx, fy, px, py);
    const s = startAt(M, ctx, fy, a[0], a[1]);
    let opl0 = 0;
    if (M.objInf) opl0 = ctx.nAbs[0] * ((a[0] - ca[0]) * s.d[0] + (a[1] - ca[1]) * s.d[1]);
    return trace(M, ctx, s.p, s.d, opl0, opts);
  }

  function computeSD(M) {
    const S = M.S, N = M.N, mx = new Float64Array(N + 1);
    const nA = 24;
    for (const f of M.sys.fields) for (let wi = 0; wi < M.wls.length; wi++) {
      for (let k = -1; k < nA; k++) {
        const px = k < 0 ? 0 : Math.cos(2 * Math.PI * k / nA), py = k < 0 ? 0 : Math.sin(2 * Math.PI * k / nA);
        const pts = [];
        const r = ray(M, wi, f.y, px, py, { pts, noClip: true });
        pts.forEach((p, i) => { const rr = Math.hypot(p[0], p[1]); if (rr > mx[i + 1]) mx[i + 1] = rr; });
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
      return (r.opl + nI * s - ref) / lmm;
    };
    return { chief: c, W, R };
  }

  /* ---------------- Analyses ---------------- */
  function spot(M, fi, n = 21, wsel = null) {
    const fy = M.sys.fields[fi].y, pts = [], grid = pupilGrid(n, M.obs);
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
    const fy = M.sys.fields[fi].y;
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
    const fy = M.sys.fields[fi].y, out = [];
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
  function wavefront(M, fi, wi, N = 64, removeTilt = true) {
    const fy = M.sys.fields[fi].y, ref = opdRef(M, wi, fy);
    const W = new Float64Array(N * N).fill(NaN);
    if (!ref) return { N, W, rms: NaN, pv: NaN, zern: [], ok: false };
    const samples = [];
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const px = -1 + (2 * j + 1) / N, py = -1 + (2 * i + 1) / N;
      const r = Math.hypot(px, py); if (r > 1 || r < M.obs) continue;
      const w = ref.W(ray(M, wi, fy, px, py));
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
  function psf(M, fi, wi, N = 64, P = 256) {
    const wf = wavefront(M, fi, wi, N, false);
    const re = new Float64Array(P * P), im = new Float64Array(P * P);
    const o = (P - N) >> 1; let sa = 0;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const w = wf.W[i * N + j]; if (!isFinite(w)) continue;
      const ph = 2 * Math.PI * w; re[(i + o) * P + j + o] = Math.cos(ph); im[(i + o) * P + j + o] = Math.sin(ph); sa++;
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
  function mtfOne(M, fi, wi, N = 64, P = 256) {
    const p = psf(M, fi, wi, N, P);
    const re = Float64Array.from(p.I), im = new Float64Array(P * P);
    fft2(re, im, P, false);
    const mag = (x, y) => Math.hypot(re[y * P + x], im[y * P + x]);
    const m0 = mag(0, 0) || 1, fc = 1 / (M.ctxs[wi].lmm * M.par.wfno), f = [], T = [], Sg = [];
    for (let k = 0; k <= N; k++) { f.push(k * fc / N); T.push(mag(0, k % P) / m0); Sg.push(mag(k % P, 0) / m0); }
    return { f, T, S: Sg, fc, strehl: p.strehl };
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
      per.forEach((p, wi) => { t += W[wi] * interp(p.f, p.T, fr); s += W[wi] * interp(p.f, p.S, fr); d += W[wi] * mtfDL(fr / p.fc); });
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
        const P = []; const r = ray(M, M.pw, f.y, px, py, { pts: P, upto: si });
        if (!r.vig && P.length >= si) pts.push([P[si - 1][0], P[si - 1][1]]);
      }
      out.push({ fi, pts });
    });
    return { fields: out, sd: M.S[si].sd, si };
  }

  function fieldCurves(M, n = 30) {
    const fm = M.par.fmax, res = { f: [], dist: [], per: M.wls.map(() => ({ T: [], S: [] })) };
    const eps = 0.02;
    for (let i = 0; i <= n; i++) {
      const fy = fm * i / n; res.f.push(fy);
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
          const ypar = M.objInf ? M.par.unitImgH * Math.tan(fy * DEG) : M.par.unitImgH * fy;
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
    const ns = indices(S, ls), nl = indices(S, ll);
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
      const nn = indices(M.S, lam);
      const p = paraxial(M.sys, nn, M.stopIdx, M.objInf);
      dz.push((p.imgDist - ref) * 1000);
    }
    return { l, dz };
  }

  /* ---------------- Optimisation (moindres carrés amortis) ---------------- */
  const OPS = {
    EFL: { label: 'Focale (EFL)', kind: 'eq' }, WFNO: { label: 'F/# de travail', kind: 'eq' },
    TTL: { label: 'Longueur totale', kind: 'eq' }, BFL: { label: 'Tirage (BFL)', kind: 'eq' },
    DIST: { label: 'Distorsion max (%)', kind: 'eq' }, MNCT: { label: 'Épaisseur centre verre min', kind: 'ge' },
    MXCT: { label: 'Épaisseur centre verre max', kind: 'le' }, MNET: { label: 'Épaisseur bord verre min', kind: 'ge' },
    MNCA: { label: 'Espace d\'air centre min', kind: 'ge' },
  };
  function getVars(sys) {
    const v = [];
    sys.surfaces.forEach((s, i) => {
      if (s.vr) v.push({ si: i, kind: 'c' });
      if (s.vt && s.tsolve !== 'M') v.push({ si: i, kind: 't' });
      if (s.vk) v.push({ si: i, kind: 'k' });
    });
    return v;
  }
  function getVal(sys, v) { const s = sys.surfaces[v.si]; return v.kind === 'c' ? curv(s) : v.kind === 't' ? s.t : (s.k || 0); }
  function setVal(sys, v, x) {
    const s = sys.surfaces[v.si];
    if (v.kind === 'c') s.r = Math.abs(x) < 1e-12 ? Infinity : 1 / x; else if (v.kind === 't') s.t = x; else s.k = x;
  }
  const GQ = [[0.3357107, 5 / 18], [0.7071068, 8 / 18], [0.9419651, 5 / 18]];
  function residuals(sys) {
    const M = prepare(sys);
    if (!M.ok) return null;
    const f = [];
    const mf = sys.merit || { image: 'SPOT', ops: [] };
    const F = sys.fields, Wl = sys.wavelengths;
    const fw = F.map(x => x.w ?? 1), ww = Wl.map(x => x.w ?? 1);
    const nArm = 8;
    const ray0 = [];
    for (const [r, w] of GQ) for (let a = 0; a < nArm; a++) { const th = 2 * Math.PI * (a + 0.5) / nArm; ray0.push([r * Math.cos(th), r * Math.sin(th), w / nArm]); }
    if (mf.image === 'SPOT' || mf.image === 'WFE') {
      const Wsum = fw.reduce((a, b) => a + b, 0) * ww.reduce((a, b) => a + b, 0);
      F.forEach((fd, fi) => {
        if (mf.image === 'SPOT') {
          const rs = [];
          let sx = 0, sy = 0, sw = 0;
          Wl.forEach((_, wi) => ray0.forEach(([px, py, w]) => { const r = ray(M, wi, fd.y, px, py); rs.push([r, wi, w]); if (!r.vig) { sx += ww[wi] * w * r.x; sy += ww[wi] * w * r.y; sw += ww[wi] * w; } }));
          const cx = sx / sw, cy = sy / sw;
          for (const [r, wi, w] of rs) { const k = Math.sqrt(fw[fi] * ww[wi] * w / Wsum); if (r.vig) { f.push(k * 1, k * 1); } else { f.push(k * (r.x - cx), k * (r.y - cy)); } }
        } else {
          Wl.forEach((_, wi) => {
            const ref = opdRef(M, wi, fd.y); const vals = [];
            ray0.forEach(([px, py, w]) => vals.push([ref ? ref.W(ray(M, wi, fd.y, px, py)) : NaN, w]));
            let m = 0, s = 0; vals.forEach(([v, w]) => { if (isFinite(v)) { m += v * w; s += w; } }); m /= s || 1;
            vals.forEach(([v, w]) => { const k = Math.sqrt(fw[fi] * ww[wi] * w / Wsum) * M.ctxs[wi].lmm; f.push(isFinite(v) ? k * (v - m) : k * 10); });
          });
        }
      });
    }
    const S = M.S, N = M.N;
    const sagAt = (j, r) => { const s = M.ctxs[M.pw].s[j]; const v = sag(s, r * r); return isFinite(v) ? v : 0; };
    for (const op of (mf.ops || [])) {
      const w = +op.weight || 0, tg = +op.target || 0; if (!w) continue;
      let val = null; const list = [];
      switch (op.type) {
        case 'EFL': val = M.par.efl; break;
        case 'WFNO': val = M.par.wfno; break;
        case 'TTL': val = M.par.ttl; break;
        case 'BFL': val = M.par.imgDist; break;
        case 'DIST': { const fy = M.par.fmax, c = ray(M, M.pw, fy, 0, 0); const yp = M.objInf ? M.par.unitImgH * Math.tan(fy * DEG) : M.par.unitImgH * fy; val = c.vig ? 0 : 100 * (c.y - yp) / yp; break; }
        case 'MNCT': case 'MXCT': for (let j = 1; j < N - 1; j++) if (!isAir(S[j].glass) && !isMirror(S[j])) list.push(Math.abs(S[j].t)); break;
        case 'MNCA': for (let j = 1; j < N - 1; j++) if (isAir(S[j].glass) && !isMirror(S[j]) && S[j].tsolve !== 'M') list.push(Math.abs(S[j].t)); break;
        case 'MNET': for (let j = 1; j < N - 1; j++) if (!isAir(S[j].glass) && !isMirror(S[j])) { const r = Math.max(S[j].sd, S[j + 1].sd); list.push(S[j].t + sagAt(j + 1, r) - sagAt(j, r)); } break;
      }
      if (val != null) f.push(w * (val - tg));
      for (const v of list) {
        if (op.type === 'MXCT') f.push(w * Math.max(0, v - tg)); else f.push(w * Math.max(0, tg - v));
      }
    }
    return { f, M };
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
      const v = vars[k], h = v.kind === 'c' ? Math.max(1e-7, Math.abs(x0[k]) * 1e-5) : v.kind === 't' ? 1e-4 : 1e-4;
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

  return { DEG, GL, catalog, glassN, glassInfo, glassKey, isMirror, isAir, curv, sag, prepare, ray, trace, spot, rayFan, opdFan,
    wavefront, psf, mtf, mtfDL, encircled, footprint, fieldCurves, seidel, chromShift, ZN, zernBasis,
    OPS, getVars, residuals, meritOf, optStep, pupilGrid, indices, paraxial };
})();
if (typeof module !== 'undefined') module.exports = OE;
