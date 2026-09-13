<?php

namespace App\Http\Controllers\Logistics;

use App\Http\Controllers\Controller;
use App\Http\Requests\Logistics\ListNotificationsRequest;
use App\Http\Requests\Logistics\MarkNotificationReadRequest;
use App\Http\Resources\Logistics\LogisticsNotificationResource;
use App\Models\User;
use App\Services\Logistics\LogisticsNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Facades\DB;

class NotificationController extends Controller
{
    public function __construct(private readonly LogisticsNotificationService $notifications) {}

    public function index(ListNotificationsRequest $request): JsonResponse
    {
        /** @var User $logistics */
        $logistics = $request->user();
        $this->ensureHub($logistics);
        $query = $this->notifications->query($logistics)
            ->when($request->input('status') === 'unread', fn ($builder) => $builder->whereNull('read_at'))
            ->when($request->input('status') === 'read', fn ($builder) => $builder->whereNotNull('read_at'))
            ->orderByDesc('created_at')
            ->orderByDesc('id');
        $paginator = $query->paginate($request->pageSize())->withQueryString();
        $paginator->setCollection($paginator->getCollection()->map(
            fn (DatabaseNotification $notification): array => $this->notifications->project($notification, $logistics),
        )->values());

        return LogisticsNotificationResource::collection($paginator)
            ->response()
            ->header('Cache-Control', 'private, no-store')
            ->header('Pragma', 'no-cache');
    }

    public function unreadCount(Request $request): JsonResponse
    {
        /** @var User $logistics */
        $logistics = $request->user();
        $this->ensureHub($logistics);

        return response()->json([
            'data' => ['unread_count' => $this->notifications->query($logistics)->whereNull('read_at')->count()],
        ])->header('Cache-Control', 'private, no-store')->header('Pragma', 'no-cache');
    }

    public function show(Request $request, string $notification): JsonResponse
    {
        /** @var User $logistics */
        $logistics = $request->user();
        $this->ensureHub($logistics);
        /** @var DatabaseNotification $record */
        $record = $this->notifications->query($logistics)->whereKey($notification)->firstOrFail();

        return (new LogisticsNotificationResource($this->notifications->project($record, $logistics)))
            ->response()
            ->header('Cache-Control', 'private, no-store')
            ->header('Pragma', 'no-cache');
    }

    public function markRead(MarkNotificationReadRequest $request, string $notification): JsonResponse
    {
        /** @var User $logistics */
        $logistics = $request->user();
        $this->ensureHub($logistics);
        /** @var DatabaseNotification $record */
        $record = DB::transaction(function () use ($logistics, $notification): DatabaseNotification {
            $record = $this->notifications->query($logistics)->whereKey($notification)->lockForUpdate()->firstOrFail();
            if ($record->read_at === null) {
                $record->read_at = now();
                $record->save();
            }

            return $record->fresh();
        }, 3);

        return response()->json(['data' => new LogisticsNotificationResource($this->notifications->project($record, $logistics))])
            ->header('Cache-Control', 'private, no-store')
            ->header('Pragma', 'no-cache');
    }

    private function ensureHub(User $logistics): void
    {
        abort_unless($logistics->logisticsOrganization()->whereHas('hub')->exists(), 403, 'The Logistics organization or hub is unavailable.');
    }
}
