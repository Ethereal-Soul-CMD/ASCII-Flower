/*
  ascii-bloom
  A generative ASCII flower that grows, blooms and turns under a field of stars.
  Every seed gives a different species, shape, palette, stem, leaves and sky.
*/
(() => {
'use strict';

// ============================================================ random
function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
class RNG {
  constructor(seed) { this.f = mulberry32(xmur3(String(seed))); }
  next() { return this.f(); }
  range(a, b) { return a + (b - a) * this.f(); }
  int(a, b) { return Math.floor(this.range(a, b + 1)); }
  pick(arr) { return arr[Math.floor(this.f() * arr.length)]; }
  chance(p) { return this.f() < p; }
  weighted(entries) {
    let s = 0; for (const e of entries) s += e[1];
    let r = this.f() * s;
    for (const e of entries) { if ((r -= e[1]) <= 0) return e[0]; }
    return entries[entries.length - 1][0];
  }
}
function hash1(n) {
  n |= 0;
  n = (n ^ 61) ^ (n >>> 16); n = Math.imul(n, 9); n ^= n >>> 4;
  n = Math.imul(n, 0x27d4eb2d); n ^= n >>> 15;
  return (n >>> 0) / 4294967296;
}

// ============================================================ math
const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const sstep = (a, b, x) => smooth((x - a) / (b - a));
const easeInOut = x => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
function hsv(h, s, v) {
  h = (((h % 360) + 360) % 360) / 60;
  const c = v * s, x = c * (1 - Math.abs((h % 2) - 1)), m = v - c;
  let r, g, b;
  if (h < 1) [r, g, b] = [c, x, 0]; else if (h < 2) [r, g, b] = [x, c, 0];
  else if (h < 3) [r, g, b] = [0, c, x]; else if (h < 4) [r, g, b] = [0, x, c];
  else if (h < 5) [r, g, b] = [x, 0, c]; else [r, g, b] = [c, 0, x];
  return [r + m, g + m, b + m];
}
const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const scalec = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
function mmul(a, b) {
  const o = new Array(9);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++)
    o[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
  return o;
}
const rotX = t => { const c = Math.cos(t), s = Math.sin(t); return [1, 0, 0, 0, c, -s, 0, s, c]; };
const rotY = t => { const c = Math.cos(t), s = Math.sin(t); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
const rotZ = t => { const c = Math.cos(t), s = Math.sin(t); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
const mv = (M, v) => [M[0] * v[0] + M[1] * v[1] + M[2] * v[2], M[3] * v[0] + M[4] * v[1] + M[5] * v[2], M[6] * v[0] + M[7] * v[1] + M[8] * v[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// ============================================================ palettes
// each family: base (deep, at the petal heart), body, tip, edge, in HSV
const FAM = {
  crimson:   [[350, .95, .30], [352, .90, .70], [356, .82, .94], [2, .50, 1]],
  scarlet:   [[0, .95, .38], [4, .90, .84], [8, .80, 1], [12, .50, 1]],
  pink:      [[335, .75, .45], [338, .55, .90], [340, .35, 1], [345, .18, 1]],
  blush:     [[350, .45, .78], [355, .24, 1], [10, .12, 1], [20, .05, 1]],
  white:     [[55, .14, .88], [48, .04, 1], [45, .015, 1], [0, 0, 1]],
  cream:     [[45, .38, .86], [45, .18, 1], [45, .08, 1], [45, .03, 1]],
  yellow:    [[38, .95, .60], [47, .86, .98], [52, .70, 1], [56, .45, 1]],
  orange:    [[16, .95, .55], [24, .90, .98], [32, .80, 1], [38, .50, 1]],
  coral:     [[5, .82, .55], [10, .62, .98], [18, .45, 1], [25, .25, 1]],
  magenta:   [[315, .90, .40], [318, .80, .85], [322, .60, 1], [330, .30, 1]],
  purple:    [[275, .85, .32], [280, .62, .78], [285, .42, .98], [290, .20, 1]],
  lilac:     [[270, .48, .55], [275, .30, .92], [280, .18, 1], [285, .08, 1]],
  violet:    [[235, .85, .38], [240, .62, .85], [245, .42, 1], [250, .20, 1]],
  sunset:    [[45, .95, .70], [32, .86, .98], [355, .85, .95], [350, .70, 1]],
  picotee:   [[90, .18, .70], [0, 0, .96], [340, .22, 1], [340, .88, 1]],
  stargazer: [[330, .88, .50], [335, .70, .90], [340, .42, 1], [0, 0, 1]],
  peach:     [[16, .55, .82], [22, .42, 1], [27, .28, 1], [34, .14, 1]],
  apricot:   [[28, .85, .62], [32, .55, .98], [36, .35, 1], [40, .18, 1]],
  gold:      [[34, 1, .62], [42, .95, .98], [46, .85, 1], [50, .6, 1]],
  lemon:     [[54, .6, .86], [57, .45, 1], [58, .3, 1], [60, .15, 1]],
  burgundy:  [[345, .95, .22], [348, .9, .5], [350, .82, .72], [355, .6, .85]],
  midnight:  [[350, .95, .12], [352, .92, .32], [355, .85, .5], [358, .7, .62]],
  sky:       [[205, .7, .55], [208, .42, .95], [212, .25, 1], [215, .1, 1]],
  indigo:    [[255, .9, .3], [258, .75, .7], [262, .55, .92], [265, .3, 1]],
  lavender:  [[262, .45, .55], [265, .3, .9], [268, .2, 1], [270, .1, 1]],
  chartreuse:[[80, .85, .5], [76, .6, .92], [70, .45, 1], [65, .25, 1]],
  fuchsia:   [[305, .95, .45], [310, .85, .92], [315, .65, 1], [320, .35, 1]],
  flame:     [[0, .95, .45], [8, .9, .9], [30, .85, 1], [48, .8, 1]],
  ocean:     [[225, .85, .4], [218, .55, .88], [210, .25, 1], [0, 0, 1]],
  autumn:    [[15, .9, .32], [22, .85, .7], [38, .9, .95], [48, .8, 1]],
  saucer:    [[325, .7, .58], [330, .4, .94], [340, .1, 1], [0, 0, 1]],
  peppermint:[[0, .1, .8], [0, 0, .97], [0, 0, 1], [350, .75, 1]],
};
// some families carry streaks along the veins: [color hsv, streak count]
const FAM_STRIPE = { peppermint: [[352, .85, .85], 7], flame: [[2, .9, .8], 5], autumn: [[10, .9, .45], 9] };
const FAM_EDGE = { picotee: [0.95, 0.55], stargazer: [0.75, 0.6], sunset: [0.5, 0.7], ocean: [0.7, 0.55], saucer: [0.4, 0.8], peppermint: [0.5, 0.8] };

function makePalette(R, fam) {
  const dh = R.range(-7, 7);
  const c = FAM[fam].map(([h, s, v]) => hsv(h + dh, clamp(s * R.range(0.92, 1.05)), clamp(v)));
  const e = FAM_EDGE[fam] || [R.range(0.25, 0.45), 0.75];
  return { fam, base: c[0], body: c[1], tip: c[2], edge: c[3], edgeAmt: e[0], edgeStart: e[1],
    spot: hsv(FAM[fam][0][0] + dh - 10, 0.9, 0.22),
    blotch: FAM[fam][1][1] < .3 ? hsv(350 + dh, .9, .42) : hsv(FAM[fam][0][0] + dh - 8, 0.9, .12),
    stripe: FAM_STRIPE[fam] ? hsv(FAM_STRIPE[fam][0][0] + dh, FAM_STRIPE[fam][0][1], FAM_STRIPE[fam][0][2]) : null,
    stripeN: FAM_STRIPE[fam] ? FAM_STRIPE[fam][1] : 0, light: FAM[fam][1][1] < .3 && FAM[fam][1][2] > .9 };
}

// ============================================================ species
const SPECIES = {
  rose:    { w: 3.0, fams: ['crimson', 'crimson', 'scarlet', 'pink', 'blush', 'cream', 'yellow', 'coral', 'lilac', 'sunset', 'picotee', 'peach', 'apricot', 'burgundy', 'midnight', 'lavender', 'ocean', 'flame'] },
  tulip:   { w: 1.4, fams: ['scarlet', 'yellow', 'pink', 'purple', 'white', 'orange', 'sunset', 'magenta', 'picotee', 'flame', 'midnight', 'apricot', 'lavender', 'peppermint'] },
  lily:    { w: 1.3, fams: ['white', 'orange', 'stargazer', 'stargazer', 'yellow', 'pink', 'apricot', 'burgundy', 'lemon'] },
  daisy:   { w: 1.4, fams: ['white', 'white', 'yellow', 'pink', 'orange', 'lilac', 'magenta', 'gold', 'sky', 'fuchsia', 'flame'] },
  dahlia:  { w: 1.1, fams: ['magenta', 'orange', 'scarlet', 'yellow', 'purple', 'blush', 'sunset', 'burgundy', 'apricot', 'flame', 'peach', 'chartreuse'] },
  peony:   { w: 1.2, fams: ['pink', 'blush', 'coral', 'white', 'magenta', 'crimson', 'peach', 'burgundy', 'lemon'] },
  lotus:   { w: 1.0, fams: ['pink', 'white', 'blush', 'saucer', 'fuchsia'] },
  anemone: { w: 1.0, fams: ['scarlet', 'purple', 'violet', 'white', 'pink', 'crimson', 'indigo', 'fuchsia'] },
  sunflower: { w: 1.2, fams: ['gold', 'gold', 'yellow', 'lemon', 'autumn', 'orange'] },
  cosmos:  { w: 1.0, fams: ['pink', 'magenta', 'white', 'fuchsia', 'lavender', 'peppermint', 'burgundy'] },
  hibiscus:{ w: 1.1, fams: ['scarlet', 'pink', 'orange', 'yellow', 'coral', 'peach', 'fuchsia', 'white'] },
  iris:    { w: 1.1, fams: ['indigo', 'violet', 'purple', 'lavender', 'sky', 'white', 'yellow', 'burgundy', 'ocean'] },
  poppy:   { w: 1.1, fams: ['scarlet', 'scarlet', 'orange', 'coral', 'white', 'pink', 'burgundy', 'apricot', 'lemon'] },
  carnation:{ w: 1.0, fams: ['pink', 'crimson', 'white', 'peppermint', 'coral', 'burgundy', 'apricot', 'yellow', 'lavender', 'chartreuse'] },
  magnolia:{ w: 0.9, fams: ['white', 'blush', 'saucer', 'saucer', 'pink', 'cream'] },
};
const GOLDEN = 2.39996323;

function basePetal(o) {
  return Object.assign({ count: 5, len: .5, W: .25, r0: .03, y0: 0, phC0: .3, phC1: -.1, phO0: .5, phO1: 1.2,
    curl: 0, cupC: .9, cupO: .4, wrap: .6, ruffle: .02, rufF: 3, wk: 1.5, we: .5, notch: 0, fringe: 0, fringeF: 18,
    veins: 6, openMax: 1, delay: 0, rot: 0, spots: 0, gloss: .25, jit: .1,
    blotch: 0, blotchU: .25, beard: 0, beardC: null, crinkle: 0, pal: null }, o);
}

function makeGenome(seed) {
  const R = new RNG(seed);
  const type = R.weighted(Object.entries(SPECIES).map(([k, v]) => [k, v.w]));
  const fam = R.pick(SPECIES[type].fams);
  const pal = makePalette(R, fam);
  const size = R.range(1.0, 1.25);
  const G = { seed, type, fam, pal, size, layers: [], centers: [], sepals: null, leaves: [], thorns: [], stemPal: null };
  const L = [];

  if (type === 'rose') {
    const n = R.int(6, 9);
    for (let l = 0; l < n; l++) {
      const f = l / (n - 1), len = lerp(.26, .62, Math.pow(f, .8)) * size * R.range(.95, 1.05);
      L.push(basePetal({ count: l === 0 ? 3 : R.int(4, 5), len, W: len * R.range(.5, .62), r0: .015 + .05 * f, y0: .02 - .03 * f,
        phC0: lerp(.08, .3, f), phC1: lerp(-.05, -.32, f),
        phO0: lerp(.04, .85, Math.pow(f, 1.3)), phO1: lerp(.2, 1.75, Math.pow(f, 1.1)), curl: lerp(.15, R.range(.5, 1.1), f),
        cupC: .9, cupO: lerp(.75, .3, f), wrap: 1, ruffle: R.range(.02, .07), rufF: R.range(2, 4),
        wk: R.range(1.4, 1.8), we: R.range(.45, .6), notch: R.range(0, .1), veins: R.range(5, 9),
        openMax: lerp(.22, 1, Math.pow(f, .7)), delay: (1 - f) * .55, rot: l * GOLDEN, gloss: .18 }));
    }
  } else if (type === 'tulip') {
    const lilyFlowered = R.chance(.3), size2 = R.range(.62, .75) * size;
    for (let l = 0; l < 2; l++) {
      const phO0 = lilyFlowered ? R.range(.2, .32) + .08 * l : R.range(.42, .55) + .06 * l;
      L.push(basePetal({ count: 3, len: size2 * (l ? 1 : .96), W: size2 * (lilyFlowered ? R.range(.36, .42) : R.range(.48, .54)), r0: .03, y0: .02,
        phC0: .32, phC1: -.12, phO0, phO1: lilyFlowered ? phO0 + R.range(.3, .5) : R.range(-.2, .02), curl: lilyFlowered ? R.range(.5, .8) : 0,
        cupC: .95, cupO: lilyFlowered ? .72 : 1.05, wrap: .7, ruffle: .015, wk: lilyFlowered ? .95 : 1.5, we: lilyFlowered ? 1 : .45,
        veins: 7, delay: l === 0 ? .15 : 0, rot: l * Math.PI / 3, gloss: .5 }));
    }
    G.centers.push({ kind: 'stamens', n: 6, len: .2 * size, spread: .07 * size, rise: 1, y0: .03, fil: [.25, .3, .15], anth: [.08, .06, .08], pistil: [.7, .8, .4] });
  } else if (type === 'lily') {
    const len = R.range(.78, .98) * size, spots = (fam === 'orange' || fam === 'stargazer') ? 1 : (R.chance(.3) ? .6 : 0);
    for (let l = 0; l < 2; l++) {
      L.push(basePetal({ count: 3, len: len * (l ? 1 : .95), W: len * R.range(.17, .24) * (l ? .9 : 1.1), r0: .03,
        phC0: .2, phC1: -.08, phO0: R.range(.45, .7), phO1: R.range(1.5, 1.9), curl: R.range(.5, 1.1),
        cupC: .8, cupO: .35, wrap: .6, ruffle: R.range(.03, .08), rufF: R.range(5, 9), wk: .95, we: 1,
        veins: 3, spots, delay: l === 0 ? .1 : 0, rot: l * Math.PI / 3, gloss: .45 }));
    }
    G.centers.push({ kind: 'stamens', n: 6, len: len * .62, spread: len * .38, rise: .8, y0: .03, fil: [.78, .9, .62], anth: [.55, .18, .05], pistil: [.72, .88, .5] });
  } else if (type === 'daisy') {
    const rc = R.range(.14, .22) * size, n = R.int(1, 2), count = R.int(14, 28);
    const len = R.range(.45, .62) * size, notch = R.chance(.5) ? R.range(.05, .2) : 0;
    for (let l = 0; l < n; l++) {
      const phO0 = R.range(1.3, 1.5) - l * .12;
      L.push(basePetal({ count, len: len * (l ? .9 : 1), W: len * R.range(.08, .13), r0: rc * .92, y0: 0,
        phC0: .12, phC1: -.05, phO0, phO1: phO0 + R.range(.05, .35), curl: R.range(0, .3),
        cupC: .5, cupO: R.range(.15, .35), wrap: 0, ruffle: .01, wk: 1.2, we: .5, notch, fringe: notch ? 0 : R.range(0, .08),
        veins: 2, delay: l * .1, rot: l * Math.PI / count, jit: .18, gloss: .2 }));
    }
    const dark = fam === 'yellow' || fam === 'orange';
    G.centers.push({ kind: 'disk', rc, h: rc * R.range(.25, .5), y0: .01,
      c0: dark ? [.16, .09, .03] : [.55, .62, .12], c1: dark ? [.34, .17, .05] : [1, .82, .12], c2: dark ? [.52, .28, .06] : [1, .64, .06] });
  } else if (type === 'dahlia') {
    const n = R.int(8, 12), pompon = R.chance(.35);
    for (let l = 0; l < n; l++) {
      const f = l / (n - 1), len = lerp(.16, .55, Math.pow(f, .9)) * size, phO0 = lerp(.1, 1.35, Math.pow(f, 1.1));
      L.push(basePetal({ count: R.int(8, 12), len, W: len * R.range(.17, .24), r0: .02 + .08 * f, y0: .06 * (1 - f),
        phC0: .2, phC1: -.1, phO0, phO1: phO0 + lerp(.1, .5, f), curl: lerp(0, .4, f),
        cupC: 1.2, cupO: pompon ? 1.5 : R.range(.9, 1.4), wrap: .5, ruffle: .01,
        wk: pompon ? 1.5 : .9, we: pompon ? .5 : 1, veins: 0, openMax: lerp(.5, 1, f), delay: (1 - f) * .6, rot: l * GOLDEN, gloss: .3 }));
    }
  } else if (type === 'peony') {
    const n = R.int(9, 13);
    for (let l = 0; l < n; l++) {
      const f = l / (n - 1), len = lerp(.22, .6, Math.pow(f, .7)) * size;
      L.push(basePetal({ count: R.int(5, 8), len, W: len * R.range(.55, .75), r0: .01 + .06 * f, y0: .03 - .03 * f,
        phC0: lerp(.06, .3, f), phC1: lerp(-.05, -.35, f), phO0: lerp(.05, .9, Math.pow(f, 1.6)), phO1: lerp(.25, 1.45, Math.pow(f, 1.3)),
        curl: lerp(.05, .35, f), cupC: .9, cupO: lerp(1.1, .55, f), wrap: .85,
        ruffle: lerp(.18, .08, f) * R.range(.8, 1.3), rufF: R.range(3, 6), wk: 1.5, we: .5,
        notch: R.range(.05, .2), fringe: R.range(0, .15), openMax: lerp(.35, 1, Math.pow(f, .6)), delay: (1 - f) * .6, rot: l * GOLDEN, gloss: .25 }));
    }
    if (R.chance(.35)) G.centers.push({ kind: 'ring', n: 40, r: .07 * size, len: .07 * size, y0: .02, fil: [1, .9, .55], anth: [1, .8, .15] });
  } else if (type === 'lotus') {
    const n = R.int(3, 4);
    for (let l = 0; l < n; l++) {
      const f = l / (n - 1), len = lerp(.4, .62, f) * size, phO0 = lerp(.25, 1.0, f);
      L.push(basePetal({ count: 8, len, W: len * R.range(.3, .38), r0: .1 + .04 * f, y0: 0,
        phC0: .3, phC1: -.15, phO0, phO1: phO0 + R.range(.15, .35), curl: .05, cupC: .9, cupO: .65, wrap: .4,
        ruffle: .01, wk: 1.1, we: .9, veins: 7, delay: (1 - f) * .4, rot: l * Math.PI / 8, gloss: .3 }));
    }
    G.centers.push({ kind: 'pod', rp: .1 * size, hp: .08 * size, y0: .02, c: [.78, .82, .28], seed: [.32, .38, .1] });
    G.centers.push({ kind: 'ring', n: 46, r: .11 * size, len: .08 * size, y0: .01, fil: [1, .92, .6], anth: [1, .78, .2] });
  } else if (type === 'sunflower') {
    const rc = R.range(.24, .3) * size, count = R.int(21, 34), len = R.range(.42, .52) * size;
    for (let l = 0; l < 2; l++) {
      const phO0 = R.range(1.3, 1.45) - l * .15;
      L.push(basePetal({ count, len: len * (l ? .9 : 1), W: len * R.range(.15, .19), r0: rc * .95, y0: 0,
        phC0: .1, phC1: -.1, phO0, phO1: phO0 + R.range(.1, .3), curl: R.range(.1, .3), cupC: .6, cupO: .35, wrap: .2,
        ruffle: .02, rufF: 2, wk: .9, we: 1, veins: 5, delay: l * .08, rot: l * Math.PI / count, jit: .2, gloss: .25 }));
    }
    G.centers.push({ kind: 'disk', rc, h: rc * R.range(.12, .22), y0: .01, c0: [.1, .06, .02], c1: [.22, .12, .03], c2: [.42, .25, .05] });
    G.centers.push({ kind: 'ring', n: 70, r: rc * .82, len: .025 * size, y0: .03, fil: [.5, .3, .05], anth: [1, .78, .15] });
  } else if (type === 'cosmos') {
    const count = R.int(8, 9), len = R.range(.42, .52) * size;
    L.push(basePetal({ count, len, W: len * R.range(.38, .46), r0: .07, y0: 0, phC0: .2, phC1: -.1,
      phO0: R.range(1.15, 1.35), phO1: R.range(1.35, 1.6), curl: .05, cupC: .7, cupO: .12, wrap: .5,
      ruffle: .03, rufF: 3, wk: 1.3, we: .5, fringe: R.range(.1, .16), fringeF: R.range(6, 9), veins: 7, jit: .08, gloss: .2 }));
    G.centers.push({ kind: 'disk', rc: .075 * size, h: .04 * size, y0: .01, c0: [.7, .65, .1], c1: [1, .8, .1], c2: [.95, .62, .05] });
  } else if (type === 'hibiscus') {
    const len = R.range(.6, .72) * size;
    L.push(basePetal({ count: 5, len, W: len * R.range(.52, .6), r0: .03, y0: 0, phC0: .22, phC1: -.12,
      phO0: R.range(.6, .85), phO1: R.range(1.5, 1.85), curl: R.range(.2, .45), cupC: .9, cupO: .3, wrap: .9,
      ruffle: R.range(.08, .14), rufF: R.range(3, 5), crinkle: .5, wk: 1.6, we: .5, veins: 14,
      blotch: R.chance(.85) ? 1 : 0, blotchU: R.range(.18, .28), jit: .08, gloss: .35 }));
    const eye = pal.blotch;
    G.centers.push({ kind: 'column', len: len * R.range(.75, .95), y0: .02, c: mixc(pal.body, [1, 1, 1], .1), anth: [1, .85, .2], stig: mixc(eye, [1, .1, .2], .5) });
  } else if (type === 'iris') {
    const len = R.range(.55, .66) * size, beardC = R.pick([[1, .8, .1], [1, .55, .1], [1, .95, .7], [.95, .4, .4]]);
    const IRIS_PAIR = { indigo: ['lavender', 'white', 'sky'], violet: ['lavender', 'white'], purple: ['lavender', 'white'], sky: ['white'], ocean: ['white', 'sky'], burgundy: ['lemon', 'peach'], yellow: ['white', 'lemon'], white: ['lemon', 'lavender', 'sky'], lavender: ['white'] };
    const twoTone = IRIS_PAIR[fam] && R.chance(.45) ? makePalette(R, R.pick(IRIS_PAIR[fam])) : null;
    L.push(basePetal({ count: 3, len: len * .85, W: len * .3, r0: .03, y0: .03, phC0: .12, phC1: -.12,
      phO0: R.range(.05, .2), phO1: R.range(-.25, -.05), curl: -.2, cupC: 1, cupO: .95, wrap: .7,
      ruffle: R.range(.1, .16), rufF: R.range(3, 5), crinkle: .25, wk: 1.4, we: .55, veins: 11, delay: .2,
      rot: Math.PI / 3, gloss: .35, pal: twoTone }));
    L.push(basePetal({ count: 3, len, W: len * .36, r0: .03, y0: 0, phC0: .15, phC1: -.1,
      phO0: R.range(.8, 1.0), phO1: R.range(2.3, 2.7), curl: .4, cupC: .9, cupO: .25, wrap: .6,
      ruffle: R.range(.08, .14), rufF: R.range(3, 5), crinkle: .2, wk: 1.4, we: .55, veins: 13,
      beard: 1, beardC, delay: 0, gloss: .35 }));
  } else if (type === 'poppy') {
    const len = R.range(.48, .58) * size;
    for (let l = 0; l < 2; l++) {
      L.push(basePetal({ count: 2, len: len * (l ? 1 : .92), W: len * R.range(.72, .82), r0: .05, y0: .01 * (1 - l),
        phC0: .1, phC1: -.25, phO0: R.range(.45, .7) + .1 * l, phO1: R.range(1.15, 1.45) + .1 * l, curl: .1,
        cupC: 1.1, cupO: .5, wrap: 1, ruffle: R.range(.1, .16), rufF: R.range(2, 4), crinkle: 1, wk: 1.7, we: .45, veins: 10,
        blotch: R.chance(.7) ? 1 : 0, blotchU: R.range(.14, .22), delay: l === 0 ? .12 : 0, rot: l * Math.PI / 2, gloss: .3 }));
    }
    G.centers.push({ kind: 'pod', rp: .065 * size, hp: .09 * size, y0: .02, c: [.45, .58, .32], seed: [.25, .1, .3], rays: R.int(8, 12) });
    G.centers.push({ kind: 'ring', n: 70, r: .08 * size, len: .07 * size, y0: .02, fil: [.15, .1, .15], anth: [.1, .08, .2] });
  } else if (type === 'carnation') {
    const n = R.int(7, 10);
    for (let l = 0; l < n; l++) {
      const f = l / (n - 1), len = lerp(.22, .42, f) * size;
      L.push(basePetal({ count: R.int(5, 8), len, W: len * R.range(.55, .7), r0: .01 + .03 * f, y0: .05 * (1 - f),
        phC0: lerp(.05, .2, f), phC1: lerp(-.05, -.2, f), phO0: lerp(.1, .95, Math.pow(f, 1.4)), phO1: lerp(.3, 1.45, f),
        curl: lerp(0, .3, f), cupC: .9, cupO: lerp(.9, .3, f), wrap: .8, ruffle: R.range(.1, .16), rufF: R.range(4, 6), crinkle: .4,
        wk: 1.5, we: .5, fringe: R.range(.22, .32), fringeF: R.range(20, 28), veins: 5,
        openMax: lerp(.45, 1, f), delay: (1 - f) * .5, rot: l * GOLDEN, gloss: .2 }));
    }
  } else if (type === 'magnolia') {
    for (let l = 0; l < 3; l++) {
      const f = l / 2, len = lerp(.5, .6, f) * size;
      L.push(basePetal({ count: 3, len, W: len * R.range(.48, .55), r0: .04 + .02 * f, y0: 0,
        phC0: .22, phC1: -.12, phO0: lerp(.32, .62, f), phO1: lerp(-.18, .55, f) + R.range(0, .12), curl: lerp(0, .3, f),
        cupC: 1, cupO: 1.15, wrap: .6, ruffle: .02, wk: 1.7, we: .42, veins: 8, openMax: lerp(.7, 1, f), delay: (1 - f) * .35,
        rot: l * Math.PI / 3, gloss: .45 }));
    }
    G.centers.push({ kind: 'disk', rc: .05 * size, h: .18 * size, y0: .03, c0: [.75, .85, .45], c1: [.85, .75, .45], c2: [.9, .6, .55] });
    G.centers.push({ kind: 'ring', n: 40, r: .06 * size, len: .05 * size, y0: .02, fil: [1, .9, .85], anth: [1, .7, .65] });
  } else { // anemone or camellia
    const n = R.int(1, 2), count = R.int(5, 8), len = R.range(.42, .55) * size, camellia = R.chance(.45);
    for (let l = 0; l < n; l++) {
      const phO0 = R.range(.75, 1.1) - l * .2;
      L.push(basePetal({ count, len: len * (l ? .85 : 1), W: len * R.range(.45, .62), r0: .08, y0: .01 * l,
        phC0: .25, phC1: -.2, phO0, phO1: phO0 + R.range(.25, .5), curl: .1, cupC: .9, cupO: R.range(.25, .45), wrap: .7,
        ruffle: R.range(.02, .06), rufF: R.range(2, 4), wk: 1.5, we: .5, veins: 9, delay: l === 1 ? 0 : .12 * (n - 1),
        rot: l * Math.PI / count, gloss: .3 }));
    }
    if (camellia) {
      G.centers.push({ kind: 'ring', n: 44, r: .06 * size, len: .12 * size, y0: .02, fil: [1, .95, .7], anth: [1, .82, .2] });
    } else {
      G.centers.push({ kind: 'disk', rc: .085 * size, h: .05 * size, y0: .02, c0: [.03, .03, .07], c1: [.07, .06, .14], c2: [.12, .1, .2] });
      G.centers.push({ kind: 'ring', n: 50, r: .095 * size, len: .06 * size, y0: .02, fil: [.12, .1, .2], anth: [.06, .06, .18] });
    }
  }
  // two-tone: inner layers drift toward a matching second colour
  const TWO = { yellow: ['crimson', 'coral', 'pink', 'scarlet'], cream: ['peach', 'blush', 'pink'], white: ['pink', 'blush', 'lemon', 'lavender'],
    blush: ['crimson', 'magenta'], peach: ['coral', 'apricot', 'lemon'], pink: ['white', 'lemon', 'magenta'], lemon: ['orange', 'coral'],
    apricot: ['lemon', 'peach'], lavender: ['purple', 'white'], coral: ['lemon', 'yellow'], magenta: ['white', 'lemon'], orange: ['yellow', 'scarlet'],
    gold: ['scarlet', 'burgundy'], scarlet: ['yellow', 'gold'] };
  if (['rose', 'peony', 'dahlia', 'carnation'].includes(type) && TWO[fam] && R.chance(.38) && L.length > 2) {
    const p2 = makePalette(R, R.pick(TWO[fam]));
    const mixPal = (a, b, t) => Object.assign({}, a, { base: mixc(a.base, b.base, t), body: mixc(a.body, b.body, t), tip: mixc(a.tip, b.tip, t), edge: mixc(a.edge, b.edge, t), light: a.light && b.light });
    L.forEach((P, l) => { const t = Math.pow(1 - l / (L.length - 1), 1.3) * .9; if (t > .05) P.pal = mixPal(pal, p2, t); });
    G.twoTone = p2.fam;
  } else if ((type === 'daisy' || type === 'cosmos') && TWO[fam] && R.chance(.35)) {
    // a contrasting ring at the heart of each petal
    const p2 = makePalette(R, R.pick(TWO[fam]));
    pal.blotch = p2.body;
    L.forEach(P => { P.blotch = .85; P.blotchU = R.range(.22, .32); });
  }
  // inner layers first in the list, outer ones last
  G.layers = L;
  G.headH = Math.max(...L.map(p => p.len)) * 0.95;

  // sepals
  if (type === 'rose' || type === 'peony' || type === 'anemone' || type === 'dahlia') {
    const len = (type === 'rose' ? .3 : .2) * size;
    G.sepals = basePetal({ count: 5, len, W: len * .2, r0: .03, y0: -.01, phC0: .25, phC1: -.12, phO0: 1.2, phO1: 2.5, curl: .4,
      cupC: .5, cupO: .3, wrap: .6, wk: .9, we: 1.1, veins: 1, rot: R.range(0, TAU), gloss: .3, ruffle: type === 'rose' ? .05 : .01, rufF: 8 });
  } else if (type === 'sunflower') {
    G.sepals = basePetal({ count: 22, len: .16 * size, W: .045 * size, r0: .12 * size, y0: -.03, phC0: .4, phC1: .2, phO0: 1.6, phO1: 2.3,
      cupC: .3, cupO: .3, wrap: 0, wk: .9, we: 1, veins: 1, gloss: .2, jit: .2 });
  } else if (type === 'cosmos' || type === 'hibiscus') {
    const h = type === 'hibiscus';
    G.sepals = basePetal({ count: h ? 5 : 8, len: (h ? .2 : .1) * size, W: (h ? .05 : .025) * size, r0: .04, y0: -.02, phC0: .25, phC1: -.1,
      phO0: h ? .5 : 1.4, phO1: h ? .7 : 2, cupC: .4, cupO: .4, wrap: .4, wk: .9, we: 1, veins: 1, gloss: .2 });
  } else if (type === 'carnation') {
    G.sepals = basePetal({ count: 5, len: .24 * size, W: .055 * size, r0: .035, y0: -.12 * size, phC0: .12, phC1: -.02,
      phO0: .12, phO1: .05, cupC: .9, cupO: .9, wrap: .95, wk: .9, we: 1, veins: 3, gloss: .3 });
  } else if (type === 'daisy') {
    G.sepals = basePetal({ count: 16, len: .1 * size, W: .022 * size, r0: .05, y0: -.02, phC0: .3, phC1: .1, phO0: 1.5, phO1: 2.0,
      cupC: .2, cupO: .2, wrap: 0, wk: .9, we: 1, veins: 1, gloss: .2 });
  }

  // greens
  // the green follows the flower: warm blooms get yellow-greens, cool blooms blue-greens,
  // pale blooms soft muted greens, deep blooms deep greens
  const fh = FAM[fam][1][0], fs = FAM[fam][1][1], fv = FAM[fam][1][2];
  const warm = fh < 75 || fh > 290, cool = fh >= 170 && fh <= 290;
  const gh = (warm ? R.range(88, 108) : cool ? R.range(128, 148) : R.range(105, 125)) + R.range(-4, 4);
  const gs = lerp(.42, .78, clamp(fs * 1.1)) * R.range(.92, 1.05);
  const gv = lerp(.82, 1, clamp(fv)) * (fs < .25 ? .9 : 1) * lerp(.85, 1, clamp(fv));
  G.green = {
    dark: hsv(gh + 6, clamp(gs * 1.05), .18 * gv), body: hsv(gh, gs, .5 * gv), light: hsv(gh - 8, gs * .75, .7 * gv),
    stem: hsv(gh - 4, gs * .95, .55 * gv), vein: hsv(gh - 10, gs * .6, .78 * gv),
  };
  G.sepalPal = { base: G.green.dark, body: G.green.body, tip: G.green.light, edge: G.green.light, edgeAmt: .2, edgeStart: .8, spot: G.green.dark };

  // head orientation and stem
  const tiltRange = { rose: [.05, .35], tulip: [0, .2], lily: [.75, 1.15], daisy: [.75, 1.05], dahlia: [.45, .8], peony: [.2, .45], lotus: [.15, .4], anemone: [.6, .95],
    sunflower: [.75, 1.05], cosmos: [.6, .95], hibiscus: [.55, .95], iris: [0, .15], poppy: [.3, .65], carnation: [.05, .3], magnolia: [.05, .3] }[type];
  G.head = { tilt: R.range(tiltRange[0], tiltRange[1]), az: R.range(-.7, .7), spin: R.range(0, TAU) };
  const H = R.range(1.35, 1.8) * (type === 'lotus' ? .9 : 1);
  const M0 = mmul(rotY(G.head.az), rotX(G.head.tilt));
  const up = mv(M0, [0, 1, 0]);
  const P3 = [R.range(-.28, .28), H, R.range(-.18, .12)];
  G.stem = {
    H, thick: R.range(.85, 1.2) * ({ lotus: 1.3, sunflower: 1.8, hibiscus: 1.25, magnolia: 1.35, carnation: .8, cosmos: .7 }[type] || 1),
    P0: [0, 0, 0], P1: [R.range(-.3, .3), H * R.range(.25, .45), R.range(-.2, .2)], P2: sub(P3, mul(up, H * R.range(.22, .36))), P3,
  };
  G.pivot = [P3[0] * .5, 0, P3[2] * .5];
  G.stemBase = { P1: G.stem.P1.slice(), P2: G.stem.P2.slice(), P3: P3.slice() };
  G.windPh = R.range(0, TAU);
  if (type === 'carnation') { // swollen nodes
    G.nodes = [R.range(.22, .3), R.range(.5, .58), R.range(.76, .82)];
  }

  // leaves
  const lv = [];
  const lsz = (type === 'lotus' || type === 'tulip') ? 1.1 : 1.3;
  const leaf = o => Object.assign({ u: .4, psi: 0, len: .5, W: .14, elev: 1.0, droop: .6, fold: .5, serr: 0, teeth: 10,
    shape: 'ovate', pairs: 0, petiole: .08, gloss: .3, wave: R.range(0, .12), roll: R.range(.7, 1.15) * (R.chance(.5) ? 1 : -1),
    twist: R.range(.35, .7) * (R.chance(.5) ? 1 : -1), cup: R.range(.25, .45), tipDroop: R.range(.25, .6) }, o, (() => { const k = R.range(.85, 1.15) * lerp(1.1, .82, o.u || .4); return { len: (o.len || .5) * lsz * k, W: (o.W || .14) * lsz * k }; })());
  let psi = R.range(0, TAU);
  if (type === 'rose' || type === 'dahlia' || type === 'peony') {
    const n = R.int(2, 3);
    for (let i = 0; i < n; i++) {
      psi += R.range(2.0, 3.4);
      lv.push(leaf({ u: lerp(.25, .75, n === 1 ? .5 : i / (n - 1)) + R.range(-.05, .05), psi, len: R.range(.2, .28) * size,
        W: R.range(.08, .11) * size, elev: R.range(.75, 1.15), droop: R.range(.3, .7), fold: R.range(.25, .5),
        serr: type === 'peony' ? 0 : R.range(.15, .3), teeth: R.int(9, 14), shape: type === 'peony' ? 'lance' : 'ovate',
        pairs: R.int(1, 2), petiole: R.range(.25, .4) * size, gloss: .45 }));
    }
  } else if (type === 'tulip') {
    for (let i = 0; i < 2; i++) {
      psi += R.range(2.5, 3.6);
      lv.push(leaf({ u: R.range(.04, .14), psi, len: R.range(.85, 1.15) * size, W: R.range(.13, .18) * size,
        elev: R.range(.25, .45), droop: R.range(.6, 1.1), fold: R.range(.35, .6), shape: 'lance', petiole: 0, gloss: .4 }));
    }
  } else if (type === 'lily') {
    const n = R.int(6, 10);
    for (let i = 0; i < n; i++) {
      psi += GOLDEN;
      lv.push(leaf({ u: lerp(.12, .72, i / (n - 1)), psi, len: R.range(.28, .4) * size, W: R.range(.045, .065) * size,
        elev: R.range(.8, 1.15), droop: R.range(.3, .7), fold: .35, shape: 'lance', petiole: 0 }));
    }
  } else if (type === 'daisy') {
    const n = R.int(2, 4);
    for (let i = 0; i < n; i++) {
      psi += R.range(1.8, 3.4);
      lv.push(leaf({ u: R.range(.08, .5), psi, len: R.range(.32, .48) * size, W: R.range(.07, .1) * size,
        elev: R.range(.7, 1.1), droop: R.range(.4, .8), fold: .35, serr: R.range(.25, .45), teeth: R.int(5, 8), shape: 'lance', petiole: .06 }));
    }
  } else if (type === 'lotus') {
    const n = R.int(1, 2);
    for (let i = 0; i < n; i++) {
      psi += R.range(2.4, 3.6);
      lv.push(leaf({ u: R.range(.12, .3), psi, len: R.range(.5, .62) * size, W: R.range(.26, .32) * size, roll: R.range(-.35, .35),
        elev: R.range(1.35, 1.5), droop: R.range(.0, .15), fold: -.18, shape: 'round', petiole: R.range(.25, .4), gloss: .5 }));
    }
  } else if (type === 'sunflower') {
    const n = R.int(3, 5);
    for (let i = 0; i < n; i++) {
      psi += R.range(2.0, 3.2);
      lv.push(leaf({ u: lerp(.15, .7, i / (n - 1)), psi, len: R.range(.32, .42) * size, W: R.range(.18, .23) * size,
        elev: R.range(.9, 1.25), droop: R.range(.5, .9), fold: .25, serr: .12, teeth: R.int(12, 16), shape: 'heart', petiole: R.range(.12, .2), wave: .15 }));
    }
  } else if (type === 'cosmos') {
    const n = R.int(2, 3);
    for (let i = 0; i < n; i++) {
      psi += R.range(2.2, 3.4);
      lv.push(leaf({ u: R.range(.15, .6), psi, len: R.range(.14, .2) * size, W: R.range(.012, .018) * size, elev: R.range(.8, 1.1),
        droop: .4, fold: .1, shape: 'grass', pairs: R.int(3, 4), petiole: R.range(.22, .32) * size, wave: 0 }));
    }
  } else if (type === 'hibiscus' || type === 'magnolia') {
    const n = R.int(3, 4);
    for (let i = 0; i < n; i++) {
      psi += R.range(2.0, 3.4);
      lv.push(leaf({ u: lerp(.2, .78, i / (n - 1)), psi, len: R.range(.26, .34) * size, W: R.range(.1, .14) * size,
        elev: R.range(.8, 1.15), droop: R.range(.3, .6), fold: .3, serr: type === 'hibiscus' ? R.range(.12, .22) : 0, teeth: R.int(9, 13),
        shape: 'ovate', petiole: R.range(.06, .12), gloss: .3 }));
    }
  } else if (type === 'iris') {
    const n = R.int(3, 5);
    for (let i = 0; i < n; i++) {
      psi += R.range(1.6, 2.6);
      lv.push(leaf({ u: R.range(.02, .08), psi, len: R.range(.85, 1.2) * size, W: R.range(.05, .07) * size,
        elev: R.range(.1, .35), droop: R.range(.1, .35), fold: .15, shape: 'sword', petiole: 0, roll: R.range(1.2, 1.5), wave: 0 }));
    }
  } else if (type === 'poppy') {
    const n = R.int(2, 3);
    for (let i = 0; i < n; i++) {
      psi += R.range(2.2, 3.4);
      lv.push(leaf({ u: R.range(.05, .35), psi, len: R.range(.32, .42) * size, W: R.range(.09, .12) * size,
        elev: R.range(.8, 1.1), droop: R.range(.5, .8), fold: .35, serr: R.range(.45, .6), teeth: R.int(4, 6), shape: 'lance', petiole: .05, wave: .1 }));
    }
  } else if (type === 'carnation') {
    for (const u of G.nodes) {
      const a = R.range(0, TAU);
      for (const sg of [0, Math.PI]) lv.push(leaf({ u, psi: a + sg, len: R.range(.26, .36) * size, W: R.range(.025, .035) * size,
        elev: R.range(.5, .8), droop: R.range(.6, 1.1), fold: .3, shape: 'grass', petiole: 0, wave: 0 }));
    }
  } else { // anemone: a whorl of three just under the flower and one low leaf
    const u = R.range(.62, .74);
    for (let i = 0; i < 3; i++) {
      lv.push(leaf({ u, psi: psi + i * TAU / 3, len: R.range(.22, .3) * size, W: R.range(.07, .09) * size,
        elev: R.range(.9, 1.2), droop: R.range(.3, .6), fold: .4, serr: R.range(.35, .5), teeth: R.int(4, 6), shape: 'lance', petiole: 0 }));
    }
    lv.push(leaf({ u: R.range(.08, .18), psi: psi + 1, len: R.range(.3, .4) * size, W: R.range(.09, .12) * size,
      elev: R.range(.9, 1.2), droop: .6, fold: .4, serr: .4, teeth: 6, shape: 'ovate', petiole: .15 }));
  }
  G.leaves = lv;


  G.bloomDur = R.range(7.5, 10) / 1.1;
  G.skySeed = R.int(0, 1e9);
  G.id = xmur3(String(seed)) & 0xffff;
  G.name = `${fam} ${type}`.replace(/\b\w/g, c => c.toUpperCase());
  return G;
}

// ============================================================ geometry buffer
const STRIDE = 19, MAXP = 320000;
const BUF = new Float32Array(MAXP * STRIDE);
let NP = 0, NMODEL = 0;
function push(x, y, z, nx, ny, nz, r, g, b, tx, ty, tz, order, edge, kind, h, side, gloss, pid) {
  if (NP >= MAXP) return;
  const o = NP * STRIDE;
  BUF[o] = x; BUF[o + 1] = y; BUF[o + 2] = z; BUF[o + 3] = nx; BUF[o + 4] = ny; BUF[o + 5] = nz;
  BUF[o + 6] = r; BUF[o + 7] = g; BUF[o + 8] = b; BUF[o + 9] = tx; BUF[o + 10] = ty; BUF[o + 11] = tz;
  BUF[o + 12] = order; BUF[o + 13] = edge; BUF[o + 14] = kind; BUF[o + 15] = h; BUF[o + 16] = side; BUF[o + 17] = gloss; BUF[o + 18] = pid || 0;
  NP++;
}

const GMAX = 240 * 80;
const TROW = new Float32Array(260), TCOL = new Float32Array(100);
const GP = new Float32Array(GMAX * 3), GC = new Float32Array(GMAX * 3), GO = new Float32Array(GMAX);
const GK = new Uint8Array(GMAX), GN = new Float32Array(GMAX * 3), GT = new Float32Array(GMAX * 3);

// turns a filled grid of positions into points with normals, edges and colors
function emitGrid(nu, nv, o) {
  const N = nu * nv;
  for (let i = 0; i < nu; i++) {
    const i0 = i > 0 ? i - 1 : i, i1 = i < nu - 1 ? i + 1 : i;
    for (let j = 0; j < nv; j++) {
      let j0 = j - 1, j1 = j + 1;
      if (o.wrap) { j0 = (j0 + nv) % nv; j1 = j1 % nv; } else { if (j0 < 0) j0 = 0; if (j1 > nv - 1) j1 = nv - 1; }
      const a = (i1 * nv + j) * 3, b = (i0 * nv + j) * 3, c = (i * nv + j1) * 3, d = (i * nv + j0) * 3;
      const ux = GP[a] - GP[b], uy = GP[a + 1] - GP[b + 1], uz = GP[a + 2] - GP[b + 2];
      const vx = GP[c] - GP[d], vy = GP[c + 1] - GP[d + 1], vz = GP[c + 2] - GP[d + 2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const L = Math.sqrt(nx * nx + ny * ny + nz * nz), k = (i * nv + j) * 3;
      if (L < 1e-12) {
        if (i > 0) { const q = ((i - 1) * nv + j) * 3; nx = GN[q]; ny = GN[q + 1]; nz = GN[q + 2]; } else { nx = 0; ny = 1; nz = 0; }
      } else { nx /= L; ny /= L; nz /= L; }
      GN[k] = nx; GN[k + 1] = ny; GN[k + 2] = nz;
      const sideE = o.sides && (j === 0 || j === nv - 1), tipE = o.tip && i === nu - 1;
      if (sideE) { GT[k] = ux; GT[k + 1] = uy; GT[k + 2] = uz; }
      else if (tipE) { GT[k] = vx; GT[k + 1] = vy; GT[k + 2] = vz; }
      else { GT[k] = 0; GT[k + 1] = 0; GT[k + 2] = 0; }
    }
  }
  let side = 0;
  if (o.ref) {
    const k = ((nu >> 1) * nv + (nv >> 1)) * 3;
    side = (GN[k] * o.ref[0] + GN[k + 1] * o.ref[1] + GN[k + 2] * o.ref[2]) >= 0 ? 1 : -1;
  }
  for (let i = 0; i < nu; i++) TROW[i] = Math.sin(i * .9 + o.id * .37);
  for (let j = 0; j < nv; j++) TCOL[j] = Math.cos(j * 1.1 + o.id * .11);
  for (let m = 0; m < N; m++) {
    const k = m * 3;
    const e = (GT[k] !== 0 || GT[k + 1] !== 0 || GT[k + 2] !== 0) ? 1 : 0;
    push(GP[k], GP[k + 1], GP[k + 2], GN[k], GN[k + 1], GN[k + 2], GC[k], GC[k + 1], GC[k + 2],
      GT[k], GT[k + 1], GT[k + 2], GO[m], e, GK[m], .5 + .5 * TROW[(m / nv) | 0] * TCOL[m % nv], side, o.gloss, (o.id % 1000003) + 1);
  }
}

function emitCurve(fn, n, color, o0, o1, kind, id, gloss = .2) {
  let prev = fn(0);
  for (let k = 0; k <= n; k++) {
    const s = k / n, p = fn(s), q = fn(Math.min(1, s + 1 / n + 1e-4)), t = sub(q, k === n ? prev : p);
    const nn = norm(cross(t, [0, 0, 1]));
    push(p[0], p[1], p[2], nn[0], nn[1], nn[2], color[0], color[1], color[2], t[0], t[1], t[2], lerp(o0, o1, s), 1, kind, hash1(id + k), 0, gloss);
    prev = p;
  }
}

// ---------------------------------------------------------------- petals
const SR = new Float32Array(112), SY = new Float32Array(112), SPh = new Float32Array(112);
// per-column scratch for the petal builder
const CV = new Float32Array(80), CAV = new Float32Array(80), CNOTCH = new Float32Array(80), CFR = new Float32Array(80);
const CRS = new Float32Array(80), CRC = new Float32Array(80), CVEIN = new Float32Array(80), CSTS = new Float32Array(80), CSTC = new Float32Array(80);
const CBL = new Float32Array(80), CBR = new Float32Array(80), CCS = new Float32Array(80), CCC = new Float32Array(80);
function emitPetal(P, open, theta, M, T, pal, orderBase, orderSpan, headH, id, dens, lenMul) {
  const len = P.len * lenMul, W = P.W * lenMul;
  const nu = clamp(Math.ceil(P.len * 1.08 * dens * 1.3) + 4, 6, 96) | 0;
  let nv = clamp(Math.ceil(2 * P.W * 1.08 * dens * 1.2) + 3, 5, 71) | 0; if (nv % 2 === 0) nv++;
  const ds = len / (nu - 1);
  let r = P.r0, y = P.y0;
  for (let i = 0; i < nu; i++) {
    const u = i / (nu - 1);
    const pc = P.phC0 + (P.phC1 - P.phC0) * u, po = P.phO0 + (P.phO1 - P.phO0) * u + P.curl * sstep(.5, 1, u);
    const ph = pc + (po - pc) * open;
    SR[i] = r > .004 ? r : .004; SY[i] = y; SPh[i] = ph;
    r += Math.sin(ph) * ds; y += Math.cos(ph) * ds;
  }
  const cup = (P.cupC + (P.cupO - P.cupC) * open) * .9, wrapK = P.wrap * (1 - open);
  const ct = Math.cos(theta), st = Math.sin(theta);
  if (P.pal) pal = P.pal;
  const { base, body, tip, edge, edgeAmt, edgeStart, spot } = pal;
  const sph = hash1(id * 3 + 1) * 6, tone = .9 + .2 * hash1(id * 5 + 2);
  const reshape = P.notch > 0 || P.fringe > 0;
  const ruffleK = P.ruffle * W, crinkK = P.crinkle * W * .045;
  const stripe = pal.stripe, blotch = P.blotch ? pal.blotch : null, beardC = P.beard ? P.beardC : null;
  // everything that depends only on the column
  for (let j = 0; j < nv; j++) {
    const v = -1 + 2 * j / (nv - 1), av = v < 0 ? -v : v;
    CV[j] = v; CAV[j] = av;
    CNOTCH[j] = P.notch > 0 ? P.notch * Math.exp(-v * v * 8) : 0;
    CFR[j] = P.fringe > 0 ? P.fringe * (.5 + .5 * Math.sin(v * P.fringeF + id)) : 0;
    const a = v * P.rufF * Math.PI + id;
    CRS[j] = Math.sin(a) * (.35 + .65 * av); CRC[j] = Math.cos(a) * (.35 + .65 * av);
    CVEIN[j] = .5 + .5 * Math.cos(v * P.veins * Math.PI);
    if (stripe) { const b = v * pal.stripeN * Math.PI + sph; CSTS[j] = Math.sin(b); CSTC[j] = Math.cos(b); }
    if (blotch) { CBL[j] = P.blotchU * (1 + .25 * Math.sin(v * 5 + sph)); CBR[j] = Math.cos(v * 13 + sph) > .7 ? 1 : 0; }
    if (crinkK) { CCS[j] = Math.sin(v * 7 + id); CCC[j] = Math.cos(v * 7 + id); }
  }
  let m = 0;
  for (let i = 0; i < nu; i++) {
    const u = i / (nu - 1);
    const prof = Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(u, P.wk))), P.we);
    const hw = W * (0.07 + 0.93 * prof);
    const t1 = sstep(0, .5, u), t2 = sstep(.5, 1, u) * .85, bd = (pal.light ? .78 : .5) + (pal.light ? .22 : .5) * sstep(0, .32, u), vk = .1 * sstep(.05, .3, u);
    const u4 = u * u * u * u, u6 = u4 * u * u, u15 = u * Math.sqrt(u);
    const su = Math.sin(u * 4), cu = Math.cos(u * 4);
    const rowR = ruffleK * u15;
    const crA = crinkK ? crinkK * sstep(.1, .4, u) : 0;
    const cs23 = Math.sin(u * 23), cc23 = Math.cos(u * 23), sst = stripe ? Math.sin(u * 2.5) : 0, cst = stripe ? Math.cos(u * 2.5) : 0;
    // base color of this row, before per-column changes
    let r0 = base[0] + (body[0] - base[0]) * t1, g0 = base[1] + (body[1] - base[1]) * t1, b0 = base[2] + (body[2] - base[2]) * t1;
    r0 += (tip[0] - r0) * t2; g0 += (tip[1] - g0) * t2; b0 += (tip[2] - b0) * t2;
    const orow = SR[i], yrow = SY[i], prow = SPh[i];
    const nrRow = -Math.cos(prow), nyRow = Math.sin(prow);
    for (let j = 0; j < nv; j++, m++) {
      const v = CV[j], av = CAV[j];
      let rad = orow, yy = yrow, nr = nrRow, nyy = nyRow;
      if (reshape) {
        let ue = u - CNOTCH[j] * u4 - CFR[j] * u6;
        ue = ue < 0 ? 0 : ue > 1 ? 1 : ue;
        const fi = ue * (nu - 1), i0 = fi | 0, f = fi - i0, i1 = i0 + 1 < nu ? i0 + 1 : nu - 1;
        rad = SR[i0] + (SR[i1] - SR[i0]) * f; yy = SY[i0] + (SY[i1] - SY[i0]) * f;
        const ph = SPh[i0] + (SPh[i1] - SPh[i0]) * f; nr = -Math.cos(ph); nyy = Math.sin(ph);
      }
      const lat = v * hw;
      let Rr = rad, Tn = lat;
      if (wrapK > 0) {
        let al = lat / (rad > .02 ? rad : .02); al = al < -2.8 ? -2.8 : al > 2.8 ? 2.8 : al;
        Rr = rad + (rad * Math.cos(al) - rad) * wrapK; Tn = lat + (rad * Math.sin(al) - lat) * wrapK;
      }
      // sin(a + 4u) by angle addition, so no trig per point
      let off = cup * hw * v * v + rowR * (CRS[j] * cu + CRC[j] * su);
      if (crA) off += crA * (CCS[j] * cc23 + CCC[j] * cs23) * Math.sin(v * 17 - u * 13 + sph);
      const Rl = Rr + nr * off, ly = yy + nyy * off;
      const lx = Rl * ct - Tn * st, lz = Rl * st + Tn * ct;
      const k = m * 3;
      GP[k] = M[0] * lx + M[1] * ly + M[2] * lz + T[0];
      GP[k + 1] = M[3] * lx + M[4] * ly + M[5] * lz + T[1];
      GP[k + 2] = M[6] * lx + M[7] * ly + M[8] * lz + T[2];
      // color
      let cr = r0, cg = g0, cb = b0;
      const ex = u * .92 > av ? u * .92 : av;
      if (ex > edgeStart) {
        const e = sstep(edgeStart, 1, ex) * edgeAmt;
        cr += (edge[0] - cr) * e; cg += (edge[1] - cg) * e; cb += (edge[2] - cb) * e;
      }
      let mm = (1 - vk * CVEIN[j]) * bd;
      let kind = 0;
      if (stripe && u > .12) {
        const sv = .5 + .5 * (CSTS[j] * cst + CSTC[j] * sst);
        if (sv > .82) { const k2 = sstep(.82, .95, sv) * .85; cr += (stripe[0] - cr) * k2; cg += (stripe[1] - cg) * k2; cb += (stripe[2] - cb) * k2; }
      }
      if (blotch) {
        const bu = CBL[j];
        let k2 = 1 - sstep(bu * .75, bu, u);
        if (CBR[j] && u < bu * 1.7) k2 = Math.max(k2, .7 * (1 - u / (bu * 1.7)));
        k2 *= P.blotch;
        if (k2 > 0) { cr += (blotch[0] - cr) * k2; cg += (blotch[1] - cg) * k2; cb += (blotch[2] - cb) * k2; if (k2 > .4 && mm < .9) mm = .9; }
      }
      if (beardC && av < .13 && u > .06 && u < .48) { cr = beardC[0]; cg = beardC[1]; cb = beardC[2]; mm = 1; kind = 6; }
      if (P.spots && u > .12 && u < .62 && av < .75 && hash1(id * 131 + i * 977 + j * 31) < .09 * P.spots) {
        cr = spot[0]; cg = spot[1]; cb = spot[2]; mm = 1;
      } else if (!kind && u > .35 && hash1(id * 53 + i * 613 + j * 7) < .0012) kind = 3; // dew drop
      mm *= tone * (pal.light ? 1.28 : 1);
      GC[k] = cr * mm; GC[k + 1] = cg * mm; GC[k + 2] = cb * mm;
      const oy = ly / headH;
      GO[m] = orderBase + orderSpan * (oy < 0 ? 0 : oy > 1 ? 1 : oy);
      GK[m] = kind;
    }
  }
  const phc = SPh[nu >> 1];
  const nl = [-Math.cos(phc) * ct, Math.sin(phc), -Math.cos(phc) * st];
  emitGrid(nu, nv, { tip: true, sides: true, ref: mv(M, nl), id, gloss: P.gloss });
}

// ---------------------------------------------------------------- stem
function bez(S, u) {
  const a = 1 - u, b0 = a * a * a, b1 = 3 * a * a * u, b2 = 3 * a * u * u, b3 = u * u * u;
  return [0, 1, 2].map(k => b0 * S.P0[k] + b1 * S.P1[k] + b2 * S.P2[k] + b3 * S.P3[k]);
}
function bezT(S, u) {
  const a = 1 - u;
  return norm([0, 1, 2].map(k => 3 * a * a * (S.P1[k] - S.P0[k]) + 6 * a * u * (S.P2[k] - S.P1[k]) + 3 * u * u * (S.P3[k] - S.P2[k])));
}
function stemFrame(S, u) {
  const p = bez(S, u), t = bezT(S, u);
  let n = cross(t, [0, 0, 1]); if (Math.hypot(...n) < 1e-3) n = cross(t, [1, 0, 0]);
  n = norm(n); const b = cross(t, n);
  return { p, t, n, b };
}

function emitStem(G, st, dens, cellRatio) {
  const S = G.stem, Rr = .03 * S.thick, gr = G.stemPal || G.green;
  const nu = clamp(Math.ceil(S.H * dens / cellRatio * 1.7), 20, 240) | 0;
  const nv = clamp(Math.ceil(TAU * Rr * 1.9 * dens * 1.7), 12, 80) | 0;
  let m = 0;
  for (let i = 0; i < nu; i++) {
    const u = i / (nu - 1), F = stemFrame(S, u);
    let rr = Rr * (1.15 - .3 * u) * (1 + .9 * sstep(.95, 1, u));
    if (G.nodes) for (const nu0 of G.nodes) rr *= 1 + .5 * Math.exp(-Math.pow((u - nu0) * 40, 2));
    const fade = .25 + .75 * sstep(0, .12, u);
    const c = mixc(mixc(gr.dark, gr.stem, sstep(0, .35, u)), gr.light, sstep(.75, 1, u) * .35);
    for (let j = 0; j < nv; j++, m++) {
      const a = j / nv * TAU, ca = Math.cos(a), sa = Math.sin(a), k = m * 3;
      GP[k] = F.p[0] + rr * (ca * F.n[0] + sa * F.b[0]);
      GP[k + 1] = F.p[1] + rr * (ca * F.n[1] + sa * F.b[1]);
      GP[k + 2] = F.p[2] + rr * (ca * F.n[2] + sa * F.b[2]);
      const ridge = .9 + .1 * Math.cos(a * 5);
      GC[k] = c[0] * fade * ridge; GC[k + 1] = c[1] * fade * ridge; GC[k + 2] = c[2] * fade * ridge;
      GO[m] = u; GK[m] = 5;
    }
  }
  emitGrid(nu, nv, { wrap: true, id: G.id * 3 + 1, gloss: .35 });
  // thorns
  for (const th of G.thorns) {
    const F = stemFrame(S, th.u), dir = norm(add(mul(F.n, Math.cos(th.a)), mul(F.b, Math.sin(th.a))));
    const base = add(F.p, mul(dir, Rr)), tipp = add(add(base, mul(dir, th.len)), mul(F.t, -th.len * .55));
    emitCurve(s => add(base, mul(sub(tipp, base), s)), th.col ? 2 : 5, th.col || [.45, .22, .12], th.u, th.u, 0, G.id + 991);
  }
}

// ---------------------------------------------------------------- leaves
function leafProfile(shape, u) {
  if (shape === 'heart') return Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(u, .55))), .6);
  if (shape === 'sword') return Math.min(1, u * 10) * (u < .82 ? 1 - .25 * u : (1 - u) / .18 * .8);
  if (shape === 'grass') return Math.min(1, u * 6) * (u < .7 ? 1 : (1 - u) / .3);
  if (shape === 'round') return Math.sqrt(Math.max(0, 1 - Math.pow(2 * u - 1, 2)));
  if (shape === 'lance') return Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(u, .7))), 1.2);
  return Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(u, .8))), .85);
}
function emitBlade(origin, dOut, len, W, elev, droop, fold, serr, teeth, shape, open, gr, orderBase, id, dens, time, gloss, roll, wave, ex) {
  ex = ex || {};
  const twist = ex.twist || 0, cupL = ex.cup || 0, tipD = ex.tipDroop || 0;
  // each leaf has its own shade, and younger leaves higher up are a little lighter
  const tint = 1 + (hash1(id * 7 + 3) - .5) * .24, young = .22 * clamp(orderBase);
  const nu = clamp(Math.ceil(len * dens * 1.35) + 4, 6, 96) | 0;
  let nv = clamp(Math.ceil(2 * W * dens * 1.25) + 3, 5, 71) | 0; if (nv % 2 === 0) nv++;
  const sc = lerp(.3, 1, open);
  len *= sc; W *= sc * lerp(.4, 1, open);
  fold = lerp(1.6, fold, open);
  const up = [0, 1, 0], lat = norm([dOut[2], 0, -dOut[0]]);
  const ds = len / (nu - 1);
  let p = origin.slice(), m = 0;
  const wind = .05 * Math.sin(time * 1.3 + id * .37);
  let midN = [0, 1, 0];
  for (let i = 0; i < nu; i++) {
    const u = i / (nu - 1);
    const ph = elev + droop * u * u + tipD * sstep(.55, 1, u) + wind * u;
    const sp = Math.sin(ph), cp = Math.cos(ph);
    const rl = (roll || 0) + twist * u, cr = Math.cos(rl), sr = Math.sin(rl);
    const dir = [sp * dOut[0], cp, sp * dOut[2]];
    const n0 = [-cp * dOut[0], sp, -cp * dOut[2]];
    const lt = [lat[0] * cr + n0[0] * sr, lat[1] * cr + n0[1] * sr, lat[2] * cr + n0[2] * sr];
    const nS = [n0[0] * cr - lat[0] * sr, n0[1] * cr - lat[1] * sr, n0[2] * cr - lat[2] * sr];
    if (i === nu >> 1) midN = nS;
    let hw = W * leafProfile(shape, u);
    if (serr > 0) hw *= 1 - serr * ((u * teeth) % 1) * sstep(.05, .2, u) * (1 - sstep(.85, 1, u));
    hw = Math.max(hw, W * .02);
    const c0 = mixc(gr.dark, gr.body, sstep(0, .4, u));
    for (let j = 0; j < nv; j++, m++) {
      const v = -1 + 2 * j / (nv - 1), av = Math.abs(v), k = m * 3;
      const o = av * hw * fold * .6 + cupL * hw * v * v + (wave || 0) * hw * av * Math.sin(u * 16 + id + v * 2);
      GP[k] = p[0] + lt[0] * v * hw + nS[0] * o;
      GP[k + 1] = p[1] + lt[1] * v * hw + nS[1] * o;
      GP[k + 2] = p[2] + lt[2] * v * hw + nS[2] * o;
      let c = c0, f = 1;
      if (av < .08) c = mixc(c0, gr.vein, .45);
      else if (shape !== 'grass' && shape !== 'sword' && ((u * 8 - av * .9) % 1 + 1) % 1 < .11 && u > .06) c = mixc(c0, gr.vein, .25);
      else if ((shape === 'grass' || shape === 'sword') && Math.abs(Math.sin(v * 9)) < .15) c = mixc(c0, gr.vein, .15);
      if (av > .9) c = mixc(c, gr.light, .25);
      c = mixc(c, gr.light, young);
      f *= (.85 + .15 * (1 - av)) * tint;
      GC[k] = c[0] * f; GC[k + 1] = c[1] * f; GC[k + 2] = c[2] * f;
      GO[m] = orderBase + u * .18; GK[m] = 0;
    }
    p = add(p, mul(dir, ds));
  }
  emitGrid(nu, nv, { tip: true, sides: true, ref: midN, id, gloss });
}

