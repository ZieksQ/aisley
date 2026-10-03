# Buyer native mobile design

Status: proposed shared Flutter design; every screen pending. Adapted from Aisley's Customer branding and interaction contract at `docs/design.md`; the existing web guide governs the storefront, while this document governs the standalone Buyer app.

Use a light-only Material theme with primary `#E6007A`, secondary `#4C1268`, error `#FF3B30`, and warning `#FF8800`. Neutral surfaces dominate; supporting typography/borders and restrained primary accents follow the brand's 60/30/10 balance. Verify foreground/background contrast and adjust text/surface use where a brand accent is insufficient. Do not rely on color alone for status, selected variants, unread or validation.

Use familiar marketplace patterns: search near discovery, Product images and price prominent, clear variant/quantity controls, Shop-grouped Cart/Checkout, explicit COD total, readable Order milestones, and separate message channels. Native navigation is the Home/Shops/Cart/Account proposal in [workspace](workspace.md). Bazaar/MoneyFest and unavailable workflows need no enabled destinations.

Use one app-wide typography/spacing/theme and compatible shared Flutter widgets. JavaScript `@aisley/ui`, Tailwind, React icons, Next.js layouts, SSR/SEO and dashboard sidebars are upstream implementation details; they cannot be imported into Flutter. Native layouts use logical pixels and platform semantics, not copied CSS.

Minimum interactive touch target is 48×48 logical pixels; keep icon labels/tooltips/semantics, visible focus, accessible checkboxes/radios and sufficient separation. Respect text scaling, TalkBack reading order, keyboard access in local web, reduced motion and meaningful image descriptions. Long names/references and untrusted text wrap without hiding critical actions.

Compose the narrow phone layout first, contain horizontal gallery/rails, respect safe areas and bottom navigation, then adapt to wider browser/tablet views. Keyboard opening must keep the active field, errors and submit/composer reachable. Use scrollable forms/dialogs; do not overlay Cart/Place order actions over focused fields. Test small height and landscape as well as width.

Back/Cancel closes the current dialog or route predictably; preserve safe input during recoverable errors and confirm discarding a changed form when necessary. Confirm deletion, clear history and cancellation with the named resource/consequence. Consent confirmation starts unchecked. Use autofill and correct text-input actions, while passwords and private selections clear at their lifecycle boundary.

Every feature provides initial/loading, loaded, valid empty, unavailable, validation, permission/consent, throttled, offline/timeout, retry and success states as applicable. A failed fetch must not look like an empty list. Prevent duplicate taps and never announce a saved/placed/sent result before a committed response. An uncertain mutation remains visibly pending/recoverable according to its API rules.

Skeletons should preserve layout; asynchronous announcements should not steal focus. Offer Retry without clearing safe drafts, and focus the first relevant validation error. Carousels with automatic motion require an accessible pause control or avoid automatic rotation. Message arrival must not force scroll when reading older history; provide a clear new-message control. Map/GPS and file-picker permission denial keep manual alternatives usable.

The server owns action capabilities. Disabled or read-only state should explain the next step, including approval, consent, stock change, started Seller processing or ended delivery contact. [Verification](verification.md) records actual responsive/accessibility checks; publishing this guide does not certify any implementation.
