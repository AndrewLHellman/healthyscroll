"""
Benchmark every scorer on the same labeled clips.

    python -m bench.run --models qwen3-vl-2b lfm2-vl-450m siglip2-base
    python -m bench.run --data bench/data/smoke          # synthetic plumbing check

Dataset layout (bench/data/<set>/):
    clips/*.mp4          short videos (screen recordings of Reels are fine)
    labels.jsonl         one line per (clip, policy):
                         {"clip": "slots.mp4", "policy": "gambling", "label": true}

Frames are extracted once per clip with the exact code /analyze uses, then each
model is loaded, warmed up, run over every row, and unloaded. Output: a
markdown table (bench/results/<time>.md) + per-row CSV.
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import gc
import json
import statistics
import sys
import time
from datetime import datetime
from pathlib import Path

from vision.config import settings
from vision.frames import Frames, VideoSource, extract_frames
from vision.scorers import REGISTRY, build_scorer

ROOT = Path(__file__).resolve().parent
DEFAULT_MODELS = ["siglip2-base", "smolvlm2-500m", "lfm2-vl-450m", "lfm2-vl-1.6b", "qwen3-vl-2b"]


def load_rows(data: Path) -> list[dict]:
    rows = [json.loads(line) for line in (data / "labels.jsonl").read_text().splitlines() if line.strip()]
    missing = {r["clip"] for r in rows if not (data / "clips" / r["clip"]).exists()}
    if missing:
        sys.exit(f"missing clips: {sorted(missing)}")
    return rows


async def load_frames(data: Path, clips: set[str]) -> dict[str, Frames]:
    out: dict[str, Frames] = {}
    for clip in sorted(clips):
        frames = await extract_frames(VideoSource(path=str(data / "clips" / clip)))
        if not frames.images:
            sys.exit(f"no frames from {clip}")
        out[clip] = frames
    return out


def auroc(scores: list[float], labels: list[bool]) -> float | None:
    pos = [s for s, y in zip(scores, labels) if y]
    neg = [s for s, y in zip(scores, labels) if not y]
    if not pos or not neg:
        return None
    wins = sum((p > n) + 0.5 * (p == n) for p in pos for n in neg)
    return wins / (len(pos) * len(neg))


def best_f1(scores: list[float], labels: list[bool]) -> tuple[float, float]:
    """(F1, threshold) at the threshold that maximizes F1 — for calibrating each model."""
    best = (0.0, 0.5)
    for t in sorted(set(scores)):
        tp = sum(s >= t and y for s, y in zip(scores, labels))
        fp = sum(s >= t and not y for s, y in zip(scores, labels))
        fn = sum(s < t and y for s, y in zip(scores, labels))
        f1 = 2 * tp / (2 * tp + fp + fn) if tp else 0.0
        if f1 > best[0]:
            best = (f1, t)
    return best


def pct(values: list[float], q: float) -> float:
    values = sorted(values)
    return values[min(len(values) - 1, int(round(q * (len(values) - 1))))]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", type=Path, default=ROOT / "data" / "reels")
    ap.add_argument("--models", nargs="+", default=DEFAULT_MODELS, choices=list(REGISTRY))
    ap.add_argument("--no-quantize", action="store_true", help="bf16 weights (server GPUs)")
    args = ap.parse_args()

    rows = load_rows(args.data)
    frames = asyncio.run(load_frames(args.data, {r["clip"] for r in rows}))
    frame_ms = [f.elapsed_ms for f in frames.values()]
    print(f"{len(rows)} rows, {len(frames)} clips, frame extraction p50 {statistics.median(frame_ms):.0f} ms")

    summary: list[dict] = []
    per_row: list[dict] = []
    for name in args.models:
        print(f"\n== {name}")
        t0 = time.perf_counter()
        try:
            scorer = build_scorer(name, quantize=not args.no_quantize)
        except Exception as err:  # missing key, OOM, Station not running...
            print(f"   skipped: {err}")
            summary.append({"model": name, "error": str(err)[:120]})
            continue
        load_s = time.perf_counter() - t0

        first = rows[0]
        scorer.score(frames[first["clip"]].images, first["policy"])  # warm-up (CUDA init, kernels)

        probs, labels, lats = [], [], []
        for r in rows:
            s = scorer.score(frames[r["clip"]].images, r["policy"])
            probs.append(s.probability)
            labels.append(bool(r["label"]))
            lats.append(s.latency_ms)
            per_row.append({"model": name, **r, "p": round(s.probability, 4), "ms": round(s.latency_ms, 1)})
            print(f"   {r['clip']:<24} {r['policy'][:30]:<30} label={int(r['label'])} p={s.probability:.3f} {s.latency_ms:6.0f} ms")

        scorer.close()
        del scorer
        gc.collect()

        acc = sum((p >= 0.5) == y for p, y in zip(probs, labels)) / len(rows)
        f1, thr = best_f1(probs, labels)
        auc = auroc(probs, labels)
        summary.append({
            "model": name,
            "auroc": auc,
            "acc@0.5": acc,
            "bestF1": f1,
            "thr": thr,
            "p50ms": statistics.median(lats),
            "p95ms": pct(lats, 0.95),
            "load_s": load_s,
        })

    write_report(args, rows, frame_ms, summary, per_row)


def write_report(args, rows, frame_ms, summary, per_row) -> None:
    out_dir = ROOT / "results"
    out_dir.mkdir(exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")

    lines = [
        f"# Vision benchmark — {stamp}",
        "",
        f"Data: `{args.data.name}` · {len(rows)} rows · 1 frame / {settings.frame_every_s:g} s, max {settings.max_frames}, "
        f"{settings.frame_long_side} px · frame extraction p50 "
        f"{statistics.median(frame_ms):.0f} ms (local files) · quantize: {not args.no_quantize}",
        "",
        "| model | AUROC | acc@0.5 | best F1 (thr) | p50 ms | p95 ms | load s |",
        "|---|---|---|---|---|---|---|",
    ]
    ranked = sorted(summary, key=lambda s: -(s.get("auroc") or -1))
    for s in ranked:
        if "error" in s:
            lines.append(f"| {s['model']} | — | — | — | — | — | skipped: {s['error']} |")
            continue
        auc = f"{s['auroc']:.3f}" if s["auroc"] is not None else "n/a"
        lines.append(
            f"| {s['model']} | {auc} | {s['acc@0.5']:.2f} | {s['bestF1']:.2f} ({s['thr']:.2f}) "
            f"| {s['p50ms']:.0f} | {s['p95ms']:.0f} | {s['load_s']:.0f} |"
        )
    lines += [
        "",
        "AUROC: how well the probability separates skip from keep, independent of threshold (1.0 = perfect).",
        "Latency is model time only on this machine's GPU; add frame extraction and network for end-to-end.",
    ]
    md = out_dir / f"{stamp}.md"
    md.write_text("\n".join(lines) + "\n", encoding="utf-8")

    with open(out_dir / f"{stamp}.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(per_row[0]) if per_row else ["model"])
        w.writeheader()
        w.writerows(per_row)

    print("\n" + "\n".join(lines[4:4 + len(ranked) + 2]))
    print(f"\nreport: {md}")


if __name__ == "__main__":
    main()
