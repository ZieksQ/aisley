<?php

namespace App\Http\Resources\Admin;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AdminUserResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'email' => $this->email,
            'role' => $this->role->value,
            'status' => $this->status->value,
            'profile' => $this->whenLoaded('adminProfile', fn () => [
                'first_name' => $this->adminProfile?->first_name,
                'last_name' => $this->adminProfile?->last_name,
                'profile_photo_url' => $this->adminProfile?->profile_photo_path
                    ? '/api/v1/admin/account/profile-photo?v='.$this->adminProfile->updated_at?->getTimestamp()
                    : null,
            ]),
            'permissions' => $this->effectiveAdminPermissions(),
            'roles' => $this->adminRoles()->get(['admin_roles.id', 'name'])->map(fn ($role) => ['id' => $role->id, 'name' => $role->name]),
            'is_super_admin' => $this->is_super_admin,
            'is_initial_admin' => $this->is_initial_admin,
            'setup_required' => $this->requiresAdminSetup(),
            'password_change_required' => $this->admin_setup_required,
            'email_verification_required' => $this->admin_email_verification_required,
        ];
    }
}
