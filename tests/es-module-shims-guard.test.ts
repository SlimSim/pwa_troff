import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..');

function findHtmlFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findHtmlFiles(fullPath));
    } else if (entry.name.endsWith('.html')) {
      results.push(fullPath);
    }
  }
  return results;
}

describe('es-module-shims must not be loaded async', () => {
  const htmlFiles = findHtmlFiles(ROOT);

  for (const filePath of htmlFiles) {
    const relativePath = filePath.replace(ROOT + '\\', '').replace(ROOT + '/', '');
    const content = readFileSync(filePath, 'utf-8');

    it(`${relativePath} must not load es-module-shims with async`, () => {
      expect(content).not.toMatch(/<script[^>]*\basync\b[^>]*es-module-shims/);
    });
  }
});
