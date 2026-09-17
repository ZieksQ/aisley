<?php

namespace App\Exceptions\Courier;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

class CourierVehicleException extends RuntimeException
{
    public function __construct(
        public readonly string $errorCode,
        string $message,
        public readonly int $status = 409,
        public readonly ?string $field = null,
    ) {
        parent::__construct($message);
    }

    public static function notFound(): self
    {
        return new self('VEHICLE_NOT_AVAILABLE', 'The vehicle is unavailable.', 404);
    }

    public static function conflict(string $code, string $message, ?string $field = null): self
    {
        return new self($code, $message, 409, $field);
    }

    public function render(Request $request): JsonResponse
    {
        $payload = ['code' => $this->errorCode, 'message' => $this->getMessage()];
        if ($this->field !== null) {
            $payload['errors'] = [$this->field => [$this->getMessage()]];
        }

        return response()->json($payload, $this->status)
            ->header('Cache-Control', 'private, no-store')
            ->header('Pragma', 'no-cache');
    }
}
