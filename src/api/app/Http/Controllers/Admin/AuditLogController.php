<?php

namespace App\Http\Controllers\Admin;

use App\Enums\Admin\AuditSourceFeature;
use App\Enums\Admin\AuditTargetType;
use App\Enums\AdminAuditAction;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ListAuditLogsRequest;
use App\Http\Resources\Admin\AuditLogDetailResource;
use App\Http\Resources\Admin\AuditLogSummaryResource;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Carbon;

class AuditLogController extends Controller
{
    public function index(ListAuditLogsRequest $request): AnonymousResourceCollection
    {
        $query = AuditLog::query()->with('actor.adminProfile');

        $query
            ->when($request->filled('actor_id'), fn (Builder $query) => $query
                ->where('actor_id', (string) $request->input('actor_id')))
            ->when($request->filled('source_feature'), fn (Builder $query) => $query
                ->where('source_feature', (string) $request->input('source_feature')))
            ->when($request->filled('action'), fn (Builder $query) => $query
                ->where('action', (string) $request->input('action')))
            ->when($request->filled('target_type'), function (Builder $query) use ($request): void {
                $targetType = AuditTargetType::from((string) $request->input('target_type'));
                $query->where('auditable_type', $targetType->modelClass());
            })
            ->when($request->filled('target_id'), fn (Builder $query) => $query
                ->where('auditable_id', (string) $request->input('target_id')));

        if ($request->filled('from')) {
            $query->where('occurred_at', '>=', $this->dateBoundary((string) $request->input('from'), false));
        }

        if ($request->filled('to')) {
            $query->where('occurred_at', '<=', $this->dateBoundary((string) $request->input('to'), true));
        }

        if ($request->filled('search')) {
            $term = '%'.mb_strtolower(trim((string) $request->input('search'))).'%';
            $query->where(function (Builder $query) use ($term): void {
                $query->whereRaw('LOWER(CAST(id AS VARCHAR)) LIKE ?', [$term])
                    ->orWhereRaw('LOWER(action) LIKE ?', [$term])
                    ->orWhereRaw('LOWER(CAST(auditable_id AS VARCHAR)) LIKE ?', [$term])
                    ->orWhereRaw('LOWER(actor_name) LIKE ?', [$term])
                    ->orWhereHas('actor', fn (Builder $actors) => $actors
                        ->whereRaw('LOWER(email) LIKE ?', [$term]));
            });
        }

        $direction = $request->input('sort', 'newest') === 'oldest' ? 'asc' : 'desc';
        $query->orderBy('occurred_at', $direction)->orderBy('id', $direction);

        return AuditLogSummaryResource::collection(
            $query->paginate((int) $request->input('per_page', 20))->withQueryString(),
        );
    }

    public function options(): JsonResponse
    {
        $actorSnapshots = AuditLog::query()
            ->whereNotNull('actor_id')
            ->orderBy('actor_name')
            ->get(['actor_id', 'actor_name'])
            ->unique('actor_id');

        $currentActors = User::query()
            ->where('role', UserRole::Admin)
            ->whereIn('id', $actorSnapshots->pluck('actor_id'))
            ->with('adminProfile')
            ->get()
            ->keyBy('id');

        $actors = $actorSnapshots
            ->map(function (AuditLog $snapshot) use ($currentActors): array {
                /** @var User|null $admin */
                $admin = $currentActors->get($snapshot->actor_id);

                return [
                    'id' => $snapshot->actor_id,
                    'name' => $snapshot->actor_name ?: ($admin ? $this->adminName($admin) : 'Former administrator'),
                    'email' => $admin?->email,
                ];
            })
            ->sortBy('name', SORT_NATURAL | SORT_FLAG_CASE)
            ->values();

        return response()->json([
            'actors' => $actors,
            'source_features' => array_map(fn (AuditSourceFeature $feature) => [
                'value' => $feature->value,
                'label' => $feature->label(),
            ], AuditSourceFeature::cases()),
            'actions' => array_map(fn (AdminAuditAction $action) => [
                'value' => $action->value,
                'label' => $action->label(),
            ], AdminAuditAction::cases()),
            'target_types' => array_map(fn (AuditTargetType $type) => [
                'value' => $type->value,
                'label' => $type->label(),
            ], AuditTargetType::cases()),
        ]);
    }

    public function show(AuditLog $auditLog): JsonResource
    {
        return new AuditLogDetailResource($auditLog->load('actor.adminProfile'));
    }

    private function dateBoundary(string $value, bool $endOfDay): Carbon
    {
        $date = Carbon::parse($value);

        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) === 1) {
            return $endOfDay ? $date->endOfDay() : $date->startOfDay();
        }

        return $date;
    }

    private function adminName(User $admin): string
    {
        $name = trim(implode(' ', array_filter([
            $admin->adminProfile?->first_name,
            $admin->adminProfile?->last_name,
        ])));

        return $name !== '' ? $name : $admin->email;
    }
}