function emitLeaves(G, st, dens) {
  const gr = G.green;
  G.leaves.forEach((L, li) => {
    const open = smooth((st.head - L.u - .03) / .3);
    if (st.head < L.u - .02) return;
    const F = stemFrame(G.stem, L.u);
    const dOut = [Math.cos(L.psi), 0, Math.sin(L.psi)];
    const attach = add(F.p, mul(dOut, .02));
    const id = G.id * 17 + li * 1013;
    let base = attach;
    const pe = Math.max(.6, L.elev - .25);
    const pdir = norm([Math.sin(pe) * dOut[0], Math.cos(pe), Math.sin(pe) * dOut[2]]);
    if (L.petiole > 0) {
      const pl = L.petiole * lerp(.4, 1, open);
      const a = attach, droopV = [0, -pl * .25, 0];
      emitCurve(s => add(add(a, mul(pdir, pl * s)), mul(droopV, s * s)), Math.ceil(pl * dens * 1.4) + 2, mixc(gr.dark, gr.stem, .7), L.u, L.u + .05, 0, id + 7);
      base = add(add(a, mul(pdir, pl)), droopV);
    }
    if (L.pairs > 0) {
      // compound leaf: leaflet pairs along the rachis plus one at the end
      for (let k = 0; k < L.pairs; k++) {
        const s = (k + 1) / (L.pairs + 1);
        const pos = add(add(attach, mul(pdir, L.petiole * lerp(.4, 1, open) * (.35 + .65 * s))), [0, -L.petiole * .25 * s * s, 0]);
        for (const sgn of [-1, 1]) {
          const a = L.psi + sgn * 1.05;
          emitBlade(pos, [Math.cos(a), 0, Math.sin(a)], L.len * .8, L.W * .8, L.elev + .25, L.droop, L.fold, L.serr, L.teeth, L.shape,
            open, gr, L.u + .03, id + k * 97 + (sgn > 0 ? 50 : 0), dens, st.time, L.gloss, L.roll * .6, L.wave, L);
        }
      }
    }
    emitBlade(base, dOut, L.len, L.W, L.elev, L.droop, L.fold, L.serr, L.teeth, L.shape, open, gr, L.u + .03, id, dens, st.time, L.gloss, L.roll, L.wave, L);
  });
}

