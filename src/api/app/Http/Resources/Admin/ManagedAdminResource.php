<?php

namespace App\Http\Resources\Admin;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ManagedAdminResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id, 'email' => $this->email, 'status' => $this->status->value,
            'profile' => $this->adminProfile?->only(['first_name', 'middle_name', 'last_name', 'contact_number']),
            'is_super_admin' => $this->is_super_admin, 'is_initial_admin' => $this->is_initial_admin,
            'archived_at' => $this->admin_archived_at?->toIso8601String(),
            'setup_required' => $this->requiresAdminSetup(),
            'permissions' => $this->effectiveAdminPermissions(),
            'direct_permissions' => $this->permissions()->pluck('slug'),
            'roles' => AdminRoleResource::collection($this->adminRoles()->with('permissions')->get()),
            'revision' => $this->admin_revision,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
