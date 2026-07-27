import { getNodesBounds, getViewportForBounds } from '@xyflow/react';
import type { Node } from '@xyflow/react';
import { toPng } from 'html-to-image';

const MAX_SIZE = 4096;
const PADDING = 48;

export interface ExportTreeOptions {
  nodes: Node[];
  darkMode: boolean;
  /** Download filename without path. */
  filename?: string;
}

async function renderTreePng(nodes: Node[], darkMode: boolean): Promise<string> {
  const viewportEl = document.querySelector<HTMLElement>('.react-flow__viewport');
  if (!viewportEl || nodes.length === 0) {
    throw new Error('empty');
  }

  const personNodes = nodes.filter((n) => n.type === 'person' || n.type === 'junction' || n.type === 'genLabel');
  const bounds = getNodesBounds(personNodes.length > 0 ? personNodes : nodes);
  const scale = Math.min(
    2,
    (MAX_SIZE - PADDING * 2) / Math.max(bounds.width, 1),
    (MAX_SIZE - PADDING * 2) / Math.max(bounds.height, 1),
  );
  const width = Math.round(bounds.width * scale) + PADDING * 2;
  const height = Math.round(bounds.height * scale) + PADDING * 2;
  const viewport = getViewportForBounds(bounds, width, height, scale, scale, PADDING);

  return toPng(viewportEl, {
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
}

function triggerDownload(dataUrl: string, filename: string): void {
  const anchor = document.createElement('a');
  anchor.href = dataUrl;
  anchor.download = filename;
  anchor.click();
}

/** Render the visible tree to a PNG and download it (poster for elders). */
export async function exportTreeAsPng(options: ExportTreeOptions): Promise<void> {
  const dataUrl = await renderTreePng(options.nodes, options.darkMode);
  triggerDownload(dataUrl, options.filename ?? 'family-tree.png');
}

/** Share via the device share sheet when available; otherwise download. */
export async function shareTreePoster(options: ExportTreeOptions & { title: string; text: string }): Promise<'shared' | 'downloaded'> {
  const dataUrl = await renderTreePng(options.nodes, options.darkMode);
  const filename = options.filename ?? 'family-tree.png';
  const blob = await (await fetch(dataUrl)).blob();
  const file = new File([blob], filename, { type: 'image/png' });

  if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: options.title, text: options.text });
    return 'shared';
  }

  triggerDownload(dataUrl, filename);
  return 'downloaded';
}

/** Open the poster in a print-friendly window. */
export async function printTreePoster(options: ExportTreeOptions): Promise<void> {
  const dataUrl = await renderTreePng(options.nodes, options.darkMode);
  const win = window.open('', '_blank', 'noopener,noreferrer');
  if (!win) {
    triggerDownload(dataUrl, options.filename ?? 'family-tree.png');
    return;
  }
  win.document.write(`<!doctype html><html><head><title>Family tree</title>
<style>
  html,body{margin:0;background:#fff}
  img{display:block;max-width:100%;margin:0 auto}
  @media print{img{max-width:100%;page-break-inside:avoid}}
</style></head><body>
<img src="${dataUrl}" alt="Family tree" onload="setTimeout(function(){window.focus();window.print()},200)" />
</body></html>`);
  win.document.close();
}
