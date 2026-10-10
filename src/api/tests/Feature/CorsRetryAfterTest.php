<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Route;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class CorsRetryAfterTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // Isolate origins from deployment-specific environment configuration.
        config(['cors.allowed_origins' => [
            'http://localhost:8765',
            'http://localhost:8766',
            'http://127.0.0.1:8765',
            'http://127.0.0.1:8766',
            'https://storefront.example.test',
        ]]);

        Route::match(['GET', 'POST', 'PATCH'], '/api/v1/cors-regression', fn () => response()
            ->json(['message' => 'Too many requests.'], 429)
            ->header('Retry-After', request()->query('delay', '60')));
    }

    #[DataProvider('approvedResponses')]
    public function test_approved_origins_can_read_retry_after(string $origin, string $delay): void
    {
        $this->withHeader('Origin', $origin)
            ->getJson('/api/v1/cors-regression?'.http_build_query(['delay' => $delay]))
            ->assertTooManyRequests()
            ->assertHeader('Retry-After', $delay)
            ->assertHeader('Access-Control-Allow-Origin', $origin)
            ->assertHeader('Access-Control-Allow-Credentials', 'true')
            ->assertHeader('Access-Control-Expose-Headers', 'Retry-After');
    }

    public static function approvedResponses(): array
    {
        $cases = [];

        foreach ([
            'http://localhost:8765',
            'http://localhost:8766',
            'http://127.0.0.1:8765',
            'http://127.0.0.1:8766',
            'https://storefront.example.test',
        ] as $origin) {
            foreach (['60', 'Wed, 21 Oct 2026 07:28:00 GMT'] as $delay) {
                $cases[] = [$origin, $delay];
            }
        }

        return $cases;
    }

    public function test_unapproved_origin_is_not_authorized(): void
    {
        $this->withHeader('Origin', 'http://localhost:8767')
            ->getJson('/api/v1/cors-regression')
            ->assertTooManyRequests()
            ->assertHeader('Retry-After', '60')
            ->assertHeaderMissing('Access-Control-Allow-Origin')
            ->assertHeaderMissing('Access-Control-Allow-Credentials')
            ->assertHeaderMissing('Access-Control-Expose-Headers');
    }

    public function test_native_request_preserves_retry_after_without_cors_headers(): void
    {
        $this->getJson('/api/v1/cors-regression')
            ->assertTooManyRequests()
            ->assertHeader('Retry-After', '60')
            ->assertHeaderMissing('Access-Control-Allow-Origin')
            ->assertHeaderMissing('Access-Control-Expose-Headers');
    }

    #[DataProvider('preflightRequests')]
    public function test_approved_preflight_allows_bearer_and_idempotency_headers(string $origin, string $method): void
    {
        $this->withHeaders([
            'Origin' => $origin,
            'Access-Control-Request-Method' => $method,
            'Access-Control-Request-Headers' => 'authorization,content-type,idempotency-key',
        ])->options('/api/v1/cors-regression')
            ->assertNoContent()
            ->assertHeader('Access-Control-Allow-Origin', $origin)
            ->assertHeader('Access-Control-Allow-Credentials', 'true')
            ->assertHeader('Access-Control-Allow-Methods', $method)
            ->assertHeader('Access-Control-Allow-Headers', 'authorization,content-type,idempotency-key');
    }

    public static function preflightRequests(): array
    {
        return [
            ['http://localhost:8765', 'POST'],
            ['http://localhost:8765', 'PATCH'],
            ['http://localhost:8766', 'POST'],
            ['http://localhost:8766', 'PATCH'],
        ];
    }

    public function test_unapproved_preflight_does_not_authorize_origin(): void
    {
        $this->withHeaders([
            'Origin' => 'http://localhost:8767',
            'Access-Control-Request-Method' => 'POST',
            'Access-Control-Request-Headers' => 'authorization,idempotency-key',
        ])->options('/api/v1/cors-regression')
            ->assertHeaderMissing('Access-Control-Allow-Origin');
    }
}
