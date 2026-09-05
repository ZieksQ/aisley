<?php

return [
    'initial' => [
        'email' => env('INITIAL_COURIER_EMAIL'),
        'password' => env('INITIAL_COURIER_PASSWORD'),
        'first_name' => env('INITIAL_COURIER_FIRST_NAME', 'Aisley'),
        'last_name' => env('INITIAL_COURIER_LAST_NAME', 'Courier'),
        'middle_name' => env('INITIAL_COURIER_MIDDLE_NAME'),
        'contact_number' => env('INITIAL_COURIER_CONTACT_NUMBER', '+639171234570'),
        'birth_date' => env('INITIAL_COURIER_BIRTH_DATE', '1995-01-01'),
        'vehicle_type' => env('INITIAL_COURIER_VEHICLE_TYPE', 'motorcycle'),
        'plate_number' => env('INITIAL_COURIER_PLATE_NUMBER', 'AISLEY-001'),
        'address_line_1' => env('INITIAL_COURIER_ADDRESS_LINE_1', '1 Courier Street'),
        'address_line_2' => env('INITIAL_COURIER_ADDRESS_LINE_2'),
        'barangay' => env('INITIAL_COURIER_BARANGAY', 'Poblacion'),
        'city_municipality' => env('INITIAL_COURIER_CITY_MUNICIPALITY', 'Makati City'),
        'province' => env('INITIAL_COURIER_PROVINCE', 'Metro Manila'),
        'region' => env('INITIAL_COURIER_REGION', 'National Capital Region (NCR)'),
        'postal_code' => env('INITIAL_COURIER_POSTAL_CODE', '1200'),
        'logistics_email' => env('INITIAL_COURIER_LOGISTICS_EMAIL'),
    ],
    'generic' => [
        'count' => (int) env('COURIER_GENERIC_COUNT', 20),
        'email_prefix' => env('COURIER_GENERIC_EMAIL_PREFIX', 'courier'),
        'email_domain' => env('COURIER_GENERIC_EMAIL_DOMAIN', 'example.com'),
    ],
    'registration' => ['evidence_disk' => env('COURIER_REGISTRATION_EVIDENCE_DISK') ?: env('FILESYSTEM_DISK', 'local')],
];
