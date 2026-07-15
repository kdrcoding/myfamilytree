import { MarkerType } from '@xyflow/react';
import type { Edge, Node } from '@xyflow/react';
import type { FamilyPerson } from '../../types/family';
import { buildIndex, findFounders, isDivorced, sortByBirth } from '../../utils/family';
import type { PersonIndex } from '../../utils/family';

// Cards are wide enough to show a full "First Last" name across two lines and
// tall enough for the name, nickname, dates and the gender/deceased badges.
export const CARD_W = 276;
export const CARD_H = 130;

export type TreeOrientation = 'vertical' | 'horizontal';
export type TreeSpacing = 'comfortable' | 'compact';

/** Gap sizes per spacing mode (comfortable = airy, compact = dense). */
const SPACING: Record<
  TreeSpacing,
  { spouse: number; sibling: number; level: number; root: number }
> = {
  comfortable: { spouse: 44, sibling: 36, level: 150, root: 80 },
  compact: { spouse: 32, sibling: 20, level: 112, root: 56 },
};

const JUNCTION = 10;
// Child connectors run along a "bus" just before the children. Each couple
// gets its own lane so a long cross-family link crosses other buses instead
// of running on top of them (see ChildEdge).
const BUS_BASE = 34;
const BUS_STEP = 22;
const BUS_LANES = 3;
// Room reserved before each generation row for its label chip.
const GEN_LABEL_GAP = 148;

/**
 * How many whole generations open on a family's first view before deeper
 * branches auto-collapse (see defaultCollapsedIds). Two keeps even a large
 * tree narrow on load; the viewer expands from there.
 */
export const DEFAULT_OPEN_GENERATIONS = 2;

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

function buildUnit(
  anchorId: string,
  index: PersonIndex,
  visited: Set<string>,
  collapsedIds: Set<string>,
  suppressed: Set<string>,
): Unit {
  const anchor = index.get(anchorId)!;
  visited.add(anchorId);
  const spouseIds = anchor.spouseIds.filter((id) => index.has(id) && !visited.has(id));
  for (const spouseId of spouseIds) visited.add(spouseId);
  // One marriage reads left-to-right; with several marriages the anchor sits
  // in the middle so each partner stands directly beside them and every
  // couple gets its own marriage line and child connector.
  const leftCount = Math.floor(spouseIds.length / 2);
  const memberIds = [...spouseIds.slice(0, leftCount), anchorId, ...spouseIds.slice(leftCount)];

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

/** Compute node positions and relationship edges for the whole family. */
export function computeTreeLayout(
  people: FamilyPerson[],
  collapsedIds: Set<string>,
  options: TreeLayoutOptions = {},
): TreeLayout {
  const orientation = options.orientation ?? 'vertical';
  const gap = SPACING[options.spacing ?? 'comfortable'];
  const index = buildIndex(people);
  const visited = new Set<string>();
  const suppressed = new Set<string>();
  const roots: Unit[] = [];

  for (const founder of findFounders(people)) {
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

  function place(unit: Unit, x: number, depth: number): void {
    const y = depth * (CARD_H + gap.level);
    const clusterW = unit.memberIds.length * CARD_W + (unit.memberIds.length - 1) * gap.spouse;
    const clusterX = x + (unit.width - clusterW) / 2;

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
        height: CARD_H,
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
      const married = leftPerson.spouseIds.includes(right);
      const divorced = isDivorced(leftPerson, rightPerson);
      const sharedChildren = leftPerson.childIds.filter((id) =>
        rightPerson.childIds.includes(id),
      );
      if (married || sharedChildren.length > 0) {
        edges.push({
          id: `spouse-${left}-${right}`,
          source: left,
          sourceHandle: 'right',
          target: right,
          targetHandle: 'left',
          type: 'straight',
          className: divorced ? 'edge-divorced' : 'edge-spouse',
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
          position: { x: gapCenter - JUNCTION / 2, y: y + CARD_H / 2 - JUNCTION / 2 },
          width: JUNCTION,
          height: JUNCTION,
          data: { orientation },
          draggable: false,
          selectable: false,
          connectable: false,
        });
      }
    }

    let childX =
      x +
      (unit.width -
        unit.children.reduce((sum, c, i) => sum + c.width + (i > 0 ? gap.sibling : 0), 0)) /
        2;
    for (const child of unit.children) {
      place(child, childX, depth + 1);
      childX += child.width + gap.sibling;
    }
  }

  let rootX = 0;
  for (const root of roots) {
    measure(root, gap.spouse, gap.sibling);
    place(root, rootX, 0);
    rootX += root.width + gap.root;
  }

  // Each child connector's source (a couple's junction, or a lone parent)
  // keeps a stable bus lane so all siblings share one trunk while neighbouring
  // couples sit at different heights.
  const laneBySource = new Map<string, number>();
  const busOffsetFor = (sourceId: string): number => {
    let lane = laneBySource.get(sourceId);
    if (lane === undefined) {
      lane = laneBySource.size % BUS_LANES;
      laneBySource.set(sourceId, lane);
    }
    return BUS_BASE + lane * BUS_STEP;
  };

  // Parent -> child edges, preferring the couple's junction dot when both
  // parents are drawn next to each other.
  for (const person of people) {
    if (!positions.has(person.id)) continue;
    const placedParents = person.parentIds.filter((id) => positions.has(id));
    if (placedParents.length === 0) continue;
    const pairKey = [...placedParents].sort().join('|');
    const junctionId = placedParents.length >= 2 ? junctionByPair.get(pairKey) : undefined;
    // Arrow points AT the child, so "who gave birth to whom" reads at a glance.
    const childMarker = { type: MarkerType.ArrowClosed, width: 18, height: 18, color: '#10b981' };
    if (junctionId) {
      edges.push({
        id: `child-${junctionId}-${person.id}`,
        source: junctionId,
        sourceHandle: 'out',
        target: person.id,
        targetHandle: 'top',
        type: 'child',
        data: { busOffset: busOffsetFor(junctionId), orientation },
        className: 'edge-child',
        markerEnd: childMarker,
        focusable: false,
      } as Edge);
    } else {
      for (const parentId of placedParents) {
        edges.push({
          id: `child-${parentId}-${person.id}`,
          source: parentId,
          sourceHandle: 'bottom',
          target: person.id,
          targetHandle: 'top',
          type: 'child',
          data: { busOffset: busOffsetFor(parentId), orientation },
          className: 'edge-child',
          markerEnd: childMarker,
          focusable: false,
        } as Edge);
      }
    }
  }

  // One label chip per generation row, placed just before the row's first card.
  const genLabelNodes: Node<GenLabelData, 'genLabel'>[] = [];
  const rowMinX = new Map<number, number>();
  for (const node of nodes) {
    const depth = depthByNode.get(node.id) ?? 0;
    rowMinX.set(depth, Math.min(rowMinX.get(depth) ?? Infinity, node.position.x));
  }
  for (const [depth, minX] of rowMinX) {
    genLabelNodes.push({
      id: `gen-${depth}`,
      type: 'genLabel',
      position: { x: minX - GEN_LABEL_GAP, y: depth * (CARD_H + gap.level) + CARD_H / 2 - 16 },
      width: GEN_LABEL_GAP - 24,
      height: 32,
      data: { generation: depth + 1, orientation },
      draggable: false,
      selectable: false,
      connectable: false,
    });
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
