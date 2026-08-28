<?php

namespace App\Http\Resources\Admin;

use Illuminate\Http\Request;

class AuditLogDetailResource extends AuditLogSummaryResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            ...parent::toArray($request),
            'schema_version' => $this->schema_version,
            'changes' => [
                'fields' => $this->changed_fields ?? [],
                'before' => $this->old_values ?? [],
                'after' => $this->new_values ?? [],
            ],
            'metadata' => $this->metadata ?? [],
            'request_context' => [
                'request_id' => $this->request_id,
                'ip_address' => $this->ip_address,
                'user_agent' => $this->user_agent,
            ],
        ];
    }
}
