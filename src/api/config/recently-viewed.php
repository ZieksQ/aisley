<?php

return [
    'retention_limit' => (int) env('RECENTLY_VIEWED_RETENTION_LIMIT', 50),
    'merge_limit' => (int) env('RECENTLY_VIEWED_MERGE_LIMIT', 12),
    'resolver_limit' => (int) env('RECENTLY_VIEWED_RESOLVER_LIMIT', 12),
    'default_page_size' => (int) env('RECENTLY_VIEWED_DEFAULT_PAGE_SIZE', 20),
    'max_page_size' => (int) env('RECENTLY_VIEWED_MAX_PAGE_SIZE', 50),
    'client_timestamp_max_age_days' => (int) env('RECENTLY_VIEWED_CLIENT_TIMESTAMP_MAX_AGE_DAYS', 365),
];
