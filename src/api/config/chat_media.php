<?php

return [
    'enabled' => (bool) env('CHAT_MEDIA_ENABLED', false),
    'disk' => env('CHAT_MEDIA_DISK', 'local'),
    'queue' => 'media',
    'ffprobe' => env('CHAT_MEDIA_FFPROBE', 'ffprobe'),
    'ffmpeg' => env('CHAT_MEDIA_FFMPEG', 'ffmpeg'),
    'clamav_host' => env('CHAT_MEDIA_CLAMAV_HOST', 'clamav'),
    'clamav_port' => (int) env('CHAT_MEDIA_CLAMAV_PORT', 3310),
    'max_image_edge' => 8000,
    'max_image_pixels' => 40000000,
    'max_archive_bytes' => 50 * 1024 * 1024,
    'max_archive_entries' => 2000,
];
