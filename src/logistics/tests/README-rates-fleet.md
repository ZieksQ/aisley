# Shipping rates, Courier applications, vehicles, and company fleet browser check

Run from the repository root after `pnpm --dir src/logistics build`, with a stable production preview and an isolated Chromium CDP instance. Existing Chromium/Brave may be used; keep the browser profile inside the repository. No new packages are required.

```sh
pnpm --dir src/logistics exec vite preview --host 127.0.0.1 --port 5187 --strictPort
# In another terminal, start Chromium/Brave with a project-local profile and CDP on port 19359.
node src/logistics/tests/rates-fleet-browser.smoke.mjs
```

`LOGISTICS_UI_ORIGIN` and `LOGISTICS_UI_CDP` override those addresses. The test injects synthetic authenticated API fixtures before application startup and intercepts API writes; it does not use actual accounts, Courier evidence, or fleet records.

The check covers 320/768/1440px layouts in light/dark themes, contained table overflow, rate-card deep links and unknown IDs, legacy rules and future-effective labels, keyboard tabs, rate form/calendar and discard, list filter return links, truck registration/edit validation and revision payloads, driver capability, narrow dialogs and keyboard help without horizontal overflow, dialog Escape/focus restoration (including edit saves), draft preservation after failed refresh, and failure/empty recovery. Screenshots and verification JSON are written to ignored `src/logistics/node_modules/.cache/rates-fleet-browser/`.

This is synthetic browser evidence. Live API, deployed access, real private document preview, assistive technology, and external Flutter acceptance remain separate.