// ---------------------------------------------------------------- flower centers
function emitCenters(G, st, M, T, dens, open) {
  const tx = l => add(mv(M, l), T);
  G.centers.forEach((C, ci) => {
    const id = G.id * 23 + ci * 4099;
    const sc = .55 + .45 * sstep(.1, .7, open);
    if (C.kind === 'disk') {
      const rc = C.rc * sc, h = C.h * sc;
      const N = clamp(Math.round(Math.PI * rc * rc * dens * dens * 1.6), 30, 2600) | 0;
      for (let k = 0; k < N; k++) {
        const s = Math.sqrt((k + .5) / N), rr = rc * s, a = k * GOLDEN;
        const x = rr * Math.cos(a), z = rr * Math.sin(a);
        const y = C.y0 + h * (1 - s * s) + .01 * sc * hash1(id + k);
        const p = tx([x, y, z]), n = norm(mv(M, [2 * h * x / (rc * rc), 1, 2 * h * z / (rc * rc)]));
        const c = s < .45 ? mixc(C.c0, C.c1, s / .45) : mixc(C.c1, C.c2, (s - .45) / .55);
        const f = .75 + .4 * hash1(id + k * 3);
        push(p[0], p[1], p[2], n[0], n[1], n[2], c[0] * f, c[1] * f, c[2] * f, 0, 0, 0, 1.3 + .2 * s, 0, 1, hash1(id + k * 7), 0, .25);
      }
    } else if (C.kind === 'pod') {
      const rp = C.rp * sc, hp = C.hp * sc;
      const N = clamp(Math.round(Math.PI * rp * rp * dens * dens * 1.6), 30, 1600) | 0;
      const seeds = [];
      for (let k = 0; k < 15; k++) { const s = k === 0 ? 0 : (k < 6 ? .45 : .8), a = k * TAU / (k < 6 ? 5 : 9); seeds.push([s * rp * Math.cos(a), s * rp * Math.sin(a)]); }
      for (let k = 0; k < N; k++) {
        const s = Math.sqrt((k + .5) / N), rr = rp * s, a = k * GOLDEN, x = rr * Math.cos(a), z = rr * Math.sin(a);
        let isSeed = false;
        if (C.rays) isSeed = s > .15 && Math.cos(a * 0 + Math.atan2(z, x) * C.rays) > .82;
        else for (const q of seeds) if (Math.hypot(x - q[0], z - q[1]) < rp * .11) isSeed = true;
        const p = tx([x, C.y0 + hp, z]), n = mv(M, [0, 1, 0]), c = isSeed ? C.seed : C.c;
        push(p[0], p[1], p[2], n[0], n[1], n[2], c[0], c[1], c[2], 0, 0, 0, 1.35, 0, isSeed ? 1 : 0, hash1(id + k), 0, .3);
      }
      const nu = 6, nv = 16; let m = 0;
      for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++, m++) {
        const u = i / (nu - 1), a = j / nv * TAU, rr = rp * lerp(.65, 1, u), k = m * 3;
        const p = tx([rr * Math.cos(a), C.y0 + hp * u, rr * Math.sin(a)]);
        GP[k] = p[0]; GP[k + 1] = p[1]; GP[k + 2] = p[2];
        GC[k] = C.c[0] * .8; GC[k + 1] = C.c[1] * .8; GC[k + 2] = C.c[2] * .8; GO[m] = 1.33; GK[m] = 0;
      }
      emitGrid(nu, nv, { wrap: true, id: id + 5, gloss: .3 });
    } else if (C.kind === 'column') {
      const L = C.len * sc, bend = .25;
      const fn = s => tx([Math.sin(s * bend) * L * .15, C.y0 + L * s, 0]);
      const nseg = Math.max(4, Math.ceil(L * dens * 1.6));
      emitCurve(fn, nseg, C.c, 1.3, 1.45, 0, id + 3);
      const nn = mv(M, [0, 1, 0]);
      for (let k = 0; k < 46; k++) { // pollen-laden anthers on short stalks along the top
        const s = lerp(.5, .9, hash1(id + k * 11)), a = k * GOLDEN, p0 = fn(s);
        const o = mv(M, [Math.cos(a) * .025 * sc, .004, Math.sin(a) * .025 * sc]);
        push(p0[0] + o[0], p0[1] + o[1], p0[2] + o[2], nn[0], nn[1], nn[2], C.anth[0], C.anth[1], C.anth[2], 0, 0, 0, 1.45, 0, 2, hash1(id + k), 0, .3);
      }
      const e = fn(1);
      for (let q = 0; q < 5; q++) { // five stigma pads
        const a = q * TAU / 5;
        for (let r = 0; r < 3; r++) {
          const o = mv(M, [Math.cos(a) * .018 * (r + 1) * sc, .012 * r * sc, Math.sin(a) * .018 * (r + 1) * sc]);
          push(e[0] + o[0], e[1] + o[1], e[2] + o[2], nn[0], nn[1], nn[2], C.stig[0], C.stig[1], C.stig[2], o[0], o[1], o[2], 1.45, r < 2 ? 1 : 0, r === 2 ? 2 : 0, hash1(id + q * 7 + r), 0, .3);
        }
      }
    } else if (C.kind === 'stamens' || C.kind === 'ring') {
      const ring = C.kind === 'ring';
      const n = C.n;
      for (let k = 0; k < n; k++) {
        const a = k * (ring ? GOLDEN : TAU / n) + .3, ca = Math.cos(a), sa = Math.sin(a);
        const L = C.len * sc * (ring ? .75 + .5 * hash1(id + k) : 1);
        const r0 = ring ? C.r * (.8 + .4 * hash1(id + k * 5)) : .02;
        const spread = ring ? L * .5 : C.spread * sc;
        const fn = s => tx([(r0 + spread * s) * ca, C.y0 + L * (ring ? s : C.rise * Math.sin(s * Math.PI / 2)), (r0 + spread * s) * sa]);
        const nseg = Math.max(2, Math.ceil(L * dens * 1.4));
        emitCurve(fn, nseg, C.fil, 1.35, 1.45, 0, id + k * 31);
        const e = fn(1), nn = mv(M, [0, 1, 0]);
        for (let q = 0; q < 3; q++) {
          const ofs = mv(M, [ca * .008 * (q - 1), .006 * q, sa * .008 * (q - 1)]);
          push(e[0] + ofs[0], e[1] + ofs[1], e[2] + ofs[2], nn[0], nn[1], nn[2], C.anth[0], C.anth[1], C.anth[2], 0, 0, 0, 1.45, 0, 2, hash1(id + k * 3 + q), 0, .3);
        }
      }
      if (C.pistil) {
        const L = C.len * sc * 1.1;
        const fn = s => tx([.012 * s, C.y0 + L * s, 0]);
        emitCurve(fn, Math.max(3, Math.ceil(L * dens * 1.4)), C.pistil, 1.35, 1.45, 0, id + 777);
        const e = fn(1), nn = mv(M, [0, 1, 0]);
        for (let q = 0; q < 3; q++) {
          const a = q * TAU / 3, ofs = mv(M, [Math.cos(a) * .012, .004, Math.sin(a) * .012]);
          push(e[0] + ofs[0], e[1] + ofs[1], e[2] + ofs[2], nn[0], nn[1], nn[2], C.pistil[0], C.pistil[1], C.pistil[2], 0, 0, 0, 1.45, 0, 2, hash1(id + q), 0, .3);
        }
      }
    }
  });
}

