import { DEVPOST, OG, SQUARE, VIDEO, type FrameDef } from "./shared";
import { Hero } from "./Hero";
import { Pipeline } from "./Pipeline";
import { Week } from "./Week";
import { Prompt } from "./Prompt";
import { Architecture } from "./Architecture";
import { Thumbnail } from "./Thumbnail";
import { MarkSquare } from "./MarkSquare";
import { MarkOnly } from "./MarkOnly";
import { VideoProblem, VideoSolution, VideoStage, VideoTitle, VideoWeek } from "./Video";

export { OG, SQUARE, DEVPOST, VIDEO, type FrameDef } from "./shared";

/** Every graphic, one per file. `scripts/shoot-graphics.sh` greps this list for slug + size, so keep one entry per line. */
export const FRAMES: FrameDef[] = [
  { slug: "hero", title: "Hero", note: "Default OG image. Headline + one skipped Reel.", size: OG, render: () => <Hero /> },
  { slug: "pipeline", title: "Pipeline", note: "Technical: the two-pass decision as a trace.", size: OG, render: () => <Pipeline /> },
  { slug: "week", title: "Your week", note: "Usage graph: where the time went + what holds you.", size: OG, render: () => <Week /> },
  { slug: "prompt", title: "Prompt", note: "The whole setup is one text box.", size: OG, render: () => <Prompt /> },
  { slug: "architecture", title: "Architecture", note: "Technical: one Reel followed from phone to server to account.", size: OG, render: () => <Architecture /> },
  { slug: "thumbnail-light", title: "Thumbnail (light)", note: "Brand card on paper.", size: OG, render: () => <Thumbnail /> },
  { slug: "thumbnail-dark", title: "Thumbnail (dark)", note: "Same card on ink, for dark surfaces.", size: OG, render: () => <Thumbnail dark /> },
  { slug: "thumbnail-devpost", title: "Thumbnail (Devpost)", note: "Light card at 3:2 for the Devpost gallery.", size: DEVPOST, render: () => <Thumbnail size={DEVPOST} cell={18} type={1.5} top={1.5} body={1.2} /> },
  { slug: "mark-square", title: "Mark (square)", note: "Square brand tile for Devpost thumbnail.", size: SQUARE, render: () => <MarkSquare /> },
  { slug: "mark", title: "Mark", note: "Just the pixel mark on white. 30px per cell.", size: SQUARE, render: () => <MarkOnly /> },
  // Demo video backgrounds (scripts/demo-video.sh); the bottom band is left for the cameras.
  { slug: "video-title", title: "Video: title", note: "Opening card under the intro.", size: VIDEO, render: () => <VideoTitle /> },
  { slug: "video-problem", title: "Video: problem", note: "The feed as it arrives.", size: VIDEO, render: () => <VideoProblem /> },
  { slug: "video-solution", title: "Video: solution", note: "Same feed after one sentence.", size: VIDEO, render: () => <VideoSolution /> },
  { slug: "video-stage", title: "Video: stage", note: "Empty window for the site recording.", size: VIDEO, render: () => <VideoStage /> },
  { slug: "video-week", title: "Video: week", note: "The week graphic in the window.", size: VIDEO, render: () => <VideoWeek /> },
];
