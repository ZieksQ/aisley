# Buyer marketplace design — Android and responsive web

Status (external Buyer report, not rerun here): shared marketplace presentation applied to all implemented Buyer features; installed-device accessibility acceptance remains pending. Adapted from Aisley's Customer branding and interaction contract at `docs/design.md`; the existing web guide governs the storefront, while this document governs the standalone Buyer app.

Use a light-only Material theme with brand pink `#E6007A`, accessible control/text pink `#B60060`, secondary `#4C1268`, error `#B42318`, and warning `#FF8800`. Neutral surfaces dominate; supporting typography/borders and restrained primary accents follow the brand's 60/30/10 balance. Verify foreground/background contrast and adjust text/surface use where a brand accent is insufficient. Do not rely on color alone for status, selected variants, unread or validation.

Use familiar marketplace patterns: search near discovery, Product images and price prominent, clear variant/quantity controls, Shop-grouped Cart/Checkout, explicit COD total, readable Order milestones, and separate message channels. Phone/tablet navigation uses Home/Shops/Cart/Account; desktop navigation follows [workspace](workspace.md). Bazaar/MoneyFest and unavailable workflows need no enabled destinations.

Use one app-wide typography/spacing/theme and compatible shared Flutter widgets. JavaScript `@aisley/ui`, Tailwind, React icons, Next.js layouts, SSR/SEO and dashboard sidebars are upstream implementation details; they cannot be imported into Flutter. Native layouts use logical pixels and platform semantics, not copied CSS.

Minimum interactive touch target is 48×48 logical pixels; keep icon labels/tooltips/semantics, visible focus, accessible checkboxes/radios and sufficient separation. Respect text scaling, TalkBack reading order, keyboard access in local web, reduced motion and meaningful image descriptions. Long names/references and untrusted text wrap without hiding critical actions.

Use available logical width: phone below 600 pixels with 16-pixel padding; tablet from 600–1023 with 24-pixel padding; desktop from 1024 with 32-pixel padding. Constrain forms to 560 pixels and shopping content to 1200. Desktop/laptop browsers share the same Flutter app. Enlarged text uses stacked navigation when the header cannot fit (measured utility-label width, with a scale-1.5 maximum), without reducing user text scale. Keyboard opening must keep the active field, errors and submit/composer reachable. Use scrollable forms/dialogs; do not overlay Cart/Place order actions over focused fields. Test small height and landscape as well as width.

Back/Cancel closes the current dialog or route predictably; preserve safe input during recoverable errors and confirm discarding a changed form when necessary. Confirm deletion, clear history and cancellation with the named resource/consequence. Consent confirmation starts unchecked. Use autofill and correct text-input actions, while passwords and private selections clear at their lifecycle boundary.

Every feature provides initial/loading, loaded, valid empty, unavailable, validation, permission/consent, throttled, offline/timeout, retry and success states as applicable. A failed fetch must not look like an empty list. Prevent duplicate taps and never announce a saved/placed/sent result before a committed response. An uncertain mutation remains visibly pending/recoverable according to its API rules.

Skeletons should preserve layout; asynchronous announcements should not steal focus. Offer Retry without clearing safe drafts, and focus the first relevant validation error. Carousels with automatic motion require an accessible pause control or avoid automatic rotation. Message arrival must not force scroll when reading older history; provide a clear new-message control. Map/GPS and file-picker permission denial keep manual alternatives usable.

The server owns action capabilities. Disabled or read-only state should explain the next step, including approval, consent, stock change, started Seller processing or ended delivery contact. [Verification](verification.md) records actual responsive/accessibility checks; publishing this guide does not certify any implementation.

Shopping requires verified active Customer identity and current required consent. Hide
Home/Shops/Cart/Account navigation until verification; checking and recoverable failures
show session Retry. Root sign-in has no shopping Cancel. Child auth/policy screens return
to sign-in; consent offers explicit Sign out. Normal sign-in opens Home, while validated
read links survive login/consent. A saved mutation never automatically resumes.

