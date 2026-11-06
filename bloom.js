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
  blush:     [[350, .50, .58], [355, .26, .97], [10, .12, 1], [20, .05, 1]],
  white:     [[85, .25, .62], [60, .05, .95], [50, .02, 1], [0, 0, 1]],
  cream:     [[45, .45, .66], [45, .20, .97], [45, .09, 1], [45, .03, 1]],
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
};
const FAM_EDGE = { picotee: [0.95, 0.55], stargazer: [0.75, 0.6], sunset: [0.5, 0.7] };

function makePalette(R, fam) {
  const dh = R.range(-7, 7);
  const c = FAM[fam].map(([h, s, v]) => hsv(h + dh, clamp(s * R.range(0.92, 1.05)), clamp(v)));
  const e = FAM_EDGE[fam] || [R.range(0.25, 0.45), 0.75];
  return { fam, base: c[0], body: c[1], tip: c[2], edge: c[3], edgeAmt: e[0], edgeStart: e[1],
    spot: hsv(FAM[fam][0][0] + dh - 10, 0.9, 0.22) };
}

// ============================================================ species
const SPECIES = {
  rose:    { w: 3.0, fams: ['crimson', 'crimson', 'scarlet', 'pink', 'blush', 'cream', 'yellow', 'coral', 'lilac', 'sunset', 'picotee'] },
  tulip:   { w: 1.4, fams: ['scarlet', 'yellow', 'pink', 'purple', 'white', 'orange', 'sunset', 'magenta', 'picotee'] },
  lily:    { w: 1.3, fams: ['white', 'orange', 'stargazer', 'stargazer', 'yellow', 'pink'] },
  daisy:   { w: 1.4, fams: ['white', 'white', 'yellow', 'pink', 'orange', 'lilac', 'magenta'] },
  dahlia:  { w: 1.1, fams: ['magenta', 'orange', 'scarlet', 'yellow', 'purple', 'blush', 'sunset'] },
  peony:   { w: 1.2, fams: ['pink', 'blush', 'coral', 'white', 'magenta', 'crimson'] },
  lotus:   { w: 1.0, fams: ['pink', 'white', 'blush'] },
  anemone: { w: 1.0, fams: ['scarlet', 'purple', 'violet', 'white', 'pink', 'crimson'] },
};
const GOLDEN = 2.39996323;

function basePetal(o) {
  return Object.assign({ count: 5, len: .5, W: .25, r0: .03, y0: 0, phC0: .3, phC1: -.1, phO0: .5, phO1: 1.2,
    curl: 0, cupC: .9, cupO: .4, wrap: .6, ruffle: .02, rufF: 3, wk: 1.5, we: .5, notch: 0, fringe: 0, fringeF: 18,
    veins: 6, openMax: 1, delay: 0, rot: 0, spots: 0, gloss: .25, jit: .1 }, o);
}

