---
feature: global-ban
title: Admin Global Ban / Blocklist Management
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
role: Admin
scope: Admin Web Application
---

# Admin Global Ban / Blocklist Management

## WHAT

- **Purpose:** Maintain and enforce a centralized security blocklist for known malicious or fraudulent users, IP addresses, and payment methods.
- **Primary actor:** Authenticated `ADMIN`.
- **Source-defined targets:**
  - banned users
  - fraudulent IP addresses
  - flagged payment methods
- **Source-defined behavior:**
  - Admin can add/manage blocklist entries.
  - Matching targets are blocked from applicable access or transactions.
  - Checks must be efficient because IP/user checks may run on frequent request paths.
- **Architecture:**
  - Next.js/React owns list/detail/forms, filters, confirmations, and result presentation.
  - Laravel owns validation, authorization, normalization, persistence, enforcement, caching, and audit records.
  - Laravel/database state is authoritative.
- **Recommended enforcement split:**

```text
request
→ resolve trustworthy client IP
→ IP block check

authenticated request
→ resolve account
→ user block check

checkout/payment
→ obtain safe provider payment identifier/fingerprint
→ payment-method block check
```

- Payment-method blocking belongs in payment/checkout logic, not generic HTTP middleware.
- **Feature boundaries:**
  - Manage User Accounts owns ordinary account suspension/deactivation.
  - Global Ban owns security block entries and cross-system enforcement.
  - Admin Authentication respects applicable block middleware.
  - System Audit Logs records blocklist mutations.
- Whether a user ban changes normal account status or applies to Admin accounts is open.
- **Recommended route:** `/security/blocklist`.
- **Non-goals:** automatic fraud scoring, ML fraud detection, device fingerprinting, CAPTCHA, automatic permanent bans from one heuristic, raw card storage, IP geolocation, VPN detection.

## MUST

### Access control

- Require authenticated `ADMIN` and Global Ban/Blocklist permission where custom permissions exist.
- Laravel authorization is authoritative; direct API calls cannot bypass it.
- Use project-standard `401`, `403`, `404`, `422`, and `409` responses.

### Block types

- MVP supports:

```text
USER
IP
PAYMENT_METHOD
```

- Each entry has exactly one type.
- Reject unknown client-defined types.
- Type determines validation and enforcement location.

### Block entry

- Minimum fields:
  - server-generated ID
  - type
  - normalized target reference/value
  - active/revoked state
  - reason
  - creating Admin ID
  - created timestamp
- Recommended optional fields:
  - `expires_at`
  - `revoked_at`
  - `revoked_by_admin_id`
  - internal notes
  - complaint/compliance/security-event reference
- Expired/revoked entries must not enforce.
- Prefer revocation over hard deletion so security history remains available.
- Exact reason taxonomy and default expiration are open.

### User bans

- `USER` blocks reference an existing shared AISLEY user/account ID.
- Do not ban by email alone; AISLEY permits role-aware accounts sharing an email.
- Enforce after authenticated identity is known.
- Do not expose internal fraud notes to blocked users.
- Broad middleware must not accidentally block required recovery/support flows.
- Decide separately whether blocked users may:
  - log out
  - contact support/appeal
  - view historical orders
  - receive refunds
  - finish already-running fulfillment
- Whether a user block also changes account status is open.

### IP blocks

- Accept valid IPv4 and IPv6.
- Normalize before storage/comparison.
- Exact-address matching is sufficient for MVP.
- CIDR/range blocking is optional/future.
- Resolve client IP only through correctly configured trusted proxies.
- Never trust arbitrary forwarded-IP headers directly.
- Treat IP as a security signal, not proof of identity.
- Admin UI must warn that shared/NAT/mobile-network addresses can affect unrelated users.
- IP retention/privacy policy is open.

### IP enforcement

- Apply checks early on configured application routes.
- Explicitly define exemptions for routes such as:
  - health checks
  - internal callbacks/webhooks
  - static/public assets
  - Admin recovery/access if Admin IP blocks are excluded
