type PathSink = Pick<CanvasRenderingContext2D, 'moveTo' | 'bezierCurveTo' | 'closePath'>

/**
 * A heart, centred on (x, y) and `width` wide, traced onto any 2D path.
 *
 * MDN's canvas heart, normalised: its bounding box runs 20-130 by 25-120, so
 * it is re-centred on (75, 72.5) and scaled by its 110-unit width. Used by the
 * words' mask, the falling hearts and the fallback tiles, so all three are the
 * same shape. Begin the path before calling; fill or stroke after.
 */
export function traceHeart(path: PathSink, x: number, y: number, width: number) {
  const s = width / 110
  const px = (u: number) => x + (u - 75) * s
  const py = (v: number) => y + (v - 72.5) * s

  path.moveTo(px(75), py(40))
  path.bezierCurveTo(px(75), py(37), px(70), py(25), px(50), py(25))
  path.bezierCurveTo(px(20), py(25), px(20), py(62.5), px(20), py(62.5))
  path.bezierCurveTo(px(20), py(80), px(40), py(102), px(75), py(120))
  path.bezierCurveTo(px(110), py(102), px(130), py(80), px(130), py(62.5))
  path.bezierCurveTo(px(130), py(62.5), px(130), py(25), px(100), py(25))
  path.bezierCurveTo(px(85), py(25), px(75), py(37), px(75), py(40))
  path.closePath()
}