Shell pages have one scaffold/safe-area/keyboard owner; hide bottom navigation while the
keyboard occupies the viewport. Forms, filters, pagination, errors, message/support composers
and dialogs scroll within actual available height. Resizing retains safe input/focus/scroll
without repeating requests. Cards use natural heights and 1–6 columns from minimum width
160 multiplied by text scale clamped to 1–2; full prices, ratings and actions wrap. Preview
titles may truncate. Rails size themselves from their content. Product galleries follow
available width with bounded height; two-column detail requires content width at least 840
and text scale no greater than 1.5, otherwise stack. Preserve gallery page and variant state.


Use 8-pixel control/card corners, subtle neutral borders, minimal shadows and the existing Material font. Reserve pink for prices, selection and primary actions; purple supports secondary emphasis. Avoid promotional content unless the server supplies it. Familiar hierarchy is informed by [Jakob’s Law](https://www.nngroup.com/videos/jakobs-law-internet-ux/), [Shopee](https://shopee.ph/) and [Lazada](https://www.lazada.com.ph/); these references confer no extra API capabilities.

Phone/tablet shell navigation retains Home, Shops, Cart and Account. The desktop header provides AISLEY/Home, prominent explicitly submitted search, Shops, Orders, Cart and Account; its utility row names Notifications, Shop messages, Logistics messages and Courier messages separately. Protected detail routes share the header; checkout keeps a compact Back header. Checking/authentication/approval/consent routes expose no shopping navigation. The compact mobile search presentation preserves a desktop draft/focus across resizing; Home uses that search instead of a duplicate field.

Home prioritizes supported categories, campaigns/deals, horizontal collections and recommendations. Search uses Products/Shops tabs, the submitted query and existing pagination; Shop filters retain their documented scope. Product cards show square images, two-line names, Shop labels, PHP prices and supplied rating/sold/discount metadata. Gallery, price, variant and quantity precede secondary Product information. Purchase controls occupy a reserved scrollable mobile action area; wide layouts put gallery and purchase information side by side. Do not cover fields or shrink touch targets to fit short landscape/keyboard viewports.

Cart uses image-led selectable rows grouped by optional verified Product-detail Shop metadata. Keep selection checkboxes at the left and put “View product”, “Edit cart item” and “Remove cart item” text buttons at the right. On narrow or enlarged layouts, actions move below item details, align right and wrap. Keep each target at least 48 pixels. Deduplicate Product IDs and run at most four lookups concurrently. Failures leave usable ungrouped rows; metadata never determines stock, prices or eligibility. Wishlist and Recently Viewed use matching right-side “View product” and removal text buttons, with confirmation and visible pending feedback. Checkout displays addresses, Shop-grouped authoritative quote items, eligible voucher choices, COD and totals on one page. “Review order” explicitly requests the quote; placement still requires a current quote and confirmation. The summary moves to a desktop column or reserved mobile area without discarding state. Expiry and uncertain exact-request recovery remain visible.

Account groups shopping, details, communication/help and settings. Desktop account forms add contextual links without changing draft ownership. Order cards use server status tabs and permitted actions; tracking displays chronological numbered updates. Q&A, reviews/photos, notifications and support use consistent readable sections and existing composers/upload feedback. Desktop message routes retain a separate channel inbox beside the thread; mobile keeps list-to-thread navigation. Hidden inboxes pause foreground polling; first desktop exposure may load that channel once. Drafts, displayed-read markers, read-only explanations and deliberate retries keep their original controllers.

Verify 320, 390, 600, 800, 1024 and 1440-pixel widths, landscape, keyboard insets and doubled text. Check 48-pixel targets, labels, contrast, visible keyboard focus, Enter/search, Back/history and reachable purchase/composer actions. Mounted resizing must preserve inputs, focus, gallery, selection and scroll without duplicate requests. Synthetic screenshots and local evidence do not close controlled live, installed Android/TalkBack, permission or signing gates.

Category cards share width and measured height, including a uniform 48px image/icon slot.
Cart entries retain full-width neutral dividers below all actions. Wishlist and Recently Viewed
use grey outlined cards around each Product and its actions. Checkout quote lines use matching
cards inside Shop groups; Shop totals and voucher controls stay outside the item cards.

Mouse dragging is supported alongside existing scroll devices. Preserve text selection and test Firefox with touch simulation both enabled and disabled; those browser checks remain unverified. Temporary background identity/consent revalidation errors retain the mounted route and safe page state with retry feedback. Identity loss clears private state; renewed required consent gates shopping. Profile embeds independently busy photo controls and legacy `/account/photo` links open Profile.
