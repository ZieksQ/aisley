<?php

namespace Database\Seeders;

use App\Models\PlatformFeatureControl;
use Illuminate\Database\Seeder;

class PlatformFeatureControlSeeder extends Seeder
{
    /** @var array<int, array{key: string, label: string, description: string, enabled: bool}> */
    private const CONTROLS = [
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
