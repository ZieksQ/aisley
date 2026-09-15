<?php

namespace App\Http\Controllers\Logistics;

use App\Exceptions\Fulfillment\FulfillmentException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Logistics\BulkSortAtHubRequest;
use App\Http\Requests\Logistics\CloseSortingSessionRequest;
use App\Http\Requests\Logistics\CreateSortingLaneRequest;
use App\Http\Requests\Logistics\OpenSortingSessionRequest;
use App\Http\Requests\Logistics\UpdateSortingLaneRequest;
use App\Models\SortingLane;
use App\Models\SortingSession;
use App\Services\Logistics\SortingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SortingController extends Controller
{
    public function index(Request $request, SortingService $service): JsonResponse
    {
        return $this->json(['data' => $service->overview($request->user())]);
    }

    public function storeLane(CreateSortingLaneRequest $request, SortingService $service): JsonResponse
    {
        return $this->json(['data' => $service->laneProjection($service->createLane($request->user(), $request->validated()))], 201);
    }

    public function updateLane(UpdateSortingLaneRequest $request, SortingLane $lane, SortingService $service): JsonResponse
    {
        return $this->json(['data' => $service->laneProjection($service->updateLane($request->user(), $lane, $request->validated()))]);
    }

    public function laneLabel(Request $request, SortingLane $lane, SortingService $service): Response
    {
        return $service->labelResponse($request->user(), $lane);
    }

    public function openSession(OpenSortingSessionRequest $request, SortingService $service): JsonResponse
    {
        $session = $service->openSession($request->user(), $request->idempotencyKey());

        return $this->json(['data' => $service->sessionProjection($session)], 201);
    }

    public function closeSession(CloseSortingSessionRequest $request, SortingSession $session, SortingService $service): JsonResponse
    {
        $closed = $service->closeSession($request->user(), $session, (int) $request->validated('expected_revision'));

        return $this->json(['data' => $service->sessionProjection($closed)]);
    }

    public function batch(BulkSortAtHubRequest $request, SortingSession $session, SortingService $service): JsonResponse
    {
        $results = collect($request->validated('captures'))->map(function (array $capture) use ($request, $service, $session): array {
            try {
                return $service->processCapture($request->user(), $session, $capture);
            } catch (FulfillmentException $exception) {
                return [
                    'client_id' => $capture['client_id'],
                    'reference' => $capture['reference'],
                    'status' => 'failed',
                    'code' => $exception->errorCode,
                    'message' => $exception->getMessage(),
                ];
            }
        })->values();

        return $this->json([
            'data' => $results,
            'summary' => [
                'sorted' => $results->where('status', 'sorted')->count(),
                'exception' => $results->where('status', 'exception')->count(),
                'failed' => $results->where('status', 'failed')->count(),
            ],
        ]);
    }

    private function json(array $payload, int $status = 200): JsonResponse
    {
        return response()->json($payload, $status)->header('Cache-Control', 'private, no-store');
    }
}
