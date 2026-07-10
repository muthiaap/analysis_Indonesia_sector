// Geometry for Neo4j Browser style relationship edges.
// Pure functions: no React, no DOM. See vite.config.js -- vitest runs these
// in a `node` environment.

/** Neo4j Browser's relationship grey. */
export const EDGE_IDLE = '#A5ABB6'
/** Darker grey for a hovered edge, or one attached to the selected node. */
export const EDGE_HIGHLIGHT = '#6F7784'
/** Length of the arrowhead triangle, in SVG user units. */
export const ARROW_LEN = 6
/** Arrowhead half-width as a fraction of its length; sets the tip's sharpness. */
export const ARROW_ASPECT = 0.42

/** Approximate advance width of one character at fontSize 9, in SVG user units. */
export const PILL_CHAR_W = 5.1
/** Horizontal padding inside the relationship pill. */
export const PILL_PAD_X = 6
/** Height of the relationship pill. */
export const PILL_H = 11

/**
 * Pull the edge's target endpoint back to the target circle's circumference so
 * the arrow tip touches the node instead of overlapping or falling short.
 *
 * Replaces the old `<marker refX="26">`, which hardcoded a radius of 24 and so
 * mispositioned every arrowhead on r=12 subsidiary nodes.
 */
export function trimEndpoint(x1, y1, x2, y2, targetRadius, arrowLen = ARROW_LEN) {
  const dx = x2 - x1
  const dy = y2 - y1
  const dist = Math.hypot(dx, dy)

  // Coincident nodes during simulation settling: dividing by dist would emit
  // NaN into an SVG attribute and React would silently drop the edge.
  if (dist === 0) return { x: x2, y: y2 }

  const pullback = targetRadius + arrowLen
  if (pullback >= dist) return { x: x1, y: y1 }

  const t = (dist - pullback) / dist
  return { x: x1 + dx * t, y: y1 + dy * t }
}

/**
 * Midpoint and rotation for the relationship-type pill. The angle is normalised
 * into [-90, 90] so the caption is never rendered upside-down -- the detail that
 * makes an edge read as Neo4j rather than as a generic force graph.
 */
export function captionTransform(x1, y1, x2, y2) {
  const x = (x1 + x2) / 2
  const y = (y1 + y2) / 2

  const dx = x2 - x1
  const dy = y2 - y1
  if (dx === 0 && dy === 0) return { x, y, angle: 0 }

  let angle = (Math.atan2(dy, dx) * 180) / Math.PI
  if (angle > 90) angle -= 180
  if (angle < -90) angle += 180
  return { x, y, angle }
}
