<?php

namespace App\Services\Seller;

use App\Enums\AddressType;
use App\Models\Address;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;

class PickupAddressService
{
    /** @return Collection<int, Address> */
    public function list(User $seller): Collection
    {
        return $seller->addresses()->orderByDesc('is_default')->orderByDesc('created_at')->get();
    }

    /** @param array<string, mixed> $data */
    public function create(User $seller, array $data): Address
    {
        return DB::transaction(function () use ($seller, $data): Address {
            User::query()->whereKey($seller->id)->lockForUpdate()->firstOrFail();
            $makeDefault = ! $seller->addresses()->exists() || (bool) ($data['is_default'] ?? false);
            if ($makeDefault) {
                $seller->addresses()->where('is_default', true)->update(['is_default' => false]);
            }

            return $seller->addresses()->create([
                ...$this->normalize($data),
                'type' => AddressType::Both,
                'is_default' => $makeDefault,
            ]);
        });
    }

    /** @param array<string, mixed> $data */
    public function update(User $seller, string $addressId, array $data): Address
    {
        return DB::transaction(function () use ($seller, $addressId, $data): Address {
            User::query()->whereKey($seller->id)->lockForUpdate()->firstOrFail();
            $address = $seller->addresses()->whereKey($addressId)->lockForUpdate()->firstOrFail();
            $makeDefault = (bool) ($data['is_default'] ?? false);
            if ($makeDefault) {
                $seller->addresses()->whereKeyNot($address->id)->where('is_default', true)->update(['is_default' => false]);
            }
            $address->fill([...$this->normalize($data), 'type' => AddressType::Both, 'is_default' => $makeDefault])->save();

            if (! $makeDefault && ! $seller->addresses()->where('is_default', true)->exists()) {
                $address->update(['is_default' => true]);
            }

            return $address->refresh();
        });
    }

    public function delete(User $seller, string $addressId): void
    {
        DB::transaction(function () use ($seller, $addressId): void {
            User::query()->whereKey($seller->id)->lockForUpdate()->firstOrFail();
            $address = $seller->addresses()->whereKey($addressId)->lockForUpdate()->firstOrFail();
            $wasDefault = $address->is_default;
            $address->delete();
            if ($wasDefault) {
                $seller->addresses()->orderByDesc('created_at')->first()?->update(['is_default' => true]);
            }
        });
    }

    /** @param array<string, mixed> $data @return array<string, mixed> */
    private function normalize(array $data): array
    {
        return collect(Arr::except($data, ['is_default']))
            ->map(fn ($value) => is_string($value) ? trim($value) : $value)
            ->all();
    }
}
