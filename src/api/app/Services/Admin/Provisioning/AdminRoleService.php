<?php

namespace App\Services\Admin\Provisioning;

use App\Models\AdminRole;
use App\Models\Permission;
use App\Models\User;
use App\Policies\Admin\AdminAccountPolicy;
use Illuminate\Validation\ValidationException;

class AdminRoleService
{
    public function __construct(private readonly AdminAuthority $authority, private readonly ProvisioningAudit $audit) {}

    public function save(User $actor, array $data, ?AdminRole $role = null): AdminRole
    {
        return $this->authority->mutate($actor, $role ? 'admin-accounts.update' : 'admin-accounts.create', $data['current_password'], function () use ($actor, $data, $role): AdminRole {
            $slugs = $this->authority->normalize($data['permissions']);
            $this->authority->assertGrantable($actor, $slugs);
            $before = [];
            if ($role) {
                $role->refresh();
                $this->authority->assertRevision((int) $role->revision, $data['revision']);
                $this->authority->assertGrantable($actor, $role->permissions()->pluck('slug')->all());
                foreach ($role->members()->get() as $member) {
                    abort_unless(app(AdminAccountPolicy::class)->manage($actor, $member), 403, 'This role affects an account outside your authority or your own permissions.');
                }
                $before = ['name' => $role->name, 'permissions' => $role->permissions()->pluck('slug')->all()];
            }
            if (AdminRole::query()->whereRaw('lower(name) = ?', [mb_strtolower($data['name'])])->when($role, fn ($q) => $q->where('id', '!=', $role->id))->exists()) {
                throw ValidationException::withMessages(['name' => ['A role with this name already exists.']]);
            }
            $role ??= new AdminRole;
            $role->name = $data['name'];
            $role->revision = ((int) $role->revision) + 1;
            $role->save();
            $role->permissions()->sync(Permission::query()->whereIn('slug', $slugs)->pluck('id'));
            $role->members()->increment('admin_revision');
            $this->audit->record($actor, $role, 'role_saved', $before, ['name' => $role->name, 'permissions' => $slugs]);

            return $role;
        });
    }

    public function delete(User $actor, AdminRole $role, int $revision, string $currentPassword): void
    {
        $this->authority->mutate($actor, 'admin-accounts.archive', $currentPassword, function () use ($actor, $role, $revision): void {
            $role->refresh();
            $this->authority->assertRevision((int) $role->revision, $revision);
            $this->authority->assertGrantable($actor, $role->permissions()->pluck('slug')->all());
            abort_if($role->members()->exists(), 409, 'Remove all role assignments before deleting this role.');
            $this->audit->record($actor, $role, 'role_deleted', ['name' => $role->name, 'permissions' => $role->permissions()->pluck('slug')->all()]);
            $role->delete();
        });
    }
}
