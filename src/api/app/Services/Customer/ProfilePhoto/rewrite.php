<?php

use App\Services\Customer\ProfilePhoto\ImageRewriter;

require __DIR__.'/ImageRewriter.php';

// No application bootstrap, credentials or blob access in this bounded worker.
try {
    if ($argc !== 3) {
        exit(1);
    }
    $bytes = file_get_contents($argv[1], false, null, 0, ImageRewriter::MAX_BYTES);
    if (! is_string($bytes)) {
        exit(1);
    }
    $rewritten = (new ImageRewriter)->rewrite($bytes);
    exit(file_put_contents($argv[2], $rewritten) === strlen($rewritten) ? 0 : 1);
} catch (Throwable) {
    exit(1);
}
