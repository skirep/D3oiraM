// Island coordinates are world units; y is the WALKABLE TOP, not the centre.
// Each route is hand authored. No random geometry can obstruct the main route.
const island = (x, y, z, w = 6, d = 6, extra = {}) => ({ x, y, z, w, d, ...extra });
export const LEVELS = [
  {
    name: { ca: 'Jardins del vent', es: 'Jardines del viento', en: 'Wind gardens' },
    sky: '#c5e5df', fog: '#c5e5df', grass: '#8fbd62', earth: '#d0ac79', accent: '#f5c96b',
    spawn: [0, 0, 3], checkpoint: 5,
    islands: [
      island(0, 0, 0, 14, 14), island(0, 1, -12, 7, 7), island(8, 1.8, -18),
      island(15, 2.4, -25, 8, 8), island(6, 2.8, -31), island(-2, 3.2, -37, 10, 9),
      island(-12, 3.8, -42), island(-20, 4.3, -49, 8, 8), island(-12, 4.5, -56),
      island(-3, 5, -62, 11, 10), island(7, 5.6, -67), island(15, 6, -74, 13, 13)
    ],
    shards: [[15, 3.8, -25], [-20, 5.7, -49], [7, 7, -67]],
    enemies: [{ island: 3, axis: 'x', range: 2 }, { island: 7, axis: 'z', range: 2 }, { island: 11, axis: 'x', range: 3 }],
    springs: [8], moving: [], goal: [15, 6, -77]
  },
  {
    name: { ca: 'Ruïnes de mandarina', es: 'Ruinas de mandarina', en: 'Tangerine ruins' },
    sky: '#f2c8ac', fog: '#f2c8ac', grass: '#e5b776', earth: '#be8167', accent: '#cf755e',
    spawn: [0, 0, 3], checkpoint: 5,
    islands: [
      island(0, 0, 0, 13, 12), island(-8, 1, -10, 6, 6), island(-15, 2, -17, 7, 7),
      island(-7, 3, -25, 8, 8), island(3, 3.6, -30, 6, 6, { motion: { axis: 'x', range: 1.5, speed: .7 } }),
      island(12, 4, -37, 10, 10), island(20, 4.8, -46), island(12, 5.5, -54, 8, 8),
      island(3, 6, -60), island(-6, 6.6, -66, 8, 8), island(-14, 7, -73), island(-6, 7.5, -82, 13, 13)
    ],
    shards: [[-15, 3.4, -17], [20, 6.2, -46], [-14, 8.4, -73]],
    enemies: [{ island: 3, axis: 'z', range: 2.3 }, { island: 5, axis: 'x', range: 3 }, { island: 9, axis: 'x', range: 2 }],
    springs: [7], goal: [-6, 7.5, -85]
  },
  {
    name: { ca: 'Observatori lunar', es: 'Observatorio lunar', en: 'Moonlit observatory' },
    sky: '#353e68', fog: '#353e68', grass: '#89b2b0', earth: '#656b91', accent: '#b1a3e4',
    spawn: [0, 0, 3], checkpoint: 5,
    islands: [
      island(0, 0, 0, 13, 12), island(0, 1, -11), island(8, 2, -18), island(16, 3, -25, 8, 8),
      island(8, 3.6, -33, 6, 6, { motion: { axis: 'z', range: 1.3, speed: .8 } }),
      island(0, 4.2, -40, 10, 9), island(-9, 5, -47), island(-17, 5.8, -54, 8, 8),
      island(-8, 6.5, -61, 6, 6, { motion: { axis: 'x', range: 1.3, speed: .7 } }),
      island(1, 7.2, -68, 8, 8), island(10, 8, -75), island(19, 8.5, -82, 14, 14)
    ],
    shards: [[16, 4.4, -25], [-17, 7.2, -54], [10, 9.4, -75]],
    enemies: [{ island: 3, axis: 'x', range: 2 }, { island: 7, axis: 'z', range: 2 }, { island: 11, axis: 'x', range: 3.5 }],
    springs: [6], goal: [19, 8.5, -85]
  }
];
export function coinPositions(level) {
  return level.islands.flatMap((p, i) => {
    if (i === 0) return [[-2, p.y + 1, 1], [0, p.y + 1, -2], [2, p.y + 1, -4]];
    return [[p.x - 1.25, p.y + 1, p.z], [p.x, p.y + 1, p.z - 1], [p.x + 1.25, p.y + 1, p.z]];
  });
}
