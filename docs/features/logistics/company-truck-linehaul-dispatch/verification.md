# Receiving verification — 2026-09-23

The receiving implementation is covered by `LinehaulReceivingTest`, `LinehaulReceivingConcurrencyTest`, the revised company-truck/manifest/multi-hop tests, and live Firefox checks against an isolated Laravel/SQLite test API. No production or ordinary development records were used for these checks.

## Repeatable load fixtures

`src/api/tests/Support/LinehaulReceivingFixtures.php` builds accepted, departed company-truck loads through the actual pickup, sorting, reservation, approval, and departure APIs:

- `receivingLoad(1)` is the clean one-parcel load. Starting arrival leaves custody in transfer; capture and closure produce a clean receipt and visiting truck.
- `receivingLoad(3)` is the discrepancy load. Receive reference 0 normally; receive reference 1 as damaged with a reason; leave reference 2 missing. The test also submits a tracking ID absent from the manifest. Reference 0 can sort before closure; reference 1 stays out of the session until released; reference 2 remains in transfer through the empty truck return and arrives late afterward.

The load composition, driver capability, capacity, and operation order are deterministic. Database-generated identities/references remain unique per isolated test. Fixtures never declare unscanned parcels received.

## Automated API checks

From `src/api`, run:

```sh
php artisan test --compact --filter='LinehaulReceivingTest|CompanyTruckLinehaulTest|LinehaulTest|HubRoutingTest|FinalMileFulfillmentTest|LogisticsNotificationTest'
```

The affected SQLite regression run passed **57 tests / 1,247 assertions**. Coverage includes:

- Complete, partial, damaged and unexpected receipt; wrong-hub access; old cargo receipt bypass rejection.
- Matching request replay after sorting, a different device's duplicate scan, and changed-payload identity conflicts.
- An invalid member failing independently without undoing the prior valid receipt.
- Sorting during unloading, frozen session membership, damage release, shortage acknowledgement/reason, sender notification and late receipt after the truck returns home.
- Cargo and empty returns, truck/driver conflicts during unloading, feature/connection shutdown, multi-hop final-destination completion, historical completed receipts and standalone historical manifests.

For PostgreSQL, supply credentials for a **disposable test database only** and run `LinehaulReceivingConcurrencyTest|LinehaulReceivingTest|CompanyTruckLinehaulTest`. The concurrency class uses `DatabaseMigrations` and separate `pcntl` processes/connections; it must never run against application data. The verified run passed **7 tests / 357 assertions**, including same-request races, different scanner identities for the same parcel, and a scan racing unloading closure. All end with one receipt/event per parcel and no unresolved shortage for an arrived parcel. Migration creation and rollback ran on the disposable database.

## Live browser checks

A production Logistics build was served locally with its native service worker and proxied to an isolated Laravel test database. Two independent Firefox profiles represented two receiving devices. The sender and receiver used separate active Logistics accounts. These checks used real API/session/IndexedDB behavior, not mocked receiving responses:

1. Receiver opens the inbound trip and starts receiving; no parcel becomes received merely from arrival.
2. Both devices disconnect and capture the same manifest parcel manually. Only their local pending count increases.
3. Reload one trip page while offline. Its public shell, prior session/consent context, scoped manifest and pending scan remain available.
4. Reconnect each device. Both queues clear after server confirmation, while the authoritative receipt count increases only once.
5. Sign in as the sender on the same browser and request the receiving trip. The API rejects receiving access and the receiver's cached manifest/counts are absent from the sender's scope.
6. Capture another parcel as damaged with a reason. Reconciliation requires shortage acknowledgement and reason for the remaining parcel, then a native confirmation before closure.
7. Close unloading with discrepancies, release damage with an inspection reason, and verify visiting-truck return controls appear.
8. Inspect the compact receiving view at a narrow viewport in dark mode.

Production offline reload requires HTTPS or localhost, a completed initial online load/service-worker installation, and retained browser storage. API responses are not cached by the service worker. Starting and finishing unloading always require server connectivity. Offline context permits only provisional capture; expired/revoked sessions cannot synchronize without successful server authorization.

Physical camera/printed-label scanning and a real truck/dock handoff were not exercised by headless browser verification. The existing shared scanner and its manual fallback are retained.
