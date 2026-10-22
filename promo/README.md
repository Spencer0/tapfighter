# Tapfighter TikToks (1080x1920)

## 1. `tapfighter-tiktok.mp4` (12s): "Hardest game ever?"

`tapfighter-tiktok.mp4` is made from the real game: a bot plays each scene in headless Chromium on a
virtual 60fps clock, frames are captured pixel-exact, then captions, a Piper TTS voice and synthesized
music/SFX are added.

| Time | Voice (+ captions) | Footage |
| --- | --- | --- |
| 0.0-2.7s | "Hardest game ever?" | Lich Morthos (floor 15 boss) kills Sir Rattlebone |
| 2.7-5.3s | "Impossible?" | A Witch Mark rune is traced wrong: FIZZLE, FIZZLE, CURSED |
| 5.3-8.1s | "Too easy?" | Three CRITICAL hits in a row kill a skeleton |
| 8.1-12.0s | "Play today! Link in description!" | Running the map, grabbing an Epic axe and a Legendary crossbow |

## 2. `tapfighter-timing-tiktok.mp4` (13s): "Can you master this timing?"

| Time | Voice (+ captions) | Footage |
| --- | --- | --- |
| 0-10s | "Can you master this timing?" | Pumpkin King (first boss): perfect strikes and parries, then the rhythm encore ("Harvest Hoedown") where Sir Rattlebone misses notes and dies |
| 10-13s | "Play now in your browser! Link in bio and comments" | Walking the map and shopping with the merchant (buying a weapon) |

## Rebuild

```sh
python3 -m http.server 8765 &                 # serve the repo root
pip install piper-tts pillow numpy            # plus: node + playwright, ffmpeg
# voice model: https://huggingface.co/rhasspy/piper-voices (en_US-ryan-high)
promo/record.sh v1 /tmp/promo-frames          # scenes -> PNG frames + sound cues (v2 for the second video)
python3 promo/build.py /tmp/promo-frames en_US-ryan-high.onnx promo/tapfighter-tiktok.mp4 v1
```

`bot.js` defines the scenes (edit them there), `capture.mjs` drives the browser, `build.py` does voice, captions and mixing.
