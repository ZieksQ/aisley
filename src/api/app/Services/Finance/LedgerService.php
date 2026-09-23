<?php

namespace App\Services\Finance;

use App\Models\FinanceJournalEntry;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class LedgerService
{
    /** @param list<array{account_code: string, owner_type?: string|null, owner_id?: string|null, debit_cents?: int, credit_cents?: int}> $lines */
    public function post(string $key, string $event, string $currency, array $lines, mixed $effectiveAt, ?string $orderId = null, ?string $memo = null): FinanceJournalEntry
    {
        $debits = collect($lines)->sum(fn (array $line) => (int) ($line['debit_cents'] ?? 0));
        $credits = collect($lines)->sum(fn (array $line) => (int) ($line['credit_cents'] ?? 0));
        if ($debits < 1 || $debits !== $credits) {
            throw new InvalidArgumentException("Finance journal must balance; debit={$debits}, credit={$credits}.");
        }
        foreach ($lines as $line) {
            $debit = (int) ($line['debit_cents'] ?? 0);
            $credit = (int) ($line['credit_cents'] ?? 0);
            if (($debit > 0) === ($credit > 0)) {
                throw new InvalidArgumentException('Each finance ledger line must contain exactly one positive debit or credit.');
            }
        }

        try {
            return DB::transaction(function () use ($key, $event, $currency, $lines, $effectiveAt, $orderId, $memo): FinanceJournalEntry {
                $existing = FinanceJournalEntry::query()->where('idempotency_key', $key)->with('lines')->lockForUpdate()->first();
                if ($existing !== null) {
                    return $existing;
                }
                $journal = FinanceJournalEntry::create([
                    'idempotency_key' => $key, 'event_type' => $event, 'order_id' => $orderId,
                    'currency' => $currency, 'memo' => $memo, 'effective_at' => $effectiveAt,
                ]);
                foreach ($lines as $line) {
                    $journal->lines()->create([
                        'account_code' => $line['account_code'], 'owner_type' => $line['owner_type'] ?? null,
                        'owner_id' => $line['owner_id'] ?? null, 'debit_cents' => $line['debit_cents'] ?? 0,
                        'credit_cents' => $line['credit_cents'] ?? 0,
                    ]);
                }

                return $journal->load('lines');
            }, 3);
        } catch (QueryException $exception) {
            $existing = FinanceJournalEntry::query()->where('idempotency_key', $key)->with('lines')->first();
            if ($existing !== null) {
                return $existing;
            }

            throw $exception;
        }
    }
}
