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
                $this->clearOverlappingDefaults($customer, $type);
            }

            return $customer->addresses()->create([
                ...$this->normalize($data),
                'is_default' => (bool) ($data['is_default'] ?? false),
            ]);
        });
    }

    /** @param array<string, mixed> $data */
    public function update(User $customer, string $addressId, array $data): Address
    {
        return DB::transaction(function () use ($customer, $addressId, $data): Address {
            User::query()->whereKey($customer->id)->lockForUpdate()->firstOrFail();

            $address = $customer->addresses()
                ->whereKey($addressId)
                ->lockForUpdate()
                ->firstOrFail();

            $type = AddressType::from($data['type']);
            if ((bool) ($data['is_default'] ?? false)) {
                $this->clearOverlappingDefaults($customer, $type, $address->id);
            }

            $address->fill([
                ...$this->normalize($data),
                'is_default' => (bool) ($data['is_default'] ?? false),
            ])->save();

            return $address->refresh();
        });
    }

    public function delete(User $customer, string $addressId): void
    {
        DB::transaction(function () use ($customer, $addressId): void {
            User::query()->whereKey($customer->id)->lockForUpdate()->firstOrFail();

            $customer->addresses()
                ->whereKey($addressId)
                ->lockForUpdate()
                ->firstOrFail()
                ->delete();
        });
    }

    private function clearOverlappingDefaults(User $customer, AddressType $type, ?string $exceptId = null): void
    {
        $types = match ($type) {
            AddressType::Shipping => [AddressType::Shipping->value, AddressType::Both->value],
            AddressType::Billing => [AddressType::Billing->value, AddressType::Both->value],
            AddressType::Both => array_map(fn (AddressType $case) => $case->value, AddressType::cases()),
        };

        $query = $customer->addresses()
            ->where('is_default', true)
            ->whereIn('type', $types);

        if ($exceptId !== null) {
            $query->whereKeyNot($exceptId);
        }

        $query->update(['is_default' => false]);
    }

    /** @param array<string, mixed> $data @return array<string, mixed> */
    private function normalize(array $data): array
    {
        return collect(Arr::except($data, ['is_default']))
            ->map(fn ($value) => is_string($value) ? trim($value) : $value)
            ->all();
    }
}
