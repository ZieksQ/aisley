<?php

namespace App\Exceptions\Customer;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

class ProductQAException extends RuntimeException
{
    public function __construct(
        public readonly string $errorCode,
        string $message,
        public readonly int $status,
        public readonly ?string $field = null,
    ) {
        parent::__construct($message);
    }

    public static function forbidden(string $message = 'You are not allowed to answer this Product question.'): self
    {
        return new self('PRODUCT_QA_FORBIDDEN', $message, 403);
    }

    public static function notFound(string $message = 'This Product question is not available.'): self
    {
        return new self('PRODUCT_QA_NOT_FOUND', $message, 404);
    }

    public static function conflict(string $code, string $message, ?string $field = null): self
    {
        return new self($code, $message, 409, $field);
    }

    public function render(Request $request): JsonResponse
    {
        $payload = [
            'code' => $this->errorCode,
            'message' => $this->getMessage(),
        ];
        if ($this->field !== null) {
            $payload['errors'] = [$this->field => [$this->getMessage()]];
        }

        return response()->json($payload, $this->status);
    }
}
