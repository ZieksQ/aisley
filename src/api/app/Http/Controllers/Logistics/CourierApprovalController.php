<?php

namespace App\Http\Controllers\Logistics;

use App\Enums\CourierAffiliationStatus;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\Logistics\DecideCourierApplicationRequest;
use App\Http\Requests\Logistics\ListCourierApplicationsRequest;
use App\Http\Resources\Logistics\CourierApplicationDetailResource;
use App\Http\Resources\Logistics\CourierApplicationSummaryResource;
use App\Models\CourierLogisticsAffiliation;
use App\Models\Document;
use App\Services\Logistics\CourierApprovalService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class CourierApprovalController extends Controller
{
    public function __construct(private readonly CourierApprovalService $approval) {}

    public function index(ListCourierApplicationsRequest $request): JsonResponse
    {
        $org = $request->user()->logisticsOrganization;
        abort_unless($org, 403);

        $query = CourierLogisticsAffiliation::query()
            ->where('logistics_organization_id', $org->id)
            ->where('status', CourierAffiliationStatus::Pending->value)
            ->with(['courier.courierProfile.vehicles', 'courier.addresses', 'courier.registrationApplications.documents']);

        if ($request->filled('search')) {
            $term = '%'.mb_strtolower(trim((string) $request->input('search'))).'%';
            $query->whereHas('courier', function (Builder $courier) use ($term): void {
                $courier
                    ->whereRaw('LOWER(email) LIKE ?', [$term])
                    ->orWhereHas('courierProfile', fn (Builder $profile) => $profile
                        ->whereRaw('LOWER(first_name) LIKE ?', [$term])
                        ->orWhereRaw('LOWER(last_name) LIKE ?', [$term]));
            });
        }

        $applications = $query
            ->orderBy('created_at')
            ->orderBy('id')
            ->paginate((int) $request->input('per_page', 20))
            ->withQueryString();

        return response()->json([
            'data' => CourierApplicationSummaryResource::collection($applications->getCollection())->resolve(),
            'links' => [
                'first' => $applications->url(1),
                'last' => $applications->url($applications->lastPage()),
                'prev' => $applications->previousPageUrl(),
                'next' => $applications->nextPageUrl(),
            ],
            'meta' => [
                'current_page' => $applications->currentPage(),
                'from' => $applications->firstItem(),
                'last_page' => $applications->lastPage(),
                'per_page' => $applications->perPage(),
                'to' => $applications->lastItem(),
                'total' => $applications->total(),
            ],
        ])->header('Cache-Control', 'private, no-store')->header('Pragma', 'no-cache');
    }

    public function show(Request $request, CourierLogisticsAffiliation $affiliation): JsonResponse
    {
        $this->ensureOrganizationScope($request, $affiliation);
        $detail = $this->loadDetail($affiliation);

        return response()->json(['data' => (new CourierApplicationDetailResource($detail))->resolve()])
            ->header('Cache-Control', 'private, no-store')
            ->header('Pragma', 'no-cache');
    }

    public function document(Request $request, CourierLogisticsAffiliation $affiliation, Document $document): StreamedResponse|JsonResponse
    {
        $this->ensureOrganizationScope($request, $affiliation);
        $this->ensureDocumentScope($affiliation, $document);

        if (! filled($document->path)) {
            return response()->json(['code' => 'EVIDENCE_UNAVAILABLE', 'message' => 'This document has no stored evidence.'], 404)
                ->header('Cache-Control', 'private, no-store')
                ->header('Pragma', 'no-cache');
        }

        try {
            $disk = Storage::disk($document->disk);
            if (! $disk->exists($document->path)) {
                return response()->json(['code' => 'EVIDENCE_UNAVAILABLE', 'message' => 'This document is no longer available.'], 404)
                    ->header('Cache-Control', 'private, no-store')
                    ->header('Pragma', 'no-cache');
            }

            Log::info('Logistics reviewed Courier registration evidence.', [
                'actor_id' => $request->user()->id,
                'affiliation_id' => $affiliation->id,
                'document_id' => $document->id,
                'document_type' => $document->type?->value,
                'request_id' => $request->header('X-Request-ID'),
            ]);

            return $disk->response($document->path, $document->original_name, [
                'Content-Type' => $document->mime_type,
                'Cache-Control' => 'private, no-store',
                'Pragma' => 'no-cache',
            ], 'inline');
        } catch (\Throwable $exception) {
            report($exception);

            return response()->json(['code' => 'EVIDENCE_UNAVAILABLE', 'message' => 'The document storage service is unavailable.'], 503)
                ->header('Cache-Control', 'private, no-store')
                ->header('Pragma', 'no-cache');
        }
    }

    public function decide(DecideCourierApplicationRequest $request, CourierLogisticsAffiliation $affiliation, string $decision): JsonResponse
    {
        abort_unless(in_array($decision, ['approve', 'reject'], true), 404);
        $this->ensureOrganizationScope($request, $affiliation);
        $reviewed = $this->approval->decide(
            affiliation: $affiliation,
            reviewer: $request->user(),
            approve: $decision === 'approve',
            reason: $request->filled('reason') ? (string) $request->input('reason') : null,
        );

        return response()->json([
            'message' => $decision === 'approve' ? 'Courier approved.' : 'Courier rejected.',
            'data' => (new CourierApplicationDetailResource($reviewed))->resolve(),
        ])->header('Cache-Control', 'private, no-store')->header('Pragma', 'no-cache');
    }

    private function ensureOrganizationScope(Request $request, CourierLogisticsAffiliation $affiliation): void
    {
        $organization = $request->user()->logisticsOrganization;
        abort_unless($organization && $affiliation->logistics_organization_id === $organization->id, 404);
    }

    private function ensureDocumentScope(CourierLogisticsAffiliation $affiliation, Document $document): void
    {
        $application = $affiliation->courier?->registrationApplications()
            ->where('application_type', UserRole::Courier)
            ->first();
        abort_unless($application && $document->registration_application_id === $application->id && $document->user_id === $affiliation->courier_id, 404);
    }

    private function loadDetail(CourierLogisticsAffiliation $affiliation): CourierLogisticsAffiliation
    {
        return $affiliation->load([
            'organization',
            'hub',
            'reviewer.logisticsProfile',
            'courier.courierProfile.vehicles',
            'courier.addresses',
            'courier.registrationApplications.documents',
        ]);
    }
}
