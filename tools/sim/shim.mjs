// Minimal browser stand-ins so the game's own modules run headless in Node: canvases that draw
// nothing (but keep their size, which sprites and layout rely on), a memory localStorage, a
// virtual clock, and a seedable Math.random. Import this before any game module.
const noop = () => {};
const gradient = { addColorStop: noop };

function makeCtx(canvas) {
  const store = {};
  return new Proxy(store, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'canvas') return canvas;
      if (k === 'getImageData') return (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(1, w * h) * 4), width: w, height: h });
      if (k === 'createImageData') return (w, h) => ({ data: new Uint8ClampedArray(Math.max(1, w * h) * 4), width: w, height: h });
      if (k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createPattern') return () => gradient;
      if (k === 'measureText') return () => ({ width: 0 });
      return noop;
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}

class Canvas {
  constructor() { this.width = 300; this.height = 150; this.style = {}; this._ctx = null; }
  getContext() { return this._ctx || (this._ctx = makeCtx(this)); }
  addEventListener() {}
  getBoundingClientRect() { return { left: 0, top: 0, width: this.width, height: this.height }; }
  setPointerCapture() {}
}

const mem = new Map();
globalThis.localStorage = {
  getItem: k => (mem.has(k) ? mem.get(k) : null),
  setItem: noop, // saves are pure overhead in a sim
  removeItem: k => mem.delete(k),
  clear: () => mem.clear(),
};
globalThis.document = {
  createElement: () => new Canvas(),
  getElementById: () => new Canvas(),
  addEventListener: noop,
  documentElement: {},
  baseURI: 'http://localhost/',
  hidden: false,
};
globalThis.window = globalThis;
globalThis.addEventListener = noop;
globalThis.getComputedStyle = () => ({ getPropertyValue: () => '0' });
globalThis.requestAnimationFrame = noop;
globalThis.devicePixelRatio = 1;
globalThis.innerWidth = 390; globalThis.innerHeight = 844;
globalThis.setTimeout = noop; // only used for a victory jingle
globalThis.setInterval = noop;

// Virtual clock: combat reads performance.now() - G.frameNow to place a tap between frames.
export const clock = { now: 0 };
Object.defineProperty(globalThis, 'performance', { value: { now: () => clock.now }, configurable: true, writable: true });

// mulberry32, reseeded per run so a (seed, run) pair always replays the same dungeon and dice.
let s = 1;
export function seedRandom(seed) { s = seed >>> 0; }
Math.random = () => {
  let a = (s = (s + 0x6d2b79f5) | 0);
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
