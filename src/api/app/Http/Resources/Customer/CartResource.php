<?php

namespace App\Http\Resources\Customer;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CartResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $items = $this->items
            ->map(fn ($item) => (new CartItemResource($item))->resolve($request))
            ->values();

        return [
            'id' => $this->id,
            'itemCount' => $items->sum('quantity'),
            'distinctItemCount' => $items->count(),
            'subtotal' => round((float) $items->sum('lineSubtotal'), 2),
            'availableSubtotal' => round((float) $items
                ->filter(fn (array $item) => $item['availability']['isAvailable'])
                ->sum('lineSubtotal'), 2),
            'items' => $items,
        ];
    }

    public function withResponse(Request $request, JsonResponse $response): void
    {
        $response->headers->set('Cache-Control', 'no-store, private');
    }
}
