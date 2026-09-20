<?php

namespace App\Http\Controllers\Courier;

use App\Http\Controllers\Controller;
use App\Http\Requests\Courier\ListNotificationsRequest;
use App\Http\Requests\Courier\MarkNotificationReadRequest;
use App\Http\Requests\Courier\ShowNotificationRequest;
use App\Http\Resources\Courier\CourierNotificationResource;
use App\Models\User;
use App\Services\Courier\CourierNotificationService;
use Illuminate\Http\JsonResponse;

class NotificationController extends Controller
{
    public function __construct(private readonly CourierNotificationService $notifications) {}

    public function index(ListNotificationsRequest $request): JsonResponse
    {
        /** @var User $courier */
        $courier = $request->user();
        $this->ensureScope($courier);
        $result = $this->notifications->list($courier, $request->status(), $request->limit(), $request->cursor());
        $result['data'] = collect($result['data'])
            ->map(fn (array $item): array => (new CourierNotificationResource($item))->resolve())
            ->all();

        return $this->privateResponse($result);
    }

    public function unreadCount(ShowNotificationRequest $request): JsonResponse
    {
        /** @var User $courier */
        $courier = $request->user();
        $this->ensureScope($courier);

        return $this->privateResponse([
            'data' => ['unread_count' => $this->notifications->query($courier)->whereNull('read_at')->count()],
        ]);
    }

    public function show(ShowNotificationRequest $request, string $notification): JsonResponse
    {
        /** @var User $courier */
        $courier = $request->user();
        $this->ensureScope($courier);
        $record = $this->notifications->query($courier)->whereKey($notification)->firstOrFail();

        return $this->privateResponse([
            'data' => new CourierNotificationResource($this->notifications->project($record, $courier)),
        ]);
    }

    public function markRead(MarkNotificationReadRequest $request, string $notification): JsonResponse
    {
        /** @var User $courier */
        $courier = $request->user();
        $this->ensureScope($courier);
        $record = $this->notifications->markRead($courier, $notification);

        return $this->privateResponse([
            'data' => new CourierNotificationResource($this->notifications->project($record, $courier)),
        ]);
    }

    private function ensureScope(User $courier): void
    {
        abort_unless($this->notifications->scope($courier) !== null, 403, 'This Courier affiliation is unavailable.');
    }

    /** @param array<string, mixed> $payload */
    private function privateResponse(array $payload): JsonResponse
    {
        return response()->json($payload)
            ->header('Cache-Control', 'private, no-store')
            ->header('Pragma', 'no-cache');
    }
}
