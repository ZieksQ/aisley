<?php

namespace App\Http\Controllers\Logistics;

use App\Enums\CourierAffiliationStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Logistics\ListCourierVehiclesRequest;
use App\Http\Resources\Logistics\CourierVehicleSummaryResource;
use App\Models\Vehicle;
use App\Services\Courier\CourierVehicleService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

class CourierVehicleController extends Controller
{
    public function __construct(private readonly CourierVehicleService $vehicles) {}

    public function index(ListCourierVehiclesRequest $request): JsonResponse
    {
        $organization = $request->user()->logisticsOrganization()->with('hub')->first();
        abort_unless($organization?->hub, 403);

        $search = mb_strtolower((string) $request->input('search', ''));
        $query = Vehicle::query()
            ->whereHas('courierProfile.user', fn (Builder $courier) => $courier
                ->where('role', UserRole::Courier->value)
                ->where('status', UserStatus::Active->value)
                ->whereHas('courierLogisticsAffiliation', fn (Builder $affiliation) => $affiliation
                    ->where('logistics_organization_id', $organization->id)
                    ->where('logistics_hub_id', $organization->hub->id)
                    ->where('status', CourierAffiliationStatus::Approved->value)))
            ->with(['courierProfile.user']);

        if ($search !== '') {
            $term = '%'.addcslashes($search, '%_\\').'%';
            $query->where(function (Builder $matching) use ($term): void {
                $matching->whereRaw('LOWER(plate_number) LIKE ? ESCAPE \'\\\'', [$term])
                    ->orWhereHas('courierProfile', fn (Builder $profile) => $profile
                        ->whereRaw('LOWER(first_name) LIKE ? ESCAPE \'\\\'', [$term])
                        ->orWhereRaw('LOWER(middle_name) LIKE ? ESCAPE \'\\\'', [$term])
                        ->orWhereRaw('LOWER(last_name) LIKE ? ESCAPE \'\\\'', [$term])
                        ->orWhereHas('user', fn (Builder $courier) => $courier->whereRaw('LOWER(email) LIKE ? ESCAPE \'\\\'', [$term])));
            });
        }

        $vehicles = $query->orderByDesc('created_at')->orderByDesc('id')
            ->paginate((int) $request->input('per_page', 20))->withQueryString();

        return response()->json([
            'data' => CourierVehicleSummaryResource::collection($vehicles->getCollection())->resolve(),
            'links' => [
                'first' => $vehicles->url(1),
                'last' => $vehicles->url($vehicles->lastPage()),
                'prev' => $vehicles->previousPageUrl(),
                'next' => $vehicles->nextPageUrl(),
            ],
            'meta' => [
                'current_page' => $vehicles->currentPage(),
                'from' => $vehicles->firstItem(),
                'last_page' => $vehicles->lastPage(),
                'per_page' => $vehicles->perPage(),
                'to' => $vehicles->lastItem(),
                'total' => $vehicles->total(),
            ],
        ])->header('Cache-Control', 'private, no-store')->header('Pragma', 'no-cache');
    }

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
