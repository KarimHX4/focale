/* Focale 25145990 — module assistant facultatif */
/* Focale — assistant en langage naturel (module FACULTATIF, chargé à la demande).
   Le logiciel fonctionne sans ce fichier. Moteurs : Ollama (local), WebLLM (dans le navigateur, WebGPU) ou règles (sans IA).
   Le modèle ne calcule rien : il traduit la demande en actions de Focale ; les calculs optiques restent ceux du moteur. */
(() => {
  'use strict';
  if (window.ASST) return;
  const LS = 'focale.asst';
  const DEF = { backend: 'auto', ollamaUrl: 'http://localhost:11434', ollamaModel: '', webllmModel: 'Qwen2.5-3B-Instruct-q4f16_1-MLC', confirm: true, history: 2, rulesFirst: true, nativeTools: true, win: { docked: true, w: 420, left: null, top: null, h: null } };
  const A = window.ASST = { cfg: { ...DEF }, log: [], busy: false, engine: null, engineId: null, abort: null, active: null, ollamaModels: [] };
  try { Object.assign(A.cfg, JSON.parse(localStorage.getItem(LS) || '{}')); } catch (e) { }
  A.cfg.win = { ...DEF.win, ...(A.cfg.win || {}) };
  const saveCfg = () => { try { localStorage.setItem(LS, JSON.stringify(A.cfg)); } catch (e) { } };
  const WEBLLM_URL = 'https://esm.run/@mlc-ai/web-llm@0.2';
  const WEBLLM_MODELS = [
    ['Qwen2.5-3B-Instruct-q4f16_1-MLC', 'Qwen 2.5 3B (≈ 2,5 Go, recommandé)'],
    ['Qwen3-4B-q4f16_1-MLC', 'Qwen 3 4B (≈ 3,5 Go, meilleur, carte graphique solide)'],
    ['Qwen3-1.7B-q4f16_1-MLC', 'Qwen 3 1.7B (≈ 2 Go, rapide, moins fiable)'],
    ['Llama-3.2-3B-Instruct-q4f16_1-MLC', 'Llama 3.2 3B (≈ 2,3 Go)'],
    ['Qwen2.5-7B-Instruct-q4f16_1-MLC', 'Qwen 2.5 7B (≈ 5 Go, carte graphique dédiée)'],
  ];
  const OLLAMA_REC = ['qwen3:4b-instruct', 'qwen3:4b', 'qwen3:8b', 'qwen2.5:7b', 'qwen2.5:3b', 'llama3.2:3b'];

  /* ================= Contexte : description compacte du système ================= */
  const S = () => App.sys, Ns = () => S().surfaces.length - 1;
  const r2 = (v, d = 4) => v == null || !isFinite(v) ? (v === Infinity || v === -Infinity ? 'plan' : '—') : String(+(+v).toPrecision(d));
  /** lentilles : couples (Sj, Sj+1) dont le milieu après Sj est un verre */
  function lenses(sys = S()) {
    const L = [], s = sys.surfaces, N = s.length - 1;
    for (let j = 1; j < N; j++) if (!OE.isAir(s[j].glass) && !OE.isMirror(s[j])) L.push({ n: L.length + 1, a: j, b: j + 1, glass: s[j].glass, cem: j > 1 && !OE.isAir(s[j - 1].glass) && !OE.isMirror(s[j - 1]) });
    return L;
  }
  const mirrors = (sys = S()) => sys.surfaces.map((x, j) => [x, j]).filter(([x, j]) => j > 0 && OE.isMirror(x)).map(([x, j]) => j);
  function shape(sys, l) { const c1 = OE.curv(sys.surfaces[l.a]), c2 = OE.curv(sys.surfaces[l.b]); const p = (c1 - c2); if (Math.abs(c1) < 1e-9 || Math.abs(c2) < 1e-9) return p > 0 ? 'plan-convexe' : 'plan-concave'; if (c1 > 0 && c2 < 0) return 'biconvexe'; if (c1 < 0 && c2 > 0) return 'biconcave'; return p > 0 ? 'ménisque convergent' : 'ménisque divergent'; }
  function summary() {
    const s = S(), M = App.M, N = Ns(), objInf = !isFinite(s.surfaces[0].t), W = s.wavelengths, cen = OE.wlSel(s, 'central')[0];
    const L = [];
    L.push(`Titre : ${s.title || '(sans titre)'}`);
    L.push(`Objet : ${objInf ? 'à l\'infini (champs en degrés)' : `à ${r2(s.surfaces[0].t)} mm (champs = hauteurs en mm)`}. Ouverture : ${s.aperture.type === 'FNO' ? `F/${r2(s.aperture.value)}` : s.aperture.type === 'NA' ? `ON objet ${r2(s.aperture.value)}` : `EPD ${r2(s.aperture.value)} mm`}${s.aperture.obscuration ? `, obstruction ${r2(s.aperture.obscuration)}` : ''}.`);
    const ft = OE.FTYPES[s.ftype] ? s.ftype : (objInf ? 'ang' : 'obj');
    L.push(`Champs (${OE.FTYPES[ft].l.toLowerCase()}) : ${s.fields.map((f, i) => `F${i + 1}=${f.x ? `(${r2(f.x)}, ${r2(f.y)})` : r2(f.y)}${ft === 'ang' ? '°' : ' mm'}`).join(', ')}.`);
    if (s.env && (+s.env.T !== 20 || +s.env.P !== 1)) L.push(`Environnement : ${s.env.T ?? 20} °C, ${s.env.P ?? 1} atm.`);
    L.push(`Longueurs d'onde : ${W.map((w, i) => `λ${i + 1}=${r2(w.um * 1000, 5)} nm${i === (s.primary | 0) ? ' (primaire)' : ''}${i === cen ? ' (centrale)' : ''}`).join(', ')}.`);
    if (M && M.ok) L.push(`Paraxial : EFL ${r2(M.par.efl, 5)} mm, F/# travail ${r2(M.par.wfno)}, EPD ${r2(M.par.epd)} mm, TTL ${r2(M.par.ttl, 5)} mm, distance image ${r2(M.par.imgDist, 5)} mm.`);
    else L.push('Système actuellement INVALIDE (rayons non tracés).');
    L.push('Surfaces (n° : rayon mm | épaisseur après mm | milieu après | remarques) :');
    s.surfaces.forEach((x, j) => {
      const tags = [j === 0 ? 'objet' : '', j === N ? 'image' : '', x.stop ? 'diaphragme' : '', OE.isMirror(x) ? 'miroir' : '', x.k ? `conique ${r2(x.k)}` : '', x.elem && x.elem !== 'refr' ? x.elem : '', x.tsolve === 'M' ? 'épaisseur pilotée (solve M)' : '', x.comment ? `« ${x.comment} »` : '',
        [x.vr ? 'R' : '', x.vt ? 'T' : '', x.vk ? 'K' : '', x.vg ? 'verre' : ''].filter(Boolean).length ? `variables ${[x.vr ? 'R' : '', x.vt ? 'T' : '', x.vk ? 'K' : '', x.vg ? 'verre' : ''].filter(Boolean).join('+')}` : ''].filter(Boolean).join(', ');
      L.push(`S${j} : ${j === 0 ? '—' : r2(x.r, 6)} | ${j === N ? '—' : r2(M && M.ok ? M.S[j].t : x.t, 6)} | ${OE.isAir(x.glass) ? 'air' : x.glass}${tags ? ' | ' + tags : ''}`);
    });
    const Ls = lenses(s), Mi = mirrors(s);
    L.push(Ls.length ? `Lentilles (numérotées de l'objet vers l'image) : ${Ls.map(l => `L${l.n} = S${l.a}–S${l.b} (${l.glass}, ${shape(s, l)}${l.cem ? ', collée à la précédente' : ''})`).join(' ; ')}.` : 'Aucune lentille.');
    if (Mi.length) L.push(`Miroirs : ${Mi.map((j, i) => `M${i + 1} = S${j}`).join(', ')}.`);
    const mf = s.merit; L.push(`Fonction de mérite : critère ${mf.image}${mf.wl && mf.wl !== 'all' ? ` (λ ${mf.wl})` : ''} ; opérandes : ${mf.ops.length ? mf.ops.map(o => `${o.type} ${({ eq: '=', ge: '≥', le: '≤' })[o.cmp || (OE.OPS[o.type] || {}).kind] || '='} ${r2(o.target)}`).join(', ') : 'aucun'}.`);
    if (M && M.ok) { try { L.push(`Qualité : spot RMS (µm) par champ ${s.fields.map((_, i) => r2(OE.spot(M, i, 15).rms * 1e3, 3)).join(' / ')}.`); } catch (e) { } }
    return L.join('\n');
  }

  /* ================= Outils (actions de Focale) ================= */
  const num = (v, name) => { const x = typeof v === 'string' ? (/^(inf|infini|plan|∞)$/i.test(v.trim()) ? Infinity : parseFloat(v.replace(',', '.'))) : +v; if (!(isFinite(x) || x === Infinity)) throw new Error(`valeur numérique attendue pour ${name}`); return x; };
  const surfIdx = (v, { img = false, obj = false } = {}) => { const j = Math.round(num(v, 'surface')), N = Ns(); if (j < (obj ? 0 : 1) || j > (img ? N : N - 1)) throw new Error(`surface ${j} inexistante (surfaces 1 à ${img ? N : N - 1})`); return j; };
  /** résout un nom de verre : exact, puis approché (« BK7 » → N-BK7) */
  function resolveGlass(g) {
    const t = String(g ?? '').trim(); if (!t || /^air$/i.test(t)) return '';
    if (/^miroir|mirror$/i.test(t)) return 'MIRROR';
    if (OE.parseModel(t) || OE.glassRecord(t)) return OE.glassKey(t) || t;
    const k = t.toUpperCase().replace(/[\s_-]/g, ''), all = OE.catalog();
    const hit = all.find(x => x.name.toUpperCase().replace(/[\s_-]/g, '') === 'N' + k) || all.find(x => x.base && x.base.toUpperCase().replace(/[\s_-]/g, '') === k);
    if (hit) return hit.name;
    // faute de frappe sur le nom : distance d'édition ≤ 1 (≤ 2 dès 7 caractères) sur le nom normalisé, si un seul verre est le plus proche
    const nk = x => x.toUpperCase().replace(/[\s_-]/g, ''), tol = k.length >= 7 ? 2 : 1; let best = [], bd = tol + 1;
    for (const x of all) for (const cand of [nk(x.name), x.base ? nk(x.base) : null]) { if (!cand) continue; const d = dl(k, cand, tol); if (d < bd) { bd = d; best = [x.name]; } else if (d === bd && !best.includes(x.name)) best.push(x.name); }
    if (best.length === 1) return best[0];
    if (best.length > 1) { const pref = best.find(n => /^N-/.test(n) && nk(n).endsWith(k.slice(-3))); if (pref && best.filter(n => /^N-/.test(n)).length === 1) return pref; }
    const near = (best.length ? best : all.filter(x => nk(x.name).includes(k)).map(x => x.name)).slice(0, 5);
    throw new Error(`verre inconnu « ${t} »${near.length ? ` (proches : ${near.join(', ')})` : ''}`);
  }
  const lensOf = n => { const L = lenses(), l = L[Math.round(num(n, 'lentille')) - 1]; if (!l) throw new Error(`lentille ${n} inexistante (${L.length} lentille(s))`); return l; };
  const fixStop = s => { if (!s.surfaces.some(x => x.stop)) s.surfaces[Math.min(1, s.surfaces.length - 2)].stop = true; };
  const metrics = () => { const M = OE.prepare(S()); if (!M.ok) return 'système invalide'; const sp = S().fields.map((_, i) => OE.spot(M, i, 15).rms * 1e3); return `EFL ${r2(M.par.efl, 5)} mm, F/# ${r2(M.par.wfno)}, TTL ${r2(M.par.ttl, 5)} mm, spot RMS ${sp.map(v => r2(v, 3)).join(' / ')} µm`; };
  const merit = () => { const r = OE.residuals(S()); return r ? OE.meritOf(r.f) : NaN; };
  async function optimizeLoop(maxIt = 100) {
    const st = { sys: structuredClone(S()), mu: 1e-3 }, m0 = merit(); let r, n = 0, t = performance.now();
    if (!OE.getVars(st.sys).length) throw new Error('aucune variable définie (utilisez set_variables)');
    do { r = OE.optStep(st); n++; if (performance.now() - t > 60) { await tick(); t = performance.now(); if (A.stop) break; } } while (!r.done && n < maxIt);
    App.sys = st.sys; App.M = OE.prepare(App.sys); return `mérite ${r2(m0, 4)} → ${r2(merit(), 4)} en ${n} itérations`;
  }
  /** doublet achromatique (lentilles minces) : répartition des puissances φ1 = φV1/(V1−V2), φ2 = −φV2/(V1−V2) */
  function makeDoublet({ f = 100, fno = 5, field = 2, crown = 'N-BK7', flint = 'N-SF5', cemented = true }) {
    f = num(f, 'focale'); fno = num(fno, 'F/#'); field = Math.abs(num(field, 'champ'));
    if (!(f > 0)) throw new Error('focale positive attendue'); if (!(fno >= 1)) throw new Error('F/# ≥ 1 attendu');
    const c = resolveGlass(crown), l = resolveGlass(flint), gc = OE.glassInfo(c), gl = OE.glassInfo(l);
    if (!(gc.vd > gl.vd + 5)) throw new Error(`la couronne (${c}, νd ${r2(gc.vd)}) doit avoir une constringence nettement plus grande que le flint (${l}, νd ${r2(gl.vd)})`);
    const phi = 1 / f, p1 = phi * gc.vd / (gc.vd - gl.vd), p2 = -phi * gl.vd / (gc.vd - gl.vd), D = f / fno;
    const R1 = 2 * (gc.nd - 1) / p1, R2 = -R1, inv3 = 1 / R2 - p2 / (gl.nd - 1), R3 = Math.abs(inv3) < 1e-9 ? Infinity : 1 / inv3;
    const sag = (R, h) => isFinite(R) ? Math.abs(R) - Math.sqrt(Math.max(0, R * R - h * h)) : 0, h = D / 2 * 1.05;
    const t1 = Math.max(2, +(sag(R1, h) + sag(R2, h) + 1.5).toFixed(2)), t2 = Math.max(1.5, +(1.2 + sag(R2, h) * 0.3).toFixed(2));
    const sf = (o) => newSurf(o), surf = [sf({ r: Infinity, t: Infinity, comment: 'Objet' }), sf({ r: R1, t: t1, glass: c, stop: true, comment: 'Couronne' })];
    if (cemented) surf.push(sf({ r: R2, t: t2, glass: l, comment: 'Flint' }), sf({ r: R3, t: f, tsolve: 'M' }));
    else surf.push(sf({ r: R2, t: 0.5 }), sf({ r: R2 * 1.02, t: t2, glass: l, comment: 'Flint' }), sf({ r: R3, t: f, tsolve: 'M' }));
    surf.push(sf({ r: Infinity, t: 0, comment: 'Image' }));
    const sys = { title: `Doublet achromatique ${c} / ${l} f=${r2(f)} mm F/${r2(fno)}`, aperture: { type: 'EPD', value: +D.toFixed(4), obscuration: 0 }, fieldType: 'angle',
      fields: field ? [{ y: 0, w: 1 }, { y: +(0.7 * field).toFixed(4), w: 1 }, { y: field, w: 1 }] : [{ y: 0, w: 1 }], wavelengths: [{ um: 0.4861327, w: 1 }, { um: 0.5875618, w: 1 }, { um: 0.6562725, w: 1 }], primary: 1, rayAiming: false,
      merit: { image: 'SPOT', wl: 'all', ops: [{ type: 'EFL', target: f, weight: 1 }, { type: 'MNET', target: 1, weight: 1 }, { type: 'MNCT', target: 1.5, weight: 1 }] }, surfaces: surf };
    sys.surfaces.forEach((x, j) => { if (j >= 1 && j <= sys.surfaces.length - 3) x.vr = true; });
    return sys;
  }
  function makeSinglet({ f = 100, fno = 5, field = 2, glass = 'N-BK7', form = 'plan-convexe' }) {
    f = num(f, 'focale'); fno = num(fno, 'F/#'); field = Math.abs(num(field, 'champ')); const g = resolveGlass(glass), n = OE.glassInfo(g).nd, D = f / fno;
    const bi = /bi/.test(form), R1 = bi ? 2 * (n - 1) * f : (n - 1) * f, R2 = bi ? -R1 : Infinity, t = Math.max(2, +(D * D / 8 / Math.abs(R1) * (bi ? 2 : 1) + 1.5).toFixed(2));
    return { title: `Lentille ${form} ${g} f=${r2(f)} mm F/${r2(fno)}`, aperture: { type: 'EPD', value: +D.toFixed(4), obscuration: 0 }, fieldType: 'angle',
      fields: field ? [{ y: 0, w: 1 }, { y: +(0.7 * field).toFixed(4), w: 1 }, { y: field, w: 1 }] : [{ y: 0, w: 1 }], wavelengths: [{ um: 0.4861327, w: 1 }, { um: 0.5875618, w: 1 }, { um: 0.6562725, w: 1 }], primary: 1, rayAiming: false,
      merit: { image: 'SPOT', wl: 'all', ops: [{ type: 'EFL', target: f, weight: 1 }] },
      surfaces: [newSurf({ r: Infinity, t: Infinity, comment: 'Objet' }), newSurf({ r: R1, t, glass: g, stop: true, vr: true }), newSurf({ r: R2, t: f, tsolve: 'M', vr: bi }), newSurf({ r: Infinity, t: 0, comment: 'Image' })] };
  }
  const WPRE = { FdC: [486.1327, 587.5618, 656.2725], visible: [450, 500, 550, 600, 650], HeNe: [632.8], NIR: [800, 900, 1000], d: [587.5618], e: [546.074] };
  /** tool : { d: description pour le modèle, a: arguments, m: modifie le système, run(args) → texte (async possible) } */
  const TOOLS = {
    set_surface: { d: 'Modifie une surface', a: '{s, radius?, thickness?, glass?, conic?, comment?}', m: 1, run(a) {
      const j = surfIdx(a.s), x = S().surfaces[j], ch = [];
      if (a.radius != null) { x.r = num(a.radius, 'rayon'); if (x.r === 0) x.r = Infinity; ch.push(`R=${r2(x.r, 6)}`); }
      if (a.thickness != null) { x.t = num(a.thickness, 'épaisseur'); x.tsolve = ''; ch.push(`T=${r2(x.t, 6)}`); }
      if (a.glass != null) { x.glass = resolveGlass(a.glass); x.vg = false; ch.push(`verre ${x.glass || 'air'}`); }
      if (a.conic != null) { x.k = num(a.conic, 'conique'); ch.push(`K=${r2(x.k)}`); }
      if (a.comment != null) { x.comment = String(a.comment); ch.push(`« ${x.comment} »`); }
      return `S${j} : ${ch.join(', ') || 'inchangée'}`; } },
    set_lens_glass: { d: 'Change le verre d\'une lentille (numérotation L1, L2… du résumé)', a: '{lens, glass}', m: 1, run(a) { const l = lensOf(a.lens), g = resolveGlass(a.glass); if (!g) throw new Error('une lentille doit avoir un verre'); S().surfaces[l.a].glass = g; S().surfaces[l.a].vg = false; return `L${l.n} (S${l.a}–S${l.b}) : ${l.glass} → ${g}`; } },
    insert_surface: { d: 'Insère une surface après la surface donnée', a: '{after, radius?, thickness?, glass?}', m: 1, run(a) { const j = surfIdx(a.after, { obj: true }); S().surfaces.splice(j + 1, 0, newSurf({ r: a.radius != null ? num(a.radius, 'rayon') || Infinity : Infinity, t: a.thickness != null ? num(a.thickness, 'épaisseur') : 5, glass: a.glass ? resolveGlass(a.glass) : '' })); return `surface insérée en S${j + 1}`; } },
    delete_surface: { d: 'Supprime une surface', a: '{s}', m: 1, run(a) { const j = surfIdx(a.s); if (Ns() <= 2) throw new Error('il faut au moins une surface'); const st = S().surfaces[j].stop; S().surfaces.splice(j, 1); if (st) fixStop(S()); return `S${j} supprimée`; } },
    delete_lens: { d: 'Supprime une lentille (ses deux surfaces)', a: '{lens}', m: 1, run(a) { const l = lensOf(a.lens); const st = S().surfaces[l.a].stop || S().surfaces[l.b].stop; S().surfaces.splice(l.a, l.cem ? 1 : 2); if (st) fixStop(S()); return `L${l.n} supprimée`; } },
    add_lens: { d: 'Ajoute une lentille mince de focale f après une surface', a: '{after?, f?, glass?, thickness?}', m: 1, run(a) {
      const j = a.after != null ? surfIdx(a.after, { obj: true }) : Math.min(App.sel, Ns() - 1), g = resolveGlass(a.glass || 'N-BK7'), n = OE.glassInfo(g).nd, f = a.f != null ? num(a.f, 'focale') : 50, R = 2 * (n - 1) * f, t = a.thickness != null ? num(a.thickness, 'épaisseur') : 4;
      S().surfaces.splice(j + 1, 0, newSurf({ r: R, t, glass: g, comment: 'Lentille' }), newSurf({ r: -R, t: 5 })); return `lentille ${g} f≈${r2(f)} mm insérée en S${j + 1}–S${j + 2}`; } },
    set_aperture: { d: 'Ouverture : EPD (mm), FNO (F/#) ou NA (objet fini)', a: '{type, value}', m: 1, run(a) { const t = String(a.type || 'EPD').toUpperCase().replace('F/#', 'FNO').replace('F#', 'FNO'); if (!['EPD', 'FNO', 'NA'].includes(t)) throw new Error('type d\'ouverture EPD, FNO ou NA'); S().aperture = { ...S().aperture, type: t, value: num(a.value, 'ouverture') }; return `ouverture ${t} ${r2(S().aperture.value)}`; } },
    set_object: { d: 'Objet à l\'infini ou à distance finie (mm)', a: '{infinite, distance?}', m: 1, run(a) { const x = S().surfaces[0]; if (a.infinite === true || a.infinite === 'true') { x.t = Infinity; S().fieldType = 'angle'; return 'objet à l\'infini'; } x.t = num(a.distance, 'distance'); S().fieldType = 'height'; if (S().aperture.type === 'FNO') { } return `objet à ${r2(x.t)} mm`; } },
    set_fields: { d: 'Remplace les champs (degrés si objet à l\'infini, mm sinon) ; « max » seul → 0, 0,7·max, max', a: '{values? , max?}', m: 1, run(a) { let v = Array.isArray(a.values) ? a.values.map(x => num(x, 'champ')) : null; if (!v && a.max != null) { const m = num(a.max, 'champ'); v = [0, +(0.7 * m).toFixed(4), m]; } if (!v || !v.length) throw new Error('valeurs de champ attendues'); const old = S().fields; S().fields = v.map((y, i) => ({ x: 0, y, w: 1, ...(old[i] && old[i].col ? { col: old[i].col } : {}) })); return `champs ${v.join(', ')}`; } },
    set_wavelengths: { d: 'Longueurs d\'onde : preset FdC|visible|HeNe|NIR|d|e ou values_nm, primary (n° 1…)', a: '{preset?, values_nm?, primary?}', m: 1, run(a) { const v = a.values_nm ? a.values_nm.map(x => num(x, 'λ')) : WPRE[a.preset]; if (!v || !v.length) throw new Error('preset inconnu ou valeurs manquantes'); S().wavelengths = v.map(nm => ({ um: (nm > 30 ? nm / 1000 : nm), w: 1 })); S().primary = a.primary != null ? Math.min(v.length - 1, Math.max(0, Math.round(num(a.primary, 'primaire')) - 1)) : OE.wlSel(S(), 'central')[0]; return `λ ${v.map(x => r2(x > 30 ? x : x * 1000, 6)).join(', ')} nm`; } },
    set_stop: { d: 'Place le diaphragme sur une surface', a: '{s}', m: 1, run(a) { const j = surfIdx(a.s); S().surfaces.forEach((x, k) => x.stop = k === j); return `diaphragme en S${j}`; } },
    set_variables: { d: 'Variables d\'optimisation : targets = "radii" | "thicknesses" | "air" | "glasses" | "all" | liste ["R1","T2","K3","G2"] ; clear=true retire tout avant', a: '{targets, clear?}', m: 1, run(a) {
      const s = S(), N = Ns(), out = [];
      if (a.clear) s.surfaces.forEach(x => { x.vr = x.vt = x.vk = x.vg = false; for (const k of ['a4', 'a6', 'a8', 'a10']) x['v' + k] = false; });
      const T = Array.isArray(a.targets) ? a.targets : [a.targets];
      for (const t of T) {
        const u = String(t || '').trim(), m = u.match(/^([RTKG])\s*(\d+)$/i);
        if (m) { const j = surfIdx(m[2]), x = s.surfaces[j], k = m[1].toUpperCase(); if (k === 'R') x.vr = true; if (k === 'T') { x.vt = true; if (x.tsolve === 'M') x.tsolve = ''; } if (k === 'K') x.vk = true; if (k === 'G') { if (OE.isAir(x.glass) || OE.isMirror(x)) throw new Error(`S${j} n'est pas suivie d'un verre`); x.vg = true; if (!OE.parseModel(x.glass)) x.glass = OE.toModel(x.glass); } out.push(k + j); continue; }
        for (let j = 1; j < N; j++) { const x = s.surfaces[j];
          if ((u === 'radii' || u === 'all') && (isFinite(x.r) || j < N)) { x.vr = true; out.push('R' + j); }
          if ((u === 'thicknesses' || u === 'all') && j < N - 1 && !OE.isAir(x.glass)) { x.vt = true; out.push('T' + j); }
          if ((u === 'air' || u === 'all') && j < N - 1 && OE.isAir(x.glass)) { x.vt = true; out.push('T' + j); }
          if (u === 'glasses' && !OE.isAir(x.glass) && !OE.isMirror(x)) { x.vg = true; if (!OE.parseModel(x.glass)) x.glass = OE.toModel(x.glass); out.push('G' + j); } }
      }
      return `variables : ${OE.getVars(s).map(v => ({ c: 'R', t: 'T', k: 'K', nd: 'nd', vd: 'νd' })[v.kind] ? `${({ c: 'R', t: 'T', k: 'K', nd: 'nd ', vd: 'νd ' })[v.kind]}${v.kind === 'nd' || v.kind === 'vd' ? 'S' : ''}${v.si}` : `${v.kind.toUpperCase()} S${v.si}`).join(' ') || 'aucune'}`; } },
    set_merit: { d: 'Fonction de mérite : criterion SPOT|WFE|NONE, wavelength all|central|primary|n°, operands [{type,target,weight?,cmp?(eq|ge|le),p?}], replace=true remplace les opérandes', a: '{criterion?, wavelength?, operands?, replace?}', m: 1, run(a) {
      const mf = S().merit; if (a.criterion) { const c = String(a.criterion).toUpperCase(); if (!['SPOT', 'WFE', 'NONE'].includes(c)) throw new Error('critère SPOT, WFE ou NONE'); mf.image = c; }
      if (a.wavelength != null) { const w = String(a.wavelength); mf.wl = /^\d+$/.test(w) ? Math.max(0, +w - 1) : w; }
      if (a.replace) mf.ops = [];
      for (const o of a.operands || []) { const t = String(o.type || '').toUpperCase(); if (!OE.OPS[t]) throw new Error(`opérande inconnu ${t} (${Object.keys(OE.OPS).join(', ')})`); mf.ops.push({ type: t, target: num(o.target ?? 0, 'cible'), weight: o.weight != null ? num(o.weight, 'poids') : 1, ...(o.cmp ? { cmp: o.cmp } : {}), ...(o.p != null ? { p: num(o.p, 'paramètre') } : OE.OPS[t].p ? { p: OE.OPS[t].pdef } : {}) }); }
      return `mérite : ${mf.image}${mf.wl && mf.wl !== 'all' ? ` (λ ${mf.wl})` : ''}, ${mf.ops.map(o => `${o.type}${({ eq: '=', ge: '≥', le: '≤' })[o.cmp || OE.OPS[o.type].kind]}${r2(o.target)}`).join(' ') || 'aucun opérande'}`; } },
    optimize: { d: 'Lance l\'optimisation locale (moindres carrés amortis)', a: '{iterations?}', m: 1, async run(a) { return 'optimisation : ' + await optimizeLoop(a.iterations ? Math.max(1, Math.min(500, Math.round(num(a.iterations, 'itérations')))) : 100) + ` — ${metrics()}`; } },
    substitute_glasses: { d: 'Remplace les verres variables par les meilleurs verres réels', a: '{catalogs?, preferred?}', m: 1, async run(a) {
      if (a.catalogs || a.preferred != null) S().merit.gsub = { ...(S().merit.gsub || {}), ...(a.catalogs ? { cats: a.catalogs.map(c => String(c).toUpperCase()) } : {}), ...(a.preferred != null ? { pref: !!a.preferred } : {}) };
      if (!S().surfaces.some(x => x.vg)) throw new Error('aucun verre variable (set_variables avec "glasses" ou ["G2"])');
      await runSubst(); return `substitution : ${lenses().map(l => `L${l.n} ${l.glass}`).join(', ')} — ${metrics()}`; } },
    quick_focus: { d: 'Meilleure mise au point (criterion SPOT|WFE, wavelength central|primary|all|n°)', a: '{criterion?, wavelength?}', m: 1, run(a) {
      const o = { crit: String(a.criterion || App.qf.crit || 'SPOT').toUpperCase() === 'WFE' ? 'WFE' : 'SPOT', wl: a.wavelength == null ? 'central' : /^\d+$/.test(String(a.wavelength)) ? Math.max(0, +a.wavelength - 1) : String(a.wavelength) };
      const q = OE.quickFocus(S(), o); if (!isFinite(q.t)) throw new Error('mise au point impossible'); const x = S().surfaces[q.j]; x.t = q.t; x.tsolve = '';
      return `quick focus (${o.crit === 'WFE' ? 'front d\'onde' : 'spot'}, λ ${q.wls.map(w => r2(w * 1000, 5)).join('/')} nm) : Δ ${r2(q.dt * 1000, 4)} µm, ${r2(q.before, 4)} → ${r2(q.after, 4)} ${o.crit === 'WFE' ? 'λ' : 'µm'}`; } },
    design_doublet: { d: 'Crée un doublet achromatique (calcul des puissances puis optimisation) ; field = champ max en degrés', a: '{f, fno?, field?, crown?, flint?, cemented?}', m: 1, async run(a) { const sys = makeDoublet(a); App.sys = normalize(sys); App.sel = 1; App.view.auto = true; const r = await optimizeLoop(150); return `doublet ${sys.surfaces[1].glass}/${sys.surfaces[2].glass} créé puis optimisé (${r}) — ${metrics()}`; } },
    design_singlet: { d: 'Crée une lentille simple (plan-convexe ou biconvexe) puis l\'optimise', a: '{f, fno?, field?, glass?, form?}', m: 1, async run(a) { const sys = makeSinglet(a); App.sys = normalize(sys); App.sel = 1; App.view.auto = true; const r = await optimizeLoop(100); return `lentille créée et optimisée (${r}) — ${metrics()}`; } },
    find_glass: { d: 'Cherche des verres réels proches de (nd, vd) ou par nom', a: '{nd?, vd?, name?, k?}', m: 0, run(a) { if (a.name) { const k = String(a.name).toUpperCase().replace(/[\s_-]/g, ''); return OE.catalog().filter(x => x.name.toUpperCase().replace(/[\s_-]/g, '').includes(k)).slice(0, 10).map(x => `${x.name} (${x.cat}, nd ${r2(x.nd, 5)}, νd ${r2(x.vd, 4)})`).join(', ') || 'aucun'; } return OE.glassNearest(num(a.nd, 'nd'), num(a.vd, 'vd'), { k: a.k ? Math.min(15, +a.k) : 6 }).map(g => `${g.name} (${g.cat}, nd ${r2(g.nd, 5)}, νd ${r2(g.vd, 4)})`).join(', '); } },
    show_analysis: { d: 'Affiche une analyse dans le premier panneau : spot, mtf, wfe, psf, rayfan, opdfan, field, seidel, chrom, ee, footprint, zern, glass', a: '{type, field?}', m: 0, run(a) { const t = String(a.type || '').toLowerCase(), ok = ['spot', 'rayfan', 'opdfan', 'wfe', 'zern', 'psf', 'mtf', 'ee', 'footprint', 'field', 'seidel', 'chrom', 'glass', 'polar', 'detector', 'source', 'imgsim', 'presc']; if (!ok.includes(t)) throw new Error(`analyse inconnue (${ok.join(', ')})`); App.panes[0].type = t; if (a.field != null) App.panes[0].fi = Math.max(0, Math.round(num(a.field, 'champ')) - 1); renderPanes(); save(); return `analyse ${t} affichée`; } },
    report_metrics: { d: 'Donne les caractéristiques et performances actuelles', a: '{}', m: 0, run() { return metrics(); } },
    set_title: { d: 'Renomme le système', a: '{title}', m: 1, run(a) { S().title = String(a.title || ''); return `titre « ${S().title} »`; } },
    undo: { d: 'Annule la dernière modification', a: '{}', m: 0, run() { undo(); return 'dernière modification annulée'; } },
  };
  /* paramètres typés (appel d'outils natif d'Ollama) */
  const N_ = (d) => ({ type: 'number', description: d }), I_ = (d) => ({ type: 'integer', description: d }), T_ = (d, e) => ({ type: 'string', description: d, ...(e ? { enum: e } : {}) }), B_ = d => ({ type: 'boolean', description: d });
  const PARAMS = {
    set_surface: [{ s: I_('numéro de surface (S1, S2…)'), radius: T_('rayon de courbure en mm, ou "inf" pour une face plane'), thickness: N_('épaisseur après la surface, mm'), glass: T_('nom du verre (ex. N-BK7) ou "air"'), conic: N_('constante de conicité'), comment: T_('commentaire') }, ['s']],
    set_lens_glass: [{ lens: I_('numéro de lentille L1, L2… (voir la description)'), glass: T_('nom du verre réel, ex. N-SF11') }, ['lens', 'glass']],
    insert_surface: [{ after: I_('insérer après cette surface'), radius: T_('rayon mm ou "inf"'), thickness: N_('épaisseur mm'), glass: T_('verre ou "air"') }, ['after']],
    delete_surface: [{ s: I_('numéro de surface') }, ['s']], delete_lens: [{ lens: I_('numéro de lentille') }, ['lens']],
    add_lens: [{ after: I_('surface après laquelle insérer'), f: N_('focale de la lentille, mm'), glass: T_('verre'), thickness: N_('épaisseur centre, mm') }, []],
    set_aperture: [{ type: T_('EPD = diamètre de pupille en mm, FNO = nombre d\'ouverture F/#, NA = ouverture numérique objet', ['EPD', 'FNO', 'NA']), value: N_('valeur') }, ['type', 'value']],
    set_object: [{ infinite: B_('objet à l\'infini'), distance: N_('distance objet en mm si fini') }, ['infinite']],
    set_fields: [{ values: { type: 'array', items: { type: 'number' }, description: 'liste des champs (degrés si objet à l\'infini)' }, max: N_('champ maximal ; crée 0, 0,7·max, max') }, []],
    set_wavelengths: [{ preset: T_('jeu prédéfini', ['FdC', 'visible', 'HeNe', 'NIR', 'd', 'e']), values_nm: { type: 'array', items: { type: 'number' }, description: 'longueurs d\'onde en nm' }, primary: I_('numéro de la λ primaire (1…)') }, []],
    set_stop: [{ s: I_('surface du diaphragme') }, ['s']],
    set_variables: [{ targets: { type: 'array', items: { type: 'string' }, description: 'mots-clés radii | thicknesses | air | glasses | all, ou paramètres précis "R1", "T2", "K3", "G2" (G = verre)' }, clear: B_('retirer d\'abord toutes les variables') }, ['targets']],
    set_merit: [{ criterion: T_('critère image', ['SPOT', 'WFE', 'NONE']), wavelength: T_('longueurs d\'onde du critère : all, central, primary ou un numéro'), operands: { type: 'array', description: 'contraintes : EFL focale, TTL longueur totale, BFL distance image, WFNO F/#, PMAG grandissement, DIST distorsion %, AXCL chromatisme axial, LACL chromatisme latéral, SPHA/COMA/ASTI/FCUR aberrations de Seidel (λ), MNCT épaisseur MIN des verres au centre, MXCT épaisseur MAX des verres, MNET épaisseur min des verres au bord, MNCA espace d\'air min, MXCA espace d\'air max, MNEA air min au bord, MTFA FTM à une fréquence p', items: { type: 'object', properties: { type: T_('code', Object.keys(OE.OPS)), target: N_('cible'), weight: N_('poids'), cmp: T_('eq (=), ge (≥), le (≤)', ['eq', 'ge', 'le']), p: N_('paramètre (fréquence pour MTFA)') }, required: ['type', 'target'] } }, replace: B_('remplacer les opérandes existants') }, []],
    optimize: [{ iterations: I_('itérations maximum') }, []],
    substitute_glasses: [{ catalogs: { type: 'array', items: { type: 'string' }, description: 'catalogues : SCHOTT, OHARA, CDGM, HOYA' }, preferred: B_('verres préférentiels seulement') }, []],
    quick_focus: [{ criterion: T_('critère', ['SPOT', 'WFE']), wavelength: T_('central, primary, all ou un numéro') }, []],
    design_doublet: [{ f: N_('focale mm'), fno: N_('nombre d\'ouverture F/#'), field: N_('champ maximal en degrés'), crown: T_('verre couronne (défaut N-BK7)'), flint: T_('verre flint (défaut N-SF5)'), cemented: B_('collé (défaut oui)') }, ['f']],
    design_singlet: [{ f: N_('focale mm'), fno: N_('F/#'), field: N_('champ max en degrés'), glass: T_('verre (défaut N-BK7)'), form: T_('forme', ['plan-convexe', 'biconvexe']) }, ['f']],
    find_glass: [{ nd: N_('indice nd'), vd: N_('constringence νd'), name: T_('nom ou partie du nom'), k: I_('nombre de résultats') }, []],
    show_analysis: [{ type: T_('analyse', ['spot', 'mtf', 'wfe', 'psf', 'rayfan', 'opdfan', 'field', 'seidel', 'chrom', 'ee', 'footprint', 'zern', 'glass']), field: I_('numéro de champ') }, ['type']],
    report_metrics: [{}, []], set_title: [{ title: T_('titre') }, ['title']], undo: [{}, []],
  };
  const OLLAMA_TOOLS = [...Object.entries(TOOLS).map(([k, v]) => ({ type: 'function', function: { name: k, description: v.d, parameters: { type: 'object', properties: (PARAMS[k] || [{}])[0], required: (PARAMS[k] || [{}, []])[1] } } })),
    { type: 'function', function: { name: 'ask_question', description: 'Pose UNE question courte à l\'utilisateur quand la demande est ambiguë ou incomplète (aucune autre action alors)', parameters: { type: 'object', properties: { question: T_('la question') }, required: ['question'] } } }];
  const DESC = { set_surface: a => `S${a.s} : ${[a.radius != null && `rayon ${a.radius}`, a.thickness != null && `épaisseur ${a.thickness}`, a.glass != null && `verre ${a.glass || 'air'}`, a.conic != null && `conique ${a.conic}`, a.comment != null && `commentaire « ${a.comment} »`].filter(Boolean).join(', ')}`,
    set_lens_glass: a => `verre de la lentille ${a.lens} → ${a.glass}`, insert_surface: a => `insérer une surface après S${a.after}`, delete_surface: a => `supprimer S${a.s}`, delete_lens: a => `supprimer la lentille ${a.lens}`,
    add_lens: a => `ajouter une lentille${a.f ? ` f=${a.f}` : ''}${a.glass ? ` en ${a.glass}` : ''}${a.after != null ? ` après S${a.after}` : ''}`, set_aperture: a => `ouverture ${a.type} = ${a.value}`, set_object: a => a.infinite ? 'objet à l\'infini' : `objet à ${a.distance} mm`,
    set_fields: a => `champs ${a.values ? a.values.join(', ') : `0 / 0,7 / 1 × ${a.max}`}`, set_wavelengths: a => `longueurs d'onde ${a.preset || (a.values_nm || []).join(', ') + ' nm'}`, set_stop: a => `diaphragme en S${a.s}`,
    set_variables: a => `${a.clear ? 'remplacer les' : 'ajouter des'} variables : ${[].concat(a.targets).join(', ')}`, set_merit: a => `fonction de mérite : ${[a.criterion, a.wavelength && `λ ${a.wavelength}`, ...(a.operands || []).map(o => `${o.type} ${({ ge: '≥', le: '≤' })[o.cmp] || '='} ${o.target}`)].filter(Boolean).join(', ')}${a.replace ? ' (remplace les opérandes)' : ''}`,
    optimize: a => `optimiser${a.iterations ? ` (${a.iterations} itérations max)` : ''}`, substitute_glasses: () => 'substituer les verres variables par des verres réels', quick_focus: a => `quick focus (${a.criterion || 'spot'}, λ ${a.wavelength || 'centrale'})`,
    design_doublet: a => `créer un doublet achromatique f=${a.f} mm F/${a.fno || 5}${a.field ? `, champ ${a.field}°` : ''}${a.crown ? `, ${a.crown}` : ''}${a.flint ? `/${a.flint}` : ''} puis l'optimiser`,
    design_singlet: a => `créer une lentille ${a.form || 'plan-convexe'} f=${a.f} mm F/${a.fno || 5}${a.glass ? ` en ${a.glass}` : ''} puis l'optimiser`, find_glass: a => a.name ? `chercher le verre « ${a.name} »` : `chercher des verres proches de nd ${a.nd}, νd ${a.vd}`,
    show_analysis: a => `afficher l'analyse ${a.type}`, report_metrics: () => 'lire les performances', set_title: a => `renommer « ${a.title} »`, undo: () => 'annuler la dernière modification' };
  const describe = act => { try { return (DESC[act.tool] || (() => act.tool))(act.args || {}); } catch (e) { return act.tool; } };

  /** exécute un plan d'actions ; les actions qui modifient le système forment UNE étape d'annulation */
  async function execute(actions) {
    const snap = toJSON(App.sys), out = []; let changed = false;
    A.stop = false;
    for (const act of actions) {
      const t = TOOLS[act.tool]; if (!t) { out.push({ ok: false, act, r: `outil inconnu « ${act.tool} »` }); break; }
      try { const r = await t.run(act.args || {}); out.push({ ok: true, act, r }); if (t.m) changed = true; App.M = OE.prepare(App.sys); }
      catch (e) { out.push({ ok: false, act, r: e.message || String(e) }); App.sys = fromJSON(snap); changed = false; break; }
    }
    if (changed) { App.sys = normalize(App.sys); pushHist(); }
    refresh();
    return out;
  }

  /* ================= Prompt ================= */
  const TOOL_DOC = Object.entries(TOOLS).map(([k, v]) => `- ${k} ${v.a} : ${v.d}`).join('\n');
  const SYSTEM = `Tu es l'assistant de Focale, un logiciel de conception optique (équivalent simplifié de CODE V / Zemax). Tu réponds en français.
Tu traduis la demande de l'utilisateur en ACTIONS sur le logiciel. Tu ne fais aucun calcul optique toi-même : le logiciel calcule.
Réponds UNIQUEMENT par un objet JSON : {"message": "...", "actions": [{"tool": "...", "args": {...}}], "question": ""}.
- "message" : une ou deux phrases qui disent ce que tu vas faire, ou une remarque utile (par exemple si la demande est irréaliste).
- "actions" : la liste ordonnée des outils à appliquer (vide si tu poses une question).
- "question" : si la demande est ambiguë ou incomplète (quelle lentille ? quelle valeur ?), pose UNE question courte et ne propose aucune action. Sinon laisse "".
Règles :
- Numérotation : S0 = objet, puis S1, S2…, la dernière = image. Les lentilles L1, L2… et leurs surfaces sont listées dans la description du système : utilise-la pour « la deuxième lentille », « la dernière lentille », etc. Un doublet collé compte pour deux lentilles.
- Unités : mm, degrés pour les champs d'un objet à l'infini, nm pour les longueurs d'onde. Rayon « plan » = "inf".
- Pour optimiser : définis des variables (set_variables) si aucune n'existe, éventuellement la fonction de mérite (set_merit), puis optimize. Ne mets pas en variable une épaisseur pilotée par un solve M.
- Pour changer un verre, utilise un nom de verre réel du catalogue (ex. N-BK7, N-SF5, N-LAK9, F2, N-SK16, SILICA, CAF2). Si l'utilisateur ne précise pas lequel, propose-en un et explique-le dans "message".
- N'invente pas de valeurs que l'utilisateur n'a pas données quand elles changent la conception : demande-les. Valeurs par défaut acceptables : F/5, champ 2°, verres N-BK7/N-SF5, longueurs d'onde F, d, C.
Outils :
${TOOL_DOC}
Exemples :
Demande : « mets le verre de la deuxième lentille en N-SF11 » → {"message":"Je remplace le verre de L2 par N-SF11.","actions":[{"tool":"set_lens_glass","args":{"lens":2,"glass":"N-SF11"}}],"question":""}
Demande : « fais-moi un doublet achromatique de 150 mm ouvert à f/4 avec 3° de champ » → {"message":"Je crée un doublet collé N-BK7/N-SF5 et je l'optimise.","actions":[{"tool":"design_doublet","args":{"f":150,"fno":4,"field":3}}],"question":""}
Demande : « optimise pour le front d'onde à la longueur d'onde centrale » → {"message":"Rayons en variables, critère front d'onde sur la λ centrale, puis optimisation.","actions":[{"tool":"set_variables","args":{"targets":"radii"}},{"tool":"set_merit","args":{"criterion":"WFE","wavelength":"central"}},{"tool":"optimize","args":{}}],"question":""}
Demande : « change le verre » (plusieurs lentilles) → {"message":"","actions":[],"question":"Quelle lentille (L1 à L3) et quel verre souhaitez-vous ?"}
Demande : « garde une focale de 100 mm et une longueur totale inférieure à 120 mm puis optimise » → {"message":"J'ajoute les contraintes EFL = 100 et TTL ≤ 120, puis j'optimise.","actions":[{"tool":"set_merit","args":{"operands":[{"type":"EFL","target":100},{"type":"TTL","target":120,"cmp":"le"}]}},{"tool":"set_variables","args":{"targets":"radii"}},{"tool":"optimize","args":{}}],"question":""}`;
  const SYSTEM_TOOLS = `Tu pilotes Focale, un logiciel de conception optique, en appelant ses outils. Réponds en français, en une phrase courte.
Appelle les outils nécessaires, dans l'ordre, avec des valeurs numériques. Tu ne calcules rien : le logiciel calcule.
- S0 = objet, S1, S2… surfaces, la dernière = image. Les lentilles L1, L2… et leurs surfaces sont listées dans la description du système : « la deuxième lentille » = L2.
- Unités : mm ; champs en degrés si l'objet est à l'infini ; longueurs d'onde en nm ; face plane = "inf".
- « optimise » : set_variables (si aucune variable) puis éventuellement set_merit, puis optimize.
- « focale de X mm » sur le système existant = set_merit avec l'opérande EFL ; « crée/fais un doublet » = design_doublet ; « une lentille simple » = design_singlet.
- Contraintes (« épaisseur minimale des verres 5 mm », « longueur totale < 120 mm », « pas de chromatisme ») : set_merit avec l'opérande correspondant (MNCT ≥ 5, TTL ≤ 120, AXCL = 0) ; elles s'appliquent à toutes les lentilles. Pour fixer l'épaisseur d'une lentille précise : set_surface sur sa première surface.
- Chaque action DOIT passer par un appel d'outil : n'écris jamais que tu fais quelque chose sans appeler l'outil.
- Si la demande est ambiguë ou qu'il manque une valeur indispensable, appelle seulement ask_question.`;
  const SCHEMA = { type: 'object', properties: { message: { type: 'string' }, actions: { type: 'array', items: { type: 'object', properties: { tool: { type: 'string', enum: Object.keys(TOOLS) }, args: { type: 'object' } }, required: ['tool', 'args'] } }, question: { type: 'string' } }, required: ['message', 'actions', 'question'] };
  function buildMessages(text, tools) {
    const hist = A.log.filter(m => (m.role === 'user' || m.role === 'assistant') && m.by !== '').slice(-2 * A.cfg.history).map(m => ({ role: m.role, content: m.role === 'user' ? m.text : tools ? [m.text, m.question, (m.actions || []).map(describe).join(' ; ')].filter(Boolean).join(' — ') : JSON.stringify({ message: m.text || '', actions: m.actions || [], question: m.question || '' }) }));
    return [{ role: 'system', content: tools ? SYSTEM_TOOLS : SYSTEM }, ...hist, { role: 'user', content: `Description du système :\n${summary()}\n\nDemande : ${text}` }];
  }
  /** extrait l'objet JSON d'une réponse (tolère du texte ou des balises <think> autour) */
  function parseReply(t) {
    t = String(t || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    const i = t.indexOf('{'), j = t.lastIndexOf('}'); if (i < 0 || j < i) throw new Error('réponse du modèle illisible');
    const o = JSON.parse(t.slice(i, j + 1));
    return { message: String(o.message || ''), question: String(o.question || ''), actions: Array.isArray(o.actions) ? o.actions.filter(a => a && a.tool).map(a => ({ tool: String(a.tool), args: a.args && typeof a.args === 'object' ? a.args : {} })) : [] };
  }

  /* ================= Moteurs ================= */
  async function ollamaTags(url = A.cfg.ollamaUrl, ms = 1500) {
    const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
    try { const r = await fetch(url.replace(/\/$/, '') + '/api/tags', { signal: c.signal }); if (!r.ok) throw new Error('HTTP ' + r.status); const j = await r.json(); return (j.models || []).map(m => m.name); } finally { clearTimeout(t); }
  }
  const pickOllama = names => { for (const p of OLLAMA_REC) { const h = names.find(n => n === p || n.startsWith(p + ':') || n.startsWith(p + '-') || n === p + ':latest'); if (h) return h; } return names[0] || ''; };
  /** appel d'outils natif : le modèle renvoie message.tool_calls ; ask_question devient la question */
  async function askOllamaTools(text) {
    const url = A.cfg.ollamaUrl.replace(/\/$/, ''), model = A.cfg.ollamaModel || pickOllama(A.ollamaModels);
    if (!model) throw new Error('aucun modèle Ollama installé (ex. : ollama pull qwen3:4b-instruct)');
    const body = { model, messages: buildMessages(text, true), tools: OLLAMA_TOOLS, stream: false, options: { temperature: 0, num_ctx: 8192 } };
    if (/qwen3|deepseek-r1|magistral|gpt-oss/i.test(model) && !/instruct/i.test(model)) body.think = false;
    A.abort = new AbortController();
    let res = await fetch(url + '/api/chat', { method: 'POST', body: JSON.stringify(body), signal: A.abort.signal });
    if (res.status === 400 && body.think === false) { delete body.think; res = await fetch(url + '/api/chat', { method: 'POST', body: JSON.stringify(body), signal: A.abort.signal }); }
    if (!res.ok) { const t = await res.text(); const e = new Error(`Ollama : HTTP ${res.status} ${t.slice(0, 200)}`); e.noTools = /does not support tools/i.test(t); throw e; }
    let j = await res.json(), msg = j.message || {}, calls = msg.tool_calls || [];
    let content = String(msg.content || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    // le modèle a répondu en texte sans appeler d'outil : une relance qui le lui demande explicitement
    if (!calls.length && content && !/\?\s*$/.test(content) && !/^\s*\{/.test(content) && !A.stop) {
      status('Le modèle n\'a appelé aucun outil : relance', true);
      body.messages = [...body.messages, { role: 'assistant', content }, { role: 'user', content: 'Exécute maintenant exactement cela en appelant les outils correspondants (appels d\'outils uniquement, sans texte).' }];
      const r2 = await fetch(url + '/api/chat', { method: 'POST', body: JSON.stringify(body), signal: A.abort.signal });
      if (r2.ok) { const j2 = await r2.json(), m2 = j2.message || {}; if ((m2.tool_calls || []).length) { calls = m2.tool_calls; } }
    }
    if (!calls.length && /^\s*\{[\s\S]*"actions"/.test(content)) { try { return { rep: parseReply(content), by: `Ollama · ${model}` }; } catch (e) { } }
    const rep = { message: content, question: '', actions: [] };
    if (!calls.length && /\?\s*$/.test(content)) return { rep: { message: '', question: content, actions: [] }, by: `Ollama · ${model} · outils` };
    for (const c of calls) { const f = c.function || {}; let a = f.arguments || {}; if (typeof a === 'string') { try { a = JSON.parse(a); } catch (e) { a = {}; } }
      if (f.name === 'ask_question') rep.question = String(a.question || ''); else rep.actions.push({ tool: String(f.name), args: a }); }
    if (rep.question) rep.actions = [];
    if (!rep.message && rep.actions.length) rep.message = 'Voici ce que je propose :';
    return { rep, by: `Ollama · ${model} · outils` };
  }
  async function askOllama(msgs, onTok) {
    const url = A.cfg.ollamaUrl.replace(/\/$/, ''), model = A.cfg.ollamaModel || pickOllama(A.ollamaModels);
    if (!model) throw new Error('aucun modèle Ollama installé (ex. : ollama pull qwen3:4b-instruct)');
    const body = { model, messages: msgs, stream: true, format: SCHEMA, options: { temperature: 0, num_ctx: 8192 } };
    if (/qwen3|deepseek-r1|magistral|gpt-oss/i.test(model) && !/instruct/i.test(model)) body.think = false;
    A.abort = new AbortController();
    let res = await fetch(url + '/api/chat', { method: 'POST', body: JSON.stringify(body), signal: A.abort.signal });
    if (res.status === 400 && body.think === false) { delete body.think; res = await fetch(url + '/api/chat', { method: 'POST', body: JSON.stringify(body), signal: A.abort.signal }); }
    if (!res.ok) throw new Error(`Ollama : HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    const rd = res.body.getReader(), dec = new TextDecoder(); let buf = '', out = '';
    for (;;) { const { value, done } = await rd.read(); if (done) break; buf += dec.decode(value, { stream: true }); let k;
      while ((k = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, k).trim(); buf = buf.slice(k + 1); if (!line) continue; const o = JSON.parse(line); if (o.error) throw new Error('Ollama : ' + o.error); if (o.message && o.message.content) { out += o.message.content; onTok && onTok(out); } } }
    if (buf.trim()) { const o = JSON.parse(buf); if (o.message && o.message.content) out += o.message.content; }
    return { text: out, by: `Ollama · ${model}` };
  }
  async function webllmLoad(onProg) {
    if (A.engine && A.engineId === A.cfg.webllmModel) return A.engine;
    if (!navigator.gpu) throw new Error('WebGPU indisponible dans ce navigateur (Chrome ou Edge récents requis)');
    const W = A.webllm || (A.webllm = await import(/* webpackIgnore: true */ WEBLLM_URL));
    if (A.engine) { try { await A.engine.unload(); } catch (e) { } }
    A.engine = await W.CreateMLCEngine(A.cfg.webllmModel, { initProgressCallback: p => onProg && onProg(p) }); A.engineId = A.cfg.webllmModel; return A.engine;
  }
  async function askWebllm(msgs, onTok) {
    const e = await webllmLoad(p => status(`Chargement du modèle : ${Math.round((p.progress || 0) * 100)} % — ${p.text || ''}`));
    const req = { messages: msgs, temperature: 0.1, stream: true, response_format: { type: 'json_object', schema: JSON.stringify(SCHEMA) } };
    if (/qwen3/i.test(A.cfg.webllmModel)) req.extra_body = { enable_thinking: false };
    const it = await e.chat.completions.create(req); let out = '';
    for await (const ch of it) { if (A.stop) { try { e.interruptGenerate(); } catch (x) { } break; } const d = ch.choices && ch.choices[0] && ch.choices[0].delta && ch.choices[0].delta.content; if (d) { out += d; onTok && onTok(out); } }
    return { text: out, by: `navigateur · ${A.cfg.webllmModel}` };
  }

  /* ================= Mode sans IA : règles ================= */
  const norm = t => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, ' ').replace(/\s+/g, ' ').trim();
  const ORD = { premiere: 1, premier: 1, '1re': 1, '1ere': 1, '1er': 1, deuxieme: 2, seconde: 2, second: 2, '2e': 2, '2eme': 2, troisieme: 3, '3e': 3, '3eme': 3, quatrieme: 4, '4e': 4, cinquieme: 5, '5e': 5 };
  /* ---- tolérance aux fautes : vocabulaire des commandes, abréviations, distance d'édition ---- */
  const VOCAB = `verre verres materiau lentille lentilles surface surfaces rayon rayons courbure epaisseur epaisseurs espace espaces air minimum minimale minimales maximum maximale maximales bord bords centre
    focale ouverture champ champs longueur longueurs onde ondes lambda visible visibles infrarouge primaire centrale toutes polychromatique optimise optimiser optimisation optimisez quick focus mise point foyer meilleur
    refocalise doublet achromatique achromat colle simple singlet plan convexe biconvexe concave supprime supprimer supprimez retire ajoute ajouter ajoutez insere affiche afficher montre montrer trace voir
    diaphragme pupille diametre annule annuler defais premiere premier deuxieme seconde troisieme quatrieme cinquieme derniere front spot psf seidel empreinte footprint distorsion chromatisme corrige corriger
    substitue substituer substitution variable variables totale encombrement inferieure superieure change changer mets mettre remplace remplacer passe utilise fais faire cree creer dessine propose objet infini
    image mm degres nanometres catalogue reels verres conique asphere`.split(/\s+/).filter(Boolean);
  const VSET = new Set(VOCAB);
  const ABBR = { ep: 'epaisseur', epai: 'epaisseur', epais: 'epaisseur', epaiss: 'epaisseur', eps: 'epaisseur', foc: 'focale', opti: 'optimise', optim: 'optimise', opt: 'optimise', optimi: 'optimise',
    lent: 'lentille', lentil: 'lentille', len: 'lentille', surf: 'surface', diaph: 'diaphragme', diam: 'diametre', pup: 'pupille', ouv: 'ouverture', ouvert: 'ouverture', qf: 'quick focus', mep: 'mise au point',
    supp: 'supprime', suppr: 'supprime', sup: 'supprime', aj: 'ajoute', ajt: 'ajoute', aff: 'affiche', max: 'maximum', maxi: 'maximum', min: 'minimum', mini: 'minimum', long: 'longueur', lg: 'longueur', ldo: 'longueur d onde',
    chrom: 'chromatisme', chromat: 'chromatisme', achro: 'achromatique', achromat: 'achromatique', dist: 'distorsion', tot: 'totale', var: 'variable', vars: 'variables', subst: 'substitue', nm: 'nm', deg: 'degres', cent: 'centrale', prim: 'primaire',
    '1ere': 'premiere', '1re': 'premiere', '2nd': 'deuxieme', '2nde': 'deuxieme', '2eme': 'deuxieme', '2e': 'deuxieme', '3eme': 'troisieme', '3e': 'troisieme', '4eme': 'quatrieme', '4e': 'quatrieme', dern: 'derniere', ttl: 'longueur totale', met: 'mets', mai: 'mets' };
  /** distance de Damerau-Levenshtein (bornée) */
  function dl(a, b, max = 2) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]); for (let j = 0; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) { let rowMin = Infinity; for (let j = 1; j <= b.length; j++) { const c = a[i - 1] === b[j - 1] ? 0 : 1; d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c); if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1); rowMin = Math.min(rowMin, d[i][j]); } if (rowMin > max) return max + 1; }
    return d[a.length][b.length];
  }
  /** corrige un mot : exact, abréviation, faute de frappe (1 lettre dès 4 lettres, 2 dès 8), préfixe unique (≥ 5 lettres) */
  function fixWord(w) {
    if (VSET.has(w)) return w; if (ABBR[w]) return ABBR[w];
    if (w.length < 4) return w;
    const tol = w.length >= 8 ? 2 : 1; let best = null, bd = tol + 1, tie = false;
    for (const v of VOCAB) { const d = dl(w, v, tol); if (d > tol) continue; if (d < bd) { bd = d; best = v; tie = false; } else if (d === bd && v !== best && v.slice(0, 5) !== best.slice(0, 5)) tie = true; }
    if (best && !tie) return best;
    if (w.length >= 5) { const pre = VOCAB.filter(v => v.startsWith(w)); if (pre.length && pre.every(v => v.slice(0, w.length + 2) === pre[0].slice(0, w.length + 2))) return pre[0]; }
    return w;
  }
  /** texte normalisé et corrigé (les jetons contenant des chiffres ou des noms de verre sont laissés tels quels) */
  const fuzz = t => t.replace(/\.(?=\s|$)/g, ' ').replace(/[a-z0-9]+/g, w => /\d/.test(w) && !ABBR[w] ? w : fixWord(w)).replace(/\s+/g, ' ').trim();
  const NUM = '(-?\\d+(?:[.,]\\d+)?)';
  const toN = s => parseFloat(String(s).replace(',', '.'));
  function rules(text) {
    const t = fuzz(norm(text)), acts = [], say = [];
    const lensRef = () => { const m = t.match(new RegExp(`(${Object.keys(ORD).join('|')}|derniere|\\d+)\\s*(?:e\\s+)?lentille|lentille\\s*(?:l|n°|no|numero)?\\s*(\\d+)`)); if (!m) return null; if (m[2]) return +m[2]; if (m[1] === 'derniere') return lenses().length; return ORD[m[1]] || +m[1]; };
    const glassTok = () => { const m = text.match(/(?:\ben\b|\bpar\b|\bavec\b|=|:|\bdu\b|\ble\b)\s*([A-Za-z]{1,6}[-_ ]?[A-Za-z]*\s?\d+[A-Za-z0-9]*|SILICA|CAF2|BK7|F_SILICA)\s*\.?\s*$/i) || text.match(/\b((?:N|S|H|D|E|P|L)[- ]?[A-Z]{1,5}\s?\d{1,3}[A-Z]*|BK\s?7|F2|SF\s?\d+|SILICA|CAF2)\b/i); return m ? m[1].replace(/\s+/g, '').replace('_', '-') : null; };
    // design
    if (/doublet/.test(t) || /(lentille simple|singlet|plan-?convexe|biconvexe)/.test(t) && /(fai|cree|concoi|dessine|propose)/.test(t)) {
      const f = t.match(new RegExp(`(?:\\bf|focale|efl)\\s*(?:=|de|:)?\\s*${NUM}(?!\\s*°)`)) || t.match(new RegExp(`${NUM}\\s*mm`));
      const fno = t.match(new RegExp(`f\\s*\\/\\s*${NUM}`)) || t.match(new RegExp(`(?:ouvert|ouverture|nombre d ouverture)[^0-9]*${NUM}`));
      const fld = t.match(new RegExp(`(?:champ|field)[^0-9]*${NUM}\\s*(?:°|deg)`)) || t.match(new RegExp(`±\\s*${NUM}\\s*°`)) || t.match(new RegExp(`${NUM}\\s*°`));
      if (!f) return { message: '', actions: [], question: 'Quelle focale (en mm) souhaitez-vous ?' };
      const a = { f: toN(f[1]) }; if (fno) a.fno = toN(fno[1]); if (fld) a.field = toN(fld[1]);
      if (/doublet/.test(t)) { if (/(non colle|decolle|air)/.test(t)) a.cemented = false; acts.push({ tool: 'design_doublet', args: a }); say.push('Je crée le doublet achromatique puis je l\'optimise.'); }
      else { if (/biconvexe/.test(t)) a.form = 'biconvexe'; const g = glassTok(); if (g) a.glass = g; acts.push({ tool: 'design_singlet', args: a }); say.push('Je crée la lentille puis je l\'optimise.'); }
      return { message: say.join(' '), actions: acts, question: '' };
    }
    if (/(annule|defai|undo|retour arriere)/.test(t)) return { message: 'J\'annule la dernière modification.', actions: [{ tool: 'undo', args: {} }], question: '' };
    // verre
    if ((/(verre|materiau|glass)/.test(t) || (lensRef() && glassTok())) && /(change|mets|met |remplace|passe|utilise|en |par )/.test(t) && !/(variable|substitu)/.test(t)) {
      const g = glassTok(), sm = t.match(/(?:surface|\bs)\s*(\d+)/), ln = lensRef();
      if (!g) return { message: '', actions: [], question: 'Quel verre voulez-vous utiliser (par exemple N-BK7, N-SF5, N-LAK9) ?' };
      if (sm) return { message: `Verre de S${sm[1]} → ${g}.`, actions: [{ tool: 'set_surface', args: { s: +sm[1], glass: g } }], question: '' };
      if (ln) return { message: `Verre de la lentille ${ln} → ${g}.`, actions: [{ tool: 'set_lens_glass', args: { lens: ln, glass: g } }], question: '' };
      if (lenses().length === 1) return { message: `Verre de la lentille → ${g}.`, actions: [{ tool: 'set_lens_glass', args: { lens: 1, glass: g } }], question: '' };
      return { message: '', actions: [], question: `Quelle lentille (L1 à L${lenses().length}) ou quelle surface ?` };
    }
    let m;
    if ((m = t.match(new RegExp(`rayon\\s*(?:de la\\s*)?(?:surface|s)\\s*(\\d+)\\s*(?:=|a|en|:|de)?\\s*(${NUM.slice(1, -1)}|inf\\w*|plan)`)))) acts.push({ tool: 'set_surface', args: { s: +m[1], radius: /^(inf|plan)/.test(m[2]) ? 'inf' : toN(m[2]) } });
    if ((m = t.match(new RegExp(`(?:epaisseur|espace)\\s*(?:de la\\s*)?(?:surface|s)\\s*(\\d+)\\s*(?:=|a|en|:|de)?\\s*${NUM}`)))) acts.push({ tool: 'set_surface', args: { s: +m[1], thickness: toN(m[2]) } });
    if ((m = t.match(/supprime\w*\s+(?:la\s+)?(?:surface|s)\s*(\d+)/))) acts.push({ tool: 'delete_surface', args: { s: +m[1] } });
    else if (/supprime/.test(t) && /lentille/.test(t)) { const ln = lensRef(); if (!ln) return { message: '', actions: [], question: 'Quelle lentille faut-il supprimer ?' }; acts.push({ tool: 'delete_lens', args: { lens: ln } }); }
    if (/ajoute\w*\s+(?:une\s+)?lentille/.test(t)) { const f = t.match(new RegExp(`(?:f|focale)\\s*(?:=|de)?\\s*${NUM}`)); acts.push({ tool: 'add_lens', args: f ? { f: toN(f[1]) } : {} }); }
    if ((m = t.match(new RegExp(`f\\s*\\/\\s*${NUM}`))) && !/doublet/.test(t)) acts.push({ tool: 'set_aperture', args: { type: 'FNO', value: toN(m[1]) } });
    if ((m = t.match(new RegExp(`(?:epd|diametre (?:de )?(?:la )?pupille|pupille d entree)\\s*(?:=|a|de|:)?\\s*${NUM}`)))) acts.push({ tool: 'set_aperture', args: { type: 'EPD', value: toN(m[1]) } });
    if ((m = t.match(new RegExp(`(?:diaphragme|stop)\\s*(?:sur|en|a|:)?\\s*(?:la\\s*)?(?:surface|s)\\s*(\\d+)`)))) acts.push({ tool: 'set_stop', args: { s: +m[1] } });
    if (/champ/.test(t) && (m = t.match(/champs?\s*(?:de|=|a|:|max(?:imal|imum)?)?\s*((?:±?\s*-?\d+(?:[.,]\d+)?\s*°?\s*(?:,|;|et|\s)\s*)*±?\s*-?\d+(?:[.,]\d+)?)\s*(°|deg|mm)?/))) { const v = m[1].match(/-?\d+(?:[.,]\d+)?/g).map(toN); acts.push({ tool: 'set_fields', args: v.length === 1 ? { max: v[0] } : { values: v } }); }
    if (/(longueur|lambda|λ)/.test(t)) { if (/visible/.test(t)) acts.push({ tool: 'set_wavelengths', args: { preset: 'visible' } }); else if (/(he-?ne|632)/.test(t)) acts.push({ tool: 'set_wavelengths', args: { preset: 'HeNe' } }); else if (/(f\s*,?\s*d\s*,?\s*c|fdc)/.test(t)) acts.push({ tool: 'set_wavelengths', args: { preset: 'FdC' } }); else if (/(infrarouge|nir|proche ir)/.test(t)) acts.push({ tool: 'set_wavelengths', args: { preset: 'NIR' } }); else if ((m = t.match(/(\d{3,4}(?:[.,]\d+)?)(?:\s*(?:,|et)\s*(\d{3,4}(?:[.,]\d+)?))*\s*nm/g))) { const v = m.join(' ').match(/\d{3,4}(?:[.,]\d+)?/g).map(toN); acts.push({ tool: 'set_wavelengths', args: { values_nm: v } }); } }
    if ((m = t.match(new RegExp(`(?:epaisseur|espace|air)s?\\s*(?:d air\\s*)?(minimum|minimale|minimales|min|maximum|maximale|maximales|max)\\b[^0-9]*${NUM}`))) && !/\blentilles?\s*(l?\d|premiere|deuxieme|troisieme|derniere)/.test(t)) {
      const mx = /^max/.test(m[1]), air = /(air|espace)/.test(t), edge = /bord/.test(t);
      const type = air ? (edge ? 'MNEA' : mx ? 'MXCA' : 'MNCA') : (edge ? (mx ? 'MXET' : 'MNET') : (mx ? 'MXCT' : 'MNCT'));
      acts.push({ tool: 'set_merit', args: { operands: [{ type, target: toN(m[2]), cmp: mx ? 'le' : 'ge', weight: 1 }] } });
    }
    if ((m = t.match(new RegExp(`(?:focale|efl)\\s*(?:=|de|a|:)?\\s*${NUM}`))) && !/(quelle|combien)/.test(t)) acts.push({ tool: 'set_merit', args: { operands: [{ type: 'EFL', target: toN(m[1]) }] } });
    if ((m = t.match(new RegExp(`(?:longueur totale|ttl|encombrement)\\s*(?:<|<=|inferieur\\w*\\s*a|max\\w*|de|=)?\\s*${NUM}`)))) acts.push({ tool: 'set_merit', args: { operands: [{ type: 'TTL', target: toN(m[1]), cmp: /(<|inferieur|max)/.test(t) ? 'le' : 'eq' }] } });
    if (/(achromat|chromatisme)/.test(t) && /(corrige|annule|supprime|reduis|minimis)/.test(t)) acts.push({ tool: 'set_merit', args: { operands: [{ type: 'AXCL', target: 0, weight: 5 }] } });
    if (/(variable|substitu)/.test(t) && /verre/.test(t)) { acts.push({ tool: 'set_variables', args: { targets: 'glasses' } }); if (/substitu/.test(t)) acts.push({ tool: 'substitute_glasses', args: {} }); }
    if (/(quick ?focus|mise au point|refocalis|meilleur foyer|faire le point)/.test(t)) acts.push({ tool: 'quick_focus', args: { criterion: /(front d onde|wfe)/.test(t) ? 'WFE' : 'SPOT', wavelength: /(toutes|polychrom)/.test(t) ? 'all' : /primaire/.test(t) ? 'primary' : 'central' } });
    if (/optimi[sz]/.test(t)) {
      const crit = /(front d onde|wfe|onde)/.test(t) ? 'WFE' : /spot/.test(t) ? 'SPOT' : null, wl = /centrale/.test(t) ? 'central' : /primaire/.test(t) ? 'primary' : /toutes/.test(t) ? 'all' : null;
      if (crit || wl) acts.push({ tool: 'set_merit', args: { ...(crit ? { criterion: crit } : {}), ...(wl ? { wavelength: wl } : {}) } });
      if (!OE.getVars(S()).length && !acts.some(a => a.tool === 'set_variables')) acts.push({ tool: 'set_variables', args: { targets: 'radii' } });
      acts.push({ tool: 'optimize', args: {} });
    }
    const an = [['spot', /(diagramme de )?spot/], ['mtf', /(ftm|mtf)/], ['wfe', /(front d onde|wfe)/], ['psf', /psf|tache/], ['field', /courbure de champ|distorsion/], ['seidel', /seidel/], ['chrom', /chromatisme/], ['footprint', /empreinte|footprint/]];
    if (/(affiche|montre|voir|trace)/.test(t)) for (const [k, re] of an) if (re.test(t)) { acts.push({ tool: 'show_analysis', args: { type: k } }); break; }
    if (!acts.length && /(quelle|combien|performance|etat|resume|caracteristique|donne)/.test(t)) acts.push({ tool: 'report_metrics', args: {} });
    if (!acts.length) return { message: 'Sans modèle de langage, je comprends des demandes simples : « verre de la 2e lentille en N-SF11 », « rayon surface 3 = -45 », « épaisseur S2 = 4 », « f/4 », « champ 5° », « longueurs d\'onde visibles », « focale 100 », « quick focus », « optimise le front d\'onde à la longueur d\'onde centrale », « doublet achromatique f=100 f/4 champ 3° », « affiche la FTM », « annule ». Pour des demandes libres, configurez Ollama ou un modèle dans le navigateur (⚙).', actions: [], question: '' };
    return { message: 'D\'accord.', actions: acts, question: '' };
  }

  /** demande simple reconnue sans ambiguïté par les règles : exécutée sans modèle (instantané) */
  function simpleRule(text) {
    const t = fuzz(norm(text));
    if (t.length > 90 || /\b(puis|ensuite|apres|avant de|pour que|afin|tout en|sans|mais|pourquoi|comment|quel|quelle|est-ce|peux-tu|explique)\b/.test(t) || /[?]/.test(text)) return null;
    const r = rules(text); if (!r.actions.length || r.question) return null;
    if (r.actions.some(a => a.tool === 'report_metrics')) return null;
    return { ...r, message: r.message === 'D\'accord.' ? 'Compris :' : r.message };
  }
  /** les petits modèles renvoient parfois des nombres en texte ou des listes en chaîne : on normalise */
  function fixArgs(tool, a) {
    const P = (PARAMS[tool] || [{}])[0], o = {};
    for (const [k, v] of Object.entries(a || {})) {
      if (v === null || v === '' || v === undefined) continue; const d = P[k];
      if (!d) { o[k] = v; continue; }
      if ((d.type === 'number' || d.type === 'integer') && typeof v === 'string') { const x = parseFloat(v.replace(',', '.').replace(/^f\s*\/\s*/i, '')); if (isFinite(x)) o[k] = x; continue; }
      if (d.type === 'array' && typeof v === 'string') { try { const j = JSON.parse(v); o[k] = Array.isArray(j) ? j : [j]; } catch (e) { o[k] = v.split(/[,;\s]+/).filter(Boolean).map(x => d.items && d.items.type === 'number' ? parseFloat(x.replace(',', '.')) : x); } continue; }
      if (d.type === 'boolean' && typeof v === 'string') { o[k] = /^(true|oui|1|yes)$/i.test(v); continue; }
      o[k] = v;
    }
    if (tool === 'set_variables' && typeof o.targets === 'string') o.targets = [o.targets];
    return o;
  }

  /* ================= Interface ================= */
  const css = `
#asst{position:fixed;top:52px;right:10px;bottom:34px;width:min(420px,calc(100vw - 20px));z-index:90;display:none;flex-direction:column;background:var(--panel);border:1px solid var(--line);border-radius:14px;box-shadow:0 18px 50px rgba(0,0,0,.3);overflow:hidden;font-size:13px}
#asst.open{display:flex}
#asst header{display:flex;align-items:center;gap:8px;padding:10px 10px 8px 14px;border-bottom:1px solid var(--line);cursor:move;user-select:none;flex:none}
#asst.float{bottom:auto;right:auto}
#asst .agrip{position:absolute;width:16px;height:16px;bottom:2px;right:2px;cursor:nwse-resize;opacity:.55;background:linear-gradient(135deg,transparent 0 45%,var(--mut) 45% 52%,transparent 52% 65%,var(--mut) 65% 72%,transparent 72%)}
#asst .aedge{position:absolute;left:0;top:0;bottom:0;width:6px;cursor:ew-resize}
#asst.float #aForm{padding-bottom:16px}
#asst.float .aedge{display:none}#asst:not(.float) .agrip{display:none}
body.adrag,body.adrag *{user-select:none!important}
#asst header b{font-size:14px}
#asst .chip{font-size:11px;padding:2px 8px;border-radius:99px;background:var(--acc2);color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:190px}
#asst .wb{border:0;background:none;color:var(--mut);cursor:pointer;width:28px;height:26px;border-radius:6px;font-size:15px}
#asst .wb:hover{background:var(--acc2);color:var(--fg)}
#aLog{flex:1;overflow:auto;padding:10px 12px;display:flex;flex-direction:column;gap:8px}
.am{max-width:92%;padding:8px 11px;border-radius:12px;line-height:1.45;word-wrap:break-word}
.am .tx{white-space:pre-wrap}
.am.u{align-self:flex-end;background:var(--acc);color:#fff;border-bottom-right-radius:4px}
.am.a{align-self:flex-start;background:var(--acc2);border-bottom-left-radius:4px}
.am.e{align-self:stretch;background:rgba(220,38,38,.12);color:var(--fg);border:1px solid rgba(220,38,38,.35)}
.am .by{display:block;font-size:10.5px;color:var(--mut);margin-top:4px}
.am.u .by{color:rgba(255,255,255,.75)}
.aplan{margin-top:6px;border:1px solid var(--line);border-radius:10px;padding:6px 8px;background:var(--panel)}
.aplan ol{margin:2px 0 6px 18px;padding:0}
.aplan li{margin:2px 0}
.aplan li.ok::marker{content:'✓  ';color:#16a34a}.aplan li.ko::marker{content:'✗  ';color:#dc2626}
.aplan .res{display:block;color:var(--mut);font-size:11.5px}
.aplan .row{display:flex;gap:6px;justify-content:flex-end}
#aSet{padding:8px 12px;border-bottom:1px solid var(--line);display:none;flex-direction:column;gap:4px;max-height:30%;overflow:auto;font-size:12px;flex:none}
#aSet details summary{cursor:pointer;color:var(--mut);font-size:11.5px}
#aSet .row{margin:0}
#aSet.open{display:flex}
#aSet label.r{display:flex;align-items:center;gap:6px}
#aSet .hint{line-height:1.4}
#aSet code{font-size:11.5px;background:var(--acc2);padding:1px 4px;border-radius:4px}
#aForm{display:flex;gap:6px;padding:8px 10px;border-top:1px solid var(--line);align-items:flex-end}
#aIn{flex:1;resize:none;min-height:38px;max-height:140px;border:1px solid var(--line);border-radius:10px;background:var(--bg);color:var(--fg);padding:8px 10px;font:inherit}
#aSt{padding:0 14px 6px;color:var(--mut);font-size:11.5px;min-height:16px}
.adots::after{content:'…';animation:adots 1s steps(3,end) infinite}@keyframes adots{0%{content:'.'}33%{content:'..'}66%{content:'...'}}`;
  function ui() {
    if ($('#asst')) return;
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    const el = document.createElement('aside'); el.id = 'asst'; el.setAttribute('aria-label', 'Assistant');
    el.innerHTML = `<header><b>Assistant</b><span class="chip" id="aBk">…</span><span style="flex:1"></span><button class="wb" data-help="assistant" title="Aide sur l'assistant" aria-label="Aide">?</button><button class="wb" id="aDock" title="Détacher / ancrer à droite (ou glisser la barre de titre ; double-clic pour basculer)" aria-label="Détacher ou ancrer">⧉</button><button class="wb" id="aCfg" title="Réglages du moteur" aria-label="Réglages">⚙</button><button class="wb" id="aClr" title="Effacer la conversation" aria-label="Effacer">⌫</button><button class="wb" id="aX" title="Fermer" aria-label="Fermer">✕</button></header>
      <div id="aSet"></div><div id="aLog"></div><div id="aSt"></div>
      <div class="aedge" title="Glisser pour changer la largeur"></div><div class="agrip" title="Redimensionner"></div>
      <form id="aForm"><textarea id="aIn" rows="2" placeholder="Ex. : fais-moi un doublet achromatique f = 100 mm à F/4, champ 3° — Entrée pour envoyer"></textarea><button class="tb pri" id="aGo" type="submit">Envoyer</button></form>`;
    document.body.appendChild(el);
    $('#aX').onclick = () => A.close();
    $('#aDock').onclick = () => { const w = A.cfg.win; if (w.docked) { const r = el.getBoundingClientRect(); Object.assign(w, { docked: false, left: Math.max(8, r.left - 40), top: r.top + 20, w: r.width, h: Math.min(r.height - 40, innerHeight - r.top - 40) }); } else w.docked = true; saveCfg(); place(); };
    winDrag(el); $('#aCfg').onclick = () => { $('#aSet').classList.toggle('open'); if ($('#aSet').classList.contains('open')) renderSet(); };
    $('#aClr').onclick = () => { A.log = []; renderLog(); };
    $('#aForm').onsubmit = e => { e.preventDefault(); if (A.busy) { A.stop = true; if (A.abort) A.abort.abort(); return; } const v = $('#aIn').value.trim(); if (v) { $('#aIn').value = ''; $('#aSet').classList.remove('open'); send(v); } };
    $('#aIn').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#aForm').requestSubmit(); } e.stopPropagation(); });
    el.addEventListener('click', e => { const b = e.target.closest('[data-ap]'); if (!b) return; const m = A.log[+b.dataset.ap]; if (!m || m.state !== 'pending') return; if (b.dataset.k === 'go') runPlan(m); else { m.state = 'skipped'; renderLog(); } });
    if (!A.log.length) A.log.push({ role: 'assistant', text: 'Bonjour ! Décrivez ce que vous voulez faire : concevoir un système, changer un verre, optimiser, régler l\'ouverture ou les champs… Je vous montre les actions avant de les appliquer, et Ctrl+Z annule toute la demande.', by: '' });
    renderLog(); detect();
  }
  /** applique la position : ancré à droite (largeur réglable) ou flottant (position et taille libres) */
  function place() {
    const el = $('#asst'); if (!el) return; const w = A.cfg.win;
    el.classList.toggle('float', !w.docked);
    if (w.docked) { el.style.left = ''; el.style.top = ''; el.style.height = ''; el.style.width = `min(${Math.max(300, w.w || 420)}px, calc(100vw - 20px))`; $('#aDock').textContent = '⧉'; $('#aDock').title = 'Détacher la fenêtre (ou glisser la barre de titre)'; }
    else {
      const W = Math.min(Math.max(300, w.w || 420), innerWidth - 16), H = Math.min(Math.max(260, w.h || 560), innerHeight - 16);
      w.left = Math.min(Math.max(0, w.left ?? innerWidth - W - 30), innerWidth - W); w.top = Math.min(Math.max(0, w.top ?? 80), innerHeight - 60);
      Object.assign(el.style, { left: w.left + 'px', top: w.top + 'px', width: W + 'px', height: Math.min(H, innerHeight - w.top - 8) + 'px' });
      $('#aDock').textContent = '⇥'; $('#aDock').title = 'Ancrer à droite (ou double-clic sur la barre de titre)';
    }
  }
  /** déplacement par la barre de titre (détache), largeur par le bord gauche (ancré), taille par la poignée (flottant) */
  function winDrag(el) {
    const w = A.cfg.win, track = (e, fn) => { e.preventDefault(); const mv = ev => fn(ev), up = () => { removeEventListener('mousemove', mv); removeEventListener('mouseup', up); document.body.classList.remove('adrag'); saveCfg(); }; document.body.classList.add('adrag'); addEventListener('mousemove', mv); addEventListener('mouseup', up); };
    el.querySelector('header').addEventListener('mousedown', e => {
      if (e.button !== 0 || e.target.closest('button,select,input')) return;
      const r = el.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top, x0 = e.clientX, y0 = e.clientY; let moved = false;
      track(e, ev => { if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 5) return;
        if (w.docked) { Object.assign(w, { docked: false, w: r.width, h: Math.min(r.height, 620) }); }
        moved = true; w.left = ev.clientX - dx; w.top = ev.clientY - dy; place(); });
    });
    el.querySelector('header').addEventListener('dblclick', e => { if (e.target.closest('button')) return; w.docked = !w.docked; if (!w.docked && w.left == null) w.left = null; saveCfg(); place(); });
    el.querySelector('.agrip').addEventListener('mousedown', e => { const r = el.getBoundingClientRect(), x0 = e.clientX, y0 = e.clientY; track(e, ev => { w.w = Math.max(300, r.width + ev.clientX - x0); w.h = Math.max(260, r.height + ev.clientY - y0); place(); }); });
    el.querySelector('.aedge').addEventListener('mousedown', e => { const r = el.getBoundingClientRect(), x0 = e.clientX; track(e, ev => { w.w = Math.max(300, Math.min(innerWidth - 40, r.width - (ev.clientX - x0))); place(); }); });
    addEventListener('resize', place);
  }
  function status(t, busy) { const e = $('#aSt'); if (e) { e.textContent = t || ''; e.classList.toggle('adots', !!busy); } }
  function setChip() { const c = $('#aBk'); if (!c) return; const b = A.active; c.textContent = b === 'ollama' ? `Ollama · ${A.cfg.ollamaModel || pickOllama(A.ollamaModels) || '?'}` : b === 'webllm' ? `navigateur · ${A.cfg.webllmModel.replace(/-q4f.*$/, '')}` : 'sans IA (règles)'; c.title = c.textContent; }
  /** choisit le moteur : réglage explicite, sinon Ollama s'il répond, sinon règles (jamais de téléchargement automatique) */
  async function detect() {
    const b = A.cfg.backend;
    if (b === 'rules') { A.active = 'rules'; setChip(); return; }
    if (b === 'webllm') { A.active = 'webllm'; setChip(); return; }
    try { A.ollamaModels = await ollamaTags(); A.active = A.ollamaModels.length ? 'ollama' : (b === 'ollama' ? 'ollama' : 'rules'); if (!A.cfg.ollamaModel || !A.ollamaModels.includes(A.cfg.ollamaModel)) A.cfg.ollamaModel = pickOllama(A.ollamaModels); }
    catch (e) { A.ollamaModels = []; A.active = b === 'ollama' ? 'ollama' : 'rules'; }
    setChip(); if ($('#aSet.open')) renderSet();
  }
  function renderSet() {
    const c = A.cfg, gpu = !!navigator.gpu, origin = location.protocol === 'file:' ? 'null (fichier local)' : location.origin;
    $('#aSet').innerHTML = `<div class="row"><span class="hint">Moteur</span><select class="in grow" id="aBe">${[['auto', 'Automatique (Ollama sinon règles)'], ['ollama', 'Ollama'], ['webllm', `Navigateur (WebGPU)${gpu ? '' : ' — indisponible'}`], ['rules', 'Sans IA (règles)']].map(([k, l]) => `<option value="${k}" ${c.backend === k ? 'selected' : ''} ${k === 'webllm' && !gpu ? 'disabled' : ''}>${l}</option>`).join('')}</select></div>
      <div class="row"><span class="hint">Ollama</span><select class="in grow" id="aOM">${A.ollamaModels.length ? A.ollamaModels.map(n => `<option ${n === c.ollamaModel ? 'selected' : ''}>${esc(n)}</option>`).join('') : '<option value="">(aucun modèle détecté)</option>'}</select><button class="bt" id="aOT">Tester</button></div>
      <div class="row"><span class="hint">Navigateur</span><select class="in grow" id="aWM">${WEBLLM_MODELS.map(([k, l]) => `<option value="${k}" ${k === c.webllmModel ? 'selected' : ''}>${l}</option>`).join('')}</select><button class="bt" id="aWL" ${gpu ? '' : 'disabled'}>Charger</button></div>
      <details><summary>Options et installation</summary>
      <label class="r"><input type="checkbox" id="aCf" ${c.confirm ? 'checked' : ''}> Confirmer avant d'appliquer</label>
      <label class="r"><input type="checkbox" id="aRF" ${c.rulesFirst ? 'checked' : ''}> Demandes simples par les règles (instantané)</label>
      <label class="r"><input type="checkbox" id="aNT" ${c.nativeTools !== false ? 'checked' : ''}> Ollama : appel d'outils natif</label>
      <div class="row"><span class="hint">Adresse Ollama</span><input class="in grow" id="aOU" value="${esc(c.ollamaUrl)}"></div>
      <div class="hint">Installer Ollama (ollama.com), puis <code>ollama pull qwen3:4b-instruct</code> (ou <code>qwen3:8b</code>, plus fiable, plus lent) et <code>setx OLLAMA_ORIGINS "*"</code>, puis relancer Ollama. Origine de cette page : <code>${esc(origin)}</code>. Tout reste sur ce PC ; Focale fonctionne sans l'assistant.</div></details>`;
    $('#aBe').onchange = e => { c.backend = e.target.value; saveCfg(); detect(); };
    $('#aOU').onchange = e => { c.ollamaUrl = e.target.value.trim() || DEF.ollamaUrl; saveCfg(); };
    $('#aOT').onclick = async () => { status('Test d\'Ollama…', true); try { A.ollamaModels = await ollamaTags(c.ollamaUrl, 3000); status(A.ollamaModels.length ? `Ollama répond : ${A.ollamaModels.length} modèle(s)` : 'Ollama répond mais aucun modèle n\'est installé (ollama pull qwen3:4b-instruct)'); if (!c.ollamaModel || !A.ollamaModels.includes(c.ollamaModel)) c.ollamaModel = pickOllama(A.ollamaModels); saveCfg(); detect(); } catch (e) { status(`Ollama ne répond pas à ${c.ollamaUrl} : lancé ? OLLAMA_ORIGINS réglé ? (${e.message})`); } };
    $('#aOM').onchange = e => { c.ollamaModel = e.target.value; saveCfg(); setChip(); };
    $('#aWM').onchange = e => { c.webllmModel = e.target.value; saveCfg(); setChip(); };
    $('#aWL').onclick = async () => { c.backend = 'webllm'; saveCfg(); A.active = 'webllm'; setChip(); status('Chargement…', true); try { await webllmLoad(p => status(`Téléchargement / chargement : ${Math.round((p.progress || 0) * 100)} % — ${p.text || ''}`, true)); status('Modèle prêt.'); } catch (e) { status('Échec : ' + e.message); } renderSet(); };
    $('#aCf').onchange = e => { c.confirm = e.target.checked; saveCfg(); };
    $('#aRF').onchange = e => { c.rulesFirst = e.target.checked; saveCfg(); };
    $('#aNT').onchange = e => { c.nativeTools = e.target.checked; saveCfg(); };
  }
  function renderLog() {
    const L = $('#aLog'); if (!L) return;
    L.innerHTML = A.log.map((m, i) => {
      if (m.role === 'user') return `<div class="am u"><span class="tx">${esc(m.text)}</span></div>`;
      if (m.role === 'error') return `<div class="am e"><span class="tx">${esc(m.text)}</span></div>`;
      const plan = m.actions && m.actions.length ? `<div class="aplan"><ol>${m.actions.map((a, k) => { const r = m.results && m.results[k]; return `<li class="${r ? (r.ok ? 'ok' : 'ko') : ''}">${esc(describe(a))}${r ? `<span class="res">${esc(r.r)}</span>` : ''}</li>`; }).join('')}</ol>
        ${m.state === 'pending' ? `<div class="row"><button class="bt" data-ap="${i}" data-k="no">Ignorer</button><button class="tb pri" data-ap="${i}" data-k="go">Appliquer</button></div>` : m.state === 'skipped' ? '<div class="hint">Ignoré.</div>' : m.state === 'running' ? '<div class="hint adots">Application</div>' : m.state === 'done' ? '<div class="hint">Appliqué — Ctrl+Z annule toute la demande.</div>' : ''}</div>` : '';
      return `<div class="am a"><span class="tx">${esc(m.text || '')}${m.question ? `${m.text ? '\n' : ''}<b>${esc(m.question)}</b>` : ''}</span>${plan}${m.by ? `<span class="by">${esc(m.by)}</span>` : ''}</div>`;
    }).join('');
    L.scrollTop = L.scrollHeight;
  }
  async function runPlan(m) {
    m.state = 'running'; renderLog(); A.busy = true; $('#aGo').textContent = 'Arrêter'; status('Application des actions', true);
    try { m.results = await execute(m.actions); m.state = 'done'; const ko = m.results.find(r => !r.ok); if (ko) A.log.push({ role: 'error', text: `Action interrompue : ${ko.r}. Le système a été remis dans son état précédent.` }); }
    finally { A.busy = false; $('#aGo').textContent = 'Envoyer'; status(''); renderLog(); }
  }
  async function send(text) {
    A.log.push({ role: 'user', text }); renderLog(); A.busy = true; A.stop = false; $('#aGo').textContent = 'Arrêter';
    const t0 = performance.now();
    try {
      let rep, by;
      const simple = A.cfg.rulesFirst && simpleRule(text);
      if (simple) { rep = simple; by = 'règles (instantané)'; }
      else if (A.active === 'ollama' || A.active === 'webllm') {
        status(A.active === 'ollama' ? 'Le modèle réfléchit (Ollama)' : 'Le modèle réfléchit (navigateur)', true);
        try {
          if (A.active === 'ollama' && A.cfg.nativeTools !== false) {
            try { const r = await askOllamaTools(text); rep = r.rep; by = `${r.by} · ${((performance.now() - t0) / 1000).toFixed(1)} s`; }
            catch (e) { if (!e.noTools) throw e; A.cfg.nativeTools = false; saveCfg(); }
          }
          if (!rep) { const r = await (A.active === 'ollama' ? askOllama : askWebllm)(buildMessages(text), out => status(`Réponse en cours (${out.length} caractères)`, true));
            rep = parseReply(r.text); by = `${r.by} · ${((performance.now() - t0) / 1000).toFixed(1)} s`; }
          rep.actions = rep.actions.map(a => ({ tool: a.tool, args: fixArgs(a.tool, a.args) }));
        } catch (e) {
          if (A.stop) throw new Error('Arrêté.');
          A.log.push({ role: 'error', text: `Moteur ${A.active === 'ollama' ? 'Ollama' : 'navigateur'} indisponible (${e.message}). Je passe aux règles simples pour cette demande.` });
          rep = rules(text); by = 'sans IA (règles)';
        }
      } else { rep = rules(text); by = 'sans IA (règles)'; }
      // validation : outils connus seulement
      const bad = rep.actions.filter(a => !TOOLS[a.tool]); if (bad.length) rep.actions = rep.actions.filter(a => TOOLS[a.tool]);
      const m = { role: 'assistant', text: rep.message + (bad.length ? `\n(actions ignorées : ${bad.map(b => b.tool).join(', ')})` : ''), question: rep.question, actions: rep.question ? [] : rep.actions, by };
      const mut = m.actions.some(a => TOOLS[a.tool].m);
      A.log.push(m);
      if (m.actions.length) { if (!mut || !A.cfg.confirm) { renderLog(); await runPlan(m); } else { m.state = 'pending'; } }
    } catch (e) { A.log.push({ role: 'error', text: e.message || String(e) }); }
    finally { A.busy = false; const g = $('#aGo'); if (g) g.textContent = 'Envoyer'; status(''); renderLog(); }
  }
  A.open = () => { ui(); $('#asst').classList.add('open'); place(); $('#aIn').focus(); };
  A.close = () => { const e = $('#asst'); if (e) e.classList.remove('open'); };
  A.toggle = () => { const e = $('#asst'); if (e && e.classList.contains('open')) A.close(); else A.open(); };
  // accès pour les tests
  Object.assign(A, { summary, rules, simpleRule, fuzz: t => fuzz(norm(t)), fixArgs, OLLAMA_TOOLS, buildMessages, parseReply, execute, TOOLS, SCHEMA, SYSTEM, lenses, send, detect, makeDoublet, resolveGlass });
})();
