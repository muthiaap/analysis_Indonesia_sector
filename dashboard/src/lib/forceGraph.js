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

export function stepSimulation(nodes, links, opts = {}) {
  const { repulsion = 500, springLength = 90, springK = 0.04, damping = 0.85, alpha = 1 } = opts
  const idx = new Map(nodes.map((n, i) => [n.id, i]))

  // Coulomb repulsion between every pair
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j]
      let dx = a.x - b.x, dy = a.y - b.y
      let d2 = dx * dx + dy * dy || 0.01
      const d = Math.sqrt(d2)
      const f = (repulsion / Math.max(20, d2)) * alpha
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
  return nodes
}
