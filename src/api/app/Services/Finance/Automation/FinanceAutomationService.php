<?php

namespace App\Services\Finance\Automation;

use App\Enums\CodInvoiceStatus;
use App\Jobs\Finance\ProcessFinanceWebhook;
use App\Jobs\Finance\SubmitFinancePayment;
use App\Models\CodInvoice;
use App\Models\FinanceAutomationRun;
use App\Models\FinancePaymentAttempt;
use App\Models\FinanceWebhookReceipt;
use App\Models\LogisticsOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class FinanceAutomationService
{
    public function __construct(private readonly FinanceSettingsService $settings, private readonly CollectionService $collections, private readonly PayoutService $payouts, private readonly FinanceNoticeService $notices) {}

    public function tick(): int
    {
        $this->notices->dispatchPending();
        if (! config('finance.gateway_enabled')) {
            return 0;
        }
        $created = 0;
        $platform = $this->settings->platform();
        foreach (LogisticsOrganization::query()->whereHas('user', fn ($q) => $q->where('status', 'active'))->get() as $organization) {
            $setting = $this->settings->collection($organization->id);
            if ($platform->collection_enabled && $setting->collection_enabled) {
                $created += $this->run('collection', $organization->id, $setting->collection_time);
            }
        }
        foreach (['seller', 'logistics'] as $type) {
            if ($platform->{$type.'_payout_enabled'}) {
                $created += $this->run($type, 'platform', $platform->{$type.'_payout_time'});
            }
        }
        // Recover a lost dispatch, timeout, missing callback, or exhausted queue retry.
        FinancePaymentAttempt::query()->whereNull('resolved_at')->where('updated_at', '<=', now()->subMinutes(5))->each(function ($attempt) {
            $attempt->touch();
            SubmitFinancePayment::dispatch($attempt->id);
        });
        FinanceWebhookReceipt::query()->whereNull('processed_at')->where('updated_at', '<=', now()->subMinutes(5))->each(function ($receipt) {
            $receipt->touch();
            ProcessFinanceWebhook::dispatch($receipt->id);
        });

        return $created;
    }

    private function run(string $kind, string $scope, string $time): int
    {
        $local = now('Asia/Manila');
        if ($local->format('H:i') < $time) {
            return 0;
        }
        $key = $kind.':'.$scope.':'.$local->toDateString();
        $run = FinanceAutomationRun::query()->firstOrCreate(['run_key' => $key], [
            'kind' => $kind, 'scope_key' => $scope, 'cutoff_at' => $local->copy()->setTimeFromTimeString($time)->utc(),
        ]);
        try {
            return DB::transaction(function () use ($run, $kind, $scope, $key) {
                $run = FinanceAutomationRun::query()->whereKey($run->id)->lockForUpdate()->firstOrFail();
                if ($run->completed_at !== null) {
                    return 0;
                }
                $created = 0;
                if ($kind === 'collection') {
                    LogisticsOrganization::query()->whereKey($scope)->lockForUpdate()->firstOrFail();
                    $groups = CodInvoice::query()->where('logistics_organization_id', $scope)->where('status', CodInvoiceStatus::Outstanding)
                        ->where('created_at', '<=', $run->cutoff_at)->get()->groupBy('currency');
                    foreach ($groups as $currency => $invoices) {
                        foreach ($invoices->chunk(500) as $index => $chunk) {
                            $this->collections->pay($scope, $chunk->pluck('id')->all(), $key.':'.$currency.':'.$index);
                            $created++;
                        }
                    }
                } else {
                    $groups = collect($this->payouts->obligations($kind))->filter(fn ($item) => $item['blocked'] === [] && CarbonImmutable::parse($item['eligible_at'])->lte($run->cutoff_at))
                        ->groupBy(fn ($item) => $item['beneficiary_id'].':'.$item['currency']);
                    foreach ($groups as $groupKey => $items) {
                        foreach ($items->chunk(500) as $index => $chunk) {
                            $created += $this->payouts->pay($kind, $chunk->first()['beneficiary_id'], $chunk->pluck('order_id')->all(), $key.':'.$groupKey.':'.$index) !== null ? 1 : 0;
                        }
                    }
                }
                $run->update(['completed_at' => now()]);

                return $created;
            }, 3);
        } catch (\Throwable $error) {
            Log::warning('Finance automation run requires retry.', ['run_id' => $run->id, 'exception' => get_class($error)]);

            return 0;
        }
    }
}
