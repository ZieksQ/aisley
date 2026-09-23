<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\PreviewNotificationCampaignRequest;
use App\Http\Requests\Admin\SendNotificationCampaignRequest;
use App\Http\Requests\Admin\StoreNotificationCampaignRequest;
use App\Http\Requests\Admin\UpdateNotificationCampaignRequest;
use App\Http\Resources\Admin\NotificationCampaignResource;
use App\Models\NotificationCampaign;
use App\Models\User;
use App\Services\Admin\NotificationCampaignService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationCampaignController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $campaigns = NotificationCampaign::query()->orderByDesc('created_at')->orderByDesc('id')->paginate(20);

        return NotificationCampaignResource::collection($campaigns)->response()->header('Cache-Control', 'private, no-store');
    }

    public function show(Request $request, NotificationCampaign $campaign): JsonResponse
    {
        return (new NotificationCampaignResource($campaign))->response()->header('Cache-Control', 'private, no-store');
    }

    public function store(StoreNotificationCampaignRequest $request, NotificationCampaignService $campaigns): JsonResponse
    {
        /** @var User $admin */
        $admin = $request->user();
        $campaign = $campaigns->create($admin, $request->validated(), $this->context($request));

        return (new NotificationCampaignResource($campaign))->response()->setStatusCode(201)->header('Cache-Control', 'private, no-store');
    }

    public function update(UpdateNotificationCampaignRequest $request, NotificationCampaign $campaign, NotificationCampaignService $campaigns): JsonResponse
    {
        /** @var User $admin */
        $admin = $request->user();
        $updated = $campaigns->update($admin, $campaign, $request->validated(), $this->context($request));

        return (new NotificationCampaignResource($updated))->response()->header('Cache-Control', 'private, no-store');
    }

    public function preview(PreviewNotificationCampaignRequest $request, NotificationCampaign $campaign, NotificationCampaignService $campaigns): JsonResponse
    {
        return response()->json(['data' => $campaigns->preview($campaign, (int) $request->validated('revision'))])
            ->header('Cache-Control', 'private, no-store');
    }

    public function send(SendNotificationCampaignRequest $request, NotificationCampaign $campaign, NotificationCampaignService $campaigns): JsonResponse
    {
        /** @var User $admin */
        $admin = $request->user();
        $sent = $campaigns->send($admin, $campaign, (int) $request->validated('revision'), $request->idempotencyKey(), $this->context($request));

        return (new NotificationCampaignResource($sent))->response()->header('Cache-Control', 'private, no-store');
    }

    private function context(Request $request): array
    {
        return [
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'request_id' => $request->header('X-Request-ID'),
        ];
    }
}
