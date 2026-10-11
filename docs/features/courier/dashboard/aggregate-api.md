# Courier dashboard v2

`GET /api/v1/courier/dashboard?version=2` uses Sanctum Courier bearer auth, active account, approved affiliation, active Logistics owner/sole hub and required consent. Requests without version, or version=1, retain the historical scaffold. Other versions/unsupported fields return field-addressable 422. No selector can override Courier/organization/hub scope.

Response: `{data:[],meta:{version:2,next_cursor:null,generated_at},sections:{notifications,available_tasks,active_tasks},freshness:{state:"fresh"|"partial",reason:null,generated_at}}`. Each section is `{state:"available"|"empty"|"failed",reason:null|"SECTION_UNAVAILABLE",data:[],has_more:bool,generated_at:string|null}`. Available is nonempty, empty is valid zero results; failed has empty data, false has_more and null timestamp. Recoverable database-query failures affect only their section. Authentication/affiliation failures reject the request, never become empty sections. Errors expose no SQL/bindings/details.

Successful section timestamps share the request's UTC generation time. This is a request-time read, not a promise of transactional cross-section consistency or future freshness. Partial means at least one section failed. Responses are private/no-store; there is no persistent cache, aggregate cursor or total count.

Each section contains at most five rows and uses a sixth matching row only to compute has_more. Notifications reuse the notification service's safe DTO, newest created_at/ID first, without marking read. Their owning inbox supplies full history/unread counts.

Task rows: `{id,leg:"first_mile"|"final_mile",status,revision:int|null,order_reference:string|null,waybill_reference:string|null,schedule_id:UUID|null,created_at:UTC}`. First-mile IDs retain the existing legacy list identity and pickup schedule ID; final-mile rows use DeliveryTask IDs/revisions and nullable schedule_id. No contact/address, proof, financial or raw storage data is included.

Available: first-mile assigned and final-mile delivery_assigned. Active: first-mile accepted; final-mile delivery_accepted, picked_up_from_hub, in_transit or out_for_delivery. Picked-up first-mile, delivered/rejected/cancelled and unknown states are excluded. First-mile queries scope Courier/organization/hub; final-mile queries scope Courier/leg/current Shipment organization/hub. Combined tasks order oldest created_at first, then leg, then ID; bounds apply to the combined section.

Flutter requests v2 and accepts a strict legacy scaffold fallback on older backends. Valid v2 replaces duplicate task-list previews. Failed sections may retain same-session prior data labelled stale with its prior timestamp. Entry/manual/resume/reconnect and return from work refetch; no new timer is introduced. Obsolete responses cannot restore cleared account data. 401/403/consent follow existing auth gates; 429 honors Retry-After; network/decode/5xx retain permitted stale reads with explicit Retry.

Cards navigate only: first-mile opens Pickup; final-mile offers open the existing batch screen; active final-mile opens Delivery; notifications open the notification inbox. Owning screens refetch before actions. Tapping never accepts, picks up, completes or marks read. Deploy API v2 before dependent client; default-v1 compatibility remains.

[Example](aggregate-example.json) is synthetic contract evidence. Canonical/portable/Courier copies match. SQLite/API and synthetic Flutter/browser evidence do not establish deployed PostgreSQL, live transport or installed-device acceptance.
