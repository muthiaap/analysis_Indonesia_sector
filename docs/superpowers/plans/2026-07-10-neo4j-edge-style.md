# Neo4j Browser Edge Styling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the edges of both relationship graphs in `HubunganTab.jsx` to match Neo4j Browser — flat `#A5ABB6` lines, boundary-accurate arrowheads, and a rotated relationship-type pill that appears only on hover or selection.

**Architecture:** Two pure geometry helpers go in a new `dashboard/src/lib/graphEdges.js`, unit-tested with vitest. A new presentational `GraphLink` component consumes them and replaces the existing two-`<line>` block inside `HubunganTab.jsx`. Node rendering is not touched.

**Tech Stack:** React 18, SVG (hand-rolled force simulation, no d3), Vite 5, vitest 1.6, Tailwind.

## Global Constraints

- Neo4j relationship color, idle: `#A5ABB6`. Highlighted: `#6F7784`.
- Idle stroke width `1`. Highlighted stroke width `1.5`.
- Pill: `fill="#ffffff"`, `rx={3}`, ~3px horizontal padding, text `#6F7784`, `fontSize={9}`.
- Pill text: `HAS_SUBSIDIARY` when `activeMode === 'subsidiaries'`, else `LOANED_TO`.
- **Do not modify** `<g className="nodes">`, `getNodeRadius()`, `SECTOR_COLORS`, or any force-simulation parameter.
- **No glow backdrop.** **No loan-magnitude width scaling.** Both are deliberately removed.
- vitest only collects `src/**/*.test.js` in a `node` environment (see `dashboard/vite.config.js`). Helper tests must be `.test.js` and must not import React or touch the DOM.
- All `npm` commands run from `dashboard/`, not the repo root.
- Every helper must guard `dist === 0`. A zero-length edge that divides by zero emits `NaN` into an SVG attribute, and React renders it silently — the edge just disappears.

---

### Task 1: Geometry helpers

Pure functions with no React dependency. `trimEndpoint` is what replaces the
broken `markerEnd` / `refX="26"` approach: it walks back from the target centre
along the edge so the arrow tip lands on the circle's circumference for any
radius. `captionTransform` positions the relationship pill and keeps its text
upright.

**Files:**
- Create: `dashboard/src/lib/graphEdges.js`
- Test: `dashboard/src/lib/graphEdges.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `trimEndpoint(x1, y1, x2, y2, targetRadius, arrowLen) -> { x: number, y: number }`
  - `captionTransform(x1, y1, x2, y2) -> { x: number, y: number, angle: number }`
  - `EDGE_IDLE`, `EDGE_HIGHLIGHT`, `ARROW_LEN` constants.

- [ ] **Step 1: Write the failing test**

Create `dashboard/src/lib/graphEdges.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { trimEndpoint, captionTransform, ARROW_LEN } from './graphEdges'

describe('trimEndpoint', () => {
  it('lands the arrow tip on the circumference of a r=24 node', () => {
    // horizontal edge from (0,0) to (100,0), target radius 24, arrow 6 long
    const { x, y } = trimEndpoint(0, 0, 100, 0, 24, 6)
    expect(x).toBeCloseTo(70) // 100 - 24 - 6
    expect(y).toBeCloseTo(0)
  })

  it('lands the arrow tip on the circumference of a r=12 node', () => {
    const { x, y } = trimEndpoint(0, 0, 100, 0, 12, 6)
    expect(x).toBeCloseTo(82) // 100 - 12 - 6
    expect(y).toBeCloseTo(0)
  })

  it('trims along the true diagonal, not per-axis', () => {
    // 3-4-5 triangle: distance is 50 from (0,0) to (30,40)
    const { x, y } = trimEndpoint(0, 0, 30, 40, 5, 5)
    // pull back 10 of 50 units => keep 80% of the vector
    expect(x).toBeCloseTo(24)
    expect(y).toBeCloseTo(32)
  })

  it('returns the target unchanged when the edge has zero length', () => {
    const { x, y } = trimEndpoint(50, 50, 50, 50, 12, 6)
    expect(Number.isNaN(x)).toBe(false)
    expect(Number.isNaN(y)).toBe(false)
    expect(x).toBe(50)
    expect(y).toBe(50)
  })

  it('does not overshoot past the source on a very short edge', () => {
    // edge shorter than radius + arrow: clamp at the source
    const { x, y } = trimEndpoint(0, 0, 10, 0, 24, 6)
    expect(x).toBe(0)
    expect(y).toBe(0)
  })
})

