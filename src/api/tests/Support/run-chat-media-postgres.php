<?php

use Illuminate\Contracts\Console\Kernel;

require dirname(__DIR__, 2).'/vendor/autoload.php';
$app = require dirname(__DIR__, 2).'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
$config = config('database.connections.pgsql');
$name = 'aisley_chat_verify_'.date('YmdHis').'_'.getmypid();
$pdo = new PDO("pgsql:host={$config['host']};port={$config['port']};dbname=postgres", $config['username'], $config['password']);
$pdo->exec('CREATE DATABASE "'.$name.'"');
try {
    foreach (simplexml_load_file('phpunit.xml')->php->env as $entry) {
        putenv((string) $entry['name'].'='.(string) $entry['value']);
    }
    foreach (['DB_CONNECTION' => 'pgsql', 'DB_HOST' => $config['host'], 'DB_PORT' => $config['port'],
        'DB_USERNAME' => $config['username'], 'DB_PASSWORD' => $config['password'], 'DB_DATABASE' => $name,
        'DB_URL' => '', 'CHAT_CONCURRENCY_TEST_DB' => $name] as $key => $value) {
        putenv($key.'='.$value);
    }
    passthru('php artisan test --compact tests/Feature/Messaging/ChatMediaTest.php tests/Feature/Messaging/PostgresChatConcurrencyTest.php', $code);
} finally {
    $pdo->exec('DROP DATABASE "'.$name.'" WITH (FORCE)');
}
exit($code);
