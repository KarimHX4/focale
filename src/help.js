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
<li><b>Barre du haut</b> : fichiers, exemples, annuler/rétablir, <b>Système</b> (Données système façon CODE V, Ctrl+Maj+D), optimisation, tolérancement, <b>+ Fenêtre</b> (analyse supplémentaire flottante), nombre de fenêtres d'analyse de la grille (1, 2, 4, 6), thème clair/sombre (sombre au premier lancement, puis le dernier choix est retenu), aide.</li>
<li><b>Panneau de gauche</b> : bouton <b>⚙ Données système…</b>, propriétés de la <b>surface sélectionnée</b> (type d'élément, forme, décentrements), puis ouverture, champs, longueurs d'onde et données paraxiales.</li>
<li><b>Éditeur de lentilles</b> (centre, en haut) : une ligne par surface.</li>
<li><b>Layout</b> (centre, en bas) : coupe 2D ou vue 3D. <b>Rayons</b> : nombre de rayons tracés par champ — choix rapide dans la liste (3, 5, 7, 11, 15, 21) ou n'importe quel entier de 3 à 100 tapé au clavier (Entrée), flèches ou molette ; mémorisé. Molette = zoom, glisser = déplacer (3D : rotation ; Maj+glisser = déplacer), clic = sélectionner une surface, double-clic = ajuster.</li>
<li><b>Analyses</b> (droite) : chaque fenêtre a son propre choix d'analyse et ses réglages ; ⤓ enregistre l'image PNG, ⤢ agrandit.</li>
<li><b>Barre d'état</b> : focale, F/#, longueur, nombre de variables, avertissements et temps de calcul.</li>
</ul>
<p>Les séparateurs entre zones se déplacent à la souris. Le système et la disposition sont mémorisés automatiquement dans le navigateur.</p>
<p><b>Zones détachables</b> : le bouton <b>⧉</b> présent sur le panneau de gauche, l'éditeur de lentilles, le layout et chaque fenêtre d'analyse les détache dans une <b>fenêtre flottante</b> que l'on déplace par sa barre de titre et redimensionne par la poignée en bas à droite (– ou double-clic sur la barre : réduire). <b>⇲</b> la ré-ancre à sa place ; la grille d'analyses se réorganise avec les fenêtres restantes. <b>+ Fenêtre</b> (barre du haut) ouvre autant d'analyses supplémentaires que voulu, chacune flottante (✕ pour la fermer). Positions, tailles et fenêtres détachées sont mémorisées d'une session à l'autre.</p>
<p><b>Fenêtres</b> (verres, données système, optimisation, tolérancement, rapport, aide…) : elles flottent au-dessus de l'interface sans la bloquer — on peut continuer à travailler dans l'éditeur pendant qu'elles sont ouvertes. Glisser la <b>barre de titre</b> pour déplacer ; <b>–</b> (ou double-clic sur le titre) pour réduire à la barre de titre ; <b>□</b> pour agrandir en plein écran ; la <b>poignée en bas à droite</b> pour changer la taille ; ✕ ou Échap pour fermer. Position et taille sont retenues pour chaque fenêtre pendant la session.</p>` },

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
<tr><td>A4…A20</td><td>Coefficients d'asphérique pair z = … + A4 r⁴ + A6 r⁶ + … + A20 r²⁰ (case « Asphères » ; la case « A12–A20 » affiche les ordres élevés, montrés d'office dès qu'une surface les utilise).</td></tr></table>
<p><b>Boutons</b> : <b>V</b> = variable d'optimisation (rayon, épaisseur, verre — verre modèle nd/νd puis substitution —, conique et, avec « Asphères », A4…A20) ; <b>M</b> = solve de mise au point (épaisseur telle que le rayon marginal paraxial coupe l'axe à la surface suivante) ; 🔒 = demi-diamètre fixe.</p>
<p><b>Clavier</b> : Entrée valide et descend, Tab passe à la colonne suivante, flèches haut/bas, Échap annule, Inser insère une surface après la sélection, Suppr (hors d'un champ de saisie) ou Ctrl+Suppr supprime la surface sélectionnée.</p>
<p><b>Clic droit</b> sur une ligne : menu contextuel — insérer avant/après, ajouter une lentille, quick focus, choisir le verre, verre variable, diaphragme, miroir, retourner, <b>supprimer la surface</b> ou <b>supprimer l'élément</b> (les deux surfaces d'une lentille). Toute suppression s'annule avec Ctrl+Z.</p>
<p>Le bouton <b>⧉</b> de la barre de l'éditeur le détache dans une fenêtre flottante redimensionnable (⇲ pour le ré-ancrer).</p>
<p><b>Outils</b> : + Avant / + Après / + Lentille (deux surfaces N-BK7), Supprimer, Diaphragme, Miroir, Retourner (inverse un élément), Verres… (catalogue), <b>⌖ Quick focus</b> (meilleur foyer, options ▾ : critère et longueur d'onde — voir <i>Optimisation</i>).</p>` },

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
<p>Ces réglages sont aussi regroupés, avec le vignetage, l'environnement et les matériaux, dans la fenêtre <b>Données système</b> (voir cette rubrique).</p>
<h4>Ouverture</h4><ul><li><b>Diamètre de la pupille d'entrée</b> (EPD), <b>F/# image</b>, <b>ouverture numérique objet</b> (objet à distance finie seulement), <b>ouverture numérique image</b> (CODE V NA) ou <b>demi-diamètre du diaphragme</b> (l'ouverture est fixée par le diaphragme, Zemax « Float by stop size »). Le F/# image suit la convention Zemax « Image Space F/# » : EPD = EFL / F#, y compris en conjugué fini (le F/# de travail réel est affiché dans les données paraxiales).</li>
<li><b>Obstruction centrale</b> : fraction du rayon de pupille masquée (télescopes à miroir secondaire).</li>
<li><b>Visée des rayons</b> : <i>pupille paraxiale</i> (rayons visés sur la pupille d'entrée paraxiale) ; <i>rayon principal au diaphragme</i> (le rayon principal de chaque champ est itéré pour passer au centre du diaphragme et la pupille paraxiale est translatée d'autant : comportement par défaut de CODE V, activé à l'import d'un .seq) ; <i>réelle</i> (chaque rayon est itéré pour remplir exactement le diaphragme : grands champs, pupilles très aberrantes).</li></ul>
<h4>Champs</h4><p>Quatre <b>types de champ</b>, comme dans CODE V : <b>angle objet</b> (YAN, en °, direction ∝ (tan X, tan Y, 1) ; en conjugué fini l'angle est mesuré depuis la pupille d'entrée), <b>hauteur objet</b> (YOB, mm, objet à distance finie), <b>hauteur image paraxiale</b> (YIM, mm) et <b>hauteur image réelle</b> (YRI, mm : le point de champ est ajusté pour que le rayon principal réel arrive à cette hauteur — idéal pour couvrir exactement un capteur malgré la distorsion). Changer le type dans la liste <b>convertit</b> les valeurs pour garder les mêmes points de champ. Sans type choisi : angles pour un objet à l'infini, hauteurs objet sinon. Le poids sert à l'optimisation et au tolérancement. Le bouton <b>Vignetage…</b> ouvre l'onglet Champs des Données système (facteurs VUY, VLY, VUX, VLX, génération de champs). Le <b>carré de couleur</b> devant chaque champ ouvre un sélecteur : palette, couleur libre (« Autre ») ou code hexadécimal, aperçu avant / après ; la couleur n'est appliquée qu'avec <b>OK</b> (ou Entrée, ou double-clic sur une pastille) ; <b>Annuler</b> (ou Échap, ou clic à côté) l'abandonne, <b>Par défaut</b> revient à la couleur automatique. Elle est utilisée dans le layout, les spots, la FTM, le footprint… et enregistrée avec le système.</p>
<h4>Longueurs d'onde</h4><p>En µm, avec poids et longueur d'onde <b>primaire</b> (pupilles, fronts d'onde par défaut, solves). Préréglages F-d-C, visible, 632,8 nm, NIR. Par défaut chaque λ prend sa couleur spectrale ; cliquez sur son carré de couleur pour en choisir une autre, validée par <b>OK</b> (utile en infrarouge ou pour distinguer des λ proches).</p>
<h4>Données paraxiales</h4><p>Focale effective, tirage, F/#, ouvertures numériques, positions et diamètres des pupilles, grandissement, invariant de Lagrange.</p>` },

  { id: 'donnees', t: 'Données système (CODE V)', h: `
<p>Bouton <b>Système</b> de la barre du haut, <b>⚙ Données système…</b> du panneau de gauche ou <b>Ctrl+Maj+D</b> : une fenêtre organisée comme le « System Data » de CODE V, avec un onglet par catégorie à gauche. Toutes les modifications s'annulent avec Ctrl+Z.</p>
<table class="ht"><tr><th>Onglet</th><th>Contenu</th></tr>
<tr><td>Pupille</td><td>Type et valeur de l'ouverture (EPD, F/#, ON objet, ON image, demi-diamètre du diaphragme), obstruction centrale ; résultats paraxiaux (EPD, F/#, ON, pupilles).</td></tr>
<tr><td>Longueurs d'onde</td><td>λ en nm, poids, longueur d'onde de référence, couleur ; préréglages.</td></tr>
<tr><td>Champs / vignetage</td><td>Type de champ (YAN, YOB, YIM, YRI) avec case « convertir les valeurs » (CODE V « Convert Fields »), table X, Y, poids, couleur et <b>facteurs de vignetage</b> VUY, VLY, VUX, VLX ; colonnes calculées : angle ou hauteur objet équivalente, hauteur image paraxiale et réelle. <b>Générer</b> : n champs de 0 au maximum, répartition linéaire ou à aires égales (√). <b>Calculer le vignetage (SET VIG)</b> : pour chaque champ, les rayons limites ±Y et ±X qui passent juste toutes les ouvertures fixées 🔒. <b>Effacer le vignetage</b>.</td></tr>
<tr><td>Température et pression</td><td>Température du système (°C), pression (atm), température de la prescription, dilatation on/off, matériau du barillet (aluminium, inox, titane, invar, plastiques… ou CTE saisi), CTE de chaque entretoise ; effet sur la focale et la mise au point ; bouton « Analyse thermique dans un panneau ».</td></tr>
<tr><td>Matériaux (dn/dT, CTE)</td><td>Pour chaque verre du système : coefficients de Schott D0, D1, D2, E0, E1, λTK, température T0, CTE et dn/dT absolu calculé. Cases vides = catalogue ; une valeur saisie remplace celle du catalogue (↺ pour revenir).</td></tr>
<tr><td>Avancé</td><td>Visée des rayons (pupille paraxiale, rayon principal au diaphragme comme CODE V, ou réelle), apodisation gaussienne de la pupille (intensité relative au bord, CODE V PUI).</td></tr></table>
<h4>Vignetage (convention CODE V)</h4><p>VUY et VLY sont les fractions du rayon de pupille coupées côtés +Y et −Y, VUX et VLX côtés +X et −X : la pupille utile va de −1 + VLY à 1 − VUY. Les coordonnées pupillaires relatives (spots, ray fans, OPD fans, optimisation) et les demi-diamètres automatiques suivent ce faisceau vignetté (le rayon principal passe au centre de l'ellipse) ; front d'onde, PSF, FTM et énergie encerclée découpent la pupille réelle par cette ellipse. Valeurs négatives : pupille agrandie. Import/export : VUY…VLX en CODE V, VDX/VDY/VCX/VCY en Zemax (VCY = (VUY + VLY)/2, VDY = (VLY − VUY)/2).</p>
<h4>Température, pression, dn/dT et dilatation</h4>
<ul><li><b>Indices</b> : les catalogues donnent l'indice relatif à l'air à 20 °C et 1 atm. Focale calcule l'indice absolu, lui ajoute Δn_abs par la formule de Schott Δn = (n² − 1)/(2n) · [D0 ΔT + D1 ΔT² + D2 ΔT³ + (E0 ΔT + E1 ΔT²)/(λ² − λTK²)] (ΔT = T − T0), puis le ramène à l'air du système à T et P (indice de l'air d'Edlén) ; la longueur d'onde est ramenée à l'air du catalogue. Coefficients fournis pour ~970 verres Schott, Ohara, CDGM et Hoya (refractiveindex.info), lus dans les fichiers AGF importés (lignes TD et ED), valeurs approchées pour la silice et le CaF₂. Vérification : N-BK7 à 546 nm donne dn/dT absolu 1,65·10⁻⁶/K et relatif 2,97·10⁻⁶/K (catalogue Schott : 1,6 et 3,0).</li>
<li><b>Vide</b> (P = 0) : l'indice relatif de chaque verre augmente d'environ n·2,7·10⁻⁴ — d'où la défocalisation des optiques spatiales réglées à l'air.</li>
<li><b>Dilatation</b> de Tref à T : rayons, asphériques (A₂ₖ ∝ (1 + αΔT)^−(2k−1)), demi-diamètres fixés et épaisseurs des lentilles suivent le CTE de leur verre ; les espaces d'air suivent le CTE de leur entretoise (ou du barillet). Distance objet inchangée.</li>
<li>Les rayons et épaisseurs de l'éditeur restent ceux de la prescription (Tref) ; toutes les analyses, l'optimisation et le tolérancement se font à la température et à la pression choisies. La barre d'état affiche 🌡 T · P dès que l'environnement n'est pas nominal.</li>
<li>Un <b>solve de mise au point (M)</b> refocalise à chaque température : retirez-le pour étudier la défocalisation au plan image fixe.</li>
<li>Verres sans données (verres modèles nd/νd) : dn/dT et CTE pris égaux à 0 (avertissement) ; saisissez-les dans l'onglet Matériaux.</li></ul>
<h4>Analyse thermique</h4><p>Type d'analyse « Analyse thermique » : défocalisation (foyer paraxial − plan image), variation de focale, WFE RMS et spot RMS au plan image fixe pour un champ, de T1 à T2 (9 températures).</p>` },

  { id: 'verres', t: 'Verres et catalogues', h: `
<p>Plus de 1000 verres <b>Schott, Ohara, CDGM et Hoya</b> (base refractiveindex.info, domaine public), plus silice fondue et CaF₂. Bouton <b>Verres…</b> (ou clic droit sur une surface › Choisir le verre) : recherche et filtre par fabricant. Un clic <b>surligne</b> le verre choisi et affiche en bas de la fenêtre la demande de confirmation (verre, nd, νd, surface visée et verre actuel) : <b>Valider</b> l'affecte, <b>Annuler</b> abandonne (Entrée dans la recherche valide aussi). Le verre actuel de la surface est repéré par « · actuel ». La fenêtre reste ouverte : sélectionnez une autre surface dans l'éditeur pour continuer.</p>
<ul>
<li>Saisie libre avec auto-complétion ; tirets et casse ignorés (<code>nbk7</code> = N-BK7).</li>
<li>Homonymes : suffixe fabricant, ex. <code>F2_CDGM</code>. Les noms CODE V (<code>NBK7_SCHOTT</code>) sont reconnus.</li>
<li>Verre fictif : <code>nd/νd</code> ou <code>nd/νd/ΔPgF</code> — dispersion n = A + B/λ² + C/λ⁴ ajustée sur nd, νd et la dispersion partielle Pg,F de la « ligne normale » (0,6438 − 0,001682 νd, + ΔPgF), comme le verre modèle d'OpticStudio : le bleu et le violet (g, 430 nm…) suivent les verres réels. Ou indice fixe. Un verre peut être rendu <b>variable</b> (bouton V de la colonne Verre) puis remplacé par le meilleur verre réel : voir <i>Optimisation</i>.</li>
<li><b>Import AGF</b> (catalogue Zemax, formules 1 à 13) : glisser-déposer le fichier ou bouton « Importer un AGF… ». Les verres importés sont gardés dans le navigateur et embarqués dans les fichiers .json qui les utilisent.</li>
<li>Un avertissement s'affiche si une longueur d'onde sort du domaine de validité d'un verre.</li>
<li><b>Données thermiques</b> (dn/dT de Schott et CTE) : incluses pour la plupart des verres des catalogues et lues dans les AGF importés ; modifiables par verre dans Données système → Matériaux.</li>
</ul>` },

  { id: 'analyses', t: 'Analyses', h: `
<table class="ht"><tr><th>Analyse</th><th>Description</th></tr>
<tr><td>Diagramme de spot</td><td>Impacts des rayons dans le plan image (grille de pupille), par champ, couleur = longueur d'onde. RMS et GEO par rapport au barycentre (ou au rayon principal), cercle d'Airy 1,22·λ·F/#.</td></tr>
<tr><td>Ray fan</td><td>Aberration transverse εy(Py) (tangentiel) et εx(Px) (sagittal) par rapport au rayon principal.</td></tr>
<tr><td>OPD fan</td><td>Écart de chemin optique (en ondes) le long des deux coupes de pupille.</td></tr>
<tr><td>Carte WFE</td><td>Front d'onde dans la pupille de sortie : OPD par rapport à une sphère de référence centrée sur l'image du rayon principal. RMS, PV, et Strehl approché par Maréchal quand RMS ≤ 0,15 λ (au-delà, voir la PSF). Option : retrait du tilt.</td></tr>
<tr><td>Zernike</td><td>Décomposition du front d'onde sur 16 polynômes Fringe (moindres carrés).</td></tr>
<tr><td>PSF</td><td>Réponse impulsionnelle par FFT de la pupille complexe (64×64 dans 256×256, 512×512 au-delà du zoom ×2,2), échelle linéaire ou log, rapport de Strehl. <b>2D</b> : carte de couleurs avec cercle d'Airy. <b>3D</b> : surface d'intensité en % du pic (comme la « Diffraction Intensity Spread Function » de CODE V), couleurs par hauteur avec éclairage du relief, parois graduées ; <b>glisser</b> pour la faire tourner. En 3D la PSF est calculée directement aux 201 × 201 nœuds du maillage (transformée de Fourier matricielle d'un front d'onde 128 × 128), nœuds resserrés au centre pour détailler le pic ; maillage allégé pendant une rotation ou un zoom, puis pleine résolution au relâchement. <b>Zoom continu</b> de ×0,5 à ×5 par le curseur de l'en-tête ou la <b>molette</b> sur la PSF ; <b>Ajuster</b> (ou double-clic sur la PSF) remet le zoom à ×1 et, en 3D, l'orientation par défaut.</td></tr>
<tr><td>FTM / MTF</td><td>Deux méthodes au choix dans l'en-tête :
<b>Diffraction</b> (par défaut) : autocorrélation directe de la pupille complexe (méthode de Hopkins, comme CODE V), calculée exactement à chaque fréquence (décalage fractionnaire de la pupille, donc pas d'interpolation de la courbe) ; échantillonnage du front d'onde 32 à 256 (64 suffit en général : écart < 0,01 avec 256). Fréquences mesurées sur la surface image avec l'ouverture <b>réelle</b> de chaque champ : fc = ΔM/λ (tangentiel) et ΔL/λ (sagittal), ΔM et ΔL étant les écarts de cosinus directeurs des rayons de bord de pupille — l'équivalent des « X and Y F-numbers » de CODE V, affichés en haut du graphe (F/# réels T/S). Polychromatique : somme pondérée des OTF <b>complexes</b>, chacune déphasée de la position de son rayon principal, puis module — le chromatisme latéral réduit donc la FTM (même définition que CODE V et OpticStudio). Limite de diffraction sur la même pupille (obstruction, vignetage, apodisation).
<b>Géométrique</b> : transformée de Fourier des impacts de rayons (|Σ e^{−2πi f y}| / N en tangentiel, en x en sagittal), toutes λ pondérées autour du rayon principal de référence, multipliée par défaut par la FTM d'une pupille parfaite (case « × diffraction »). Rapide et adaptée aux systèmes très aberrants (front d'onde ≫ λ), optimiste sinon.
Écarts résiduels possibles avec CODE V : CODE V intègre en coordonnées pupillaires canoniques de Hopkins (ici : grille régulière dans la pupille d'entrée, identique à faible ouverture et petit champ), et la FTM dépend de la mise au point et du vignetage (VUY…VLX) exactement comme dans CODE V.</td></tr>
<tr><td>Énergie encerclée</td><td>Fraction d'énergie dans un cercle : diffraction (λ primaire) et géométrique (polychromatique), rayon à 80 %.</td></tr>
<tr><td>Footprint</td><td>Empreinte des faisceaux de chaque champ sur une surface, comparée au demi-diamètre (dimensionnement des optiques et montures).</td></tr>
<tr><td>Courbure de champ &amp; distorsion</td><td>Foyers tangentiel et sagittal en fonction du champ, distorsion en %.</td></tr>
<tr><td>Seidel</td><td>Coefficients du 3ᵉ ordre par surface (sphérique, coma, astigmatisme, Petzval, distorsion, chromatismes axial et latéral) et équivalents W040, W131…</td></tr>
<tr><td>Décalage focal chromatique</td><td>Position du foyer paraxial en fonction de λ.</td></tr>
<tr><td>Carte des verres</td><td>Diagramme nd / νd des catalogues, verres utilisés en orange.</td></tr>
<tr><td>Polarisation</td><td>Voir la rubrique dédiée.</td></tr>
<tr><td>Simulation d'image</td><td>Voir la rubrique dédiée.</td></tr>
<tr><td>Prescription</td><td>Tableau des surfaces, performances par champ, données paraxiales.</td></tr>
<tr><td>Analyse thermique</td><td>Défocalisation, Δ focale, WFE et spot RMS en fonction de la température (bornes réglables dans l'en-tête). Voir <i>Données système</i>.</td></tr></table>
<p>Chaque fenêtre d'analyse se détache avec <b>⧉</b> (fenêtre flottante redimensionnable) ; <b>+ Fenêtre</b> en ajoute d'autres.</p>` },

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
<p>Méthode des <b>moindres carrés amortis</b> (Levenberg-Marquardt) avec Jacobien numérique, comme l'optimisation locale de Zemax ou CODE V. Bouton <b>Optimiser</b> (Ctrl+Maj+O) ; la fenêtre se déplace et se redimensionne, et l'on peut continuer à travailler dans l'éditeur.</p>
<h4>Variables</h4>
<ul><li>Bouton <b>V</b> dans l'éditeur : rayon (la variable est la courbure), épaisseur, conique, <b>verre</b> (voir ci-dessous) et, avec la case « Asphères », les coefficients <b>A4, A6, A8, A10</b>.</li>
<li>La fenêtre liste les variables avec leur valeur et leur <b>écart</b> depuis le début de l'optimisation ; « Tout libérer » retire tous les V.</li>
<li>Une épaisseur pilotée par le solve M ne peut pas être variable.</li></ul>
<h4>Fonction de mérite</h4>
<ul><li><b>Critère de qualité image</b> : spot RMS (par rapport au barycentre), front d'onde RMS ou aucun ; quadrature de Gauss 3 anneaux × 8 bras sur tous les champs pondérés.</li>
<li><b>Longueurs d'onde du critère</b> : toutes (pondérées), la <b>λ centrale</b> (la plus proche du milieu de la bande), la λ primaire ou une λ donnée. Exemple : variable sur la dernière épaisseur + critère sur la λ centrale = mise au point à cette longueur d'onde. Les opérandes de chromatisme utilisent toujours toutes les λ.</li>
<li><b>Opérandes</b>, chacun avec une contrainte <b>=</b>, <b>≥</b> ou <b>≤</b> (une contrainte d'inégalité ne pèse que si elle est violée) :
<table class="ht"><tr><th>Code</th><th>Grandeur</th></tr>
<tr><td>EFL · WFNO · TTL · BFL</td><td>Focale, F/# de travail paraxial, longueur totale (1ʳᵉ surface → image), distance image paraxiale.</td></tr>
<tr><td>PMAG · IMGH · RIMH</td><td>Grandissement paraxial, hauteur image paraxiale et réelle (rayon principal) au champ maximal.</td></tr>
<tr><td>DIST</td><td>Distorsion réelle au champ maximal (%).</td></tr>
<tr><td>AXCL · LACL</td><td>Chromatisme axial (foyer paraxial λmax − λmin) et latéral (hauteur du rayon principal λmax − λmin au champ max), en mm.</td></tr>
<tr><td>SPHA · COMA · ASTI · FCUR</td><td>Sommes de Seidel en ondes : W040, W131, W222, W220 (Petzval).</td></tr>
<tr><td>MTFA</td><td>FTM moyenne T/S à une fréquence (paramètre, cycles/mm), moyenne pondérée sur les champs ; par défaut « ≥ cible ».</td></tr>
<tr><td>MNCT · MXCT · MNET · MXET</td><td>Épaisseurs de verre au centre et au bord, min et max (toutes les lentilles).</td></tr>
<tr><td>MNCA · MXCA · MNEA</td><td>Espaces d'air au centre (min, max) et au bord (min).</td></tr>
<tr><td>RGLA</td><td>Verre modèle « réaliste » : écart normalisé entre chaque verre modèle variable et le verre réel le plus proche (catalogues choisis) ; « ≤ 0 » avec un petit poids les garde près des verres existants.</td></tr></table></li>
<li>Le tableau affiche en direct la <b>valeur</b> de chaque opérande (en orange si une contrainte ≥/≤ n'est pas respectée) et sa <b>part</b> de la fonction de mérite ; la dernière ligne donne celle du critère image.</li></ul>
<h4>Verres variables et substitution</h4>
<ul><li>Bouton <b>V</b> de la colonne <b>Verre</b> (ou clic droit › Verre variable) : le verre devient un <b>verre modèle</b> « nd/νd » (affiché en italique) dont l'indice nd et la constringence νd sont deux variables continues (bornes 1,35–2,2 et 15–100). La dispersion du modèle suit une loi de Cauchy ajustée sur F, d, C.</li>
<li>Optimisez normalement, typiquement avec l'opérande <b>AXCL</b> (chromatisme axial) ; ajoutez <b>RGLA</b> (bouton « + Opérande RGLA ») pour éviter que les verres modèles partent dans une zone du diagramme nd/νd où aucun verre n'existe.</li>
<li><b>Substituer par des verres réels</b> : pour chaque verre variable, Focale essaie les verres réels les plus proches dans le diagramme nd/νd (nombre de candidats réglable, catalogues cochés, préférentiels seulement en option, obsolètes exclus) ; à chaque essai les autres variables sont réoptimisées, et le verre qui donne la meilleure fonction de mérite est retenu. Plusieurs <b>passes</b> permettent de revoir les choix une fois les autres verres fixés. Le message liste les remplacements ; « Restaurer l'état initial » ou Ctrl+Z annulent.</li>
<li>Après substitution, le verre reste marqué V (« réel, substituable ») : une nouvelle substitution peut encore le changer. Pour repartir d'un verre modèle continu, retirez puis remettez le V.</li>
<li>La recherche globale perturbe aussi les verres modèles.</li></ul>
<h4>Lancer</h4>
<ul><li><b>Optimiser</b> : optimisation locale jusqu'à convergence ou au nombre d'itérations max.</li>
<li><b>Recherche globale</b> : à partir du meilleur système, les variables sont perturbées au hasard (amplitude relative réglable), puis optimisées ; on garde le meilleur résultat sur le nombre de cycles demandé (méthode de type « Hammer »). Utile pour sortir d'un minimum local.</li>
<li><b>Restaurer l'état initial</b> revient au système d'avant la dernière optimisation ; Ctrl+Z fonctionne aussi.</li></ul>
<h4>Quick focus</h4>
<p>Bouton <b>⌖ Quick focus</b> de l'éditeur (ou Ctrl+Maj+F, ou clic droit) : déplace le plan image au <b>meilleur foyer</b> en ajustant l'épaisseur avant l'image. Le menu <b>▾</b> choisit le critère (spot RMS ou front d'onde RMS) et la longueur d'onde : <b>centrale</b> par défaut (utile en polychromatique), primaire, toutes pondérées ou une λ précise. Un solve M sur cette épaisseur est retiré. Le message indique le déplacement et le critère avant/après. Le bouton est aussi dans la fenêtre d'optimisation.</p>` },

  { id: 'tolerancement', t: 'Tolérancement', h: `
<p>Estime la dégradation due aux défauts de fabrication et d'alignement, à la manière du tolérancement de Zemax ou du module TOR de CODE V. Bouton <b>Tolérancer</b> ; la fenêtre a trois onglets de réglages à gauche et trois onglets de résultats à droite. La configuration est enregistrée avec le système.</p>
<h4>Tolérances disponibles</h4>
<table class="ht"><tr><th>Code</th><th>Tolérance</th><th>Unité</th></tr>
<tr><td>TFRN</td><td><b>Puissance</b> : écart de rayon exprimé en franges de Newton (λ = 632,8 nm) sur l'ouverture utile ; la conversion est exacte (écart de flèche F·λ/2 au bord, conique comprise). S'applique aussi aux faces planes.</td><td>franges</td></tr>
<tr><td>TRAD</td><td>Rayon en pourcentage (désactivé par défaut, la puissance en franges étant la spécification usuelle).</td><td>%</td></tr>
<tr><td>TIRR</td><td><b>Irrégularité</b> : défaut de forme de PV F·λ/2, moitié sphérique (ρ⁴) et moitié astigmatisme (ρ²cos²θ). La surface devient un polynôme XY (ou ses termes de Zernike sont modifiés).</td><td>franges</td></tr>
<tr><td>TCON</td><td>Constante de conicité (surfaces coniques ou asphériques).</td><td>Δk</td></tr>
<tr><td>TTHI</td><td>Épaisseur ou espace d'air (la dernière épaisseur est exclue si elle sert de compensateur).</td><td>mm</td></tr>
<tr><td>TIND · TABB</td><td>Indice (décalage à toutes les λ) et <b>constringence</b> νd (dispersion autour de nd mise à l'échelle).</td><td>Δn · %</td></tr>
<tr><td>TSDX/Y · TSTX/Y</td><td>Décentrement et bascule d'une surface.</td><td>mm · °</td></tr>
<tr><td>TEDX/Y · TETX/Y</td><td>Décentrement et bascule d'un élément (lentille), pivot au sommet de sa première surface.</td><td>mm · °</td></tr></table>
<h4>Réglages</h4>
<ul><li><b>Critère</b> : front d'onde RMS (λ, piston et tilt retirés), spot RMS (µm) ou <b>FTM</b> moyenne T/S à une fréquence donnée (plus grand = meilleur). Moyenne pondérée sur les champs et les longueurs d'onde.</li>
<li><b>Compensateurs</b> : mise au point (épaisseur avant l'image) et, au choix, les <b>variables de l'optimiseur</b> (paramètres marqués V), réajustées par quelques itérations de moindres carrés pour chaque système. Le nominal passe par la même compensation. Avec le critère FTM, les compensateurs minimisent le front d'onde (plus robuste) : un système dont le nominal n'est pas optimisé pour la FTM peut donc ponctuellement s'améliorer.</li>
<li><b>Valeurs par défaut</b> par type ; la <b>liste détaillée</b> en découle automatiquement. Dès qu'on la modifie (bornes <b>min/max asymétriques</b> possibles, ajout ou suppression d'une tolérance sur une surface précise), elle devient personnalisée ; « Régénérer » la recrée depuis les valeurs par défaut.</li></ul>
<h4>Analyses</h4>
<ul><li><b>Sensibilité</b> : chaque tolérance seule, à sa borne min puis max ; dégradation (Δ &gt; 0 = pire), part cumulée de la dégradation RSS, dérive de visée (déplacement du rayon principal du 1ᵉʳ champ) et mouvement du compensateur. Estimation RSS de la performance : nominal ± √ΣΔ².</li>
<li><b>Tolérances inverses</b> (Zemax « Inverse Limit ») : pour chaque tolérance, la valeur ± qui produit une dégradation donnée. Soit une Δ max par tolérance, soit un <b>budget</b> : critère visé après fabrication, la marge étant répartie en RSS (Δ = |cible − nominal|/√n). Valeurs arrondies vers le bas (1 · 1,5 · 2 · 2,5 · 3 · 4 · 5 · 6 · 8 × 10ⁿ), signalées « à resserrer » ou « peut être élargie », et applicables d'un clic à la liste détaillée.</li>
<li><b>Monte-Carlo</b> : toutes les tolérances tirées simultanément entre leurs bornes (gaussienne tronquée, uniforme, parabolique — extrêmes favorisés — ou extrêmes seulement), avec une <b>graine</b> pour des tirages reproductibles. Résultats : moyenne, écart-type, centiles (50 à 98 %), meilleur et pire, <b>rendement</b> par rapport à une spécification, course du compensateur, dérive de visée, histogramme et fonction de répartition, principaux contributeurs (corrélation). Les tirages pire, médian et meilleur se <b>chargent dans l'éditeur</b> pour être analysés (Ctrl+Z pour revenir).</li></ul>
<p>« Exporter CSV » copie tous les résultats (y compris chaque tirage Monte-Carlo et ses valeurs) ; le rapport PDF reprend les trois analyses.</p>` },

  { id: 'assistant', t: 'Assistant (langage naturel)', h: `
<p>Bouton <b>Assistant</b> de l'en-tête (Ctrl+Maj+A) ; la fenêtre s'ouvre <b>ancrée à droite</b> (largeur réglable en glissant son bord gauche). Glisser sa barre de titre la <b>détache</b> : elle devient flottante, se déplace librement et se redimensionne par la poignée en bas à droite ; le bouton ⇥ (ou un double-clic sur la barre de titre) la ré-ancre, ⧉ la détache. Position et taille sont mémorisées. On y décrit en français ce que l'on veut faire, l'assistant le traduit en actions de Focale. Exemples : « fais-moi un doublet achromatique de 150 mm à F/4 avec 3° de champ », « mets le verre de la deuxième lentille en N-SF11 », « optimise le front d'onde à la longueur d'onde centrale », « garde une focale de 100 mm et une longueur totale inférieure à 120 mm puis optimise », « quick focus », « affiche la FTM ».</p>
<h4>Fonctionnement</h4>
<ul><li>Le modèle de langage <b>ne calcule rien</b> : il choisit des actions (modifier une surface, changer le verre d'une lentille, ouverture, champs, longueurs d'onde, variables, fonction de mérite, optimisation, substitution des verres, quick focus, conception d'une lentille simple ou d'un doublet achromatique, recherche de verres, affichage d'une analyse…). Les calculs restent ceux du moteur de Focale.</li>
<li>Il reçoit à chaque demande une description du système : surfaces S0…Sn, <b>lentilles numérotées L1, L2…</b> de l'objet vers l'image (un doublet collé compte pour deux lentilles), ouverture, champs, longueurs d'onde, performances.</li>
<li>Si la demande est ambiguë (« change le verre » avec plusieurs lentilles), il <b>pose une question</b> au lieu d'agir ; il signale aussi une demande irréaliste dans son message.</li>
<li>Les actions sont <b>affichées avant d'être appliquées</b> (boutons Appliquer / Ignorer ; réglable dans ⚙). Toute la demande forme <b>une seule étape d'annulation</b> : Ctrl+Z revient à l'état d'avant. Si une action échoue, le système est remis dans son état précédent.</li></ul>
<h4>Moteurs (⚙) — 100 % locaux et gratuits</h4>
<ul><li><b>Ollama</b> (recommandé) : programme gratuit (ollama.com) qui fait tourner le modèle sur le PC. Avec 16 Go de RAM : <code>ollama pull qwen3:4b-instruct</code> (2,5 Go, rapide) ou <code>ollama pull qwen3:8b</code> (5,2 Go, plus fiable, plus lent sans carte graphique). Pour que Focale puisse l'appeler depuis le navigateur, définir la variable d'environnement <code>OLLAMA_ORIGINS=*</code> (Windows : <code>setx OLLAMA_ORIGINS "*"</code> dans un terminal, puis quitter et relancer Ollama). Le bouton « Tester » vérifie la connexion et liste les modèles installés.</li>
<li><b>Dans le navigateur</b> (WebGPU, Chrome ou Edge récents) : aucun programme à installer ; le modèle (2 à 5 Go selon le choix) est téléchargé une seule fois puis gardé en cache, il fonctionne ensuite hors ligne. Nécessite une carte graphique compatible ; les modèles de 3 à 4 milliards de paramètres conviennent à 16 Go de RAM.</li>
<li><b>Sans IA</b> : des règles, <b>tolérantes aux fautes de frappe, lettres oubliées et abréviations</b> (« optimse », « lentile », « ep. min », « foc. », « opti », « qf », « 2nde lent. », « nsf11 » → N-SF11, « bk 7 » → N-BK7…), reconnaissent les demandes simples (verre d'une surface ou d'une lentille, rayon, épaisseur, F/#, EPD, champ, longueurs d'onde, focale, longueur totale, chromatisme, quick focus, optimisation, doublet ou lentille simple, analyses, annuler). Fonctionne hors ligne, instantanément.</li>
<li><b>Automatique</b> (par défaut) : Ollama s'il répond, sinon les règles. Aucun téléchargement n'est lancé sans votre accord. Si le moteur choisi ne répond pas, la demande est traitée par les règles.</li></ul>
<h4>Réglages de compréhension (⚙)</h4>
<p>Le panneau ⚙ est compact (moteur, modèle Ollama avec « Tester », modèle du navigateur avec « Charger ») ; les options et l'aide à l'installation sont repliées sous « Options et installation ». Il se referme à l'envoi d'un message.</p>
<ul><li><b>Demandes simples traitées par les règles</b> (activé par défaut) : une demande courte reconnue sans ambiguïté (« verre de la 2e lentille en N-SF11 », « f/4 », « quick focus »…) est exécutée immédiatement, sans attendre le modèle ; la ligne grise indique alors « règles (instantané) ». Les phrases plus libres ou composées (« puis », « pour que »…) vont au modèle.</li>
<li><b>Appel d'outils natif</b> (Ollama, activé par défaut) : chaque action est décrite au modèle comme une fonction avec ses paramètres typés, format pour lequel Qwen3 est entraîné — plus fiable qu'un JSON libre pour un petit modèle. Les nombres renvoyés en texte (« 120 », « f/4 ») sont corrigés automatiquement. Décocher pour revenir au mode JSON contraint (utile avec un modèle qui ne gère pas les outils ; bascule automatique dans ce cas). Si le modèle répond seulement par du texte (« Compris : … ») sans appeler d'outil, Focale le <b>relance une fois</b> en lui demandant d'exécuter les actions ; une réponse terminée par « ? » est traitée comme une question.</li>
<li>Les contraintes s'expriment simplement : « épaisseur minimale des verres 5 mm » (MNCT ≥ 5), « épaisseur maximale… » (MXCT), « espace d'air minimum 0,5 mm » (MNCA), « … au bord » (MNET, MNEA), « longueur totale inférieure à 120 mm » (TTL ≤ 120). Elles s'appliquent à toutes les lentilles ; pour fixer l'épaisseur d'une lentille précise, demandez-la directement (« épaisseur S1 = 5 »).</li>
<li>Pour une meilleure compréhension, <code>qwen3:8b</code> est nettement plus capable que <code>qwen3:4b-instruct</code>, au prix d'une réponse plus lente sans carte graphique.</li></ul>
<p>Rien n'est envoyé sur Internet. Sur un PC sans carte graphique, une réponse d'Ollama prend de quelques secondes à une minute selon le modèle.</p>
<h4>Module facultatif</h4>
<p>L'assistant est un fichier séparé, <code>assistant.js</code>, chargé seulement quand on clique sur le bouton : <code>index.html</code> seul est un Focale complet. Pour une installation sans assistant, il suffit de ne pas copier <code>assistant.js</code> ; <b>Fichier › Masquer le bouton Assistant</b> retire le bouton de l'en-tête.</p>` },
  { id: 'fichiers', t: 'Fichiers, Zemax et CODE V', h: `
<ul><li><b>Ctrl+O</b> ouvrir, <b>Ctrl+S</b> enregistrer (.json, format natif complet), <i>Enregistrer sous…</i></li>
<li><b>Glisser-déposer</b> d'un fichier <b>.zmx</b>, <b>.seq</b>, .json ou .agf sur la fenêtre, ou <i>Fichier → Coller un système</i> : le format est reconnu automatiquement. Les .zmx enregistrés en UTF-16 (cas courant) sont décodés.</li>
<li><i>Fichier → Exporter Zemax (.zmx)</i> et <i>Exporter CODE V (.seq)</i> téléchargent le fichier ; <i>Afficher / copier le texte</i> montre les trois formats.</li>
<li>Après un import ou un export, un <b>rapport</b> liste ce qui a été converti ou ignoré.</li></ul>
<h4>Zemax OpticStudio (.zmx, séquentiel)</h4>
<table class="ht"><tr><th>Élément</th><th>Correspondance</th></tr>
<tr><td>Système</td><td>NAME, UNIT (mm, cm, in, m → mm), ENPD / FNUM / OBNA / FLOA, FTYP (angle, hauteur objet, hauteur image paraxiale ou réelle, type conservé), XFLN/YFLN/FWGN, vignetage VDXN/VDYN/VCXN/VCYN, WAVM ou WAVL/WWGT, PWAV, ENVD (température, pression).</td></tr>
<tr><td>Surfaces</td><td>STANDARD, EVENASPH (PARM 2…8 → A4…A16), TCE (CTE de l'entretoise), COORDBRK (décentrements et bascules), PARAXIAL (lentille idéale), DGRATING (réseau, traits/µm et ordre). CURV, DISZ, CONI, DIAM, CLAP (demi-diamètre fixe), STOP, COMM.</td></tr>
<tr><td>Verres</td><td>Noms de catalogue (Schott, Ohara, CDGM, Hoya, MISC), MIRROR, ___BLANK (modèle nd/νd). Un verre inconnu est remplacé par son modèle nd/νd (signalé).</td></tr>
<tr><td>Export</td><td>Décentrements → paires de COORDBRK (DEC : un CB ; DAR : CB + retour en ordre inverse ; pliage BEN : CB + CB de même bascule). Verres fictifs → ___BLANK. Solves → épaisseurs fixes.</td></tr></table>
<h4>CODE V (.seq)</h4>
<table class="ht"><tr><th>Élément</th><th>Correspondance</th></tr>
<tr><td>Système</td><td>TITLE, DIM / DDM (M, C, I → mm), EPD / FNO / NAO / NA (ON image), WL, REF, WTW, XAN/YAN, XOB/YOB, XIM/YIM, XRI/YRI (type de champ conservé), WTF, <b>VUY / VLY / VUX / VLX</b> (vignetage), <b>TEM / PRE</b> (température °C, pression en mmHg comme CODE V : 760 = 1 atm), PUI (apodisation gaussienne). Les listes acceptent aussi la forme indexée : <code>WTW W2 2</code>, <code>VUY F3 0.2</code>, <code>YAN F2 14</code>.</td></tr>
<tr><td>Surfaces</td><td>SO, S, STO, SI, RDM/RDN, RDY/CUY/THI/GLA/GL1, K, <b>A…J</b> (A4 à A20), CIR (CIR EDG ignoré : bord mécanique), REFL et RMD REFL, PIM, XDE…CDE, DAR, BEN (REV → DAR), GRT/GRO/GRS/GRX/GRY (réseau), <b>SLB</b> (étiquette → commentaire), SPS XYP + SCO (polynôme XY, à vérifier), CCY/THC/KC/AC…DC 0 (variables), GLC 0 (verre fictif variable), TCE.</td></tr>
<tr><td>Qualificatifs</td><td>Les commandes qui désignent une surface explicitement sont appliquées à cette surface : <code>THI S7 4</code>, <code>CIR S2 10</code>, <code>SLB S4 'L2'</code>, <code>STO S3</code>, <code>CCY S1 0</code>…</td></tr>
<tr><td>Ignorées sans remarque</td><td>UID, DER, DOR, GCH, GLB, CAT, INI, GO, CUM, THM, VIE, PLO, WRL, EVA… (identifiants, incréments de dérivée, préférences, affichage : sans effet sur l'optique).</td></tr>
<tr><td>Signalées (non modélisées)</td><td>ZOO (zoom : position 1 importée), PIK (reprises), PUY/PUX/PUC/PCY (solves : valeur courante gardée), CUX/RDX/CYL/XTO/YTO (toriques : profil Y), DIF/HOE/HCO… (surfaces diffractives : phase ignorée), RET, RED, REX/REY (rectangle → cercle circonscrit), ADX/ADY, CIR HOL/OBS, GL2, TEM Sk (température par surface), SPS ODD/ZRN/ZFR/QBF/QCN (base conique seule), mode afocal.</td></tr>
<tr><td>Verres</td><td>NOM_CATALOGUE (NBK7_SCHOTT, SBSL7_OHARA…), codes 6 chiffres, <b>verres fictifs CODE V</b> <code>743972.448504</code> (→ modèle nd/νd 1,743972 / 44,8504), forme <code>1.62:36.4</code>, <b>verres privés PRV</b> (PWL + indices → loi de Cauchy). À l'export, verres modèles → code de verre fictif CODE V, verres importés → verres privés PRV.</td></tr></table>
<p class="hint">Exportés aussi : type de champ, vignetage, température et pression, commentaires (SLB), A12…A20 (E…J ; A18 et A20 non disponibles vers Zemax). Non exportés (signalés) : lentille idéale en CODE V, polariseurs et lames d'onde, surfaces XY et Zernike, obstruction centrale, orientation non nulle des traits d'un réseau vers Zemax. Les conventions de bascule sont supposées identiques (rotations main droite) : vérifiez les systèmes décentrés après conversion.</p>
<p class="hint">Les fichiers <b>.len</b> de CODE V sont binaires (format propriétaire) : dans CODE V, tapez <code>WRL C:\chemin\nom.seq</code> pour écrire la séquence texte, puis importez le .seq.</p>
<h4>Installation</h4><p>Depuis le site GitHub Pages, bouton « Installer » (Chrome, Edge) : l'application fonctionne hors ligne, se met à jour à chaque nouvelle version et peut ouvrir directement les fichiers .zmx, .seq, .json et .agf.</p>` },

  { id: 'raccourcis', t: 'Raccourcis clavier', h: `
<table class="ht"><tr><th>Touches</th><th>Action</th></tr>
<tr><td>F1</td><td>Aide</td></tr><tr><td>Ctrl+Z / Ctrl+Y</td><td>Annuler / rétablir</td></tr>
<tr><td>Ctrl+O / Ctrl+S / Ctrl+Maj+S</td><td>Ouvrir / enregistrer / enregistrer sous</td></tr>
<tr><td>Ctrl+Maj+O</td><td>Optimisation</td></tr><tr><td>Ctrl+Maj+F</td><td>Quick focus (meilleur foyer)</td></tr><tr><td>Ctrl+Maj+A</td><td>Assistant (langage naturel)</td></tr><tr><td>Ctrl+Maj+D</td><td>Données système (CODE V)</td></tr><tr><td>Inser / Suppr (ou Ctrl+Suppr)</td><td>Insérer / supprimer une surface</td></tr><tr><td>Clic droit (éditeur)</td><td>Menu de la surface (supprimer, insérer, verre…)</td></tr>
<tr><td>Entrée, Tab, ↑ ↓, Échap</td><td>Navigation dans l'éditeur</td></tr><tr><td>Échap</td><td>Fermer une fenêtre, réduire une analyse agrandie</td></tr></table>` },

  { id: 'conventions', t: 'Conventions et unités', h: `
<ul><li>Longueurs en <b>mm</b>, longueurs d'onde en <b>µm</b>, angles en <b>degrés</b>, front d'onde en <b>ondes</b> (λ de l'analyse).</li>
<li>Axe optique z, lumière vers +z au départ. R &gt; 0 : centre de courbure à droite du sommet.</li>
<li>Après un miroir, épaisseurs négatives ; un second miroir les rend de nouveau positives.</li>
<li>Champ angulaire positif en Y : rayons montants ; pour un objet à l'infini l'image est en +Y (y ≈ f·tan θ). Hauteur objet positive : image en −Y pour un objectif convergent. Hauteurs image (YIM, YRI) : coordonnée de l'image elle-même.</li>
<li>Température en °C, pression en atmosphères (CODE V PRE en mmHg, converti), CTE en 10⁻⁶/K.</li>
<li>Pupille normalisée (Px, Py) dans [−1, 1], obstruction exclue ; avec des facteurs de vignetage, relative au faisceau vignetté.</li>
<li>OPD (convention CODE V / Zemax) = chemin du rayon principal − chemin du rayon, sur la sphère de référence : <b>OPD &gt; 0 = front d'onde en avance</b>. Une sphérique sous-corrigée (lentille simple) donne W040 &gt; 0, de même signe que la somme de Seidel SI (W040 = SI/8).</li>
<li>Aberrations transverses : ε = SI/(2 n′u′) pour la sphérique (u′ &lt; 0 pour un faisceau convergent) ; mêmes conventions de signe que les coefficients de Seidel de Zemax.</li></ul>` },

  { id: 'limites', t: 'Limites connues', h: `
<ul><li>Tracé séquentiel uniquement (pas de lumière parasite ni de chemins multiples).</li>
<li>Calcul paraxial sans décentrements, formes libres ni réseaux.</li>
<li>Pas de traitements multicouches (Fresnel non traité ou antireflet parfait).</li>
<li>Pas de zoom / multi-configuration, de mode afocal, de surfaces toriques ni diffractives (signalés à l'import CODE V).</li>
<li>Environnement : une seule température pour tout le système (pas de gradients ni de températures par élément).</li>
<li>Simulation d'image : PSF interpolée sur une grille 5×5, éclairement relatif simplifié ; pixels carrés.</li>
<li>Source étendue : PSF supposée constante sur l'étendue de la source (source petite devant le champ).</li></ul>` },
];
