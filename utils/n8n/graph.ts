/**
 * Laying a workflow out for the diagram.
 *
 * There is no layout algorithm here on purpose. Every node in these files
 * carries the coordinates its author dragged it to on the n8n canvas, and a
 * person's arrangement of their own workflow carries meaning that no
 * auto-layout recovers - the retry branch parked below the happy path, the
 * three API calls lined up because they are alternatives. Re-solving the graph
 * would throw that away and produce something the author would not recognise.
 *
 * So this module only does the parts n8n's canvas does that a static SVG
 * cannot: turn coordinates into a viewBox, and turn connections into curves.
 *
 * The one thing it has to get right is that n8n has two kinds of edge. A
 * `main` edge is data moving left to right. An `ai_*` edge attaches a model,
 * a memory or a tool to an agent, and on the canvas it runs vertically from
 * the top of the sub-node into the bottom of the agent. Drawing both the same
 * way turns every AI workflow into a knot.
 */
import type { WorkflowEdge, WorkflowNode } from './types'

/** Side length of a node block, in n8n canvas units. */
export const NODE_SIZE = 96

/** Width of the label slot under a node. Wider than the block, and centred. */
export const LABEL_WIDTH = 168

/** Breathing room around the whole graph. */
const PADDING = 64

/** Room under the bottom row for that row's labels. */
const LABEL_SPACE = 44

export interface Point {
  x: number
  y: number
}

export interface PlacedNode extends WorkflowNode {
  index: number
  /** Centre of the block, which is what the label and the edges align to. */
  cx: number
  cy: number
  /**
   * How wide this node's caption may be before it runs into its neighbour's.
   * At most `LABEL_WIDTH`, less where the author parked two nodes close
   * together.
   */
  labelWidth: number
}

export interface RoutedEdge {
  from: number
  to: number
  channel: string
  /** True for the `ai_*` channels, which are drawn vertically and dashed. */
  isAi: boolean
  /** SVG path data for the curve. */
  d: string
}

export interface GraphScene {
  nodes: PlacedNode[]
  edges: RoutedEdge[]
  /** SVG user-space box tight around the content, already padded. */
  viewBox: { x: number; y: number; width: number; height: number }
}

/** Never clip a caption below this - two characters say nothing. */
const MIN_LABEL_WIDTH = 62

/** Gap left between two captions that would otherwise touch. */
const LABEL_GUTTER = 10

/**
 * Vertical distance within which two captions share a line.
 *
 * Captions hang at a fixed offset below their block, so two nodes collide
 * only when their blocks sit at nearly the same height. Anything further
 * apart than this is on another line and cannot overlap.
 */
const CAPTION_BAND = 40

/**
 * Places the nodes, and works out how much room each caption actually has.
 *
 * n8n lets an author park two nodes 70 units apart, which is less than a
 * caption is wide - so on a dense workflow the captions run into each other
 * and read as one long word. Truncating everything to a fixed length does not
 * fix it (the two names may both be short) and ruins the sparse workflows,
 * which are most of them. Measuring the gap to the nearest neighbour on the
 * same line clips exactly the captions that need it, and only those.
 */
function place(nodes: WorkflowNode[]): PlacedNode[] {
  const placed = nodes.map((node, index) => ({
    ...node,
    index,
    cx: node.x + NODE_SIZE / 2,
    cy: node.y + NODE_SIZE / 2,
    labelWidth: LABEL_WIDTH,
  }))

  for (const node of placed) {
    for (const other of placed) {
      if (other === node) continue
      if (Math.abs(other.y - node.y) > CAPTION_BAND) continue

      const gap = Math.abs(other.cx - node.cx)
      if (gap >= LABEL_WIDTH) continue
      // The gap is shared between the two captions, so each gets half of it.
      node.labelWidth = Math.max(MIN_LABEL_WIDTH, Math.min(node.labelWidth, gap - LABEL_GUTTER))
    }
  }

  return placed
}

/** Right edge of a block - where a `main` edge leaves. */
function exitPoint(node: PlacedNode): Point {
  return { x: node.x + NODE_SIZE, y: node.cy }
}

