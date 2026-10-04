<?php

return [
    'gateway_enabled' => env('FINANCE_GATEWAY_ENABLED', in_array(env('APP_ENV'), ['local', 'testing'], true)),
    'gateway_url' => env('FINANCE_GATEWAY_URL', rtrim(env('APP_URL', 'http://localhost:8000'), '/').'/api/v1/sandbox-gateway'),
    'gateway_key' => env('FINANCE_GATEWAY_KEY', 'local-sandbox-key'),
    'webhook_secret' => env('FINANCE_WEBHOOK_SECRET', 'local-sandbox-webhook-secret'),
    'webhook_url' => env('FINANCE_WEBHOOK_URL', rtrim(env('APP_URL', 'http://localhost:8000'), '/').'/api/v1/finance/gateway/webhook'),
];
