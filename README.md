# Focale — conception optique dans le navigateur

Logiciel de conception optique séquentielle : éditeur de lentilles, tracé de rayons réels,
analyses (spot, ray fan, OPD, WFE/Zernike, PSF, FTM, énergie encerclée, footprint,
courbure de champ, distorsion, Seidel, chromatisme) et optimisation par moindres carrés amortis.
Import/export JSON et CODE V (.seq).

## Utiliser
- En ligne : https://karimhx4.github.io/focale/ (après activation de GitHub Pages).
- **Installer comme application** : ouvrir le site dans Chrome ou Edge et cliquer sur « Installer »
  (barre d'outils de Focale ou icône dans la barre d'adresse). L'application fonctionne hors ligne et se
  met à jour automatiquement à chaque nouvelle version poussée sur `main`.
- Hors ligne sans installation : ouvrir `index.html` directement dans le navigateur.
- Fichiers : Ctrl+O / Ctrl+S (.json), export CODE V .seq, glisser-déposer de fichiers .json / .seq / .agf.

## Structure
- `src/engine.js` — moteur optique (paraxial, tracé réel, diffraction, optimisation), sans dépendance
- `src/app.js` — interface
- `src/samples.js` — systèmes d'exemple
- `src/shell.html` — HTML/CSS
- `src/pwa/` — manifeste, service worker et icône de l'application installable
- `build.py` — assemble le tout dans `index.html` + `sw.js` versionné (`python3 build.py`)

## Tester le moteur
`node -e "const OE=require('./src/engine.js'),S=require('./src/samples.js');console.log(OE.prepare(S['Triplet de Cooke f=50 F/5']()).par.efl)"`
→ doit afficher ≈ 50.0214

## Publier avec GitHub Pages
Settings → Pages → Source : branche `main`, dossier `/ (root)`. Le site est servi à
`https://<utilisateur>.github.io/focale/`.
