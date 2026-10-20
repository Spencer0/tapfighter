// Canvas, scaling, main loop, input dispatch, scene transitions.
import { unlock } from './audio.js';

export const G = {
  W: 240, H: 400, scale: 1, dpr: 1, safeTop: 0, safeBottom: 0,
  time: 0, frameNow: 0, scene: null, hits: [], modalIndex: -1,
  shake: 0, flash: null, trans: null, press: null, pointer: null,
};

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
export const buf = document.createElement('canvas');
export const g = buf.getContext('2d');

export function resize() {
  const dpr = window.devicePixelRatio || 1;
  const vw = window.innerWidth, vh = window.innerHeight;
  const pw = Math.round(vw * dpr), ph = Math.round(vh * dpr);
  // Pick an integer pixel scale so the short side is ~216 logical pixels.
  const scale = Math.max(1, Math.floor(Math.min(pw, ph) / 216));
  G.W = Math.ceil(pw / scale); G.H = Math.ceil(ph / scale);
  G.scale = scale; G.dpr = dpr;
  canvas.width = G.W * scale; canvas.height = G.H * scale;
  canvas.style.width = (G.W * scale) / dpr + 'px';
  canvas.style.height = (G.H * scale) / dpr + 'px';
  buf.width = G.W; buf.height = G.H;
  ctx.imageSmoothingEnabled = false; g.imageSmoothingEnabled = false;
  const cs = getComputedStyle(document.documentElement);
  G.safeTop = Math.ceil(((parseFloat(cs.getPropertyValue('--sat')) || 0) * dpr) / scale);
  G.safeBottom = Math.ceil(((parseFloat(cs.getPropertyValue('--sab')) || 0) * dpr) / scale);
  G.scene?.resize?.();
}

export function setScene(next, trans = 'fade') {
  if (!G.scene || !trans) { swapTo(next); return; }
  G.trans = { type: trans, t: 0, dur: trans === 'diamond' ? 0.32 : 0.22, next, swapped: false };
}

function swapTo(next) {
  G.scene?.exit?.();
  G.scene = next;
  next.enter?.();
  next.resize?.();
}

export function shake(n) { G.shake = Math.max(G.shake, n); }
export function flash(color, dur = 0.15) { G.flash = { color, t: 0, dur }; }

function drawTransition(p, type) {
  g.fillStyle = '#07040c';
  if (type === 'diamond') {
    const cs = 22;
    for (let y = -cs; y < G.H + cs; y += cs / 2) {
      const row = Math.round(y / (cs / 2));
      for (let x = (row & 1) ? cs / 2 : 0; x < G.W + cs; x += cs) {
        const local = Math.max(0, Math.min(1, p * 1.8 - ((x + y) / (G.W + G.H)) * 0.8));
        const r = local * cs * 0.75;
        if (r <= 0) continue;
        for (let dy = -r; dy <= r; dy++) {
          const w = Math.round((r - Math.abs(dy)) * 2);
          g.fillRect(Math.round(x - w), Math.round(y + dy), w * 2 + 1, 1);
        }
      }
    }
  } else {
    g.globalAlpha = Math.max(0, Math.min(1, p));
    g.fillRect(0, 0, G.W, G.H);
    g.globalAlpha = 1;
  }
}

let last = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
  last = now;
  G.frameNow = performance.now();
  G.time += dt;
  const tr = G.trans;
  if (tr) {
    tr.t += dt;
    if (!tr.swapped && tr.t >= tr.dur) { tr.swapped = true; swapTo(tr.next); }
    if (tr.t >= tr.dur * 2) G.trans = null;
  }
  try {
    G.scene?.update(dt);
    G.hits.length = 0; G.modalIndex = -1;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#07040c'; g.fillRect(0, 0, G.W, G.H);
    if (G.shake > 0.3) {
      G.shake = Math.max(0, G.shake - dt * 28);
      const s = Math.round(G.shake);
      g.translate(Math.round((Math.random() * 2 - 1) * s), Math.round((Math.random() * 2 - 1) * s));
    } else G.shake = 0;
    G.scene?.draw(g);
    g.setTransform(1, 0, 0, 1, 0, 0);
  } catch (err) {
    console.error(err);
    window.__tfError = String(err && err.stack || err);
  }
  if (G.flash) {
    const f = G.flash; f.t += dt;
    g.globalAlpha = Math.max(0, 1 - f.t / f.dur) * 0.55;
    g.fillStyle = f.color; g.fillRect(0, 0, G.W, G.H); g.globalAlpha = 1;
    if (f.t >= f.dur) G.flash = null;
  }
  if (G.trans) {
    const t = G.trans;
    const p = t.t < t.dur ? t.t / t.dur : 1 - (t.t - t.dur) / t.dur;
    drawTransition(p, t.type);
  }
  ctx.drawImage(buf, 0, 0, buf.width * G.scale, buf.height * G.scale);
}

function toLogical(e) {
  const r = canvas.getBoundingClientRect();
  return [((e.clientX - r.left) / r.width) * G.W, ((e.clientY - r.top) / r.height) * G.H];
}

export function dispatchTap(x, y) {
  G.press = { x, y, t: G.time };
  if (G.trans) return;
  const start = G.modalIndex >= 0 ? G.modalIndex : 0;
  for (let i = G.hits.length - 1; i >= start; i--) {
    const h = G.hits[i];
    if (x >= h.x && x < h.x + h.w && y >= h.y && y < h.y + h.h) { h.fn(); return; }
  }
  if (G.modalIndex >= 0) return;
  G.scene?.onTap?.(x, y);
}

export function start(first) {
  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 200));
  canvas.addEventListener('pointerdown', e => {
    e.preventDefault();
    unlock();
    try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
    const [x, y] = toLogical(e);
    G.pointer = { id: e.pointerId, down: true };
    dispatchTap(x, y);
  }, { passive: false });
  // Drags (rune drawing) go to the scene as a stream of points after the initial tap.
  canvas.addEventListener('pointermove', e => {
    if (!G.pointer || G.pointer.id !== e.pointerId) return;
    e.preventDefault();
    const [x, y] = toLogical(e);
    G.scene?.onDrag?.(x, y);
  }, { passive: false });
  const release = e => {
    if (!G.pointer || G.pointer.id !== e.pointerId) return;
    G.pointer = null;
    const [x, y] = toLogical(e);
    G.scene?.onRelease?.(x, y);
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
  document.addEventListener('gesturestart', e => e.preventDefault());
  document.addEventListener('dblclick', e => e.preventDefault());
  window.addEventListener('keydown', e => { unlock(); G.scene?.onKey?.(e.key); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) G.scene?.onHide?.(); });
  setScene(first, null);
  requestAnimationFrame(frame);
}
