<?php

return [
    'auth' => [
        'password_reset_url' => env('CUSTOMER_PASSWORD_RESET_URL', 'http://localhost:3000/reset-password'),
        'password_reset_expire_minutes' => (int) env('CUSTOMER_PASSWORD_RESET_EXPIRE_MINUTES', 60),
        'password_reset_throttle_seconds' => (int) env('CUSTOMER_PASSWORD_RESET_THROTTLE_SECONDS', 60),
    ],
];
