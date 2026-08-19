import { MarkerType } from '@xyflow/react';
import type { Edge, Node } from '@xyflow/react';
import type { FamilyPerson } from '../../types/family';
import { buildIndex, findFounders, isDivorced, sortByBirth } from '../../utils/family';
import type { PersonIndex } from '../../utils/family';
import { dnaPaletteForParents } from './dnaColor';
import type { DnaPalette } from './dnaColor';

// Cards are wide enough to show a full "First Last" name across two lines and
// tall enough for the name, nickname, dates and the gender/deceased badges.
export const CARD_W = 276;
export const CARD_H = 130;
/** Phone / compact cards skip badges, so they can be shorter. */
export const CARD_H_COMPACT = 102;

export type TreeOrientation = 'vertical' | 'horizontal';
export type TreeSpacing = 'comfortable' | 'compact';

/** Gap sizes per spacing mode (comfortable = airy, compact = dense). */
const SPACING: Record<
  TreeSpacing,
  { spouse: number; sibling: number; level: number; root: number }
> = {
  // Tighter spouse/root gaps keep the oldest generation together; a taller
  // level gap leaves room for separate green bus lanes between rows.
  comfortable: { spouse: 58, sibling: 40, level: 176, root: 48 },
  compact: { spouse: 52, sibling: 24, level: 140, root: 32 },
};

const JUNCTION = 10;
/** Drop the child-junction just below the wedding rings on the marriage line. */
const JUNCTION_BELOW_RINGS = 22;
// Child connectors run along a "bus" just before the children. Each couple
// gets its own lane so a long cross-family link crosses other buses instead
// of running on top of them (see ChildEdge).
const BUS_BASE = 44;
const BUS_STEP = 20;
const BUS_LANES = 5;
// Room reserved before each generation row for its label chip.
const GEN_LABEL_GAP = 148;

/**
 * How many whole generations open on a family's first view before deeper
 * branches auto-collapse (see defaultCollapsedIds). Two keeps even a large
 * tree narrow on load; the viewer expands from there.
 */
export const DEFAULT_OPEN_GENERATIONS = 2;

/** Fallback when a palette is missing (should be rare). */
export const CHILD_EDGE_COLOR = '#059669';

export interface PersonNodeData extends Record<string, unknown> {
  personId: string;
  collapsible: boolean;
  collapsed: boolean;
  hiddenCount: number;
  generation: number;
}

export type PersonFlowNode = Node<PersonNodeData, 'person'>;

export interface GenLabelData extends Record<string, unknown> {
  generation: number;
  orientation: TreeOrientation;
}

export interface TreeLayoutOptions {
  orientation?: TreeOrientation;
  spacing?: TreeSpacing;
  /** Generation chips beside each row. Off on phones to keep the canvas clear. */
  showGenLabels?: boolean;
}

/**
 * A layout unit: one "anchor" person (usually a blood descendant) plus the
 * spouses drawn next to them, with the couple's children laid out below.
 */
interface Unit {
  anchorId: string;
  memberIds: string[];
  children: Unit[];
  collapsed: boolean;
  hiddenCount: number;
  width: number;
}

/** Other parents of this person's children who are not yet visited. */
function coParentIds(
  anchor: FamilyPerson,
  index: PersonIndex,
  visited: Set<string>,
): string[] {
  const found = new Set<string>();
  for (const childId of anchor.childIds) {
    const child = index.get(childId);
    if (!child) continue;
    for (const pid of child.parentIds) {
      if (pid !== anchor.id && index.has(pid) && !visited.has(pid)) found.add(pid);
    }
  }
  return [...found];
}

