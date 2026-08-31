<?php

namespace App\Http\Resources\Admin;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AdminNotificationResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $data = is_array($this->data) ? $this->data : [];

        return [
            'id' => $this->id,
            'type' => $this->type,
            'title' => $this->safeString($data, 'title', 'Notification'),
            'summary' => $this->safeString($data, 'summary', 'An update is available.'),
            'resource_type' => $this->nullableString($data, 'resource_type'),
            'resource_id' => $this->nullableString($data, 'resource_id'),
            'destination' => $this->safeDestination($data['destination'] ?? null),
            'read_at' => $this->read_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }

    /** @param array<string, mixed> $data */
    private function safeString(array $data, string $key, string $fallback): string
    {
        $value = $data[$key] ?? null;

        return is_string($value) && $value !== '' ? mb_substr($value, 0, 240) : $fallback;
    }

    /** @param array<string, mixed> $data */
    private function nullableString(array $data, string $key): ?string
    {
        $value = $data[$key] ?? null;

        return is_string($value) && $value !== '' ? mb_substr($value, 0, 160) : null;
    }

    private function safeDestination(mixed $destination): ?string
    {
        if (! is_string($destination) || ! str_starts_with($destination, '/') || str_starts_with($destination, '//')) {
            return null;
        }

        foreach (['/registrations/', '/audit-logs/', '/platform-settings', '/account', '/dashboard'] as $allowedPrefix) {
            if (str_starts_with($destination, $allowedPrefix)) {
                return $destination;
            }
        }

        return null;
    }
}
