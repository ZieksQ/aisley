<?php

namespace App\Exceptions\Seller;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

class ProductReviewException extends RuntimeException
{
    public function __construct(
        public readonly string $errorCode,
        string $message,
        public readonly int $status,
        public readonly ?string $field = null,
    ) {
        parent::__construct($message);
    }

    public static function notFound(string $message = 'This Product review is not available.'): self
    {
        return new self('SELLER_PRODUCT_REVIEW_NOT_FOUND', $message, 404);
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
