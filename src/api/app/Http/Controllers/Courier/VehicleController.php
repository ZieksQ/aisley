<?php

namespace App\Http\Controllers\Courier;

use App\Http\Controllers\Controller;
use App\Http\Requests\Courier\UpdateVehicleRequest;
use App\Http\Requests\Courier\UploadVehicleDocumentRequest;
use App\Services\Courier\CourierVehicleService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

class VehicleController extends Controller
{
    public function __construct(private readonly CourierVehicleService $vehicles) {}

    public function show(Request $request): JsonResponse
    {
        return $this->privateResponse(['data' => $this->vehicles->show($request->user())]);
    }

    public function update(UpdateVehicleRequest $request): JsonResponse
    {
        return $this->privateResponse([
            'message' => 'Vehicle updated successfully.',
            'data' => $this->vehicles->update($request->user(), $request->safe()->only(['expected_revision', 'vehicle_type', 'plate_number', 'make', 'model']), $request->idempotencyKey()),
        ]);
    }

    public function upload(UploadVehicleDocumentRequest $request, string $kind): JsonResponse
    {
        $this->assertKind($kind);

        return $this->privateResponse([
            'message' => 'Vehicle document replaced successfully.',
            'data' => $this->vehicles->replaceDocument($request->user(), $kind, $request->file('file'), (int) $request->input('expected_revision'), $request->idempotencyKey()),
        ]);
    }

    public function document(Request $request, string $kind): StreamedResponse|JsonResponse
    {
        $this->assertKind($kind);
        $document = $this->vehicles->documentForCourier($request->user(), $kind);
        try {
            $disk = Storage::disk($document->disk);
            if (! $disk->exists($document->path)) {
                return $this->unavailable('The vehicle document is no longer available.', 404);
            }

            return $disk->response($document->path, $document->original_name, [
                'Content-Type' => $document->mime_type,
                'Cache-Control' => 'private, no-store',
                'Pragma' => 'no-cache',
                'X-Content-Type-Options' => 'nosniff',
            ], 'inline');
        } catch (Throwable $exception) {
            report($exception);

            return $this->unavailable('The vehicle document storage service is unavailable.', 503);
        }
    }

    private function assertKind(string $kind): void
    {
        abort_unless(in_array($kind, ['official_receipt', 'certificate_of_registration'], true), 404);
    }

    /** @param array<string, mixed> $payload */
    private function privateResponse(array $payload): JsonResponse
    {
        return response()->json($payload)
            ->header('Cache-Control', 'private, no-store')
            ->header('Pragma', 'no-cache');
    }

    private function unavailable(string $message, int $status): JsonResponse
    {
        return response()->json(['code' => 'VEHICLE_DOCUMENT_UNAVAILABLE', 'message' => $message], $status)
            ->header('Cache-Control', 'private, no-store')
            ->header('Pragma', 'no-cache');
    }
}
