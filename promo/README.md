# Tapfighter TikTok (12s, 1080x1920)

`tapfighter-tiktok.mp4` is made from the real game: a bot plays each scene in headless Chromium on a
virtual 60fps clock, frames are captured pixel-exact, then captions, a Piper TTS voice and synthesized
music/SFX are added.

| Time | Voice (+ captions) | Footage |
| --- | --- | --- |
| 0.0-2.7s | "Hardest game ever?" | Lich Morthos (floor 15 boss) kills Sir Rattlebone |
| 2.7-5.3s | "Impossible?" | A Witch Mark rune is traced wrong: FIZZLE, FIZZLE, CURSED |
| 5.3-8.1s | "Too easy?" | Three CRITICAL hits in a row kill a skeleton |
| 8.1-12.0s | "Play today! Link in description!" | Running the map, grabbing an Epic axe and a Legendary crossbow |

## Rebuild

```sh
python3 -m http.server 8765 &                 # serve the repo root
pip install piper-tts pillow numpy            # plus: node + playwright, ffmpeg
# voice model: https://huggingface.co/rhasspy/piper-voices (en_US-ryan-high)
promo/record.sh /tmp/promo-frames             # scenes -> PNG frames + sound cues
python3 promo/build.py /tmp/promo-frames en_US-ryan-high.onnx promo/tapfighter-tiktok.mp4
```

`bot.js` defines the scenes (edit them there), `capture.mjs` drives the browser, `build.py` does voice, captions and mixing.
