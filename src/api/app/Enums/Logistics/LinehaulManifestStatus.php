<?php

namespace App\Enums\Logistics;

enum LinehaulManifestStatus: string
{
    case InTransfer = 'in_transfer';
    case Received = 'received';
}
