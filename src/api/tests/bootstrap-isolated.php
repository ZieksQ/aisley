<?php

// Run with PHPUnit's --bootstrap option to prohibit environment-file/cache reads.
require __DIR__.'/../vendor/autoload.php';

define('AISLEY_ISOLATED_TESTS', true);

$testStorage = __DIR__.'/../../../node_modules/.cache/transactional-mail-php-'.getmypid();
foreach (['framework/views', 'framework/cache/data', 'framework/sessions', 'logs', 'app/private', 'framework/testing'] as $directory) {
    if (! is_dir($testStorage.'/'.$directory)) {
        mkdir($testStorage.'/'.$directory, 0775, true);
    }
}

$settings = [
    'APP_ENV' => 'testing',
    'APP_KEY' => 'base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
    'APP_CONFIG_CACHE' => __DIR__.'/../storage/framework/isolated-config-'.getmypid().'.php',
    'APP_ROUTES_CACHE' => __DIR__.'/../storage/framework/isolated-routes-'.getmypid().'.php',
    'APP_EVENTS_CACHE' => __DIR__.'/../storage/framework/isolated-events-'.getmypid().'.php',
    'LARAVEL_STORAGE_PATH' => $testStorage,
    'VIEW_COMPILED_PATH' => $testStorage.'/framework/views',
    'DB_CONNECTION' => 'sqlite',
    'DB_DATABASE' => ':memory:',
    'DB_URL' => '',
    'CACHE_STORE' => 'array',
    'SESSION_DRIVER' => 'array',
    'QUEUE_CONNECTION' => 'sync',
    'DB_QUEUE_CONNECTION' => 'sqlite',
    'DB_QUEUE_TABLE' => 'jobs',
    'DB_QUEUE' => 'default',
    'MAIL_MAILER' => 'array',
    'MAIL_SCHEME' => 'smtp',
    'MAIL_HOST' => 'smtp.example.test',
    'MAIL_PORT' => '587',
    'MAIL_USERNAME' => 'synthetic-user',
    'MAIL_PASSWORD' => 'synthetic-password',
    'MAIL_FROM_ADDRESS' => 'sender@example.test',
    'MAIL_FROM_NAME' => 'Aisley Test',
    'MAIL_URL' => '',
    'BCRYPT_ROUNDS' => '4',
    'LOG_CHANNEL' => 'null',
    'BROADCAST_CONNECTION' => 'null',
];

foreach ($settings as $name => $value) {
    putenv($name.'='.$value);
    $_ENV[$name] = $_SERVER[$name] = $value;
}
