<?php

namespace Tests\Feature\Mail;

use Illuminate\Support\Facades\Mail;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class SmtpConfigurationTest extends TestCase
{
    public static function schemes(): iterable
    {
        yield 'STARTTLS' => ['smtp', '587', false];
        yield 'implicit TLS' => ['smtps', '465', true];
        yield 'automatic scheme' => ['', '465', true];
    }

    #[DataProvider('schemes')]
    public function test_all_eight_mail_variables_configure_transport_and_sender_without_connecting(string $scheme, string $port, bool $tls): void
    {
        $settings = [
            'MAIL_MAILER' => 'smtp', 'MAIL_SCHEME' => $scheme, 'MAIL_HOST' => 'smtp.example.test',
            'MAIL_PORT' => $port, 'MAIL_USERNAME' => 'synthetic-user', 'MAIL_PASSWORD' => 'synthetic-password',
            'MAIL_FROM_ADDRESS' => 'sender@example.test', 'MAIL_FROM_NAME' => 'Aisley Test',
        ];
        $previous = [];
        try {
            foreach ($settings as $name => $value) {
                $previous[$name] = getenv($name);
                putenv($name.'='.$value);
                $_ENV[$name] = $_SERVER[$name] = $value;
            }
            $mail = require $this->app->configPath('mail.php');
            config()->set('mail', $mail);
            Mail::purge('smtp');
            $transport = Mail::mailer('smtp')->getSymfonyTransport();
            $this->assertSame('smtp', $mail['default']);
            $this->assertSame('smtp.example.test', $transport->getStream()->getHost());
            $this->assertSame((int) $port, $transport->getStream()->getPort());
            $this->assertSame($tls, $transport->getStream()->isTLS());
            $this->assertSame(20.0, $transport->getStream()->getTimeout());
            $this->assertSame('synthetic-user', $transport->getUsername());
            $this->assertSame('synthetic-password', $transport->getPassword());
            $this->assertSame(['address' => 'sender@example.test', 'name' => 'Aisley Test'], $mail['from']);
        } finally {
            foreach ($previous as $name => $value) {
                putenv($value === false ? $name : $name.'='.$value);
                if ($value === false) {
                    unset($_ENV[$name], $_SERVER[$name]);
                } else {
                    $_ENV[$name] = $_SERVER[$name] = $value;
                }
            }
        }
    }
}
