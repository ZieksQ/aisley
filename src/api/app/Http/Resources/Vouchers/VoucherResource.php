<?php

namespace App\Http\Resources\Vouchers;

use App\Services\Vouchers\VoucherReadService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class VoucherResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return app(VoucherReadService::class)->data($this->resource);
    }
}
