<?php

return [
    'enabled' => env('HUB_ROUTING_ENABLED', false),
    'max_nodes' => 100,
    'max_edges' => 300,
    'max_hops' => 32,
    'metric_cache_seconds' => 86400,
];
