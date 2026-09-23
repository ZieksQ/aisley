<?php

namespace Tests\Feature\Finance;

use App\Models\FinanceJournalEntry;
use App\Models\FinanceLedgerLine;
use App\Services\Finance\LedgerService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use InvalidArgumentException;
use Tests\TestCase;

class FinanceLedgerTest extends TestCase
{
    use RefreshDatabase;

    public function test_balanced_journal_is_idempotent_and_reconciles_to_zero(): void
    {
        $ledger = app(LedgerService::class);
        $lines = [
            ['account_code' => 'cash', 'owner_type' => 'platform', 'debit_cents' => 12500],
            ['account_code' => 'seller_liability', 'owner_type' => 'seller', 'owner_id' => fake()->uuid(), 'credit_cents' => 10000],
            ['account_code' => 'commission_revenue', 'owner_type' => 'platform', 'credit_cents' => 2500],
        ];

        $first = $ledger->post('test:balanced', 'test_event', 'PHP', $lines, now());
        $second = $ledger->post('test:balanced', 'test_event', 'PHP', $lines, now());

        $this->assertTrue($first->is($second));
        $this->assertSame(1, FinanceJournalEntry::query()->count());
        $this->assertSame(3, FinanceLedgerLine::query()->count());
        $this->assertSame(
            FinanceLedgerLine::query()->sum('debit_cents'),
            FinanceLedgerLine::query()->sum('credit_cents'),
        );
    }

    public function test_unbalanced_journal_is_rejected_without_partial_writes(): void
    {
        try {
            app(LedgerService::class)->post('test:unbalanced', 'test_event', 'PHP', [
                ['account_code' => 'cash', 'debit_cents' => 100],
                ['account_code' => 'seller_liability', 'credit_cents' => 99],
            ], now());
            $this->fail('An unbalanced journal must be rejected.');
        } catch (InvalidArgumentException) {
            $this->assertDatabaseCount('finance_journal_entries', 0);
            $this->assertDatabaseCount('finance_ledger_lines', 0);
        }
    }
}
