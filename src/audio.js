// WebAudio synth: sound effects plus a tiny step sequencer for spooky music.
let ac = null, master, sfxBus, musBus, noiseBuf;
export const settings = { sfx: true, music: true };
try { Object.assign(settings, JSON.parse(localStorage.getItem('tapfighter.audio') || '{}')); } catch { /* ignore */ }

export function saveSettings() {
  try { localStorage.setItem('tapfighter.audio', JSON.stringify(settings)); } catch { /* ignore */ }
  applyGains();
}

function applyGains() {
  if (!ac) return;
  sfxBus.gain.value = settings.sfx ? 1 : 0;
  musBus.gain.value = settings.music ? 0.32 : 0;
}

export function unlock() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain(); master.gain.value = 0.55; master.connect(ac.destination);
    sfxBus = ac.createGain(); sfxBus.connect(master);
    musBus = ac.createGain(); musBus.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    applyGains();
    if (track) { nextTime = ac.currentTime + 0.1; ensureTimer(); }
  }
  if (ac.state === 'suspended') ac.resume();
}

function osc(type, f0, f1, t0, dur, vol, bus = sfxBus, attack = 0.004) {
  const o = ac.createOscillator(), gn = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t0);
  if (f1) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  gn.gain.setValueAtTime(0.0001, t0);
  gn.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(gn); gn.connect(bus);
  o.start(t0); o.stop(t0 + dur + 0.03);
}

function noise(t0, dur, vol, freq = 2000, type = 'bandpass', bus = sfxBus, q = 1) {
  const s = ac.createBufferSource(); s.buffer = noiseBuf;
  const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const gn = ac.createGain();
  gn.gain.setValueAtTime(vol, t0);
  gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(f); f.connect(gn); gn.connect(bus);
  s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.03);
}

const mf = m => 440 * Math.pow(2, (m - 69) / 12);

