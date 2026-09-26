"""
Generate a tiny synthetic dataset (bench/data/smoke) to check the plumbing:
ffmpeg -> frames -> every scorer -> report. Clips are solid colours with big
on-screen text, so this measures latency and "does it run", NOT real accuracy.
Real accuracy needs real Reels in bench/data/reels (see bench/README.md).

    python -m bench.make_smoke_set
"""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

from vision.config import settings

OUT = Path(__file__).resolve().parent / "data" / "smoke"
FONT = "C\\:/Windows/Fonts/arialbd.ttf"  # ffmpeg filter syntax escapes the drive colon

CLIPS = {
    "casino.mp4": ("0x1a5c1a", ["CASINO NIGHT", "JACKPOT 777", "BET IT ALL"]),
    "beer.mp4": ("0x7a4a00", ["HAPPY HOUR", "5 BEERS DEEP", "SHOTS SHOTS SHOTS"]),
    "gym.mp4": ("0x202a44", ["LEG DAY", "SQUAT 405 LBS", "GYM GAINS"]),
    "puppy.mp4": ("0xf2c6d8", ["PUPPY FIRST BATH", "SO FLUFFY", "GOOD BOY"]),
    "pasta.mp4": ("0xd8e8c0", ["EASY PASTA", "ADD GARLIC", "DINNER IN 10 MIN"]),
    "sad.mp4": ("0x111111", ["NOBODY CARES", "I FEEL SO ALONE", "WHATS THE POINT"]),
    # Harder: the category has to be inferred, not read off the screen.
    "roulette.mp4": ("0x5c0a0a", ["SPIN TO WIN", "RED OR BLACK?", "DOUBLE OR NOTHING"]),
    "brunch.mp4": ("0xe0a060", ["BOTTOMLESS MIMOSAS", "BRUNCH WITH THE GIRLS", "ANOTHER ROUND"]),
    "run.mp4": ("0x0a4a5c", ["5AM RUN CLUB", "10K PERSONAL BEST", "NO DAYS OFF"]),
    "rain.mp4": ("0x2a2a3a", ["ANOTHER NIGHT ALONE", "THEY ALL LEFT", "TIRED OF TRYING"]),
    # Lookalikes that should NOT match.
    "unonight.mp4": ("0x3a6ea5", ["FAMILY GAME NIGHT", "UNO WITH GRANDMA", "SHE WON AGAIN"]),
    "rootbeer.mp4": ("0x6b3a1e", ["ROOT BEER FLOATS", "KIDS TREAT", "VANILLA ICE CREAM"]),
}

POLICIES = {
    "gambling, casinos or sports betting": {"casino.mp4", "roulette.mp4"},
    "alcohol and drinking": {"beer.mp4", "brunch.mp4"},
    "gym and workout content": {"gym.mp4", "run.mp4"},
    "sad or depressing content": {"sad.mp4", "rain.mp4"},
}


def make_clip(path: Path, color: str, captions: list[str]) -> None:
    # Three captions, one per 2.7 s window, so frames at 0.5/3/6 s see different text.
    draws = ",".join(
        f"drawtext=fontfile='{FONT}':text='{c}':fontcolor=white:fontsize=72:"
        f"x=(w-text_w)/2:y=(h-text_h)/2:enable='gte(t,{i * 2.7:.1f})*lt(t,{(i + 1) * 2.7:.1f})'"
        for i, c in enumerate(captions)
    )
    subprocess.run(
        [settings.ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
         "-f", "lavfi", "-i", f"color=c={color}:s=720x1280:d=8:r=30",
         "-vf", draws, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(path)],
        check=True,
    )


def main() -> None:
    (OUT / "clips").mkdir(parents=True, exist_ok=True)
    for name, (color, captions) in CLIPS.items():
        make_clip(OUT / "clips" / name, color, captions)
    rows = [
        {"clip": clip, "policy": policy, "label": clip in positives}
        for policy, positives in POLICIES.items()
        for clip in CLIPS
    ]
    (OUT / "labels.jsonl").write_text("\n".join(json.dumps(r) for r in rows) + "\n")
    print(f"{len(CLIPS)} clips, {len(rows)} rows -> {OUT}")


if __name__ == "__main__":
    main()
