<?php

return [
    'currency' => env('CHECKOUT_CURRENCY', 'PHP'),
    'quote_ttl_minutes' => (int) env('CHECKOUT_QUOTE_TTL_MINUTES', 15),
    // Logistics selection and zone pricing are deliberately deferred. This is
    // the server-owned MVP quote applied independently to every Shop order.
    'shipping_fee_per_shop' => env('CHECKOUT_SHIPPING_FEE_PER_SHOP', '0.00'),
];
