<?php

namespace App\Http\Resources\Seller;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SellerDashboardResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'version' => $this['version'],
            'code' => $this['code'],
            'shop' => $this['shop'],
            'period' => $this['period'],
            'sections' => $this['sections'],
            'actions' => $this['actions'],
            'generated_at' => $this['generated_at'],
        ];
    }
}
