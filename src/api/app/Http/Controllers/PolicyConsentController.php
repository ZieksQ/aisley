<?php

namespace App\Http\Controllers;

use App\Enums\PlatformPolicyType;
use App\Exceptions\PolicyConsentConflict;
use App\Http\Requests\Policy\AcceptPoliciesRequest;
use App\Http\Requests\Policy\AcceptPolicyRequest;
use App\Http\Resources\PolicyAcceptanceResource;
use App\Services\PolicyConsentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PolicyConsentController extends Controller
{
    public function __construct(private readonly PolicyConsentService $service) {}

    public function status(Request $request): JsonResponse
    {
        return response()
            ->json(['data' => $this->service->status($request->user())])
            ->withHeaders($this->privateHeaders());
    }

    public function accept(AcceptPolicyRequest $request, string $type, int $version): JsonResponse
    {
        $policyType = PlatformPolicyType::tryFrom($type);
        abort_unless(in_array($policyType, [PlatformPolicyType::TermsOfService, PlatformPolicyType::PrivacyPolicy], true), 404);

        try {
            $result = $this->service->accept($request->user(), $policyType, $version);
        } catch (PolicyConsentConflict $exception) {
            return response()->json([
                'code' => 'POLICY_VERSION_STALE',
                'message' => $exception->getMessage(),
            ], 409, $this->privateHeaders());
        }

        return response()->json(['data' => (new PolicyAcceptanceResource($result))->resolve()])
            ->withHeaders($this->privateHeaders());
    }

    public function acceptTogether(AcceptPoliciesRequest $request): JsonResponse
    {
        try {
            $result = $this->service->acceptTogether($request->user(), $request->validated('acceptances'));
        } catch (PolicyConsentConflict $exception) {
            return response()->json([
                'code' => 'POLICY_VERSION_STALE',
                'message' => $exception->getMessage(),
            ], 409, $this->privateHeaders());
        }

        return response()->json(['data' => [
            'acceptances' => PolicyAcceptanceResource::collection($result['acceptances'])->resolve(),
            'status' => $result['status'],
        ]])->withHeaders($this->privateHeaders());
    }

    /** @return array<string, string> */
    private function privateHeaders(): array
    {
        return [
            'Cache-Control' => 'private, no-store',
            'Pragma' => 'no-cache',
        ];
    }
}
