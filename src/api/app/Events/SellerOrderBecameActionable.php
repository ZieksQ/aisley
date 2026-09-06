<?php

namespace App\Events;

class SellerOrderBecameActionable
{
    public function __construct(public readonly string $orderId) {}
}
