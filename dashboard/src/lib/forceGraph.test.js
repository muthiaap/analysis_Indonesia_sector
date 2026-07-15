import { describe, it, expect } from 'vitest'
import { seedPositions, stepSimulation } from './forceGraph'

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)

describe('seedPositions', () => {
  it('is deterministic and sets coordinates + velocity', () => {
    const a = seedPositions([{ id: 'a' }, { id: 'b' }], 100, 100)
    const b = seedPositions([{ id: 'a' }, { id: 'b' }], 100, 100)
    expect(a[0].x).toBe(b[0].x); expect(a[0].y).toBe(b[0].y)
    expect(a[0].vx).toBe(0); expect(a[0].vy).toBe(0)
  })
})

describe('stepSimulation', () => {
  it('pulls a connected pair toward the spring length', () => {
    const nodes = [{ id: 'a', x: 0, y: 0, vx: 0, vy: 0 }, { id: 'b', x: 400, y: 0, vx: 0, vy: 0 }]
    const links = [{ source: 'a', target: 'b' }]
    const before = dist(nodes[0], nodes[1])
    for (let i = 0; i < 300; i++) stepSimulation(nodes, links, { springLength: 90 })
    const after = dist(nodes[0], nodes[1])
    expect(after).toBeLessThan(before)          // spring contracted the long edge
    expect(after).toBeGreaterThan(20)           // repulsion prevents collapse
  })
  it('pushes an unconnected pair apart', () => {
    const nodes = [{ id: 'a', x: 50, y: 0, vx: 0, vy: 0 }, { id: 'b', x: 55, y: 0, vx: 0, vy: 0 }]
    const before = dist(nodes[0], nodes[1])
    for (let i = 0; i < 50; i++) stepSimulation(nodes, [], {})
    expect(dist(nodes[0], nodes[1])).toBeGreaterThan(before)
  })
  it('applies the spring through object-ref source/target', () => {
    const nodes = [{ id: 'a', x: 0, y: 0, vx: 0, vy: 0 }, { id: 'b', x: 300, y: 0, vx: 0, vy: 0 }]
    const links = [{ source: nodes[0], target: nodes[1] }]
    const before = Math.hypot(nodes[0].x - nodes[1].x, nodes[0].y - nodes[1].y)
    for (let i = 0; i < 100; i++) stepSimulation(nodes, links, { springLength: 90 })
    expect(Math.hypot(nodes[0].x - nodes[1].x, nodes[0].y - nodes[1].y)).toBeLessThan(before)
  })
  it('pushes two hub nodes apart harder with hubRepulsion', () => {
    const mk = () => [{ id: 'a', x: 50, y: 0, vx: 0, vy: 0, hub: true }, { id: 'b', x: 90, y: 0, vx: 0, vy: 0, hub: true }]
    const plain = mk(), boosted = mk()
    for (let i = 0; i < 30; i++) {
      stepSimulation(plain, [], { hubRepulsion: 1 })
      stepSimulation(boosted, [], { hubRepulsion: 8 })
    }
    expect(dist(boosted[0], boosted[1])).toBeGreaterThan(dist(plain[0], plain[1]))
  })
  it('leaves non-hub nodes unaffected by hubRepulsion', () => {
    const mk = () => [{ id: 'a', x: 50, y: 0, vx: 0, vy: 0 }, { id: 'b', x: 90, y: 0, vx: 0, vy: 0 }]
    const plain = mk(), boosted = mk()
    for (let i = 0; i < 30; i++) {
      stepSimulation(plain, [], { hubRepulsion: 1 })
      stepSimulation(boosted, [], { hubRepulsion: 8 })
    }
    expect(dist(boosted[0], boosted[1])).toBeCloseTo(dist(plain[0], plain[1]), 6)
  })
  it('resolves overlap between sized nodes so circles do not collide', () => {
    const nodes = [{ id: 'a', x: 100, y: 100, vx: 0, vy: 0, r: 20 }, { id: 'b', x: 110, y: 100, vx: 0, vy: 0, r: 20 }]
    for (let i = 0; i < 60; i++) stepSimulation(nodes, [], { collidePadding: 4 })
    expect(dist(nodes[0], nodes[1])).toBeGreaterThanOrEqual(20 + 20 + 4 - 1) // ~sum of radii + padding
  })
  it('ignores collision for nodes without a radius', () => {
    // 30px apart: if these had r=20 each, collision would snap them to ~44px.
    // Without r, only weak long-range repulsion acts, so they barely move.
    const a = [{ id: 'a', x: 100, y: 100, vx: 0, vy: 0 }, { id: 'b', x: 130, y: 100, vx: 0, vy: 0 }]
    for (let i = 0; i < 5; i++) stepSimulation(a, [], {})
    expect(dist(a[0], a[1])).toBeLessThan(44)   // never snapped up to the sum-of-radii collision floor
  })
  it('separates two exactly-coincident nodes', () => {
    const nodes = [{ id: 'a', x: 50, y: 50, vx: 0, vy: 0 }, { id: 'b', x: 50, y: 50, vx: 0, vy: 0 }]
    for (let i = 0; i < 20; i++) stepSimulation(nodes, [], {})
    expect(Math.hypot(nodes[0].x - nodes[1].x, nodes[0].y - nodes[1].y)).toBeGreaterThan(1)
  })
})
