/**
 * Grab a frame of what the user is currently seeing in the given tab.
 *
 * We use chrome.tabs.captureVisibleTab rather than drawing the <video> element
 * to a canvas in the content script: TikTok's video is served cross-origin,
 * which taints the canvas and blocks toDataURL(). captureVisibleTab sidesteps
 * that and returns a JPEG data URL we can hand straight to Moondream.
 *
 * Trade-off: it captures the whole viewport (UI chrome included). Moondream
 * copes fine with that for captioning; crop later if it hurts accuracy.
 */
export async function captureFrame(windowId: number): Promise<string> {
  return chrome.tabs.captureVisibleTab(windowId, { format: "jpeg", quality: 60 });
}
