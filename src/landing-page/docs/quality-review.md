# Landing page quality review — 2026-10-31

## Audit and intent

The Astro page already had local Geist, WebP previews with dimensions/lazy loading, canonical/Open Graph metadata, preview-safe indexing, native FAQ, and image dialogs. The five priorities were an unspecific hero, competing hero actions/inconsistent shopping labels, tiny technical supporting copy, missing phone navigation/small brand target/skipped footer headings, and repeated literal colors/oversized inline screenshot delivery.

Product and audience inferred from the existing feature spec: AISLEY is an early-access Philippine marketplace for buyers, independent sellers and delivery teams. Primary conversion: open the existing buyer storefront with “Start shopping.” No new coverage, performance, price, testimonial or customer claims were introduced.

## Design plan and review

Role: public marketplace marketing. Theme: light. Palette: existing purple, white and plum neutrals, with Logistics blue. Type: existing local Geist; heading measure up to 620px, 36–56px responsive hero size, target two lines. Layout: preserve the approved Stitch split hero, alternating role previews, workflow, downloads, FAQ and portal grid. Navigation → offer → role benefits and authentic previews → order journey → repeated shopping actions. No bento or motion architecture changes.

Retained the previous specification's composition and selection context; no new random draw, font selection, generated imagery, dependencies or motion scenes. Idea: AISLEY's connected marketplace is explained alongside its real participant workspaces. Live interaction: enlarge the authentic screenshots, with direct image fallbacks. This is a scoped refinement, not a replacement art direction.

Visual review of full-page desktop/tablet/phone captures: clear primary action, consistent frames, preserved media proportions, and readable supporting copy. Subjective final scores: design 8/10, usability 8.5/10, creativity 6.5/10, content 8/10. Remaining visual limit: privacy-redacted operational screenshots contain little visible detail.

Taste source lint and final Chromium inspector were run. The inspector retains seven style findings for section labels, subtle shadows, borders, outlined cards, repeated capability cards, restrained hero scale and absence of scroll motion. These preserve the existing design contract/reference and limited scope; this is not a zero-finding skill certification. Its phone title heuristic used a short viewport; separate 360×800 checks confirm the supporting sentence and CTA above the fold. The inspector's static-file “before” run had unresolved absolute asset URLs and is not a valid visual baseline. Production HTTP captures are the visual evidence used for review.

## Verification

- Preview and production static Astro builds pass. There are no package lint or test scripts.
- Chromium at 360, 768, 1280 and 1440px: no horizontal overflow, visible navigation, every rendered control at least 44×44px, shopping CTA above an 800px fold, one H1, no skipped heading levels, and loaded/reserved screenshot geometry.
- Real Enter/Escape events: preview opens, closes and restores focus; native FAQ toggles. Reduced motion disables smooth scrolling. All five exact external destinations are preserved.
- Production metadata, canonical and JSON-LD present; 404 remains noindex. Preview remains noindex by default.
- Inline buyer image: 480px variant about 17KB, versus original 75KB; tablet selects 960px, desktop/phone select 480px at DPR 1. Original previews remain available. CSS utilities shrink from 22,552 to 18,465 bytes before compression.
- Keyboard skip-link focus, 640px reflow and no-JavaScript image/FAQ fallbacks pass. Checked text pairs range from 4.75:1 to 17.45:1, meeting AA contrast.
- Reproduce assets from repo root: `node src/landing-page/docs/optimize-previews.mjs`. It reuses Astro's existing Sharp dependency. Rebuild utilities using `node src/landing-page/docs/stitch/compile-reference.mjs`.

No new content is required to use the page. Optional future evidence: approved testimonials, verified commercial terms and clearer privacy-safe app screenshots. Add these only when supplied and verified. Lighthouse, assistive-technology testing and deployed-domain/social-crawler acceptance remain open; local checks do not certify every WCAG criterion or real-user performance.