function buildUnit(
  anchorId: string,
  index: PersonIndex,
  visited: Set<string>,
  collapsedIds: Set<string>,
  suppressed: Set<string>,
): Unit {
  const anchor = index.get(anchorId)!;
  visited.add(anchorId);

  // Partners: recorded spouses, plus co-parents of shared children (so a
  // founding couple without a spouse link still sits side-by-side on top).
  const spouseIds = anchor.spouseIds.filter((id) => index.has(id) && !visited.has(id));
  const partners = [
    ...spouseIds,
    ...coParentIds(anchor, index, visited).filter((id) => !spouseIds.includes(id)),
  ];
  for (const partnerId of partners) visited.add(partnerId);

  // One marriage reads left-to-right; with several marriages the anchor sits
  // in the middle so each partner stands directly beside them and every
  // couple gets its own marriage line and child connector.
  const leftCount = Math.floor(partners.length / 2);
  const memberIds = [...partners.slice(0, leftCount), anchorId, ...partners.slice(leftCount)];

  const memberPos = new Map(memberIds.map((id, i) => [id, i]));
  const coupleOf = (p: FamilyPerson): number => {
    const positions = p.parentIds.filter((id) => memberPos.has(id)).map((id) => memberPos.get(id)!);
    return positions.length > 0 ? Math.min(...positions) : memberPos.get(anchorId)!;
  };
  const childIds = [...new Set(memberIds.flatMap((id) => index.get(id)!.childIds))]
    .map((id) => index.get(id))
    .filter((c): c is FamilyPerson => c !== undefined && !visited.has(c.id))
    // Keep children of the same couple together (in the couple's left-to-right
    // order) so connectors from different marriages never cross.
    .sort((a, b) => coupleOf(a) - coupleOf(b) || sortByBirth(a, b))
    .map((c) => c.id);

  const collapsed = collapsedIds.has(anchorId) && childIds.length > 0;
  const children: Unit[] = [];
  let hiddenCount = 0;
  if (collapsed) {
    // Mark every descendant AND their married-in spouses as suppressed so the
    // root-collection loops don't draw them as detached trees.
    const hidden = new Set<string>();
    const queue = [...childIds];
    while (queue.length > 0) {
      const id = queue.shift()!;
      if (hidden.has(id) || visited.has(id)) continue;
      hidden.add(id);
      suppressed.add(id);
      const person = index.get(id)!;
      for (const spouseId of person.spouseIds) {
        if (index.has(spouseId) && !visited.has(spouseId)) queue.push(spouseId);
      }
      for (const childId of person.childIds) {
        if (index.has(childId)) queue.push(childId);
      }
    }
    hiddenCount = hidden.size;
  } else {
    for (const childId of childIds) {
      children.push(buildUnit(childId, index, visited, collapsedIds, suppressed));
    }
  }

  return { anchorId, memberIds, children, collapsed, hiddenCount, width: 0 };
}

function measure(unit: Unit, spouseGap: number, siblingGap: number): number {
  const clusterW = unit.memberIds.length * CARD_W + (unit.memberIds.length - 1) * spouseGap;
  const childrenW = unit.children.reduce(
    (sum, child, i) => sum + measure(child, spouseGap, siblingGap) + (i > 0 ? siblingGap : 0),
    0,
  );
  unit.width = Math.max(clusterW, childrenW);
  return unit.width;
}

/** Collect every person / junction id belonging to a unit subtree. */
function collectSubtreeIds(unit: Unit, into: Set<string>): void {
  for (const id of unit.memberIds) into.add(id);
  for (const child of unit.children) collectSubtreeIds(child, into);
}

export interface TreeLayout {
  nodes: PersonFlowNode[];
  junctionNodes: Node[];
  genLabelNodes: Node<GenLabelData, 'genLabel'>[];
  edges: Edge[];
  positions: Map<string, { x: number; y: number }>;
}

// Reflecting positions across the main diagonal (x,y)->(y,x) turns the
// top-down layout into a left-to-right one. Handles must be remapped to match
// their new geometric side.
const HANDLE_REFLECT: Record<string, string> = {
  top: 'left',
  left: 'top',
  right: 'bottom',
  bottom: 'right',
};

function shiftSubtree(
  ids: Set<string>,
  dx: number,
  nodes: PersonFlowNode[],
  junctionNodes: Node[],
  positions: Map<string, { x: number; y: number }>,
  depthByNode?: Map<string, number>,
  /** When set, only shift people at this depth or deeper (keeps founders put). */
  minDepth = 0,
): void {
  if (dx === 0) return;
  for (const node of nodes) {
    if (!ids.has(node.id)) continue;
    if ((depthByNode?.get(node.id) ?? 0) < minDepth) continue;
    node.position.x += dx;
  }
  for (const node of junctionNodes) {
    const key = node.id.replace(/^junction-/, '');
    const parts = key.split('|');
    const touches = parts.some((id) => ids.has(id)) || ids.has(node.id);
    if (!touches) continue;
    // Keep founding-couple junctions put when only shifting deeper nodes.
    if (minDepth > 0 && parts.every((id) => (depthByNode?.get(id) ?? 0) < minDepth)) {
      continue;
    }
    node.position.x += dx;
  }
  for (const id of ids) {
    if ((depthByNode?.get(id) ?? 0) < minDepth) continue;
    const pos = positions.get(id);
    if (pos) pos.x += dx;
  }
}

