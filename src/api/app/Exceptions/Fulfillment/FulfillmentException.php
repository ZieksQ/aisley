<?php

namespace App\Exceptions\Fulfillment;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

class FulfillmentException extends RuntimeException
{
    public function __construct(
        public readonly string $errorCode,
        string $message,
        public readonly int $status = 409,
        public readonly ?string $field = null,
    ) {
        parent::__construct($message);
    }

    public static function notFound(string $code = 'FULFILLMENT_NOT_FOUND', string $message = 'This fulfillment record is not available.'): self
    {
        return new self($code, $message, 404);
    }

    public static function conflict(string $code, string $message): self
    {
        return new self($code, $message, 409);
    }

    public static function invalid(string $code, string $message, ?string $field = null): self
    {
        return new self($code, $message, 422, $field);
    }

    public function render(Request $request): JsonResponse
    {
        $payload = ['code' => $this->errorCode, 'message' => $this->getMessage()];
        if ($this->field !== null) {
            $payload['errors'] = [$this->field => [$this->getMessage()]];
        }

        return response()->json($payload, $this->status)->header('Cache-Control', 'private, no-store');
    }
}
