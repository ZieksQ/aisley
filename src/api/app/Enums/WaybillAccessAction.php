<?php

namespace App\Enums;

enum WaybillAccessAction: string
{
    case View = 'view';
    case Download = 'download';
    case BulkDownload = 'bulk_download';
    case BulkView = 'bulk_view';
    case Resolve = 'resolve';
}
