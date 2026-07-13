import { MarkerType } from '@xyflow/react';
import type { Edge, Node } from '@xyflow/react';
import type { FamilyPerson } from '../../types/family';
import { buildIndex, findFounders, sortByBirth } from '../../utils/family';
import type { PersonIndex } from '../../utils/family';

export const CARD_W = 224;
export const CARD_H = 112;
const SPOUSE_GAP = 48;
const SIBLING_GAP = 40;
const LEVEL_GAP = 120;
const ROOT_GAP = 120;
const JUNCTION = 10;

export interface PersonNodeData extends Record<string, unknown> {
  personId: string;
  collapsible: boolean;
  collapsed: boolean;
  hiddenCount: number;
}

export type PersonFlowNode = Node<PersonNodeData, 'person'>;

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

function measure(unit: Unit): number {
  const clusterW = unit.memberIds.length * CARD_W + (unit.memberIds.length - 1) * SPOUSE_GAP;
  const childrenW = unit.children.reduce(
    (sum, child, i) => sum + measure(child) + (i > 0 ? SIBLING_GAP : 0),
    0,
  );
  unit.width = Math.max(clusterW, childrenW);
  return unit.width;
}

export interface TreeLayout {
  nodes: PersonFlowNode[];
  junctionNodes: Node[];
  edges: Edge[];
  positions: Map<string, { x: number; y: number }>;
}

/** Compute node positions and relationship edges for the whole family. */
export function computeTreeLayout(people: FamilyPerson[], collapsedIds: Set<string>): TreeLayout {
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

  function place(unit: Unit, x: number, depth: number): void {
    const y = depth * (CARD_H + LEVEL_GAP);
    const clusterW = unit.memberIds.length * CARD_W + (unit.memberIds.length - 1) * SPOUSE_GAP;
    const clusterX = x + (unit.width - clusterW) / 2;

    unit.memberIds.forEach((memberId, i) => {
      const memberX = clusterX + i * (CARD_W + SPOUSE_GAP);
      positions.set(memberId, { x: memberX, y });
      nodes.push({
        id: memberId,
        type: 'person',
        position: { x: memberX, y },
        data: {
          personId: memberId,
          collapsible: memberId === unit.anchorId && (unit.children.length > 0 || unit.collapsed),
          collapsed: unit.collapsed,
          hiddenCount: unit.hiddenCount,
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
      const married = index.get(left)!.spouseIds.includes(right);
      const sharedChildren = index
        .get(left)!
        .childIds.filter((id) => index.get(right)!.childIds.includes(id));
      // Solid line for a marriage, dashed for unmarried co-parents. Adjacent
      // members that are neither (e.g. the two partners of a twice-married
      // anchor standing on either side of them) get no line at all.
      if (married || sharedChildren.length > 0) {
        edges.push({
          id: `spouse-${left}-${right}`,
          source: left,
          sourceHandle: 'right',
          target: right,
          targetHandle: 'left',
          type: 'straight',
          className: married ? 'edge-spouse' : 'edge-partner',
          focusable: false,
        });
      }
      if (sharedChildren.length > 0 && !unit.collapsed) {
        const pairKey = [left, right].sort().join('|');
        const junctionId = `junction-${pairKey}`;
        junctionByPair.set(pairKey, junctionId);
        const gapCenter = positions.get(left)!.x + CARD_W + SPOUSE_GAP / 2;
        junctionNodes.push({
          id: junctionId,
          type: 'junction',
          position: { x: gapCenter - JUNCTION / 2, y: y + CARD_H / 2 - JUNCTION / 2 },
          data: {},
          draggable: false,
          selectable: false,
          connectable: false,
        });
      }
    }

    let childX =
      x +
      (unit.width -
        unit.children.reduce((sum, c, i) => sum + c.width + (i > 0 ? SIBLING_GAP : 0), 0)) /
        2;
    for (const child of unit.children) {
      place(child, childX, depth + 1);
      childX += child.width + SIBLING_GAP;
    }
  }

  let rootX = 0;
  for (const root of roots) {
    measure(root);
    place(root, rootX, 0);
    rootX += root.width + ROOT_GAP;
  }

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
        type: 'smoothstep',
        pathOptions: { borderRadius: 12 },
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
          type: 'smoothstep',
          pathOptions: { borderRadius: 12 },
          className: 'edge-child',
          markerEnd: childMarker,
          focusable: false,
        } as Edge);
      }
    }
  }

  return { nodes, junctionNodes, edges, positions };
}
