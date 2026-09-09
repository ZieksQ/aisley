<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Http\Requests\Customer\ListNotificationsRequest;
use App\Http\Resources\Customer\CustomerNotificationResource;
use App\Models\User;
use App\Notifications\Customer\OrderStatusChangedNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Facades\DB;

class NotificationController extends Controller
{
    public function index(ListNotificationsRequest $request): JsonResponse
    {
        /** @var User $customer */
        $customer = $request->user();
        $query = $this->notifications($customer);

        $query->when($request->input('status') === 'unread', fn ($query) => $query->whereNull('read_at'))
            ->when($request->input('status') === 'read', fn ($query) => $query->whereNotNull('read_at'))
            ->orderByDesc('created_at')->orderByDesc('id');

        return CustomerNotificationResource::collection(
            $query->paginate((int) $request->input('per_page', 20))->withQueryString(),
        )->response()->header('Cache-Control', 'no-store, private');
    }

    public function show(Request $request, string $notification): JsonResponse
    {
        /** @var User $customer */
        $customer = $request->user();
        /** @var DatabaseNotification $record */
        $record = $this->notifications($customer)->whereKey($notification)->firstOrFail();

        return (new CustomerNotificationResource($record))->response()->header('Cache-Control', 'no-store, private');
    }

    public function markRead(Request $request, string $notification): JsonResponse
    {
        /** @var User $customer */
        $customer = $request->user();
        /** @var DatabaseNotification $record */
        $record = $this->notifications($customer)->whereKey($notification)->firstOrFail();
        if ($record->read_at === null) {
            $record->markAsRead();
        }

        return response()->json(['data' => new CustomerNotificationResource($record->refresh())])
            ->header('Cache-Control', 'no-store, private');
    }

    private function notifications(User $customer)
    {
        $statuses = array_map(fn ($status) => $status->value, OrderStatusChangedNotification::STATUSES);
        $statusExpression = DB::raw(match (DB::getDriverName()) {
            'pgsql' => "(notifications.data::jsonb ->> 'status')",
            'sqlite' => "json_extract(notifications.data, '$.status')",
            default => "JSON_UNQUOTE(JSON_EXTRACT(notifications.data, '$.status'))",
        });

        return $customer->notifications()
            ->whereIn('type', [
                'customer-announcement.published',
                'customer-order.status-changed',
                'customer-promo.ongoing',
            ])
            ->where(function ($query) use ($statuses, $statusExpression): void {
                $query->where('type', '!=', 'customer-order.status-changed')
                    ->orWhere(function ($orders) use ($statuses, $statusExpression): void {
                        $orders->where('type', 'customer-order.status-changed')
                            ->whereIn($statusExpression, $statuses);
                    });
            });
    }
}
