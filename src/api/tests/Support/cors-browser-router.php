<?php

// Synthetic HTTP fixture only: no application bootstrap, .env, database or tokens.
use Fruitcake\Cors\CorsService;
use Illuminate\Config\Repository;
use Illuminate\Container\Container;
use Illuminate\Http\Middleware\HandleCors;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\JsonResponse;

require __DIR__.'/../../vendor/autoload.php';

$container = new Container;
$container->instance('config', new Repository([
    'cors' => require __DIR__.'/../../config/cors.php',
]));
$middleware = new HandleCors($container, new CorsService);
$request = Request::capture();

$middleware->handle($request, function (Request $request): JsonResponse {
    if ($request->path() !== 'api/v1/cors-browser') {
        return new JsonResponse(['message' => 'Not found.'], 404);
    }

    return new JsonResponse(['message' => 'Too many requests.'], 429, [
        'Retry-After' => $request->query('format') === 'date'
            ? 'Wed, 21 Oct 2026 07:28:00 GMT' : '60',
        'X-Unexposed-Fixture' => 'private',
    ]);
})->send();
