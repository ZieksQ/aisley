# Isolated private-media acceptance

This opt-in tool exercises real Laravel HTTP, private local storage, the dedicated
database-backed `media` worker, FFmpeg/ffprobe, and ClamAV. It creates synthetic
accounts, Orders and conversations in a **new disposable SQLite database**. Its
setup transitions are fixtures, not fulfillment or financial acceptance.

Run from the AISLEY repository with Python 3.10+, PHP and installed Composer
dependencies, FFmpeg/ffprobe, and the repository-owned scanner already available:

```sh
docker compose --env-file /dev/null -f docker/chat-media.local.yml up -d
python3 src/api/tests/Support/private-media-runtime/test_runtime.py
python3 src/api/tests/Support/private-media-runtime/runtime.py \
  --api-source src/api --workspace build/g26-runtime --serve
```

The scanner needs healthy signatures on loopback port 13310. The runtime uses
loopback port 18026 and refuses to replace an existing listener. Read its generated
`results.json` for the source revision, scanner version/signatures, tools, fixture
hashes, checks and actual scope. A normal run stops/revokes fixture credentials;
`--serve` retains the API/worker for Flutter checks until Ctrl-C/SIGTERM.

The source copy has an explicit allowlist. Environment files, application storage,
existing SQLite databases and compiled bootstrap configuration are excluded.
Child processes receive synthetic configuration, not inherited database/cloud
credentials. Only the disposable copy uses SQLite WAL/IMMEDIATE transactions and
a 30-second busy timeout so HTTP and the separate worker can serialize writes.
No ordinary development database or existing migration is changed. PostgreSQL
concurrency and Azure deployment acceptance remain separate checks.

The matrix checks seven conversation contexts: Shop, Customer–Logistics,
Seller–Logistics, both Logistics–Courier legs, Customer–Courier and Seller–Courier.
It verifies image rewriting, ready/bound delivery, real MP4/poster/PDF processing,
byte ranges, role/participant isolation, exact upload/message replay and conflicts,
malware rejection, scanner outage/three bounded failures/explicit recovery,
worker pause/restart, disabled-upload compatibility, ended-history/reassignment
isolation, and expired unbound cleanup. Scanner-outage retries use the real job
backoffs, so allow several minutes. Generated video is eight seconds for native
control checks. No fake scanner/storage/processor or synthetic HTTP replaces these
runtime paths. Setup alone uses the existing test fixtures.

`customer-session.json` and `courier-session.json` contain **temporary credentials**.
Keep the whole generated directory ignored, user-readable only, and out of commits,
terminal output and screenshots. The Flutter test host serves only the selected
role's bootstrap from a loopback origin; media requests go directly to Laravel.
Do not bind these services publicly. HTTP access logs are suppressed because they
contain private attachment URLs. Routine output reports safe check names only.

After a client verifies actual logout, renew its synthetic sessions before the
next client run (run browser and Android logout matrices sequentially):

```sh
python3 src/api/tests/Support/private-media-runtime/runtime.py --renew build/g26-runtime/run-EXAMPLE
```

The test-only setup helper refuses to bootstrap without the disposable marker,
exact SQLite path and absence of an environment file. Renewal grants no production
access. On normal shutdown every generated user's bearer tokens are revoked and
session bootstrap files are removed; generated test bytes/reports remain ignored.
If a process is forcibly killed, stop its owned HTTP/worker processes and remove
the disposable runtime before reuse. Do not reset another database or worker.

Buyer and Courier own their `test/manual/private_media_runtime_fixture.dart`,
`private_media_runtime_server.py`, `check_private_media_runtime.mjs` and
`check_private_media_android.py`. Their dated verification records contain the
web/APK build, browser and emulator commands and remaining release gates. These
fixtures reuse production repositories, media widgets, player and export adapters;
they do not certify the complete application navigation or secure-storage login.
