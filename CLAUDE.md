# Focale — notes pour Claude

Logiciel web de conception optique séquentielle (ergonomie inspirée de Quadoa, fonctions de CODE V / Zemax).
Interface et commentaires en français. Unités : mm, longueurs d'onde en µm.

## Architecture
- `src/engine.js` : moteur pur (aucune dépendance au DOM), exporté en module Node pour les tests.
  Paraxial y-nu à indices signés, tracé réel vectoriel (coniques + asphères paires, miroirs),
  pupilles paraxiales + visée réelle optionnelle, OPD/Zernike, PSF/FTM par FFT, Seidel, optimiseur DLS.
- `src/app.js` : interface (éditeur de lentilles, layout 2D/3D canvas, panneaux d'analyse, optimiseur, tolérancement…).
- `src/io.js` : import/export Zemax `.zmx` et CODE V `.seq` (module Node testable) : `decode` (UTF-16), `detect`, `parseZMX`/`toZMX`, `parseSeq`/`toSeq` ; chaque fonction renvoie aussi `warnings`. Décentrements ↔ COORDBRK, verres fictifs ↔ ___BLANK / PRV.
- `src/pdf.js` : écrivain PDF autonome (`PDF.Doc` : text/para/line/rect/poly/jpeg/build ; Helvetica, Courier, Symbol pour le grec ; WinAnsi). `src/report.js` : fenêtre « Rapport PDF » et `genReport()` (rendu hors écran en thème clair via `App.forceLight`, `drawLayout({c,w,h})`, `simSync`).
- Logo « tache d'Airy » sur tuile sombre (#0f172a, anneaux #263f64/#3c659c, cœur #60a5fa, point #f59e0b) : `src/pwa/icon.svg` (→ `icon-192/512.png` via sharp), en-tête de `shell.html`, `lensMark()` dans `report.js`.
- `src/samples.js` : systèmes d'exemple. `src/shell.html` : HTML/CSS avec marqueurs `/*__ENGINE__*/` etc.
- `index.html`, `sw.js`, `manifest.webmanifest`, `icon.svg` sont GÉNÉRÉS par `python3 build.py` (version = hash du contenu, ce qui déclenche la mise à jour des applications installées) : ne jamais les éditer à la main, toujours régénérer et commiter.

## Conventions
- Convention de signes Zemax/CODE V : épaisseurs négatives après un miroir, R > 0 centre à droite.
- OPD (`opdRef().W`) = chemin du rayon principal − chemin du rayon (> 0 = front d'onde en avance, convention CODE V/Zemax) : W040 = +SI/8 ; la PSF utilise donc la phase −2πW. Test indépendant : `/tmp/phys/check.js` (recréé au besoin) — tracé méridien et ABCD maison.
- F/# image (`aperture.type = 'FNO'`) : EPD = EFL / F# en conjugué fini comme à l'infini (Zemax « Image Space F/# »). FTM : limite de diffraction calculée sur la même pupille (`mtfOne` → DT/DS).
- Optimisation : `OPS` (opérandes, `kind` = contrainte par défaut, `op.cmp` eq/ge/le, `list` pour les épaisseurs, `p` paramètre), `opValue`, `residuals` (→ `parts`, `img2`), variables `vr/vt/vk/va4…va10` (`getVars`), `merit.wl` ('all' | 'central' | 'primary' | indice, via `wlSel`). `quickFocus(sys, {crit, wl})` (épaisseur avant l'image, solve M retiré). UI : `openOptim`, `optLive`, `runOpt`, `runGlobal` (Hammer), `quickFocusUI`, `qfMenu` (`App.qf` dans `focale.ui`).
- Verres variables : `s.vg` ; verre modèle « nd/νd » (`parseModel`, `fmtModel`, `toModel`), variables `nd`/`vd` dans `getVars` (seulement si le verre est un modèle), opérande `RGLA`, `glassNearest`/`glassPool` (écart normalisé Δnd/0,01, Δνd/1,5 ; `merit.gsub` = {cats, pref, k, passes}), `subTry` ; UI `optGlassHTML`, `runSubst`.
- Couleurs : `fields[i].col` et `wavelengths[i].col` optionnels (sélecteurs `input.cpk`) ; `fcol(i)` et `wlCol(um)` les lisent dans `App.sys`, sinon palette / couleur spectrale (`wlSpec`). Thème sombre par défaut (`focale.ui.th`).
- Surface 0 = objet, dernière = image ; champs {x, y} (angles si objet à l'infini — direction ∝ (tan x, tan y, 1) —, hauteurs sinon).
- Décentrements par surface (dx, dy, dz, tx, ty, tz en °, dmode DEC | DAR | BEN, rotations X→Y→Z main droite) : `frames()` calcule le repère de chaque surface, le tracé réel se fait en coordonnées globales et `trace()` renvoie le rayon dans le repère local de l'image. Le paraxial ignore décentrements et bascules.
- `sag(sf, x, y)` / `sGrad(sf, x, y)` : flèche et pente locales (partie de révolution + forme libre éventuelle).
- Avant chaque commit : `node tests/engine.test.js` doit passer, puis `python3 build.py`.
- Tolérancement (engine : `TOLT` types TFRN/TRAD/TIRR/TCON/TTHI/TIND/TABB/TSD*/TST*/TED*/TET*, `TOLC` critères WFE/SPOT/MTF (MTF : `up`, plus grand = meilleur, `tolWorse`)) :
  `tolBase` = solves figés + même compensation que les systèmes perturbés (`compensate` : variables V par `optStep` si `opts.vars`, puis `bestFocus` sur l'épaisseur avant l'image ; FTM → foyer au meilleur WFE).
  Liste : `cfg.list` (personnalisée, {type, j, min, max, on}) sinon `tolGen` depuis `cfg.types` ; `tolItems` filtre par `tolApplicable` et ajoute l'ouverture utile `h` (franges à `LT` = 632,8 nm).
  Application : décentrements DAR, `dn` (indice), `dv` (% sur νd, dispersion autour de nd dans `indices`), TFRN conversion exacte de flèche, TIRR → polynôme XY (ou Zernike) Δz = A(½ρ⁴ + ½ρy²).
  `tolSens`, `tolInverse` (modèle Δ ∝ t^p), `tolTrial`/`tolRebuild` (tirages, `rng` mulberry32 pour la graine, `tolDraw` normal/uniform/para/end), `niceDown`. UI : `openTol`, `renderTolL`, `renderTolRes`, `mcStats`, `mcContrib`, `tolLoad`.
- Verres : registre `glassRecord / addGlasses` (clé normalisée sans tirets ni espaces, suffixe `_CATALOGUE` pour lever les homonymies), formules refractiveindex.info `R2`/`R3` et Zemax AGF `A1`…`A13` dans `dispN`. `src/glasses.js` est généré : ne pas éditer à la main.
- Surfaces de forme libre : `type` = STD | XY (`xy` : {"i,j": c}) | ZERN (`zc`[16], rayon `zr`) ; intersection par Newton ; ignorées par le paraxial et les Seidel.
- Types d'éléments (`elem`) : '' (dioptre) | grating (`lpmm`, `gm`, `gang` ; réflexion si verre MIRROR) | ideal (`fid`, plan, puissance ajoutée au paraxial) | polarizer (`pang`) | waveplate (`ret` en ondes, `wang`). Traités dans `trace()` après l'intersection.
- Polarisation : `ray(..., { polState, fresnel })` propage un champ E complexe 3D (`polStep`) ; `polPupil` pour l'analyse. `imageSim` : cartographie des rayons principaux + PSF 5×5 dans le champ, objet à l'infini inversé (scène +v ↔ champ −y).
- Aide : `src/help.js` (tableau `HELP`) — **à mettre à jour à CHAQUE modification visible** (nouvelle fonction, bouton, raccourci, option, changement de comportement) : demande explicite de l'utilisateur.
- Détecteur : `sys.det` {on, p (µm), nx, ny, ff (%), bits, fw, rn, lvl, noise} ; `binPSF`, `binImage`, `detMTF` ; `imageSim(..., { pix })` échantillonne sur les pixels. Source étendue : `extSource(M, f, { type: point|disk|gauss|rect, d, na, w, h })` (unités µm objet fini, ″ objet à l'infini).
- Source du système : `sys.src` {type none|fiber|disk|gauss|rect|point, fib si|gi|sm, core, clad, na, mfd, lc0 (nm), dl (nm), len, att, bw, d, w, h} ; `fiberInfo` (V, coupure, MFD Marcuse) ; `srcModel()` (app) remplace les λ par le spectre de la source.
