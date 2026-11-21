# Focale — notes pour Claude

Logiciel web de conception optique séquentielle (ergonomie inspirée de Quadoa, fonctions de CODE V / Zemax).
Interface et commentaires en français. Unités : mm, longueurs d'onde en µm.

## Architecture
- `src/engine.js` : moteur pur (aucune dépendance au DOM), exporté en module Node pour les tests.
  Paraxial y-nu à indices signés, tracé réel vectoriel (coniques + asphères paires, miroirs),
  pupilles paraxiales + visée réelle optionnelle, OPD/Zernike, PSF/FTM par FFT, Seidel, optimiseur DLS.
- `src/app.js` : interface (éditeur de lentilles, layout 2D/3D canvas, panneaux d'analyse, optimiseur, import/export JSON & CODE V .seq).
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