/** Left edge of a block - where a `main` edge arrives. */
function entryPoint(node: PlacedNode): Point {
  return { x: node.x, y: node.cy }
}

/**
 * A horizontal cubic bezier, the shape n8n's own canvas draws.
 *
 * The control offset grows with the gap so long hops bend gently, and never
 * drops below a floor so adjacent nodes still get a visible curve rather than
 * a straight line that reads as a table rule. An edge that runs backwards -
 * a loop returning to an earlier step - gets a much larger offset, which is
 * what makes it bulge out sideways instead of cutting back through the nodes
 * it is trying to skip.
 */
function horizontalPath(from: Point, to: Point): string {
  const dx = to.x - from.x
  const offset = dx >= 0 ? Math.max(40, dx * 0.5) : Math.max(120, Math.abs(dx) * 0.4)
  return `M ${from.x} ${from.y} C ${from.x + offset} ${from.y}, ${to.x - offset} ${to.y}, ${to.x} ${to.y}`
}

/**
 * A vertical cubic bezier for the agent wiring, from the top of the sub-node
 * into the bottom of the agent it belongs to.
 */
function verticalPath(from: Point, to: Point): string {
  const dy = to.y - from.y
  const offset = Math.max(32, Math.abs(dy) * 0.45)
  return `M ${from.x} ${from.y} C ${from.x} ${from.y - offset}, ${to.x} ${to.y + offset}, ${to.x} ${to.y}`
}

/** True for n8n's agent-wiring channels: `ai_languageModel`, `ai_tool`, ... */
export function isAiChannel(channel: string): boolean {
  return channel.startsWith('ai_')
}

function route(edge: WorkflowEdge, nodes: PlacedNode[]): RoutedEdge | null {
  const from = nodes[edge.from]
  const to = nodes[edge.to]
  if (!from || !to) return null

  const isAi = isAiChannel(edge.channel)
  const d = isAi
    ? verticalPath({ x: from.cx, y: from.y }, { x: to.cx, y: to.y + NODE_SIZE })
    : horizontalPath(exitPoint(from), entryPoint(to))

  return { from: edge.from, to: edge.to, channel: edge.channel, isAi, d }
}

/**
 * Turns a workflow's nodes and edges into everything an `<svg>` needs.
 *
 * An empty workflow still gets a valid viewBox, because a zero-width viewBox
 * makes the browser drop the element entirely and the panel would render as a
 * blank rectangle with no explanation.
 */
export function buildScene(nodes: WorkflowNode[], edges: WorkflowEdge[]): GraphScene {
  const placed = place(nodes)

  if (placed.length === 0) {
    return { nodes: [], edges: [], viewBox: { x: 0, y: 0, width: 100, height: 100 } }
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const node of placed) {
    // The label slot is wider than the block and overhangs it on both sides.
    minX = Math.min(minX, node.cx - LABEL_WIDTH / 2)
    maxX = Math.max(maxX, node.cx + LABEL_WIDTH / 2)
    minY = Math.min(minY, node.y)
    maxY = Math.max(maxY, node.y + NODE_SIZE + LABEL_SPACE)
  }

  const routed: RoutedEdge[] = []
  for (const edge of edges) {
    const path = route(edge, placed)
    if (path) routed.push(path)
  }

  return {
    nodes: placed,
    edges: routed,
    viewBox: {
      x: minX - PADDING,
      y: minY - PADDING,
      width: maxX - minX + PADDING * 2,
      height: maxY - minY + PADDING * 2,
    },
  }
}

/**
 * The scale that fits a scene into a viewport, clamped.
 *
 * Capped at 1 so a three-node workflow is not blown up until its labels look
 * like a headline, and floored so a 246-node monster is still pannable rather
 * than shrunk to an unreadable smear.
 */
export function fitScale(scene: GraphScene, viewport: { width: number; height: number }): number {
  const { width, height } = scene.viewBox
  if (width <= 0 || height <= 0 || viewport.width <= 0 || viewport.height <= 0) return 1
  return Math.min(1, Math.max(0.12, Math.min(viewport.width / width, viewport.height / height)))
}
