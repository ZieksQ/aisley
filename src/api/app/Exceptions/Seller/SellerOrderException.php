<?php

namespace App\Exceptions\Seller;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

class SellerOrderException extends RuntimeException
{
    public function __construct(
        public readonly string $errorCode,
        string $message,
        public readonly int $status = 409,
    ) {
        parent::__construct($message);
    }

    public static function conflict(string $code, string $message): self
    {
        return new self($code, $message);
    }

    public function render(Request $request): JsonResponse
    {
        return response()->json([
            'code' => $this->errorCode,
            'message' => $this->getMessage(),
        ], $this->status);
    }
}
