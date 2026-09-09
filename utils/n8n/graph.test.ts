import { describe, expect, it } from 'vitest'
import { buildScene, fitScale, isAiChannel, LABEL_WIDTH, NODE_SIZE } from './graph'
import type { WorkflowNode } from './types'

function node(x: number, y: number, name = `n${x},${y}`): WorkflowNode {
  return { name, type: 'n8n-nodes-base.set', label: 'Edit Fields', kind: 'data', x, y }
}

describe('buildScene', () => {
  it('keeps the author’s own coordinates', () => {
    const { nodes } = buildScene([node(-300, 40), node(200, 40)], [])
    expect(nodes.map((n) => [n.x, n.y])).toEqual([
      [-300, 40],
      [200, 40],
    ])
    expect(nodes[0].cx).toBe(-300 + NODE_SIZE / 2)
  })

  it('makes room for the label slot, which is wider than the block', () => {
    const { viewBox } = buildScene([node(0, 0)], [])
    expect(viewBox.width).toBeGreaterThanOrEqual(LABEL_WIDTH)
    expect(viewBox.x).toBeLessThan(0)
  })

  describe('caption room', () => {
    it('gives a node with space to itself the full slot', () => {
      const { nodes } = buildScene([node(0, 0), node(600, 0)], [])
      expect(nodes.map((n) => n.labelWidth)).toEqual([LABEL_WIDTH, LABEL_WIDTH])
    })

    it('shrinks captions where the author parked two nodes close together', () => {
      // 70 units apart, the way n8n's AI sub-nodes usually sit.
      const { nodes } = buildScene([node(0, 300), node(70, 300)], [])
      expect(nodes[0].labelWidth).toBeLessThan(LABEL_WIDTH)
      expect(nodes[0].labelWidth).toBe(nodes[1].labelWidth)
    })

    it('never shrinks a caption to nothing', () => {
      const { nodes } = buildScene([node(0, 0), node(4, 0), node(8, 0)], [])
      for (const n of nodes) expect(n.labelWidth).toBeGreaterThanOrEqual(62)
    })

    it('ignores a neighbour on another line', () => {
      // Same column, far enough below that the captions cannot collide.
      const { nodes } = buildScene([node(0, 0), node(0, 300)], [])
      expect(nodes[0].labelWidth).toBe(LABEL_WIDTH)
    })

    it('takes the tightest neighbour, not the last one seen', () => {
      const { nodes } = buildScene([node(0, 0), node(80, 0), node(300, 0)], [])
      expect(nodes[0].labelWidth).toBe(80 - 10)
    })
  })

  it('returns a usable viewBox for an empty workflow', () => {
    // A zero-width viewBox makes the browser drop the <svg> with no error.
    const { viewBox } = buildScene([], [])
    expect(viewBox.width).toBeGreaterThan(0)
    expect(viewBox.height).toBeGreaterThan(0)
  })

  it('draws a main edge sideways and an ai edge upwards', () => {
    const nodes = [node(0, 0, 'a'), node(400, 0, 'b'), node(400, 300, 'model')]
    const { edges } = buildScene(nodes, [
      { from: 0, to: 1, channel: 'main' },
      { from: 2, to: 1, channel: 'ai_languageModel' },
    ])

    expect(edges[0].isAi).toBe(false)
    // A main edge leaves the right side of the source at its vertical centre.
    expect(edges[0].d.startsWith(`M ${NODE_SIZE} ${NODE_SIZE / 2} C`)).toBe(true)

    expect(edges[1].isAi).toBe(true)
    // An ai edge leaves the top of the sub-node and lands on the agent's base.
    expect(edges[1].d.startsWith(`M ${400 + NODE_SIZE / 2} 300 C`)).toBe(true)
    expect(edges[1].d.endsWith(`${400 + NODE_SIZE / 2} ${NODE_SIZE}`)).toBe(true)
  })

  it('ignores an edge that points outside the node list', () => {
    const { edges } = buildScene([node(0, 0)], [{ from: 0, to: 9, channel: 'main' }])
    expect(edges).toEqual([])
  })
})

describe('isAiChannel', () => {
  it('separates agent wiring from data flow', () => {
    expect(isAiChannel('ai_tool')).toBe(true)
    expect(isAiChannel('ai_languageModel')).toBe(true)
    expect(isAiChannel('main')).toBe(false)
  })
})

describe('fitScale', () => {
  const scene = buildScene([node(0, 0), node(2000, 1000)], [])

  it('shrinks a large graph to fit', () => {
    const scale = fitScale(scene, { width: 600, height: 400 })
    expect(scale).toBeLessThan(1)
    expect(scene.viewBox.width * scale).toBeLessThanOrEqual(600.001)
  })

  it('never blows a small graph up past life size', () => {
    const small = buildScene([node(0, 0)], [])
    expect(fitScale(small, { width: 4000, height: 4000 })).toBe(1)
  })

  it('keeps a huge graph above a pannable floor rather than a smear', () => {
    const huge = buildScene([node(0, 0), node(60000, 40000)], [])
    expect(fitScale(huge, { width: 600, height: 400 })).toBe(0.12)
  })

  it('does not divide by a zero viewport', () => {
    expect(fitScale(scene, { width: 0, height: 0 })).toBe(1)
  })
})
