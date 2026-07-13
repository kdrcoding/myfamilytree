import { getNodesBounds, getViewportForBounds } from '@xyflow/react';
import type { Node } from '@xyflow/react';
import { toPng } from 'html-to-image';

const MAX_SIZE = 4096;
const PADDING = 48;

/**
 * Render the currently visible tree to a PNG and trigger a download.
 * Uses html-to-image on React Flow's viewport element — the documented,
 * browser-only approach that needs no server.
 */
export async function exportTreeAsPng(nodes: Node[], darkMode: boolean): Promise<void> {
  const viewportEl = document.querySelector<HTMLElement>('.react-flow__viewport');
  if (!viewportEl || nodes.length === 0) {
    throw new Error('There is nothing to export yet.');
  }

  const bounds = getNodesBounds(nodes);
  const scale = Math.min(
    2,
    (MAX_SIZE - PADDING * 2) / Math.max(bounds.width, 1),
    (MAX_SIZE - PADDING * 2) / Math.max(bounds.height, 1),
  );
  const width = Math.round(bounds.width * scale) + PADDING * 2;
  const height = Math.round(bounds.height * scale) + PADDING * 2;
  const viewport = getViewportForBounds(bounds, width, height, scale, scale, PADDING);

  const dataUrl = await toPng(viewportEl, {
    backgroundColor: darkMode ? '#0c0a09' : '#fafaf9',
    width,
    height,
    pixelRatio: 1,
    style: {
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
    },
  });

  const anchor = document.createElement('a');
  anchor.href = dataUrl;
  anchor.download = 'family-tree.png';
  anchor.click();
}
