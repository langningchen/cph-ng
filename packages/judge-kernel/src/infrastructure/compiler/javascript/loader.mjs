import { readFile } from 'node:fs/promises';

let entry;
export function initialize(data) {
  entry = data;
}
export async function load(url, context, nextLoad) {
  const loaded = await nextLoad(url, context);
  // Leave CommonJS to its preloader so its complete require API is preserved.
  return url === entry.target && loaded.format === 'module'
    ? { ...loaded, source: await readFile(entry.snapshot) }
    : loaded;
}
