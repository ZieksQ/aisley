<?php

require __DIR__.'/bootstrap-isolated.php';

$database = getenv('ADMIN_PROVISIONING_TEST_DATABASE');
$username = getenv('ADMIN_PROVISIONING_TEST_USERNAME');
if (! is_string($database) || ! preg_match('/^aisley_admin_provisioning_verify_[a-z0-9_]+$/', $database)
    || ! is_string($username) || ! preg_match('/^admin_provisioning_verify_[a-z0-9_]+$/', $username)) {
    throw new RuntimeException('Explicit disposable Admin provisioning PostgreSQL configuration required.');
}
foreach ([
    'DB_CONNECTION' => 'pgsql', 'DB_HOST' => '127.0.0.1', 'DB_PORT' => '5436',
    'DB_DATABASE' => $database, 'DB_USERNAME' => $username, 'DB_PASSWORD' => 'SyntheticAdminVerify9',
    'DB_QUEUE_CONNECTION' => 'pgsql',
] as $key => $value) {
    putenv($key.'='.$value);
    $_ENV[$key] = $_SERVER[$key] = $value;
}
