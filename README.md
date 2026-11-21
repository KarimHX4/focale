# Focale — conception optique dans le navigateur

Logiciel de conception optique séquentielle : éditeur de lentilles, tracé de rayons réels,
analyses (spot, ray fan, OPD, WFE/Zernike, PSF, FTM, énergie encerclée, footprint,
courbure de champ, distorsion, Seidel, chromatisme), optimisation par moindres carrés amortis
et tolérancement (sensibilités, RSS, Monte-Carlo avec compensateur).

- Éléments : dioptres, miroirs, réseaux de diffraction (transmission / réflexion), lentilles idéales, polariseurs, lames d'onde
- Formes : sphère, conique, asphère paire, polynôme XY (ordre 6), Zernike Fringe (16 termes)
- Polarisation : tracé du champ électrique 3D (Fresnel, miroirs, polariseurs, retardateurs)
- Simulation d'image : distorsion, PSF variable dans le champ, chromatisme RVB, vignetage
- Aide intégrée (F1) avec recherche
- Décentrements et bascules par surface (DEC, DAR, pliage BEN), champs en X et Y
- Plus de 1000 verres Schott, Ohara, CDGM, Hoya + import de catalogues Zemax `.agf`
- Import/export JSON et CODE V (.seq)

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
- `src/help.js` — contenu du centre d'aide
- `src/glasses.js` — catalogues de verres (généré depuis refractiveindex.info, CC0)
- `src/shell.html` — HTML/CSS
- `src/pwa/` — manifeste, service worker et icône de l'application installable
- `build.py` — assemble le tout dans `index.html` + `sw.js` versionné (`python3 build.py`)

## Tester le moteur
`node -e "const OE=require('./src/engine.js'),S=require('./src/samples.js');console.log(OE.prepare(S['Triplet de Cooke f=50 F/5']()).par.efl)"`
→ doit afficher ≈ 50.0214

## Publier avec GitHub Pages
Settings → Pages → Source : branche `main`, dossier `/ (root)`. Le site est servi à
`https://<utilisateur>.github.io/focale/`.

## Données
Les catalogues de verres proviennent de la base [refractiveindex.info](https://github.com/polyanskiy/refractiveindex.info-database)
(domaine public, CC0 1.0), elle-même issue des catalogues publiés par les fabricants.
