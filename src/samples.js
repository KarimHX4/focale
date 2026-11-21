'use strict';
const SAMPLES = (() => {
  const S = (r, t, glass = '', o = {}) => ({ r, t, glass, sd: 0, sdFixed: false, k: 0, a4: 0, a6: 0, a8: 0, a10: 0,
    stop: false, comment: '', vr: false, vt: false, vk: false, tsolve: '', ...o });
  const FdC = [{ um: 0.4861327, w: 1 }, { um: 0.5875618, w: 1 }, { um: 0.6562725, w: 1 }];
  const base = (o) => ({ title: '', aperture: { type: 'EPD', value: 10, obscuration: 0 }, fieldType: 'angle',
    fields: [{ y: 0, w: 1 }], wavelengths: FdC, primary: 1, rayAiming: false,
    merit: { image: 'SPOT', ops: [] }, ...o });
  return {
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
      merit: { image: 'SPOT', ops: [{ type: 'EFL', target: 100, weight: 1 }] },
    }),
    'Triplet de Cooke f=50 F/5': () => base({
      title: 'Triplet de Cooke 40° — f=50 mm F/5', aperture: { type: 'EPD', value: 10, obscuration: 0 },
      fields: [{ y: 0, w: 1 }, { y: 14, w: 1 }, { y: 20, w: 1 }],
      surfaces: [S(Infinity, Infinity, '', { comment: 'Objet' }), S(22.01359, 3.25896, 'N-SK16'), S(-435.7604, 6.007567), S(-22.21328, 0.9999999, 'F2'),
        S(20.29192, 4.750409, '', { stop: true }), S(79.6836, 2.952076, 'N-SK16'), S(-18.39533, 42.20778, '', { tsolve: 'M' }), S(Infinity, 0, '', { comment: 'Image' })],
      merit: { image: 'SPOT', ops: [{ type: 'EFL', target: 50, weight: 1 }, { type: 'MNCT', target: 1, weight: 10 }, { type: 'MNCA', target: 0.5, weight: 10 }] },
    }),
    'Miroir parabolique f/4 (Newton)': () => base({
      title: 'Miroir parabolique f/4 — D=200 mm', aperture: { type: 'EPD', value: 200, obscuration: 0 },
      fields: [{ y: 0, w: 1 }, { y: 0.25, w: 1 }, { y: 0.5, w: 1 }], wavelengths: [{ um: 0.5875618, w: 1 }], primary: 0,
      surfaces: [S(Infinity, Infinity, '', { comment: 'Objet' }), S(Infinity, 100, '', { comment: 'Entrée' }), S(-1600, -800, 'MIRROR', { k: -1, stop: true, comment: 'Primaire parabolique' }),
        S(Infinity, 0, '', { comment: 'Image' })],
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
  };
})();
if (typeof module !== 'undefined') module.exports = SAMPLES;
