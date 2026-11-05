<?php

namespace App\Services\Admin\Provisioning;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\AdminRole;
use App\Models\Permission;
use App\Models\User;
use App\Policies\Admin\AdminAccountPolicy;
use Illuminate\Support\Arr;
use Illuminate\Validation\ValidationException;

class AdminProvisioningService
{
    public function __construct(private readonly AdminAuthority $authority, private readonly ProvisioningAudit $audit) {}

    public function create(User $actor, array $data): User
    {
        return $this->authority->mutate($actor, 'admin-accounts.create', $data['current_password'], function () use ($actor, $data): User {
            [$direct, $roles] = $this->grants($actor, $data);
            abort_if(($data['is_super_admin'] ?? false) && ! $actor->is_super_admin, 403);
            $this->uniqueEmail($data['email']);
            $target = User::query()->create([
                'email' => $data['email'], 'password' => $data['password'],
                'role' => UserRole::Admin, 'status' => UserStatus::Active,
            ]);
            $target->forceFill([
                'is_super_admin' => $data['is_super_admin'] ?? false,
                'admin_setup_required' => true, 'admin_email_verification_required' => true,
            ])->save();
            $target->adminProfile()->create($this->profile($data));
            $this->assign($actor, $target, $direct, $roles);
            $this->audit->record($actor, $target, 'admin_created', [], $this->snapshot($target));

            return $target;
        });
    }

    public function update(User $actor, User $target, array $data): User
    {
        return $this->authority->mutate($actor, 'admin-accounts.update', $data['current_password'], function () use ($actor, $target, $data): User {
            $target = User::query()->lockForUpdate()->findOrFail($target->id);
            abort_unless(app(AdminAccountPolicy::class)->manage($actor, $target), 403);
            $this->authority->assertRevision($target->admin_revision, $data['revision']);
            [$direct, $roles] = $this->grants($actor, $data);
            $super = $data['is_super_admin'] ?? $target->is_super_admin;
            abort_if($super !== $target->is_super_admin && ! $actor->is_super_admin, 403);
            abort_if($target->is_initial_admin && ! $super, 403, 'The initial super admin is protected.');
            $this->uniqueEmail($data['email'], $target->id);
            $before = $this->snapshot($target);
            $emailChanged = $target->email !== $data['email'];
            $target->forceFill([
                'email' => $data['email'], 'is_super_admin' => $super,
                'admin_revision' => $target->admin_revision + 1,
                ...($emailChanged ? ['email_verified_at' => null, 'admin_email_verification_required' => true, 'admin_session_version' => $target->admin_session_version + 1] : []),
            ])->save();
            $target->adminProfile()->updateOrCreate([], $this->profile($data));
            $this->assign($actor, $target, $direct, $roles);
            $this->audit->record($actor, $target, 'admin_updated', $before, $this->snapshot($target));

            return $target;
        });
    }

    public function status(User $actor, User $target, string $operation, int $revision, string $currentPassword): User
    {
        return $this->authority->mutate($actor, 'admin-accounts.'.$operation, $currentPassword, function () use ($actor, $target, $operation, $revision): User {
            $target = User::query()->lockForUpdate()->findOrFail($target->id);
            abort_unless(app(AdminAccountPolicy::class)->manage($actor, $target), 403);
            abort_if($target->is_initial_admin, 403, 'The initial super admin is protected.');
            $this->authority->assertRevision($target->admin_revision, $revision);
            abort_unless(match ($operation) {
                'suspend' => $target->status === UserStatus::Active && ! $target->admin_archived_at,
                'restore' => $target->status === UserStatus::Suspended || $target->admin_archived_at,
                'archive' => ! $target->admin_archived_at,
            }, 409, 'This action is unavailable for the current account state.');
            $before = $this->snapshot($target);
            $target->forceFill([
                'status' => match ($operation) {
                    'suspend' => UserStatus::Suspended, 'restore' => UserStatus::Active, 'archive' => UserStatus::Deactivated
                },
                'admin_archived_at' => $operation === 'archive' ? now() : null,
                'admin_session_version' => $target->admin_session_version + 1,
                'admin_revision' => $target->admin_revision + 1,
            ])->save();
            $this->audit->record($actor, $target, 'admin_'.$operation, $before, $this->snapshot($target));

            return $target;
        });
    }

    private function grants(User $actor, array $data): array
    {
        $direct = $this->authority->normalize($data['permissions']);
        $roles = AdminRole::query()->whereIn('id', $data['role_ids'])->get();
        if ($roles->count() !== count(array_unique($data['role_ids']))) {
            throw ValidationException::withMessages(['role_ids' => ['Select valid roles.']]);
        }
        $this->authority->assertGrantable($actor, $this->authority->normalize([
            ...$direct, ...$roles->flatMap(fn ($role) => $role->permissions()->pluck('slug'))->all(),
        ]));

        return [$direct, $roles->modelKeys()];
    }

    private function assign(User $actor, User $target, array $direct, array $roles): void
    {
        $target->permissions()->sync(Permission::query()->whereIn('slug', $direct)->pluck('id')
            ->mapWithKeys(fn ($id) => [$id => ['granted_by' => $actor->id]])->all());
        $target->adminRoles()->sync($roles);
    }

    private function uniqueEmail(string $email, ?string $except = null): void
    {
        if (User::query()->where('role', UserRole::Admin)->where('email', $email)->when($except, fn ($q) => $q->where('id', '!=', $except))->exists()) {
            throw ValidationException::withMessages(['email' => ['This email is already used by an Admin account.']]);
        }
    }

    private function profile(array $data): array
    {
        return Arr::only($data, ['first_name', 'middle_name', 'last_name', 'contact_number']);
    }

    private function snapshot(User $target): array
    {
        return [
            'email' => $target->email, 'status' => $target->status->value,
            'is_super_admin' => $target->is_super_admin, 'archived' => (bool) $target->admin_archived_at,
            'profile' => $target->adminProfile()->first()?->only(['first_name', 'middle_name', 'last_name', 'contact_number']),
            'permissions' => $target->permissions()->pluck('slug')->sort()->values()->all(),
            'role_ids' => $target->adminRoles()->pluck('admin_roles.id')->sort()->values()->all(),
        ];
    }
}
