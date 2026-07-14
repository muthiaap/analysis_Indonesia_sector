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
  it('accepts links whose source/target are node objects', () => {
    const nodes = [{ id: 'a', x: 0, y: 0, vx: 0, vy: 0 }, { id: 'b', x: 300, y: 0, vx: 0, vy: 0 }]
    const links = [{ source: nodes[0], target: nodes[1] }]
    expect(() => stepSimulation(nodes, links, {})).not.toThrow()
  })
})