function headMatrix(G, time, settle) {
  const nod = .035 * Math.sin(time * .9) * settle;
  return mmul(rotY(G.head.az), mmul(rotX(G.head.tilt + nod), rotY(G.head.spin)));
}

function emitHead(G, st, dens, local) {
  if (st.head < 1.0) return;
  const M = local ? [1, 0, 0, 0, 1, 0, 0, 0, 1] : headMatrix(G, st.time, st.settle), T = local ? [0, 0, 0] : G.stem.P3;
  if (G.sepals) {
    const P = G.sepals, open = smooth(clamp(st.bloom * 1.6));
    for (let k = 0; k < P.count; k++) {
      const th = P.rot + k * TAU / P.count;
      emitPetal(P, open, th, M, T, G.sepalPal, 1.0, .08, G.headH, G.id * 31 + k * 211 + 5, dens, 1);
    }
  }
  const grow = lerp(.6, 1, sstep(0, .65, st.bloom));
  G.layers.forEach((P, l) => {
    const o = clamp((st.bloom - P.delay) / (1 - P.delay));
    const open0 = (.5 * o + .5 * smooth(o)) * P.openMax * st.breathe;
    for (let k = 0; k < P.count; k++) {
      const hid = G.id * 1009 + l * 101 + k;
      const jt = (hash1(hid) - .5) * P.jit, jl = 1 + (hash1(hid + 9) - .5) * .12, jo = (hash1(hid + 17) - .5) * .14;
      const th = P.rot + k * TAU / P.count + jt;
      emitPetal(P, clamp(open0 * (1 + jo)), th, M, T, G.pal, 1.08, .42, G.headH, hid, dens, jl * grow);
    }
  });
  emitCenters(G, st, M, T, dens, st.bloom);
}

