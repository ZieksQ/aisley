<?php

return [
    'auth' => [
        'password_reset_url' => env('SELLER_PASSWORD_RESET_URL', 'http://localhost:5174/reset-password'),
        'password_reset_expire_minutes' => (int) env('SELLER_PASSWORD_RESET_EXPIRE_MINUTES', 60),
        'password_reset_throttle_seconds' => (int) env('SELLER_PASSWORD_RESET_THROTTLE_SECONDS', 60),
    ],
];