- Do not assume literally every route needs block middleware.
- Failure-open vs failure-closed behavior during cache/database outage is an Open Question.

### Payment-method blocks

- Store only safe identifiers supplied/derived from the configured payment provider:
  - provider name
  - provider payment-method reference where appropriate
  - provider fingerprint where a stable fraud-matching fingerprint exists
- Do not store raw PAN/card number solely for blocking.
- Never store CVV/CVC, PIN/PIN block, or full track data after authorization.
- Never put raw payment secrets in Admin forms, logs, URLs, block records, or audit records.
- Check payment blocks inside checkout/payment flow when the safe identifier is available.
- A blocked method must stop the affected transaction before prohibited processing proceeds.
- Exact authorization/capture ordering depends on the chosen gateway.
- Do not assume wallet/token fingerprints map exactly to the underlying physical card.

### Create block

Conceptual endpoint:

```http
POST /api/admin/blocklist
```

Laravel must:

1. authenticate/authorize Admin
2. validate type and type-specific target
3. normalize/resolve target
4. validate reason/expiration
5. reject conflicting active duplicate
6. persist block
7. write required audit record
8. refresh/invalidate enforcement cache after commit

- High-impact block creation requires clear confirmation.
- Duplicate active blocks must not be silently created.

### Revoke block

Conceptual endpoint:

```http
POST /api/admin/blocklist/{entry}/revoke
```

- Require authorization.
- Mark inactive/revoked rather than deleting.
- Preserve actor, timestamp, and history.
- Refresh/invalidate affected cache after commit.
- Unblocking does not automatically reverse unrelated suspension/compliance state.

### Expiration

- Temporary blocks may use `expires_at`.
- Null expiration may represent indefinite.
- Backend determines effective state.
- Expired entries remain visible historically.
- Cache cleanup must not delete persistent history.

### List/search

- Paginate blocklist entries.
- Recommended filters:
  - type
  - active/revoked/expired
  - created date
- Search only safe identifiers:
  - account ID / approved display identity
  - normalized IP
  - safe payment fingerprint/reference
- Allow-list filters/sorts.
- Never expose raw sensitive payment data.

### Enforcement service

- Centralize matching in a reusable Laravel service rather than duplicating queries.

```text
isUserBlocked(userId)
isIpBlocked(ip)
isPaymentMethodBlocked(provider, reference)
```

- Auth, request middleware, and checkout must use the same normalization/matching rules.

### Performance

- Add indexes for active lookup by type/target.
- Never full-scan the blocklist per request.
- Cache frequent checks when justified.
- Database is authoritative; cache is only an optimization.
- Create/revoke/expiration must invalidate affected keys promptly.
- Do not use process-local memory as the only cache in multi-instance deployment.
- Redis is appropriate if already configured, but is not required by this spec.

### Layered abuse controls

- Global Ban does not replace rate limiting.
- Continue rate limits on abuse-prone endpoints.
- Do not automatically create permanent bans from a single rate-limit or IP signal.
- Any future automatic blocking requires separate thresholds, expiry, review, and false-positive policy.

### Audit

- Every create/revoke/update is security-sensitive and auditable.
- Safe audit data:
  - Admin ID
  - action
  - block entry ID
  - target type
  - safe normalized target reference
  - reason/reason code
  - timestamp
- Never audit raw payment secrets.
- High-volume middleware decisions may use separate security logs instead of one immutable Admin Audit row per request.

### Frontend

- Required states:
  - list loading/empty/loaded/error/forbidden
  - create validation/duplicate/submitting/success/failure
  - revoke confirmation/submitting/success/failure
- Type-specific forms must clearly show target, reason, and expiration/indefinite status.
- Do not optimistically mark a block active before Laravel confirms persistence.
- Refresh list/detail state after create/revoke.

### Accessibility

- Forms/dialogs require labels and keyboard support.
- Status cannot rely on color alone.
- Validation errors must map to fields.
- Confirmation dialogs must manage focus accessibly.

