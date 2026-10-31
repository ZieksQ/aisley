// Compile the Stitch utilities locally using the workspace's existing Tailwind tooling.
import { createRequire } from 'node:module';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(resolve(root, '../seller/package.json'));
const tailwindRequire = createRequire(require.resolve('@tailwindcss/vite'));
const { compile } = tailwindRequire('@tailwindcss/node');
const candidates = new Set();
async function scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) await scan(path);
    else if (entry.name.endsWith('.astro')) {
      const source = await readFile(path, 'utf8');
      for (const match of source.matchAll(/class="([^"]+)"/g)) {
        match[1].split(/\s+/).forEach(value => candidates.add(value));
      }
    }
  }
}
await scan(resolve(root, 'src'));
const compiler = await compile(await readFile(resolve(root, 'src/styles/stitch.source.css'), 'utf8'), {
  base: dirname(require.resolve('tailwindcss')),
  onDependency() {},
});
await writeFile(resolve(root, 'src/styles/stitch.generated.css'), compiler.build([...candidates]));
console.log(`Compiled ${candidates.size} Stitch utility candidates.`);
