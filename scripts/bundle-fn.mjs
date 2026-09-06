import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('supabase/functions');

function stripExport(src) {
  return src
    .replace(/^export type /gm, 'type ')
    .replace(/^export const /gm, 'const ')
    .replace(/^export async function /gm, 'async function ')
    .replace(/^export function /gm, 'function ');
}

function stripRelativeImports(src) {
  return src.replace(/^import[\s\S]*?from\s+['"]\.[^'"]+['"];\r?\n/gm, '');
}

function collectRemoteImports(src) {
  const lines = [];
  const rest = src.replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\r?\n/gm, (m) => {
    if (m.includes("from './") || m.includes("from '../") || m.includes('from "./') || m.includes('from "../')) {
      return '';
    }
    lines.push(m.trimEnd());
    return '';
  });
  return { remote: lines, rest };
}

function load(rel) {
  const p = path.join(root, rel);
  return fs.readFileSync(p, 'utf8');
}

function bundle(entryRel, sharedRels, outName) {
  const remotes = [];
  const parts = [];
  for (const rel of sharedRels) {
    const src = load(rel);
    const { remote, rest } = collectRemoteImports(src);
    remotes.push(...remote);
    parts.push(`\n/* ---- ${rel} ---- */\n${stripExport(stripRelativeImports(rest))}`);
  }
  const entry = load(entryRel);
  const { remote, rest } = collectRemoteImports(entry);
  remotes.push(...remote);
  const uniqueRemote = [...new Set(remotes)];
  const bundled = `${uniqueRemote.join('\n')}\n${parts.join('\n')}\n/* ---- ${entryRel} ---- */\n${stripRelativeImports(rest)}`;
  const out = path.join('.tmp-deploy', outName);
  fs.mkdirSync('.tmp-deploy', { recursive: true });
  fs.writeFileSync(out, bundled);
  console.log(out, bundled.length);
}

bundle(
  'birthday-public/index.ts',
  ['_shared/telegram.ts', '_shared/cardTheme.ts', '_shared/wishes.ts', '_shared/whoIsThis.ts'],
  'birthday-public.ts',
);
bundle(
  'telegram-webhook/index.ts',
  ['_shared/telegram.ts', '_shared/wishes.ts'],
  'telegram-webhook.ts',
);
bundle(
  'birthday-telegram/index.ts',
  ['_shared/cardTheme.ts', '_shared/telegram.ts', '_shared/wishes.ts', '_shared/whoIsThis.ts', '_shared/cardMotifs.ts', '_shared/birthdayCard.ts'],
  'birthday-telegram.ts',
);