### Acceptance criteria

- [ ] Guest and non-Admin access is rejected.
- [ ] Custom Admin permission is enforced server-side.
- [ ] `USER`, `IP`, and `PAYMENT_METHOD` are supported.
- [ ] Unknown block types are rejected.
- [ ] User block references a real account ID.
- [ ] Same-email different-role accounts are not accidentally banned together.
- [ ] IPv4/IPv6 are validated and normalized.
- [ ] Client IP resolution follows trusted-proxy configuration.
- [ ] Payment block stores only safe provider identifiers/fingerprints.
- [ ] CVV/PIN/full-track data is never stored.
- [ ] Duplicate active blocks are prevented.
- [ ] Create/revoke actions are audited.
- [ ] Revocation preserves history.
- [ ] Expired/revoked entries do not enforce.
- [ ] User block is enforced after authentication.
- [ ] IP block is enforced on configured routes.
- [ ] Payment block prevents affected payment transaction.
- [ ] Block checks use indexed/cached lookup, not full scans.
- [ ] Cache is refreshed promptly after mutation.
- [ ] List is paginated/filterable.
- [ ] Restricted payment/security fields are absent from DTOs.
- [ ] Global Ban and ordinary account status remain distinct unless explicitly integrated.
- [ ] Required recovery/support exemptions follow the chosen policy.

## HOW

### Project findings

- `Admin.md` defines a centralized blocklist for fraudulent IPs, flagged payment methods, and banned users, with proactive access/transaction blocking and high-performance checks. fileciteturn7file0
- Admin Authentication already identifies Global Ban as shared middleware integration and leaves Admin/IP-ban applicability open. fileciteturn7file2
- `README.md` requires Laravel-owned authorization/validation, transactions, audit trails, pagination, and safe serialization. fileciteturn7file9
- Exact repository models, payment gateway, cache driver, proxy topology, and account-status schema were not available during research.

### Laravel data model

Recommended conceptual schema:

```text
blocklist_entries
- id
- type
- user_id nullable
- ip_address nullable
- payment_provider nullable
- payment_reference nullable
- reason
- status
- expires_at nullable
- created_by_admin_id
- revoked_by_admin_id nullable
- revoked_at nullable
- created_at
- updated_at
```

- Use constraints so only type-relevant target fields are populated where practical.
- Index:
  - active user lookup
  - active normalized IP
  - active provider + payment reference
- Avoid an unstructured JSON-only matcher unless the repository already uses that pattern.

### Laravel API

Conceptual endpoints:

```http
GET  /api/admin/blocklist
POST /api/admin/blocklist
GET  /api/admin/blocklist/{entry}
POST /api/admin/blocklist/{entry}/revoke
```

- Use Form Requests and Admin Policies/Gates.
- Suggested actions:
  - `CreateBlocklistEntry`
  - `RevokeBlocklistEntry`
  - `BlocklistChecker`
- Keep controllers thin.
- Execute block + required audit mutation transactionally.
- Update cache after commit.

### Enforcement integration

- **IP:** request middleware → `BlocklistChecker::isIpBlocked()`.
- **User:** authenticated middleware/service → `isUserBlocked($user->id)`.
- **Payment:** checkout/payment action → `isPaymentMethodBlocked(provider, reference)`.
- Do not force all block types into one generic middleware.
- Document route groups and exemptions explicitly.

### IP implementation

- Laravel supports IP/IPv4/IPv6 validation.
- Configure trusted proxies before relying on `$request->ip()`.
- Laravel documentation explicitly treats IP addresses as untrusted/user-controlled input.
- Add CIDR later only if needed, using a tested utility rather than custom string-prefix matching.

### Payment implementation

- Inspect the selected gateway first.
- Use its non-sensitive reusable identifier/fingerprint when available.
- Stripe is one example: its PaymentMethod card fingerprint can identify repeated use of a card number, with caveats for tokenized wallets/regions.
- Keep gateway-specific matching behind a payment-risk adapter/service.
- PCI guidance prohibits retaining sensitive authentication data such as CVV after authorization.

