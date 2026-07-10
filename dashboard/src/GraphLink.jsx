import {
  trimEndpoint,
  captionTransform,
  EDGE_IDLE,
  EDGE_HIGHLIGHT,
  ARROW_LEN,
  ARROW_ASPECT,
  PILL_CHAR_W,
  PILL_PAD_X,
  PILL_H,
} from './lib/graphEdges'

/**
 * One relationship edge, styled after Neo4j Browser: a flat grey line, an
 * arrowhead resting on the target node's circumference, and a rotated type
 * pill that appears only while the edge is highlighted.
 */
export default function GraphLink({
  x1, y1, x2, y2, targetRadius, relType, highlighted, onEnter, onLeave,
}) {
  const stroke = highlighted ? EDGE_HIGHLIGHT : EDGE_IDLE
  const strokeWidth = highlighted ? 1.5 : 1

  // Line stops at the circumference; the arrowhead occupies the last ARROW_LEN.
  const tip = trimEndpoint(x1, y1, x2, y2, targetRadius, 0)
  const base = trimEndpoint(x1, y1, x2, y2, targetRadius, ARROW_LEN)

  const angleRad = Math.atan2(tip.y - y1, tip.x - x1)
  const halfW = ARROW_LEN * ARROW_ASPECT
  // Two corners of the arrowhead, perpendicular to the edge at `base`.
  const nx = -Math.sin(angleRad) * halfW
  const ny = Math.cos(angleRad) * halfW
  const head = `${tip.x},${tip.y} ${base.x + nx},${base.y + ny} ${base.x - nx},${base.y - ny}`

  const cap = captionTransform(x1, y1, base.x, base.y)
  const pillW = relType.length * PILL_CHAR_W + PILL_PAD_X
  const pillH = PILL_H

  return (
    <g>
      {/* Invisible 10px hit area. Pointer events on the stroke only, and no
          mousedown handler, so background panning still starts over an edge. */}
      <line
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke="transparent"
        strokeWidth={10}
        style={{ pointerEvents: 'stroke' }}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      />

      <line
        x1={x1} y1={y1} x2={base.x} y2={base.y}
        stroke={stroke}
        strokeWidth={strokeWidth}
        style={{ pointerEvents: 'none' }}
      />

      <polygon
        points={head}
        fill={stroke}
        style={{ pointerEvents: 'none' }}
      />

      {highlighted && (
        <g
          transform={`translate(${cap.x}, ${cap.y}) rotate(${cap.angle})`}
          style={{ pointerEvents: 'none' }}
        >
          <rect
            x={-pillW / 2} y={-pillH / 2}
            width={pillW} height={pillH}
            rx={3}
            fill="#ffffff"
          />
          <text
            textAnchor="middle"
            dominantBaseline="central"
            fill={EDGE_HIGHLIGHT}
            fontSize={9}
            fontFamily="ui-sans-serif, system-ui, sans-serif"
          >
            {relType}
          </text>
        </g>
      )}
    </g>
  )
}
