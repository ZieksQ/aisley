<?php

namespace App\Services\Finance\Gateway;

use App\Enums\FinancePaymentStatus;
use App\Jobs\Finance\DeliverGatewayEvent;
use App\Jobs\Finance\ResolveGatewayTransaction;
use App\Models\FinanceGatewayEvent;
use App\Models\SandboxGatewayAccount;
use App\Models\SandboxGatewayTransaction;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SandboxGatewayService
{
    public function create(string $key, array $data): SandboxGatewayTransaction
    {
        return DB::transaction(function () use ($key, $data) {
            SandboxGatewayAccount::query()->firstOrCreate(['reference' => 'platform']);
            SandboxGatewayAccount::query()->where('reference', 'platform')->lockForUpdate()->firstOrFail();
            $hash = hash('sha256', json_encode($data, JSON_THROW_ON_ERROR));
            $existing = SandboxGatewayTransaction::query()->where('idempotency_key', $key)->first();
            if ($existing) {
                abort_unless(hash_equals($existing->request_hash, $hash), 409, 'Idempotency key payload mismatch.');

                return $existing;
            }
            $account = SandboxGatewayAccount::query()->where('reference', $data['account_reference'])->firstOrFail();
            abort_unless($account->currency === $data['currency'], 422, 'Account has a different currency.');
            $transaction = SandboxGatewayTransaction::create([
                ...$data, 'idempotency_key' => $key, 'request_hash' => $hash,
                'scenario' => $account->scenario, 'status' => FinancePaymentStatus::Pending,
            ]);
            ResolveGatewayTransaction::dispatch($transaction->id)->afterCommit();

            return $transaction;
        }, 3);
    }

    public function resolve(string $id, ?string $outcome = null): SandboxGatewayTransaction
    {
        return DB::transaction(function () use ($id, $outcome) {
            // One consistent account lock order serializes simulator balance movement.
            $identity = SandboxGatewayTransaction::findOrFail($id);
            $accounts = SandboxGatewayAccount::query()->whereIn('reference', ['platform', $identity->account_reference])->orderBy('reference')->lockForUpdate()->get()->keyBy('reference');
            $transaction = SandboxGatewayTransaction::query()->whereKey($id)->lockForUpdate()->firstOrFail();
            if (in_array($transaction->status, [FinancePaymentStatus::Succeeded, FinancePaymentStatus::Failed], true)) {
                return $transaction;
            }
            $scenario = $outcome ?? $transaction->scenario->value;
            if ($scenario === 'delay') {
                return $transaction;
            }
            $payer = $accounts[$transaction->direction->value === 'collection' ? $transaction->account_reference : 'platform'];
            $recipient = $accounts[$transaction->direction->value === 'collection' ? 'platform' : $transaction->account_reference];
            $failure = ! $payer->is_active || ! $recipient->is_active ? 'account_inactive' : null;
            $failure ??= $scenario === 'failure' ? 'payment_failed' : null;
            $failure ??= $scenario === 'insufficient_funds' || $payer->balance_cents < $transaction->amount_cents ? 'insufficient_funds' : null;
            if ($failure === null) {
                $payer->decrement('balance_cents', $transaction->amount_cents);
                $recipient->increment('balance_cents', $transaction->amount_cents);
            }
            $transaction->update(['status' => $failure ? FinancePaymentStatus::Failed : FinancePaymentStatus::Succeeded, 'failure_code' => $failure]);
            $eventId = (string) Str::uuid();
            $event = FinanceGatewayEvent::create([
                'id' => $eventId, 'sandbox_gateway_transaction_id' => $transaction->id,
                'payload' => ['id' => $eventId, 'type' => $transaction->direction->value.'.'.$transaction->status->value,
                    'created' => now()->timestamp, 'livemode' => false, 'data' => $this->object($transaction)],
            ]);
            DeliverGatewayEvent::dispatch($event->id)->afterCommit();
            if ($scenario === 'duplicate_callback') {
                DeliverGatewayEvent::dispatch($event->id)->afterCommit();
            }

            return $transaction->refresh();
        }, 3);
    }

    public function object(SandboxGatewayTransaction $transaction): array
    {
        return ['id' => $transaction->id, 'object' => 'sandbox_payment', 'status' => $transaction->status->value,
            'direction' => $transaction->direction->value, 'amount_cents' => $transaction->amount_cents,
            'currency' => $transaction->currency, 'account_reference' => $transaction->account_reference,
            'metadata' => $transaction->metadata, 'failure_code' => $transaction->failure_code, 'livemode' => false];
    }
}
