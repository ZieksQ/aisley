<?php

namespace App\Events;

class CustomerOrderStatusChanged
{
    public function __construct(public readonly string $orderStatusEventId) {}
}
