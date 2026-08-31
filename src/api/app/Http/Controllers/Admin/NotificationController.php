<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ListNotificationsRequest;
use App\Http\Resources\Admin\AdminNotificationResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Notifications\DatabaseNotification;

class NotificationController extends Controller
{
    public function index(ListNotificationsRequest $request): AnonymousResourceCollection
    {
        /** @var User $admin */
        $admin = $request->user();
        $query = $admin->notifications();

        $query
            ->when($request->input('status') === 'unread', fn ($query) => $query->whereNull('read_at'))
            ->when($request->input('status') === 'read', fn ($query) => $query->whereNotNull('read_at'))
            ->when($request->filled('type'), fn ($query) => $query->where('type', (string) $request->input('type')))
            ->orderByDesc('created_at')
            ->orderByDesc('id');

        return AdminNotificationResource::collection(
            $query->paginate((int) $request->input('per_page', 20))->withQueryString(),
        );
    }

    public function unreadCount(Request $request): JsonResponse
    {
        /** @var User $admin */
        $admin = $request->user();

        return response()->json([
            'unread_count' => $admin->unreadNotifications()->count(),
        ]);
    }

    public function markRead(Request $request, string $notification): JsonResponse
    {
        /** @var User $admin */
        $admin = $request->user();
        /** @var DatabaseNotification $record */
        $record = $admin->notifications()->whereKey($notification)->firstOrFail();

        if ($record->read_at === null) {
            $record->markAsRead();
        }

        return response()->json([
            'message' => 'Notification marked as read.',
            'data' => new AdminNotificationResource($record->refresh()),
        ]);
    }

    public function markAllRead(Request $request): JsonResponse
    {
        /** @var User $admin */
        $admin = $request->user();
        $updated = $admin->unreadNotifications()->update(['read_at' => now()]);

        return response()->json([
            'message' => 'All notifications marked as read.',
            'updated_count' => $updated,
        ]);
    }
}
