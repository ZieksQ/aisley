<?php

return [
    'initial' => [
        'email' => env('INITIAL_LOGISTICS_EMAIL'),
        'password' => env('INITIAL_LOGISTICS_PASSWORD'),
        'first_name' => env('INITIAL_LOGISTICS_FIRST_NAME', 'Aisley'),
        'last_name' => env('INITIAL_LOGISTICS_LAST_NAME', 'Logistics'),
        'contact_number' => env('INITIAL_LOGISTICS_CONTACT_NUMBER', '+639171234569'),
        'birth_date' => env('INITIAL_LOGISTICS_BIRTH_DATE', '1990-01-01'),
        'business_name' => env('INITIAL_LOGISTICS_BUSINESS_NAME', 'Aisley Logistics'),
        'hub_name' => env('INITIAL_LOGISTICS_HUB_NAME', 'Aisley Logistics Operational Hub'),
        'address_line_1' => env('INITIAL_LOGISTICS_ADDRESS_LINE_1', '1 Logistics Center'),
        'address_line_2' => env('INITIAL_LOGISTICS_ADDRESS_LINE_2'),
        'barangay' => env('INITIAL_LOGISTICS_BARANGAY', 'Poblacion'),
        'city_municipality' => env('INITIAL_LOGISTICS_CITY_MUNICIPALITY', 'Makati City'),
        'province' => env('INITIAL_LOGISTICS_PROVINCE', 'Metro Manila'),
        'region' => env('INITIAL_LOGISTICS_REGION', 'National Capital Region (NCR)'),
        'postal_code' => env('INITIAL_LOGISTICS_POSTAL_CODE', '1200'),
    ],

    'auth' => ['password_reset_url' => env('LOGISTICS_PASSWORD_RESET_URL', 'http://localhost:5176/reset-password'), 'password_reset_expire_minutes' => (int) env('LOGISTICS_PASSWORD_RESET_EXPIRE_MINUTES', 60), 'password_reset_throttle_seconds' => (int) env('LOGISTICS_PASSWORD_RESET_THROTTLE_SECONDS', 60)],
    'registration' => ['evidence_disk' => env('LOGISTICS_REGISTRATION_EVIDENCE_DISK') ?: env('FILESYSTEM_DISK', 'local')],
];
