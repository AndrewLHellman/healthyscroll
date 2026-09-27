#!/usr/bin/env bash
# Assemble the demo intro: the team's cameras (cropped out of the meeting
# recording as one wide strip) laid along the bottom of the `video-*` graphics,
# with the landing-page screen recording in the stage window for one segment.
#
#   scripts/demo-video.sh cameras.mp4 landing.mp4 [out.mp4]
#
# Shoot the graphics first (`scripts/shoot-graphics.sh` with dev:web running).
# Tile crops and drop positions match CAMERAS / WINDOW in components/frames.
set -euo pipefail
cd "$(dirname "$0")/.."

cams=${1:?cameras.mp4}
landing=${2:?landing.mp4}
out=${3:-demo-intro.mp4}
g=public/graphics

# Timeline (seconds into the cameras track): where each background starts.
# The last segment is the stage with the landing recording, which starts
# LANDING_FROM seconds into that file. Edit these to match what's being said.
T_TITLE=0
T_PROBLEM=14
T_SOLUTION=34
T_LANDING=48
LANDING_FROM=2
FADE=0.6

total=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$cams")
d_title=$(bc -l <<<"$T_PROBLEM - $T_TITLE + $FADE")
d_problem=$(bc -l <<<"$T_SOLUTION - $T_PROBLEM + $FADE")
d_solution=$(bc -l <<<"$T_LANDING - $T_SOLUTION + $FADE")
d_landing=$(bc -l <<<"$total - $T_LANDING")

# Rounded-corner masks for the camera tiles and the stage window.
tmp=$(mktemp -d)
mask() { magick -size "$1x$2" xc:black -fill white -draw "roundrectangle 0,0,$(($1 - 1)),$(($2 - 1)),$3,$3" "$4"; }
mask 395 218 14 "$tmp/tile.png"
mask 304 218 14 "$tmp/tile4.png"
mask 1310 736 15 "$tmp/window.png"

bg="scale=1920:1080:flags=lanczos,fps=30,format=yuv420p,setsar=1"

ffmpeg -y -hide_banner -loglevel warning -stats \
  -loop 1 -t "$d_title" -i "$g/video-title.png" \
  -loop 1 -t "$d_problem" -i "$g/video-problem.png" \
  -loop 1 -t "$d_solution" -i "$g/video-solution.png" \
  -loop 1 -t "$d_landing" -i "$g/video-stage.png" \
  -ss "$LANDING_FROM" -t "$d_landing" -i "$landing" \
  -i "$cams" \
  -i "$tmp/tile.png" -i "$tmp/tile4.png" -i "$tmp/window.png" \
  -filter_complex "
    [0:v]$bg[s0]; [1:v]$bg[s1]; [2:v]$bg[s2]; [3:v]$bg[stage];
    [4:v]scale=1310:736:flags=lanczos,fps=30,format=rgba[lv]; [lv][8:v]alphamerge[lr];
    [stage][lr]overlay=305:29:shortest=1,format=yuv420p[s3];
    [s0][s1]xfade=transition=fade:duration=$FADE:offset=$T_PROBLEM[x1];
    [x1][s2]xfade=transition=fade:duration=$FADE:offset=$T_SOLUTION[x2];
    [x2][s3]xfade=transition=fade:duration=$FADE:offset=$T_LANDING[bg];
    [5:v]split=4[c1][c2][c3][c4];
    [c1]format=rgba,crop=395:218:12:16[t1]; [t1][6:v]alphamerge[m1];
    [c2]format=rgba,crop=395:218:423:16[t2]; [t2][6:v]alphamerge[m2];
    [c3]format=rgba,crop=395:218:834:16[t3]; [t3][6:v]alphamerge[m3];
    [c4]format=rgba,crop=294:211:1295:16,scale=304:218:flags=lanczos[t4]; [t4][7:v]alphamerge[m4];
    [bg][m1]overlay=194:814[o1]; [o1][m2]overlay=605:814[o2];
    [o2][m3]overlay=1016:814[o3]; [o3][m4]overlay=1427:814,format=yuv420p[v]
  " \
  -map "[v]" -map 5:a \
  -c:v libx264 -preset slow -crf 18 -r 30 -c:a aac -b:a 192k -movflags +faststart -shortest \
  "$out"

rm -rf "$tmp"
echo "$out"
