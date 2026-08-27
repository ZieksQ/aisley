<?php

namespace App\Models\Concerns;

use Illuminate\Database\Eloquent\Casts\Attribute;

trait HasBirthDateAge
{
    /**
     * Calculate age from the stored birth date so it never becomes stale.
     */
    protected function age(): Attribute
    {
        return Attribute::get(fn (): ?int => $this->birth_date?->age);
    }
}
