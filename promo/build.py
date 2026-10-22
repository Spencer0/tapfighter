#!/usr/bin/env python3
"""Assemble the 12s Tapfighter TikTok from recorded scene frames.

  python3 build.py <frames_dir> <piper_voice.onnx> <out.mp4>

frames_dir holds s1..s4 (see record.sh). Voice is Piper TTS; music and SFX are synthesized here.
"""
import json, subprocess, sys, wave
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont

FRAMES, VOICE, OUT = Path(sys.argv[1]), sys.argv[2], sys.argv[3]
SR, FPS, W, H = 44100, 60, 1080, 1920
# (scene dir, start s, length s)
SCENES = [("s1", 0.0, 2.7), ("s2", 2.7, 2.6), ("s3", 5.3, 2.8), ("s4", 8.1, 3.9)]
TOTAL = 12.0
# (caption text, voice start s, latest end s)
LINES = [
    ("HARDEST GAME EVER?", 0.12, 2.55),
    ("IMPOSSIBLE?", 2.82, 5.2),
    ("TOO EASY?", 5.42, 7.9),
    ("PLAY TODAY! LINK IN DESCRIPTION!", 8.2, 11.9),
]
BG, FONT_PATH = "#07040c", "/usr/share/fonts/opentype/inter/Inter-Black.otf"
YELLOW, WHITE = (255, 214, 0), (255, 255, 255)


# ---------- voice ------------------------------------------------------------------------------
def synth_lines():
    from piper import PiperVoice, SynthesisConfig
    v = PiperVoice.load(VOICE)
    cfg = SynthesisConfig(length_scale=0.92, noise_scale=0.8, noise_w_scale=0.9)
    out = []
    for text, start, end in LINES:
        chunks = [c.audio_float_array for c in v.synthesize(text.capitalize(), cfg)]
        a = np.concatenate(chunks).astype(np.float32)
        sr = v.config.sample_rate
        # trim silence
        idx = np.where(np.abs(a) > 0.02)[0]
        a = a[idx[0]:idx[-1] + 1]
        # fit the window, speeding up (pitch-preserving) if needed
        dur = len(a) / sr
        if dur > end - start:
            a = tempo(a, sr, dur / (end - start))
        a = np.interp(np.linspace(0, len(a) - 1, int(len(a) * SR / sr)), np.arange(len(a)), a).astype(np.float32)
        out.append(a / np.abs(a).max() * 0.95)
    return out


def tempo(a, sr, factor):
    """Speed audio up by `factor` without changing pitch (ffmpeg atempo)."""
    p = subprocess.run(["ffmpeg", "-v", "error", "-f", "f32le", "-ar", str(sr), "-ac", "1", "-i", "-", "-filter:a", f"atempo={factor}",
                        "-f", "f32le", "-"], input=a.tobytes(), capture_output=True, check=True)
    return np.frombuffer(p.stdout, dtype=np.float32).copy()


# ---------- music + sfx ------------------------------------------------------------------------
def env(n, a=0.002, d=0.2):
    t = np.arange(n) / SR
    return np.minimum(1, t / a) * np.exp(-t / d)


def tone(freq, dur, kind="sine", d=0.15, a=0.002):
    n = int(dur * SR); t = np.arange(n) / SR
    f = freq if np.ndim(freq) else np.full(n, freq)
    ph = 2 * np.pi * np.cumsum(f) / SR
    w = {"sine": np.sin(ph), "saw": 2 * ((ph / (2 * np.pi)) % 1) - 1, "sq": np.sign(np.sin(ph))}[kind]
    return w * env(n, a, d)


def noise(dur, d=0.08, seed=0):
    n = int(dur * SR)
    return np.random.default_rng(seed).uniform(-1, 1, n) * env(n, 0.001, d)


def sweep(f0, f1, dur, kind="saw", d=0.3):
    n = int(dur * SR)
    return tone(np.linspace(f0, f1, n), dur, kind, d)


def mix(*parts):
    n = max(len(p) for p in parts)
    return sum(np.pad(p, (0, n - len(p))) for p in parts)


def arp(freqs, step, dur, kind, d, gain):
    return mix(*[gain * np.pad(tone(f, dur, kind, d), (int(i * step * SR), 0)) for i, f in enumerate(freqs)])


