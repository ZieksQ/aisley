<?php

namespace App\Services\Waybills;

use App\Enums\WaybillAccessAction;
use App\Models\User;
use App\Models\Waybill;
use App\Models\WaybillAccessEvent;
use BaconQrCode\Renderer\Image\SvgImageBackEnd;
use BaconQrCode\Renderer\ImageRenderer;
use BaconQrCode\Renderer\RendererStyle\RendererStyle;
use BaconQrCode\Writer;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class WaybillPdfService
{
    /** @param Collection<int, Waybill> $waybills */
    public function response(Collection $waybills, User $actor, string $action, string $disposition = 'attachment'): Response
    {
        abort_if($waybills->isEmpty() || $waybills->count() > 30, 422, 'A waybill PDF must contain between 1 and 30 labels.');
        $renderer = new ImageRenderer(new RendererStyle(320, 4), new SvgImageBackEnd);
        $writer = new Writer($renderer);
        $labels = $waybills->map(function (Waybill $waybill) use ($writer): array {
            $waybill->loadMissing('snapshot');
            $payload = $waybill->snapshot->payload;
            $svg = $writer->writeString($payload['qr_payload']);

            return ['waybill' => $waybill, 'snapshot' => $payload, 'qr' => 'data:image/svg+xml;base64,'.base64_encode($svg)];
        });
        $pdf = Pdf::setOptions([
            'isRemoteEnabled' => false,
            'isPhpEnabled' => false,
            'isJavascriptEnabled' => false,
            'defaultFont' => 'Helvetica',
            'chroot' => resource_path('views/waybills'),
        ])->loadView('waybills.a6', ['labels' => $labels])->setPaper([0, 0, 297.64, 419.53]);
        $bytes = $pdf->output();
        $correlation = request()->header('X-Request-ID');
        if (! is_string($correlation) || ! Str::isUuid($correlation)) {
            $correlation = (string) Str::uuid();
        }
        foreach ($waybills as $waybill) {
            WaybillAccessEvent::create([
                'waybill_id' => $waybill->id, 'actor_id' => $actor->id, 'actor_role' => $actor->role,
                'action' => WaybillAccessAction::from($action), 'correlation_id' => $correlation, 'occurred_at' => now(),
            ]);
        }
        $filename = $waybills->count() === 1 ? 'waybill-'.$waybills->first()->reference.'.pdf' : 'pickup-waybills-'.$waybills->first()->seller_pickup_request_id.'.pdf';

        return response($bytes, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => $disposition.'; filename="'.$filename.'"',
            'Cache-Control' => 'private, no-store, max-age=0',
            'Pragma' => 'no-cache',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }
}
