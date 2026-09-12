<?php

namespace App\Exceptions\Logistics;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

class CourierApprovalException extends RuntimeException
{
    /** @param array<string, mixed> $data */
    public function __construct(
        public readonly string $errorCode,
        string $message,
        public readonly int $status = 409,
        public readonly array $data = [],
    ) {
        parent::__construct($message);
    }

    /** @param array<string, mixed> $data */
    public static function conflict(string $code, string $message, array $data = []): self
    {
        return new self($code, $message, 409, $data);
    }

    public function render(Request $request): JsonResponse
    {
        $payload = [
            'code' => $this->errorCode,
            'message' => $this->getMessage(),
        ];

        if ($this->data !== []) {
            $payload['data'] = $this->data;
        }

        return response()->json($payload, $this->status)
            ->header('Cache-Control', 'private, no-store')
            ->header('Pragma', 'no-cache');
    }
}