SFX = {
    "hit":    lambda: mix(0.6 * noise(0.12, 0.04, 1), 0.7 * sweep(220, 70, 0.14, "sine", 0.06)),
    "crit":   lambda: mix(0.7 * noise(0.2, 0.06, 2), 0.9 * sweep(260, 50, 0.22, "sine", 0.09), 0.35 * tone(1318, 0.45, "sine", 0.18), 0.25 * tone(1975, 0.45, "sine", 0.18)),
    "hurt":   lambda: mix(0.7 * noise(0.2, 0.07, 3), 0.9 * sweep(160, 45, 0.3, "sine", 0.12)),
    "fizzle": lambda: 0.45 * sweep(420, 90, 0.4, "saw", 0.2) * (0.6 + 0.4 * np.sin(np.arange(int(0.4 * SR)) / SR * 70)),
    "curse":  lambda: mix(0.6 * sweep(120, 40, 0.7, "saw", 0.3), 0.5 * noise(0.3, 0.1, 4), 0.3 * tone(233, 0.6, "sq", 0.25)),
    "death":  lambda: mix(0.7 * sweep(330, 35, 1.1, "saw", 0.5), 0.6 * noise(0.9, 0.3, 5)),
    "win":    lambda: arp([523, 659, 784, 1047], 0.07, 0.3, "sq", 0.12, 0.4),
    "coin":   lambda: arp([988, 1319], 0.07, 0.2, "sq", 0.08, 0.4),
    "loot":   lambda: arp([659, 784, 988, 1319, 1568], 0.06, 0.25, "sine", 0.15, 0.35),
    "whoosh": lambda: 0.5 * noise(0.22, 0.12, 6) * np.linspace(0.2, 1, int(0.22 * SR)),
}
CUES = {"PERFECT!": "hit", "GOOD": "hit", "CRITICAL!": "crit", "FIZZLE - AGAIN!": "fizzle", "CURSED!": "curse",
        "DEFEAT": "death", "VICTORY": "win", "COIN": "coin", "LOOT": "loot", "DIALOG": "whoosh"}


def put(track, sound, t, gain=1.0):
    i = int(t * SR)
    if i < 0 or i >= len(track):
        return
    s = sound[: len(track) - i]
    track[i:i + len(s)] += s * gain


