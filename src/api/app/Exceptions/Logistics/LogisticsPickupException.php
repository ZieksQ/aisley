<?php

namespace App\Exceptions\Logistics;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

class LogisticsPickupException extends RuntimeException
{
    public function __construct(public readonly string $errorCode, string $message, public readonly int $status = 409)
    {
        parent::__construct($message);
    }

    public function render(Request $request): JsonResponse
    {
        return response()->json(['code' => $this->errorCode, 'message' => $this->getMessage()], $this->status);
    }
}