function makeGenome(seed) {
  const R = new RNG(seed);
  const type = R.weighted(Object.entries(SPECIES).map(([k, v]) => [k, v.w]));
  const fam = R.pick(SPECIES[type].fams);
  const pal = makePalette(R, fam);
  const size = R.range(1.0, 1.25);
  const G = { seed, type, fam, pal, size, layers: [], centers: [], sepals: null, leaves: [], thorns: [] };
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
      const phO0 = R.range(.15, .32) + .08 * l;
      L.push(basePetal({ count: 3, len: size2 * (l ? 1 : .96), W: size2 * R.range(.36, .44), r0: .03, y0: .02,
        phC0: .32, phC1: -.12, phO0, phO1: phO0 + R.range(.2, .5), curl: lilyFlowered ? R.range(.5, .8) : R.range(0, .12),
        cupC: .95, cupO: .72, wrap: .7, ruffle: .015, wk: lilyFlowered ? .95 : 1.3, we: lilyFlowered ? 1 : .55,
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
  // inner layers first in the list, outer ones last
  G.layers = L;
  G.headH = Math.max(...L.map(p => p.len)) * 0.95;

  // sepals
  if (type === 'rose' || type === 'peony' || type === 'anemone' || type === 'dahlia') {
    const len = (type === 'rose' ? .3 : .2) * size;
    G.sepals = basePetal({ count: 5, len, W: len * .2, r0: .03, y0: -.01, phC0: .25, phC1: -.12, phO0: 1.2, phO1: 2.5, curl: .4,
      cupC: .5, cupO: .3, wrap: .6, wk: .9, we: 1.1, veins: 1, rot: R.range(0, TAU), gloss: .3, ruffle: type === 'rose' ? .05 : .01, rufF: 8 });
  } else if (type === 'daisy') {
    G.sepals = basePetal({ count: 16, len: .1 * size, W: .022 * size, r0: .05, y0: -.02, phC0: .3, phC1: .1, phO0: 1.5, phO1: 2.0,
      cupC: .2, cupO: .2, wrap: 0, wk: .9, we: 1, veins: 1, gloss: .2 });
  }

  // greens
  const gh = type === 'lotus' ? R.range(140, 160) : (type === 'tulip' ? R.range(105, 125) : R.range(95, 135));
  const gs = type === 'tulip' ? .55 : 1;
  G.green = {
    dark: hsv(gh + 5, .85 * gs, .26), body: hsv(gh, .78 * gs, .68), light: hsv(gh - 12, .55 * gs, .95),
    stem: hsv(gh - 8, .72 * gs, .74), vein: hsv(gh - 15, .45 * gs, 1),
  };
  G.sepalPal = { base: G.green.dark, body: G.green.body, tip: G.green.light, edge: G.green.light, edgeAmt: .2, edgeStart: .8, spot: G.green.dark };

  // head orientation and stem
  const tiltRange = { rose: [.05, .35], tulip: [0, .2], lily: [.75, 1.15], daisy: [.75, 1.05], dahlia: [.45, .8], peony: [.2, .45], lotus: [.15, .4], anemone: [.6, .95] }[type];
  G.head = { tilt: R.range(tiltRange[0], tiltRange[1]), az: R.range(-.7, .7), spin: R.range(0, TAU) };
  const H = R.range(1.35, 1.8) * (type === 'lotus' ? .9 : 1);
  const M0 = mmul(rotY(G.head.az), rotX(G.head.tilt));
  const up = mv(M0, [0, 1, 0]);
  const P3 = [R.range(-.28, .28), H, R.range(-.18, .12)];
  G.stem = {
    H, thick: R.range(.85, 1.2) * (type === 'lotus' ? 1.3 : 1),
    P0: [0, 0, 0], P1: [R.range(-.3, .3), H * R.range(.25, .45), R.range(-.2, .2)], P2: sub(P3, mul(up, H * R.range(.22, .36))), P3,
  };
  G.pivot = [P3[0] * .5, 0, P3[2] * .5];
  if (type === 'rose') {
    const n = R.int(4, 8);
    for (let i = 0; i < n; i++) G.thorns.push({ u: R.range(.1, .85), a: R.range(0, TAU), len: R.range(.04, .07) });
  }

  // leaves
  const lv = [];
  const lsz = (type === 'lotus' || type === 'tulip') ? 1.1 : 1.3;
  const leaf = o => Object.assign({ u: .4, psi: 0, len: .5, W: .14, elev: 1.0, droop: .6, fold: .5, serr: 0, teeth: 10,
    shape: 'ovate', pairs: 0, petiole: .08, gloss: .3, roll: R.range(.45, .95) * (R.chance(.5) ? 1 : -1) }, o, { len: (o.len || .5) * lsz, W: (o.W || .14) * lsz });
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

  G.bloomDur = R.range(7.5, 10);
  G.skySeed = R.int(0, 1e9);
  G.id = xmur3(String(seed)) & 0xffff;
  G.name = `${fam === 'stargazer' ? 'stargazer' : fam} ${type}`;
  return G;
}

// ============================================================ geometry buffer
const STRIDE = 18, MAXP = 180000;
const BUF = new Float32Array(MAXP * STRIDE);
let NP = 0, NMODEL = 0;
function push(x, y, z, nx, ny, nz, r, g, b, tx, ty, tz, order, edge, kind, h, side, gloss) {
  if (NP >= MAXP) return;
  const o = NP * STRIDE;
  BUF[o] = x; BUF[o + 1] = y; BUF[o + 2] = z; BUF[o + 3] = nx; BUF[o + 4] = ny; BUF[o + 5] = nz;
  BUF[o + 6] = r; BUF[o + 7] = g; BUF[o + 8] = b; BUF[o + 9] = tx; BUF[o + 10] = ty; BUF[o + 11] = tz;
  BUF[o + 12] = order; BUF[o + 13] = edge; BUF[o + 14] = kind; BUF[o + 15] = h; BUF[o + 16] = side; BUF[o + 17] = gloss;
  NP++;
}

const GMAX = 72 * 52;
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
      const L = Math.hypot(nx, ny, nz), k = (i * nv + j) * 3;
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
  for (let m = 0; m < N; m++) {
    const k = m * 3;
    const e = (GT[k] !== 0 || GT[k + 1] !== 0 || GT[k + 2] !== 0) ? 1 : 0;
    push(GP[k], GP[k + 1], GP[k + 2], GN[k], GN[k + 1], GN[k + 2], GC[k], GC[k + 1], GC[k + 2],
      GT[k], GT[k + 1], GT[k + 2], GO[m], e, GK[m], hash1(o.id * 7919 + m), side, o.gloss);
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
const SR = new Float32Array(96), SY = new Float32Array(96), SPh = new Float32Array(96);
function emitPetal(P, open, theta, M, T, pal, orderBase, orderSpan, headH, id, dens, lenMul) {
  const len = P.len * lenMul, W = P.W * lenMul;
  const nu = clamp(Math.ceil(len * dens * 1.25) + 4, 6, 64) | 0;
  let nv = clamp(Math.ceil(2 * W * dens * 1.15) + 3, 5, 48) | 0; if (nv % 2 === 0) nv++;
  const ds = len / (nu - 1);
  let r = P.r0, y = P.y0;
  for (let i = 0; i < nu; i++) {
    const u = i / (nu - 1);
    const pc = lerp(P.phC0, P.phC1, u), po = lerp(P.phO0, P.phO1, u) + P.curl * sstep(.5, 1, u);
    const ph = lerp(pc, po, open);
    SR[i] = Math.max(r, .004); SY[i] = y; SPh[i] = ph;
    r += Math.sin(ph) * ds; y += Math.cos(ph) * ds;
  }
  const cup = lerp(P.cupC, P.cupO, open), wrapK = P.wrap * (1 - open);
  const ct = Math.cos(theta), st = Math.sin(theta);
  const { base, body, tip, edge, edgeAmt, edgeStart, spot } = pal;
  let m = 0;
  for (let i = 0; i < nu; i++) {
    const u = i / (nu - 1);
    const prof = Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(u, P.wk))), P.we);
    const hw = W * (0.07 + 0.93 * prof);
    const t1 = sstep(0, .5, u), t2 = sstep(.5, 1, u) * .85, bd = .5 + .5 * sstep(0, .32, u);
    for (let j = 0; j < nv; j++, m++) {
      const v = -1 + 2 * j / (nv - 1), av = Math.abs(v);
      let ue = u;
      if (P.notch > 0) ue -= P.notch * Math.exp(-v * v * 8) * Math.pow(u, 4);
      if (P.fringe > 0) ue -= P.fringe * (.5 + .5 * Math.sin(v * P.fringeF + id)) * Math.pow(u, 6);
      ue = clamp(ue);
      const fi = ue * (nu - 1), i0 = Math.floor(fi), f = fi - i0, i1 = Math.min(i0 + 1, nu - 1);
      const rad = lerp(SR[i0], SR[i1], f), yy = lerp(SY[i0], SY[i1], f), ph = lerp(SPh[i0], SPh[i1], f);
      const lat = v * hw;
      let Rr = rad, Tn = lat;
      if (wrapK > 0) {
        const al = clamp(lat / Math.max(rad, .02), -2.8, 2.8);
        Rr = lerp(rad, rad * Math.cos(al), wrapK); Tn = lerp(lat, rad * Math.sin(al), wrapK);
      }
      const off = cup * hw * v * v * .9 + P.ruffle * W * Math.sin(v * P.rufF * Math.PI + u * 4 + id) * Math.pow(u, 1.5) * (.35 + .65 * av);
      const nr = -Math.cos(ph), nyy = Math.sin(ph);
      const Rl = Rr + nr * off, ly = yy + nyy * off;
      const lx = Rl * ct - Tn * st, lz = Rl * st + Tn * ct;
      const k = m * 3;
      GP[k] = M[0] * lx + M[1] * ly + M[2] * lz + T[0];
      GP[k + 1] = M[3] * lx + M[4] * ly + M[5] * lz + T[1];
      GP[k + 2] = M[6] * lx + M[7] * ly + M[8] * lz + T[2];
      // color
      let cr = lerp(base[0], body[0], t1), cg = lerp(base[1], body[1], t1), cb = lerp(base[2], body[2], t1);
      cr = lerp(cr, tip[0], t2); cg = lerp(cg, tip[1], t2); cb = lerp(cb, tip[2], t2);
      const e = sstep(edgeStart, 1, Math.max(u * .92, av)) * edgeAmt;
      cr = lerp(cr, edge[0], e); cg = lerp(cg, edge[1], e); cb = lerp(cb, edge[2], e);
      const vf = 1 - .1 * (.5 + .5 * Math.cos(v * P.veins * Math.PI)) * sstep(.05, .3, u);
      let mm = vf * bd;
      let kind = 0;
      if (P.spots && u > .12 && u < .62 && av < .75 && hash1(id * 131 + i * 977 + j * 31) < .09 * P.spots) {
        cr = spot[0]; cg = spot[1]; cb = spot[2]; mm = 1;
      } else if (u > .35 && hash1(id * 53 + i * 613 + j * 7) < .0012) kind = 3; // dew drop
      GC[k] = cr * mm; GC[k + 1] = cg * mm; GC[k + 2] = cb * mm;
      GO[m] = orderBase + orderSpan * clamp(ly / headH);
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
  const S = G.stem, Rr = .03 * S.thick, gr = G.green;
  const nu = clamp(Math.ceil(S.H * dens / cellRatio * 1.6), 20, 220) | 0, nv = 12;
  let m = 0;
  for (let i = 0; i < nu; i++) {
    const u = i / (nu - 1), F = stemFrame(S, u);
    const rr = Rr * (1.15 - .3 * u) * (1 + .9 * sstep(.95, 1, u));
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
    emitCurve(s => add(base, mul(sub(tipp, base), s)), 5, [.45, .22, .12], th.u, th.u, 0, G.id + 991);
  }
}

// ---------------------------------------------------------------- leaves
function leafProfile(shape, u) {
  if (shape === 'round') return Math.sqrt(Math.max(0, 1 - Math.pow(2 * u - 1, 2)));
  if (shape === 'lance') return Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(u, .7))), 1.2);
  return Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(u, .8))), .85);
}
function emitBlade(origin, dOut, len, W, elev, droop, fold, serr, teeth, shape, open, gr, orderBase, id, dens, time, gloss, roll) {
  const cr = Math.cos(roll || 0), sr = Math.sin(roll || 0);
  const sc = lerp(.3, 1, open);
  len *= sc; W *= sc * lerp(.4, 1, open);
  fold = lerp(1.6, fold, open);
  const nu = clamp(Math.ceil(len * dens * 1.3) + 4, 6, 64) | 0;
  let nv = clamp(Math.ceil(2 * W * dens * 1.2) + 3, 5, 48) | 0; if (nv % 2 === 0) nv++;
  const up = [0, 1, 0], lat = norm([dOut[2], 0, -dOut[0]]);
  const ds = len / (nu - 1);
  let p = origin.slice(), m = 0;
  const wind = .05 * Math.sin(time * 1.3 + id * .37);
  let midN = [0, 1, 0];
  for (let i = 0; i < nu; i++) {
    const u = i / (nu - 1);
    const ph = elev + droop * u * u + wind * u;
    const sp = Math.sin(ph), cp = Math.cos(ph);
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
      const o = av * hw * fold * .6;
      GP[k] = p[0] + lt[0] * v * hw + nS[0] * o;
      GP[k + 1] = p[1] + lt[1] * v * hw + nS[1] * o;
      GP[k + 2] = p[2] + lt[2] * v * hw + nS[2] * o;
      let c = c0, f = 1;
      if (av < .09) c = mixc(c0, gr.vein, .45);
      else if (((u * 7 - av * .9) % 1 + 1) % 1 < .12 && u > .08) c = mixc(c0, gr.vein, .22);
      f *= .85 + .15 * (1 - av);
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
            open, gr, L.u + .03, id + k * 97 + (sgn > 0 ? 50 : 0), dens, st.time, L.gloss, L.roll * .6);
        }
      }
    }
    emitBlade(base, dOut, L.len, L.W, L.elev, L.droop, L.fold, L.serr, L.teeth, L.shape, open, gr, L.u + .03, id, dens, st.time, L.gloss, L.roll);
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
        for (const q of seeds) if (Math.hypot(x - q[0], z - q[1]) < rp * .11) isSeed = true;
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

