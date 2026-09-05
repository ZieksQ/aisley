<?php

use App\Http\Middleware\Admin\EnsureActiveAdmin;
use App\Http\Middleware\Admin\EnsureAdminPermission;
use App\Http\Middleware\Customer\EnsureActiveCustomer;
use App\Http\Middleware\Logistics\EnsureActiveLogistics;
use App\Http\Middleware\Seller\EnsureActiveSeller;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Nginx is private to the Cloudflare Tunnel Docker network. Trust its
        // forwarded HTTPS and client-IP headers for the public API hostname.
        $middleware->trustProxies(at: '*');

        $middleware->statefulApi();

        $middleware->alias([
            'admin.active' => EnsureActiveAdmin::class,
            'admin.permission' => EnsureAdminPermission::class,
            'customer.active' => EnsureActiveCustomer::class,
            'seller.active' => EnsureActiveSeller::class,
            'logistics.active' => EnsureActiveLogistics::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();
