<?php

namespace App\Http\Controllers\Logistics;

use App\Http\Controllers\Controller;
use App\Services\Courier\CourierVehicleService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

class CourierVehicleController extends Controller
{
    public function __construct(private readonly CourierVehicleService $vehicles) {}

    public function show(Request $request, string $courier): JsonResponse
    {
        $vehicle = $this->vehicles->vehicleForLogistics($request->user(), $courier);

        return response()->json(['data' => $this->vehicles->projection($vehicle, true)])
            ->header('Cache-Control', 'private, no-store')
            ->header('Pragma', 'no-cache');
    }

    public function document(Request $request, string $courier, string $kind): StreamedResponse|JsonResponse
    {
        abort_unless(in_array($kind, ['official_receipt', 'certificate_of_registration'], true), 404);
        $document = $this->vehicles->documentForLogistics($request->user(), $courier, $kind);
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

    private function unavailable(string $message, int $status): JsonResponse
    {
        return response()->json(['code' => 'VEHICLE_DOCUMENT_UNAVAILABLE', 'message' => $message], $status)
            ->header('Cache-Control', 'private, no-store')
            ->header('Pragma', 'no-cache');
    }
}
