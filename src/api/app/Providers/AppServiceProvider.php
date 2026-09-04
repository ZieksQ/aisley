<?php

namespace App\Providers;

use App\Models\PersonalAccessToken;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Laravel\Sanctum\Sanctum;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Sanctum::usePersonalAccessTokenModel(PersonalAccessToken::class);

        RateLimiter::for('customer-account-password', function (Request $request): Limit {
            return Limit::perMinute(5)->by(implode('|', [
                'customer-account-password',
                $request->user()?->getAuthIdentifier() ?? 'guest',
                $request->ip(),
            ]));
        });

        RateLimiter::for('customer-profile-photo', function (Request $request): Limit {
            return Limit::perMinute(10)->by(implode('|', [
                'customer-profile-photo',
                $request->user()?->getAuthIdentifier() ?? 'guest',
                $request->ip(),
            ]));
        });
    }
}
