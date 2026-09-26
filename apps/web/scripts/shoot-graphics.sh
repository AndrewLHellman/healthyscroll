#!/usr/bin/env bash
# Screenshot every frame in components/frames/index.tsx at 2× into public/graphics/.
# Needs the dev server on :3000 and google-chrome-stable.
set -euo pipefail
cd "$(dirname "$0")/.."
out=public/graphics
mkdir -p "$out"
while IFS=' ' read -r slug w h; do
  google-chrome-stable --headless=new --disable-gpu --hide-scrollbars \
    --force-device-scale-factor=2 --window-size="$w,$((h + 200))" \
    --screenshot="/tmp/hs-$slug.png" "http://localhost:3000/graphics/$slug" 2>/dev/null
  # headless Chrome loses ~88px of the window to chrome, so shoot tall and crop to size.
  magick "/tmp/hs-$slug.png" -crop "$((w * 2))x$((h * 2))+0+0" +repage "$out/$slug.png"
  echo "$out/$slug.png"
done < <(grep -oE 'slug: "[a-z-]+".*size: (OG|SQUARE|DEVPOST)' components/frames/index.tsx \
  | sed -E 's/slug: "([a-z-]+)".*size: OG/\1 1200 630/; s/slug: "([a-z-]+)".*size: SQUARE/\1 1080 1080/; s/slug: "([a-z-]+)".*size: DEVPOST/\1 1500 1000/')
