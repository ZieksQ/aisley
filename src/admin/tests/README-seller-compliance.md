# Seller compliance browser verification

Run from the repository root with Admin Vite on port 5176 and ChromeDriver on port 19516:

```sh
node src/admin/tests/seller-compliance-browser.smoke.mjs
```

Override `SELLER_COMPLIANCE_ORIGIN` or `SELLER_COMPLIANCE_DRIVER` for other ports. The script injects synthetic API responses into real Chromium; it does not change live accounts or cases. Browser profiles and light/dark captures are saved under `node_modules/.cache/seller-compliance-browser`.

Coverage includes the list, creation form, and seller picker at 320/390/768/1440px in both themes; short viewports; seller search/pagination/profile fields; draft retention; nested Escape/focus; superseded searches and Product reads; seller changes; validation; duplicate submission guards; successful navigation; list/picker recovery; reduced motion; and session loss. Live API integration, deployed acceptance, and assistive-technology checks remain separate.

The browser is brought to the foreground before opening the first dialog so the existing shell's initial focus-triggered session/consent refresh has settled. Shared auth/shell behavior belongs to its existing owner.
