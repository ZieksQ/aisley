<?php

namespace Database\Seeders;

use App\Models\PlatformFeatureControl;
use Illuminate\Database\Seeder;

class PlatformFeatureControlSeeder extends Seeder
{
    /** @var array<int, array{key: string, label: string, description: string, enabled: bool}> */
    private const CONTROLS = [
        [
            'key' => PlatformFeatureControl::REGISTRATION_EMAIL_VERIFICATION_REQUIRED,
            'label' => 'Require email OTP for registration',
            'description' => 'When disabled, Customer, Seller, Logistics, and Courier registration skips inbox verification. Account approval rules still apply.',
            'enabled' => true,
        ],
        [
            'key' => PlatformFeatureControl::CUSTOMER_REGISTRATION_APPROVAL_REQUIRED,
            'label' => 'Require buyer account approval',
            'description' => 'When disabled, new verified buyers are automatically approved and active. Existing pending buyers still require review.',
            'enabled' => true,
        ],
        [
            'key' => PlatformFeatureControl::LINEHAUL,
            'label' => 'Linehaul',
            'description' => 'Enable new linehaul routes and departures. Receiving manifests already in transit remains available when disabled.',
            'enabled' => true,
        ],
        [
            'key' => PlatformFeatureControl::POLICY_CONSENT_ENFORCEMENT,
            'label' => 'Require Terms & Privacy consent',
            'description' => 'When enabled, authenticated users must accept the current Terms of Service and Privacy Policy before protected dashboard and API access.',
            'enabled' => true,
        ],
    ];

    public function run(): void
    {
        foreach (self::CONTROLS as $control) {
            PlatformFeatureControl::query()->firstOrCreate(
                ['key' => $control['key']],
                $control,
            );
        }
    }
}