function pushHeadCache(G, M, T) {
  const C = G.headCache, n = C.length / STRIDE;
  if (NP + n > MAXP) return;
  const m0 = M[0], m1 = M[1], m2 = M[2], m3 = M[3], m4 = M[4], m5 = M[5], m6 = M[6], m7 = M[7], m8 = M[8];
  let o = NP * STRIDE;
  BUF.set(C, o);
  for (let i = 0; i < n; i++, o += STRIDE) {
    let x = BUF[o], y = BUF[o + 1], z = BUF[o + 2];
    BUF[o] = m0 * x + m1 * y + m2 * z + T[0]; BUF[o + 1] = m3 * x + m4 * y + m5 * z + T[1]; BUF[o + 2] = m6 * x + m7 * y + m8 * z + T[2];
    x = BUF[o + 3]; y = BUF[o + 4]; z = BUF[o + 5];
    BUF[o + 3] = m0 * x + m1 * y + m2 * z; BUF[o + 4] = m3 * x + m4 * y + m5 * z; BUF[o + 5] = m6 * x + m7 * y + m8 * z;
    x = BUF[o + 9]; y = BUF[o + 10]; z = BUF[o + 11];
    if (x !== 0 || y !== 0 || z !== 0) { BUF[o + 9] = m0 * x + m1 * y + m2 * z; BUF[o + 10] = m3 * x + m4 * y + m5 * z; BUF[o + 11] = m6 * x + m7 * y + m8 * z; }
  }
  NP += n;
}

