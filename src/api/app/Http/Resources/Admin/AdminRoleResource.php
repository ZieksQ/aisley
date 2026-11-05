<?php

namespace App\Http\Resources\Admin;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AdminRoleResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return ['id' => $this->id, 'name' => $this->name, 'revision' => (int) $this->revision,
            'permissions' => $this->permissions->pluck('slug'), 'member_count' => $this->members_count ?? $this->members()->count()];
    }
}
