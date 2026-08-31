<?php

return [
    'initial' => [
        'email' => env('INITIAL_SELLER_EMAIL'),
        'password' => env('INITIAL_SELLER_PASSWORD'),
        'first_name' => env('INITIAL_SELLER_FIRST_NAME', 'Aisley'),
        'last_name' => env('INITIAL_SELLER_LAST_NAME', 'Catalog'),
        'contact_number' => env('INITIAL_SELLER_CONTACT_NUMBER', '+639171234568'),
        'birth_date' => env('INITIAL_SELLER_BIRTH_DATE', '1995-01-01'),
    ],

    'auth' => [
        'password_reset_url' => env('SELLER_PASSWORD_RESET_URL', 'http://localhost:5174/reset-password'),
        'password_reset_expire_minutes' => (int) env('SELLER_PASSWORD_RESET_EXPIRE_MINUTES', 60),
        'password_reset_throttle_seconds' => (int) env('SELLER_PASSWORD_RESET_THROTTLE_SECONDS', 60),
    ],

    'registration' => [
        'evidence_disk' => env('SELLER_REGISTRATION_EVIDENCE_DISK') ?: env('FILESYSTEM_DISK', 'local'),
    ],
];
