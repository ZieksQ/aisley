# AISLEY Landing Page

Run `pnpm dev:landing` from root or use root `pnpm dev`. Port: 4321.

Preview build: `pnpm --dir src/landing-page build` (noindex). Production: `pnpm --dir src/landing-page build:production`. Deploy `dist/` to info.aisley.app with HTTPS and a real 404 response.

Actual Buyer, Seller catalog, and Logistics dispatch captures are included with private details omitted. Browser checks cover five viewport widths. Lighthouse and deployment acceptance remain outstanding.

The current implementation follows Stitch project `15557909308404563880`, screen `973c10bb2c70499faee3616805ef3553`. Its source exports remain in `docs/stitch/2026-10-31-refresh/`; browser captures and verification are in that directory's `implementation/`. Authentic screenshots fill the export's marked replacement slots. The first FAQ starts open.

After changing utility classes or theme tokens, run `pnpm --dir src/landing-page styles` before building. This compiles `src/styles/stitch.source.css` into the checked-in `stitch.generated.css` using existing workspace Tailwind tooling. No runtime Tailwind CDN or remote font requests are used.