def music():
    m = np.zeros(int(TOTAL * SR) + SR)
    bpm = 150; beat = 60 / bpm
    root = [55.0, 55.0, 65.41, 49.0]            # A1 A1 C2 G1: dark, driving
    for b in range(int(TOTAL / beat) + 1):
        t = b * beat
        if b % 2 == 0: put(m, 0.9 * sweep(130, 45, 0.18, "sine", 0.1), t, 0.7)           # kick
        if b % 4 == 2: put(m, 0.6 * noise(0.14, 0.06, b), t, 0.5)                         # snare
        put(m, 0.3 * noise(0.04, 0.015, b + 99), t + beat / 2, 0.3)                       # hat
        f = root[(b // 4) % 4]
        put(m, 0.5 * tone(f, beat * 0.9, "saw", 0.2), t, 0.35)                           # bass
        arp = f * 4 * [1, 1.2, 1.5, 1.2][b % 4]
        put(m, 0.3 * tone(arp, beat * 0.5, "sq", 0.1), t + beat / 2, 0.25)               # arp
    return m


def build_audio():
    voice = synth_lines()
    track = music() * 0.55
    for scene, t0, _ in SCENES:
        put(track, SFX["whoosh"](), t0 - 0.03 if t0 else 0, 1.0)
        for e in json.load(open(FRAMES / scene / "events.json")):
            k = CUES.get(e["text"])
            if k:
                put(track, SFX[k](), t0 + e["t"], 0.9)
            elif e["text"].startswith("-") and e["text"][1:].isdigit():
                put(track, SFX["hurt"](), t0 + e["t"], 0.9)
    for a, (_, start, _) in zip(voice, LINES):
        # duck the bed under each line
        i, n = int(start * SR), len(a)
        track[i:i + n] *= 0.45
        put(track, a, start, 1.0)
    track = track[: int(TOTAL * SR)]
    track = np.tanh(track * 1.3) / np.tanh(1.3)
    pcm = (track / max(1e-6, np.abs(track).max()) * 0.92 * 32767).astype(np.int16)
    p = Path(OUT).with_suffix(".wav")
    with wave.open(str(p), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    return p, voice


# ---------- captions ---------------------------------------------------------------------------
def word_times(voice):
    """Spread each line's words over its voice span in proportion to word length."""
    out = []
    for (text, start, _), a in zip(LINES, voice):
        words = text.split(); dur = len(a) / SR
        w = np.array([len(x.strip("?!")) + 1.5 for x in words]); w = w / w.sum() * dur
        t = start
        for word, d in zip(words, w):
            out.append((word, t, t + d)); t += d
    print("voice spans:", [(w, round(a, 2), round(b, 2)) for w, a, b in out])
    return out


def caption_groups(words):
    """Group words into on-screen lines of caption (one line of speech at a time, split in two rows)."""
    groups, i = [], 0
    for (text, start, end) in LINES:
        n = len(text.split())
        groups.append(words[i:i + n]); i += n
    return groups


def draw_caption(img, group, until, t, fonts):
    # visible from the first word until the next line starts (the last one holds to the end)
    if not (group[0][1] - 0.02 <= t < until):
        return
    d = ImageDraw.Draw(img)
    # break into rows: "PLAY TODAY!" / "LINK IN DESCRIPTION!" style, or by half
    ws = [g[0] for g in group]
    if len(ws) <= 2:
        rows = [list(range(len(ws)))]
    else:
        rows, cur = [], []
        for k, w in enumerate(ws):
            cur.append(k)
            if w.endswith("!") and k < len(ws) - 1 and not rows:
                rows.append(cur); cur = []
        rows.append(cur)
        if len(rows) == 1:
            half = (len(ws) + 1) // 2
            rows = [list(range(half)), list(range(half, len(ws)))]
    big = len(ws) <= 3
    y = 1120 if big else 1090
    for row in rows:
        size = 190 if big else 112
        sizes = []
        for k in row:
            start = group[k][1]
            active = group[k][1] <= t
            age = max(0.0, t - start)
            pop = 1 + 0.28 * max(0.0, 1 - age / 0.12) if active else 1
            sizes.append(pop)
        fnt = [fonts(int(size * s)) for s in sizes]
        gap = int(size * 0.28)
        widths = [d.textlength(ws[k], font=fnt[j]) for j, k in enumerate(row)]
        total = sum(widths) + gap * (len(row) - 1)
        while total > W - 120:                      # shrink to fit width
            size -= 6
            fnt = [fonts(int(size * s)) for s in sizes]
            widths = [d.textlength(ws[k], font=fnt[j]) for j, k in enumerate(row)]
            total = sum(widths) + gap * (len(row) - 1)
        x = (W - total) / 2
        for j, k in enumerate(row):
            if group[k][1] <= t:                     # words appear as they are spoken
                col = YELLOW if t < group[k][2] else WHITE
                d.text((x, y + int(size * 0.5)), ws[k], font=fnt[j], fill=col, anchor="lm", stroke_width=max(8, size // 11), stroke_fill=(0, 0, 0))
            x += widths[j] + gap
        y += int(size * 1.12)


def banner(img, t):
    if t < 8.1:
        return
    d = ImageDraw.Draw(img)
    f = ImageFont.truetype(FONT_PATH, 64)
    d.text((W / 2, 250), "TAPFIGHTER", font=f, fill=(240, 208, 80), anchor="mm", stroke_width=8, stroke_fill=(20, 8, 30))
    f2 = ImageFont.truetype(FONT_PATH, 40)
    d.text((W / 2, 318), "THE BONEYARD CRAWL", font=f2, fill=WHITE, anchor="mm", stroke_width=6, stroke_fill=(20, 8, 30))


def main():
    wav, voice = build_audio()
    words = word_times(voice)
    groups = caption_groups(words)
    cache = {}
    fonts = lambda s: cache.setdefault(s, ImageFont.truetype(FONT_PATH, s))
    ff = subprocess.Popen(["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                           "-i", str(wav), "-c:v", "libx264", "-preset", "slow", "-crf", "15", "-pix_fmt", "yuv420p", "-r", str(FPS),
                           "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", OUT], stdin=subprocess.PIPE)
    n = int(TOTAL * FPS)
    for i in range(n):
        t = i / FPS
        sc = next(s for s in reversed(SCENES) if t >= s[1] - 1e-9)
        fi = min(int(round((t - sc[1]) * FPS)), int(sc[2] * FPS) - 1)
        img = Image.open(FRAMES / sc[0] / f"f{fi:04d}.png").convert("RGB").resize((W, H), Image.NEAREST)
        for g, nxt in zip(groups, groups[1:] + [None]):
            draw_caption(img, g, nxt[0][1] - 0.02 if nxt else TOTAL + 1, t, fonts)
        banner(img, t)
        ff.stdin.write(img.tobytes())
    ff.stdin.close(); ff.wait()
    print("wrote", OUT)


if __name__ == "__main__":
    main()
