export function seedPositions(nodes, width, height) {
  const cx = width / 2, cy = height / 2
  const R = Math.min(width, height) * 0.35
  const n = nodes.length || 1
  nodes.forEach((node, i) => {
    const a = (i / n) * 2 * Math.PI
    node.x = cx + R * Math.cos(a)
    node.y = cy + R * Math.sin(a)
    node.vx = 0
    node.vy = 0
  })
  return nodes
}

const idOf = (ref) => (ref && typeof ref === 'object') ? ref.id : ref

// opts.hubRepulsion (default 1) multiplies repulsion between two nodes that are BOTH
// flagged `hub: true`, so cluster centers (e.g. banks/parents) push far apart into
// separate islands. Nodes without a `hub` flag are unaffected — the default is a no-op.
export function stepSimulation(nodes, links, opts = {}) {
  const { repulsion = 500, springLength = 90, springK = 0.04, damping = 0.85, alpha = 1, hubRepulsion = 1, collidePadding = 4 } = opts
  const idx = new Map(nodes.map((n, i) => [n.id, i]))

  // Coulomb repulsion between every pair
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j]
      let dx = a.x - b.x, dy = a.y - b.y
      if (dx === 0 && dy === 0) { dx = (i - j) || 1; dy = 1 }  // nudge coincident nodes apart deterministically
      const d2 = dx * dx + dy * dy
      const d = Math.sqrt(d2)
      const strength = (a.hub && b.hub) ? repulsion * hubRepulsion : repulsion
      const f = (strength / Math.max(20, d2)) * alpha
      const fx = (dx / d) * f, fy = (dy / d) * f
      a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy
    }
  }
  // Spring attraction along links
  for (const l of links) {
    const a = nodes[idx.get(idOf(l.source))]
    const b = nodes[idx.get(idOf(l.target))]
    if (!a || !b) continue
    let dx = b.x - a.x, dy = b.y - a.y
    const d = Math.sqrt(dx * dx + dy * dy) || 0.01
    const disp = (d - springLength) * springK * alpha
    const fx = (dx / d) * disp, fy = (dy / d) * disp
    a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy
  }
  // Integrate with damping
  for (const n of nodes) {
    n.vx *= damping; n.vy *= damping
    n.x += n.vx; n.y += n.vy
  }
  // Geometric collision — only for nodes that carry a radius `r`; keeps sized circles
  // from overlapping so dense graphs spread out and read clearly. No-op when r is absent.
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j]
      if (a.r == null || b.r == null) continue
      const minDist = a.r + b.r + collidePadding
      let dx = b.x - a.x, dy = b.y - a.y
      if (dx === 0 && dy === 0) { dx = (j - i) || 1; dy = 1 }
      const d2 = dx * dx + dy * dy
      if (d2 < minDist * minDist) {
        const d = Math.sqrt(d2) || 0.1
        const push = (minDist - d) * 0.5     // each node yields half the overlap
        const nx = dx / d, ny = dy / d
        a.x -= nx * push; a.y -= ny * push
        b.x += nx * push; b.y += ny * push
      }
    }
  }
  return nodes
}
