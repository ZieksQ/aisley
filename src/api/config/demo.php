<?php

return [
    'allow_seeders_in_production' => filter_var(
        env('ALLOW_DEMO_SEEDERS_IN_PRODUCTION', false),
        FILTER_VALIDATE_BOOLEAN,
    ),
];
