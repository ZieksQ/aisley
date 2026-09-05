<?php

namespace App\Http\Controllers\Admin;

use App\Enums\ApplicationStatus;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ListRegistrationsRequest;
use App\Http\Requests\Admin\RejectRegistrationRequest;
use App\Http\Resources\Admin\RegistrationDetailResource;
use App\Http\Resources\Admin\RegistrationSummaryResource;
use App\Models\Document;
use App\Models\RegistrationApplication;
use App\Models\User;
use App\Services\Admin\RegistrationReviewService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class RegistrationController extends Controller
{
    public function __construct(private readonly RegistrationReviewService $reviewService) {}

    public function index(ListRegistrationsRequest $request): AnonymousResourceCollection
    {
        $status = (string) $request->input('status', ApplicationStatus::Pending->value);
        $sort = (string) $request->input('sort', 'oldest');
        $search = trim((string) $request->input('search', ''));

        $query = RegistrationApplication::query()
            ->whereIn('application_type', [UserRole::Customer, UserRole::Seller, UserRole::Logistics])
            ->where('status', $status)
            ->with(['user.customerProfile', 'user.sellerProfile', 'user.logisticsProfile']);

        if ($request->filled('role')) {
            $query->where('application_type', (string) $request->input('role'));
        }

        if ($search !== '') {
            $term = '%'.mb_strtolower($search).'%';
            $query->where(function (Builder $query) use ($term): void {
                $query->whereHas('user', fn (Builder $users) => $users
                    ->whereRaw('LOWER(email) LIKE ?', [$term]))
                    ->orWhereHas('user.customerProfile', fn (Builder $profiles) => $profiles
                        ->whereRaw('LOWER(first_name) LIKE ?', [$term])
                        ->orWhereRaw('LOWER(last_name) LIKE ?', [$term]))
                    ->orWhereHas('user.sellerProfile', fn (Builder $profiles) => $profiles
                        ->whereRaw('LOWER(first_name) LIKE ?', [$term])
                        ->orWhereRaw('LOWER(last_name) LIKE ?', [$term]))
                    ->orWhereHas('user.logisticsProfile', fn (Builder $profiles) => $profiles
                        ->whereRaw('LOWER(first_name) LIKE ?', [$term])
                        ->orWhereRaw('LOWER(last_name) LIKE ?', [$term]));
            });
        }

        $query->orderBy('submitted_at', $sort === 'newest' ? 'desc' : 'asc');

        return RegistrationSummaryResource::collection(
            $query->paginate((int) $request->input('per_page', 15))->withQueryString(),
        );
    }

    public function show(RegistrationApplication $registration): JsonResource
    {
        $this->ensureManaged($registration);

        return new RegistrationDetailResource($this->loadDetail($registration));
    }

    public function document(RegistrationApplication $registration, Document $document): StreamedResponse
    {
        $this->ensureManaged($registration);
        abort_unless($document->registration_application_id === $registration->id, 404);

        return Storage::disk($document->disk)->download(
            $document->path,
            $document->original_name,
            [
                'Content-Type' => $document->mime_type,
                'Cache-Control' => 'private, no-store',
            ],
        );
    }

    public function approve(Request $request, RegistrationApplication $registration): JsonResource
    {
        /** @var User $reviewer */
        $reviewer = $request->user();

        return new RegistrationDetailResource($this->loadDetail($this->reviewService->decide(
            $registration,
            $reviewer,
            ApplicationStatus::Approved,
            null,
            $request->ip(),
            $request->userAgent(),
            $request->header('X-Request-ID'),
        )));
    }

    public function reject(RejectRegistrationRequest $request, RegistrationApplication $registration): JsonResource
    {
        /** @var User $reviewer */
        $reviewer = $request->user();

        return new RegistrationDetailResource($this->loadDetail($this->reviewService->decide(
            $registration,
            $reviewer,
            ApplicationStatus::Rejected,
            $request->string('reason')->trim()->value() ?: null,
            $request->ip(),
            $request->userAgent(),
            $request->header('X-Request-ID'),
        )));
    }

    private function ensureManaged(RegistrationApplication $registration): void
    {
        abort_unless(
            in_array($registration->application_type, [UserRole::Customer, UserRole::Seller, UserRole::Logistics], true),
            404,
        );
    }

    private function loadDetail(RegistrationApplication $registration): RegistrationApplication
    {
        $this->ensureManaged($registration);

        return $registration->load([
            'user.customerProfile',
            'user.sellerProfile',
            'user.logisticsProfile',
            'user.logisticsOrganization.hub.address',
            'user.addresses',
            'user.shop.shopCategory',
            'documents',
            'reviewer.adminProfile',
        ]);
    }
}
