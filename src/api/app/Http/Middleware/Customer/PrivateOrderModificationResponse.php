<?php

namespace App\Http\Middleware\Customer;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class PrivateOrderModificationResponse
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);
        if ($request->is('api/v1/customer/orders/*/modification*')) {
            $response->headers->set('Cache-Control', 'no-store, private');
        }

        return $response;
    }
}
