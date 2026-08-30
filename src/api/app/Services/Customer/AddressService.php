<?php

namespace App\Services\Customer;

use App\Enums\AddressType;
use App\Models\Address;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;

class AddressService
{
    /** @return Collection<int, Address> */
    public function list(User $customer): Collection
    {
        return $customer->addresses()
            ->orderByDesc('is_default')
            ->orderByDesc('created_at')
            ->get();
    }

    /** @param array<string, mixed> $data */
    public function create(User $customer, array $data): Address
    {
        return DB::transaction(function () use ($customer, $data): Address {
            User::query()->whereKey($customer->id)->lockForUpdate()->firstOrFail();

            $type = AddressType::from($data['type']);
            if ((bool) ($data['is_default'] ?? false)) {
                $types = match ($type) {
                    AddressType::Shipping => [AddressType::Shipping->value, AddressType::Both->value],
                    AddressType::Billing => [AddressType::Billing->value, AddressType::Both->value],
                    AddressType::Both => AddressType::cases(),
                };

                $customer->addresses()
                    ->where('is_default', true)
                    ->whereIn('type', collect($types)->map(fn ($value) => $value instanceof AddressType ? $value->value : $value))
                    ->update(['is_default' => false]);
            }

            $normalized = collect(Arr::except($data, ['is_default']))
                ->map(fn ($value) => is_string($value) ? trim($value) : $value)
                ->all();

            return $customer->addresses()->create([
                ...$normalized,
                'is_default' => (bool) ($data['is_default'] ?? false),
            ]);
        });
    }
}
