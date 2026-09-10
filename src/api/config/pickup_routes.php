<?php

return [
    'max_nodes' => 31,
    'daily_matrix_credit_limit' => env('GEOAPIFY_MATRIX_DAILY_CREDIT_LIMIT', 2200),
    'daily_tile_credit_limit' => env('GEOAPIFY_TILE_DAILY_CREDIT_LIMIT', 500),
    'tile_style' => 'osm-carto',
    'tile_max_zoom' => 18,
];
