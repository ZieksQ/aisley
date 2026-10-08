<?php

namespace App\Policies;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Enums\VoucherIssuerType;
use App\Models\User;
use App\Models\Voucher;

class VoucherPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->status === UserStatus::Active && match ($user->role) {
            UserRole::Admin => $user->permissions()->where('slug', 'vouchers.view')->exists(),
            UserRole::Seller => $user->shop()->exists(),
            default => false,
        };
    }

    public function create(User $user): bool
    {
        return $this->viewAny($user) && ($user->role === UserRole::Seller || $user->permissions()->where('slug', 'vouchers.manage')->exists());
    }

    public function view(User $user, Voucher $voucher): bool
    {
        return $this->viewAny($user) && ($user->role === UserRole::Admin
            ? $voucher->issuer_type === VoucherIssuerType::App
            : $voucher->issuer_type === VoucherIssuerType::Shop && $user->shop()->whereKey($voucher->shop_id)->exists());
    }

    public function update(User $user, Voucher $voucher): bool
    {
        return $this->create($user) && $this->view($user, $voucher);
    }
}
