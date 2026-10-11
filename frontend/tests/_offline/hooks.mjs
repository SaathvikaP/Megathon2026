// Module resolution hooks for running the unit tests without node_modules:
// maps "vitest" to a node:test shim and "@/..." to ./src with TypeScript extensions.
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = new URL('../../', import.meta.url);
const shim = new URL('./vitest-shim.mjs', import.meta.url).href;
const EXTS = ['', '.ts', '.tsx', '.mjs', '.js', '/index.ts'];

function resolveFile(base) {
  for (const ext of EXTS) {
    const candidate = fileURLToPath(new URL(base + ext, root));
    if (existsSync(candidate) && !candidate.endsWith('\\') && !candidate.endsWith('/')) {
      try {
        return pathToFileURL(candidate).href;
      } catch {
        /* keep looking */
      }
    }
  }
  return null;
}

export async function resolve(specifier, context, next) {
  if (specifier === 'vitest') return { url: shim, shortCircuit: true };
  if (specifier.startsWith('@/')) {
    const url = resolveFile(`src/${specifier.slice(2)}`);
    if (url) return { url, shortCircuit: true };
  }
  return next(specifier, context);
}
