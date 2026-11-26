'use strict';
const SAMPLES = (() => {
  const S = (r, t, glass = '', o = {}) => ({ r, t, glass, sd: 0, sdFixed: false, k: 0, a4: 0, a6: 0, a8: 0, a10: 0,
    stop: false, comment: '', vr: false, vt: false, vk: false, tsolve: '', ...o });
  const FdC = [{ um: 0.4861327, w: 1 }, { um: 0.5875618, w: 1 }, { um: 0.6562725, w: 1 }];
  const base = (o) => ({ title: '', aperture: { type: 'EPD', value: 10, obscuration: 0 }, fieldType: 'angle',
    fields: [{ y: 0, w: 1 }], wavelengths: FdC, primary: 1, rayAiming: false,
    merit: { v: 2, image: 'SPOT', ops: [] }, ...o });
  const He = [{ um: 0.6328, w: 1 }], gFdC = [{ um: 0.4358343, w: 1 }, ...FdC];
  const L = {
    'Lentille plan-convexe f=100': () => base({
      title: 'Lentille plan-convexe N-BK7 f=100 mm', aperture: { type: 'EPD', value: 20, obscuration: 0 },
      fields: [{ y: 0, w: 1 }, { y: 2, w: 1 }, { y: 4, w: 1 }],
      surfaces: [S(Infinity, Infinity, '', { comment: 'Objet' }), S(51.68, 4, 'N-BK7', { stop: true }), S(Infinity, 96, '', { tsolve: 'M' }), S(Infinity, 0, '', { comment: 'Image' })],
    }),
    'Doublet achromatique f=100': () => base({
      title: 'Doublet achromatique N-BK7 / N-SF5 f=100 mm', aperture: { type: 'EPD', value: 20, obscuration: 0 },
      fields: [{ y: 0, w: 1 }, { y: 1.5, w: 1 }, { y: 3, w: 1 }],
      surfaces: [S(Infinity, Infinity, '', { comment: 'Objet' }), S(62.75, 4, 'N-BK7', { stop: true, comment: 'Couronne' }), S(-45.71, 2.5, 'N-SF5', { comment: 'Flint' }),
        S(-128.23, 97, '', { tsolve: 'M' }), S(Infinity, 0, '', { comment: 'Image' })],
      merit: { v: 2, image: 'SPOT', ops: [{ type: 'EFL', target: 100, weight: 1 }] },
    }),
    'Triplet de Cooke f=50 F/5': () => base({
      title: 'Triplet de Cooke 40° — f=50 mm F/5', aperture: { type: 'EPD', value: 10, obscuration: 0 },
      fields: [{ y: 0, w: 1 }, { y: 14, w: 1 }, { y: 20, w: 1 }],
      surfaces: [S(Infinity, Infinity, '', { comment: 'Objet' }), S(22.01359, 3.25896, 'N-SK16'), S(-435.7604, 6.007567), S(-22.21328, 0.9999999, 'F2'),
        S(20.29192, 4.750409, '', { stop: true }), S(79.6836, 2.952076, 'N-SK16'), S(-18.39533, 42.20778, '', { tsolve: 'M' }), S(Infinity, 0, '', { comment: 'Image' })],
      merit: { v: 2, image: 'SPOT', ops: [{ type: 'EFL', target: 50, weight: 1 }, { type: 'MNCG', target: 1, weight: 100 }, { type: 'MNCA', target: 0.5, weight: 100 }] },
    }),
    'Miroir parabolique f/4 (Newton)': () => base({
      title: 'Miroir parabolique f/4 — D=200 mm', aperture: { type: 'EPD', value: 200, obscuration: 0 },
      fields: [{ y: 0, w: 1 }, { y: 0.25, w: 1 }, { y: 0.5, w: 1 }], wavelengths: [{ um: 0.5875618, w: 1 }], primary: 0,
      surfaces: [S(Infinity, Infinity, '', { comment: 'Objet' }), S(Infinity, 100, '', { comment: 'Entrée' }), S(-1600, -800, 'MIRROR', { k: -1, stop: true, comment: 'Primaire parabolique' }),
        S(Infinity, 0, '', { comment: 'Image' })],
    }),
    'Newton replié (miroir plan à 45°)': () => base({
      title: 'Télescope de Newton D=200 F/4 avec miroir de renvoi', aperture: { type: 'EPD', value: 200, obscuration: 0.25 },
      fields: [{ y: 0, w: 1 }, { y: 0.25, w: 1 }, { y: 0.5, w: 1 }], wavelengths: [{ um: 0.5875618, w: 1 }], primary: 0,
      surfaces: [S(Infinity, Infinity, '', { comment: 'Objet' }), S(Infinity, 100, '', { comment: 'Entrée' }), S(-1600, -650, 'MIRROR', { k: -1, stop: true, comment: 'Primaire parabolique' }),
        S(Infinity, 150, 'MIRROR', { tx: 45, dmode: 'BEN', comment: 'Miroir plan de renvoi' }), S(Infinity, 0, '', { comment: 'Image' })],
    }),
    'Spectrographe à réseau 600 traits/mm': () => base({
      title: 'Spectrographe : réseau en transmission 600 tr/mm + objectif idéal f=100', aperture: { type: 'EPD', value: 10, obscuration: 0 },
      fields: [{ y: 0, w: 1 }, { x: 0.5, y: 0, w: 1 }], wavelengths: [{ um: 0.5, w: 1 }, { um: 0.55, w: 1 }, { um: 0.6, w: 1 }], primary: 1,
      surfaces: [S(Infinity, Infinity, '', { comment: 'Objet' }), S(Infinity, 20, '', { stop: true, comment: 'Pupille' }),
        S(Infinity, 0, '', { elem: 'grating', lpmm: 600, gm: 1, comment: 'Réseau ordre +1' }),
        S(Infinity, 30, '', { tx: -19.2697, dmode: 'DEC', comment: 'Axe de l\'ordre +1 à 550 nm' }),
        S(Infinity, 100, '', { elem: 'ideal', fid: 100, comment: 'Objectif idéal f=100' }),
        S(Infinity, 0, '', { comment: 'Plan focal' })],
    }),
    'Polariseur + lame quart d\'onde': () => base({
      title: 'Polariseur linéaire, lame λ/4 à 45° et lentille idéale', aperture: { type: 'EPD', value: 10, obscuration: 0 },
      fields: [{ y: 0, w: 1 }, { y: 3, w: 1 }], wavelengths: [{ um: 0.6328, w: 1 }], primary: 0,
      surfaces: [S(Infinity, Infinity, '', { comment: 'Objet' }), S(Infinity, 10, '', { stop: true, elem: 'polarizer', pang: 0, comment: 'Polariseur (axe X)' }),
        S(Infinity, 10, '', { elem: 'waveplate', ret: 0.25, wang: 45, comment: 'Lame λ/4 à 45°' }),
        S(Infinity, 50, '', { elem: 'ideal', fid: 50, tsolve: 'M', comment: 'Lentille idéale f=50' }), S(Infinity, 0, '', { comment: 'Image' })],
    }),
    'Télescope Cassegrain F/7.5': () => base({
      title: 'Cassegrain classique D=200 mm F/7.5', aperture: { type: 'EPD', value: 200, obscuration: 0.32 },
      fields: [{ y: 0, w: 1 }, { y: 0.1, w: 1 }, { y: 0.2, w: 1 }], wavelengths: [{ um: 0.5875618, w: 1 }], primary: 0,
      surfaces: [S(Infinity, Infinity, '', { comment: 'Objet' }), S(-1000, -350, 'MIRROR', { k: -1, stop: true, comment: 'Primaire (parabole)' }),
        S(-450, 450, 'MIRROR', { k: -4, comment: 'Secondaire (hyperbole)' }), S(Infinity, 0, '', { comment: 'Image' })],
    }),
    'Système fini 1:1 (relais)': () => base({
      title: 'Relais 1:1 — deux doublets', aperture: { type: 'NA', value: 0.05, obscuration: 0 }, fieldType: 'height',
      fields: [{ y: 0, w: 1 }, { y: 3, w: 1 }, { y: 5, w: 1 }],
      surfaces: [S(Infinity, 97.1, '', { comment: 'Objet' }), S(128.23, 2.5, 'N-SF5'), S(45.71, 4, 'N-BK7'), S(-62.75, 5),
        S(Infinity, 5, '', { stop: true, comment: 'Diaphragme' }), S(62.75, 4, 'N-BK7'), S(-45.71, 2.5, 'N-SF5'), S(-128.23, 97, '', { tsolve: 'M' }), S(Infinity, 0, '', { comment: 'Image' })],
    }),
    // ---- lentilles simples ----
    'Singulet de forme optimale f=100 F/5': () => base({
      title: 'Singulet N-BK7 de forme optimale (aberration sphérique minimale) f=100 mm F/5', aperture: { type: 'EPD', value: 20, obscuration: 0 },
      fields: [{ y: 0, w: 1 }, { y: 2, w: 1 }, { y: 3, w: 1 }],
      surfaces: [S(Infinity, Infinity, '', { comment: 'Objet' }), S(59.74, 5, 'N-BK7', { stop: true, comment: 'Face la plus bombée vers l\'infini' }), S(-372.1267, 97, '', { tsolve: 'M' }), S(Infinity, 0, '', { comment: 'Image' })],
      merit: { v: 2, image: 'SPOT', ops: [{ type: 'EFL', target: 100, weight: 1 }] },
    }),
    'Lentille biconvexe 1:1 (2f – 2f)': () => base({
      title: 'Lentille biconvexe symétrique N-BK7 f=50 mm en conjugaison 1:1', aperture: { type: 'NA', value: 0.05, obscuration: 0 }, fieldType: 'height',
      fields: [{ y: 0, w: 1 }, { y: 2, w: 1 }, { y: 4, w: 1 }],
      surfaces: [S(Infinity, 99.81571, '', { comment: 'Objet' }), S(51.68, 5, 'N-BK7', { stop: true }), S(-51.68, 98, '', { tsolve: 'M' }), S(Infinity, 0, '', { comment: 'Image' })],
      merit: { v: 2, image: 'SPOT', ops: [{ type: 'PMAG', target: -1, weight: 1 }] },
    }),
    'Lentille asphérique de focalisation f=10 (1064 nm)': () => base({
      title: 'Lentille asphérique moulée S-LAH64 f=10 mm ON 0,25 — laser 1064 nm', aperture: { type: 'EPD', value: 5, obscuration: 0 },
      fields: [{ y: 0, w: 1 }, { y: 0.5, w: 1 }, { y: 1, w: 1 }], wavelengths: [{ um: 1.064, w: 1 }], primary: 0,
      surfaces: [S(Infinity, Infinity, '', { comment: 'Objet' }), S(Infinity, 0, '', { stop: true, comment: 'Pupille' }),
        S(7.688431, 3, 'S-LAH64', { k: -0.9966334, a4: 0.00009409413, a6: -1.085724e-7, comment: 'Face asphérique' }), S(Infinity, 8.302624, '', { tsolve: 'M' }), S(Infinity, 0, '', { comment: 'Foyer' })],
      merit: { v: 2, image: 'WFE', ops: [{ type: 'EFL', target: 10, weight: 1 }] },
    }),
    'Lentille cylindrique f=50 (ligne focale)': () => base({
      title: 'Lentille plan-cylindrique N-BK7 f=50 mm : le faisceau converge en Y seulement (ligne selon X)', aperture: { type: 'EPD', value: 10, obscuration: 0 },
      fields: [{ y: 0, w: 1 }, { x: 2, y: 0, w: 1 }], wavelengths: He, primary: 0,
      surfaces: [S(Infinity, Infinity, '', { comment: 'Objet' }), S(25.75, 4, 'N-BK7', { stop: true, type: 'TOR', rx: Infinity, comment: 'Face cylindrique (puissance en Y)' }),
        S(Infinity, 47, '', { tsolve: 'M' }), S(Infinity, 0, '', { comment: 'Ligne focale (selon X)' })],
    }),
    'Singulet hybride réfractif-diffractif f=100': () => base({
      title: 'Singulet N-BK7 achromatisé par un réseau diffractif (DOE) f=100 mm F/5', aperture: { type: 'EPD', value: 20, obscuration: 0 },
      fields: [{ y: 0, w: 1 }, { y: 1.5, w: 1 }, { y: 3, w: 1 }],
      surfaces: [S(Infinity, Infinity, '', { comment: 'Objet' }), S(57.46079, 5, 'N-BK7', { stop: true }),
        S(-1203.264, 0, '', { elem: 'doe', dm: 1, dnr: 10, da: [-324.7022, 28.9126], comment: 'Surface diffractive (achromatisation)' }), S(Infinity, 96.79725, ''), S(Infinity, 0, '', { comment: 'Image' })],
      merit: { v: 2, image: 'SPOT', ops: [{ type: 'EFL', target: 100, weight: 1 }, { type: 'AXCL', target: 0, weight: 1 }] },
    }),
    // ---- doublets et lunettes ----
    'Lunette achromatique D=100 F/9': () => base({
      title: 'Objectif de lunette achromatique (Fraunhofer, espacé) D=100 mm F/9', aperture: { type: 'EPD', value: 100, obscuration: 0 },
      fields: [{ y: 0, w: 1 }, { y: 0.35, w: 1 }, { y: 0.5, w: 1 }],
      surfaces: [S(Infinity, Infinity, '', { comment: 'Objet' }), S(521.0593, 10, 'N-BK7', { stop: true, comment: 'Couronne' }), S(-328.8832, 3), S(-328.379, 7, 'F2', { comment: 'Flint' }),
        S(-1452.441, 884.7205, '', { tsolve: 'M' }), S(Infinity, 0, '', { comment: 'Image' })],
      merit: { v: 2, image: 'SPOT', ops: [{ type: 'EFL', target: 900, weight: 1 }, { type: 'MNCA', target: 0.3, weight: 100 }, { type: 'MNEG', target: 2, weight: 100 }] },
    }),
    'Doublet apochromatique S-FPL53 D=100 F/7': () => base({
      title: 'Objectif apochromatique S-FPL53 / N-KZFS4 D=100 mm F/7 (g, F, d, C)', aperture: { type: 'EPD', value: 100, obscuration: 0 },
      fields: [{ y: 0, w: 1 }, { y: 0.5, w: 1 }, { y: 0.7, w: 1 }], wavelengths: gFdC, primary: 2,
      surfaces: [S(Infinity, Infinity, '', { comment: 'Objet' }), S(389.3289, 12, 'S-FPL53', { stop: true, comment: 'Fluorophosphate (ED)' }), S(-290.3239, 1),
        S(-286.7424, 7, 'N-KZFS4', { comment: 'Flint court (KZFS)' }), S(-658.6804, 689.8549, '', { tsolve: 'M' }), S(Infinity, 0, '', { comment: 'Image' })],
      merit: { v: 2, image: 'SPOT', ops: [{ type: 'EFL', target: 700, weight: 1 }, { type: 'MNCA', target: 0.3, weight: 100 }, { type: 'MNEG', target: 2, weight: 100 }] },
    }),
    // ---- objectifs photographiques ----
    'Tessar f=50 F/4.5': () => base({
      title: 'Tessar f=50 mm F/4,5 — champ ±20°', aperture: { type: 'EPD', value: 11.11, obscuration: 0 },
      fields: [{ y: 0, w: 1 }, { y: 14, w: 1 }, { y: 20, w: 1 }],
      surfaces: [S(Infinity, Infinity, '', { comment: 'Objet' }), S(20.95483, 3.25896, 'N-SK16'), S(-314.6918, 5.512426), S(-22.19698, 1, 'F2'), S(20.10694, 4.252278, '', { stop: true }),
        S(83.12428, 1, 'LF5'), S(180.1977, 2.5, 'N-SK16'), S(-18.80592, 42, '', { tsolve: 'M' }), S(Infinity, 0, '', { comment: 'Image' })],
      merit: { v: 2, image: 'SPOT', ops: [{ type: 'EFL', target: 50, weight: 1 }, { type: 'MNCA', target: 0.5, weight: 100 }, { type: 'MNEG', target: 0.8, weight: 100 }, { type: 'MNCG', target: 0.8, weight: 100 }] },
    }),
    'Double Gauss f=100 F/3': () => base({
      title: 'Double Gauss (type Planar) f=100 mm F/3 — champ ±14°', aperture: { type: 'EPD', value: 33.33, obscuration: 0 },
      fields: [{ y: 0, w: 1 }, { y: 10, w: 1 }, { y: 14, w: 1 }],
      surfaces: [S(Infinity, Infinity, '', { comment: 'Objet' }), S(55.29101, 8.747, 'N-SK2'), S(154.0236, 0.5), S(35.20043, 14, 'N-SK16'), S(Infinity, 3.777, 'F5'), S(22.08829, 14.253),
        S(Infinity, 12.428, '', { stop: true }), S(-25.48849, 3.777, 'F5'), S(Infinity, 10.834, 'N-SK16'), S(-36.81989, 0.5), S(178.8146, 6.858, 'N-SK16'),
        S(-69.89159, 57.315, '', { tsolve: 'M' }), S(Infinity, 0, '', { comment: 'Image' })],
      merit: { v: 2, image: 'SPOT', ops: [{ type: 'EFL', target: 100, weight: 1 }] },
    }),
    'Petzval f=100 F/3': () => base({
      title: 'Objectif de Petzval (deux doublets) f=100 mm F/3 — champ ±5°', aperture: { type: 'EPD', value: 33.3, obscuration: 0 },
      fields: [{ y: 0, w: 1 }, { y: 3.5, w: 1 }, { y: 5, w: 1 }],
      surfaces: [S(Infinity, Infinity, '', { comment: 'Objet' }), S(85.11013, 8, 'N-BK7', { stop: true }), S(-68.12143, 3, 'N-SF5'), S(-253.6624, 94.87909),
        S(45.04794, 6, 'N-BK7'), S(-58.74641, 2.5, 'N-SF5'), S(-542.2705, 30, '', { tsolve: 'M' }), S(Infinity, 0, '', { comment: 'Image' })],
      merit: { v: 2, image: 'SPOT', ops: [{ type: 'EFL', target: 100, weight: 1 }, { type: 'MNCA', target: 1, weight: 100 }, { type: 'MNEG', target: 1, weight: 100 }] },
    }),
    'Téléobjectif f=200 F/5.6': () => base({
      title: 'Téléobjectif f=200 mm F/5,6 — longueur 140 mm (rapport télé 0,7)', aperture: { type: 'EPD', value: 35.7, obscuration: 0 },
      fields: [{ y: 0, w: 1 }, { y: 2, w: 1 }, { y: 3, w: 1 }],
      surfaces: [S(Infinity, Infinity, '', { comment: 'Objet' }), S(66.12961, 6, 'N-BK7', { stop: true, comment: 'Groupe convergent' }), S(-65.689, 2.5, 'N-SF5'), S(-262.2889, 104.5915),
        S(-23.23767, 2, 'N-BK7', { comment: 'Groupe divergent' }), S(51.63884, 3, 'N-SF5'), S(138.6783, 22, '', { tsolve: 'M' }), S(Infinity, 0, '', { comment: 'Image' })],
      merit: { v: 2, image: 'SPOT', ops: [{ type: 'EFL', target: 200, weight: 1 }, { type: 'TTL', target: 140, weight: 1 }, { type: 'MNCA', target: 1, weight: 100 }, { type: 'MNEG', target: 1, weight: 100 }] },
    }),
    // ---- télescopes ----
    'Ritchey-Chrétien F/8': () => base({
      title: 'Ritchey-Chrétien D=200 mm F/8 (primaire F/3, tirage 150 mm)', aperture: { type: 'EPD', value: 200, obscuration: 0.35 },
      fields: [{ y: 0, w: 1 }, { y: 0.2, w: 1 }, { y: 0.3, w: 1 }], wavelengths: [{ um: 0.5875618, w: 1 }], primary: 0,
      surfaces: [S(Infinity, Infinity, '', { comment: 'Objet' }), S(-1200, -395.4332, 'MIRROR', { k: -1.139033, stop: true, comment: 'Primaire (hyperbole)' }),
        S(-654.6138, 545.4332, 'MIRROR', { k: -6.51373, comment: 'Secondaire (hyperbole)' }), S(Infinity, 0, '', { comment: 'Image' })],
      merit: { v: 2, image: 'SPOT', ops: [{ type: 'EFL', target: 1600, weight: 1 }, { type: 'TTL', target: 150, weight: 1 }] },
    }),
    'Chambre de Schmidt F/2': () => base({
      title: 'Chambre de Schmidt D=200 mm F/2 : lame asphérique au centre de courbure, surface focale courbe', aperture: { type: 'EPD', value: 200, obscuration: 0 },
      fields: [{ y: 0, w: 1 }, { y: 3, w: 1 }, { y: 5, w: 1 }],
      surfaces: [S(Infinity, Infinity, '', { comment: 'Objet' }), S(Infinity, 8, 'N-BK7', { stop: true, comment: 'Lame de Schmidt' }), S(Infinity, 792, '', { a4: 9.398398e-10, a6: 2.166542e-15, comment: 'Face asphérique' }),
        S(-800, -400, 'MIRROR', { comment: 'Miroir sphérique' }), S(-394.4932, 0, '', { comment: 'Surface focale courbe' })],
    }),
    // ---- oculaires, microscopie, faisceaux ----
    'Oculaire de Plössl f=25': () => base({
      title: 'Oculaire de Plössl f=25 mm (tracé inversé : de l\'œil vers le diaphragme de champ) — champ apparent ±20°', aperture: { type: 'EPD', value: 5, obscuration: 0 },
      fields: [{ y: 0, w: 1 }, { y: 14, w: 1 }, { y: 20, w: 1 }],
      surfaces: [S(Infinity, Infinity, '', { comment: 'Objet (infini)' }), S(Infinity, 19.02311, '', { stop: true, comment: 'Pupille de sortie (œil)' }), S(126.104, 1.5, 'N-SF5'), S(21.11243, 7, 'N-BK7'), S(-31.98407, 0.5),
        S(23.41453, 7, 'N-BK7'), S(-29.56987, 1.5, 'N-SF5'), S(-66.19667, 18, '', { tsolve: 'M' }), S(Infinity, 0, '', { comment: 'Diaphragme de champ' })],
      merit: { v: 2, image: 'SPOT', ops: [{ type: 'EFL', target: 25, weight: 1 }, { type: 'MNCA', target: 0.3, weight: 100 }, { type: 'MNEG', target: 1, weight: 100 }] },
    }),
    'Objectif de microscope 10× ON 0,25': () => base({
      title: 'Objectif de microscope 10× ON 0,25 corrigé à l\'infini, f=20 mm (Lister, tracé inversé : de la pupille vers l\'objet)', aperture: { type: 'EPD', value: 10, obscuration: 0 },
      fields: [{ y: 0, w: 1 }, { y: 1, w: 1 }, { y: 1.4, w: 1 }],
      surfaces: [S(Infinity, Infinity, '', { comment: 'Lentille de tube (infini)' }), S(Infinity, 5, '', { stop: true, comment: 'Pupille (plan focal arrière)' }), S(24.34342, 3.5, 'N-BK7'), S(-16.25734, 1.5, 'N-SF5'),
        S(-78.74838, 4), S(12.66843, 3.5, 'N-BK7'), S(-48.49032, 1.5, 'N-SF5'), S(161.475, 10, '', { tsolve: 'M' }), S(Infinity, 0, '', { comment: 'Objet observé' })],
      merit: { v: 2, image: 'SPOT', ops: [{ type: 'EFL', target: 20, weight: 1 }, { type: 'MNEG', target: 0.8, weight: 100 }, { type: 'MNEA', target: 0.3, weight: 10000 }] },
    }),
    'Expanseur de faisceau Galilée ×4': () => base({
      title: 'Expanseur de faisceau de Galilée ×4 (HeNe) suivi d\'une lentille idéale qui contrôle la collimation', aperture: { type: 'EPD', value: 2.5, obscuration: 0 },
      fields: [{ y: 0, w: 1 }, { y: 0.1, w: 1 }], wavelengths: He, primary: 0,
      surfaces: [S(Infinity, Infinity, '', { comment: 'Objet' }), S(-12.88, 2, 'N-BK7', { stop: true, comment: 'Lentille divergente f = −25' }), S(Infinity, 70.88049),
        S(Infinity, 4, 'N-BK7', { comment: 'Lentille convergente f = 100' }), S(-51.5, 10), S(Infinity, 100, '', { elem: 'ideal', fid: 100, tsolve: 'M', comment: 'Lentille idéale f=100 (contrôle de la collimation)' }),
        S(Infinity, 0, '', { comment: 'Plan focal' })],
    }),
  };
  /** catégories du menu Exemples (ordre d'affichage) */
  const CATS = [
    ['Lentilles simples', ['Lentille plan-convexe f=100', 'Singulet de forme optimale f=100 F/5', 'Lentille biconvexe 1:1 (2f – 2f)', 'Lentille asphérique de focalisation f=10 (1064 nm)', 'Lentille cylindrique f=50 (ligne focale)', 'Singulet hybride réfractif-diffractif f=100']],
    ['Doublets et lunettes', ['Doublet achromatique f=100', 'Lunette achromatique D=100 F/9', 'Doublet apochromatique S-FPL53 D=100 F/7']],
    ['Objectifs photographiques', ['Triplet de Cooke f=50 F/5', 'Tessar f=50 F/4.5', 'Double Gauss f=100 F/3', 'Petzval f=100 F/3', 'Téléobjectif f=200 F/5.6']],
    ['Télescopes à miroirs', ['Miroir parabolique f/4 (Newton)', 'Newton replié (miroir plan à 45°)', 'Télescope Cassegrain F/7.5', 'Ritchey-Chrétien F/8', 'Chambre de Schmidt F/2']],
    ['Oculaires, microscopie, relais', ['Oculaire de Plössl f=25', 'Objectif de microscope 10× ON 0,25', 'Système fini 1:1 (relais)', 'Expanseur de faisceau Galilée ×4']],
    ['Composants spéciaux', ['Spectrographe à réseau 600 traits/mm', 'Polariseur + lame quart d\'onde']],
  ];
  Object.defineProperty(L, '_cats', { value: CATS, enumerable: false });
  return L;
})();
if (typeof module !== 'undefined') module.exports = SAMPLES;
