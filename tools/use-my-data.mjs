// Makes YOUR exported family the website's built-in data.
// Usage:  node tools/use-my-data.mjs [path-to-export.json]
// Without an argument it picks the newest family-tree-*.json in Downloads.
import { readFileSync, writeFileSync, readdirSync, statSync, copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, 'src', 'data', 'defaultFamily.json');

let source = process.argv[2];
if (!source) {
  const downloads = join(homedir(), 'Downloads');
  const candidates = readdirSync(downloads)
    .filter((f) => /^family-tree-.*\.json$/i.test(f))
    .map((f) => ({ f, time: statSync(join(downloads, f)).mtimeMs }))
    .sort((a, b) => b.time - a.time);
  if (candidates.length === 0) {
    console.error(
      '[ERROR] No family-tree-*.json file found in your Downloads folder.\n' +
        'Open the website -> Family Tree -> Export, then run this again.\n' +
        'You can also drag your export file onto use-my-data.bat.',
    );
    process.exit(1);
  }
  source = join(downloads, candidates[0].f);
}

let data;
try {
  // Strip a UTF-8 BOM in case the file was re-saved in Notepad.
  data = JSON.parse(readFileSync(source, 'utf8').replace(/^﻿/, ''));
} catch {
  console.error(`[ERROR] "${source}" is not a readable JSON file.`);
  process.exit(1);
}
const people = Array.isArray(data) ? data : data.people;
if (!Array.isArray(people) || people.length === 0) {
  console.error('[ERROR] That file has no "people" list. Export it from the website (Family Tree -> Export).');
  process.exit(1);
}
const bad = people.filter(
  (p) => !p || typeof p.id !== 'string' || !p.id || typeof p.isDeceased !== 'boolean',
);
if (bad.length > 0) {
  console.error(`[ERROR] ${bad.length} entries in the file look broken - re-export from the website.`);
  process.exit(1);
}

// Keep a dated backup of what was published before.
const backupDir = join(root, 'password', 'data-backups');
if (existsSync(target)) {
  mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  copyFileSync(target, join(backupDir, `defaultFamily-${stamp}.json`));
}

writeFileSync(
  target,
  JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), people }, null, 2),
);

const size = statSync(target).size;
console.log(`[OK] Published ${people.length} people from:\n     ${source}`);
console.log(`     The website's built-in family data is now YOUR family.`);
if (size > 3 * 1024 * 1024) {
  console.log(
    `[NOTE] The data is ${(size / 1024 / 1024).toFixed(1)} MB (photos make it big). The site will still work but load slower.`,
  );
}
console.log('     A backup of the previous data was saved in password\\data-backups.');
