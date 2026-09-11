<?php

return [
    'required_roles' => [
        'customer',
        'seller',
        'admin',
        'logistics',
        'courier',
    ],

    'required_types' => [
        'terms_of_service',
        'privacy_policy',
    ],

    'initial_acceptance_required' => true,
    'reconsent_required_when_flagged' => true,
];
