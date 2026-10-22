#!/usr/bin/env python3
"""Assemble a Tapfighter TikTok from recorded scene frames.

  python3 build.py <frames_dir> <piper_voice.onnx> <out.mp4> [v1|v2]

frames_dir holds one folder per scene (see record.sh and VARIANTS). Voice is Piper TTS; music and SFX are synthesized here.
"""
import json, subprocess, sys, wave
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont

FRAMES, VOICE, OUT = Path(sys.argv[1]), sys.argv[2], sys.argv[3]
VARIANT = sys.argv[4] if len(sys.argv) > 4 else "v1"
SR, FPS, W, H = 44100, 60, 1080, 1920
# Per video: scene dirs (name, start s, length s), total length, caption lines (text, voice start s, latest end s;
# "/" breaks a caption row), when the title banner shows, and the music tempo.
VARIANTS = {
    "v1": dict(  # "Hardest game ever?"
        scenes=[("s1", 0.0, 2.7), ("s2", 2.7, 2.6), ("s3", 5.3, 2.8), ("s4", 8.1, 3.9)], total=12.0, banner=8.1, bpm=150,
        lines=[("HARDEST GAME/EVER?", 0.12, 2.55), ("IMPOSSIBLE?", 2.82, 5.2), ("TOO EASY?", 5.42, 7.9),
               ("PLAY TODAY!/LINK IN DESCRIPTION!", 8.2, 11.9)]),
    "v2": dict(  # "Can you master this timing?"
        scenes=[("s1", 0.0, 10.0), ("s2", 10.0, 3.0)], total=13.0, banner=10.0, bpm=125,
        lines=[("CAN YOU MASTER/THIS TIMING?", 0.2, 2.9), ("PLAY NOW IN/YOUR BROWSER!/LINK IN BIO/AND COMMENTS", 10.1, 12.9)],
        hold=[3.6, None], backing=[False, True]),
}
V = VARIANTS[VARIANT]
SCENES, TOTAL, LINES = V["scenes"], V["total"], V["lines"]
HOLD = V.get("hold", [None] * len(LINES))      # caption stays up until this time (default: next line)
BACKING = V.get("backing", [False] * len(LINES))   # dark panel behind a caption
BG, FONT_PATH = "#07040c", "/usr/share/fonts/opentype/inter/Inter-Black.otf"
YELLOW, WHITE = (255, 214, 0), (255, 255, 255)


# ---------- voice ------------------------------------------------------------------------------
def synth_lines():
    from piper import PiperVoice, SynthesisConfig
    v = PiperVoice.load(VOICE)
    cfg = SynthesisConfig(length_scale=0.92, noise_scale=0.8, noise_w_scale=0.9)
    out = []
    for text, start, end in LINES:
        chunks = [c.audio_float_array for c in v.synthesize(text.replace('/', ' ').capitalize(), cfg)]
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
    "parry":  lambda: mix(0.5 * noise(0.1, 0.03, 7), 0.5 * tone(1760, 0.25, "sq", 0.07), 0.3 * tone(2637, 0.2, "sine", 0.06)),
    "smash":  lambda: mix(0.5 * noise(0.1, 0.04, 8), 0.6 * sweep(600, 200, 0.12, "sine", 0.05)),
    "miss":   lambda: 0.5 * sweep(200, 110, 0.18, "saw", 0.08),
    "buy":    lambda: arp([1175, 1568, 2349], 0.05, 0.18, "sq", 0.07, 0.35),
    "rise":   lambda: 0.5 * sweep(150, 900, 0.7, "saw", 0.5) * np.linspace(0.1, 1, int(0.7 * SR)),
    "whoosh": lambda: 0.5 * noise(0.22, 0.12, 6) * np.linspace(0.2, 1, int(0.22 * SR)),
}
CUES = {"PERFECT!": "hit", "GOOD": "hit", "CRITICAL!": "crit", "FIZZLE - AGAIN!": "fizzle", "CURSED!": "curse",
        "DEFEAT": "death", "VICTORY": "win", "COIN": "coin", "LOOT": "loot", "DIALOG": "whoosh",
        "PARRY!": "parry", "SMASH!": "smash", "MISS": "miss", "BUY": "buy", "RHYTHM": "rise", "BURN": None}
PENTA = [57, 60, 62, 64, 67, 69, 72, 69, 67, 64]     # A minor pentatonic, for rhythm-note plucks


