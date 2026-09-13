<?php

namespace App\Exceptions\Logistics;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

class HubLocationConflictException extends RuntimeException
{
    /** @param array<string, mixed> $location */
    public function __construct(public readonly array $location)
    {
        parent::__construct('The hub location changed while you were editing it. Reload the latest location before saving again.');
    }

    public function render(Request $request): JsonResponse
    {
        return response()->json([
            'code' => 'HUB_LOCATION_CONFLICT',
            'message' => $this->getMessage(),
            'data' => ['current_location' => $this->location],
        ], 409)->withHeaders([
            'Cache-Control' => 'no-store, private',
            'Pragma' => 'no-cache',
        ]);
    }
}
