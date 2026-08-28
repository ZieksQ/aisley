<?php

return [
    'initial' => [
        'email' => env('APPROVED_CUSTOMER_EMAIL'),
        'password' => env('APPROVED_CUSTOMER_PASSWORD'),
        'first_name' => env('APPROVED_CUSTOMER_FIRST_NAME', 'Aisley'),
        'last_name' => env('APPROVED_CUSTOMER_LAST_NAME', 'Customer'),
        'contact_number' => env('APPROVED_CUSTOMER_CONTACT_NUMBER', '+639171234567'),
        'birth_date' => env('APPROVED_CUSTOMER_BIRTH_DATE', '2000-01-01'),
    ],

    'auth' => [
        'password_reset_url' => env('CUSTOMER_PASSWORD_RESET_URL', 'http://localhost:3000/reset-password'),
        'password_reset_expire_minutes' => (int) env('CUSTOMER_PASSWORD_RESET_EXPIRE_MINUTES', 60),
        'password_reset_throttle_seconds' => (int) env('CUSTOMER_PASSWORD_RESET_THROTTLE_SECONDS', 60),
    ],
];
