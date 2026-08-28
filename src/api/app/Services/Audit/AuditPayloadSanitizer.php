<?php

namespace App\Services\Audit;

use BackedEnum;
use DateTimeInterface;
use Illuminate\Support\Str;
use SplFileInfo;

class AuditPayloadSanitizer
{
    private const REDACTED = '[REDACTED]';

    private const MAX_STRING_LENGTH = 2000;

    /** @return array<array-key, mixed> */
    public function sanitize(array $payload): array
    {
        return $this->sanitizeArray($payload, 0);
    }

    /** @return array<array-key, mixed> */
    private function sanitizeArray(array $payload, int $depth): array
    {
        if ($depth >= 8) {
            return ['value' => self::REDACTED];
        }

        $sanitized = [];

        foreach ($payload as $key => $value) {
            $sanitized[$key] = is_string($key) && $this->isSensitiveKey($key)
                ? self::REDACTED
                : $this->sanitizeValue($value, $depth + 1);
        }

        return $sanitized;
    }

    private function sanitizeValue(mixed $value, int $depth): mixed
    {
        if (is_array($value)) {
            return $this->sanitizeArray($value, $depth);
        }

        if ($value instanceof BackedEnum) {
            return $value->value;
        }

        if ($value instanceof DateTimeInterface) {
            return $value->format(DATE_ATOM);
        }

        if ($value instanceof SplFileInfo || is_resource($value) || is_object($value)) {
            return self::REDACTED;
        }

        if (is_string($value)) {
            if (str_contains($value, "\0")) {
                return self::REDACTED;
            }

            return Str::limit($value, self::MAX_STRING_LENGTH);
        }

        return is_scalar($value) || $value === null ? $value : self::REDACTED;
    }

    private function isSensitiveKey(string $key): bool
    {
        $normalized = strtolower(preg_replace('/[^a-zA-Z0-9]+/', '_', $key) ?? $key);

        return preg_match(
            '/password|password_hash|token|authorization|cookie|session|remember|secret|api_key|2fa|recovery_code|raw_evidence|file_content|binary|blob/',
            $normalized,
        ) === 1;
    }
}