// a loose petal drifting down after full bloom
function emitFalling(f, G, dens) {
  const M = mmul(rotY(f.ay), mmul(rotX(f.ax), rotZ(f.az)));
  const P = f.P;
  emitPetal(P, 1, 0, M, f.p, G.pal, -1, 0, 1, f.id, dens, 1);
}

// ============================================================ sky
// stars live on the same character grid as the flower, like a terminal
function makeSky(seed) {
  const R = new RNG('sky' + seed);
  const { cols, rows } = view, n = cols * rows;
  const stars = [], used = new Set();
  const put = (c, r, k) => {
    if (c < 0 || r < 0 || c >= cols || r >= rows) return;
    const id = r * cols + c; if (used.has(id)) return; used.add(id);
    stars.push({ c, r, k, a: k === 0 ? R.range(.18, .4) : k === 1 ? R.range(.5, .9) : 1,
      sp: k === 2 ? R.range(.9, 4.2) : R.range(3, 7.5), ph: R.range(0, TAU), cool: R.range(0, 1) });
  };
  const nFaint = Math.round(n * .011), nPlus = Math.round(n * .0055), nBright = Math.round(n * .0022);
  for (let i = 0; i < nFaint; i++) put(R.int(0, cols - 1), R.int(0, rows - 1), 0);
  for (let i = 0; i < nPlus; i++) {
    const c = R.int(0, cols - 1), r = R.int(0, rows - 1); put(c, r, 1);
    if (R.chance(.18)) put(c + R.pick([1, 2]), r, 1);
  }
  for (let i = 0; i < nBright; i++) {
    const c = R.int(0, cols - 1), r = R.int(0, rows - 1); put(c, r, 2);
    if (R.chance(.3)) { if (R.chance(.5)) put(c + 1, r, 2); else put(c, r + R.pick([1, 2]), R.pick([1, 2])); }
  }
  return { stars, flares: [], nextFlare: R.range(.4, 1.2), R };
}

// ============================================================ app
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const fg = document.createElement('canvas'), fctx = fg.getContext('2d');
const g1 = document.createElement('canvas'), g1x = g1.getContext('2d');
const g2 = document.createElement('canvas'), g2x = g2.getContext('2d');

const RAMP = 'ivrtxzcjfunoaeQ0$8B%&#@';
const DISK = 'o0@*Oo';
const ANTH = '@0o';
const STEMR = 'ijl10O8%Q$8B';
const BEARD = "\";:'^~,";
const PITCH = .2;
const SPARK = ['+', '+', '.', '·', "'", '+'];
const FONT = 'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, "DejaVu Sans Mono", "Liberation Mono", monospace';
const D = 7;            // camera distance in world units
const DRAW0 = .5, DRAW1 = 5.2, O_MAX = 1.56, GHOST = .3;
const BLOOM0 = 4.4, TURN0 = 6.5;

const params = new URLSearchParams(location.search);
const view = { w: 0, h: 0, dpr: 1, cellW: 6, cellH: 10, cols: 0, rows: 0, font: 10, detail: 1, S: 100, cx: 0, cy: 0, yMid: 1 };
let zb, win, ghost;
let G = null, sky = null;
let T = +(params.get('t') || 0), paused = false, glowOn = params.get('glow') !== '0', hudOn = params.get('hud') !== '0';
let yaw = 0, yawUser = 0, fade = 0, pending = null, skyLevel = 0, densScale = 1, quality = 0, slowFor = 0;
let parts = [], falls = [], fallTimer = 3, letters = 0, fps = 60, fpsAcc = 0, fpsN = 0;
const fit = { R: 1, ymin: 0, ymax: 3 };

function newSeed() { return Math.floor(Math.random() * 2176782336).toString(36).padStart(6, '0'); }

function resize() {
  const w = window.innerWidth, h = window.innerHeight, dpr = Math.min(window.devicePixelRatio || 1, w * h > 900000 ? 1.5 : 2, [3, 1.5, 1][quality]);
  Object.assign(view, { w, h, dpr });
  for (const c of [canvas, fg]) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  g1.width = Math.max(1, Math.round(w / 4)); g1.height = Math.max(1, Math.round(h / 4));
  g2.width = Math.max(1, Math.round(w / 12)); g2.height = Math.max(1, Math.round(h / 12));
  const portrait = h > w;
  view.cellH = clamp(h / (portrait ? 130 : 102), 6, 15) / view.detail;
  view.cellW = view.cellH / 1.72;
  view.cols = Math.ceil(w / view.cellW); view.rows = Math.ceil(h / view.cellH);
  view.font = Math.min(view.cellW / .6, view.cellH * .95);
  const n = view.cols * view.rows;
  zb = new Float32Array(n); win = new Int32Array(n); ghost = new Float32Array(n);
  prevCls = new Int8Array(n); prevRi = new Int8Array(n); prevKind = new Int8Array(n); curCls = new Int8Array(n); curRi = new Int8Array(n); curKind = new Int8Array(n);
  cellChar.length = 0; prevChar.length = 0;
  if (G) { sky = makeSky(G.skySeed); computeView(); G.headCache = null; }
}

function computeFit(G) {
  const st = { head: 9, bloom: 1, breathe: 1, time: 0, settle: 0 };
  NP = 0;
  emitStem(G, st, 10, 1); emitLeaves(G, st, 10);
  const nPlant = NP;
  emitHead(G, st, 10);
  let R = 0, Rh = 0, ymin = 1e9, ymax = -1e9;
  for (let p = 0; p < NP; p++) {
    const o = p * STRIDE, x = BUF[o] - G.pivot[0], z = BUF[o + 2] - G.pivot[2], y = BUF[o + 1], r = Math.hypot(x, z);
    R = Math.max(R, r); if (p >= nPlant) Rh = Math.max(Rh, r);
    ymin = Math.min(ymin, y); ymax = Math.max(ymax, y);
  }
  Object.assign(fit, { R: Math.max(Rh * 1.05, R * .8), ymin, ymax });
}

function computeView() {
  const portrait = view.h > view.w;
  const availH = view.h * (portrait ? .72 : .8), availW = view.w * .9;
  const persp = D / (D - fit.R);
  view.S = Math.min(availW / (2 * fit.R * persp), availH / ((fit.ymax - fit.ymin) * persp));
  view.cx = view.w / 2; view.cy = view.h * (portrait ? .47 : .5);
  view.yMid = (fit.ymin + fit.ymax) / 2;
}

function setFlower(seed) {
  G = makeGenome(seed);
  computeFit(G); computeView();
  sky = makeSky(G.skySeed);
  parts = []; gsparks = []; falls = []; fallTimer = 3; yaw = 0; yawUser = 0; densScale = 1; G.headCache = null;
  const url = new URL(location.href); url.searchParams.set('seed', seed); url.searchParams.delete('t');
  try { history.replaceState(null, '', url); } catch (e) { /* sandboxed */ }
  document.getElementById('name').textContent = G.name;
}

function regrow(seed) { if (!pending) { pending = seed || newSeed(); fade = 1; } }

// project a model point to the screen
let viewM = rotY(0);
function project(p, isModel = true) {
  let x = p[0], y = p[1], z = p[2];
  if (isModel) { x -= G.pivot[0]; z -= G.pivot[2]; const q = mv(viewM, [x, y, z]); x = q[0]; y = q[1]; z = q[2]; }
  const ps = D / (D - z);
  return [view.cx + x * view.S * ps, view.cy - (y - view.yMid) * view.S * ps, z];
}

const colorCache = new Map();
function colorStr(q) {
  let s = colorCache.get(q);
  if (!s) { s = `rgb(${((q >> 10) & 31) * 8 + 4},${((q >> 5) & 31) * 8 + 4},${(q & 31) * 8 + 4})`; colorCache.set(q, s); }
  return s;
}

const LK = norm([-.35, .85, .65]), HK = norm(add(LK, [0, 0, 1]));
const buckets = new Map();
const cellChar = [], prevChar = [];
const FILLI = new Int32Array(30000), FILLZ = new Float32Array(10000);
const FRESH = new Int32Array(4000); let nFresh = 0;
let gsparks = [];
let prevCls = new Int8Array(0), prevRi = new Int8Array(0), prevKind = new Int8Array(0), curCls = new Int8Array(0), curRi = new Int8Array(0), curKind = new Int8Array(0);
let flickN = 0, flickAvg = 0;

