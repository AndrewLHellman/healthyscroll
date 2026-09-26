"""
Spike: can the server pull frames from REAL Instagram Reels?

1. On instagram.com/reels in desktop Chrome, paste bench/ig_hook.js into the
   DevTools console, scroll through a few Reels, then run
       copy(JSON.stringify([...__hs.values()]))
   and paste the clipboard into bench/data/ig_sample.json.
2. Start the service (auth off, local only):
       VISION_REQUIRE_AUTH=false uvicorn vision.main:app --port 8000
3. python -m bench.ig_check ["policy text"]

For each captured Reel this tries the DASH manifest and the smallest MP4, and
prints whether frames came back, how long it took, and the verdict. A 422 with
"no frames extracted" here means Instagram's CDN refused the server (signed
URL / IP / session binding) and the extension will have to fetch media itself.
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import httpx

API = "http://127.0.0.1:8000"
SAMPLE = Path(__file__).resolve().parent / "data" / "ig_sample.json"


def main() -> None:
    policy = sys.argv[1] if len(sys.argv) > 1 else "alcohol, gambling, or gym and workout content"
    reels = json.loads(SAMPLE.read_text(encoding="utf-8"))
    print(f"{len(reels)} reels · policy: {policy!r}\n")

    with httpx.Client(base_url=API, timeout=120) as c:
        for r in reels:
            caption = (r.get("caption") or "").replace("\n", " ")[:70]
            print(f"reel {r['id']} ({r.get('code')}) — {caption!r}")
            for label, body in (
                ("dash", {"manifest": r.get("manifest")}),
                ("mp4 ", {"videoUrl": r.get("videoUrl")}),
            ):
                if not next(iter(body.values())):
                    print(f"   {label}: not in capture")
                    continue
                t0 = time.perf_counter()
                res = c.post("/analyze", json={
                    # Distinct ids so the mp4 path isn't served from the dash path's cache.
                    "videoId": f"{r['id']}-{label.strip()}",
                    "policy": policy,
                    "posterUrl": r.get("poster"),
                    **body,
                })
                ms = (time.perf_counter() - t0) * 1000
                d = res.json()
                if res.status_code == 200:
                    print(f"   {label}: {d['verdict']:<9} p={d['violatesProbability']:.4f} matched={d.get('matched')} "
                          f"frames={d['frames']} framesMs={d['framesMs']:.0f} total={ms:.0f}ms caption={d['captionStatus']}")
                else:
                    print(f"   {label}: HTTP {res.status_code} {str(d.get('detail'))[:90]}")
            print()


if __name__ == "__main__":
    main()