function emitHead(G, st, dens) {
  if (st.head < 1.0) return;
  const M = headMatrix(G, st.time, st.settle), T = G.stem.P3;
  if (G.sepals) {
    const P = G.sepals, open = easeInOut(clamp(st.bloom * 1.6));
    for (let k = 0; k < P.count; k++) {
      const th = P.rot + k * TAU / P.count;
      emitPetal(P, open, th, M, T, G.sepalPal, 1.0, .08, G.headH, G.id * 31 + k * 211 + 5, dens, 1);
    }
  }
  const grow = lerp(.6, 1, sstep(0, .65, st.bloom));
  G.layers.forEach((P, l) => {
    const o = clamp((st.bloom - P.delay) / (1 - P.delay));
    const open0 = easeInOut(o) * P.openMax * st.breathe;
    for (let k = 0; k < P.count; k++) {
      const hid = G.id * 1009 + l * 101 + k;
      const jt = (hash1(hid) - .5) * P.jit, jl = 1 + (hash1(hid + 9) - .5) * .12, jo = (hash1(hid + 17) - .5) * .14;
      const th = P.rot + k * TAU / P.count + jt;
      emitPetal(P, clamp(open0 * (1 + jo)), th, M, T, G.pal, 1.08, .42, G.headH, hid, dens, jl * grow);
    }
  });
  emitCenters(G, st, M, T, dens, st.bloom);
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
    stars.push({ c, r, k, a: k === 0 ? R.range(.12, .32) : k === 1 ? R.range(.35, .75) : R.range(.75, 1),
      sp: R.range(.5, 2.6), ph: R.range(0, TAU), cool: R.range(0, 1) });
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

const RAMP = '.:-=+<>ivrtxzcjfunoaeQ0$8B%&#@';
const DISK = 'o0@*Oo';
const ANTH = '@0o';
const STEMR = ':;!i1lj0O8%Q$8B';
const PITCH = .2;
const SPARK = ['+', '*', '.', '·', "'", '+'];
const FONT = 'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, "DejaVu Sans Mono", "Liberation Mono", monospace';
const D = 7;            // camera distance in world units
const DRAW0 = .5, DRAW1 = 5.2, O_MAX = 1.56, GHOST = .3;
const BLOOM0 = 5.3, TURN0 = 7;

const params = new URLSearchParams(location.search);
const view = { w: 0, h: 0, dpr: 1, cellW: 6, cellH: 10, cols: 0, rows: 0, font: 10, detail: 1, S: 100, cx: 0, cy: 0, yMid: 1 };
let zb, win, ghost;
let G = null, sky = null;
let T = +(params.get('t') || 0), paused = false, glowOn = params.get('glow') !== '0', hudOn = params.get('hud') !== '0';
let yaw = 0, yawUser = 0, fade = 0, pending = null;
let parts = [], falls = [], fallTimer = 3, letters = 0, fps = 60, fpsAcc = 0, fpsN = 0;
const fit = { R: 1, ymin: 0, ymax: 3 };

function newSeed() { return Math.floor(Math.random() * 2176782336).toString(36).padStart(6, '0'); }

function resize() {
  const w = window.innerWidth, h = window.innerHeight, dpr = Math.min(window.devicePixelRatio || 1, w * h > 900000 ? 1.5 : 2);
  Object.assign(view, { w, h, dpr });
  for (const c of [canvas, fg]) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  g1.width = Math.max(1, Math.round(w / 4)); g1.height = Math.max(1, Math.round(h / 4));
  g2.width = Math.max(1, Math.round(w / 12)); g2.height = Math.max(1, Math.round(h / 12));
  const portrait = h > w;
  view.cellH = clamp(h / (portrait ? 118 : 92), 6.5, 15) / view.detail;
  view.cellW = view.cellH / 1.72;
  view.cols = Math.ceil(w / view.cellW); view.rows = Math.ceil(h / view.cellH);
  view.font = Math.min(view.cellW / .6, view.cellH * .95);
  const n = view.cols * view.rows;
  zb = new Float32Array(n); win = new Int32Array(n); ghost = new Float32Array(n);
  if (G) { sky = makeSky(G.skySeed); computeView(); }
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
  parts = []; falls = []; fallTimer = 3; yaw = 0; yawUser = 0;
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
const cellChar = [];

function frame(now) {
  const dt = Math.min(.05, (now - (frame.last || now)) / 1000); frame.last = now;
  fpsAcc += dt; fpsN++; if (fpsAcc > .5) { fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }
  if (!paused) T += dt;

  if (pending) {
    fade -= dt * 2.6;
    if (fade <= 0) { setFlower(pending); pending = null; T = 0; fade = 0; }
  }
  const alpha = pending ? Math.max(0, fade) : 1;

  // timeline
  const head = O_MAX * clamp((T - DRAW0) / (DRAW1 - DRAW0)) + (T > DRAW1 ? 1 : 0);
  const bloom = easeInOut((T - BLOOM0) / G.bloomDur);
  const bloomEnd = BLOOM0 + G.bloomDur;
  const settle = sstep(bloomEnd - 1, bloomEnd + 2, T);
  const breathe = 1 - .03 * (.5 + .5 * Math.sin(T * .8)) * settle;
  if (!paused) yaw += dt * .3 * sstep(TURN0, TURN0 + 4, T);
  const sway = .05 * Math.sin(T * .55) * sstep(DRAW1, DRAW1 + 3, T);
  viewM = mmul(rotX(PITCH), mmul(rotZ(sway), rotY(yaw + yawUser)));
  const st = { head, bloom, breathe, time: T, settle };

  // build geometry
  const dens = view.S / view.cellW;
  NP = 0;
  emitStem(G, st, dens, view.cellH / view.cellW);
  emitLeaves(G, st, dens);
  emitHead(G, st, dens);
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

  // splat into the character grid
  const { cols, rows, cellW, cellH, S, cx, cy, yMid } = view;
  zb.fill(-1e9); win.fill(-1); ghost.fill(9);
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
      if (d < GHOST && BUF[o + 15] < .55 * (1 - d / GHOST) && d < ghost[idx]) ghost[idx] = d;
      continue;
    }
    if (qz > zb[idx]) { zb[idx] = qz; win[idx] = p; }
  }

  // shade cells and choose glyphs
  buckets.clear();
  letters = 0;
  const zr = fit.R + .2;
  for (let idx = 0, n = cols * rows; idx < n; idx++) {
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
    const diff = Math.max(0, nx * LK[0] + ny * LK[1] + nz * LK[2]);
    const lum = .2 + .8 * diff;
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
    if (kind === 3) {
      const tw = .55 + .45 * Math.sin(T * 5 + h * 40);
      r = lerp(r, 1, .55 * tw); g = lerp(g, 1, .55 * tw); b = lerp(b, 1, .55 * tw); ch = tw > .6 ? '*' : '+';
    } else if (kind === 1) ch = DISK[(h * DISK.length) | 0];
    else if (kind === 2) ch = ANTH[(h * ANTH.length) | 0];
    else {
      let isStroke = false, tx = 0, ty = 0;
      if (BUF[o + 13] > 0) {
        const a = BUF[o + 9], bb = BUF[o + 10], c = BUF[o + 11];
        if (model) { tx = V[0] * a + V[1] * bb + V[2] * c; ty = V[3] * a + V[4] * bb + V[5] * c; } else { tx = a; ty = bb; }
        isStroke = true;
      } else if (nz < (kind === 5 ? .5 : .24)) { tx = -ny; ty = nx; isStroke = true; }
      if (isStroke) {
        const dx = tx, dy = -ty, ang = Math.atan2(Math.abs(dy) * 1.0, Math.abs(dx) * 1.0);
        if (ang < .42) ch = (idx + cols < cols * rows && win[idx + cols] < 0) ? '_' : '-';
        else if (ang > 1.2) ch = '|';
        else ch = dx * dy < 0 ? '/' : '\\';
        r *= 1.08; g *= 1.08; b *= 1.08;
      } else if (kind === 5) {
        const lv = clamp(lum * .95 + spec * .5 + (h - .5) * .1);
        ch = STEMR[(lv * (STEMR.length - 1)) | 0];
      } else {
        const lv = clamp(lum * .9 + spec * .6 + (h - .5) * .26);
        ch = RAMP[(lv * (RAMP.length - 1)) | 0];
      }
    }
    if (fresh) { r = lerp(r, 1, .65); g = lerp(g, 1, .65); b = lerp(b, 1, .65); ch = RAMP[(Math.random() * RAMP.length) | 0]; }
    r = clamp(r); g = clamp(g); b = clamp(b);
    cellChar[idx] = ch;
    addBucket((Math.round(r * 31) << 10) | (Math.round(g * 31) << 5) | Math.round(b * 31), idx);
    letters++;
  }

  // particles
  updateParticles(dt, head, bloom, st);

  // ---------------- draw
  const dpr = view.dpr;
  fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  fctx.clearRect(0, 0, view.w, view.h);
  const skyA = sstep(0, 1.4, T) * alpha;
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
function glow(c, x, y, rad, a) {
  const rg = c.createRadialGradient(x, y, 0, x, y, rad);
  rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(.3, 'rgba(255,255,255,.55)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
  c.globalAlpha = a; c.fillStyle = rg; c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
}
function drawSky(c, t, A, dt) {
  if (A <= 0) return;
  const { cellW, cellH, font } = view, yo = (cellH - font) * .5;
  c.font = `${font.toFixed(2)}px ${FONT}`;
  c.textBaseline = 'top';
  for (const s of sky.stars) {
    if (!cellFree(s.c, s.r)) continue;
    const tw = .5 + .5 * Math.sin(t * s.sp + s.ph);
    const a = A * s.a * (s.k === 0 ? .6 + .4 * tw : .35 + .65 * tw * tw);
    if (a < .03) continue;
    const g = (225 + 30 * (1 - s.cool)) | 0;
    const x = s.c * cellW, y = s.r * cellH;
    c.globalAlpha = a;
    c.fillStyle = `rgb(${g},${g},255)`;
    if (s.k === 0) c.fillText('.', x, y + yo - cellH * .25);
    else c.fillText('+', x, y + yo);
    if (s.k === 2) glow(c, x + cellW * .5, y + cellH * .5, cellW * .6, a * .8);
  }
  // flare stars flash up around the plant and fade away
  if (!paused) {
    sky.nextFlare -= dt;
    if (sky.nextFlare <= 0 && T > .6) {
      sky.nextFlare = sky.R.range(.25, .9);
      if (sky.flares.length < 5) {
        const top = project([G.pivot[0], fit.ymax, G.pivot[2]]), bot = project([G.pivot[0], fit.ymin, G.pivot[2]]);
        const rad = fit.R * view.S * 1.35;
        const x = view.cx + (sky.R.next() - .5) * 2 * rad, y = lerp(top[1] - cellH * 4, bot[1], sky.R.next());
        sky.flares.push({ c: Math.floor(x / cellW), r: Math.floor(y / cellH), life: 0, max: sky.R.range(1.6, 3.2),
          L: sky.R.range(3.5, 6.5), D: sky.R.range(1.6, 2.6), H: sky.R.int(3, 5) });
      }
    }
    for (const f of sky.flares) f.life += dt;
    sky.flares = sky.flares.filter(f => f.life < f.max);
  }
  for (const f of sky.flares) {
    const k = f.life / f.max;
    drawFlare(c, f, A * Math.pow(Math.sin(Math.PI * k), 1.4));
  }
  c.globalAlpha = 1;
}
function ray(c, x0, y0, x1, y1, a) {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(.5, `rgba(255,255,255,${a.toFixed(3)})`);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.strokeStyle = g;
  c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
}
function drawFlare(c, f, a) {
  if (a < .02) return;
  const { cellW, cellH, font } = view, yo = (cellH - font) * .5;
  const x = (f.c + .5) * cellW, y = (f.r + .5) * cellH;
  const L = f.L * cellH, d = f.D * cellH;
  c.globalAlpha = 1; c.lineWidth = 1;
  ray(c, x, y - L, x, y + L, a);
  ray(c, x - d * .55, y - d, x + d * .55, y + d, a * .7);
  ray(c, x + d * .55, y - d, x - d * .55, y + d, a * .7);
  // dashed horizontal arm made of grid characters
  c.fillStyle = '#fff';
  for (let i = 1; i <= f.H * 2; i += 2) {
    const fa = a * Math.pow(1 - i / (f.H * 2 + 1), 1.2) * .85;
    for (const sg of [-1, 1]) {
      const cc = f.c + sg * i;
      if (!cellFree(cc, f.r)) continue;
      c.globalAlpha = fa;
      c.fillText(i >= f.H * 2 - 1 ? '.' : '-', cc * cellW, f.r * cellH + yo);
    }
  }
  c.globalAlpha = a; c.fillStyle = '#fff';
  c.fillText('+', f.c * cellW, f.r * cellH + yo);
  glow(c, x, y, cellW * .9, a);
  c.globalAlpha = 1;
}

// ---------------------------------------------------------------- particles
function spawn(x, y, vx, vy, life, ch, col, size, grav) {
  if (parts.length > 900) return;
  parts.push({ x, y, vx, vy, life, max: life, ch, col, size, grav, ph: Math.random() * TAU });
}
function updateParticles(dt, head, bloom, st) {
  if (paused) return;
  // sparks off the drawing light
  if (head > .01 && head < O_MAX + .05 && T < DRAW1 + .2) {
    let tip;
    if (head <= 1) tip = bez(G.stem, head);
    else tip = add(G.stem.P3, mv(headMatrix(G, T, 0), [0, G.headH * clamp((head - 1.08) / .42), 0]));
    const s = project(tip);
    const n = Math.round(dt * 70);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, sp = 15 + Math.random() * 70;
      spawn(s[0], s[1], Math.cos(a) * sp, Math.sin(a) * sp - 25, .4 + Math.random() * .9,
        SPARK[(Math.random() * SPARK.length) | 0], Math.random() < .7 ? [255, 255, 255] : [255, 236, 190], .8 + Math.random() * .5, 10);
    }
  }
  // diamond dust glitter around the plant
  const top = project([G.pivot[0], fit.ymax, G.pivot[2]]), bot = project([G.pivot[0], fit.ymin, G.pivot[2]]);
  const rad = fit.R * view.S * 1.15;
  const rate = T < DRAW1 ? 10 : 6;
  if (Math.random() < dt * rate) {
    spawn(view.cx + (Math.random() - .5) * 2 * rad, lerp(top[1], bot[1], Math.random()), 0, -4, .5 + Math.random() * 1.2,
      Math.random() < .6 ? '+' : '.', [255, 255, 255], .9, 0);
  }
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
window.__bloom = { regrow, get genome() { return G; }, setTime: t => { T = t; } };
})();
