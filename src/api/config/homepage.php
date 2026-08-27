<?php

$storefrontHost = parse_url(
    env('CUSTOMER_STOREFRONT_URL', 'http://localhost:3000'),
    PHP_URL_HOST,
);

$configuredHosts = array_filter(array_map(
    static fn (string $host): string => strtolower(trim($host)),
    explode(',', (string) env('HOMEPAGE_ALLOWED_DESTINATION_HOSTS', '')),
));

return [
    'campaigns' => [
        'hero_limit' => 6,
        'side_limit' => 2,
    ],
    'categories_limit' => 20,
    'flash_deals_limit' => 12,
    'top_products_limit' => 12,
    'recently_viewed_limit' => 12,
    'discovery' => [
        'default_page_size' => (int) env('HOMEPAGE_DISCOVERY_DEFAULT_PAGE_SIZE', 20),
        'min_page_size' => 8,
        'max_page_size' => (int) env('HOMEPAGE_DISCOVERY_MAX_PAGE_SIZE', 50),
    ],
    'low_stock_threshold' => 5,
    'public_cache_seconds' => (int) env('HOMEPAGE_PUBLIC_CACHE_SECONDS', 300),
    'allowed_destination_hosts' => array_values(array_unique(array_filter([
        is_string($storefrontHost) ? strtolower($storefrontHost) : null,
        ...$configuredHosts,
    ]))),
    'quick_actions' => [
        ['key' => 'vouchers', 'label' => 'Vouchers', 'destinationUrl' => '/vouchers'],
        ['key' => 'flash_deals', 'label' => 'Flash Deals', 'destinationUrl' => '/flash-deals'],
        ['key' => 'free_shipping', 'label' => 'Free Shipping', 'destinationUrl' => '/vouchers?type=free-shipping'],
        ['key' => 'top_products', 'label' => 'Top Products', 'destinationUrl' => '/products?sort=top'],
        ['key' => 'new_arrivals', 'label' => 'New Arrivals', 'destinationUrl' => '/products?sort=newest'],
        ['key' => 'shops', 'label' => 'Shops', 'destinationUrl' => '/shops'],
        ['key' => 'categories', 'label' => 'Categories', 'destinationUrl' => '/categories'],
    ],
];
