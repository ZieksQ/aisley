<?php

namespace App\Services\Finance\Automation;

use App\Models\FinanceAutomationSetting;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class FinanceSettingsService
{
    public function platform(): FinanceAutomationSetting
    {
        return FinanceAutomationSetting::query()->firstOrCreate(['scope_key' => 'platform'])->refresh();
    }

    public function collection(string $organizationId): FinanceAutomationSetting
    {
        return FinanceAutomationSetting::query()->firstOrCreate(['scope_key' => 'logistics:'.$organizationId])->refresh();
    }

    public function update(User $actor, string $scope, array $data): FinanceAutomationSetting
    {
        return DB::transaction(function () use ($actor, $scope, $data) {
            FinanceAutomationSetting::query()->firstOrCreate(['scope_key' => $scope]);
            $setting = FinanceAutomationSetting::query()->where('scope_key', $scope)->lockForUpdate()->firstOrFail();
            $setting->update([...$data, 'updated_by' => $actor->id]);

            return $setting->refresh();
        });
    }
}
