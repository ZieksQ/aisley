<?php

namespace App\Services\Finance\Gateway;

use App\Models\LogisticsOrganization;
use App\Models\SandboxGatewayAccount;

class LogisticsBillingService
{
    public function provision(LogisticsOrganization $organization): SandboxGatewayAccount
    {
        $account = SandboxGatewayAccount::query()->firstOrCreate(['reference' => 'logistics-'.$organization->id], [
            'balance_cents' => 0, 'currency' => 'PHP',
            'display_last_four' => str_pad((string) random_int(0, 9999), 4, '0', STR_PAD_LEFT),
        ]);
        if ($account->display_last_four === null) {
            SandboxGatewayAccount::query()->whereKey($account->id)->whereNull('display_last_four')->update([
                'display_last_four' => str_pad((string) random_int(0, 9999), 4, '0', STR_PAD_LEFT),
            ]);
            $account->refresh();
        }

        return $account;
    }

    public function details(LogisticsOrganization $organization): array
    {
        $account = $this->provision($organization);

        return ['label' => 'Simulated payment account', 'masked_identifier' => '••••'.$account->display_last_four,
            'currency' => $account->currency, 'active' => $account->is_active,
            'simulation_enabled' => (bool) config('finance.gateway_enabled')];
    }
}
