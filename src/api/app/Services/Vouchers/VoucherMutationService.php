<?php

namespace App\Services\Vouchers;

use App\Enums\UserRole;
use App\Enums\VoucherLifecycle;
use App\Models\User;
use App\Models\Voucher;
use App\Models\VoucherAction;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class VoucherMutationService
{
    public function __construct(private VoucherTerms $terms, private VoucherReadService $reads) {}

    public function execute(User $actor, string $action, ?string $id, array $data): array
    {
        Gate::forUser($actor)->authorize('create', Voucher::class);
        $key = strtolower($data['idempotency_key']);
        unset($data['idempotency_key']);
        $hash = hash('sha256', json_encode([$action, $id, $this->canonical($data)]));
        try {
            return DB::transaction(function () use ($actor, $action, $id, $data, $key, $hash) {
                // Reserving a unique receipt blocks concurrent identical requests before domain rows.
                DB::table('voucher_mutation_receipts')->insertOrIgnore([
                    'id' => (string) Str::uuid(), 'actor_id' => $actor->id, 'key' => $key,
                    'payload_hash' => $hash, 'created_at' => now(),
                ]);
                $receipt = DB::table('voucher_mutation_receipts')->where('actor_id', $actor->id)->where('key', $key)->lockForUpdate()->first();
                $this->conflict($receipt->payload_hash !== $hash, 'IDEMPOTENCY_KEY_REUSED', 'This request key was already used for different details.');
                if ($receipt->response !== null) {
                    // Recheck target visibility before replay, including after a tenant change.
                    $replay = json_decode($receipt->response, true);
                    $this->reads->scope($actor)->whereKey($id ?? $replay['data']['id'])->firstOrFail();

                    return $replay;
                }
                if ($id === null) {
                    $this->conflict($data['revision'] != 0, 'REVISION_CONFLICT', 'New drafts require revision zero.');
                    $voucher = $this->create($actor, $this->terms->normalize($data));
                } else {
                    $voucher = $this->reads->scope($actor)->whereKey($id)->lockForUpdate()->firstOrFail();
                    Gate::forUser($actor)->authorize('update', $voucher);
                    $this->conflict($voucher->revision !== (int) $data['revision'], 'REVISION_CONFLICT', 'Voucher changed. Reload and review the latest terms.');
                    if ($action === 'duplicate') {
                        $this->terms->assertSupported($voucher);
                        $source = $voucher->id;
                        $terms = $voucher->draftVersion?->terms ?? $this->terms->snapshot($voucher);
                        $terms['name'] = $terms['name'] ?? $terms['code'];
                        $terms['code'] = 'AIS-'.strtoupper(Str::random(12));
                        $voucher = $this->create($actor, $terms);
                        $this->record($actor, $voucher, 'duplicate', ['source_id' => $source]);
                    } else {
                        $this->mutate($actor, $voucher, $action, $data);
                    }
                }
                $voucher->refresh();
                $response = ['data' => $this->reads->data($voucher)];
                DB::table('voucher_mutation_receipts')->where('id', $receipt->id)->update(['response' => json_encode($response)]);

                return $response;
            }, 3);
        } catch (QueryException $error) {
            if (in_array($error->getCode(), ['23505', '23000'], true) && (str_contains($error->getMessage(), 'vouchers.code') || str_contains($error->getMessage(), 'vouchers_code_unique'))) {
                throw ValidationException::withMessages(['code' => 'This voucher code is already in use.']);
            }
            throw $error;
        }
    }

    private function create(User $actor, array $terms): Voucher
    {
        $voucher = Voucher::create([
            ...$terms, 'issuer_type' => $actor->role === UserRole::Admin ? 'app' : 'shop',
            'shop_id' => $actor->role === UserRole::Seller ? $actor->shop()->firstOrFail()->id : null,
            'lifecycle' => 'draft', 'is_active' => false, 'version' => 0, 'revision' => 1,
            'availability_revision' => 1, 'redeemed_count' => 0,
        ]);
        $draft = $voucher->versions()->create(['number' => 1, 'state' => 'draft', 'terms' => $terms, 'actor_id' => $actor->id]);
        $voucher->update(['draft_version_id' => $draft->id]);
        $this->record($actor, $voucher, 'create', ['draft_number' => 1]);

        return $voucher;
    }

    private function mutate(User $actor, Voucher $voucher, string $action, array $data): void
    {
        $this->conflict($voucher->lifecycle === VoucherLifecycle::Ended, 'VOUCHER_ENDED', 'This voucher is permanently ended.');
        match ($action) {
            'save' => $this->save($actor, $voucher, $data),
            'publish' => $this->publish($actor, $voucher),
            'discard' => $this->discard($voucher),
            'pause', 'resume' => $this->availability($voucher, $action),
            'end' => $voucher->fill(['lifecycle' => 'ended', 'is_active' => false, 'ended_at' => now(), 'availability_revision' => $voucher->availability_revision + 1]),
            default => abort(404),
        };
        $voucher->revision++;
        $voucher->save();
        $this->record($actor, $voucher, $action, ['version' => $voucher->version, 'draft_version_id' => $voucher->draft_version_id]);
    }

    private function save(User $actor, Voucher $voucher, array $data): void
    {
        $this->terms->assertSupported($voucher);
        $terms = $this->terms->normalize($data, $voucher->code);
        $this->terms->assertIdentity($voucher, $terms);
        $draft = $voucher->draftVersion;
        if ($draft) {
            $draft->update(['terms' => $terms, 'actor_id' => $actor->id]);
        } else {
            $draft = $voucher->versions()->create([
                'number' => max($voucher->version, (int) $voucher->versions()->max('number')) + 1,
                'state' => 'draft', 'terms' => $terms, 'actor_id' => $actor->id,
            ]);
            $voucher->draft_version_id = $draft->id;
        }
        if ($voucher->lifecycle === VoucherLifecycle::Draft) {
            // Draft projection is unavailable but reserves its globally unique display code.
            $voucher->fill($terms);
        }
    }

    private function publish(User $actor, Voucher $voucher): void
    {
        $this->terms->assertSupported($voucher);
        $draft = $voucher->draftVersion;
        $this->conflict($draft === null, 'DRAFT_REQUIRED', 'Save a working draft before publication.');
        $terms = $draft->terms;
        $terms['name'] = $terms['name'] ?? $terms['code'];
        $this->terms->assertIdentity($voucher, $terms);
        $this->conflict($terms['global_limit'] !== null && $terms['global_limit'] < $voucher->redeemed_count, 'LIMIT_BELOW_USAGE', 'Total limit cannot be below committed redemption usage.');
        $this->conflict(now()->gte($terms['ends_at']), 'VOUCHER_EXPIRED', 'Publication requires a future end.');
        if ($voucher->lifecycle === VoucherLifecycle::Published) {
            $this->conflict(now()->lt($voucher->starts_at) || now()->lt($terms['starts_at']), 'REPLACEMENT_NOT_STARTED', 'Replacement requires a currently started validity window. Duplicate to schedule another offer.');
        }
        $initial = $voucher->lifecycle === VoucherLifecycle::Draft;
        $voucher->fill([
            ...$terms, 'lifecycle' => 'published', 'version' => $draft->number, 'draft_version_id' => null,
            'is_active' => $initial ? true : $voucher->is_active, 'published_at' => $voucher->published_at ?? now(),
            'availability_revision' => $voucher->availability_revision + 1,
        ]);
        $draft->update(['state' => 'published', 'published_at' => now(), 'actor_id' => $actor->id]);
    }

    private function discard(Voucher $voucher): void
    {
        $this->conflict($voucher->lifecycle === VoucherLifecycle::Draft, 'NO_PUBLISHED_FALLBACK', 'An initial draft has no published fallback. End it to retire it.');
        $this->conflict($voucher->draftVersion === null, 'DRAFT_REQUIRED', 'There is no working draft to discard.');
        $voucher->draftVersion->update(['state' => 'discarded']);
        $voucher->draft_version_id = null;
    }

    private function availability(Voucher $voucher, string $action): void
    {
        $this->conflict($voucher->lifecycle !== VoucherLifecycle::Published, 'PUBLICATION_REQUIRED', 'Only published vouchers can be paused or resumed.');
        $this->conflict($voucher->is_active === ($action === 'resume'), 'AVAILABILITY_CONFLICT', 'Voucher is already in the requested availability state.');
        $voucher->is_active = $action === 'resume';
        $voucher->availability_revision++;
    }

    private function record(User $actor, Voucher $voucher, string $action, array $details): void
    {
        VoucherAction::create([
            'voucher_id' => $voucher->id, 'actor_id' => $actor->id,
            'action' => $action, 'revision' => $voucher->revision, 'details' => $details,
        ]);
    }

    private function canonical(array $data): array
    {
        ksort($data);
        foreach ($data as &$value) {
            if (is_array($value)) {
                $value = $this->canonical($value);
            }
        }

        return $data;
    }

    private function conflict(bool $condition, string $code, string $message): void
    {
        if ($condition) {
            abort(response()->json(['code' => $code, 'message' => $message], 409));
        }
    }
}
