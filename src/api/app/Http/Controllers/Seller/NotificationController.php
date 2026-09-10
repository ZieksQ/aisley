<?php

namespace App\Http\Controllers\Seller;

use App\Http\Controllers\Controller;
use App\Http\Requests\Seller\ListNotificationsRequest;
use App\Http\Resources\Seller\SellerNotificationResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;

class NotificationController extends Controller
{
    private const TYPES = [
        'seller-order.actionable',
        'inventory.low-stock',
        'seller-compliance.action',
        'pickup-schedule.assigned',
        'pickup-schedule.revised',
        'pickup-schedule.cancelled',
        'pickup-schedule.reminder',
        'seller-product-qa.question-asked',
    ];

    public function index(ListNotificationsRequest $request): JsonResponse
    {
        /** @var User $seller */
        $seller = $request->user();
        $query = $this->notifications($seller)
            ->when($request->input('status') === 'unread', fn ($query) => $query->whereNull('read_at'))
            ->when($request->input('status') === 'read', fn ($query) => $query->whereNotNull('read_at'))
            ->orderByDesc('created_at')->orderByDesc('id');

        return SellerNotificationResource::collection(
            $query->paginate((int) $request->input('per_page', 20))->withQueryString(),
        )->response()->header('Cache-Control', 'no-store, private');
    }

    public function show(Request $request, string $notification): JsonResponse
    {
        /** @var User $seller */
        $seller = $request->user();
        /** @var DatabaseNotification $record */
        $record = $this->notifications($seller)->whereKey($notification)->firstOrFail();

        return (new SellerNotificationResource($record))->response()->header('Cache-Control', 'no-store, private');
    }

    public function markRead(Request $request, string $notification): JsonResponse
    {
        /** @var User $seller */
        $seller = $request->user();
        /** @var DatabaseNotification $record */
        $record = $this->notifications($seller)->whereKey($notification)->firstOrFail();
        if ($record->read_at === null) {
            $record->markAsRead();
        }

        return response()->json(['data' => new SellerNotificationResource($record->refresh())])
            ->header('Cache-Control', 'no-store, private');
    }

    private function notifications(User $seller)
    {
        return $seller->notifications()->whereIn('type', self::TYPES);
    }
}
