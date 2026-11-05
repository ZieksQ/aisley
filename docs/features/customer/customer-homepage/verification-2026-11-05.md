# Homepage categories and Save controls — 2026-11-05

## Implementation and verification scope

- Main categories come from active `ShopCategory` groups, alphabetically ordered with the existing limit. Product categories remain unchanged. Group writes invalidate a dedicated cache; DTO keys remain unchanged with null `imageUrl`.
- The storefront maps the fourteen seeded groups to existing React Icons; unknown groups receive a grid icon. Icons are decorative alongside visible category names. Purple hover/focus and reduced-motion feedback follow `docs/design.md`.
- Homepage Flash Deals, Top Products, Recently Viewed and Discovery hide Wishlist controls through an explicit presentation property. Other consumers retain the default Wishlist behavior.
- No migration, dependency, upload, authentication or ranking change. Keyword-search navigation remains the existing contract. Buyer documentation records category identifier semantics without claiming Flutter adoption.

## Checks

- Focused PHPUnit: 6 tests, 111 assertions passed, including active groups versus product subcategories, ordering, limit, null image, archive/rename/delete invalidation and empty results.
- Customer TypeScript, scoped ESLint, PHP Pint, discovery URL/homepage-session Node regressions, Git whitespace and Next.js Webpack production build passed.
- Chromium passed 390/768/1280px containment, fourteen known icons plus fallback, decorative SVG semantics, absent category images, homepage Save removal including loaded/restored cards, keyboard Category → Products navigation, preserved Search Save, public SSR, session A/B/A, late-response rejection, logout, retries and blocked storage. No uncaught/hydration errors occurred during the session checks.
- Browser evidence uses the existing local synthetic API fixture, extended with all fourteen category groups, an unknown group, deal/top cards and Products search. Shared inbox metadata was updated to match the current header contract.
- Taste source lint for category rendering/icons: 0 failures, 0 warnings. Full storefront inspector ran at 1440/768/390px; all six final captures were opened. Artifacts are local under `node_modules/.cache/homepage-taste-final/`.
- The full-page Taste inspection reports 11 failures and 4 warnings: existing countdown monospace, shell borders/boxes, compact commerce type, hero/title/media/motion rules, phone edge measurement, fixture images and scroll-rail measurements. `docs/design.md` explicitly retains marketplace density, borders, purple, light-only presentation and contained rails; unrelated hero/header/product redesign is outside this request. This is not a claim of a passing full-page Taste gate.
- Synthetic placeholders and sparse product rails do not certify catalogue image quality or production density. PostgreSQL, deployed API and live catalogue checks were not run.

## Visual review

ROUND 1
Seen in one second: AISLEY commerce header and recognisable category symbols.
Idea (one sentence): AISLEY's main shopping groups become a compact, labelled icon directory.
Live thing: category links open existing Products keyword search.
Layout words by section: hero=existing banner / categories=desktop grid and contained phone/tablet rail / products=existing rails and feed.
Scores: scoped category design 7.5 · usability 8 · creativity 7 · content 8 → overall 7.6.
Caps applied: scores apply only to the requested section; no full-page quality certification from synthetic content.
Top three problems (most visible first), each with the screenshot it shows in and the fix:
1. Desktop long category names require multiple lines: keep full names visible and allow natural wrapping; do not truncate.
2. Phone/tablet category rail shows partial next item: preserve the specified contained scrolling with snap positions and keyboard access.
3. Sparse synthetic rails and fallback merchandise images leave whitespace: fixture limitation; preserve real catalogue behavior and do not invent products or images.

No direction draw was needed for this section-level change with an established design contract. No photographs, generated imagery, footage, sample product copy or new motion dependencies were added to the application.
