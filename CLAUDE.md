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
- `src/samples.js` : systèmes d'exemple. `src/shell.html` : HTML/CSS avec marqueurs `/*__ENGINE__*/` etc.
- `index.html`, `sw.js`, `manifest.webmanifest`, `icon.svg` sont GÉNÉRÉS par `python3 build.py` (version = hash du contenu, ce qui déclenche la mise à jour des applications installées) : ne jamais les éditer à la main, toujours régénérer et commiter.

## Conventions
- Convention de signes Zemax/CODE V : épaisseurs négatives après un miroir, R > 0 centre à droite.
- Surface 0 = objet, dernière = image ; champs {x, y} (angles si objet à l'infini — direction ∝ (tan x, tan y, 1) —, hauteurs sinon).
- Décentrements par surface (dx, dy, dz, tx, ty, tz en °, dmode DEC | DAR | BEN, rotations X→Y→Z main droite) : `frames()` calcule le repère de chaque surface, le tracé réel se fait en coordonnées globales et `trace()` renvoie le rayon dans le repère local de l'image. Le paraxial ignore décentrements et bascules.
- `sag(sf, x, y)` / `sGrad(sf, x, y)` : flèche et pente locales (partie de révolution + forme libre éventuelle).
- Avant chaque commit : `node tests/engine.test.js` doit passer, puis `python3 build.py`.
- Tolérancement (`TOLT`, `tolBase`, `tolItems`, `tolApply`, `criterion`, `bestFocus`) : système de base = solves figés + nominal au meilleur foyer ;
  chaque tolérance est appliquée par décentrements DAR / champ `dn` (indice) ; compensateur = épaisseur avant l'image (encadrement + section dorée).
- Verres : registre `glassRecord / addGlasses` (clé normalisée sans tirets ni espaces, suffixe `_CATALOGUE` pour lever les homonymies), formules refractiveindex.info `R2`/`R3` et Zemax AGF `A1`…`A13` dans `dispN`. `src/glasses.js` est généré : ne pas éditer à la main.
- Surfaces de forme libre : `type` = STD | XY (`xy` : {"i,j": c}) | ZERN (`zc`[16], rayon `zr`) ; intersection par Newton ; ignorées par le paraxial et les Seidel.
- Types d'éléments (`elem`) : '' (dioptre) | grating (`lpmm`, `gm`, `gang` ; réflexion si verre MIRROR) | ideal (`fid`, plan, puissance ajoutée au paraxial) | polarizer (`pang`) | waveplate (`ret` en ondes, `wang`). Traités dans `trace()` après l'intersection.
- Polarisation : `ray(..., { polState, fresnel })` propage un champ E complexe 3D (`polStep`) ; `polPupil` pour l'analyse. `imageSim` : cartographie des rayons principaux + PSF 5×5 dans le champ, objet à l'infini inversé (scène +v ↔ champ −y).
- Aide : `src/help.js` (tableau `HELP`) — à tenir à jour avec chaque nouvelle fonction.
- Détecteur : `sys.det` {on, p (µm), nx, ny, ff (%), bits, fw, rn, lvl, noise} ; `binPSF`, `binImage`, `detMTF` ; `imageSim(..., { pix })` échantillonne sur les pixels. Source étendue : `extSource(M, f, { type: point|disk|gauss|rect, d, na, w, h })` (unités µm objet fini, ″ objet à l'infini).
- Source du système : `sys.src` {type none|fiber|disk|gauss|rect|point, fib si|gi|sm, core, clad, na, mfd, lc0 (nm), dl (nm), len, att, bw, d, w, h} ; `fiberInfo` (V, coupure, MFD Marcuse) ; `srcModel()` (app) remplace les λ par le spectre de la source.
