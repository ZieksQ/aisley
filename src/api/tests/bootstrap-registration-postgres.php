<?php

// Explicit disposable test credentials only; never load application environment files.
require __DIR__.'/bootstrap-isolated.php';

$database = getenv('REGISTRATION_TEST_DATABASE');
$username = getenv('REGISTRATION_TEST_USERNAME');
if (! is_string($database) || ! preg_match('/^aisley_courier_registration_verify_[a-z0-9_]+$/', $database)
    || ! is_string($username) || ! preg_match('/^otp_registration_verify_[a-z0-9_]+$/', $username)) {
    throw new RuntimeException('Explicit disposable registration PostgreSQL configuration required.');
}
foreach ([
    'DB_CONNECTION' => 'pgsql', 'DB_HOST' => '127.0.0.1', 'DB_PORT' => '5436',
    'DB_DATABASE' => $database, 'DB_USERNAME' => $username, 'DB_PASSWORD' => 'SyntheticRegistrationTest9',
    'DB_QUEUE_CONNECTION' => 'pgsql', 'COURIER_REGISTRATION_CONCURRENCY_TEST_DB' => $database,
] as $key => $value) {
    putenv($key.'='.$value);
    $_ENV[$key] = $_SERVER[$key] = $value;
}
