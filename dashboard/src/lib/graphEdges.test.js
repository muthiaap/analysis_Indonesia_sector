import { describe, it, expect } from 'vitest'
import { trimEndpoint, captionTransform } from './graphEdges'

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
