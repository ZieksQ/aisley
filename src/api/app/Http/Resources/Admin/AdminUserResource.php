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
                'profile_photo_path' => $this->adminProfile?->profile_photo_path,
            ]),
            'permissions' => $this->whenLoaded(
                'permissions',
                fn () => $this->permissions->pluck('slug')->values(),
            ),
        ];
    }
}