export function sfx(name) {
  if (!ac || !settings.sfx) return;
  const t = ac.currentTime;
  switch (name) {
    case 'tap': osc('square', 660, 880, t, 0.05, 0.06); break;
    case 'step': noise(t, 0.05, 0.05, 900, 'lowpass'); break;
    case 'perfect':
      osc('square', 988, null, t, 0.08, 0.12); osc('square', 1480, null, t + 0.05, 0.12, 0.1);
      noise(t, 0.12, 0.35, 1800); osc('sine', 160, 50, t, 0.15, 0.4); break;
    case 'good': noise(t, 0.1, 0.3, 1400); osc('triangle', 220, 80, t, 0.12, 0.35); break;
    case 'miss': osc('sawtooth', 220, 90, t, 0.18, 0.08); break;
    case 'whiff': noise(t, 0.08, 0.12, 3000, 'highpass'); break;
    case 'parry':
      osc('square', 1760, 1200, t, 0.18, 0.1); osc('square', 2350, 1800, t, 0.25, 0.06);
      noise(t, 0.2, 0.3, 5000, 'highpass'); break;
    case 'block': osc('square', 440, 300, t, 0.1, 0.1); noise(t, 0.1, 0.25, 2500); break;
    case 'hurt': osc('sawtooth', 300, 60, t, 0.25, 0.18); noise(t, 0.2, 0.3, 600, 'lowpass'); break;
    case 'feint': osc('sine', 600, 300, t, 0.2, 0.15); osc('sine', 900, 450, t, 0.2, 0.08); break;
    case 'orb': osc('sine', 300, 900, t, 0.2, 0.08); break;
    case 'smash': noise(t, 0.15, 0.3, 3000); osc('triangle', 900, 1400, t, 0.1, 0.1); break;
    case 'coin': osc('square', 1320, null, t, 0.06, 0.07); osc('square', 1760, null, t + 0.06, 0.12, 0.07); break;
    case 'pickup': osc('triangle', 520, 1040, t, 0.15, 0.15); break;
    case 'potion':
      for (let i = 0; i < 5; i++) osc('sine', 400 + i * 120, 600 + i * 150, t + i * 0.05, 0.08, 0.12);
      break;
    case 'chest': noise(t, 0.2, 0.2, 400, 'lowpass'); osc('square', 523, null, t + 0.1, 0.1, 0.07); osc('square', 784, null, t + 0.2, 0.2, 0.07); break;
    case 'levelup':
      [523, 659, 784, 1047].forEach((f, i) => osc('square', f, null, t + i * 0.08, 0.18, 0.08));
      break;
    case 'stairs': [400, 330, 260, 200].forEach((f, i) => { noise(t + i * 0.1, 0.08, 0.15, 700, 'lowpass'); osc('triangle', f, null, t + i * 0.1, 0.1, 0.1); }); break;
    case 'alert': osc('square', 880, 1320, t, 0.08, 0.07); break;
    case 'engage': osc('sawtooth', 110, 55, t, 0.35, 0.12); noise(t, 0.3, 0.2, 400, 'lowpass'); break;
    case 'enemyDie':
      noise(t, 0.4, 0.3, 800, 'lowpass'); osc('square', 400, 60, t, 0.4, 0.1);
      for (let i = 0; i < 4; i++) noise(t + 0.05 + i * 0.06, 0.05, 0.2, 2000 + i * 400);
      break;
    case 'victory': [392, 523, 659, 784, 659, 784].forEach((f, i) => osc('square', f, null, t + i * 0.09, i === 5 ? 0.4 : 0.12, 0.08)); break;
    case 'death': [330, 294, 262, 196, 131].forEach((f, i) => osc('triangle', f, f * 0.98, t + i * 0.22, 0.3, 0.15)); break;
    case 'swap': noise(t, 0.08, 0.15, 4000, 'highpass'); osc('square', 700, 900, t, 0.05, 0.05); break;
    case 'deny': osc('square', 160, 120, t, 0.12, 0.08); break;
    case 'heal': [600, 750, 900].forEach((f, i) => osc('sine', f, null, t + i * 0.07, 0.15, 0.12)); break;
    case 'buy': osc('square', 988, null, t, 0.06, 0.07); osc('square', 1319, null, t + 0.07, 0.15, 0.07); break;
    case 'boss': osc('sawtooth', 55, 50, t, 1.2, 0.2); osc('sawtooth', 82, 80, t, 1.2, 0.12); noise(t, 1, 0.2, 200, 'lowpass'); break;
    case 'rune': osc('sine', 220, 660, t, 0.35, 0.1); osc('triangle', 330, 990, t + 0.08, 0.3, 0.06); break;
    case 'fizzle': noise(t, 0.2, 0.15, 1200, 'lowpass'); osc('sawtooth', 300, 150, t, 0.15, 0.05); break;
    case 'dispel':
      [784, 988, 1319, 1568].forEach((f, i) => osc('square', f, null, t + i * 0.05, 0.12, 0.07));
      noise(t, 0.3, 0.25, 4000, 'highpass'); break;
    case 'sigil':
      osc('sawtooth', 110, 55, t, 0.4, 0.15); noise(t, 0.35, 0.35, 1500);
      [523, 784, 1047].forEach((f, i) => osc('square', f, null, t + i * 0.06, 0.15, 0.07)); break;
    case 'stun': osc('square', 1200, 600, t, 0.3, 0.06); osc('square', 1500, 750, t + 0.1, 0.3, 0.05); break;
  }
}

// Rhythm duels: a pitched pluck for hit notes and a simple kit on the beat.
export function tone(midi, vol = 0.12) {
  if (!ac || !settings.sfx) return;
  const t = ac.currentTime;
  osc('square', mf(midi), null, t, 0.22, vol * 0.5);
  osc('triangle', mf(midi), null, t, 0.35, vol);
}
export function drum(kind) {
  if (!ac || !settings.sfx) return;
  const t = ac.currentTime;
  if (kind === 'kick') { osc('sine', 150, 45, t, 0.18, 0.35); noise(t, 0.05, 0.12, 300, 'lowpass'); }
  else if (kind === 'snare') noise(t, 0.12, 0.22, 2200);
  else noise(t, 0.03, 0.06, 8000, 'highpass');
}

