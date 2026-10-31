# AISLEY Landing Page — Stitch design context

Date: 2026-10-31. Scope: design reference only. No frontend implementation.

[Open Stitch project](https://stitch.withgoogle.com/projects/15557909308404563880)

## References and IDs

| Item | Reference |
| --- | --- |
| Project title | AISLEY Landing Page |
| Project ID | `15557909308404563880` |
| Screen title | AISLEY Landing — existing screen refinement |
| Screen ID | `973c10bb2c70499faee3616805ef3553` |
| Screen resource | `projects/15557909308404563880/screens/973c10bb2c70499faee3616805ef3553` |
| Generation session | `2857815295347839605` |
| Screenshot file ID | `504f972cc170494bb4dff68c13c13ed6` |
| HTML file ID | `2cbecc9d38e04354bea65cd09797f30a` |
| Screenshot dimensions | 2560 × 11250, desktop |

The historical project `8631170844035430395` returned “Requested entity was not found.” Owned/shared discovery did not expose an accessible project with the requested title, so a new private project was created. Previously deleted context files were left deleted; this session uses a new subdirectory.

## Saved artifacts

- [Stitch screenshot](stitch-desktop.png): downloaded image bytes through Stitch MCP `download_file`.
- [Screen metadata](screen.json) and [project metadata](project.json): resource names, remote download references, theme and canvas instances.
- [Exact generation prompt](prompt.txt) and [generation response](generation.json).
- [Raw HTML design export](reference.html): preserved unmodified as reference material; it is not imported into Astro and is not production code.
- `current-ui/`: read-only captures and inspector output from the existing static Astro build when available. These are baseline inspection artifacts, not newly implemented designs.

Use Stitch MCP `download_file` with the file resource names in `screen.json` to retrieve exports again. The remote download URLs may require authentication; local PNG retrieval succeeded.

## Existing UI inspected

Read root and landing AGENTS.md, docs/PROGRESS.md, docs/design.md, docs/architecture.md, docs/features/shared/marketing-landing/spec.md, landing README/package, composition and all eight section components, preview behavior and page CSS. The marketing spec is the matching feature contract; no role workflow implementation is proposed.

Existing stack: Astro static page, generated local stylesheet plus global CSS, local Geist font, authentic redacted WebP screenshots. Header → hero → Buyers → Sellers → Logistics → workflow → apps → FAQ → portals → footer. Hero and role sections use 7:5 splits, Seller reverses its media. Phone content stacks with visible navigation. Current hero is “Shop independent sellers.” with one filled shopping action, business links and early-access coverage note.

Preserved theme: light canvas #F7F5F7, white surface, ink #231429, muted #594C5E, purple #4C1268, purple tint #F1EAF4, Logistics blue #2563EB, 8px corners, 4px spacing rhythm, 1240px maximum container, 16px phone gutters. Existing links are the Buyer/Seller/Logistics portals and Buyer/Rider GitHub Releases.

## Design direction and review

Idea: show the connected marketplace beside each participant's actual workspace. Keep existing composition, strengthen the shopping hierarchy and make capabilities calmer and previews easier to read. The design-taste skill informed the review; the canonical design contract and existing feature composition take priority over conflicting palette, borders, density or motion prescriptions. No random redesign, dependency adoption or frontend changes were performed.

The full downloaded screenshot was visually inspected. It retains the short left-aligned hero, alternating roles, purple/blue distinction, workflow, downloads, FAQ, workspace links and footer. Exact portal/release URLs and all five FAQ disclosures are present in the HTML. This is an exploratory reference, not an approved or accessibility-certified replacement.

Required corrections before any future implementation:

1. Although screenshot placeholders are labelled, Stitch also invented miniature UI data, order/waybill IDs, merchant/provider names and operational statuses inside them. Replace each entire panel interior with the existing authentic redacted asset; do not reuse this invented evidence. No local screenshots were uploaded to Stitch.
2. Stitch added small uppercase badges, decorative participant labels, 12px text and monospace channel labels. Remove decorative labels and keep supporting copy at least 14px; preserve meaningful approval text without decorative hero badges.
3. Generated copy elaborates on verified shops, universal Philippine COD options, automatic/process claims and specific milestone examples. Restore canonical source wording, especially available checkout options, early access, recorded shipment milestones and approval qualifications. Do not infer external Flutter completion from generated app descriptions.
4. The exported header uses a fixed-height unwrapped row; phone navigation and action reachability need a separate responsive pass. Only a desktop Stitch screen was generated.
5. Most generated FAQ answers start collapsed; the current feature spec starts all disclosures open. Preserve existing defaults unless a later approved change updates the contract.
6. “Enlarge preview” buttons are presentational references, not verified native dialogs. Preserve the existing working preview component, direct-image fallback, Escape/Close and focus restoration.
7. Export uses Tailwind CDN and Google Fonts. It must remain a reference artifact. Any later authorized implementation must use the existing local CSS/font delivery and stack.

Subjective screenshot-only review: design 7/10, content fidelity 6/10. No interaction or accessibility score assigned to the Stitch output. Strongest next improvements: replace invented panels with authentic previews, remove decorative labels and restore exact copy, then resolve mobile navigation and preview behavior.

## Tool response and suggested follow-ups

Stitch reported a complete desktop design using the requested palette, Geist, connected role sections, mobile release links, FAQ and workspace selector. Those are generator claims; the corrections above record actual limitations found in the screenshot and HTML.

Stitch suggestions: “Explore responsive mobile layout adaptations (390px)”; “Refine screenshot preview modal dialog styling”; “Export production-ready Astro component template”. None was accepted or generated in this pass. Production code export/implementation is outside the requested scope.

## Verification boundaries

Downloaded PNG, project and screen metadata, raw reference HTML, exact prompt and generation response through MCP. No application build was run and no frontend source/assets/dependencies were edited. The Astro background server failed to become ready; baseline browser inspection uses the existing static dist via a temporary local server. Baseline build freshness is not certified. Browser inspection outcomes are recorded separately; no new frontend acceptance or Flutter completion is claimed.

The baseline inspector completed at 1440/768/390px: 0 FAIL, 1 WARN (no footage). All nine fold/page screenshot sheets were opened and reviewed. Footage is unnecessary here because authentic app captures supply the evidence. These results apply only to the pre-existing static build. It differs materially from checked-in source: a roughly 94px desktop hero and editorial sections instead of the source's roughly 56px hero and card composition; five nav links rather than six, and collapsed FAQs. The generation prompt follows the inspected source/spec, not this divergent build. Rebuild freshness must be resolved before a later implementation comparison.

Baseline screenshot critique: shopping action and headline remain clear at all captured widths; authentic screenshot detail becomes small on phones; the large desktop editorial hero differs from the source contract. No baseline fixes were made. The generated design is therefore compared with source intent rather than claimed as a visual improvement over the static build.
