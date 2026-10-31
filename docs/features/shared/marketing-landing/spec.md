# AISLEY marketing landing page

Single static Astro page at https://info.aisley.app, with buyer/seller/logistics section anchors, exact portal URLs and platform-neutral GitHub mobile release links. Early access only; no geographic or performance promises. Public content needs no authentication. INDEXABLE=true enables production indexing. Preview builds default to noindex. Native FAQ disclosures and navigation work without JavaScript. Actual storefront, Seller catalog, and Logistics dispatch screenshots are included, with private details omitted.

Preview images enlarge in native dialogs with Escape, Close, and focus restoration. Direct image links work without JavaScript. Role features sit alongside descriptive copy in compact sections.

## Visual review — 2026-10-31

ROUND 2
Seen in one second: AISLEY offers shopping, selling and delivery portal paths.
Idea (one sentence): The connected marketplace becomes a concise sequence of participant workspaces.
Live thing: Enlarge authentic application previews with keyboard-accessible native dialogs.
Layout words by section: hero=compact split / buyers=text+evidence / sellers=reversed split / logistics=text+evidence / workflow=ordered strip / apps=paired downloads / FAQ=disclosures / footer=compact links.
Scores (subjective): design 7.5 · usability 8 · creativity 6.5 · content 8 → overall 7.5.
Caps applied: no new footage or fabricated evidence; existing screenshot detail remains limited by privacy redactions.
Top three problems and fixes:
1. Desktop hero had excess ground above/below its copy: shortened heading, reduced padding and top-aligned screenshot/copy.
2. Audience features stacked beneath screenshots caused empty opposite columns: moved features beside role descriptions and alternated Seller composition.
3. Small screenshot details were unreadable: enlarged media and added full-size dialogs with direct-link fallbacks.

Desktop height reduced from 5666px to approximately 4020px (29%). The Taste inspector still flags project-permitted thin boundaries, outlined screenshots, restrained typography/motion and absence of footage. These are documented design-contract/user-density tradeoffs, not a claim of zero inspector failures. Caption text was subsequently raised to 14px. Existing local screenshots/font/brand were reused; no found imagery, sample testimonials, dependency additions or motion scenes were introduced.

## Left-to-right composition — 2026-10-31

The header keeps the logo left and shopping action right, with section navigation between them on desktop and on a second row below 1024px. The desktop hero and Buyer/Logistics sections use a 5:7 copy/media split; Seller reverses this to 7:5. Below 1024px, copy precedes media in a single column. Hero shopping is the filled primary action, while Seller/Logistics remain outlined links. All five external destinations remain available. Screenshots preserve their full aspect ratio, with existing full-size previews. Downloads use an introduction beside two app columns on desktop; the footer groups brand left and destinations right. Narrow layouts keep text left-aligned with 16px gutters.

Visual review: existing approved split composition retained rather than adopting the Taste draw's sticky split-stage direction; no new assets, footage, dependencies or scroll effects. Actual deterministic selection seed 20261031 retained Geist/editorial split as brief constraints; decorative arsenal and motion selections omitted for content, compactness and dependency constraints. Subject-specific idea: show the connected marketplace beside the workspace each participant uses. Live interaction remains enlarged authentic previews. Subjective scores: design 8, usability 8, creativity 6.5, content 8; overall 7.6. Remaining limitation: redacted Seller/Logistics screenshots have limited detail.

Chromium visual review at 1440/768/390px: desktop hero media increased from 16% to 27% of the first screen; measured desktop height fell from 4.4 to 4.1 screens. Hero headings wrap to at most two lines. The inspector retains four style flags (thin boundaries, outlined media, restrained focal scale, no scroll motion) and two warnings (no footage, mobile introduction below its 18px heuristic); these remain deliberate project-design/compactness choices, not a zero-failure inspector claim. Existing copy explains the marketplace directly below the headline.

## Stitch implementation — 2026-10-31

The approved reference is Stitch screen `68e3f7718218424ca7eb504f7de36487`. Its 7:5 hero, alternating role sections, capability cards, workflow cards, bordered download panel, FAQ cards, portal jump grid and four-column footer supersede the previous compact composition. Preserve canonical system copy, authentic screenshots and all existing destinations. Local CSS compiled from the existing workspace Tailwind tooling avoids runtime CDN dependencies. Native expandable FAQ cards start open to match the reference. External icon-font glyphs use local outline SVGs. Design contract and functional accessibility requirements continue to apply.

## Conversion and accessibility refinement — 2026-10-31

Retain the existing Stitch section order and split layout. The hero now leads with “Shop independent sellers.” and one supporting sentence. “Start shopping” is the sole filled hero action; Seller and Logistics remain text links. Repeat the shopping action after Buyer, workflow, FAQ, and in the portal grid. Preserve all five external destinations, early-access/coverage qualifications, approval rules, native FAQ, and full-size screenshot fallbacks.

Navigation remains visible on phones, with at least 44×44px targets. Running feature copy uses 16px, supporting labels use at least 14px, and colors use shared page variables with the existing generated type/spacing scales. Responsive WebP variants reduce inline screenshot transfers while dialogs retain original images. Font preload and social image dimensions/alternative text supplement existing SEO. See the landing page's [quality review](../../../../src/landing-page/docs/quality-review.md) for validation and remaining limits.
