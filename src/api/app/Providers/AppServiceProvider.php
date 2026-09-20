<?php

namespace App\Providers;

use App\Events\CustomerOrderStatusChanged;
use App\Events\SellerOrderBecameActionable;
use App\Listeners\SendCustomerOrderStatusNotification;
use App\Listeners\SendSellerOrderActionableNotification;
use App\Models\PersonalAccessToken;
use App\Services\Logistics\Routing\DurationDistanceWeightCalculator;
use App\Services\Logistics\Routing\RouteWeightCalculator;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Event;
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
        $this->app->bind(RouteWeightCalculator::class, DurationDistanceWeightCalculator::class);
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Sanctum::usePersonalAccessTokenModel(PersonalAccessToken::class);
        Event::listen(SellerOrderBecameActionable::class, SendSellerOrderActionableNotification::class);
        Event::listen(CustomerOrderStatusChanged::class, SendCustomerOrderStatusNotification::class);

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

        RateLimiter::for('customer-product-questions', function (Request $request): Limit {
            return Limit::perMinute(5)->by(implode('|', [
                'customer-product-questions',
                $request->user()?->getAuthIdentifier() ?? 'guest',
                $request->ip(),
            ]));
        });

        RateLimiter::for('customer-product-reviews', function (Request $request): Limit {
            return Limit::perMinute(5)->by(implode('|', [
                'customer-product-reviews',
                $request->user()?->getAuthIdentifier() ?? 'guest',
                $request->ip(),
            ]));
        });

        RateLimiter::for('customer-product-review-images', function (Request $request): Limit {
            return Limit::perMinute(20)->by(implode('|', [
                'customer-product-review-images',
                $request->user()?->getAuthIdentifier() ?? 'guest',
                $request->ip(),
            ]));
        });

        RateLimiter::for('seller-product-qa-answer', function (Request $request): Limit {
            return Limit::perMinute(30)->by(implode('|', [
                'seller-product-qa-answer',
                $request->user()?->getAuthIdentifier() ?? 'guest',
                $request->ip(),
            ]));
        });

        RateLimiter::for('courier-account-password', function (Request $request): Limit {
            return Limit::perMinute(5)->by(implode('|', [
                'courier-account-password',
                $request->user()?->getAuthIdentifier() ?? 'guest',
                $request->ip(),
            ]));
        });

        RateLimiter::for('courier-vehicle-documents', function (Request $request): Limit {
            return Limit::perMinute(10)->by(implode('|', [
                'courier-vehicle-documents',
                $request->user()?->getAuthIdentifier() ?? 'guest',
                $request->ip(),
            ]));
        });

        RateLimiter::for('logistics-account-password', function (Request $request): Limit {
            return Limit::perMinute(5)->by(implode('|', [
                'logistics-account-password',
                $request->user()?->getAuthIdentifier() ?? 'guest',
                $request->ip(),
            ]));
        });

        RateLimiter::for('logistics-profile-photo', function (Request $request): Limit {
            return Limit::perMinute(10)->by(implode('|', [
                'logistics-profile-photo',
                $request->user()?->getAuthIdentifier() ?? 'guest',
                $request->ip(),
            ]));
        });

        RateLimiter::for('courier-profile-photo', function (Request $request): Limit {
            return Limit::perMinute(10)->by(implode('|', [
                'courier-profile-photo',
                $request->user()?->getAuthIdentifier() ?? 'guest',
                $request->ip(),
            ]));
        });

        RateLimiter::for('policy-consent-status', function (Request $request): Limit {
            return Limit::perMinute(60)->by(implode('|', [
                'policy-consent-status',
                $request->user()?->getAuthIdentifier() ?? 'guest',
                $request->ip(),
            ]));
        });

        RateLimiter::for('policy-consent-acceptance', function (Request $request): Limit {
            return Limit::perMinute(10)->by(implode('|', [
                'policy-consent-acceptance',
                $request->user()?->getAuthIdentifier() ?? 'guest',
                $request->ip(),
            ]));
        });
    }
}
