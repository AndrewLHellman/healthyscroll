"""
End-to-end check of a running vision service (auth off): DASH manifest, MP4 URL,
poster frame, shared media cache, caption polling, error paths.
Uses bench/data/smoke served over HTTP:

    python -m http.server 8765 --directory bench/data/smoke     # terminal 1
    VISION_REQUIRE_AUTH=false uvicorn vision.main:app --port 8000  # terminal 2
    python -m bench.api_check                                    # terminal 3

Needs bench/data/smoke/dash/roulette.mpd and poster_brunch.jpg (see README).
"""

from __future__ import annotations

import time
from pathlib import Path

import httpx

BASE = "http://127.0.0.1:8000"
FILES = "http://127.0.0.1:8765"
SMOKE = Path(__file__).resolve().parent / "data" / "smoke"


def show(label: str, res: httpx.Response) -> dict:
    data = res.json()
    if res.status_code != 200:
        print(f"{label:<30} {res.status_code} {str(data.get('detail'))[:70]}")
        return data
    print(
        f"{label:<30} {res.status_code} frames={data['frames']} mediaCached={data['mediaCached']!s:<5} "
        f"framesMs={data['framesMs']:.0f} totalMs={data['totalMs']:.0f} [{data['captionStatus']}] {data.get('caption')!r}"
    )
    return data


def main() -> None:
    manifest = (SMOKE / "dash" / "roulette.mpd").read_text()
    # Instagram's BaseURLs are absolute CDN URLs; make ours absolute too.
    manifest = manifest.replace("<BaseURL>", f"<BaseURL>{FILES}/dash/")
    casino = f"{FILES}/clips/casino.mp4"
    brunch = f"{FILES}/clips/brunch.mp4"

    with httpx.Client(base_url=BASE, timeout=60) as c:
        print(c.get("/health").json())
        show("casino (1st user)", c.post("/describe", json={"videoId": "casino", "videoUrl": casino}))
        show("casino (2nd user, cached)", c.post("/describe", json={"videoId": "casino", "videoUrl": casino}))
        show("roulette via DASH", c.post("/describe", json={"videoId": "roulette", "manifest": manifest}))
        show("unonight (lookalike)", c.post("/describe", json={"videoId": "uno", "videoUrl": f"{FILES}/clips/unonight.mp4"}))

        data = show(
            "brunch+poster",
            c.post("/describe", json={"videoId": "brunch", "videoUrl": brunch, "posterUrl": f"{FILES}/poster_brunch.jpg"}),
        )
        if data.get("captionStatus") == "pending":
            t0 = time.perf_counter()
            while True:
                m = c.get("/media/instagram/brunch").json()
                if m["captionStatus"] != "pending":
                    break
                time.sleep(0.2)
            print(f"{'  caption after':<30} {(time.perf_counter() - t0) * 1000:.0f} ms [{m['captionStatus']}] {m['caption']!r}")

        show("bad manifest -> 422", c.post("/describe", json={"videoId": "bad", "manifest": "<MPD"}))
        show("missing video -> 422", c.post("/describe", json={"videoId": "gone", "videoUrl": f"{FILES}/nope.mp4"}))
        show("no source -> 422", c.post("/describe", json={"videoId": "none"}))
        print(f"{'unknown reel poll':<30} {c.get('/media/instagram/never-seen').status_code}")


if __name__ == "__main__":
    main()
