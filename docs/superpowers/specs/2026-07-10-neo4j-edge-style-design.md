# Design: Neo4j Browser edge styling for the relationship graphs

**Date:** 2026-07-10
**Status:** Approved for planning
**Author:** muthiaap + Claude

## Summary

Restyle the edges of both relationship graphs in `HubunganTab.jsx` — subsidiaries
(`HAS_SUBSIDIARY`) and credit (`LOANED_TO`) — to match Neo4j Browser's visual
language. Nodes are deliberately left alone.

## Decisions (from brainstorming)

| Question | Decision |
|---|---|
| How far toward the Neo4j look? | **Edges only.** Nodes keep current size, sector color, outline, and below-node labels. |
| Relationship-type pill | **On hover and on edges of the selected node only.** Both graphs are single-relationship-type, so an always-on pill would repeat one word up to 106 times. |
| Sector-colored glow backdrop | **Dropped.** It is the single element that reads as "not Neo4j". Sector color already lives on the node fill. |
| Loan-magnitude line width | **Dropped.** Accepted information loss; magnitude remains in the side panel and in node radius. |

## Current state (as-is)

`HubunganTab.jsx` (2,056 lines) renders a hand-rolled force simulation — Coulomb
repulsion plus spring attraction — into SVG, with zoom/pan, node pinning, and
drag. Both graph modes share one render path.

Edges today (lines 1602–1641) draw two stacked `<line>` elements per link:

1. A glow backdrop: `strokeWidth={7}`, `strokeOpacity={0.08}`, colored by the
   target node's sector (subsidiaries) or orange (loans).
2. A main line: `stroke="rgba(71, 85, 105, 0.35)"`, with `strokeWidth` scaled by
   `Math.log10(link.value) - 5` in loans mode, `1.5` otherwise, and
   `markerEnd="url(#arrow)"`.

Relationship type names come from the Cypher at lines 559 (`HAS_SUBSIDIARY`) and
652 (`LOANED_TO`).

Node radii vary: `getNodeRadius()` (line 1130) returns `24` for parents, `12`
when `sizeByPercent` is off, and a computed value in `[7, 18]` otherwise.

## Visual specification

Neo4j Browser's relationship color is `#A5ABB6`.

| State | Stroke | Width | Pill |
|---|---|---|---|
| Idle | `#A5ABB6` | `1` | hidden |
| Hovered | `#6F7784` | `1.5` | shown |
| Attached to `selectedNode` | `#6F7784` | `1.5` | shown |

- **Arrowhead:** filled triangle in the edge's current stroke color, ~6px, sitting
  exactly on the target node's circumference.
- **Pill:** rounded rect at the edge midpoint, `fill="#ffffff"` (the SVG is
  `bg-transparent` over a white container) so it masks the line beneath; `rx={3}`,
  ~3px horizontal padding; text `#6F7784`, ~9px, sans-serif. Rotated to the
  edge angle, flipped 180° when that angle passes ±90° so text is never
  upside-down. This rotation is what distinguishes the Neo4j look from a generic
  force graph.
- **Pill text:** `HAS_SUBSIDIARY` in subsidiaries mode, `LOANED_TO` in loans mode.

## Bug this change forces us to fix

The arrow marker hardcodes `refX="26"` (line 1588), tuned for radius-24 parent
nodes. Subsidiary nodes render at radius 12, and loan nodes at a computed radius.
Arrowheads therefore land inside or short of the target circle depending on node
type. The glow backdrop currently masks this; flat edges will expose it.

**Fix:** stop relying on marker `refX`. Trim the line's target endpoint back to
the circumference by walking `targetRadius + arrowLen` along the edge's unit
vector, and draw the arrowhead there. Correct for every node radius.

## Structure

Two pure functions, extracted for testability rather than buried in a
2,056-line component. This mirrors the `companyPois.js` helper pattern
established by the 2026-07-08 spec.

```
dashboard/src/lib/graphEdges.js
  trimEndpoint(x1, y1, x2, y2, targetRadius, arrowLen) -> { x, y }
  captionTransform(x1, y1, x2, y2)                     -> { x, y, angle }
```

`HubunganTab.jsx` imports both and renders one `<GraphLink>` per edge, replacing
the current two-`<line>` block. `<g className="nodes">` is not modified.

### Error handling

When two nodes momentarily coincide during simulation settling, `dist === 0` and
the unit vector divides by zero. The resulting `NaN` reaches the `x1`/`y1`
attributes and React drops the edge silently. Both helpers must guard
`dist === 0` and return a safe fallback.

### Hover interaction

One new state: `hoveredLink`. Edges are 1px, so each gets a transparent 10px-wide
hit line with `pointerEvents: 'stroke'`, carrying only `onMouseEnter` /
`onMouseLeave`. No `mousedown` handler is attached, so background panning still
works when a drag begins over an edge.

An edge is highlighted when it is hovered, or when
`selectedNode.id === link.source || selectedNode.id === link.target`.

## Testing

The repo has `vitest` configured (`npm test`).

Unit tests for `graphEdges.js`:
- `trimEndpoint` puts the arrow on the circumference for `r = 12` and `r = 24`.
- `captionTransform` never returns an upside-down angle, checked across all four
  quadrants.
- Zero-length edges (`dist === 0`) emit no `NaN` from either helper.

Manual verification: `npm run dev`, then
- subsidiaries mode on **IMAS** (106 edges — worst-case density),
- loans mode with two or more banks selected,
- confirm panning still works when the drag starts on top of an edge.

## Out of scope

- Any change to node rendering: radius, fill, outline, label placement, pinning.
- Node caption-inside-circle (would require enlarging nodes; rejected).
- The `SECTOR_COLORS` palette.
- The force simulation parameters.
- Restoring loan magnitude to the edge surface.
