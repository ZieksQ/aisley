<?php

namespace App\Http\Middleware\Policy;

use App\Services\PolicyConsentService;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsurePolicyConsent
{
    public function __construct(private readonly PolicyConsentService $service) {}

    /**
     * Require the current shared policy versions before a protected action.
     *
     * The status and acceptance routes intentionally do not use this middleware
     * so an account can always reach the consent screen and complete acceptance.
     *
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        // The auth middleware in front of this middleware normally owns the
        // unauthenticated response. Keep this defensive guard so an accidental
        // route-order change cannot turn the consent middleware into an open
        // pass-through.
        if (! $user) {
            return new JsonResponse([
                'message' => 'Unauthenticated.',
            ], 401);
        }

        $status = $this->service->status($user);

        if ($status['all_required_accepted']) {
            return $next($request);
        }

        $requiredPolicies = collect($status['policies'])
            ->filter(fn (array $policy): bool => $policy['required'] === true)
            ->map(function (array $policy): array {
                $type = $policy['type'];
                $version = $policy['current_version']['version'] ?? null;

                return [
                    'type' => $type,
                    'label' => $policy['label'],
                    'version' => $version,
                    'read_url' => "/api/v1/platform/policies/{$type}",
                    'accept_url' => $version === null
                        ? null
                        : "/api/v1/policy-consent/{$type}/versions/{$version}/accept",
                ];
            })
            ->values()
            ->all();

        return new JsonResponse([
            'code' => 'POLICY_CONSENT_REQUIRED',
            'message' => 'Accept the current Terms of Service and Privacy Policy before continuing.',
            'data' => [
                'required_policies' => $requiredPolicies,
                'status_url' => '/api/v1/policy-consent/status',
            ],
        ], 403, [
            'Cache-Control' => 'private, no-store',
            'Pragma' => 'no-cache',
        ]);
    }
}
