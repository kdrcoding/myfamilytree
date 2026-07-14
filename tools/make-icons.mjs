// Renders the app SVG icon to the PWA PNG sizes using system Chrome.
import puppeteer from 'puppeteer-core';
import { readFileSync } from 'node:fs';

const ROOT = 'C:/Users/Mqodi/projects/myfamilytree';
const svg = readFileSync(`${ROOT}/public/favicon.svg`, 'utf8');

const page512 = `<!doctype html><body style="margin:0">${svg.replace('<svg ', '<svg width="512" height="512" ')}</body>`;
const page192 = `<!doctype html><body style="margin:0">${svg.replace('<svg ', '<svg width="192" height="192" ')}</body>`;
// Maskable: full-bleed brand background, icon artwork inside the 80% safe zone.
const inner = svg
  .replace('<svg ', '<svg width="410" height="410" ')
  .replace('<rect width="64" height="64" rx="14" fill="#065f46"/>', '');
const pageMask = `<!doctype html><body style="margin:0;width:512px;height:512px;background:#065f46;display:flex;align-items:center;justify-content:center">${inner}</body>`;
const page180 = `<!doctype html><body style="margin:0">${svg.replace('<svg ', '<svg width="180" height="180" ')}</body>`;

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
});
const page = await browser.newPage();

async function shoot(html, size, file) {
  await page.setViewport({ width: size, height: size });
  await page.setContent(html);
  await page.screenshot({ path: `${ROOT}/public/${file}`, clip: { x: 0, y: 0, width: size, height: size } });
  console.log('wrote', file);
}

await shoot(page512, 512, 'pwa-512x512.png');
await shoot(page192, 192, 'pwa-192x192.png');
await shoot(pageMask, 512, 'pwa-maskable-512x512.png');
await shoot(page180, 180, 'apple-touch-icon.png');
await browser.close();
