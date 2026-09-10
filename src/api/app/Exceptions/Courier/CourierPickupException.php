<?php

namespace App\Exceptions\Courier;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

class CourierPickupException extends RuntimeException
{
    public function __construct(
        public readonly string $errorCode,
        string $message,
        public readonly int $status,
        public readonly ?string $field = null,
    ) {
        parent::__construct($message);
    }

    public static function conflict(string $code, string $message): self
    {
        return new self($code, $message, 409);
    }

    public static function notFound(): self
    {
        return new self('PICKUP_NOT_AVAILABLE', 'The pickup task or parcel identifier is unavailable.', 404);
    }

    public function render(Request $request): JsonResponse
    {
        $payload = ['code' => $this->errorCode, 'message' => $this->getMessage()];
        if ($this->field !== null) {
            $payload['errors'] = [$this->field => [$this->getMessage()]];
        }

        return response()->json($payload, $this->status)
            ->header('Cache-Control', 'private, no-store');
    }
}
