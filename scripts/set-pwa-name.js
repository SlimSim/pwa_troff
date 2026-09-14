#!/usr/bin/env node

/**
 * Usage: node scripts/set-pwa-name.js [suffix]
 *
 * Modifies dist/ to append a suffix to PWA names.
 * Example: node scripts/set-pwa-name.js beta
 *   manifest.json:  "short_name": "Troff"  →  "short_name": "Troff Beta"
 *   index.html:     <title>Troff - Training with music</title>  →  <title>Troff Beta - Training with music</title>
 *   v2.html:        <title>Troff - Training with music</title>  →  <title>Troff Beta - Training with music</title>
 */

const fs = require('fs');
const path = require('path');

const suffix = process.argv[2];
if (!suffix) {
  console.error('Usage: node scripts/set-pwa-name.js <suffix>');
  process.exit(1);
}

const distDir = path.resolve(__dirname, '..', 'dist');

// Update manifest.json
const manifestPath = path.join(distDir, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

manifest.short_name = `${manifest.short_name} ${suffix}`;
manifest.name = `${manifest.name.replace(/^Troff/, `Troff ${suffix}`)}`;

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(`manifest.json: short_name="${manifest.short_name}", name="${manifest.name}"`);

// Update HTML files
const htmlFiles = ['index.html', 'v2.html'];
for (const file of htmlFiles) {
  const filePath = path.join(distDir, file);
  if (!fs.existsSync(filePath)) continue;

  let html = fs.readFileSync(filePath, 'utf-8');
  html = html.replace(/<title>Troff(.*?)<\/title>/, `<title>Troff ${suffix}$1</title>`);
  fs.writeFileSync(filePath, html);

  const match = html.match(/<title>(.*?)<\/title>/);
  console.log(`${file}: <title>${match[1]}</title>`);
}