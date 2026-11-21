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
- Surface 0 = objet, dernière = image ; champs en Y uniquement (angle si objet à l'infini, hauteur sinon).
- Avant chaque commit : `node tests/engine.test.js` doit passer, puis `python3 build.py`.