/** Compute node positions and relationship edges for the whole family. */
export function computeTreeLayout(
  people: FamilyPerson[],
  collapsedIds: Set<string>,
  options: TreeLayoutOptions = {},
): TreeLayout {
  const orientation = options.orientation ?? 'vertical';
  const spacing = options.spacing ?? 'comfortable';
  const gap = SPACING[spacing];
  const cardH = spacing === 'compact' ? CARD_H_COMPACT : CARD_H;
  const showGenLabels = options.showGenLabels !== false;
  const index = buildIndex(people);
  const visited = new Set<string>();
  const suppressed = new Set<string>();
  const roots: Unit[] = [];

  // Oldest founders first so the main ancestral couple anchors the left/center.
  const founderList = [...findFounders(people)].sort(sortByBirth);
  for (const founder of founderList) {
    if (!visited.has(founder.id)) {
      roots.push(buildUnit(founder.id, index, visited, collapsedIds, suppressed));
    }
  }
  // Anyone unreachable from the founders (disconnected branches) still gets
  // drawn — unless they are hidden inside a collapsed branch.
  for (const person of people) {
    if (
      !visited.has(person.id) &&
      !suppressed.has(person.id) &&
      person.parentIds.every((id) => !index.has(id))
    ) {
      roots.push(buildUnit(person.id, index, visited, collapsedIds, suppressed));
    }
  }
  for (const person of people) {
    if (!visited.has(person.id) && !suppressed.has(person.id)) {
      roots.push(buildUnit(person.id, index, visited, collapsedIds, suppressed));
    }
  }

  const nodes: PersonFlowNode[] = [];
  const junctionNodes: Node[] = [];
  const edges: Edge[] = [];
  const positions = new Map<string, { x: number; y: number }>();
  const junctionByPair = new Map<string, string>();
  const depthByNode = new Map<string, number>();

  function place(unit: Unit, x: number, depth: number, clusterLeft?: number): void {
    const y = depth * (cardH + gap.level);
    const clusterW = unit.memberIds.length * CARD_W + (unit.memberIds.length - 1) * gap.spouse;
    // Default: center the couple over their subtree. Roots pass an explicit
    // clusterLeft so several founding lines sit next to each other on top.
    const clusterX =
      clusterLeft !== undefined ? clusterLeft : x + (unit.width - clusterW) / 2;

    unit.memberIds.forEach((memberId, i) => {
      const memberX = clusterX + i * (CARD_W + gap.spouse);
      positions.set(memberId, { x: memberX, y });
      depthByNode.set(memberId, depth);
      nodes.push({
        id: memberId,
        type: 'person',
        position: { x: memberX, y },
        // Explicit dimensions let getNodesBounds (PNG export) measure the
        // tree before React Flow has rendered the nodes.
        width: CARD_W,
        height: cardH,
        data: {
          personId: memberId,
          collapsible: memberId === unit.anchorId && (unit.children.length > 0 || unit.collapsed),
          collapsed: unit.collapsed,
          hiddenCount: unit.hiddenCount,
          generation: depth + 1,
        },
        draggable: false,
        connectable: false,
      });
    });

    // Marriage lines between neighbouring spouses, with a junction dot in the
    // middle of each couple that has children currently visible.
    for (let i = 0; i < unit.memberIds.length - 1; i++) {
      const left = unit.memberIds[i];
      const right = unit.memberIds[i + 1];
      const leftPerson = index.get(left)!;
      const rightPerson = index.get(right)!;
      const married = leftPerson.spouseIds.includes(right) || rightPerson.spouseIds.includes(left);
      const divorced = isDivorced(leftPerson, rightPerson);
      const sharedChildren = leftPerson.childIds.filter((id) =>
        rightPerson.childIds.includes(id),
      );
      // Draw a couple link for recorded marriages OR shared children (co-parents).
      if (married || sharedChildren.length > 0) {
        edges.push({
          id: `spouse-${left}-${right}`,
          source: left,
          sourceHandle: 'right',
          target: right,
          targetHandle: 'left',
          type: 'spouse',
          className: divorced ? 'edge-divorced' : 'edge-spouse',
          data: { divorced },
          focusable: false,
        });
      }
      if (sharedChildren.length > 0 && !unit.collapsed) {
        const pairKey = [left, right].sort().join('|');
        const junctionId = `junction-${pairKey}`;
        junctionByPair.set(pairKey, junctionId);
        const gapCenter = positions.get(left)!.x + CARD_W + gap.spouse / 2;
        junctionNodes.push({
          id: junctionId,
          type: 'junction',
          position: {
            x: gapCenter - JUNCTION / 2,
            y: y + cardH / 2 - JUNCTION / 2 + JUNCTION_BELOW_RINGS,
          },
          width: JUNCTION,
          height: JUNCTION,
          data: { orientation },
          draggable: false,
          selectable: false,
          connectable: false,
        });
      }
    }

    const childrenSpan = unit.children.reduce(
      (sum, c, i) => sum + c.width + (i > 0 ? gap.sibling : 0),
      0,
    );
    // Fan children out under the couple's center so parents stay together
    // even when the next generation is much wider.
    const clusterCenter = clusterX + clusterW / 2;
    let childX = clusterCenter - childrenSpan / 2;
    for (const child of unit.children) {
      place(child, childX, depth + 1);
      childX += child.width + gap.sibling;
    }
  }

  // Pack root couples tightly side-by-side; children fan out under each couple.
  let clusterCursor = 0;
  const subtreeIds: Set<string>[] = [];
  for (const root of roots) {
    measure(root, gap.spouse, gap.sibling);
    const clusterW = root.memberIds.length * CARD_W + (root.memberIds.length - 1) * gap.spouse;
    place(root, clusterCursor, 0, clusterCursor);
    const ids = new Set<string>();
    collectSubtreeIds(root, ids);
    subtreeIds.push(ids);
    clusterCursor += clusterW + gap.root;
  }

  // If child rows from neighbouring root lines overlap, nudge later *children*
  // right — founding couples on top stay side-by-side.
  for (let i = 1; i < roots.length; i++) {
    let leftMax = -Infinity;
    for (let j = 0; j < i; j++) {
      for (const id of subtreeIds[j]) {
        if ((depthByNode.get(id) ?? 0) < 1) continue;
        const pos = positions.get(id);
        if (pos) leftMax = Math.max(leftMax, pos.x + CARD_W);
      }
    }
    let rightMin = Infinity;
    for (const id of subtreeIds[i]) {
      if ((depthByNode.get(id) ?? 0) < 1) continue;
      const pos = positions.get(id);
      if (pos) rightMin = Math.min(rightMin, pos.x);
    }
    if (!Number.isFinite(leftMax) || !Number.isFinite(rightMin)) continue;
    const overlap = leftMax + gap.sibling - rightMin;
    if (overlap > 0) {
      shiftSubtree(subtreeIds[i], overlap, nodes, junctionNodes, positions, depthByNode, 1);
    }
  }

  // Assign bus lanes left-to-right by source X so neighbouring couples get
  // alternating heights instead of stacking on the same green line.
  const laneBySource = new Map<string, number>();
  const pendingSources: { id: string; x: number }[] = [];
  const noteSource = (sourceId: string, x: number) => {
    if (!laneBySource.has(sourceId) && !pendingSources.some((s) => s.id === sourceId)) {
      pendingSources.push({ id: sourceId, x });
    }
  };

  const ensureJunctionForParents = (parentIds: string[]): string | undefined => {
    if (parentIds.length < 2) return undefined;
    const pairKey = [...parentIds].sort().join('|');
    const existing = junctionByPair.get(pairKey);
    if (existing) return existing;

    const placed = parentIds
      .map((id) => ({ id, pos: positions.get(id) }))
      .filter((p): p is { id: string; pos: { x: number; y: number } } => !!p.pos);
    if (placed.length < 2) return undefined;

    placed.sort((a, b) => a.pos.x - b.pos.x);
    const left = placed[0];
    const right = placed[placed.length - 1];
    const midX = (left.pos.x + CARD_W + right.pos.x) / 2;
    const midY = (left.pos.y + right.pos.y) / 2 + cardH / 2 + JUNCTION_BELOW_RINGS;
    const junctionId = `junction-${pairKey}`;
    junctionByPair.set(pairKey, junctionId);
    junctionNodes.push({
      id: junctionId,
      type: 'junction',
      position: { x: midX - JUNCTION / 2, y: midY - JUNCTION / 2 },
      width: JUNCTION,
      height: JUNCTION,
      data: { orientation },
      draggable: false,
      selectable: false,
      connectable: false,
    });
    return junctionId;
  };

  // Parent -> child edges, preferring the couple's junction dot when both
  // parents are drawn next to each other.
  const childEdgeDrafts: {
    id: string;
    source: string;
    sourceHandle: string;
    target: string;
    sourceX: number;
    parentIds: string[];
  }[] = [];

  const paletteByCouple = new Map<string, DnaPalette>();
  const paletteFor = (parentIds: string[], generation = 0): DnaPalette => {
    const key = [...parentIds].sort().join('|');
    let palette = paletteByCouple.get(key);
    if (!palette) {
      palette = dnaPaletteForParents(parentIds, index, generation);
      paletteByCouple.set(key, palette);
    }
    return palette;
  };

  for (const person of people) {
    if (!positions.has(person.id)) continue;
    const placedParents = person.parentIds.filter((id) => positions.has(id));
    if (placedParents.length === 0) continue;
    const pairKey = [...placedParents].sort().join('|');
    let junctionId =
      placedParents.length >= 2 ? junctionByPair.get(pairKey) : undefined;
    if (placedParents.length >= 2 && !junctionId) {
      junctionId = ensureJunctionForParents(placedParents);
    }

    if (junctionId) {
      const jNode = junctionNodes.find((n) => n.id === junctionId);
      const sourceX = jNode ? jNode.position.x : 0;
      const childGen = depthByNode.get(person.id) ?? 0;
      const palette = paletteFor(placedParents, childGen);
      if (jNode) {
        jNode.data = { ...jNode.data, dnaColor: palette.trunk };
      }
      childEdgeDrafts.push({
        id: `child-${junctionId}-${person.id}`,
        source: junctionId,
        sourceHandle: 'out',
        target: person.id,
        sourceX,
        parentIds: placedParents,
      });
      noteSource(junctionId, sourceX);
    } else {
      for (const parentId of placedParents) {
        const sourceX = positions.get(parentId)?.x ?? 0;
        childEdgeDrafts.push({
          id: `child-${parentId}-${person.id}`,
          source: parentId,
          sourceHandle: 'bottom',
          target: person.id,
          sourceX,
          parentIds: [parentId],
        });
        noteSource(parentId, sourceX);
      }
    }
  }

  pendingSources.sort((a, b) => a.x - b.x);
  pendingSources.forEach((s, i) => {
    laneBySource.set(s.id, i % BUS_LANES);
  });

  const busOffsetFor = (sourceId: string): number => {
    const lane = laneBySource.get(sourceId) ?? 0;
    return BUS_BASE + lane * BUS_STEP;
  };

  for (const draft of childEdgeDrafts) {
    const childGen = depthByNode.get(draft.target) ?? 0;
    const palette = paletteFor(draft.parentIds, childGen);
    edges.push({
      id: draft.id,
      source: draft.source,
      sourceHandle: draft.sourceHandle,
      target: draft.target,
      targetHandle: 'top',
      type: 'child',
      data: {
        busOffset: busOffsetFor(draft.source),
        orientation,
        dnaA: palette.a,
        dnaB: palette.b,
        dnaTrunk: palette.trunk,
      },
      className: 'edge-child',
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 10,
        height: 10,
        color: palette.trunk,
      },
      focusable: false,
      style: { stroke: palette.trunk },
    } as Edge);
  }

  // One label chip per generation row, placed just before the row's first card.
  const genLabelNodes: Node<GenLabelData, 'genLabel'>[] = [];
  if (showGenLabels) {
    const rowMinX = new Map<number, number>();
    for (const node of nodes) {
      const depth = depthByNode.get(node.id) ?? 0;
      rowMinX.set(depth, Math.min(rowMinX.get(depth) ?? Infinity, node.position.x));
    }
    for (const [depth, minX] of rowMinX) {
      genLabelNodes.push({
        id: `gen-${depth}`,
        type: 'genLabel',
        position: { x: minX - GEN_LABEL_GAP, y: depth * (cardH + gap.level) + cardH / 2 - 16 },
        width: GEN_LABEL_GAP - 24,
        height: 32,
        data: { generation: depth + 1, orientation },
        draggable: false,
        selectable: false,
        connectable: false,
      });
    }
  }

  // Horizontal orientation: reflect every position across the main diagonal
  // and remap edge handles to their new sides. The layout maths above always
  // runs top-down; this projects it to left-to-right when requested.
  if (orientation === 'horizontal') {
    // Reflect positions across the main diagonal (x<->y) in place.
    const swap = (n: Node) => {
      n.position = { x: n.position.y, y: n.position.x };
    };
    for (const n of nodes) swap(n);
    for (const n of junctionNodes) swap(n);
    for (const n of genLabelNodes) swap(n);
    for (const [, pos] of positions) {
      const px = pos.y;
      pos.y = pos.x;
      pos.x = px;
    }
    for (const edge of edges) {
      if (edge.sourceHandle && HANDLE_REFLECT[edge.sourceHandle]) {
        edge.sourceHandle = HANDLE_REFLECT[edge.sourceHandle];
      }
      if (edge.targetHandle && HANDLE_REFLECT[edge.targetHandle]) {
        edge.targetHandle = HANDLE_REFLECT[edge.targetHandle];
      }
    }
  }

  return { nodes, junctionNodes, genLabelNodes, edges, positions };
}
