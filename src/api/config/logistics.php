<?php

return [
    'auth' => ['password_reset_url' => env('LOGISTICS_PASSWORD_RESET_URL', 'http://localhost:5176/reset-password'), 'password_reset_expire_minutes' => (int) env('LOGISTICS_PASSWORD_RESET_EXPIRE_MINUTES', 60), 'password_reset_throttle_seconds' => (int) env('LOGISTICS_PASSWORD_RESET_THROTTLE_SECONDS', 60)],
    'registration' => ['evidence_disk' => env('LOGISTICS_REGISTRATION_EVIDENCE_DISK') ?: env('FILESYSTEM_DISK', 'local')],
];