def put(track, sound, t, gain=1.0):
    i = int(t * SR)
    if i < 0 or i >= len(track):
        return
    s = sound[: len(track) - i]
    track[i:i + len(s)] += s * gain


def music(bpm):
    m = np.zeros(int(TOTAL * SR) + SR)
    beat = 60 / bpm
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
    notes_hit = 0
    track = music(V['bpm']) * 0.55
    for scene, t0, _ in SCENES:
        put(track, SFX["whoosh"](), t0 - 0.03 if t0 else 0, 1.0)
        for e in json.load(open(FRAMES / scene / "events.json")):
            if e["text"] in ("PERFECT", "GOOD"):           # rhythm note: a pluck in key
                midi = PENTA[notes_hit % len(PENTA)]; notes_hit += 1
                put(track, 0.5 * tone(440 * 2 ** ((midi - 69) / 12), 0.3, "sq", 0.12) + 0.3 * tone(440 * 2 ** ((midi - 81) / 12), 0.3, "sine", 0.15), t0 + e["t"])
                continue
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
    """Spread each line's words over its voice span in proportion to word length.
    Returns, per line, a list of rows; each row is a list of (word, start, end)."""
    groups = []
    for (text, start, _), a in zip(LINES, voice):
        rows = [r.split() for r in text.split("/")]
        flat = [w for r in rows for w in r]
        dur = len(a) / SR
        w = np.array([len(x.strip("?!")) + 1.5 for x in flat]); w = w / w.sum() * dur
        t, i, out = start, 0, []
        for r in rows:
            row = []
            for word in r:
                row.append((word, t, t + w[i])); t += w[i]; i += 1
            out.append(row)
        groups.append(out)
    return groups


def draw_caption(img, rows, until, t, fonts, backing=False):
    # visible from the first word until the next line starts (the last one holds to the end)
    if not (rows[0][0][1] - 0.02 <= t < until):
        return
    d = ImageDraw.Draw(img)
    nwords = sum(len(r) for r in rows)
    base = 190 if nwords <= 3 else 120 if len(rows) <= 2 else 104
    heights = [int(base * 1.12)] * len(rows)
    y = 1130 - sum(heights) // 2
    if backing:
        panel = Image.new("RGBA", img.size, (0, 0, 0, 0))
        ImageDraw.Draw(panel).rounded_rectangle((70, y - 24, W - 70, y + sum(heights) + 16), 36, fill=(8, 4, 16, 235))
        img.paste(panel, (0, 0), panel)
        d = ImageDraw.Draw(img)
    for row, hgt in zip(rows, heights):
        size = base
        pops = [1 + 0.28 * max(0.0, 1 - (t - w[1]) / 0.12) if w[1] <= t else 1 for w in row]
        while True:
            fnt = [fonts(int(size * p)) for p in pops]
            widths = [d.textlength(w[0], font=f) for w, f in zip(row, fnt)]
            gap = int(size * 0.28)
            total = sum(widths) + gap * (len(row) - 1)
            if total <= W - 120:
                break
            size -= 6
        x = (W - total) / 2
        for w, f, wd in zip(row, fnt, widths):
            if w[1] <= t:                              # words appear as they are spoken
                col = YELLOW if t < w[2] else WHITE
                d.text((x, y + hgt // 2), w[0], font=f, fill=col, anchor="lm", stroke_width=max(8, size // 11), stroke_fill=(0, 0, 0))
            x += wd + gap
        y += hgt


def banner(img, t):
    if t < V['banner']:
        return
    d = ImageDraw.Draw(img)
    f = ImageFont.truetype(FONT_PATH, 64)
    d.text((W / 2, 250), "TAPFIGHTER", font=f, fill=(240, 208, 80), anchor="mm", stroke_width=8, stroke_fill=(20, 8, 30))
    f2 = ImageFont.truetype(FONT_PATH, 40)
    d.text((W / 2, 318), "THE BONEYARD CRAWL", font=f2, fill=WHITE, anchor="mm", stroke_width=6, stroke_fill=(20, 8, 30))


def main():
    wav, voice = build_audio()
    words = word_times(voice)
    groups = words
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
        for g, nxt, hold, bk in zip(groups, groups[1:] + [None], HOLD, BACKING):
            until = nxt[0][0][1] - 0.02 if nxt else TOTAL + 1
            draw_caption(img, g, min(until, hold) if hold else until, t, fonts, bk)
        banner(img, t)
        ff.stdin.write(img.tobytes())
    ff.stdin.close(); ff.wait()
    print("wrote", OUT)


if __name__ == "__main__":
    main()