// ---------- Music ----------
// Each track: bpm, stepsPerBar (eighth notes), bars [{bass, chord, mel}], voice style.
const DM = [62, 65, 69], AM = [61, 64, 69], GM = [62, 67, 70], BB = [62, 65, 70];
const TRACKS = {
  explore: {
    bpm: 132, spb: 6, style: 'waltz',
    bars: [
      { bass: 38, chord: DM, mel: [69, 0, 74, 0, 77, 76] },
      { bass: 33, chord: AM, mel: [76, 0, 73, 0, 69, 0] },
      { bass: 38, chord: DM, mel: [74, 0, 77, 0, 81, 79] },
      { bass: 31, chord: GM, mel: [79, 0, 74, 0, 70, 0] },
      { bass: 34, chord: BB, mel: [70, 0, 74, 0, 77, 74] },
      { bass: 31, chord: GM, mel: [79, 0, 82, 0, 81, 79] },
      { bass: 33, chord: AM, mel: [76, 0, 73, 0, 76, 0] },
      { bass: 38, chord: DM, mel: [74, 0, 0, 0, 0, 0] },
      { bass: 38, chord: DM, mel: [0, 0, 0, 0, 0, 0] },
      { bass: 33, chord: AM, mel: [0, 0, 0, 0, 73, 0] },
      { bass: 34, chord: BB, mel: [74, 0, 0, 0, 0, 0] },
      { bass: 33, chord: AM, mel: [0, 0, 0, 0, 0, 0] },
    ],
  },
  combat: {
    bpm: 168, spb: 8, style: 'drive',
    bars: [
      { bass: 33, chord: [69, 72, 76], mel: [81, 76, 72, 76, 81, 76, 84, 83] },
      { bass: 29, chord: [65, 69, 72], mel: [77, 72, 69, 72, 77, 72, 81, 79] },
      { bass: 31, chord: [67, 71, 74], mel: [79, 74, 71, 74, 79, 74, 83, 81] },
      { bass: 28, chord: [64, 68, 71], mel: [80, 76, 71, 76, 80, 83, 80, 76] },
    ],
  },
  boss: {
    bpm: 112, spb: 8, style: 'organ',
    bars: [
      { bass: 26, chord: [62, 65, 69], mel: [74, 0, 73, 74, 77, 0, 76, 74] },
      { bass: 22, chord: [62, 65, 70], mel: [70, 0, 69, 70, 74, 0, 72, 70] },
      { bass: 19, chord: [62, 67, 70], mel: [67, 0, 69, 70, 72, 0, 70, 69] },
      { bass: 21, chord: [61, 64, 69], mel: [73, 0, 76, 0, 79, 0, 76, 73] },
    ],
  },
};

let track = null, step = 0, nextTime = 0, timer = null;

export function playMusic(name) {
  if (track === name) return;
  track = name; step = 0;
  if (ac) { nextTime = ac.currentTime + 0.08; ensureTimer(); }
}
export function stopMusic() { track = null; }

function ensureTimer() { if (!timer) timer = setInterval(schedule, 40); }

function schedule() {
  if (!ac || !track) return;
  const tr = TRACKS[track];
  const stepDur = 60 / tr.bpm / 2;
  if (nextTime < ac.currentTime - 0.3) nextTime = ac.currentTime + 0.05;
  while (nextTime < ac.currentTime + 0.18) {
    if (settings.music) playStep(tr, step, nextTime, stepDur);
    nextTime += stepDur; step++;
  }
}

function playStep(tr, s, t, sd) {
  const bar = tr.bars[Math.floor(s / tr.spb) % tr.bars.length];
  const i = s % tr.spb;
  const m = bar.mel[i];
  if (tr.style === 'waltz') {
    if (i === 0) osc('triangle', mf(bar.bass), null, t, sd * 1.8, 0.35, musBus);
    if (i === 2 || i === 4) bar.chord.forEach(n => osc('triangle', mf(n - 12), null, t, sd * 0.7, 0.07, musBus));
    if (m) { osc('sine', mf(m), null, t, sd * 2.4, 0.16, musBus); osc('triangle', mf(m + 12), null, t, sd * 0.8, 0.04, musBus); }
  } else if (tr.style === 'drive') {
    if (i % 2 === 0) osc('square', mf(bar.bass + (i % 4 === 2 ? 12 : 0)), null, t, sd * 0.9, 0.08, musBus);
    if (i % 2 === 1) noise(t, 0.04, 0.06, 7000, 'highpass', musBus);
    if (i === 0 || i === 4) noise(t, 0.12, 0.18, 150, 'lowpass', musBus);
    if (m && (s >> 5) % 2 === 1) osc('square', mf(m), null, t, sd * 0.8, 0.035, musBus);
    else if (m && i % 2 === 0) osc('triangle', mf(m), null, t, sd * 0.9, 0.08, musBus);
  } else {
    if (i === 0) {
      bar.chord.forEach(n => osc('sawtooth', mf(n - 12), null, t, sd * 7.5, 0.025, musBus, 0.08));
      osc('sawtooth', mf(bar.bass + 12), null, t, sd * 7.5, 0.06, musBus, 0.05);
    }
    if (i % 2 === 0) osc('triangle', mf(bar.bass + 12), null, t, sd * 0.6, 0.18, musBus);
    if (i === 0 || i === 3 || i === 6) noise(t, 0.2, 0.2, 120, 'lowpass', musBus);
    if (m) osc('square', mf(m), null, t, sd * 1.5, 0.03, musBus);
  }
}
