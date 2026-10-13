# AISLEY documentation

Use [Progress](PROGRESS.md) for dated implementation evidence and [archived logs](logs) for earlier work. Read these guides before changing a feature:

- [Requirements](requirements.md): platform capabilities and role boundaries.
- [Architecture](architecture.md): stack, workspace, authentication and deployment.
- [Workspace flows](workspace.md) and [schema](schema.md): state transitions and persisted records.
- [Domains](domains) and [feature specifications](features): ownership and detailed contracts.
- [Web design](design.md): Customer, Seller, Admin and Logistics presentation/accessibility rules.
- [Maps/location](maps-location-api.md), [uploads](references/file-upload-requirements.md), and [registration](references/user-registration-requirements.md): applicable shared policies.

The portable [Courier documentation](docs-flutter-rider/README.md) and [Buyer documentation](docs-mobile-buyer/README.md) are synchronized with their separate Flutter projects. Each client owns its implementation and verification; Laravel owns server authority. Preserve dated provenance and distinguish source availability, client adoption and deployed/device acceptance.

The [October 12 audit](references/synchronization-2026-10-12.md) records current revisions, validation and unresolved adoption gaps. Reconcile maintained documents selectively when newer information exists on both sides; preserve historical reports and archives.