function frame(now) {
  const dt = Math.min(.05, (now - (frame.last || now)) / 1000); frame.last = now;
  fpsAcc += dt; fpsN++;
  if (fpsAcc > .5) {
    fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0;
    // if the device cannot keep up, lower the pixel density one step at a time
    slowFor = fps < 42 && !document.hidden ? slowFor + 1 : 0;
    if (slowFor >= 4 && quality < 2) { quality++; slowFor = 0; resize(); }
  }
  if (!paused) T += dt;

  if (pending) {
    fade -= dt * 2.6;
    if (fade <= 0) { setFlower(pending); pending = null; T = 0; fade = 0; }
  }
  const alpha = pending ? Math.max(0, fade) : 1;

  // timeline
  const head = O_MAX * clamp((T - DRAW0) / (DRAW1 - DRAW0)) + (T > DRAW1 ? 1 : 0);
  const bx = clamp((T - BLOOM0) / G.bloomDur);
  const bloom = 1 - Math.pow(1 - bx, 1.7);
  skyLevel = sstep(0, .9, bloom);
  const bloomEnd = BLOOM0 + G.bloomDur;
  const settle = sstep(bloomEnd - 1, bloomEnd + 2, T);
  const breathe = 1;
  if (!paused) yaw += dt * .3 * sstep(TURN0, TURN0 + 4, T);
  const sway = .05 * Math.sin(T * .55) * sstep(DRAW1, DRAW1 + 3, T);
  viewM = mmul(rotX(PITCH), mmul(rotZ(sway), rotY(yaw + yawUser)));
  const st = { head, bloom, breathe, time: T, settle };
  {
    const amp = .035 * G.stem.H * sstep(DRAW0, DRAW1, T), ph = G.windPh;
    const wx = amp * (Math.sin(T * .8 + ph) + .35 * Math.sin(T * 1.9 + ph * 2)), wz = amp * .6 * Math.sin(T * .63 + ph * 1.3);
    const B = G.stemBase;
    G.stem.P1 = [B.P1[0] + wx * .25, B.P1[1], B.P1[2] + wz * .25];
    G.stem.P2 = [B.P2[0] + wx * .7, B.P2[1], B.P2[2] + wz * .7];
    G.stem.P3 = [B.P3[0] + wx, B.P3[1] - Math.abs(wx) * .05, B.P3[2] + wz];
  }

  // build geometry
  const dens0 = view.S / view.cellW, dens = dens0 * densScale;
  NP = 0;
  emitStem(G, st, dens0, view.cellH / view.cellW);
  emitLeaves(G, st, dens0);
  if (bx >= 1 && st.head >= 1) {
    // fully open: the head no longer changes shape, so build it once and reuse it
    if (!G.headCache || G.headCacheDens !== dens) {
      const a = NP;
      emitHead(G, st, dens, true);
      G.headCache = BUF.slice(a * STRIDE, NP * STRIDE); G.headCacheDens = dens;
      NP = a;
    }
    pushHeadCache(G, headMatrix(G, st.time, st.settle), G.stem.P3);
  } else emitHead(G, st, dens);
  NMODEL = NP;

  // falling petals
  if (!paused && bloom > .99 && G.type !== 'tulip' && T > bloomEnd + 1.5) {
    fallTimer -= dt;
    if (fallTimer <= 0) {
      fallTimer = 4 + Math.random() * 6;
      const outer = G.layers[G.layers.length - 1];
      const a = Math.random() * TAU, rr = outer.len * .7;
      const hc = mv(viewM, sub(G.stem.P3, G.pivot));
      falls.push({ p: [hc[0] + Math.cos(a) * rr, hc[1] + .05, hc[2] + Math.sin(a) * rr], v: [0, 0, 0],
        ax: Math.random() * TAU, ay: Math.random() * TAU, az: Math.random() * TAU,
        sx: (Math.random() - .5) * 2, sy: (Math.random() - .5) * 2, sz: (Math.random() - .5) * 2, ph: Math.random() * TAU,
        id: (Math.random() * 1e6) | 0,
        P: basePetal({ len: Math.min(.22, outer.len * .45), W: Math.min(.1, outer.W * .45), r0: 0, y0: 0, phO0: .2, phO1: .9, curl: .3,
          cupO: .7, wrap: 0, wk: outer.wk, we: outer.we, veins: 5, ruffle: .03 }) });
    }
  }
  for (const f of falls) {
    if (!paused) {
      f.v[1] = Math.max(f.v[1] - dt * .35, -.32);
      f.v[0] = .12 * Math.sin(T * .7 + f.ph); f.v[2] = .06 * Math.cos(T * .5 + f.ph);
      f.p = add(f.p, mul(f.v, dt));
      f.ax += f.sx * dt; f.ay += f.sy * dt; f.az += f.sz * dt;
    }
    emitFalling(f, G, dens);
  }
  falls = falls.filter(f => f.p[1] > fit.ymin - .4);
  // keep the point count near the budget: dense flowers get thinner sampling, sparse ones full detail
  const budget = 42000;
  if (NP > budget * 1.1 && densScale > .7) densScale = Math.max(.7, Math.floor(densScale * Math.sqrt(budget / NP) * 20) / 20);

  // splat into the character grid
  const { cols, rows, cellW, cellH, S, cx, cy, yMid } = view;
  zb.fill(-1e9); win.fill(-1); ghost.fill(9);
  let bx0 = cols, bx1 = -1, by0 = rows, by1 = -1;
  const V = viewM, px = G.pivot[0], pz = G.pivot[2];
  for (let p = 0; p < NP; p++) {
    const o = p * STRIDE, ord = BUF[o + 12];
    let x = BUF[o], y = BUF[o + 1], z = BUF[o + 2], qx, qy, qz;
    if (p < NMODEL) {
      x -= px; z -= pz;
      qx = V[0] * x + V[1] * y + V[2] * z; qy = V[3] * x + V[4] * y + V[5] * z; qz = V[6] * x + V[7] * y + V[8] * z;
    } else { qx = x; qy = y; qz = z; }
    const ps = D / (D - qz), sx = cx + qx * S * ps, sy = cy - (qy - yMid) * S * ps;
    if (sx < 0 || sy < 0) continue;
    const c = (sx / cellW) | 0, r = (sy / cellH) | 0;
    if (c >= cols || r >= rows) continue;
    const idx = r * cols + c;
    if (ord > head) {
      const d = ord - head;
      continue;
    }
    if (qz > zb[idx]) { zb[idx] = qz; win[idx] = p; if (c < bx0) bx0 = c; if (c > bx1) bx1 = c; if (r < by0) by0 = r; if (r > by1) by1 = r; }
  }

  // fill pinholes: an empty cell between two filled cells at about the same depth (inside the flower's box only)
  {
    const r0 = Math.max(1, by0), r1 = Math.min(rows - 2, by1), c0 = Math.max(1, bx0), c1 = Math.min(cols - 2, bx1);
    let nf = 0;
    for (let pass = 0; pass < 2; pass++) {
      nf = 0;
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
        const idx = r * cols + c;
        if (win[idx] >= 0) continue;
        for (let q = 0; q < 4; q++) {
          const d = q === 0 ? 1 : q === 1 ? cols : q === 2 ? cols + 1 : cols - 1;
          const a = idx - d, b = idx + d;
          if (win[a] >= 0 && win[b] >= 0 && Math.abs(zb[a] - zb[b]) < .08) {
            const k = nf * 3; FILLI[k] = idx; FILLI[k + 1] = zb[a] > zb[b] ? a : b; FILLZ[nf] = (zb[a] + zb[b]) * .5; nf++; break;
          }
        }
        if (nf * 3 + 3 >= FILLI.length) break;
      }
      for (let i = 0; i < nf; i++) { const k = i * 3; win[FILLI[k]] = win[FILLI[k + 1]]; zb[FILLI[k]] = FILLZ[i]; }
    }
  }

  // shade cells and choose glyphs
  buckets.clear();
  nFresh = 0;
  letters = 0; flickN = 0;
  if (prevChar.length !== cellChar.length) prevChar.length = cellChar.length;
  for (let i = 0; i < cellChar.length; i++) prevChar[i] = cellChar[i];
  { const t = prevCls; prevCls = curCls; curCls = t; const t2 = prevRi; prevRi = curRi; curRi = t2; const t3 = prevKind; prevKind = curKind; curKind = t3; curCls.fill(0); }
  const zr = fit.R + .2;
  const scanAll = head < O_MAX + .05;
  const sr0 = scanAll ? 0 : Math.max(0, by0), sr1 = scanAll ? rows - 1 : Math.min(rows - 1, by1);
  for (let idx = sr0 * cols, n = (sr1 + 1) * cols; idx < n; idx++) {
    const p = win[idx];
    if (p < 0) {
      if (ghost[idx] < 9) {
        const d = ghost[idx] / GHOST, a = (1 - d) * .55;
        const q = (Math.round(31 * a) << 10) | (Math.round(31 * a) << 5) | Math.round(31 * a * 1.05 > 31 ? 31 : 31 * a * 1.05);
        cellChar[idx] = d < .3 ? '+' : '.';
        addBucket(q, idx);
      }
      continue;
    }
    const o = p * STRIDE, model = p < NMODEL;
    let nx = BUF[o + 3], ny = BUF[o + 4], nz = BUF[o + 5];
    if (model) { const a = nx, b = ny, c = nz; nx = V[0] * a + V[1] * b + V[2] * c; ny = V[3] * a + V[4] * b + V[5] * c; nz = V[6] * a + V[7] * b + V[8] * c; }
    const facing = nz >= 0 ? 1 : -1;
    if (nz < 0) { nx = -nx; ny = -ny; nz = -nz; }
    const dl = nx * LK[0] + ny * LK[1] + nz * LK[2], diff = Math.max(0, dl);
    const trans = BUF[o + 16] !== 0 ? Math.max(0, -dl) * .3 : 0; // thin petals and leaves glow when backlit
    const lum = .2 + .8 * diff + trans;
    const rim = Math.pow(1 - nz, 3) * .45;
    const spec = BUF[o + 17] * Math.pow(Math.max(0, nx * HK[0] + ny * HK[1] + nz * HK[2]), 24);
    let r = BUF[o + 6], g = BUF[o + 7], b = BUF[o + 8];
    const side = BUF[o + 16];
    if (side !== 0 && side * facing < 0) { r *= .78; g *= .78; b *= .8; }
    const depth = .72 + .28 * clamp((zb[idx] + zr) / (2 * zr));
    const k = (.36 + 1.0 * lum) * depth;
    r = r * k + r * rim * .6 + spec; g = g * k + g * rim * .6 + spec; b = b * k + b * rim * .6 + spec;
    const h = BUF[o + 15], kind = BUF[o + 14], ord = BUF[o + 12];
    let ch;
    const fresh = head < 9 && head - ord < .035 && ord <= head;
    const pcl = prevCls[idx], pch = prevChar[idx];
    let cls = 3;
    if (kind === 3) {
      const tw = .55 + .45 * Math.sin(T * 5 + h * 40);
      r = lerp(r, 1, .55 * tw); g = lerp(g, 1, .55 * tw); b = lerp(b, 1, .55 * tw); ch = '+';
    } else if (kind === 1 || kind === 2 || kind === 6) {
      if (pcl === 3 && prevKind[idx] === kind) ch = pch;
      else ch = kind === 1 ? DISK[(h * DISK.length) | 0] : kind === 2 ? ANTH[(h * ANTH.length) | 0] : BEARD[(h * BEARD.length) | 0];
    } else {
      const was = pcl === 2;
      let isStroke = false, tx = 0, ty = 0;
      if (BUF[o + 13] > 0) {
        const a = BUF[o + 9], bb = BUF[o + 10], c = BUF[o + 11];
        if (model) { tx = V[0] * a + V[1] * bb + V[2] * c; ty = V[3] * a + V[4] * bb + V[5] * c; } else { tx = a; ty = bb; }
        isStroke = true;
      } else if (nz < (kind === 5 ? (was ? .55 : .45) : (was ? .28 : .2))) { tx = -ny; ty = nx; isStroke = true; }
      // outer outline: any stroke. inside the flower: diagonal and vertical strokes keep edges crisp,
      // but a horizontal rim becomes a bright line of dense letters instead of a row of dashes
      let rim = false;
      if (isStroke) {
        const c0 = idx % cols;
        const open = (c0 > 0 && win[idx - 1] < 0) || (c0 < cols - 1 && win[idx + 1] < 0) ||
          (idx >= cols && win[idx - cols] < 0) || (idx + cols < cols * rows && win[idx + cols] < 0);
        if (!open && Math.atan2(Math.abs(ty), Math.abs(tx)) < .45) { isStroke = false; rim = true; }
      }
      if (isStroke) {
        cls = 2;
        const dx = tx, dy = -ty, ang = Math.atan2(Math.abs(dy), Math.abs(dx));
        if (ang < .42) ch = (idx + cols < cols * rows && win[idx + cols] < 0) ? '_' : '-';
        else if (ang > 1.2) ch = '|';
        else ch = dx * dy < 0 ? '/' : '\\';
        // near a bin edge, keep last frame's stroke so it does not flutter
        if (was && ch !== pch && (Math.abs(ang - .42) < .12 || Math.abs(ang - 1.2) < .12)) ch = pch;
        r *= 1.08; g *= 1.08; b *= 1.08;
      } else {
        cls = 1;
        const ramp = kind === 5 ? STEMR : RAMP;
        const lv = clamp(kind === 5 ? lum * .95 + spec * .5 + (h - .5) * .08 : lum * .9 + spec * .6 + (h - .5) * .14);
        let ri = Math.round(lv * (ramp.length - 1));
        if (rim) { ri = Math.max(ri, Math.round((ramp.length - 1) * .72)); r *= 1.22; g *= 1.22; b *= 1.22; }
        if (pcl === 1 && prevKind[idx] === kind && Math.abs(ri - prevRi[idx]) <= 1) ri = prevRi[idx];
        curRi[idx] = ri;
        ch = ramp[ri];
      }
    }
    curCls[idx] = cls; curKind[idx] = kind;
    if (fresh && nFresh < FRESH.length) FRESH[nFresh++] = idx;
    if (fresh) { r = lerp(r, 1, .38); g = lerp(g, 1, .38); b = lerp(b, 1, .38); }
    r = clamp(r); g = clamp(g); b = clamp(b);
    if (prevChar[idx] !== ch) flickN++;
    cellChar[idx] = ch;
    addBucket((Math.round(r * 31) << 10) | (Math.round(g * 31) << 5) | Math.round(b * 31), idx);
    letters++;
  }

  flickAvg = flickAvg * .9 + .1 * (letters ? flickN / letters : 0);
  // particles
  updateParticles(dt, head, bloom, st);

  // ---------------- draw
  const dpr = view.dpr;
  fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  fctx.clearRect(0, 0, view.w, view.h);
  const skyA = skyLevel * alpha;
  drawSky(fctx, T, skyA, dt);
  fctx.globalAlpha = alpha;
  fctx.font = `${view.font.toFixed(2)}px ${FONT}`;
  fctx.textBaseline = 'top';
  const yo = (cellH - view.font) * .5;
  for (const [q, list] of buckets) {
    fctx.fillStyle = colorStr(q);
    for (let i = 0; i < list.length; i++) {
      const idx = list[i];
      fctx.fillText(cellChar[idx], (idx % cols) * cellW, ((idx / cols) | 0) * cellH + yo);
    }
  }
  fctx.fillStyle = '#fff';
  for (const g of gsparks) {
    const r = g.r - Math.round(g.y), cc = g.c + Math.round(g.x || 0);
    if (cc < 0 || r < 0 || cc >= cols || r >= rows || win[r * cols + cc] >= 0) continue;
    if (g.life < 0) continue;
    const k = g.life / g.max, a = alpha * g.a * (k < .15 ? k / .15 : Math.pow(1 - (k - .15) / .85, 1.3));
    if (a < .03) continue;
    fctx.globalAlpha = a;
    fctx.fillText(g.ch, cc * cellW, r * cellH + yo - (g.ch === '.' ? cellH * .25 : 0));
  }
  fctx.globalAlpha = 1;
  drawParticles(fctx, alpha);
  fctx.globalAlpha = 1;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(fg, 0, 0);
  if (glowOn) {
    g1x.clearRect(0, 0, g1.width, g1.height); g1x.drawImage(fg, 0, 0, g1.width, g1.height);
    g2x.clearRect(0, 0, g2.width, g2.height); g2x.drawImage(g1, 0, 0, g2.width, g2.height);
    ctx.globalCompositeOperation = 'lighter';
    ctx.imageSmoothingEnabled = true;
    ctx.globalAlpha = .7; ctx.drawImage(g1, 0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = .45; ctx.drawImage(g2, 0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }

  requestAnimationFrame(frame);
}

function addBucket(q, idx) {
  let l = buckets.get(q);
  if (!l) { l = []; buckets.set(q, l); }
  l.push(idx);
}

// ---------------------------------------------------------------- sky drawing
function cellFree(c, r) {
  if (c < 0 || r < 0 || c >= view.cols || r >= view.rows) return false;
  return win[r * view.cols + c] < 0;
}
function drawSky(c, t, A, dt) {
  if (A <= 0) return;
  const { cellW, cellH, font } = view, yo = (cellH - font) * .5;
  c.font = `${font.toFixed(2)}px ${FONT}`;
  c.textBaseline = 'top';
  for (const s of sky.stars) {
    const phase = t * s.sp + s.ph;
    // each dark point of the twinkle is a new appearance: move the star to a fresh random cell
    const cyc = Math.floor((phase + Math.PI / 2) / TAU);
    if (s.cyc === undefined) s.cyc = cyc;
    else if (cyc !== s.cyc) {
      s.cyc = cyc;
      s.c = (Math.random() * view.cols) | 0; s.r = (Math.random() * view.rows) | 0;
    }
    if (!cellFree(s.c, s.r)) continue;
    const tw = .5 + .5 * Math.sin(phase);
    const a = A * s.a * (s.k === 1 ? tw * tw * tw : tw * tw);
    if (a < .03) continue;
    const x = s.c * cellW, y = s.r * cellH;
    c.globalAlpha = a;
    c.fillStyle = s.style || (s.style = `rgb(${(225 + 30 * (1 - s.cool)) | 0},${(225 + 30 * (1 - s.cool)) | 0},255)`);
    if (s.k === 0) c.fillText('.', x, y + yo - cellH * .25);
    else if (s.k === 1) c.fillText('+', x, y + yo);
    else { c.fillStyle = '#fff'; c.fillText('+', x, y + yo); }
  }
  // flare stars flash up around the plant and fade away
  if (!paused) {
    sky.nextFlare -= dt;
    if (sky.nextFlare <= 0 && skyLevel > .05) {
      sky.nextFlare = sky.R.range(.04, .16) / Math.max(.25, skyLevel);
      if (sky.flares.length < 10) {
        const top = project([G.pivot[0], fit.ymax, G.pivot[2]]), bot = project([G.pivot[0], fit.ymin, G.pivot[2]]);
        const rad = fit.R * view.S * 1.6;
        const x = view.cx + (sky.R.next() - .5) * 2 * rad, y = lerp(top[1] - cellH * 4, bot[1], sky.R.next());
        sky.flares.push({ c: Math.floor(x / cellW), r: Math.floor(y / cellH), life: 0, max: sky.R.range(.5, 1),
          L: sky.R.int(3, 6), D: sky.R.int(1, 3), H: sky.R.int(3, 5) });
      }
    }
    for (const f of sky.flares) f.life += dt;
    sky.flares = sky.flares.filter(f => f.life < f.max);
  }
  for (const f of sky.flares) {
    const k = f.life / f.max;
    drawFlare(c, f, A * Math.pow(Math.sin(Math.PI * k), .6));
  }
  c.globalAlpha = 1;
}
function flareChar(c, cc, rr, ch, a) {
  if (a < .03 || !cellFree(cc, rr)) return;
  const { cellW, cellH, font } = view;
  c.globalAlpha = a;
  c.fillText(ch, cc * cellW, rr * cellH + (cellH - font) * .5);
}
function drawFlare(c, f, a) {
  if (a < .02) return;
  c.fillStyle = '#fff';
  // vertical ray
  for (let i = 1; i <= f.L; i++) {
    const fa = a * Math.pow(1 - i / (f.L + 1), .7);
    const ch = i > f.L - 1 ? '.' : (i > f.L * .6 ? ':' : '|');
    flareChar(c, f.c, f.r - i, ch, fa);
    flareChar(c, f.c, f.r + i, ch, fa);
  }
  // diagonal rays
  for (let i = 1; i <= f.D; i++) {
    const fa = a * .9 * Math.pow(1 - i / (f.D + 1), .7);
    flareChar(c, f.c - i, f.r - i, '\\', fa);
    flareChar(c, f.c + i, f.r + i, '\\', fa);
    flareChar(c, f.c + i, f.r - i, '/', fa);
    flareChar(c, f.c - i, f.r + i, '/', fa);
  }
  // dashed horizontal arm
  for (let i = 1; i <= f.H * 2; i += 2) {
    const fa = a * .9 * Math.pow(1 - i / (f.H * 2 + 1), .8);
    const ch = i >= f.H * 2 - 1 ? '.' : '-';
    flareChar(c, f.c - i, f.r, ch, fa);
    flareChar(c, f.c + i, f.r, ch, fa);
  }
  // core
  flareChar(c, f.c, f.r, '+', Math.min(1, a * 1.5));
  flareChar(c, f.c, f.r, '+', a);
  c.globalAlpha = 1;
}

// ---------------------------------------------------------------- particles
function spawn(x, y, vx, vy, life, ch, col, size, grav) {
  if (parts.length > 900) return;
  parts.push({ x, y, vx, vy, life, max: life, ch, col, size, grav, ph: Math.random() * TAU });
}
function updateParticles(dt, head, bloom, st) {
  if (paused) return;
  // diamond dust: a cloud of grid sparks thrown off whatever is forming right now
  if (nFresh > 0) {
    const n = Math.min(20, Math.round(dt * 95));
    for (let k = 0; k < n; k++) {
      const idx = FRESH[(Math.random() * nFresh) | 0];
      const r0 = (idx / view.cols) | 0, c0 = idx % view.cols;
      // mostly sideways and a little upward, denser close to the forming point
      const dx = Math.round((Math.random() - .5) * 2 * Math.pow(Math.random(), 1.6) * 9);
      const dy = -Math.round(Math.pow(Math.random(), 1.5) * 5) + (Math.random() < .25 ? 1 : 0);
      gsparks.push({ c: c0 + dx, r: r0 + dy, life: 0, max: .3 + Math.random() * .7,
        ch: Math.random() < .55 ? '+' : '.', a: .45 + Math.random() * .55, up: Math.random() < .35 ? .8 + Math.random() * 2 : 0, y: 0 });
    }
  }
  // as the bud starts to open: one point just above it, sparks bursting out from it
  if (bloom > .005 && G.burstAt === undefined) {
    G.burstAt = T;
    const top = project(add(G.stem.P3, mv(headMatrix(G, T, 0), [0, G.headH * 1.05, 0])));
    const tc = (top[0] / view.cellW) | 0, tr = ((top[1] / view.cellH) | 0) - 3;
    const asp = view.cellH / view.cellW;   // cells are taller than wide: stretch sideways so the burst looks round
    // an uneven scatter with real momentum: each spark launches fast, drag slows it, gravity bends it back down
    const n = 22 + ((Math.random() * 9) | 0);
    for (let k = 0; k < n; k++) {
      const ang = -Math.PI / 2 + (Math.random() - .5) * 2 * 2.2;   // mostly up and out, a few sideways or lower
      const sp = 6 + Math.pow(Math.random(), 1.4) * 26;            // cells per second at launch
      gsparks.push({ c: tc + Math.round((Math.random() - .5) * 4), r: tr + Math.round((Math.random() - .5) * 3),
        life: -Math.pow(Math.random(), 1.5) * .6, max: .6 + Math.random() * .9,
        ch: Math.random() < .55 ? '+' : '.', a: .5 + Math.random() * .5, up: 0, y: 0, x: 0,
        vx: Math.cos(ang) * sp * asp, vy: -Math.sin(ang) * sp,
        drag: 1.6 + Math.random() * 1.6, grav: 7 + Math.random() * 7 });
    }
  }
  // glitter all around once the sky is out, also on the grid
  if (skyLevel > 0 && Math.random() < dt * 8 * skyLevel) {
    const top = project([G.pivot[0], fit.ymax, G.pivot[2]]), bot = project([G.pivot[0], fit.ymin, G.pivot[2]]);
    const rad = fit.R * view.S * 1.15;
    const x = view.cx + (Math.random() - .5) * 2 * rad, y = lerp(top[1], bot[1], Math.random());
    gsparks.push({ c: (x / view.cellW) | 0, r: (y / view.cellH) | 0, life: 0, max: .5 + Math.random() * .9, ch: Math.random() < .6 ? '+' : '.', a: .7, up: 0, y: 0 });
  }
  for (const g of gsparks) {
    g.life += dt;
    if (g.life < 0) continue;
    if (g.vx !== undefined) {
      // momentum: move, then drag slows both axes and gravity pulls downward
      g.x += g.vx * dt; g.y += g.vy * dt;
      const d = Math.exp(-g.drag * dt);
      g.vx *= d; g.vy = g.vy * d - g.grav * dt;
    } else g.y += g.up * dt;
  }
  gsparks = gsparks.filter(g => g.life < g.max);
  if (gsparks.length > 1500) gsparks.splice(0, gsparks.length - 1500);
  // pollen drifting up once open
  if (bloom > .85 && Math.random() < dt * 2.5) {
    const hc = project(add(G.stem.P3, mv(headMatrix(G, T, 0), [0, G.headH * .5, 0])));
    const c = G.centers.length ? (G.centers[G.centers.length - 1].anth || G.centers[0].c1 || [1, .85, .3]) : [1, .9, .55];
    spawn(hc[0] + (Math.random() - .5) * 30, hc[1], (Math.random() - .5) * 8, -12 - Math.random() * 16, 3 + Math.random() * 2.5,
      Math.random() < .5 ? '·' : '.', [255 * clamp(c[0] + .2), 255 * clamp(c[1] + .2), 255 * clamp(c[2] + .2)], 1, -2);
  }
  for (const p of parts) {
    p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.grav * dt;
    p.vx *= 1 - dt * .8; p.vx += Math.sin(T * 1.7 + p.ph) * dt * 6;
  }
  parts = parts.filter(p => p.life > 0);
}
function drawParticles(c, A) {
  c.textBaseline = 'middle'; c.textAlign = 'center';
  let lastFont = '';
  for (const p of parts) {
    const k = p.life / p.max, tw = .6 + .4 * Math.sin(T * 9 + p.ph);
    const a = A * Math.pow(k, .6) * tw;
    if (a < .02) continue;
    const f = `${(view.font * p.size).toFixed(1)}px ${FONT}`;
    if (f !== lastFont) { c.font = f; lastFont = f; }
    c.globalAlpha = a;
    c.fillStyle = `rgb(${p.col[0] | 0},${p.col[1] | 0},${p.col[2] | 0})`;
    c.fillText(p.ch, p.x, p.y);
  }
  c.textAlign = 'left'; c.textBaseline = 'top'; c.globalAlpha = 1;
}

// ---------------------------------------------------------------- label
function setHud(on) { hudOn = on; document.body.classList.toggle('nohud', !on); }

// ---------------------------------------------------------------- input
let down = null;
canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, moved: false, yaw: yawUser }; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', e => {
  if (!down) return;
  const dx = e.clientX - down.x;
  if (Math.abs(dx) > 6 || Math.abs(e.clientY - down.y) > 6) down.moved = true;
  if (down.moved) yawUser = down.yaw + dx * .01;
});
canvas.addEventListener('pointerup', () => { if (down && !down.moved) regrow(); down = null; });
window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (k === ' ' || k === 'r' || k === 'enter') { e.preventDefault(); regrow(); }
  else if (k === 'p') paused = !paused;
  else if (k === 'g') glowOn = !glowOn;
  else if (k === 'h') setHud(!hudOn);
  else if (k === 's') savePng();
  else if (k === 'arrowleft') yawUser -= .15;
  else if (k === 'arrowright') yawUser += .15;
  else if (k === ']' || k === '=' || k === '+') { view.detail = clamp(view.detail * 1.15, .6, 2); resize(); }
  else if (k === '[' || k === '-') { view.detail = clamp(view.detail / 1.15, .6, 2); resize(); }
});
function savePng() {
  const a = document.createElement('a');
  a.download = `bloom-${G.seed}.png`; a.href = canvas.toDataURL('image/png'); a.click();
}
window.addEventListener('resize', resize);

// ---------------------------------------------------------------- start
resize();
setFlower(params.get('seed') || newSeed());
setHud(hudOn);
requestAnimationFrame(frame);
window.__bloom = { stats: () => ({ NP, letters, cols: view.cols, rows: view.rows, flick: flickAvg, densScale }), regrow, get genome() { return G; }, setTime: t => { T = t; } };
})();
