<?php

namespace App\Http\Controllers\Admin;

use App\Enums\AccountLifecycleAction;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ChangeUserLifecycleRequest;
use App\Http\Requests\Admin\ListUsersRequest;
use App\Http\Resources\Admin\AccountLifecycleEventResource;
use App\Http\Resources\Admin\ManagedUserDetailResource;
use App\Http\Resources\Admin\ManagedUserSummaryResource;
use App\Models\User;
use App\Services\Admin\UserAccountLifecycleService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Carbon;

class UserAccountController extends Controller
{
    public function __construct(private readonly UserAccountLifecycleService $lifecycle) {}

    public function index(ListUsersRequest $request): AnonymousResourceCollection
    {
        $query = User::query()
            ->where('role', '!=', UserRole::Admin)
            ->with(['customerProfile', 'sellerProfile', 'courierProfile'])
            ->withMax('lifecycleEvents as status_changed_at', 'occurred_at');

        $query
            ->when($request->filled('role'), fn (Builder $query) => $query->where('role', $request->input('role')))
            ->when($request->filled('status'), fn (Builder $query) => $query->where('status', $request->input('status')))
            ->when($request->filled('from'), fn (Builder $query) => $query->where('created_at', '>=', Carbon::parse((string) $request->input('from'))->startOfDay()))
            ->when($request->filled('to'), fn (Builder $query) => $query->where('created_at', '<=', Carbon::parse((string) $request->input('to'))->endOfDay()));

        if ($request->filled('search')) {
            $term = '%'.mb_strtolower(trim((string) $request->input('search'))).'%';
            $query->where(function (Builder $query) use ($term): void {
                $query->whereRaw('LOWER(CAST(id AS VARCHAR)) LIKE ?', [$term])
                    ->orWhereRaw('LOWER(email) LIKE ?', [$term]);

                foreach (['customerProfile', 'sellerProfile', 'courierProfile'] as $relation) {
                    $query->orWhereHas($relation, fn (Builder $profiles) => $profiles
                        ->whereRaw('LOWER(first_name) LIKE ?', [$term])
                        ->orWhereRaw('LOWER(last_name) LIKE ?', [$term]));
                }
            });
        }

        $direction = $request->input('sort', 'newest') === 'oldest' ? 'asc' : 'desc';

        return ManagedUserSummaryResource::collection(
            $query->orderBy('created_at', $direction)
                ->orderBy('id', $direction)
                ->paginate((int) $request->input('per_page', 20))
                ->withQueryString(),
        );
    }

    public function show(string $user): JsonResource
    {
        $account = $this->managedUser($user)->load([
            'customerProfile',
            'sellerProfile',
            'courierProfile' => fn ($query) => $query->withCount('vehicles'),
            'registrationApplications',
            'shop',
        ]);

        return new ManagedUserDetailResource($account);
    }

    public function history(Request $request, string $user): AnonymousResourceCollection
    {
        $account = $this->managedUser($user);
        $validated = $request->validate([
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:50'],
        ]);
        $perPage = (int) ($validated['per_page'] ?? 20);

        return AccountLifecycleEventResource::collection(
            $account->lifecycleEvents()
                ->with('actor.adminProfile')
                ->orderByDesc('occurred_at')
                ->orderByDesc('id')
                ->paginate($perPage),
        );
    }

    public function suspend(ChangeUserLifecycleRequest $request, string $user): JsonResource
    {
        return $this->change($request, $user, AccountLifecycleAction::Suspended);
    }

    public function restore(ChangeUserLifecycleRequest $request, string $user): JsonResource
    {
        return $this->change($request, $user, AccountLifecycleAction::Restored);
    }

    public function deactivate(ChangeUserLifecycleRequest $request, string $user): JsonResource
    {
        return $this->change($request, $user, AccountLifecycleAction::Deactivated);
    }

    private function change(ChangeUserLifecycleRequest $request, string $user, AccountLifecycleAction $action): JsonResource
    {
        /** @var User $admin */
        $admin = $request->user();
        $account = $this->lifecycle->change(
            target: $this->managedUser($user),
            actor: $admin,
            action: $action,
            expectedStatus: UserStatus::from((string) $request->input('expected_status')),
            reason: $request->filled('reason') ? (string) $request->input('reason') : null,
            confirmation: $request->filled('confirmation') ? (string) $request->input('confirmation') : null,
            ipAddress: $request->ip(),
            userAgent: $request->userAgent(),
            requestId: $request->header('X-Request-ID'),
        );

        $account = $this->managedUser($account->id)->load([
            'customerProfile',
            'sellerProfile',
            'courierProfile' => fn ($query) => $query->withCount('vehicles'),
            'registrationApplications',
            'shop',
        ]);

        return new ManagedUserDetailResource($account);
    }

    private function managedUser(string $id): User
    {
        return User::query()
            ->whereKey($id)
            ->where('role', '!=', UserRole::Admin)
            ->withMax('lifecycleEvents as status_changed_at', 'occurred_at')
            ->firstOrFail();
    }
}