describe('captionTransform', () => {
  it('sits at the midpoint', () => {
    const { x, y } = captionTransform(0, 0, 100, 50)
    expect(x).toBeCloseTo(50)
    expect(y).toBeCloseTo(25)
  })

  it('is upright for a left-to-right edge', () => {
    expect(captionTransform(0, 0, 100, 0).angle).toBeCloseTo(0)
  })

  it('flips a right-to-left edge so text is never upside-down', () => {
    // raw angle would be 180deg; must be normalised to 0
    expect(captionTransform(100, 0, 0, 0).angle).toBeCloseTo(0)
  })

  it('keeps every quadrant within [-90, 90]', () => {
    const targets = [[100, 100], [-100, 100], [-100, -100], [100, -100]]
    for (const [tx, ty] of targets) {
      const { angle } = captionTransform(0, 0, tx, ty)
      expect(angle).toBeGreaterThanOrEqual(-90)
      expect(angle).toBeLessThanOrEqual(90)
    }
  })

  it('returns a zero angle and no NaN for a zero-length edge', () => {
    const { x, y, angle } = captionTransform(7, 7, 7, 7)
    expect(angle).toBe(0)
    expect(x).toBe(7)
    expect(y).toBe(7)
  })
})

describe('ARROW_LEN', () => {
  it('is exported for the renderer to size its marker path', () => {
    expect(ARROW_LEN).toBe(6)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run from `dashboard/`:
```bash
npm test -- src/lib/graphEdges.test.js
```
Expected: FAIL — `Failed to resolve import "./graphEdges"`.

- [ ] **Step 3: Write minimal implementation**

Create `dashboard/src/lib/graphEdges.js`:

```js
// Geometry for Neo4j Browser style relationship edges.
// Pure functions: no React, no DOM. See vite.config.js -- vitest runs these
// in a `node` environment.

/** Neo4j Browser's relationship grey. */
export const EDGE_IDLE = '#A5ABB6'
/** Darker grey for a hovered edge, or one attached to the selected node. */
export const EDGE_HIGHLIGHT = '#6F7784'
/** Length of the arrowhead triangle, in SVG user units. */
export const ARROW_LEN = 6

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
```

- [ ] **Step 4: Run test to verify it passes**

Run from `dashboard/`:
```bash
npm test -- src/lib/graphEdges.test.js
```
Expected: PASS, 11 tests.

- [ ] **Step 5: Confirm the pre-existing suite still passes**

Run from `dashboard/`:
```bash
npm test
```
Expected: 2 test files passed, 17 tests total (6 from `companyPois.test.js` + 11 new).

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/lib/graphEdges.js dashboard/src/lib/graphEdges.test.js
git commit -m "feat(graph): geometry helpers for Neo4j-style edges

trimEndpoint puts the arrow tip on the target circumference for any
node radius, replacing the hardcoded marker refX=26. captionTransform
keeps the relationship pill upright in all four quadrants. Both guard
dist===0, which would otherwise emit NaN into an SVG attribute.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `GraphLink` component

A presentational component for one edge. Renders, bottom to top: a transparent
hit line for hover, the visible line, the arrowhead, and — only when highlighted
— the relationship pill.

The hit line carries **only** `onMouseEnter`/`onMouseLeave`. Attaching a
`mousedown` handler here would swallow the event that `HubunganTab`'s `<svg>`
uses to start a background pan, so a drag beginning on top of an edge would
freeze the canvas.

**Files:**
- Create: `dashboard/src/GraphLink.jsx`

**Interfaces:**
- Consumes: `trimEndpoint`, `captionTransform`, `EDGE_IDLE`, `EDGE_HIGHLIGHT`, `ARROW_LEN` from `./lib/graphEdges` (Task 1).
- Produces: default export `GraphLink`, taking props
  `{ x1, y1, x2, y2, targetRadius, relType, highlighted, onEnter, onLeave }`.

- [ ] **Step 1: Create the component**

Create `dashboard/src/GraphLink.jsx`:

```jsx
import {
  trimEndpoint,
  captionTransform,
  EDGE_IDLE,
  EDGE_HIGHLIGHT,
  ARROW_LEN,
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
  const halfW = ARROW_LEN * 0.42
  // Two corners of the arrowhead, perpendicular to the edge at `base`.
  const nx = -Math.sin(angleRad) * halfW
  const ny = Math.cos(angleRad) * halfW
  const head = `${tip.x},${tip.y} ${base.x + nx},${base.y + ny} ${base.x - nx},${base.y - ny}`

  const cap = captionTransform(x1, y1, base.x, base.y)
  const pillW = relType.length * 5.1 + 6
  const pillH = 11

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
```

- [ ] **Step 2: Verify it compiles**

Run from `dashboard/`:
```bash
npx vite build 2>&1 | tail -5
```
Expected: `✓ built in ...`, no import or syntax error. (`GraphLink` is not yet imported by anything, but a build failure here means a typo.)

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/GraphLink.jsx
git commit -m "feat(graph): GraphLink component for Neo4j-style edges

Flat grey line, arrowhead on the target circumference, rotated
relationship pill shown only when highlighted. The transparent hit
line binds mouseenter/mouseleave only, so it cannot swallow the
mousedown that starts a background pan.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Wire `GraphLink` into `HubunganTab`

Replaces the two-`<line>` block (glow backdrop + main line) and deletes the now
unused `<marker id="arrow">`.

**Files:**
- Modify: `dashboard/src/HubunganTab.jsx` — import (top), `hoveredLink` state (near line 160), `<defs>` block (lines 1584–1596), links block (lines 1602–1641)

**Interfaces:**
- Consumes: `GraphLink` from `./GraphLink` (Task 2).
- Produces: nothing consumed downstream.

> **Note:** line numbers refer to the file at commit `b9aeed1`. Locate by the
> quoted code, not by number — earlier tasks do not touch this file, but be
> careful anyway.

- [ ] **Step 1: Add the import**

At the top of `dashboard/src/HubunganTab.jsx`, immediately after the
`import neo4j from 'neo4j-driver'` line, add:

```jsx
import GraphLink from './GraphLink'
```

- [ ] **Step 2: Add the hover state**

Find:

```jsx
  // Selected Node Details for Right Sidebar
  const [selectedNode, setSelectedNode] = useState(null)
```

Replace with:

```jsx
  // Selected Node Details for Right Sidebar
  const [selectedNode, setSelectedNode] = useState(null)

  // Index of the edge under the cursor; null when none. Drives the pill.
  const [hoveredLink, setHoveredLink] = useState(null)
```

- [ ] **Step 3: Delete the obsolete arrow marker**

Find and delete this entire block (the whole `<defs>` element, including the
`{/* Arrow markers */}` comment above it):

```jsx
                {/* Arrow markers */}
                <defs>
                  <marker
                    id="arrow"
                    viewBox="0 0 10 10"
                    refX="26"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(15, 23, 42, 0.35)" />
                  </marker>
                </defs>
```

`GraphLink` draws its own `<polygon>` arrowhead, correctly placed for every node
radius. The `refX="26"` here was the bug.

- [ ] **Step 4: Replace the links block**

Find the whole `<g className="links">` element — it begins:

```jsx
                  {/* LINKS / EDGES */}
                  <g className="links">
                    {simLinksRef.current.map((link, idx) => {
```

and ends with the matching `</g>` just before `{/* NODES / VERTICES */}`.

Replace the entire element with:

```jsx
                  {/* LINKS / EDGES */}
                  <g className="links">
                    {simLinksRef.current.map((link, idx) => {
                      const sourceNode = simNodesRef.current.find(n => n.id === link.source)
                      const targetNode = simNodesRef.current.find(n => n.id === link.target)
                      if (!sourceNode || !targetNode) return null

                      const highlighted =
                        hoveredLink === idx ||
                        (selectedNode != null &&
                          (selectedNode.id === link.source || selectedNode.id === link.target))

                      return (
                        <GraphLink
                          key={idx}
                          x1={sourceNode.x}
                          y1={sourceNode.y}
                          x2={targetNode.x}
                          y2={targetNode.y}
                          targetRadius={getNodeRadius(targetNode)}
                          relType={activeMode === 'subsidiaries' ? 'HAS_SUBSIDIARY' : 'LOANED_TO'}
                          highlighted={highlighted}
                          onEnter={() => setHoveredLink(idx)}
                          onLeave={() => setHoveredLink(null)}
                        />
                      )
                    })}
                  </g>
```

The `glowColor` computation and the `Math.log10(link.value)` width scaling are
both gone — deliberately, per the spec.

- [ ] **Step 5: Verify the build and the test suite**

Run from `dashboard/`:
```bash
npx vite build 2>&1 | tail -5 && npm test
```
Expected: `✓ built in ...`, then 2 test files passed / 17 tests.

- [ ] **Step 6: Confirm nothing still references the deleted marker**

Run from the repo root:
```bash
grep -rn "url(#arrow)\|markerEnd\|glowColor" dashboard/src/
```
Expected: no output. Any hit is a leftover that will render a broken edge.

- [ ] **Step 7: Commit**

```bash
git add dashboard/src/HubunganTab.jsx
git commit -m "feat(graph): adopt Neo4j edge styling in HubunganTab

Replaces the glow-backdrop + main-line pair with GraphLink. Drops the
sector-coloured glow and the loan-magnitude width scaling, per spec.
Removes the marker id=arrow whose refX=26 mispositioned arrowheads on
every node that was not radius 24.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Manual verification

No code. This is the gate that catches what unit tests cannot: overlap, density,
and interaction regressions.

**Files:** none.

- [ ] **Step 1: Start the dev server**

Run from `dashboard/`:
```bash
npm run dev
```
Open `http://localhost:5173/` and go to the **Hubungan** tab.

- [ ] **Step 2: Worst-case density — subsidiaries mode**

Select parent company **IMAS** (106 subsidiaries — the densest graph in the
dataset). Confirm:
- every edge is a thin flat grey line, no coloured glow;
- no pill is visible while the cursor is off the graph;
- arrowheads touch the small subsidiary circles without overlapping them.

- [ ] **Step 3: Arrowhead placement across radii**

Still on IMAS, toggle the **"Ukuran berdasarkan persentase"** (`sizeByPercent`)
control. Node radii shift between a flat `12` and a computed `[7, 18]`. Confirm
arrowheads stay on the circumference in both states — this is the `refX="26"` bug
that Task 1 fixed, and toggling is the fastest way to expose a regression.

- [ ] **Step 4: Hover pill**

Hover a single edge. Confirm a `HAS_SUBSIDIARY` pill appears at its midpoint,
rotated along the edge, reading left-to-right and **not** upside-down. Check an
edge pointing up-left specifically, since that is the quadrant where the flip
matters.

- [ ] **Step 5: Selection pill**

Click the IMAS parent node. Confirm every edge attached to it highlights and
shows its pill simultaneously, and that the pills' white backgrounds mask the
lines beneath rather than sitting behind them.

- [ ] **Step 6: Panning is not broken**

Press and drag starting **directly on top of an edge**. The canvas must pan. If
it does not, the hit line is swallowing `mousedown` — re-check that `GraphLink`'s
transparent line has no `onMouseDown` handler.

- [ ] **Step 7: Loans mode**

Switch to loans mode and select two or more banks. Confirm the pill reads
`LOANED_TO`, and that all edges are uniform 1px regardless of loan size — the
magnitude encoding is gone by design, and this step is confirming that, not
finding a bug.

- [ ] **Step 8: Zero-length edge smoke test**

Drag one node directly on top of a node it connects to, until they overlap. The
edge must not vanish or throw. This exercises the `dist === 0` guard. Check the
browser console for `NaN` warnings on `x1`/`y1`.

- [ ] **Step 9: Stop the server and commit any fixes**

If steps 2–8 required changes, commit them. If not, nothing to commit — the
feature is complete.

---

## Rollback

Every task is a single commit touching disjoint files. To abandon:

```bash
git revert --no-commit <task-3-sha> <task-2-sha> <task-1-sha>
git commit -m "revert: Neo4j edge styling"
```

Task 3 is the only commit that changes existing behaviour; reverting it alone
restores the old edges while leaving the tested helpers in place.
