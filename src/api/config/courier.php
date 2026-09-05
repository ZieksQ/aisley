<?php

return ['registration' => ['evidence_disk' => env('COURIER_REGISTRATION_EVIDENCE_DISK') ?: env('FILESYSTEM_DISK', 'local')]];
