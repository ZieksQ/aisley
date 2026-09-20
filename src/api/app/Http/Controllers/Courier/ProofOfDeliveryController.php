<?php

namespace App\Http\Controllers\Courier;

use App\Http\Controllers\Controller;
use App\Http\Requests\Courier\DeliveryPhotoRequest;
use App\Models\ShipmentEvidence;
use App\Services\Courier\DeliveryPhotoService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ProofOfDeliveryController extends Controller
{
    public function store(DeliveryPhotoRequest $request, string $task, DeliveryPhotoService $service): JsonResponse
    {
        $evidence = $service->submit($request->user(), $task, $request->file('photo'), (int) $request->validated('expected_revision'), $request->idempotencyKey());

        return response()->json(['data' => [
            'task_id' => $evidence->delivery_task_id,
            'proof_id' => $evidence->id,
            'evidence_status' => $evidence->status->value,
            'custody_state' => $evidence->task->status->value,
            'completion_eligible' => false,
            'submitted_at' => $evidence->submitted_at->toISOString(),
        ]], 202)->header('Cache-Control', 'private, no-store');
    }

    public function photo(Request $request, string $proof): StreamedResponse
    {
        $evidence = ShipmentEvidence::query()->whereKey($proof)->where('courier_id', $request->user()->id)
            ->where('purpose', 'delivery_proof')->where('type', 'photo')
            ->whereHas('task.shipment', function ($query) use ($request): void {
                $affiliation = $request->user()->courierLogisticsAffiliation()->firstOrFail();
                $query->where('current_logistics_organization_id', $affiliation->logistics_organization_id)
                    ->where('current_hub_id', $affiliation->logistics_hub_id);
            })->firstOrFail();
        abort_unless($evidence->storage_disk && $evidence->storage_path && Storage::disk($evidence->storage_disk)->exists($evidence->storage_path), 404);

        return Storage::disk($evidence->storage_disk)->response($evidence->storage_path, 'delivery-proof.'.$this->extension($evidence->mime_type), [
            'Content-Type' => $evidence->mime_type,
            'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
        ], 'inline');
    }

    private function extension(string $mime): string
    {
        return ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'][$mime] ?? 'jpg';
    }
}
