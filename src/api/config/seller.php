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

    'products' => [
        'asset_disk' => env('SELLER_PRODUCT_ASSET_DISK') ?: env('FILESYSTEM_DISK', 'local'),
        'gallery_image_limit' => (int) env('PRODUCT_GALLERY_IMAGE_LIMIT', 10),
        'description_image_limit' => (int) env('PRODUCT_DESCRIPTION_IMAGE_LIMIT', 20),
        'image_max_bytes' => 10 * 1024 * 1024,
        'image_max_edge' => (int) env('PRODUCT_IMAGE_MAX_EDGE', 8000),
        'image_max_pixels' => (int) env('PRODUCT_IMAGE_MAX_PIXELS', 40000000),
        'temp_retention_hours' => (int) env('PRODUCT_UPLOAD_TEMP_RETENTION_HOURS', 24),
        'replacement_retention_hours' => (int) env('PRODUCT_ASSET_REPLACEMENT_RETENTION_HOURS', 24),
        'deletion_retention_days' => min(30, max(7, (int) env('PRODUCT_DELETION_RETENTION_DAYS', 30))),
    ],
];
