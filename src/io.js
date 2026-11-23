'use strict';
/* =====================================================================
   FOCALE — import / export CODE V (.seq) et Zemax OpticStudio (.zmx)
   Chaque lecteur renvoie { sys, warnings } ; chaque écrivain { text, warnings }.
   ===================================================================== */
const IO = (() => {
  const E = typeof OE !== 'undefined' ? OE : require('./engine.js');
  const S0 = (o = {}) => ({ r: Infinity, t: 0, glass: '', sd: 0, sdFixed: false, k: 0, a4: 0, a6: 0, a8: 0, a10: 0, stop: false, comment: '',
    vr: false, vt: false, vk: false, tsolve: '', dx: 0, dy: 0, dz: 0, tx: 0, ty: 0, tz: 0, dmode: 'DEC', ...o });
  const isDec = s => !!(s.dx || s.dy || s.dz || s.tx || s.ty || s.tz);
  const baseSys = () => ({ title: '', aperture: { type: 'EPD', value: 10, obscuration: 0 }, fields: [], wavelengths: [], primary: 0, rayAiming: false,
    merit: { image: 'SPOT', ops: [] }, surfaces: [] });
  const num = v => { const x = parseFloat(String(v).replace(/,/g, '.')); return isFinite(x) ? x : NaN; };
  const g10 = v => (isFinite(v) ? +(+v).toPrecision(12) : 0);
  const fmtN = v => { if (!isFinite(v)) return '0'; const x = +(+v).toPrecision(12); return Math.abs(x) >= 1e-4 || x === 0 ? String(x) : x.toExponential(10); };

  /** décode un fichier (UTF-16 LE/BE avec ou sans BOM, UTF-8, Latin-1) */
  function decode(buf) {
    const b = new Uint8Array(buf);
    if (b.length >= 2 && b[0] === 0xFF && b[1] === 0xFE) return new TextDecoder('utf-16le').decode(b.subarray(2));
    if (b.length >= 2 && b[0] === 0xFE && b[1] === 0xFF) return new TextDecoder('utf-16be').decode(b.subarray(2));
    let z0 = 0, z1 = 0; const n = Math.min(b.length, 400);
    for (let i = 0; i < n; i++) if (!b[i]) (i % 2 ? z1++ : z0++);
    if (z1 > n / 6) return new TextDecoder('utf-16le').decode(b);
    if (z0 > n / 6) return new TextDecoder('utf-16be').decode(b);
    try { return new TextDecoder('utf-8', { fatal: true }).decode(b); } catch (e) { return new TextDecoder('iso-8859-1').decode(b); }
  }
  /** reconnaît le format d'un texte */
  function detect(name, t) {
    const ext = (String(name || '').match(/\.([a-z0-9]+)$/i) || [])[1];
    if (ext) { const e = ext.toLowerCase(); if (['zmx', 'seq', 'agf', 'json'].includes(e)) return e; }
    const s = String(t).trim();
    if (s.startsWith('{')) return 'json';
    if (/^\s*NM\s/m.test(s) && /^\s*CD\s/m.test(s)) return 'agf';
    if (/^\s*SURF\s+\d+/m.test(s) && /^\s*(VERS|MODE|UNIT)\b/m.test(s)) return 'zmx';
    return 'seq';
  }

  /* ---------------- verres ---------------- */
  /** nom de verre étranger → nom Focale (catalogue, modèle nd/νd ou nom inconnu) */
  function mapGlass(name, nd, vd, warnings, where) {
    if (!name) return '';
    let u = String(name).replace(/^['"]|['"]$/g, '').trim();
    const U = u.toUpperCase();
    if (U === 'MIRROR' || U === 'REFL') return 'MIRROR';
    if (U === 'AIR') return '';
    let k = E.glassKey(u);
    if (k) return k;
    const base = U.replace(/[_.](SCHOTT|OHARA|HOYA|SPECIAL|CDGM|SUMITA|HIKARI|MISC|INFRARED|CORNING)$/, '');
    k = E.glassKey(base) || (base[0] === 'N' && E.glassKey('N-' + base.slice(1))) || (base[0] === 'S' && E.glassKey('S-' + base.slice(1))) || (base[0] === 'H' && E.glassKey('H-' + base.slice(1)));
    if (k) return k;
    if (/SILICA|SIO2/.test(base)) return 'F_SILICA';
    // verre fictif saisi « nd:νd » (ou nd,νd) ou indice seul
    const nv = U.match(/^(1\.\d+)\s*[:,]\s*(\d+(?:\.\d+)?)$/); if (nv) return `${g10(+nv[1])}/${g10(+nv[2])}`;
    if (/^1\.\d+$/.test(U) && !/^\d{3,6}\.\d{2,6}$/.test(U)) return String(g10(+U));
    // code verre (CODE V / Zemax) : 517642, 517.642, 743972.448504 → nd = 1,743972, νd = 44,8504
    const code = U.match(/^(\d{3,6})\.(\d{2,6})$/) || U.match(/^(\d{3})(\d{3})$/);
    if (code) { const nd = 1 + (+code[1]) / Math.pow(10, code[1].length), vd = (+code[2]) / Math.pow(10, Math.max(0, code[2].length - 2));
      if (vd > 5 && vd < 120) { if (code[2].length > 3 && !warnings.some(w => w.startsWith('Verres fictifs'))) warnings.push('Verres fictifs CODE V (code nd.νd) convertis en verres modèles nd/νd — dispersion proche mais pas identique à celle de CODE V'); return `${g10(nd)}/${g10(vd)}`; } }
    if (isFinite(nd) && nd > 1) { warnings.push(`${where} : verre « ${u} » introuvable, remplacé par le modèle nd/νd ${nd}/${vd || '—'}`); return vd > 0 ? `${g10(nd)}/${g10(vd)}` : String(g10(nd)); }
    warnings.push(`${where} : verre « ${u} » introuvable (importez son catalogue AGF)`);
    return u;
  }
  /** ajuste une loi de Cauchy n = A + B/λ² + C/λ⁴ sur des couples (λ µm, n) */
  function fitCauchy(pts) {
    if (pts.length === 1) return [pts[0][1], 0, 0];
    const m = Math.min(3, pts.length), A = Array.from({ length: m }, () => new Array(m).fill(0)), b = new Array(m).fill(0);
    for (const [l, n] of pts) { const v = [1, 1 / (l * l), 1 / (l ** 4)].slice(0, m); for (let i = 0; i < m; i++) { b[i] += v[i] * n; for (let j = 0; j < m; j++) A[i][j] += v[i] * v[j]; } }
    for (let i = 0; i < m; i++) { let p = i; for (let k = i + 1; k < m; k++) if (Math.abs(A[k][i]) > Math.abs(A[p][i])) p = k; [A[i], A[p]] = [A[p], A[i]]; [b[i], b[p]] = [b[p], b[i]];
      for (let k = i + 1; k < m; k++) { const f = A[k][i] / A[i][i]; for (let j = i; j < m; j++) A[k][j] -= f * A[i][j]; b[k] -= f * b[i]; } }
    const x = new Array(m).fill(0); for (let i = m - 1; i >= 0; i--) { let s = b[i]; for (let j = i + 1; j < m; j++) s -= A[i][j] * x[j]; x[i] = s / A[i][i]; }
    while (x.length < 3) x.push(0); return x;
  }
  /** catalogue et nd/νd d'un verre Focale, pour l'export */
  function glassOut(g) {
    if (E.isAir(g)) return { kind: 'air' };
    if (String(g).trim().toUpperCase() === 'MIRROR') return { kind: 'mirror' };
    const r = E.glassRecord(g);
    const nd = E.glassN(g, 0.5875618), nF = E.glassN(g, 0.4861327), nC = E.glassN(g, 0.6562725), vd = (nd - 1) / (nF - nC);
    if (r) return { kind: 'cat', name: r.name, cat: r.cat === 'SPECIAL' ? 'MISC' : r.cat, nd, vd: isFinite(vd) ? vd : 0, user: !!r.user };
    return { kind: 'model', nd, vd: isFinite(vd) ? vd : 0 };
  }

  /* =====================================================================
     CODE V (.seq)
     ===================================================================== */
  /** commandes sans effet sur l'optique (identifiants, incréments de dérivée, préférences, affichage) : ignorées sans remarque */
  const SEQ_SILENT = new Set(['GO', 'INI', 'SPH', 'CON', 'END', 'INS', 'SAV', 'UID', 'DER', 'DOR', 'GCH', 'GLB', 'CAT', 'DDM', 'CUM', 'THM', 'RDM;LEN', 'VIE', 'PLO', 'WRL', 'OUT', 'EVA', 'WRI', 'IN', 'CA', 'APE', 'DEL', 'AUT', 'MFR', 'IFR', 'NBR', 'XOF', 'YOF', 'XRA', 'YRA', 'COL', 'DES', 'TOW', 'LIB', 'PTH', 'DIN', 'GBL', 'NUM', 'STR', 'VAR', 'FIL', 'FRZ', 'FIX', 'CLR', 'CFG']);
  /** commandes reconnues mais non modélisées : une remarque par commande */
  const SEQ_UNSUP = {
    ZOO: 'Système zoom / multi-configuration (ZOO) : seule la position 1 est importée',
    PIK: 'Reprises (PIK) non prises en charge : valeurs courantes conservées',
    PUY: 'Solve CODE V (PUY/PUX/PUC/PCY…) non pris en charge : valeur courante conservée', PUX: 'Solve CODE V (PUY/PUX/PUC/PCY…) non pris en charge : valeur courante conservée',
    PUC: 'Solve CODE V (PUY/PUX/PUC/PCY…) non pris en charge : valeur courante conservée', PCY: 'Solve CODE V (PUY/PUX/PUC/PCY…) non pris en charge : valeur courante conservée',
    CUX: 'Surfaces anamorphiques / toriques (CUX, RDX, CYL, XTO, YTO) : seul le profil Y est importé', RDX: 'Surfaces anamorphiques / toriques (CUX, RDX, CYL, XTO, YTO) : seul le profil Y est importé',
    CYL: 'Surfaces anamorphiques / toriques (CUX, RDX, CYL, XTO, YTO) : seul le profil Y est importé', XTO: 'Surfaces anamorphiques / toriques (CUX, RDX, CYL, XTO, YTO) : seul le profil Y est importé', YTO: 'Surfaces anamorphiques / toriques (CUX, RDX, CYL, XTO, YTO) : seul le profil Y est importé',
    DIF: 'Surfaces diffractives / hologrammes (DIF, HOE, HCO…) non prises en charge : surfaces importées sans leur phase', HOE: 'Surfaces diffractives / hologrammes (DIF, HOE, HCO…) non prises en charge : surfaces importées sans leur phase',
    HCO: 'Surfaces diffractives / hologrammes (DIF, HOE, HCO…) non prises en charge : surfaces importées sans leur phase', HOR: 'Surfaces diffractives / hologrammes (DIF, HOE, HCO…) non prises en charge : surfaces importées sans leur phase',
    HWL: 'Surfaces diffractives / hologrammes (DIF, HOE, HCO…) non prises en charge : surfaces importées sans leur phase', HCT: 'Surfaces diffractives / hologrammes (DIF, HOE, HCO…) non prises en charge : surfaces importées sans leur phase',
    RET: 'Retour de repère (RET) non pris en charge : vérifiez les surfaces décentrées', RED: 'Grandissement imposé (RED) non pris en charge : distance objet conservée',
    REX: 'Ouvertures rectangulaires (REX/REY) remplacées par un cercle circonscrit', REY: 'Ouvertures rectangulaires (REX/REY) remplacées par un cercle circonscrit',
    ADX: 'Décentrement d\'ouverture (ADX/ADY) ignoré', ADY: 'Décentrement d\'ouverture (ADX/ADY) ignoré',
    AFC: 'Mode afocal non pris en charge', AFO: 'Mode afocal non pris en charge', WID: 'Mode grand angle (WID) : utilisez la visée réelle des rayons',
  };
  const isSurfQ = t => /^S(\d+|O|I)$/i.test(t || '');
  const isItemQ = t => /^[WFZ]\d+$/i.test(t || '');
  function parseSeq(txt) {
    const W = [], sys = baseSys(), note = m => { if (!W.includes(m)) W.push(m); };
    let wl = [], wtw = [], fy = [], fxs = [], wtf = [], vig = { vuy: [], vly: [], vux: [], vlx: [] }, ftype = 'ang', cur = null, rdn = false, scale = null, ddm = null, prv = null, pwl = [], spsT = null, rect = new Map();
    const stmts = String(txt).split(/\r?\n/).map(l => l.replace(/!.*$/, '')).join('\n').split(/[;\n]/);
    const setList = (arr, a) => { // « CMD v1 v2 … » ou « CMD Wk v » / « CMD Fk v »
      if (isItemQ(a[0])) { const k = +a[0].slice(1) - 1; if (k >= 0 && isFinite(num(a[1]))) arr[k] = num(a[1]); return arr; }
      return a.map(num).filter(isFinite);
    };
    const surfAt = q => { // qualificatif de surface → surface (création à la volée de l'objet au besoin)
      const u = q.toUpperCase();
      if (!sys.surfaces.length) return null;
      if (u === 'SO') return sys.surfaces[0];
      if (u === 'SI') return sys.surfaces.length > 1 ? sys.surfaces[sys.surfaces.length - 1] : null;
      return sys.surfaces[+u.slice(1)] || null;
    };
    for (let st of stmts) {
      st = st.trim(); if (!st) continue;
      const q = st.match(/'([^']*)'|"([^"]*)"/), tk = st.replace(/'[^']*'|"[^"]*"/g, m => m.replace(/\s+/g, '\u0001')).split(/\s+/).map(t => t.replace(/\u0001/g, ' '));
      const cmd = tk[0].toUpperCase(); let a = tk.slice(1);
      if (prv) { // bloc de verres privés
        if (cmd === 'END') { prv = null; continue; }
        if (cmd === 'PWL') { pwl = a.map(Number).filter(isFinite); continue; }
        if (q) { const nm = (q[1] ?? q[2]).trim(), idx = st.slice(q.index + q[0].length).trim().split(/\s+/).map(Number).filter(isFinite);
          const pts = idx.map((v, i) => [(pwl[i] || 587.56) / 1000, v]).filter(p => p[1] > 1);
          if (pts.length) { E.addGlasses([{ name: nm.toUpperCase(), cat: 'PRIVE', f: 'CY', c: fitCauchy(pts), user: true, lmin: Math.min(...pts.map(p => p[0])), lmax: Math.max(...pts.map(p => p[0])) }], true); }
          continue; }
        continue;
      }
      if (cmd === 'ZOO' || cmd === 'PIK') { note(SEQ_UNSUP[cmd]); continue; }
      if (SEQ_SILENT.has(cmd)) continue;
      // qualificatif de surface explicite : « THI S3 5 », « CIR S2 10 », « SLB S4 'texte' », « STO S3 »…
      let tgt = cur;
      if (!['S', 'SO', 'SI'].includes(cmd) && isSurfQ(a[0])) { tgt = surfAt(a[0]); a = a.slice(1); if (!tgt) continue; }
      const n = i => num(a[i]);
      switch (cmd) {
        case 'PRV': prv = true; pwl = []; break;
        case 'TIT': case 'TITLE': sys.title = q ? (q[1] ?? q[2]) : a.join(' '); break;
        case 'LEN': if (q) sys.title = sys.title || (q[1] ?? q[2]); break;
        case 'RDN': rdn = true; break; case 'RDM': rdn = false; break;
        case 'DIM': scale = { M: 1, C: 10, I: 25.4 }[(a[0] || 'M').toUpperCase()] || 1; break;
        case 'DDM': ddm = { M: 1, C: 10, I: 25.4 }[(a[0] || 'M').toUpperCase()] || 1; break;
        case 'EPD': sys.aperture = { type: 'EPD', value: n(0), obscuration: 0 }; break;
        case 'FNO': sys.aperture = { type: 'FNO', value: n(0), obscuration: 0 }; break;
        case 'NAO': sys.aperture = { type: 'NA', value: n(0), obscuration: 0 }; break;
        case 'NA': sys.aperture = { type: 'NAI', value: n(0), obscuration: 0 }; break;
        case 'WL': wl = setList(wl, a); break;
        case 'WTW': wtw = setList(wtw, a); break;
        case 'REF': sys.primary = n(0) - 1; break;
        case 'YAN': case 'YOB': case 'YIM': case 'YRI': ftype = { YAN: 'ang', YOB: 'obj', YIM: 'pim', YRI: 'rim' }[cmd]; fy = setList(fy, a); break;
        case 'XAN': case 'XOB': case 'XIM': case 'XRI': ftype = { XAN: 'ang', XOB: 'obj', XIM: 'pim', XRI: 'rim' }[cmd]; fxs = setList(fxs, a); break;
        case 'WTF': wtf = setList(wtf, a); break;
        case 'VUY': case 'VLY': case 'VUX': case 'VLX': vig[cmd.toLowerCase()] = setList(vig[cmd.toLowerCase()], a); break;
        case 'TEM': if (tgt && tgt !== cur) { note('Températures par surface (TEM Sk) : seule la température du système est prise en compte'); break; } sys.env = { ...(sys.env || {}), T: n(0) }; break;
        case 'PRE': sys.env = { ...(sys.env || {}), P: n(0) }; break;
        case 'PUI': if (n(0) > 0 && n(0) < 1) sys.apod = { type: 'gauss', I: n(0) }; break;
        case 'SO': { const t = n(1); sys.surfaces.push(S0({ t: !isFinite(t) || Math.abs(t) > 1e10 ? Infinity : t, comment: 'Objet', glass: a[2] ? mapGlass(a[2], NaN, NaN, W, 'Objet') : '' })); cur = null; break; }
        case 'S': case 'STO': case 'SI': {
          if (cmd === 'STO' && tgt && tgt !== cur) { sys.surfaces.forEach(x => x.stop = false); tgt.stop = true; break; } // « STO S3 »
          if (cmd === 'STO' && !a.length && cur) { sys.surfaces.forEach(x => x.stop = false); cur.stop = true; break; }
          if (!sys.surfaces.length) sys.surfaces.push(S0({ t: Infinity, comment: 'Objet' }));
          let rv = n(0); if (rdn) rv = rv ? 1 / rv : 0;
          const s = S0({ r: !rv ? Infinity : rv, t: cmd === 'SI' ? 0 : (isFinite(n(1)) ? n(1) : 0), stop: cmd === 'STO' });
          if (cmd === 'STO') sys.surfaces.forEach(x => x.stop = false);
          if (cmd !== 'SI' && a[2]) s.glass = mapGlass(a[2], NaN, NaN, W, `S${sys.surfaces.length}`);
          if (cmd === 'SI') s.comment = 'Image';
          sys.surfaces.push(s); cur = s; spsT = null; break;
        }
        case 'SLB': if (tgt) tgt.comment = (q ? (q[1] ?? q[2]) : a.join(' ')).trim(); break;
        case 'K': if (tgt) tgt.k = n(0); break;
        case 'A': case 'B': case 'C': case 'D': case 'E': case 'F': case 'G': case 'H': case 'J': if (tgt) tgt['a' + (4 + 2 * 'ABCDEFGHJ'.indexOf(cmd))] = n(0); break;
        case 'CIR': {
          if (!tgt) break; const w = (a[0] || '').toUpperCase();
          if (w === 'EDG') break; // ouverture mécanique (bord) : sans effet sur le tracé
          if (w === 'HOL' || w === 'OBS') { note('Trous et obstructions de surface (CIR HOL / CIR OBS) ignorés'); break; }
          if (isFinite(n(0)) && n(0) > 0) { tgt.sd = n(0); tgt.sdFixed = true; } break;
        }
        case 'REX': case 'REY': { if (!tgt) break; note(SEQ_UNSUP[cmd]); const w = (a[0] || '').toUpperCase(); if (['EDG', 'HOL', 'OBS'].includes(w)) break; const r = rect.get(tgt) || {}; r[cmd] = n(0); rect.set(tgt, r); break; }
        case 'THI': if (tgt) tgt.t = n(0); break;
        case 'RDY': if (tgt) tgt.r = n(0) ? n(0) : Infinity; break;
        case 'CUY': if (tgt) tgt.r = n(0) ? 1 / n(0) : Infinity; break;
        case 'GLA': case 'GL1': if (tgt) tgt.glass = mapGlass(q ? q[0] : a[0], NaN, NaN, W, `S${sys.surfaces.indexOf(tgt)}`); break;
        case 'GL2': note('Second milieu (GL2) ignoré'); break;
        case 'REFL': if (tgt) tgt.glass = 'MIRROR'; break;
        case 'RMD': if (tgt && /^REFL/i.test(a[0] || '')) tgt.glass = 'MIRROR'; else if (/^TIR/i.test(a[0] || '')) note('Mode TIR (RMD TIR) traité comme une réfraction'); break;
        case 'PIM': if (tgt) tgt.tsolve = 'M'; break;
        case 'CCY': if (tgt && n(0) === 0) tgt.vr = true; break;
        case 'THC': if (tgt && n(0) === 0) tgt.vt = true; break;
        case 'KC': if (tgt && n(0) === 0) tgt.vk = true; break;
        case 'AC': case 'BC': case 'CC': case 'DC': if (tgt && n(0) === 0) tgt['va' + (4 + 2 * 'ABCD'.indexOf(cmd[0]))] = true; break;
        case 'GLC': if (tgt && n(0) === 0 && E.parseModel(tgt.glass)) tgt.vg = true; break;
        case 'XDE': if (tgt) tgt.dx = n(0); break; case 'YDE': if (tgt) tgt.dy = n(0); break; case 'ZDE': if (tgt) tgt.dz = n(0); break;
        case 'ADE': if (tgt) tgt.tx = n(0); break; case 'BDE': if (tgt) tgt.ty = n(0); break; case 'CDE': if (tgt) tgt.tz = n(0); break;
        case 'DAR': case 'BEN': if (tgt) tgt.dmode = cmd; break;
        case 'REV': if (tgt) { tgt.dmode = 'DAR'; W.push(`S${sys.surfaces.indexOf(tgt)} : décentrement REV converti en DAR`); } break;
        case 'GRT': if (tgt) { tgt.elem = 'grating'; tgt.lpmm = tgt.lpmm || 600; tgt.gm = tgt.gm ?? 1; } break;
        case 'GRO': if (tgt) tgt.gm = n(0); break;
        case 'GRS': if (tgt && n(0)) tgt.lpmm = 1 / n(0); break;
        case 'GRX': if (tgt) tgt._grx = n(0); break; case 'GRY': if (tgt) tgt._gry = n(0); break;
        case 'ASP': if (tgt) spsT = null; break;
        case 'SPS': { const ty = (a[0] || '').toUpperCase(); spsT = ty; if (!tgt) break;
          if (ty === 'XYP') { tgt.type = 'XY'; tgt.xy = tgt.xy || {}; note('Polynômes XY (SPS XYP) importés : vérifiez la normalisation et le signe des coefficients'); }
          else if (ty === 'ODD' || ty === 'ZRN' || ty === 'ZFR' || ty === 'QBF' || ty === 'QCN' || ty === 'XYD') note(`Surface spéciale SPS ${ty} non prise en charge : base conique seule`);
          break; }
        case 'SCO': { if (!tgt || spsT !== 'XYP') break; // « SCO C5 v » : C1 = conique, puis xᵐyⁿ d'indice j = [(m+n)² + m + 3n]/2 + 1
          for (let i = 0; i + 1 < a.length; i += 2) { const m = (a[i] || '').toUpperCase().match(/^C(\d+)$/), v = num(a[i + 1]); if (!m || !isFinite(v)) continue; const j = +m[1];
            if (j === 1) { tgt.k = v; continue; }
            let found = false; for (let d = 1; d <= 10 && !found; d++) for (let nn = 0; nn <= d; nn++) { const mm = d - nn; if (((d * d + mm + 3 * nn) / 2 + 1) === j) { if (v) tgt.xy[`${mm},${nn}`] = v; found = true; break; } } }
          break; }
        case 'TCE': if (tgt && isFinite(n(0))) tgt.tce = n(0); break;
        default:
          if (SEQ_SILENT.has(cmd)) break;
          if (SEQ_UNSUP[cmd]) { note(SEQ_UNSUP[cmd]); break; }
          if (/^[A-Z]{2,4}$/.test(cmd)) note(`Commande CODE V « ${cmd} » ignorée`);
      }
    }
    if (sys.surfaces.length < 3) throw new Error('Fichier .seq : aucune surface trouvée');
    const last = sys.surfaces[sys.surfaces.length - 1]; if (last.comment !== 'Image') sys.surfaces.push(S0({ t: 0, comment: 'Image' }));
    for (const s of sys.surfaces) { if (s._grx != null || s._gry != null) { s.gang = Math.atan2(-(s._grx || 0), s._gry ?? 1) * 180 / Math.PI; } delete s._grx; delete s._gry; }
    for (const [s, r] of rect) if (r.REX > 0 || r.REY > 0) { s.sd = Math.hypot(r.REX || 0, r.REY || 0); s.sdFixed = true; }
    sys.wavelengths = (wl.length ? wl : [587.56]).map((v, i) => ({ um: v / 1000, w: wtw[i] ?? 1 }));
    sys.primary = Math.max(0, Math.min(sys.primary, sys.wavelengths.length - 1));
    const nf = Math.max(1, fy.length, fxs.length);
    sys.fields = Array.from({ length: nf }, (_, i) => { const f = { x: fxs[i] || 0, y: fy[i] || 0, w: wtf[i] ?? 1 }; for (const k of ['vuy', 'vly', 'vux', 'vlx']) if (vig[k][i]) f[k] = vig[k][i]; return f; });
    if (Object.values(vig).some(v => v.some(x => x))) note('Facteurs de vignetage (VUY, VLY, VUX, VLX) importés');
    if (!sys.surfaces.some(s => s.stop)) { sys.surfaces[1].stop = true; W.push('Pas de diaphragme (STO) : surface 1 utilisée'); }
    const sc = scale ?? ddm ?? 1;
    if (sc !== 1) { scaleSys(sys, sc, ftype); W.push(`Unités converties en mm (×${sc})`); }
    sys.ftype = ftype;
    fixFields(sys, ftype, W);
    if (sys.env && (sys.env.T != null || sys.env.P != null)) note(`Environnement importé : ${sys.env.T ?? 20} °C, ${sys.env.P ?? 1} atm (prescription à 20 °C)`);
    return { sys, warnings: W };
  }

  /** type de champ : conservé tel quel (le moteur convertit) ; seule incohérence signalée */
  function fixFields(sys, ftype, W) {
    const S = sys.surfaces, inf = !isFinite(S[0].t) || Math.abs(S[0].t) > 1e10;
    if (ftype === 'obj' && inf) { sys.ftype = 'ang'; W.push('Champs en hauteur objet avec objet à l\'infini : interprétés comme des angles'); }
  }
  function scaleSys(sys, k, ftype) {
    for (const s of sys.surfaces) {
      if (isFinite(s.r)) s.r *= k; if (isFinite(s.t)) s.t *= k; s.sd *= k; s.dx *= k; s.dy *= k; s.dz *= k;
      E.ASPK.forEach((a, i) => { if (s[a]) s[a] *= Math.pow(k, -(3 + 2 * i)); });
      if (s.xy) for (const kk of Object.keys(s.xy)) { const [p, r] = kk.split(',').map(Number); s.xy[kk] *= Math.pow(k, 1 - p - r); }
      if (s.lpmm) s.lpmm /= k; if (s.fid) s.fid *= k;
    }
    if (sys.aperture.type === 'EPD' || sys.aperture.type === 'STOP') sys.aperture.value *= k;
    const inf = !(isFinite(sys.surfaces[0].t) && Math.abs(sys.surfaces[0].t) < 1e10);
    if ((ftype || (inf ? 'ang' : 'obj')) === 'ang') return;
    sys.fields = sys.fields.map(f => ({ ...f, x: f.x * k, y: f.y * k }));
  }

  function toSeq(s) {
    const W = [], S = s.surfaces, N = S.length - 1, L = [], TS = solvedT(s);
    const objInf = !isFinite(S[0].t) || Math.abs(S[0].t) > 1e10;
    const wls = s.wavelengths.map(w => w.um);
    const priv = new Map();
    const gl = g => {
      const o = glassOut(g);
      if (o.kind === 'air') return ''; if (o.kind === 'mirror') return 'REFL';
      if (o.kind === 'cat' && !o.user) return o.name.replace(/-/g, '') + '_' + (o.cat === 'MISC' ? 'SPECIAL' : o.cat);
      const mo = E.parseModel(g); // verre modèle nd/νd → verre fictif CODE V (code nnnnnn.vvvvvv)
      if (mo && mo.nd > 1 && mo.nd < 2.5 && mo.vd > 0 && mo.vd < 100) return `${String(Math.round((mo.nd - 1) * 1e6)).padStart(6, '0')}.${String(Math.round(mo.vd * 1e4)).padStart(6, '0')}`;
      // verre fictif ou importé : verre privé (indices aux longueurs d'onde du système)
      const nm = (o.kind === 'cat' ? o.name : 'FOC' + String(Math.round(o.nd * 1e4)) + String(Math.round(o.vd * 10))).toUpperCase().replace(/[^A-Z0-9_]/g, '_').slice(0, 20);
      priv.set(nm, wls.map(l => E.glassN(g, l)));
      return `'${nm}'`;
    };
    const r = v => isFinite(v) ? fmtN(v) : '0';
    const body = [];
    body.push(`SO ${r(objInf ? 0 : S[0].r)} ${objInf ? '1e+18' : r(S[0].t)}${S[0].glass && !E.isAir(S[0].glass) ? ' ' + gl(S[0].glass) : ''}`);
    for (let i = 1; i < N; i++) {
      const x = S[i]; body.push(`${x.stop ? 'STO' : 'S'} ${r(x.r)} ${r(x.tsolve === 'M' ? TS[i] : x.t)} ${gl(x.glass)}`.trim());
      if (x.tsolve === 'M' && i !== N - 1) W.push(`S${i} : solve de mise au point exporté comme épaisseur fixe`);
      if (x.comment) body.push(`  SLB "${String(x.comment).replace(/"/g, "'")}"`);
      const asp = E.ASPK.some(a => x[a]);
      if (x.k || asp) { body.push(asp ? '  ASP' : '  CON'); body.push(`  K ${fmtN(x.k || 0)}`); if (asp) { const hi = E.ASPK.slice(4).some(a => x[a]); body.push((hi ? E.ASPK : E.ASPK.slice(0, 4)).map((a, k) => `${'ABCDEFGHJ'[k]} ${fmtN(x[a] || 0)}`).join('; ').replace(/^/, '  ')); } }
      if (x.sdFixed) body.push(`  CIR ${r(x.sd)}`);
      if (isDec(x)) { if (x.dmode === 'DAR' || x.dmode === 'BEN') body.push('  ' + x.dmode); body.push(`  XDE ${fmtN(x.dx || 0)}; YDE ${fmtN(x.dy || 0)}; ZDE ${fmtN(x.dz || 0)}; ADE ${fmtN(x.tx || 0)}; BDE ${fmtN(x.ty || 0)}; CDE ${fmtN(x.tz || 0)}`); }
      if (x.tsolve === 'M' && i === N - 1) body.push('  PIM');
      if (x.vr) body.push('  CCY 0'); if (x.vt && x.tsolve !== 'M') body.push('  THC 0');
      if (x.elem === 'grating') { const a = (x.gang || 0) * Math.PI / 180; body.push(`  GRT; GRO ${x.gm ?? 1}; GRS ${fmtN(1 / (x.lpmm || 600))}; GRX ${fmtN(-Math.sin(a))}; GRY ${fmtN(Math.cos(a))}; GRZ 0`); W.push(`S${i} : réseau exporté en GRT/GRO/GRS (à vérifier dans CODE V)`); }
      if (x.elem === 'ideal') { body.push(`! S${i} : lentille idéale f = ${x.fid} non exportée`); W.push(`S${i} : lentille idéale non exportée (surface plane)`); }
      if (x.elem === 'polarizer' || x.elem === 'waveplate') { body.push(`! S${i} : ${x.elem === 'polarizer' ? 'polariseur' : 'lame d\'onde'} non exporté`); W.push(`S${i} : élément de polarisation non exporté`); }
      if (x.type && x.type !== 'STD') { body.push(`! S${i} : surface ${x.type} non exportée (base conique seule)`); W.push(`S${i} : forme ${x.type === 'XY' ? 'polynôme XY' : 'Zernike'} non exportée`); }
    }
    body.push(`SI ${r(S[N].r)} 0`);
    L.push('RDM;LEN', `TITLE '${(s.title || 'Focale').replace(/'/g, ' ')}'`);
    const ap = s.aperture;
    let apl = ap.type === 'FNO' ? `FNO ${ap.value}` : ap.type === 'NA' ? `NAO ${ap.value}` : ap.type === 'NAI' ? `NA ${ap.value}` : `EPD ${ap.value}`;
    if (ap.type === 'STOP') { try { const M = E.prepare(s); apl = `EPD ${fmtN(M.par.epd)}`; } catch (e) { } W.push('Ouverture « demi-diamètre du diaphragme » exportée en EPD équivalent'); }
    L.push(apl, 'DIM M');
    L.push('WL ' + wls.map(l => (l * 1000).toFixed(4)).join(' '), `REF ${s.primary + 1}`, 'WTW ' + s.wavelengths.map(w => w.w ?? 1).join(' '));
    const ft = E.FTYPES[s.ftype] ? s.ftype : (objInf ? 'ang' : 'obj'), cv = E.FTYPES[ft].cv;
    L.push('INI \'FOC\'', 'X' + cv.slice(1) + ' ' + s.fields.map(f => f.x || 0).join(' '));
    L.push(cv + ' ' + s.fields.map(f => f.y).join(' '), 'WTF ' + s.fields.map(f => f.w ?? 1).join(' '));
    for (const k of ['vuy', 'vly', 'vux', 'vlx']) if (s.fields.some(f => +f[k])) L.push(k.toUpperCase() + ' ' + s.fields.map(f => fmtN(+f[k] || 0)).join(' '));
    if (s.env && ((+s.env.T ?? 20) !== 20 || (+s.env.P ?? 1) !== 1)) { L.push(`TEM ${fmtN(s.env.T ?? 20)}`, `PRE ${fmtN(s.env.P ?? 1)}`); if (s.env.Tref != null && +s.env.Tref !== 20) W.push('Température de référence de la prescription ≠ 20 °C : non exportée'); }
    if (s.apod && s.apod.type === 'gauss') L.push(`PUI ${fmtN(s.apod.I ?? 0.135)}`);
    if (priv.size) { L.push('PRV', 'PWL ' + wls.map(l => (l * 1000).toFixed(4)).join(' ')); for (const [nm, ns] of priv) L.push(`'${nm}' ${ns.map(v => v.toFixed(6)).join(' ')}`); L.push('END'); W.push(`${priv.size} verre(s) fictif(s) ou importé(s) exporté(s) en verres privés PRV`); }
    if ((ap.obscuration || 0) > 0) W.push('Obstruction centrale non exportée');
    return { text: [...L, ...body, 'GO'].join('\n'), warnings: W };
  }

  /* =====================================================================
     Zemax OpticStudio (.zmx, mode séquentiel)
     ===================================================================== */
  function parseZMX(txt) {
    const W = [], sys = baseSys(), raw = [];
    let cur = null, unit = 1, ftype = 0, nf = null, nw = null, xf = [], yf = [], fw = [], wavm = [], wavl = [], wwgt = [], pwav = 1, floa = false, vdx = [], vdy = [], vcx = [], vcy = [];
    for (const line of String(txt).split(/\r?\n/)) {
      const tl = line.trim(); if (!tl) continue;
      const t = tl.split(/\s+/), cmd = t[0].toUpperCase();
      if (cmd === 'SURF') { cur = { n: +t[1], type: 'STANDARD', parm: {}, xdat: {} }; raw.push(cur); continue; }
      if (cur) {
        switch (cmd) {
          case 'TYPE': cur.type = (t[1] || 'STANDARD').toUpperCase(); continue;
          case 'CURV': cur.curv = num(t[1]); continue;
          case 'DISZ': cur.disz = /^INF/i.test(t[1]) ? Infinity : num(t[1]); continue;
          case 'GLAS': cur.glas = t[1]; cur.gnd = num(t[4]); cur.gvd = num(t[5]); continue;
          case 'DIAM': cur.diam = num(t[1]); continue;
          case 'CLAP': cur.clap = num(t[2]); continue;
          case 'CONI': cur.coni = num(t[1]); continue;
          case 'PARM': cur.parm[+t[1]] = num(t[2]); continue;
          case 'XDAT': cur.xdat[+t[1]] = num(t[2]); continue;
          case 'STOP': cur.stop = true; continue;
          case 'COMM': cur.comm = tl.slice(4).trim().replace(/^"|"$/g, ''); continue;
          case 'OBSC': case 'FLAP': case 'SQAP': case 'ELAP': case 'SQOB': case 'ELOB': if (!W.some(w => w.includes(cmd))) W.push(`Ouverture ${cmd} ignorée (seules les ouvertures circulaires CLAP sont lues)`); continue;
        }
        if (cmd === 'TCE') { const v = num(t[1]); if (v) cur.tce = v; continue; }
        if (/^(HIDE|MIRR|SLAB|POPS|MAZH|PZUP|LANG|FLWR|COAT|TOL|VDSZ|VCRV|VPAR|PPAR|CONF|BLNK|MNUM|MOFF|EDGE)$/.test(cmd)) continue;
      }
      switch (cmd) {
        case 'NAME': sys.title = tl.slice(4).trim(); break;
        case 'UNIT': unit = { MM: 1, CM: 10, IN: 25.4, METER: 1000, M: 1000 }[(t[1] || 'MM').toUpperCase()] || 1; break;
        case 'ENPD': sys.aperture = { type: 'EPD', value: num(t[1]), obscuration: 0 }; break;
        case 'FNUM': sys.aperture = { type: 'FNO', value: num(t[1]), obscuration: 0 }; break;
        case 'OBNA': sys.aperture = { type: 'NA', value: num(t[1]), obscuration: 0 }; break;
        case 'FLOA': floa = true; break;
        case 'FTYP': ftype = +t[1] || 0; if (t.length > 4) { nf = +t[3]; nw = +t[4]; } break;
        case 'XFLN': case 'XFLD': xf = t.slice(1).map(Number); break;
        case 'YFLN': case 'YFLD': yf = t.slice(1).map(Number); break;
        case 'FWGN': case 'FWGT': fw = t.slice(1).map(Number); break;
        case 'VDXN': vdx = t.slice(1).map(Number); break; case 'VDYN': vdy = t.slice(1).map(Number); break;
        case 'VCXN': vcx = t.slice(1).map(Number); break; case 'VCYN': vcy = t.slice(1).map(Number); break;
        case 'ENVD': { const T = num(t[1]), P = num(t[2]); if ((isFinite(T) && T !== 20) || (isFinite(P) && P !== 1)) sys.env = { T: isFinite(T) ? T : 20, P: isFinite(P) ? P : 1 }; break; }
        case 'WAVM': wavm[+t[1] - 1] = { um: num(t[2]), w: num(t[3]) }; break;
        case 'WAVL': wavl = t.slice(1).map(Number); break;
        case 'WWGT': wwgt = t.slice(1).map(Number); break;
        case 'PWAV': pwav = +t[1] || 1; break;
        case 'MODE': if ((t[1] || '').toUpperCase() !== 'SEQ') W.push('Fichier non séquentiel : seule la partie séquentielle est lue'); break;
      }
    }
    if (raw.length < 3) throw new Error('Fichier .zmx : aucune surface trouvée');
    // surfaces
    const types = new Set();
    raw.forEach((r, i) => {
      const s = S0({ t: r.disz ?? 0, comment: r.comm || '' });
      if (i === 0) { s.t = r.disz ?? Infinity; if (!s.comment) s.comment = 'Objet'; }
      if (i === raw.length - 1) { s.t = 0; if (!s.comment) s.comment = 'Image'; }
      const c = r.curv || 0; s.r = c ? 1 / c : Infinity;
      if (r.coni) s.k = r.coni;
      if (r.stop) s.stop = true;
      if (r.tce) s.tce = r.tce;
      if (r.diam > 0) s.sd = r.diam;
      if (r.clap > 0) { s.sd = r.clap; s.sdFixed = true; }
      if (r.glas) s.glass = r.glas.toUpperCase() === '___BLANK' ? (r.gvd > 0 ? `${g10(r.gnd)}/${g10(r.gvd)}` : String(g10(r.gnd))) : mapGlass(r.glas, r.gnd, r.gvd, W, `S${i}`);
      switch (r.type) {
        case 'STANDARD': break;
        case 'EVENASPH': s.a4 = r.parm[2] || 0; s.a6 = r.parm[3] || 0; s.a8 = r.parm[4] || 0; s.a10 = r.parm[5] || 0; s.a12 = r.parm[6] || 0; s.a14 = r.parm[7] || 0; s.a16 = r.parm[8] || 0;
          if (r.parm[1]) W.push(`S${i} : terme asphérique en r² (${r.parm[1]}) ignoré`); break;
        case 'COORDBRK': s.dx = r.parm[1] || 0; s.dy = r.parm[2] || 0; s.tx = r.parm[3] || 0; s.ty = r.parm[4] || 0; s.tz = r.parm[5] || 0; s.dmode = 'DEC'; s.r = Infinity; s.glass = '';
          s.comment = s.comment || 'Coordinate break';
          if (r.parm[6]) { const nt = [s.tx, s.ty, s.tz].filter(v => v).length; if (nt > 1 || (nt && (s.dx || s.dy))) W.push(`S${i} : coordinate break en ordre inverse approché (décentrement puis bascules)`); }
          s._cb = true; break;
        case 'PARAXIAL': s.elem = 'ideal'; s.fid = r.parm[1] || 100; s.r = Infinity; break;
        case 'DGRATING': s.elem = 'grating'; s.lpmm = (r.parm[1] || 0) * 1000; s.gm = r.parm[2] ?? 1; break;
        default: types.add(r.type);
      }
      sys.surfaces.push(s);
    });
    for (const ty of types) W.push(`Type de surface Zemax ${ty} non pris en charge : importé comme surface standard`);
    // un coordinate break qui suit un miroir avec la même bascule = pliage
    // longueurs d'onde et champs
    if (wavm.filter(Boolean).length) { const n = nw || wavm.length; sys.wavelengths = wavm.slice(0, n).filter(w => w && w.um > 0).map(w => ({ um: w.um, w: isFinite(w.w) ? w.w : 1 })); }
    else sys.wavelengths = (wavl.length ? wavl : [0.5875618]).map((um, i) => ({ um, w: wwgt[i] ?? 1 }));
    if (!sys.wavelengths.length) sys.wavelengths = [{ um: 0.5875618, w: 1 }];
    sys.primary = Math.max(0, Math.min(sys.wavelengths.length - 1, pwav - 1));
    const n = nf || Math.max(1, yf.length);
    sys.fields = Array.from({ length: n }, (_, i) => {
      const f = { x: xf[i] || 0, y: yf[i] || 0, w: isFinite(fw[i]) ? fw[i] : 1 }, cy = +vcy[i] || 0, dy = +vdy[i] || 0, cx = +vcx[i] || 0, dx = +vdx[i] || 0;
      if (cy || dy || cx || dx) Object.assign(f, { vuy: cy - dy, vly: cy + dy, vux: cx - dx, vlx: cx + dx }); // Zemax VCY/VDY → CODE V VUY/VLY
      return f; });
    if (sys.fields.some(f => f.vuy || f.vly || f.vux || f.vlx)) W.push('Facteurs de vignetage Zemax (VDX, VDY, VCX, VCY) convertis en VUY, VLY, VUX, VLX');
    if (!sys.surfaces.some(s => s.stop)) { sys.surfaces[1].stop = true; W.push('Pas de diaphragme : surface 1 utilisée'); }
    const ft = ['ang', 'obj', 'pim', 'rim'][ftype] || 'ang'; if (ftype > 3) W.push('Type de champ Zemax non pris en charge : valeurs prises comme des angles');
    if (unit !== 1) { scaleSys(sys, unit, ft); W.push(`Unités converties en mm (×${unit})`); }
    sys.ftype = ft; fixFields(sys, ft, W);
    if (floa) { // ouverture « flottante » : diamètre fixé par le diaphragme
      const st = sys.surfaces.find(s => s.stop);
      if (st && st.sd > 0) { try { sys.aperture = { type: 'EPD', value: 2 * st.sd, obscuration: 0 }; const M = E.prepare(sys); if (M.ok && M.par.stopR > 0) sys.aperture.value = 2 * st.sd * (st.sd / M.par.stopR); } catch (e) { } W.push('Ouverture « Float by stop size » convertie en diamètre de pupille d\'entrée'); }
      else W.push('Ouverture « Float by stop size » sans demi-diamètre de diaphragme : EPD = 10 mm par défaut');
    }
    sys.surfaces.forEach(s => delete s._cb);
    return { sys, warnings: W };
  }

  /** épaisseurs résolues (solves) pour l'export en valeurs fixes */
  function solvedT(s) { try { const M = E.prepare(s); if (M.ok) return M.S.map(x => x.t); } catch (e) { } return s.surfaces.map(x => x.t); }
  function toZMX(s) {
    const W = [], S = s.surfaces, N = S.length - 1, objInf = !isFinite(S[0].t) || Math.abs(S[0].t) > 1e10, TS = solvedT(s);
    const cats = new Set(), out = [];
    const pad = (arr, n = 12) => { const a = arr.slice(0, n); while (a.length < n) a.push(0); return a.map(v => fmtN(v)).join(' '); };
    // surfaces Zemax (les décentrements deviennent des coordinate breaks)
    const zs = [];
    const glasLine = g => {
      const o = glassOut(g);
      if (o.kind === 'air') return null; if (o.kind === 'mirror') return 'GLAS MIRROR 0 0 1.5 4.0E+1 0 0 0 0 0 0';
      if (o.kind === 'cat') { cats.add(o.cat); if (o.user) W.push(`Verre ${o.name} : catalogue ${o.cat} à installer dans OpticStudio`); return `GLAS ${o.name} 0 0 ${fmtN(o.nd)} ${fmtN(o.vd)} 0 0 0 0 0 0`; }
      return `GLAS ___BLANK 1 0 ${fmtN(o.nd)} ${fmtN(o.vd)} 0 0 0 0 0 0`;
    };
    S.forEach((x, i) => {
      const t = i === N ? 0 : TS[i], dec = i > 0 && i < N && isDec(x);
      const surf = { type: 'STANDARD', curv: isFinite(x.r) && x.r ? 1 / x.r : 0, disz: t, glas: glasLine(x.glass), sd: x.sd, fixed: x.sdFixed, coni: x.k, parm: {}, stop: x.stop, comm: x.comment || '' };
      if (E.ASPK.some(a => x[a])) { surf.type = 'EVENASPH'; surf.parm = { 1: 0, 2: x.a4 || 0, 3: x.a6 || 0, 4: x.a8 || 0, 5: x.a10 || 0, 6: x.a12 || 0, 7: x.a14 || 0, 8: x.a16 || 0 }; if (x.a18 || x.a20) W.push(`S${i} : coefficients A18, A20 non exportés (EVENASPH s'arrête à r¹⁶)`); }
      if (x.tce != null && x.tce !== '') surf.tce = +x.tce;
      if (x.elem === 'ideal') { surf.type = 'PARAXIAL'; surf.curv = 0; surf.parm = { 1: x.fid || 100, 2: 0 }; }
      if (x.elem === 'grating') { surf.type = 'DGRATING'; surf.parm = { 1: (x.lpmm || 600) / 1000, 2: x.gm ?? 1 }; if (x.gang) W.push(`S${i} : orientation des traits du réseau (${x.gang}°) non exportée (Zemax : traits selon X)`); }
      if (x.elem === 'polarizer' || x.elem === 'waveplate') { W.push(`S${i} : ${x.elem === 'polarizer' ? 'polariseur' : 'lame d\'onde'} exporté comme surface standard`); surf.comm = (surf.comm + ' ' + (x.elem === 'polarizer' ? '[polariseur]' : '[lame d\'onde]')).trim(); }
      if (x.type && x.type !== 'STD') W.push(`S${i} : forme ${x.type === 'XY' ? 'polynôme XY' : 'Zernike'} non exportée (base conique seule)`);
      if (!dec) { zs.push(surf); return; }
      if (x.dz) { const prev = zs[zs.length - 1]; if (prev && isFinite(prev.disz)) prev.disz += x.dz; }
      zs.push({ type: 'COORDBRK', curv: 0, disz: 0, parm: { 1: x.dx || 0, 2: x.dy || 0, 3: x.tx || 0, 4: x.ty || 0, 5: x.tz || 0, 6: 0 }, comm: 'CB' });
      if (x.dmode === 'DEC') { zs.push(surf); return; }
      zs.push({ ...surf, disz: 0 });
      if (x.dmode === 'DAR') zs.push({ type: 'COORDBRK', curv: 0, disz: t - (x.dz || 0), parm: { 1: -(x.dx || 0), 2: -(x.dy || 0), 3: -(x.tx || 0), 4: -(x.ty || 0), 5: -(x.tz || 0), 6: 1 }, comm: 'CB retour' });
      else zs.push({ type: 'COORDBRK', curv: 0, disz: t, parm: { 1: 0, 2: 0, 3: x.tx || 0, 4: x.ty || 0, 5: x.tz || 0, 6: 0 }, comm: 'CB pliage' });
    });
    const ap = s.aperture;
    out.push('VERS 160527 2 1', 'MODE SEQ', `NAME ${(s.title || 'Focale').replace(/[\r\n]/g, ' ')}`, 'PFIL 0 0 0', 'LANG 0', 'UNIT MM X W X CM MR CPMM');
    let apz = ap.type === 'FNO' ? `FNUM ${fmtN(ap.value)} 0` : ap.type === 'NA' ? `OBNA ${fmtN(ap.value)} 0` : `ENPD ${fmtN(ap.value)}`;
    if (ap.type === 'NAI' || ap.type === 'STOP') { try { apz = `ENPD ${fmtN(E.prepare(s).par.epd)}`; } catch (e) { } W.push('Ouverture (ON image / diaphragme) exportée en diamètre de pupille d\'entrée équivalent'); }
    out.push(apz);
    const env = s.env || {};
    out.push(`ENVD ${fmtN(env.T ?? 20)} ${fmtN(env.P ?? 1)} 0`, 'GFAC 0 0', `GCAT ${[...new Set(['SCHOTT', ...cats])].join(' ')}`);
    const nf = s.fields.length, nw = s.wavelengths.length, ft = E.FTYPES[s.ftype] ? s.ftype : (objInf ? 'ang' : 'obj');
    out.push(`FTYP ${['ang', 'obj', 'pim', 'rim'].indexOf(ft)} 0 ${nf} ${nw} 0 0 0`, 'ROPD 2', 'PICB 1');
    out.push('XFLN ' + pad(s.fields.map(f => f.x || 0)), 'YFLN ' + pad(s.fields.map(f => f.y || 0)), 'FWGN ' + pad(s.fields.map(f => f.w ?? 1)));
    const V = k => s.fields.map(f => +f[k] || 0);
    out.push('VDXN ' + pad(s.fields.map(f => ((+f.vlx || 0) - (+f.vux || 0)) / 2)), 'VDYN ' + pad(s.fields.map(f => ((+f.vly || 0) - (+f.vuy || 0)) / 2)),
      'VCXN ' + pad(s.fields.map(f => ((+f.vlx || 0) + (+f.vux || 0)) / 2)), 'VCYN ' + pad(s.fields.map(f => ((+f.vly || 0) + (+f.vuy || 0)) / 2)), 'VANN ' + pad([]));
    if (V('vuy').some(v => v) || V('vlx').some(v => v)) W.push('Vignetage exporté en VDX, VDY, VCX, VCY (Zemax)');
    if (env.Tref != null && +env.Tref !== 20) W.push('Température de référence de la prescription ≠ 20 °C : non exportée');
    s.wavelengths.forEach((w, i) => out.push(`WAVM ${i + 1} ${fmtN(w.um)} ${fmtN(w.w ?? 1)}`));
    out.push(`PWAV ${s.primary + 1}`, 'POLS 1 0 1 0 0 1 0');
    zs.forEach((z, k) => {
      out.push(`SURF ${k}`);
      if (z.stop) out.push('  STOP');
      out.push(`  TYPE ${z.type}`);
      if (z.comm) out.push(`  COMM ${z.comm}`);
      out.push(`  CURV ${fmtN(z.curv)} 0 0 0 0 ""`, '  HIDE 0 0 0 0 0 0 0 0 0 0', '  MIRR 2 0', `  SLAB ${k + 1}`);
      for (const [pi, pv] of Object.entries(z.parm || {})) out.push(`  PARM ${pi} ${fmtN(pv)}`);
      out.push(`  DISZ ${isFinite(z.disz) ? fmtN(z.disz) : 'INFINITY'}`);
      if (z.glas) out.push('  ' + z.glas);
      if (z.coni) out.push(`  CONI ${fmtN(z.coni)}`);
      if (z.type !== 'COORDBRK') out.push(`  DIAM ${fmtN(z.sd || 0)} ${z.fixed ? 1 : 0} 0 0 1 ""`);
      if (z.fixed && z.sd > 0) out.push(`  CLAP 0 ${fmtN(z.sd)} 0`);
      if (z.tce) out.push(`  TCE ${fmtN(z.tce)}`);
    });
    if (S.some(x => x.tsolve === 'M')) W.push('Solve de mise au point exporté comme épaisseur fixe');
    if ((ap.obscuration || 0) > 0) W.push('Obstruction centrale non exportée');
    if (s.rayAiming) W.push('Visée réelle des rayons : à réactiver dans OpticStudio (System Explorer → Ray Aiming)');
    return { text: out.join('\r\n') + '\r\n', warnings: W };
  }

  return { decode, detect, parseSeq, toSeq, parseZMX, toZMX, fitCauchy };
})();
if (typeof module !== 'undefined') module.exports = IO;
