/**
 * The mark: a pixel phone showing a feed of three cards, and the one worth
 * keeping is a heart. The heart is the classic 9 × 8 pixel heart at 1 unit
 * per pixel; the phone frame and cards are drawn 2 units thick so the heart
 * reads as a small thing inside the phone rather than filling it. 19 × 28
 * units total. Drawn as rects with crispEdges so it stays pixel-sharp when
 * the height is a multiple of 28.
 */
export const MARK_COLS = 19;
export const MARK_ROWS = 28;

/** The classic 9 × 8 pixel heart. Also used on its own for bullets. */
const HEART = [
  ".##...##.",
  "####.####",
  "#########",
  "#########",
  ".#######.",
  "..#####..",
  "...###...",
  "....#....",
] as const;

/** Frame and cards, in units: [x, y, w, h]. Corners of the frame are left open. */
const FRAME: [number, number, number, number][] = [
  [2, 0, 15, 2],
  [2, 26, 15, 2],
  [0, 2, 2, 24],
  [17, 2, 2, 24],
];
const CARDS: [number, number, number, number][] = [
  [4, 4, 11, 2],
  [4, 22, 11, 2],
];
const HEART_AT = { x: 5, y: 10 };

function cells(grid: readonly string[], colorOf: (ch: string) => string | null, dx = 0, dy = 0) {
  const out: React.ReactNode[] = [];
  grid.forEach((row, r) => {
    [...row].forEach((ch, c) => {
      const fill = colorOf(ch);
      if (fill) out.push(<rect key={`${r}-${c}`} x={c + dx} y={r + dy} width={1} height={1} fill={fill} />);
    });
  });
  return out;
}

export function Mark({
  height = 28,
  frame = "currentColor",
  card = "#c4c8cf",
  heart = "#e5484d",
  className = "",
}: {
  height?: number;
  frame?: string;
  card?: string;
  heart?: string;
  className?: string;
}) {
  const width = Math.round((height * MARK_COLS) / MARK_ROWS);
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${MARK_COLS} ${MARK_ROWS}`}
      shapeRendering="crispEdges"
      aria-hidden
      className={className}
    >
      {FRAME.map(([x, y, w, h]) => <rect key={`f${x}${y}`} x={x} y={y} width={w} height={h} fill={frame} />)}
      {CARDS.map(([x, y, w, h]) => <rect key={`c${y}`} x={x} y={y} width={w} height={h} fill={card} />)}
      {cells(HEART, (ch) => (ch === "#" ? heart : null), HEART_AT.x, HEART_AT.y)}
    </svg>
  );
}

export function PixelHeart({ size = 10, color = "#e5484d", className = "" }: { size?: number; color?: string; className?: string }) {
  return (
    <svg
      width={size}
      height={Math.round((size * 8) / 9)}
      viewBox="0 0 9 8"
      shapeRendering="crispEdges"
      aria-hidden
      className={className}
    >
      {cells(HEART, (ch) => (ch === "#" ? color : null))}
    </svg>
  );
}
