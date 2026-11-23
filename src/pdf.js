'use strict';
/* =====================================================================
   FOCALE — écrivain PDF minimal et autonome (A4, points, origine en haut à gauche)
   Polices standard : Helvetica (+ gras), Courier, Symbol (lettres grecques et symboles).
   Images : JPEG (DCTDecode). Aucune dépendance.
   ===================================================================== */
const PDF = (() => {
  const W = 595.28, H = 841.89;
  // caractères WinAnsi hors Latin-1
  const WIN = { '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87, 'ˆ': 0x88, '‰': 0x89, 'Š': 0x8A, '‹': 0x8B, 'Œ': 0x8C, 'Ž': 0x8E,
    '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '˜': 0x98, '™': 0x99, 'š': 0x9A, '›': 0x9B, 'œ': 0x9C, 'ž': 0x9E, 'Ÿ': 0x9F };
  // caractères rendus avec la police Symbol
  const SYM = { 'α': 'a', 'β': 'b', 'γ': 'g', 'δ': 'd', 'ε': 'e', 'θ': 'q', 'λ': 'l', 'μ': 'm', 'ν': 'n', 'π': 'p', 'ρ': 'r', 'σ': 's', 'τ': 't', 'φ': 'f', 'χ': 'c', 'ψ': 'y', 'ω': 'w',
    'Δ': 'D', 'Θ': 'Q', 'Λ': 'L', 'Σ': 'S', 'Φ': 'F', 'Ψ': 'Y', 'Ω': 'W', '∞': '¥', '≈': '»', '≤': '£', '≥': '³', '≠': '¹', '→': '®', '←': '¬',
    'µ': 'm', '√': 'Ö', '∑': 'å', '∂': '¶', '⊗': 'Ä', '∝': 'µ', '·': '×' };
  const REPL = { 'ᵉ': 'e', 'ʳ': 'r', 'ᵈ': 'd', 'ᵗ': 't', 'ˢ': 's', 'ᵃ': 'a', '⁺': '+', '₃': '3', '₄': '4', '⁰': '0', '¹': '1', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', 'ⁱ': 'i', 'ʲ': 'j', '₀': '0', '₁': '1', '₂': '2', '⁻': '-', '−': '-', '′': "'", '″': '"', '✓': 'OK', '⚠': '!', '✕': 'x', '…': '...', ' ': ' ', ' ': ' ' };
  const mctx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
  const FONTS = { reg: { pdf: 'F1', css: '' }, bold: { pdf: 'F2', css: 'bold ' }, mono: { pdf: 'F3' } };

  /** découpe un texte en segments [police PDF, octets] */
  function runs(str, font) {
    const out = []; let cur = null;
    for (const ch of String(str)) {
      let f = font, code;
      if (SYM[ch]) { f = 'sym'; code = SYM[ch].charCodeAt(0); }
      else {
        const c = REPL[ch] ?? ch;
        if (c.length > 1) { for (const cc of c) push(font, cc.charCodeAt(0)); continue; }
        const u = c.charCodeAt(0);
        code = WIN[c] ?? (u < 256 ? u : 63);
      }
      push(f, code);
    }
    function push(f, code) { if (!cur || cur.f !== f) { cur = { f, b: [] }; out.push(cur); } cur.b.push(code); }
    return out;
  }
  function measure(str, size, font = 'reg') {
    let w = 0;
    for (const r of runs(str, font)) {
      if (r.f === 'mono') w += r.b.length * 0.6 * size;
      else if (r.f === 'sym') w += r.b.length * 0.55 * size;
      else if (mctx) { mctx.font = `${FONTS[r.f].css}100px Arial, "Liberation Sans", Helvetica, sans-serif`; w += mctx.measureText(String.fromCharCode(...r.b.map(c => c >= 128 && c < 160 ? 63 : c))).width / 100 * size; }
      else w += r.b.length * 0.5 * size;
    }
    return w;
  }
  const esc = bytes => bytes.map(c => c === 40 || c === 41 || c === 92 ? '\\' + String.fromCharCode(c) : c < 32 || c > 126 ? '\\' + c.toString(8).padStart(3, '0') : String.fromCharCode(c)).join('');
  const col = c => { if (!c) return [0, 0, 0]; if (Array.isArray(c)) return c; const m = c.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i); return m ? [1, 2, 3].map(i => parseInt(m[i], 16) / 255) : [0, 0, 0]; };
  const n = v => (Math.round(v * 100) / 100).toString();

  class Doc {
    constructor() { this.pages = []; this.images = []; this.page = null; this.W = W; this.H = H; }
    addPage() { this.page = []; this.pages.push(this.page); return this; }
    /** texte ; o : { size, font: reg|bold|mono, color, align: left|center|right } — y = ligne de base depuis le haut */
    text(x, y, str, o = {}) {
      const size = o.size || 10, font = o.font || 'reg', [r, g, b] = col(o.color);
      let xx = x; if (o.align === 'right' || o.align === 'center') { const w = measure(str, size, font); xx = o.align === 'right' ? x - w : x - w / 2; }
      let s = `BT ${n(r)} ${n(g)} ${n(b)} rg 1 0 0 1 ${n(xx)} ${n(H - y)} Tm`;
      for (const rn of runs(str, font)) s += ` /${rn.f === 'sym' ? 'F4' : FONTS[rn.f].pdf} ${n(size)} Tf (${esc(rn.b)}) Tj`;
      this.page.push(s + ' ET');
    }
    /** paragraphe avec retour à la ligne ; renvoie la hauteur utilisée */
    para(x, y, w, str, o = {}) {
      const size = o.size || 10, lh = o.lh || size * 1.35; let yy = y;
      for (const p of String(str).split('\n')) {
        let line = '';
        for (const word of p.split(/\s+/)) {
          const t = line ? line + ' ' + word : word;
          if (measure(t, size, o.font) > w && line) { this.text(x, yy, line, o); yy += lh; line = word; } else line = t;
        }
        this.text(x, yy, line, o); yy += lh;
      }
      return yy - y;
    }
    line(x1, y1, x2, y2, o = {}) { const [r, g, b] = col(o.color || '#9aa3af'), d = o.dash ? `[${o.dash.map(n).join(' ')}] 0 d ` : ''; this.page.push(`${d}${n(o.w || 0.5)} w ${n(r)} ${n(g)} ${n(b)} RG ${n(x1)} ${n(H - y1)} m ${n(x2)} ${n(H - y2)} l S${d ? ' [] 0 d' : ''}`); }
    rect(x, y, w, h, o = {}) {
      const p = `${n(x)} ${n(H - y - h)} ${n(w)} ${n(h)} re`;
      if (o.fill) { const [r, g, b] = col(o.fill); this.page.push(`${n(r)} ${n(g)} ${n(b)} rg ${p} f`); }
      if (o.stroke) { const [r, g, b] = col(o.stroke); this.page.push(`${n(o.w || 0.5)} w ${n(r)} ${n(g)} ${n(b)} RG ${p} S`); }
    }
    /** rectangle à coins arrondis (rayon r) ; o : { fill, stroke, w } */
    rrect(x, y, w, h, r, o = {}) {
      r = Math.max(0, Math.min(r, w / 2, h / 2)); const k = 0.5523 * r, X = x, Y = H - y, Y2 = H - y - h;
      let p = `${n(X + r)} ${n(Y)} m ${n(X + w - r)} ${n(Y)} l ${n(X + w - r + k)} ${n(Y)} ${n(X + w)} ${n(Y - r + k)} ${n(X + w)} ${n(Y - r)} c`
        + ` ${n(X + w)} ${n(Y2 + r)} l ${n(X + w)} ${n(Y2 + r - k)} ${n(X + w - r + k)} ${n(Y2)} ${n(X + w - r)} ${n(Y2)} c`
        + ` ${n(X + r)} ${n(Y2)} l ${n(X + r - k)} ${n(Y2)} ${n(X)} ${n(Y2 + r - k)} ${n(X)} ${n(Y2 + r)} c`
        + ` ${n(X)} ${n(Y - r)} l ${n(X)} ${n(Y - r + k)} ${n(X + r - k)} ${n(Y)} ${n(X + r)} ${n(Y)} c h`;
      let s = '';
      if (o.fill) { const [a, b, c] = col(o.fill); s += `${n(a)} ${n(b)} ${n(c)} rg `; }
      if (o.stroke) { const [a, b, c] = col(o.stroke); s += `${n(o.w || 0.5)} w ${n(a)} ${n(b)} ${n(c)} RG `; }
      this.page.push(s + p + (o.fill && o.stroke ? ' B' : o.fill ? ' f' : ' S'));
    }
    /** image JPEG (Uint8Array) de wpx × hpx pixels, placée en (x, y, w, h) points */
    jpeg(bytes, wpx, hpx, x, y, w, h) {
      const id = this.images.length; this.images.push({ bytes, wpx, hpx });
      this.page.push(`q ${n(w)} 0 0 ${n(h)} ${n(x)} ${n(H - y - h)} cm /Im${id} Do Q`);
    }
    /** chemin vectoriel simple (liste de points), rempli ou tracé */
    poly(pts, o = {}) {
      if (!pts.length) return; let s = `${n(pts[0][0])} ${n(H - pts[0][1])} m`; for (const p of pts.slice(1)) s += ` ${n(p[0])} ${n(H - p[1])} l`;
      if (o.close) s += ' h';
      if (o.fill) { const [r, g, b] = col(o.fill); s = `${n(r)} ${n(g)} ${n(b)} rg ` + s + (o.stroke ? '' : ' f'); }
      if (o.stroke) { const [r, g, b] = col(o.stroke); s = `${n(o.w || 0.8)} w ${n(r)} ${n(g)} ${n(b)} RG ` + s + (o.fill ? ' B' : ' S'); }
      if (o.round) s = '1 J 1 j ' + s + ' 0 J 0 j';
      if (o.dash) s = `[${o.dash.map(n).join(' ')}] 0 d ` + s + ' [] 0 d';
      this.page.push(s);
    }
    /** document final (Uint8Array) */
    build(meta = {}) {
      const chunks = [], offs = []; let len = 0;
      const enc = s => { const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 255; return b; };
      const put = x => { const b = typeof x === 'string' ? enc(x) : x; chunks.push(b); len += b.length; };
      const obj = (i, body) => { offs[i] = len; put(`${i} 0 obj\n`); if (Array.isArray(body)) body.forEach(put); else put(body); put('\nendobj\n'); };
      const np = this.pages.length, ni = this.images.length;
      // numérotation : 1 catalogue, 2 pages, 3-6 polices, 7 infos, puis images, puis (page, contenu) par page
      const imgId = i => 8 + i, pageId = k => 8 + ni + 2 * k, contId = k => 9 + ni + 2 * k, total = 8 + ni + 2 * np;
      put('%PDF-1.4\n%âãÏÓ\n');
      obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
      obj(2, `<< /Type /Pages /Count ${np} /Kids [${this.pages.map((_, k) => `${pageId(k)} 0 R`).join(' ')}] >>`);
      obj(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
      obj(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
      obj(5, '<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>');
      obj(6, '<< /Type /Font /Subtype /Type1 /BaseFont /Symbol >>');
      // chaînes d'information en UTF-16BE (accents et tirets corrects dans les métadonnées)
      const pstr = s => '<FEFF' + [...String(s)].map(ch => { const c = ch.codePointAt(0); return c > 0xFFFF ? '003F' : c.toString(16).toUpperCase().padStart(4, '0'); }).join('') + '>';
      const d = new Date(), z = v => String(v).padStart(2, '0');
      obj(7, `<< /Title ${pstr(meta.title || 'Rapport')} /Author ${pstr(meta.author || '')} /Creator (Focale) /Producer (Focale) /CreationDate (D:${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}${z(d.getHours())}${z(d.getMinutes())}${z(d.getSeconds())}) >>`);
      this.images.forEach((im, i) => obj(imgId(i), [`<< /Type /XObject /Subtype /Image /Width ${im.wpx} /Height ${im.hpx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.bytes.length} >>\nstream\n`, im.bytes, '\nendstream']));
      const res = `<< /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R /F4 6 0 R >> /XObject << ${this.images.map((_, i) => `/Im${i} ${imgId(i)} 0 R`).join(' ')} >> >>`;
      this.pages.forEach((pg, k) => {
        const c = pg.join('\n');
        obj(pageId(k), `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources ${res} /Contents ${contId(k)} 0 R >>`);
        obj(contId(k), [`<< /Length ${c.length} >>\nstream\n`, c, '\nendstream']);
      });
      const xref = len;
      put(`xref\n0 ${total}\n0000000000 65535 f \n`);
      for (let i = 1; i < total; i++) put(`${String(offs[i] || 0).padStart(10, '0')} 00000 n \n`);
      put(`trailer\n<< /Size ${total} /Root 1 0 R /Info 7 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
      const out = new Uint8Array(len); let o = 0; for (const b of chunks) { out.set(b, o); o += b.length; }
      return out;
    }
  }
  /** JPEG d'un canvas (dataURL → octets) */
  function canvasJPEG(cv, q = 0.92) { const s = atob(cv.toDataURL('image/jpeg', q).split(',')[1]), b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b; }
  return { Doc, measure, canvasJPEG, W, H };
})();
if (typeof module !== 'undefined') module.exports = PDF;
