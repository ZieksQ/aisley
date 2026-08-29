<?php

return [
    'initial' => [
        'email' => env('INITIAL_ADMIN_EMAIL'),
        'password' => env('INITIAL_ADMIN_PASSWORD'),
        'first_name' => env('INITIAL_ADMIN_FIRST_NAME', 'Platform'),
        'last_name' => env('INITIAL_ADMIN_LAST_NAME', 'Administrator'),
    ],
];
