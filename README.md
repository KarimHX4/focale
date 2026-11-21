# Focale — conception optique dans le navigateur

Logiciel de conception optique séquentielle : éditeur de lentilles, tracé de rayons réels,
analyses (spot, ray fan, OPD, WFE/Zernike, PSF, FTM, énergie encerclée, footprint,
courbure de champ, distorsion, Seidel, chromatisme) et optimisation par moindres carrés amortis.
Import/export JSON et CODE V (.seq).

## Utiliser
Ouvrir `index.html` dans un navigateur récent (Chrome, Edge, Firefox). Aucun serveur ni installation.

## Structure
- `src/engine.js` — moteur optique (paraxial, tracé réel, diffraction, optimisation), sans dépendance
- `src/app.js` — interface
- `src/samples.js` — systèmes d'exemple
- `src/shell.html` — HTML/CSS
- `build.py` — assemble le tout dans `index.html` (`python3 build.py`)

## Tester le moteur
`node -e "const OE=require('./src/engine.js'),S=require('./src/samples.js');console.log(OE.prepare(S['Triplet de Cooke f=50 F/5']()).par.efl)"`
→ doit afficher ≈ 50.0214

## Publier avec GitHub Pages
Settings → Pages → Source : branche `main`, dossier `/ (root)`. Le site est servi à
`https://<utilisateur>.github.io/focale/`.
