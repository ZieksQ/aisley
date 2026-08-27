<?php

namespace App\Support;

class SafeHomepageDestination
{
    public static function sanitize(?string $destination): ?string
    {
        if (! is_string($destination)) {
            return null;
        }

        $destination = trim($destination);

        if ($destination === '' || preg_match('/[\x00-\x1F\x7F]/', $destination) === 1) {
            return null;
        }

        if (str_starts_with($destination, '/') && ! str_starts_with($destination, '//')) {
            return $destination;
        }

        $scheme = parse_url($destination, PHP_URL_SCHEME);
        $host = parse_url($destination, PHP_URL_HOST);

        if (! in_array($scheme, ['http', 'https'], true) || ! is_string($host)) {
            return null;
        }

        $allowedHosts = config('homepage.allowed_destination_hosts', []);

        return in_array(strtolower($host), $allowedHosts, true) ? $destination : null;
    }
}
