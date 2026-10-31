// Run from the repository root. Reuse Astro's installed image tooling; no new dependency.
import { createRequire } from 'node:module';
import { realpathSync } from 'node:fs';
const require = createRequire(realpathSync(new URL('../node_modules/astro/package.json', import.meta.url)));
const sharp = require('sharp');
for (const name of ['buyer', 'seller', 'logistics']) {
  const source = `src/landing-page/public/screens/${name}.webp`;
  const widths = name === 'buyer' ? [480, 960] : [480];
  for (const width of widths) {
    await sharp(source).resize({ width, withoutEnlargement: true }).webp({ quality: 82 })
      .toFile(`src/landing-page/public/screens/${name}-${width}.webp`);
  }
}