### Cache

Recommended key shape:

```text
block:user:{userId}
block:ip:{normalizedIp}
block:payment:{provider}:{reference}
```

- Choose positive-only vs positive+negative caching based on traffic.
- Bound TTLs.
- Invalidate immediately after create/revoke.
- Never use cached state to authorize Admin management actions.

### Next.js / React

- Build:
  - blocklist table
  - create form/dialog
  - entry detail
  - revoke confirmation
- Change inputs based on block type.
- User target should use authorized user lookup, not free-text email matching.
- Payment UI accepts only safe provider reference/fingerprint.
- IP client validation is UX only; Laravel remains authoritative.
- Use shared API client and refetch after mutations.

### Tests

- **Laravel:** guest/non-Admin denial, permission checks, all three types, invalid target/type, IPv4/IPv6 normalization, duplicate block, expiration, revocation, audit, user/IP/payment enforcement, cache invalidation, trusted-proxy behavior, safe payment serialization.
- **Frontend:** list states, filters/pagination, type-specific forms, validation, duplicate conflict, confirmations, create/revoke, forbidden state, accessible interaction, no raw payment-secret fields.

### Research-backed recommendations

- Treat IP as untrusted/contextual and configure trusted proxies correctly. citeturn591610search0
- Layer blocklists with rate limits/business controls rather than relying on a single IP signal. citeturn718623search1
- Cache frequent checks using Laravel's shared cache facilities when needed. citeturn330767search0
- Use provider fingerprints/references rather than raw card data; Stripe exposes a card fingerprint for repeated-card identification. citeturn591610search2
- Never store sensitive authentication data such as CVV after authorization. citeturn718623search0

### Risks

- **IP false positives:** NAT, schools, offices, ISPs, and mobile networks may share addresses.
- **Proxy misconfiguration:** spoofed forwarded headers can cause incorrect decisions.
- **Self-lockout:** applying bans to Admin routes without policy can lock out administrators.
- **Payment-data exposure:** raw card storage increases security/compliance risk.
- **Provider mismatch:** fingerprint semantics differ across gateways/wallets.
- **Cache staleness:** stale decisions can delay a block or unblock.
- **Feature overlap:** user bans may conflict with suspension/deactivation.
- **Overblocking:** one weak heuristic may harm legitimate users.
- **Performance:** per-request full-table scans violate the source requirement.

### Open questions

- Can `ADMIN` accounts be globally banned?
- Do IP bans apply to Admin routes?
- Which routes are exempt?
- What can blocked users still access for support/refund/history?
- Does user ban change account status?
- Default expiration/indefinite behavior.
- Reason taxonomy and user-facing messages.
- CIDR support.
- IP retention/privacy period.
- Failure-open vs failure-closed policy.
- Payment provider/fingerprint semantics.
- Exact payment-flow enforcement point.
- Cache backend/TTL.
- Whether automated signals can propose blocks for Admin review.
- Appeal/review flow for false positives.

### Sources

- Project rules: `SKILL.md`
- Architecture contract: `README.md`
- Admin feature model: `Admin.md`
- Admin Authentication integration
- Laravel Request IP / trusted proxies: https://laravel.com/docs/12.x/requests
- Laravel IP validation: https://api.laravel.com/docs/12.x/Illuminate/Validation/Concerns/ValidatesAttributes.html
- Laravel Cache: https://laravel.com/docs/12.x/cache
- OWASP Bot Management and Anti-Automation: https://cheatsheetseries.owasp.org/cheatsheets/Bot_Management_and_Anti-Automation_Cheat_Sheet.html
- Stripe PaymentMethod fingerprint: https://docs.stripe.com/api/payment_methods/object
- PCI SSC sensitive authentication data: https://www.pcisecuritystandards.org/faqs/1533/
