<?php

namespace App\Services;

use App\Models\PlatformFeatureControl;

class PlatformFeatureControlService
{
    public function isEnabled(string $key, bool $fallback = true): bool
    {
        $enabled = PlatformFeatureControl::query()
            ->where('key', $key)
            ->value('enabled');

        return $enabled === null ? $fallback : (bool) $enabled;
    }
}
