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
    const code = U.match(/^(\d{3})\.?(\d{2,3})$/);
    if (code) return `${(1 + (+code[1]) / 1000).toFixed(3)}/${(+code[2] / (code[2].length === 3 ? 10 : 1)).toFixed(1)}`;
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
  function parseSeq(txt) {
    const W = [], sys = baseSys();
    let wl = [], wtw = [], fy = [], fxs = [], wtf = [], ftype = 'ang', cur = null, rdn = false, scale = 1, prv = null, pwl = [], aspOver = false;
    const stmts = String(txt).split(/\r?\n/).map(l => l.replace(/!.*$/, '')).join('\n').split(/[;\n]/);
    for (let st of stmts) {
      st = st.trim(); if (!st) continue;
      const q = st.match(/'([^']*)'|"([^"]*)"/), tk = st.split(/\s+/), cmd = tk[0].toUpperCase(), a = tk.slice(1), n = i => num(a[i]);
      if (prv) { // bloc de verres privés
        if (cmd === 'END') { prv = null; continue; }
        if (cmd === 'PWL') { pwl = a.map(Number).filter(isFinite); continue; }
        if (q) { const nm = (q[1] ?? q[2]).trim(), idx = st.slice(q.index + q[0].length).trim().split(/\s+/).map(Number).filter(isFinite);
          const pts = idx.map((v, i) => [(pwl[i] || 587.56) / 1000, v]).filter(p => p[1] > 1);
          if (pts.length) { E.addGlasses([{ name: nm.toUpperCase(), cat: 'PRIVE', f: 'CY', c: fitCauchy(pts), user: true, lmin: Math.min(...pts.map(p => p[0])), lmax: Math.max(...pts.map(p => p[0])) }], true); }
          continue; }
        continue;
      }
      switch (cmd) {
        case 'PRV': prv = true; pwl = []; break;
        case 'TIT': case 'TITLE': sys.title = q ? (q[1] ?? q[2]) : a.join(' '); break;
        case 'LEN': if (q) sys.title = sys.title || (q[1] ?? q[2]); break;
        case 'RDN': rdn = true; break; case 'RDM': rdn = false; break;
        case 'DIM': scale = { M: 1, C: 10, I: 25.4 }[(a[0] || 'M').toUpperCase()] || 1; break;
        case 'EPD': sys.aperture = { type: 'EPD', value: n(0), obscuration: 0 }; break;
        case 'FNO': sys.aperture = { type: 'FNO', value: n(0), obscuration: 0 }; break;
        case 'NAO': sys.aperture = { type: 'NA', value: n(0), obscuration: 0 }; break;
        case 'NA': W.push('Ouverture NA (espace image) non prise en charge : convertie en F/# ≈ 1/(2 NA)'); sys.aperture = { type: 'FNO', value: 1 / (2 * n(0)), obscuration: 0 }; break;
        case 'WL': wl = a.map(Number).filter(isFinite); break;
        case 'WTW': wtw = a.map(Number); break;
        case 'REF': sys.primary = n(0) - 1; break;
        case 'YAN': ftype = 'ang'; fy = a.map(Number).filter(isFinite); break; case 'XAN': fxs = a.map(Number).filter(isFinite); break;
        case 'YOB': ftype = 'obj'; fy = a.map(Number).filter(isFinite); break; case 'XOB': fxs = a.map(Number).filter(isFinite); break;
        case 'YIM': ftype = 'img'; fy = a.map(Number).filter(isFinite); break; case 'XIM': fxs = a.map(Number).filter(isFinite); break;
        case 'WTF': wtf = a.map(Number); break;
        case 'SO': { const t = n(1); sys.surfaces.push(S0({ t: !isFinite(t) || Math.abs(t) > 1e10 ? Infinity : t, comment: 'Objet', glass: a[2] ? mapGlass(a[2], NaN, NaN, W, 'Objet') : '' })); cur = null; break; }
        case 'S': case 'STO': case 'SI': {
          if (!sys.surfaces.length) sys.surfaces.push(S0({ t: Infinity, comment: 'Objet' }));
          let rv = n(0); if (rdn) rv = rv ? 1 / rv : 0;
          const s = S0({ r: !rv ? Infinity : rv, t: cmd === 'SI' ? 0 : (isFinite(n(1)) ? n(1) : 0), stop: cmd === 'STO' });
          if (cmd !== 'SI' && a[2]) s.glass = mapGlass(st.match(/'[^']*'/) ? st.match(/'[^']*'/)[0] : a[2], NaN, NaN, W, `S${sys.surfaces.length}`);
          if (cmd === 'SI') s.comment = 'Image';
          sys.surfaces.push(s); cur = s; break;
        }
        case 'K': if (cur) cur.k = n(0); break;
        case 'A': if (cur) cur.a4 = n(0); break; case 'B': if (cur) cur.a6 = n(0); break; case 'C': if (cur) cur.a8 = n(0); break; case 'D': if (cur) cur.a10 = n(0); break;
        case 'E': case 'F': case 'G': case 'H': case 'J': if (cur && n(0)) aspOver = true; break;
        case 'CIR': if (cur) { cur.sd = n(0); cur.sdFixed = true; } break;
        case 'THI': if (cur) cur.t = n(0); break;
        case 'RDY': if (cur) cur.r = n(0) ? n(0) : Infinity; break;
        case 'CUY': if (cur) cur.r = n(0) ? 1 / n(0) : Infinity; break;
        case 'GLA': if (cur) cur.glass = mapGlass(q ? q[0] : a[0], NaN, NaN, W, 'GLA'); break;
        case 'REFL': if (cur) cur.glass = 'MIRROR'; break;
        case 'PIM': if (cur) cur.tsolve = 'M'; break;
        case 'CCY': if (cur && n(0) === 0) cur.vr = true; break;
        case 'THC': if (cur && n(0) === 0) cur.vt = true; break;
        case 'KC': if (cur && n(0) === 0) cur.vk = true; break;
        case 'XDE': if (cur) cur.dx = n(0); break; case 'YDE': if (cur) cur.dy = n(0); break; case 'ZDE': if (cur) cur.dz = n(0); break;
        case 'ADE': if (cur) cur.tx = n(0); break; case 'BDE': if (cur) cur.ty = n(0); break; case 'CDE': if (cur) cur.tz = n(0); break;
        case 'DAR': case 'BEN': if (cur) cur.dmode = cmd; break;
        case 'REV': if (cur) { cur.dmode = 'DAR'; W.push(`S${sys.surfaces.indexOf(cur)} : décentrement REV converti en DAR`); } break;
        case 'GRT': if (cur) { cur.elem = 'grating'; cur.lpmm = cur.lpmm || 600; cur.gm = cur.gm ?? 1; } break;
        case 'GRO': if (cur) cur.gm = n(0); break;
        case 'GRS': if (cur && n(0)) cur.lpmm = 1 / n(0); break;
        case 'GRX': if (cur) cur._grx = n(0); break; case 'GRY': if (cur) cur._gry = n(0); break;
        case 'SLB': case 'GO': case 'INI': case 'RDM;LEN': case 'ASP': case 'CON': case 'SPH': case 'WTW;': case 'VUY': case 'VLY': case 'VUX': case 'VLX': case 'CA': case 'PWL': case 'END': case 'INS': case 'SAV': break;
        default: if (/^[A-Z]{2,4}$/.test(cmd) && !['STO', 'S'].includes(cmd)) { if (!W.some(w => w.includes(`« ${cmd} »`))) W.push(`Commande CODE V « ${cmd} » ignorée`); }
      }
    }
    if (aspOver) W.push('Coefficients asphériques d\'ordre > 10 (E…J) ignorés');
    if (sys.surfaces.length < 3) throw new Error('Fichier .seq : aucune surface trouvée');
    const last = sys.surfaces[sys.surfaces.length - 1]; if (last.comment !== 'Image') sys.surfaces.push(S0({ t: 0, comment: 'Image' }));
    for (const s of sys.surfaces) { if (s._grx != null || s._gry != null) { s.gang = Math.atan2(-(s._grx || 0), s._gry ?? 1) * 180 / Math.PI; } delete s._grx; delete s._gry; }
    sys.wavelengths = (wl.length ? wl : [587.56]).map((v, i) => ({ um: v / 1000, w: wtw[i] ?? 1 }));
    sys.primary = Math.max(0, Math.min(sys.primary, sys.wavelengths.length - 1));
    sys.fields = (fy.length ? fy : [0]).map((v, i) => ({ x: fxs[i] || 0, y: v, w: wtf[i] ?? 1 }));
    if (!sys.surfaces.some(s => s.stop)) { sys.surfaces[1].stop = true; W.push('Pas de diaphragme (STO) : surface 1 utilisée'); }
    if (scale !== 1) { scaleSys(sys, scale); W.push(`Unités converties en mm (×${scale})`); }
    fixFields(sys, ftype, W);
    return { sys, warnings: W };
  }

  /** met les champs dans la convention Focale : angles si objet à l'infini, hauteurs objet sinon */
  function fixFields(sys, ftype, W) {
    const S = sys.surfaces, inf = !isFinite(S[0].t) || Math.abs(S[0].t) > 1e10;
    if (ftype === 'img') {
      try { const tmp = structuredClone(sys); tmp.fields = [{ x: 0, y: 0 }]; const M = E.prepare(tmp);
        if (M.ok) { const k = inf ? M.par.efl : M.par.mag; sys.fields = sys.fields.map(f => inf ? { ...f, x: Math.atan(f.x / k) * 180 / Math.PI, y: Math.atan(f.y / k) * 180 / Math.PI } : { ...f, x: f.x / k, y: f.y / k }); }
        W.push('Champs définis en hauteur image : convertis par l\'optique paraxiale (vérifiez-les)');
      } catch (e) { W.push('Champs en hauteur image non convertis'); }
    } else if (ftype === 'ang' && !inf) { sys.fields = sys.fields.map(f => ({ ...f, x: S[0].t * Math.tan(f.x * Math.PI / 180), y: S[0].t * Math.tan(f.y * Math.PI / 180) })); W.push('Champs en angle avec objet à distance finie : convertis en hauteurs objet'); }
    else if (ftype === 'obj' && inf) W.push('Champs en hauteur objet avec objet à l\'infini : interprétés comme des angles');
  }
  function scaleSys(sys, k) {
    for (const s of sys.surfaces) {
      if (isFinite(s.r)) s.r *= k; if (isFinite(s.t)) s.t *= k; s.sd *= k; s.dx *= k; s.dy *= k; s.dz *= k;
      s.a4 *= Math.pow(k, -3); s.a6 *= Math.pow(k, -5); s.a8 *= Math.pow(k, -7); s.a10 *= Math.pow(k, -9);
      if (s.lpmm) s.lpmm /= k; if (s.fid) s.fid *= k;
    }
    if (sys.aperture.type === 'EPD') sys.aperture.value *= k;
    if (!(isFinite(sys.surfaces[0].t) && Math.abs(sys.surfaces[0].t) < 1e10)) return;
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
      if (x.k || x.a4 || x.a6 || x.a8 || x.a10) { body.push(x.a4 || x.a6 || x.a8 || x.a10 ? '  ASP' : '  CON'); body.push(`  K ${fmtN(x.k || 0)}`); if (x.a4 || x.a6 || x.a8 || x.a10) body.push(`  A ${fmtN(x.a4 || 0)}; B ${fmtN(x.a6 || 0)}; C ${fmtN(x.a8 || 0)}; D ${fmtN(x.a10 || 0)}`); }
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
    L.push(ap.type === 'FNO' ? `FNO ${ap.value}` : ap.type === 'NA' ? `NAO ${ap.value}` : `EPD ${ap.value}`, 'DIM M');
    L.push('WL ' + wls.map(l => (l * 1000).toFixed(4)).join(' '), `REF ${s.primary + 1}`, 'WTW ' + s.wavelengths.map(w => w.w ?? 1).join(' '));
    L.push('INI \'FOC\'', (objInf ? 'XAN ' : 'XOB ') + s.fields.map(f => f.x || 0).join(' '));
    L.push((objInf ? 'YAN ' : 'YOB ') + s.fields.map(f => f.y).join(' '), 'WTF ' + s.fields.map(f => f.w ?? 1).join(' '));
    if (priv.size) { L.push('PRV', 'PWL ' + wls.map(l => (l * 1000).toFixed(4)).join(' ')); for (const [nm, ns] of priv) L.push(`'${nm}' ${ns.map(v => v.toFixed(6)).join(' ')}`); L.push('END'); W.push(`${priv.size} verre(s) fictif(s) ou importé(s) exporté(s) en verres privés PRV`); }
    if ((ap.obscuration || 0) > 0) W.push('Obstruction centrale non exportée');
    return { text: [...L, ...body, 'GO'].join('\n'), warnings: W };
  }

  /* =====================================================================
     Zemax OpticStudio (.zmx, mode séquentiel)
     ===================================================================== */
  function parseZMX(txt) {
    const W = [], sys = baseSys(), raw = [];
    let cur = null, unit = 1, ftype = 0, nf = null, nw = null, xf = [], yf = [], fw = [], wavm = [], wavl = [], wwgt = [], pwav = 1, floa = false;
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
        if (/^(HIDE|MIRR|SLAB|POPS|MAZH|PZUP|LANG|FLWR|COAT|TOL|VDSZ|VCRV|VPAR|PPAR|CONF|BLNK|MNUM|MOFF|TCE|EDGE)$/.test(cmd)) continue;
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
      if (r.diam > 0) s.sd = r.diam;
      if (r.clap > 0) { s.sd = r.clap; s.sdFixed = true; }
      if (r.glas) s.glass = r.glas.toUpperCase() === '___BLANK' ? (r.gvd > 0 ? `${g10(r.gnd)}/${g10(r.gvd)}` : String(g10(r.gnd))) : mapGlass(r.glas, r.gnd, r.gvd, W, `S${i}`);
      switch (r.type) {
        case 'STANDARD': break;
        case 'EVENASPH': s.a4 = r.parm[2] || 0; s.a6 = r.parm[3] || 0; s.a8 = r.parm[4] || 0; s.a10 = r.parm[5] || 0;
          if (r.parm[1]) W.push(`S${i} : terme asphérique en r² (${r.parm[1]}) ignoré`); if ([6, 7, 8].some(k => r.parm[k])) W.push(`S${i} : termes asphériques d'ordre > 10 ignorés`); break;
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
    sys.fields = Array.from({ length: n }, (_, i) => ({ x: xf[i] || 0, y: yf[i] || 0, w: isFinite(fw[i]) ? fw[i] : 1 }));
    if (!sys.surfaces.some(s => s.stop)) { sys.surfaces[1].stop = true; W.push('Pas de diaphragme : surface 1 utilisée'); }
    if (unit !== 1) { scaleSys(sys, unit); W.push(`Unités converties en mm (×${unit})`); }
    fixFields(sys, ftype === 0 ? 'ang' : ftype === 1 ? 'obj' : 'img', W);
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
      if (x.a4 || x.a6 || x.a8 || x.a10) { surf.type = 'EVENASPH'; surf.parm = { 1: 0, 2: x.a4 || 0, 3: x.a6 || 0, 4: x.a8 || 0, 5: x.a10 || 0 }; }
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
    out.push(ap.type === 'FNO' ? `FNUM ${fmtN(ap.value)} 0` : ap.type === 'NA' ? `OBNA ${fmtN(ap.value)} 0` : `ENPD ${fmtN(ap.value)}`);
    out.push('ENVD 2.0E+1 1 0', 'GFAC 0 0', `GCAT ${[...new Set(['SCHOTT', ...cats])].join(' ')}`);
    const nf = s.fields.length, nw = s.wavelengths.length;
    out.push(`FTYP ${objInf ? 0 : 1} 0 ${nf} ${nw} 0 0 0`, 'ROPD 2', 'PICB 1');
    out.push('XFLN ' + pad(s.fields.map(f => f.x || 0)), 'YFLN ' + pad(s.fields.map(f => f.y || 0)), 'FWGN ' + pad(s.fields.map(f => f.w ?? 1)));
    for (const k of ['VDXN', 'VDYN', 'VCXN', 'VCYN', 'VANN']) out.push(k + ' ' + pad([]));
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
    });
    if (S.some(x => x.tsolve === 'M')) W.push('Solve de mise au point exporté comme épaisseur fixe');
    if ((ap.obscuration || 0) > 0) W.push('Obstruction centrale non exportée');
    if (s.rayAiming) W.push('Visée réelle des rayons : à réactiver dans OpticStudio (System Explorer → Ray Aiming)');
    return { text: out.join('\r\n') + '\r\n', warnings: W };
  }

  return { decode, detect, parseSeq, toSeq, parseZMX, toZMX, fitCauchy };
})();
if (typeof module !== 'undefined') module.exports = IO;
