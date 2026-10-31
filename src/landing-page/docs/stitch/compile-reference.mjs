import { compile } from '../../../../node_modules/.pnpm/@tailwindcss+node@4.3.3/node_modules/@tailwindcss/node/dist/index.mjs';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
const root = 'src/landing-page';
const files = [`${root}/src/components/Landing.astro`, ...readdirSync(`${root}/src/components/stitch`).map(f => `${root}/src/components/stitch/${f}`)];
const candidates = files.flatMap(f => [...readFileSync(f, 'utf8').matchAll(/class="([^"]+)"/g)].flatMap(m => m[1].split(/\s+/)));
const compiler = await compile('@import "tailwindcss"; @theme { --font-sans: Geist, system-ui, sans-serif; --font-mono: Geist, system-ui, sans-serif; }', {base: process.cwd()+'/node_modules/.pnpm/tailwindcss@4.3.3/node_modules',onDependency() {}});
writeFileSync(`${root}/src/styles/stitch.generated.css`, compiler.build(candidates));
