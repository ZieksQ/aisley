# G32 Buyer Shop context and availability — 2026-10-15

Audit G32/F08 is resolved in local Buyer source. Controlled deployed API, live counterpart exchange and installed Android/TalkBack acceptance remain open.

## Adopted contract and behavior

- Reinspected Laravel at `1d40b5d34fac1bfa93b9c32f5ee4fb0d54f43167`: `ShopChatContext`, Customer conversation routes/controller, `ConversationService`, attachment scope and `CustomerChatMessagingTest` already implement the required contract. No Laravel API, schema, web application or Courier change is needed.
- Buyer now calls authenticated `GET /api/v1/customer/conversations/shops/{shop}` for prospective Shop/Product/Order entry. It parses the required Shop availability and optional conversation ID, checks Shop/summary identity, and loads detail/history before adopting an existing thread. Opening sends no message and creates no empty thread.
- Thread headers show the Shop name and business availability. Existing-thread `send_allowed` determines reply permission independently of vacation status. Generic prospective vacation starts are blocked; an owned-Order vacation start remains available for Laravel's ownership/eligibility validation. Unknown availability disables new actions without inventing a status.
- Failed/initial discovery blocks new sends and offers refresh. Refresh retains safe drafts/focus; scoped denial clears affected state. Account/consent changes reject obsolete discovery/detail/history successes and errors.
- Uncertain start/reply records preserve endpoint, body, Product/Order context, ordered attachment IDs and UUID key through discovery, polling, screen lifetime and same-account consent recovery. No automatic replay occurs. Definitive `409` rejection requires explicit review before a new key; an uncertain conflict cannot abandon its original key. Recovery remains memory-only (G12).

## Local verification

- Added 67 contract/controller/recovery/widget regressions across four focused suites. The full affected messaging/media/recovery/accessibility/responsive selection passes 186 tests. Synthetic transport covers Shop/Product/Order thread reuse, malformed/null/unknown DTOs, mismatched identities, vacation permissions, exact image-message replay, cursor/read behavior, `401/403/404/409/422/429`, offline/timeout and obsolete-session responses.
- Widget checks cover 320/390/600/800/1024/1440 widths with doubled text, disabled/loading/retry states and focused draft retention. Adjacent responsive/accessibility tests cover mounted resizing, landscape and keyboard insets; these are synthetic widget checks rather than installed TalkBack evidence.
- `flutter analyze --no-pub`, changed-file `dart format --output=none --set-exit-if-changed`, web and Android release builds pass. Builds use public placeholder API/storefront origins and establish compilation only.
- `PYTHONDONTWRITEBYTECODE=1 python3 tool/browser_shop_context.py` exercises the built Buyer at `http://localhost:8766` with API interception installed before startup. The browser checks pass seven phone/tablet/desktop/landscape layouts and nine journeys, including all three entry points, lost-response exact replay, vacation permissions, explicit failure recovery and bearer/cookie boundaries. The 320px and 1440px captures were visually reviewed. Browser evidence is retained under ignored `build/verification/shop-context/`; synthetic messages, credentials and HTTP responses do not reach Laravel.
- `PYTHONDONTWRITEBYTECODE=1 python3 tool/verify_bundle.py`, its regression suite, JSON/operation consistency, paired documentation/spec bounds and Git whitespace checks validate the handoff. The Shop messaging spec remains within 200–230 physical lines.

Focused selection:

```sh
flutter test --no-pub test/features/shop_context_contract_test.dart test/features/shop_context_controller_test.dart test/features/shop_context_recovery_test.dart test/features/shop_context_widgets_test.dart test/features/phase_4_contract_test.dart test/features/phase_4_messaging_test.dart test/features/phase_4_widgets_test.dart test/features/chat_images_test.dart test/core/chat_media_test.dart test/core/chat_media_transport_test.dart test/features/phase_5_recovery_test.dart test/features/phase_5_accessibility_test.dart test/features/responsive_layout_test.dart
```

Build commands:

```sh
flutter build web --no-pub --output=build/g32-web-final --dart-define=API_BASE_URL=https://api.example.invalid --dart-define=STOREFRONT_ORIGIN=https://shop.example.invalid
flutter build apk --release --no-pub --dart-define=API_BASE_URL=https://api.example.invalid --dart-define=STOREFRONT_ORIGIN=https://shop.example.invalid
```

Logs are local ignored `build/g32-tests.log`, `build/g32-analyze.log`, `build/g32-web-build-final.log`, `build/g32-apk-build.log` and `build/g32-browser.log`.

## Remaining acceptance

Verify the approved deployed API/client pair with controlled Customer/Seller accounts: generic and Product entry, owned-Order vacation contact, existing/read-only history, permission changes, private-media exchange and exact uncertain replay. Complete installed Android, TalkBack, actual keyboard/back behavior and media runtime acceptance separately. No live API, database, migration, production signing, provider configuration or deployment was performed; the original audit and historical verification records remain unchanged.
