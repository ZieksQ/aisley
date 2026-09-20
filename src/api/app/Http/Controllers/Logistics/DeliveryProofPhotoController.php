<?php

namespace App\Http\Controllers\Logistics;

use App\Http\Controllers\Controller;
use App\Http\Requests\Logistics\RejectDeliveryPhotoRequest;
use App\Models\ShipmentEvidence;
use App\Services\Logistics\DeliveryProofReviewService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DeliveryProofPhotoController extends Controller
{
    public function reject(RejectDeliveryPhotoRequest $request, string $proof, DeliveryProofReviewService $service): JsonResponse
    {
        $evidence = $service->reject($request->user(), $proof, $request->validated('reason'), (int) $request->validated('expected_revision'));

        return response()->json(['data' => [
            'id' => $evidence->id,
            'status' => $evidence->status->value,
            'rejection_reason' => $evidence->rejection_reason,
            'task_id' => $evidence->delivery_task_id,
        ]])->header('Cache-Control', 'private, no-store');
    }

    public function show(Request $request, string $proof): StreamedResponse
    {
        $org = $request->user()->logisticsOrganization()->with('hub')->firstOrFail();
        $evidence = ShipmentEvidence::query()->whereKey($proof)->where('purpose', 'delivery_proof')->where('type', 'photo')
            ->whereHas('task.shipment', fn ($query) => $query
                ->where('current_logistics_organization_id', $org->id)
                ->where('current_hub_id', $org->hub->id))
            ->firstOrFail();
        abort_unless($evidence->storage_disk && $evidence->storage_path && Storage::disk($evidence->storage_disk)->exists($evidence->storage_path), 404);
        $extension = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'][$evidence->mime_type] ?? 'jpg';

        return Storage::disk($evidence->storage_disk)->response($evidence->storage_path, 'delivery-proof.'.$extension, [
            'Content-Type' => $evidence->mime_type,
            'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
        ], 'inline');
    }
}
