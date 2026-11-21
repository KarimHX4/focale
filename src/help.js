'use strict';
/* Centre d'aide de Focale : chaque rubrique = { id, t (titre), h (HTML) } */
const HELP = [
  { id: 'demarrage', t: 'Démarrage rapide', h: `
<p>Focale est un logiciel de <b>conception optique séquentielle</b> : la lumière traverse les surfaces dans l'ordre de l'éditeur de lentilles, de l'objet (surface 0) à l'image (dernière surface).</p>
<ol>
<li><b>Chargez un exemple</b> (menu <i>Exemples</i>) ou partez de <i>Fichier → Nouveau système</i>.</li>
<li><b>Réglez le système</b> dans le panneau de gauche : ouverture, champs, longueurs d'onde.</li>
<li><b>Saisissez les surfaces</b> dans l'éditeur : rayon, épaisseur, verre. Choisissez le <b>type d'élément</b> (dioptre, miroir, réseau, lentille idéale, polariseur, lame d'onde) dans la colonne <i>Élément</i>.</li>
<li><b>Observez</b> le layout et les fenêtres d'analyse : tout se recalcule à chaque modification.</li>
<li><b>Optimisez</b> : cliquez sur <b>V</b> à côté des paramètres à faire varier, puis <i>Optimiser</i>.</li>
<li><b>Tolérancez</b> pour estimer la sensibilité à la fabrication, puis <b>enregistrez</b> (Ctrl+S).</li>
</ol>
<p class="hint">Astuce : double-cliquez sur l'en-tête d'une fenêtre d'analyse pour l'agrandir ; Échap pour revenir.</p>` },

  { id: 'interface', t: 'L\'interface', h: `
<ul>
<li><b>Barre du haut</b> : fichiers, exemples, annuler/rétablir, optimisation, tolérancement, nombre de fenêtres d'analyse (1, 2, 4, 6), thème clair/sombre, aide.</li>
<li><b>Panneau de gauche</b> : propriétés de la <b>surface sélectionnée</b> (type d'élément, forme, décentrements), puis ouverture, champs, longueurs d'onde et données paraxiales.</li>
<li><b>Éditeur de lentilles</b> (centre, en haut) : une ligne par surface.</li>
<li><b>Layout</b> (centre, en bas) : coupe 2D ou vue 3D. Molette = zoom, glisser = déplacer (3D : rotation ; Maj+glisser = déplacer), clic = sélectionner une surface, double-clic = ajuster.</li>
<li><b>Analyses</b> (droite) : chaque fenêtre a son propre choix d'analyse et ses réglages ; ⤓ enregistre l'image PNG, ⤢ agrandit.</li>
<li><b>Barre d'état</b> : focale, F/#, longueur, nombre de variables, avertissements et temps de calcul.</li>
</ul>
<p>Les séparateurs entre zones se déplacent à la souris. Le système et la disposition sont mémorisés automatiquement dans le navigateur.</p>
<p><b>Fenêtres</b> (verres, optimisation, tolérancement, rapport, aide…) : elles flottent au-dessus de l'interface sans la bloquer — on peut continuer à travailler dans l'éditeur pendant qu'elles sont ouvertes. Glisser la <b>barre de titre</b> pour déplacer ; <b>–</b> (ou double-clic sur le titre) pour réduire à la barre de titre ; <b>□</b> pour agrandir en plein écran ; la <b>poignée en bas à droite</b> pour changer la taille ; ✕ ou Échap pour fermer. Position et taille sont retenues pour chaque fenêtre pendant la session.</p>` },

  { id: 'lde', t: 'Éditeur de lentilles', h: `
<table class="ht"><tr><th>Colonne</th><th>Signification</th></tr>
<tr><td>#</td><td>Numéro de surface (0 = objet, dernière = image).</td></tr>
<tr><td>Type</td><td>Badges : OBJ, IMA, STO (diaphragme), MIR (miroir), DEC/DAR/BEN (décentrement), XY/ZRN (forme libre). Double-clic : placer le diaphragme.</td></tr>
<tr><td>Élément</td><td>Fonction optique de la surface (voir <i>Types d'éléments</i>).</td></tr>
<tr><td>Rayon</td><td>Rayon de courbure en mm. « Infini », 0 ou vide = plan. R &gt; 0 : centre de courbure du côté +z.</td></tr>
<tr><td>Épaisseur</td><td>Distance jusqu'à la surface suivante (mm). Négative après un miroir. Pour l'objet : distance objet (« Infini » pour un objet à l'infini).</td></tr>
<tr><td>Verre</td><td>Milieu <b>après</b> la surface : vide/air, nom de catalogue (N-BK7, S-LAH79…), modèle <code>nd/νd</code> (ex. <code>1.5168/64.2</code>), indice fixe (<code>1.5</code>) ou <code>MIRROR</code>.</td></tr>
<tr><td>Demi-diamètre</td><td>Calculé automatiquement (italique) à partir des rayons ; 🔒 le fixe et vignette les rayons au-delà.</td></tr>
<tr><td>Conique</td><td>Constante de conicité k (0 sphère, −1 parabole, &lt;−1 hyperbole, ]−1,0[ ellipse).</td></tr>
<tr><td>A4…A10</td><td>Coefficients d'asphérique pair (case « Asphères »).</td></tr></table>
<p><b>Boutons</b> : <b>V</b> = variable d'optimisation ; <b>M</b> = solve de mise au point (épaisseur telle que le rayon marginal paraxial coupe l'axe à la surface suivante) ; 🔒 = demi-diamètre fixe.</p>
<p><b>Clavier</b> : Entrée valide et descend, Tab passe à la colonne suivante, flèches haut/bas, Échap annule, Inser insère une surface après la sélection, Suppr (hors d'un champ de saisie) ou Ctrl+Suppr supprime la surface sélectionnée.</p>
<p><b>Clic droit</b> sur une ligne : menu contextuel — insérer avant/après, ajouter une lentille, choisir le verre, diaphragme, miroir, retourner, <b>supprimer la surface</b> ou <b>supprimer l'élément</b> (les deux surfaces d'une lentille). Toute suppression s'annule avec Ctrl+Z.</p>
<p><b>Outils</b> : + Avant / + Après / + Lentille (deux surfaces N-BK7), Supprimer, Diaphragme, Miroir, Retourner (inverse un élément), Verres… (catalogue).</p>` },

  { id: 'elements', t: 'Types d\'éléments', h: `
<p>Choisissez le type dans la colonne <b>Élément</b> ; ses paramètres apparaissent dans le panneau <b>Surface</b> à gauche.</p>
<h4>Dioptre</h4><p>Surface réfractive classique entre deux milieux (loi de Snell-Descartes vectorielle). Le verre indiqué est celui qui suit la surface.</p>
<h4>Miroir</h4><p>Réflexion. Après un miroir la lumière repart vers −z : les épaisseurs suivantes sont négatives (convention CODE V / Zemax). Un miroir plan de renvoi se crée en un clic (« Miroir de renvoi 45° »).</p>
<h4>Réseau (T) et Réseau (R)</h4><p>Réseau de diffraction en transmission ou en réflexion, gravé sur la surface (plane ou courbe). Paramètres : <b>traits/mm</b>, <b>ordre m</b>, <b>orientation des traits</b> (0° : traits parallèles à X local, dispersion selon Y). Équation vectorielle : la composante tangentielle de n·<b>d</b> augmente de m·λ/d. Un ordre évanescent vignette le rayon. Le bouton « Aligner la suite sur l'ordre m » insère une surface d'axe basculée pour suivre le faisceau diffracté à la longueur d'onde primaire.</p>
<h4>Lentille idéale</h4><p>Lentille mince parfaite de focale f : chaque faisceau parallèle converge exactement en un point du plan focal (pas d'aberration). Utile pour modéliser un objectif ou un oculaire « parfait », ou pour étudier un sous-système isolément. Rayon et forme ignorés.</p>
<h4>Polariseur</h4><p>Polariseur linéaire idéal : ne transmet que la composante du champ électrique selon son axe (angle depuis X local). Respecte la loi de Malus.</p>
<h4>Lame d'onde</h4><p>Retardateur idéal : déphasage de 2π·retard (en ondes) entre l'axe lent et l'axe rapide (angle depuis X local). λ/4 à 45° d'une polarisation linéaire → circulaire ; λ/2 → rotation de la polarisation.</p>
<p class="hint">Polariseurs et lames d'onde n'affectent que la polarisation : utilisez l'analyse <i>Polarisation</i>. Les réseaux sont ignorés par le calcul paraxial (focale, pupilles).</p>` },

  { id: 'formes', t: 'Formes de surface', h: `
<p>Dans le panneau <b>Surface</b>, champ <i>Forme</i> :</p>
<h4>Standard</h4><p>z(r) = c·r² / (1 + √(1 − (1+k)c²r²)) + A4·r⁴ + A6·r⁶ + A8·r⁸ + A10·r¹⁰, avec c = 1/R.</p>
<h4>Polynôme XY</h4><p>Base standard + Σ cᵢⱼ·xⁱ·yʲ pour 1 ≤ i+j ≤ 6 (coordonnées locales, mm). Pour des surfaces de forme libre non symétriques (anamorphoseurs, correcteurs hors axe).</p>
<h4>Zernike (Fringe)</h4><p>Base standard + Σ cₖ·Zₖ(x/R, y/R) sur 16 termes Fringe (piston, basculements, défocalisation, astigmatismes, comas, sphérique, trèfles, ordres 5). R = rayon de normalisation ; cₖ en mm. Idéal pour représenter un défaut de surface mesuré.</p>
<p class="hint">L'intersection rayon/surface est résolue par la méthode de Newton. Les termes de forme libre ne sont pas pris en compte par le calcul paraxial ni par les coefficients de Seidel.</p>` },

  { id: 'decentrements', t: 'Décentrements et bascules', h: `
<p>Chaque surface peut être décentrée (X, Y, Z en mm) puis basculée (α autour de X, β autour de Y, γ autour de Z, en degrés, règle de la main droite, dans cet ordre).</p>
<ul>
<li><b>Décentrement simple (DEC)</b> : le nouvel axe est conservé pour les surfaces suivantes (comme un élément monté de travers dont tout ce qui suit dépend).</li>
<li><b>Décentrement et retour (DAR)</b> : seule cette surface est déplacée ; la suite reste sur l'axe d'origine.</li>
<li><b>Pliage (BEN)</b> : pour un miroir basculé de θ, l'axe suit le faisceau réfléchi (rotation 2θ). C'est ce qu'utilise « Miroir de renvoi 45° ».</li>
</ul>
<p>Le tracé réel se fait en coordonnées globales ; spots, fronts d'onde et footprints sont exprimés dans le repère local de la surface concernée. Les données paraxiales ignorent les décentrements.</p>` },

  { id: 'systeme', t: 'Ouverture, champs, longueurs d\'onde', h: `
<h4>Ouverture</h4><ul><li><b>Diamètre de la pupille d'entrée</b> (EPD), <b>F/# image</b> (objet à l'infini) ou <b>ouverture numérique objet</b> (objet à distance finie).</li>
<li><b>Obstruction centrale</b> : fraction du rayon de pupille masquée (télescopes à miroir secondaire).</li>
<li><b>Visée réelle des rayons</b> : chaque rayon est itéré pour viser exactement le diaphragme (utile pour les grands champs et les pupilles aberrantes) ; sinon visée paraxiale de la pupille d'entrée.</li></ul>
<h4>Champs</h4><p>Angles X/Y (°) pour un objet à l'infini (direction ∝ (tan X, tan Y, 1)), hauteurs X/Y (mm) sinon. Le poids sert à l'optimisation et au tolérancement.</p>
<h4>Longueurs d'onde</h4><p>En µm, avec poids et longueur d'onde <b>primaire</b> (pupilles, fronts d'onde par défaut, solves). Préréglages F-d-C, visible, 632,8 nm, NIR.</p>
<h4>Données paraxiales</h4><p>Focale effective, tirage, F/#, ouvertures numériques, positions et diamètres des pupilles, grandissement, invariant de Lagrange.</p>` },

  { id: 'verres', t: 'Verres et catalogues', h: `
<p>Plus de 1000 verres <b>Schott, Ohara, CDGM et Hoya</b> (base refractiveindex.info, domaine public), plus silice fondue et CaF₂. Bouton <b>Verres…</b> (ou clic droit sur une surface › Choisir le verre) : recherche et filtre par fabricant. Un clic <b>surligne</b> le verre choisi et affiche en bas de la fenêtre la demande de confirmation (verre, nd, νd, surface visée et verre actuel) : <b>Valider</b> l'affecte, <b>Annuler</b> abandonne (Entrée dans la recherche valide aussi). Le verre actuel de la surface est repéré par « · actuel ». La fenêtre reste ouverte : sélectionnez une autre surface dans l'éditeur pour continuer.</p>
<ul>
<li>Saisie libre avec auto-complétion ; tirets et casse ignorés (<code>nbk7</code> = N-BK7).</li>
<li>Homonymes : suffixe fabricant, ex. <code>F2_CDGM</code>. Les noms CODE V (<code>NBK7_SCHOTT</code>) sont reconnus.</li>
<li>Verre fictif : <code>nd/νd</code> (dispersion de Cauchy ajustée sur F, d, C) ou indice fixe.</li>
<li><b>Import AGF</b> (catalogue Zemax, formules 1 à 13) : glisser-déposer le fichier ou bouton « Importer un AGF… ». Les verres importés sont gardés dans le navigateur et embarqués dans les fichiers .json qui les utilisent.</li>
<li>Un avertissement s'affiche si une longueur d'onde sort du domaine de validité d'un verre.</li>
</ul>` },

  { id: 'analyses', t: 'Analyses', h: `
<table class="ht"><tr><th>Analyse</th><th>Description</th></tr>
<tr><td>Diagramme de spot</td><td>Impacts des rayons dans le plan image (grille de pupille), par champ, couleur = longueur d'onde. RMS et GEO par rapport au barycentre (ou au rayon principal), cercle d'Airy 1,22·λ·F/#.</td></tr>
<tr><td>Ray fan</td><td>Aberration transverse εy(Py) (tangentiel) et εx(Px) (sagittal) par rapport au rayon principal.</td></tr>
<tr><td>OPD fan</td><td>Écart de chemin optique (en ondes) le long des deux coupes de pupille.</td></tr>
<tr><td>Carte WFE</td><td>Front d'onde dans la pupille de sortie : OPD par rapport à une sphère de référence centrée sur l'image du rayon principal. RMS, PV, Strehl (Maréchal). Option : retrait du tilt.</td></tr>
<tr><td>Zernike</td><td>Décomposition du front d'onde sur 16 polynômes Fringe (moindres carrés).</td></tr>
<tr><td>PSF</td><td>Réponse impulsionnelle par FFT de la pupille complexe (64×64 dans 256×256), échelle linéaire ou log, rapport de Strehl.</td></tr>
<tr><td>FTM / MTF</td><td>Module de la fonction de transfert (FFT de la PSF), tangentiel et sagittal, polychromatique pondéré, avec limite de diffraction.</td></tr>
<tr><td>Énergie encerclée</td><td>Fraction d'énergie dans un cercle : diffraction (λ primaire) et géométrique (polychromatique), rayon à 80 %.</td></tr>
<tr><td>Footprint</td><td>Empreinte des faisceaux de chaque champ sur une surface, comparée au demi-diamètre (dimensionnement des optiques et montures).</td></tr>
<tr><td>Courbure de champ &amp; distorsion</td><td>Foyers tangentiel et sagittal en fonction du champ, distorsion en %.</td></tr>
<tr><td>Seidel</td><td>Coefficients du 3ᵉ ordre par surface (sphérique, coma, astigmatisme, Petzval, distorsion, chromatismes axial et latéral) et équivalents W040, W131…</td></tr>
<tr><td>Décalage focal chromatique</td><td>Position du foyer paraxial en fonction de λ.</td></tr>
<tr><td>Carte des verres</td><td>Diagramme nd / νd des catalogues, verres utilisés en orange.</td></tr>
<tr><td>Polarisation</td><td>Voir la rubrique dédiée.</td></tr>
<tr><td>Simulation d'image</td><td>Voir la rubrique dédiée.</td></tr>
<tr><td>Prescription</td><td>Tableau des surfaces, performances par champ, données paraxiales.</td></tr></table>` },

  { id: 'polarisation', t: 'Polarisation', h: `
<p>Focale suit le <b>champ électrique complexe 3D</b> le long de chaque rayon :</p>
<ul><li><b>Dioptres</b> : coefficients de Fresnel tₛ et tₚ (surfaces non traitées) si « Fresnel » est coché, sinon traitement antireflet parfait.</li>
<li><b>Miroirs</b> : réflexion métallique idéale (rₛ = −1, rₚ = +1).</li>
<li><b>Polariseurs et lames d'onde</b> : opérateurs idéaux (voir <i>Types d'éléments</i>).</li></ul>
<p>L'analyse <b>Polarisation</b> montre, pour chaque point de la pupille, l'ellipse de polarisation en sortie (orientation ψ, ellipticité χ ; noir = linéaire, rouge = elliptique droite, bleu = gauche) et la transmission en intensité (couleur). États d'entrée : linéaire X, Y, ±45°, circulaire droite/gauche, ou non polarisé (moyenne de X et Y, transmission seule).</p>
<p class="hint">Convention : polarisation exprimée dans le repère local de l'image ; circulaire droite = (1, −i)/√2 dans la base (X, Y).</p>` },

  { id: 'imgsim', t: 'Simulation d\'image', h: `
<p>L'analyse <b>Simulation d'image</b> montre ce que produit votre système à partir d'une scène :</p>
<ol><li>La scène (mire intégrée ou votre image via <i>Image…</i>) couvre le demi-champ choisi (par défaut le champ maximal du système).</li>
<li>Chaque point est envoyé à sa position image réelle par interpolation des <b>rayons principaux</b> : la <b>distorsion</b> et le <b>chromatisme latéral</b> sont inclus.</li>
<li>L'image est convoluée par une <b>PSF qui varie dans le champ</b> (grille 5×5, interpolation bilinéaire), calculée par diffraction ou, si le front d'onde dépasse 1,5 λ RMS, à partir du spot géométrique.</li>
<li>Les canaux <b>rouge, vert, bleu</b> utilisent respectivement la plus grande, la médiane et la plus petite longueur d'onde du système.</li>
<li>Le <b>vignetage</b> est pris en compte (fraction de pupille transmise).</li></ol>
<p>L'image est inversée comme dans un vrai objectif ; cochez « redresser » pour la remettre à l'endroit. Mires : <b>USAF 1951</b> (groupes 0 à 5, six éléments par groupe au pas 2^(1/6), bord incliné, étoile de Siemens), texte, grille (distorsion), champ d'étoiles (PSF dans le champ), étoile de Siemens, damier, mire couleur (chromatisme).</p>
<p class="hint">Le calcul prend environ une seconde ; il est relancé automatiquement après une modification (ou avec ▶ Simuler).</p>` },

  { id: 'detecteur', t: 'Détecteur', h: `
<p>Carte <b>Détecteur</b> (panneau de gauche) : cochez <i>Ajouter un détecteur</i> puis renseignez le <b>pas des pixels</b> (µm, pixels carrés), le <b>format</b> (pixels X × Y), le <b>facteur de remplissage</b>, et pour la simulation de bruit : profondeur (bits), capacité du puits (e⁻), bruit de lecture (e⁻), niveau de signal (% du puits). Des préréglages sont proposés (CMOS 3,45 µm, sCMOS 6,5 µm, CCD 13 µm, InGaAs 15 µm, smartphone 1 µm).</p>
<p>La carte affiche la taille du capteur, la fréquence de <b>Nyquist</b> 1/(2p), la coupure optique 1/(λF), le facteur d'échantillonnage <b>Q = λF/p</b> (Q ≥ 2 : PSF échantillonnée au critère de Nyquist) et le diamètre d'Airy en pixels.</p>
<p>Quand le détecteur est actif :</p>
<ul><li><b>Spot</b> et <b>PSF</b> : grille des pixels superposée ; la PSF peut être affichée <b>intégrée sur les pixels</b> (case « pixels »), avec l'énergie du pixel central et du carré 3×3.</li>
<li><b>Footprint</b> de la surface image : contour du capteur.</li>
<li><b>FTM</b> : FTM du pixel (sinus cardinal, avec facteur de remplissage), produit système × pixel et fréquence de Nyquist.</li>
<li><b>Simulation d'image</b> (case « détecteur ») : l'image est calculée directement sur la grille de pixels (ou affichée sous-échantillonnée si le capteur dépasse la résolution d'affichage), la zone hors capteur est masquée, et le bruit de photons, de lecture et de quantification est ajouté si « Bruit » est coché.</li>
<li><b>Échantillonnage détecteur</b> : PSF intégrée sur une grille 7×7 de pixels, centrée sur un pixel ou sur un coin (cas le plus défavorable), avec énergie du pixel central, du meilleur carré 2×2, des carrés 3×3 et 5×5.</li></ul>` },

  { id: 'source', t: 'Source étendue (fibre, fente…)', h: `
<p>L'analyse <b>Source étendue</b> calcule l'image d'une source réelle placée au point de champ choisi :</p>
<ul><li><b>Fibre multimode</b> : disque uniforme de diamètre Ø (µm) émettant dans une ouverture numérique ON. Si l'ON de la fibre est plus petite que celle du système, la pupille est partiellement remplie (tache de diffraction plus large) ; si elle est plus grande, une partie de la lumière n'entre pas : <b>couplage</b> ≈ (ON système / ON fibre)².</li>
<li><b>Fibre monomode</b> : profil gaussien de diamètre de mode MFD (1/e²) ; son faisceau gaussien apodise la pupille (divergence λ/(π w₀)) ; couplage = 1 − exp(−2 ON²/θ₀²).</li>
<li><b>Fente / rectangle</b> (largeur × hauteur) et <b>point source</b>.</li>
<li>Pour un objet à l'infini, les tailles sont en <b>secondes d'arc</b> (étoile, disque planétaire, fente sur le ciel).</li></ul>
<p>Méthode : la source est projetée dans le plan image par la jacobienne locale des rayons principaux (grandissement, anamorphose, distorsion locale), puis convoluée par la PSF polychromatique (diffraction, ou géométrique si le front d'onde est très aberrant), pupille apodisée selon l'émission de la source. Résultats : image, profils X/Y, FWHM, diamètres à 50/80/95 % d'énergie, couplage, énergie dans un pixel et taille en pixels si un détecteur est défini (case « pixels » : image intégrée sur les pixels).</p>
<p class="hint">Les systèmes fibrés se modélisent avec un objet à distance finie : distance objet = distance fibre → première surface, ouverture = ON objet.</p>
<h4>Définir la fibre (carte « Source / fibre »)</h4>
<ul><li><b>Type</b> : multimode à saut d'indice (champ proche uniforme, émission uniforme jusqu'à l'ON), multimode à gradient d'indice (champ proche parabolique 1 − (r/a)², émission décroissante jusqu'à l'ON ; couplage = 2t² − t⁴ avec t = ON système / ON fibre), monomode (mode gaussien).</li>
<li><b>Ø cœur, Ø gaine, ON</b>. En monomode, le <b>diamètre de mode (MFD)</b> est calculé par la formule de Marcuse à partir du cœur et de l'ON et varie avec λ ; saisissez la valeur du fabricant pour l'imposer (recommandé : l'ON nominale est souvent différente de l'ON effective du profil).</li>
<li><b>Spectre</b> : λ centrale et largeur Δλ (FWHM). Vide : longueurs d'onde du système. Avec Δλ &gt; 0, le spectre gaussien est échantillonné sur 5 longueurs d'onde pour l'analyse (chromatisme compris).</li>
<li><b>Lien fibré (optionnel)</b> : longueur, atténuation (dB/km) → transmission de la fibre et transmission totale (fibre × couplage) ; bande passante modale (MHz·km) → bande passante du lien ≈ BP / longueur.</li>
<li>Grandeurs affichées : fréquence normalisée V = 2π a ON / λ, longueur d'onde de coupure (V = 2,405), régime mono/multimode et nombre de modes approximatif, étendue géométrique.</li>
<li>Préréglages : SMF-28 (1550 nm), monomode 630 nm, OM3 50/125, OM1 62,5/125, saut d'indice 105, 200 et 400 µm.</li></ul>
<p>L'extrémité de la fibre (gaine, cœur, cône d'ouverture) est dessinée dans le layout au plan objet.</p>` },

  { id: 'rapport', t: 'Rapports PDF', h: `
<p>Bouton <b>Rapport</b> (ou <i>Fichier → Rapport PDF…</i>) : composez le rapport puis cliquez sur <b>Générer le PDF</b>.</p>
<ul><li><b>Titre, auteur, notes</b> : repris en page de garde (avec date, version de Focale et chiffres clés) et dans les pieds de page.</li>
<li><b>Sections</b> : données du système et paraxiales, prescription (avec asphères et décentrements), layout 2D, performances par champ (spot, front d'onde, Strehl, vignetage), coefficients de Seidel, détecteur, source / fibre, tolérancement (résultats déjà calculés : sensibilités, RSS, Monte-Carlo avec histogramme).</li>
<li><b>Analyses</b> : cochez celles à inclure ; « un graphique par champ » les répète pour chaque champ. « Fenêtres d'analyse ouvertes » reprend exactement vos fenêtres avec leurs réglages.</li>
<li>Les graphiques sont rendus en haute résolution sur fond blanc (même en mode nuit) ; textes et tableaux sont vectoriels et sélectionnables. Le PDF (A4) est créé dans le navigateur, sans connexion.</li></ul>
<p class="hint">Vos choix sont mémorisés pour le prochain rapport. Dans la version hébergée sur claude.ai, le téléchargement peut être bloqué : utilisez le site GitHub Pages ou l'application installée.</p>` },

  { id: 'optimisation', t: 'Optimisation', h: `
<p>Méthode des <b>moindres carrés amortis</b> (Levenberg-Marquardt) avec Jacobien numérique.</p>
<ul><li><b>Variables</b> : bouton <b>V</b> sur les courbures, épaisseurs et coniques.</li>
<li><b>Critère de qualité image</b> : spot RMS par rapport au barycentre ou front d'onde RMS, évalué par quadrature de Gauss (3 anneaux × 8 bras) pour tous les champs et longueurs d'onde pondérés.</li>
<li><b>Opérandes</b> : focale (EFL), F/# de travail, longueur totale, tirage, distorsion, épaisseurs min/max de verre au centre et au bord, espace d'air minimal.</li></ul>
<p>« Restaurer l'état initial » annule l'optimisation ; Ctrl+Z fonctionne aussi. Raccourci : Ctrl+Maj+O.</p>` },

  { id: 'tolerancement', t: 'Tolérancement', h: `
<p>Estime la dégradation due aux défauts de fabrication et d'alignement.</p>
<ul><li><b>Tolérances</b> : rayon (%), épaisseur, indice, décentrement et bascule de surface, décentrement et bascule d'élément (pivot au sommet de sa 1ʳᵉ surface).</li>
<li><b>Critère</b> : front d'onde RMS (piston et tilt retirés) ou spot RMS.</li>
<li><b>Compensateur</b> : la mise au point (épaisseur avant l'image) est réoptimisée pour chaque cas.</li>
<li><b>Sensibilité</b> : chaque tolérance seule à ±, triée par impact ; estimation RSS du total.</li>
<li><b>Monte-Carlo</b> : toutes les tolérances tirées au hasard (gaussienne tronquée, uniforme ou extrêmes) ; histogramme, courbe cumulée, percentiles 50/80/90/98 % (rendement), plage du compensateur.</li></ul>
<p>« Copier le rapport » exporte les résultats au format CSV.</p>` },

  { id: 'fichiers', t: 'Fichiers, Zemax et CODE V', h: `
<ul><li><b>Ctrl+O</b> ouvrir, <b>Ctrl+S</b> enregistrer (.json, format natif complet), <i>Enregistrer sous…</i></li>
<li><b>Glisser-déposer</b> d'un fichier <b>.zmx</b>, <b>.seq</b>, .json ou .agf sur la fenêtre, ou <i>Fichier → Coller un système</i> : le format est reconnu automatiquement. Les .zmx enregistrés en UTF-16 (cas courant) sont décodés.</li>
<li><i>Fichier → Exporter Zemax (.zmx)</i> et <i>Exporter CODE V (.seq)</i> téléchargent le fichier ; <i>Afficher / copier le texte</i> montre les trois formats.</li>
<li>Après un import ou un export, un <b>rapport</b> liste ce qui a été converti ou ignoré.</li></ul>
<h4>Zemax OpticStudio (.zmx, séquentiel)</h4>
<table class="ht"><tr><th>Élément</th><th>Correspondance</th></tr>
<tr><td>Système</td><td>NAME, UNIT (mm, cm, in, m → mm), ENPD / FNUM / OBNA / FLOA, FTYP (angle, hauteur objet, hauteur image → convertie), XFLN/YFLN/FWGN, WAVM ou WAVL/WWGT, PWAV.</td></tr>
<tr><td>Surfaces</td><td>STANDARD, EVENASPH (PARM 2…5 → A4…A10), COORDBRK (décentrements et bascules), PARAXIAL (lentille idéale), DGRATING (réseau, traits/µm et ordre). CURV, DISZ, CONI, DIAM, CLAP (demi-diamètre fixe), STOP, COMM.</td></tr>
<tr><td>Verres</td><td>Noms de catalogue (Schott, Ohara, CDGM, Hoya, MISC), MIRROR, ___BLANK (modèle nd/νd). Un verre inconnu est remplacé par son modèle nd/νd (signalé).</td></tr>
<tr><td>Export</td><td>Décentrements → paires de COORDBRK (DEC : un CB ; DAR : CB + retour en ordre inverse ; pliage BEN : CB + CB de même bascule). Verres fictifs → ___BLANK. Solves → épaisseurs fixes.</td></tr></table>
<h4>CODE V (.seq)</h4>
<table class="ht"><tr><th>Élément</th><th>Correspondance</th></tr>
<tr><td>Système</td><td>TITLE, DIM (M, C, I → mm), EPD / FNO / NAO, WL, REF, WTW, XAN/YAN, XOB/YOB, XIM/YIM (converties), WTF.</td></tr>
<tr><td>Surfaces</td><td>SO, S, STO, SI, RDM/RDN, RDY/CUY/THI/GLA, K, A…D, CIR, REFL, PIM, XDE…CDE, DAR, BEN (REV → DAR), GRT/GRO/GRS/GRX/GRY (réseau), CCY/THC/KC 0 (variables).</td></tr>
<tr><td>Verres</td><td>NOM_CATALOGUE (NBK7_SCHOTT, SBSL7_OHARA…), codes 6 chiffres, <b>verres privés PRV</b> (PWL + indices → loi de Cauchy). À l'export, verres fictifs et importés deviennent des verres privés PRV.</td></tr></table>
<p class="hint">Non exportés (signalés) : lentille idéale en CODE V, polariseurs et lames d'onde, surfaces XY et Zernike, obstruction centrale, orientation non nulle des traits d'un réseau vers Zemax. Les conventions de bascule sont supposées identiques (rotations main droite) : vérifiez les systèmes décentrés après conversion.</p>
<h4>Installation</h4><p>Depuis le site GitHub Pages, bouton « Installer » (Chrome, Edge) : l'application fonctionne hors ligne, se met à jour à chaque nouvelle version et peut ouvrir directement les fichiers .zmx, .seq, .json et .agf.</p>` },

  { id: 'raccourcis', t: 'Raccourcis clavier', h: `
<table class="ht"><tr><th>Touches</th><th>Action</th></tr>
<tr><td>F1</td><td>Aide</td></tr><tr><td>Ctrl+Z / Ctrl+Y</td><td>Annuler / rétablir</td></tr>
<tr><td>Ctrl+O / Ctrl+S / Ctrl+Maj+S</td><td>Ouvrir / enregistrer / enregistrer sous</td></tr>
<tr><td>Ctrl+Maj+O</td><td>Optimisation</td></tr><tr><td>Inser / Suppr (ou Ctrl+Suppr)</td><td>Insérer / supprimer une surface</td></tr><tr><td>Clic droit (éditeur)</td><td>Menu de la surface (supprimer, insérer, verre…)</td></tr>
<tr><td>Entrée, Tab, ↑ ↓, Échap</td><td>Navigation dans l'éditeur</td></tr><tr><td>Échap</td><td>Fermer une fenêtre, réduire une analyse agrandie</td></tr></table>` },

  { id: 'conventions', t: 'Conventions et unités', h: `
<ul><li>Longueurs en <b>mm</b>, longueurs d'onde en <b>µm</b>, angles en <b>degrés</b>, front d'onde en <b>ondes</b> (λ de l'analyse).</li>
<li>Axe optique z, lumière vers +z au départ. R &gt; 0 : centre de courbure à droite du sommet.</li>
<li>Après un miroir, épaisseurs négatives ; un second miroir les rend de nouveau positives.</li>
<li>Champ positif en Y : rayons montants (image en −Y pour un objectif convergent).</li>
<li>Pupille normalisée (Px, Py) dans [−1, 1], obstruction exclue.</li>
<li>OPD = chemin du rayon − chemin du rayon principal, sur la sphère de référence.</li></ul>` },

  { id: 'limites', t: 'Limites connues', h: `
<ul><li>Tracé séquentiel uniquement (pas de lumière parasite ni de chemins multiples).</li>
<li>Calcul paraxial sans décentrements, formes libres ni réseaux.</li>
<li>Pas de traitements multicouches (Fresnel non traité ou antireflet parfait).</li>
<li>Variables d'optimisation limitées aux courbures, épaisseurs et coniques.</li>
<li>Simulation d'image : PSF interpolée sur une grille 5×5, éclairement relatif simplifié ; pixels carrés.</li>
<li>Source étendue : PSF supposée constante sur l'étendue de la source (source petite devant le champ).</li></ul>` },
];
