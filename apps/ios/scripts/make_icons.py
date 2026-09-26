#!/usr/bin/env python3
"""
Render the app and extension icons from the website's mark (apps/web/app/icon.svg),
so the logo has one source. Re-run after the mark changes:

    python3 apps/ios/scripts/make_icons.py

The mark is pixel art (unit rects), so the master is drawn with a whole number of
pixels per cell and only then downsampled. Writes:
  - the iOS app icon (1024, opaque) into the Xcode asset catalog
  - the setup screen's Resources/Icon.png
  - extension icons into apps/extension/public/assets/icons/ (inside assets/, the
    folder the Xcode project references, so Safari gets them without project edits)
"""
import re
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
SVG = ROOT / "apps/web/app/icon.svg"
IOS = ROOT / "apps/ios/Healthy Scroll/Healthy Scroll"
EXT_ICONS = ROOT / "apps/extension/public/assets/icons"

MASTER = 1024
# Mark height as a share of the icon; the rest is padding.
MARK_SHARE = 2 / 3
EXT_SIZES = [16, 32, 48, 96, 128, 256, 512]


def read_mark():
    """Unit rects from icon.svg, minus the full-size background rect."""
    svg = SVG.read_text()
    rects = []
    for attrs in re.findall(r"<rect ([^>]*)/>", svg):
        a = dict(re.findall(r'(\w+)="([^"]*)"', attrs))
        rect = (int(a.get("x", 0)), int(a.get("y", 0)), int(a["width"]), int(a["height"]), a["fill"])
        rects.append(rect)
    background = rects.pop(0)  # the first rect is the tile's background
    return background[4], rects


def render(size: int, background: str, rects) -> Image.Image:
    x0 = min(r[0] for r in rects)
    y0 = min(r[1] for r in rects)
    cols = max(r[0] + r[2] for r in rects) - x0
    rows = max(r[1] + r[3] for r in rects) - y0
    cell = int(size * MARK_SHARE) // rows
    ox = (size - cols * cell) // 2
    oy = (size - rows * cell) // 2

    img = Image.new("RGB", (size, size), background)
    draw = ImageDraw.Draw(img)
    for x, y, w, h, fill in rects:
        left, top = ox + (x - x0) * cell, oy + (y - y0) * cell
        draw.rectangle([left, top, left + w * cell - 1, top + h * cell - 1], fill=fill)
    return img


def main():
    background, rects = read_mark()
    master = render(MASTER, background, rects)

    appicon = IOS / "Assets.xcassets/AppIcon.appiconset"
    master.save(appicon / "AppIcon.png")
    master.resize((256, 256), Image.LANCZOS).save(IOS / "Resources/Icon.png")

    EXT_ICONS.mkdir(parents=True, exist_ok=True)
    for size in EXT_SIZES:
        master.resize((size, size), Image.LANCZOS).save(EXT_ICONS / f"icon-{size}.png")
    print(f"wrote {appicon / 'AppIcon.png'}, Resources/Icon.png, {len(EXT_SIZES)} extension icons")


if __name__ == "__main__":
    main()
