<?php

namespace App\Services;

use App\Enums\PlatformPolicyType;
use App\Enums\PlatformPolicyVersionStatus;
use App\Exceptions\PolicyConsentConflict;
use App\Models\PlatformPolicy;
use App\Models\PlatformPolicyVersion;
use App\Models\PolicyAcceptance;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class PolicyConsentService
{
    /** @var array<int, PlatformPolicyType> */
    private const SHARED_TYPES = [
        PlatformPolicyType::TermsOfService,
        PlatformPolicyType::PrivacyPolicy,
    ];

    /**
     * @return array{policies: array<int, array<string, mixed>>, all_required_accepted: bool}
     */
    public function status(User $user): array
    {
        $policies = $this->sharedPolicies();
        $acceptances = $this->acceptancesFor($user, $policies);

        $projections = $policies->map(function (PlatformPolicy $policy) use ($acceptances): array {
            $current = $policy->currentVersion;
            $policyAcceptances = $acceptances->get($policy->id, collect());
            $exact = $current
                ? $policyAcceptances->firstWhere('platform_policy_version_id', $current->id)
                : null;
            $latest = $policyAcceptances->sortByDesc('accepted_at')->first();
            $hasAcceptedAny = $policyAcceptances->isNotEmpty();
            $requiresAction = $current !== null && (
                (! $hasAcceptedAny && config('policy-consent.initial_acceptance_required', true))
                || (config('policy-consent.reconsent_required_when_flagged', true) && $current->requires_reconsent && ! $exact)
            );

            return [
                'type' => $policy->type->value,
                'label' => $policy->type->label(),
                'required' => $requiresAction,
                'accepted' => $exact !== null,
                'accepted_at' => $exact?->accepted_at?->toIso8601String(),
                'current_version' => $current ? $this->summary($current) : null,
                'accepted_version' => $latest ? [
                    'id' => $latest->version->id,
                    'version' => $latest->version->version,
                    'accepted_at' => $latest->accepted_at?->toIso8601String(),
                ] : null,
            ];
        })->values()->all();

        return [
            'policies' => $projections,
            'all_required_accepted' => ! collect($projections)->contains('required', true),
        ];
    }

    /**
     * @return array{policy: PlatformPolicy, version: PlatformPolicyVersion, acceptance: PolicyAcceptance}
     */
    public function accept(User $user, PlatformPolicyType $type, int $version): array
    {
        if (! in_array($type, self::SHARED_TYPES, true)) {
            throw new PolicyConsentConflict('This policy cannot be accepted through the shared consent flow.');
        }

        return DB::transaction(function () use ($user, $type, $version): array {
            $policy = PlatformPolicy::query()
                ->where('type', $type)
                ->lockForUpdate()
                ->first();

            $current = $policy?->currentVersion;
            if (
                ! $policy
                || ! $current
                || $current->status !== PlatformPolicyVersionStatus::Published
                || $current->version !== $version
            ) {
                throw new PolicyConsentConflict('The requested policy version is no longer current. Refresh the policy and try again.');
            }

            $existing = PolicyAcceptance::query()
                ->where('user_id', $user->id)
                ->where('platform_policy_version_id', $current->id)
                ->with('version')
                ->first();

            if (! $existing) {
                $acceptedAt = now();
                DB::table('policy_acceptances')->insertOrIgnore([
                    'id' => (string) Str::uuid7(),
                    'user_id' => $user->id,
                    'platform_policy_version_id' => $current->id,
                    'accepted_at' => $acceptedAt,
                    'created_at' => $acceptedAt,
                    'updated_at' => $acceptedAt,
                ]);
                $existing = PolicyAcceptance::query()
                    ->where('user_id', $user->id)
                    ->where('platform_policy_version_id', $current->id)
                    ->with('version')
                    ->firstOrFail();
            }

            return [
                'policy' => $policy,
                'version' => $current,
                'acceptance' => $existing,
            ];
        });
    }

    /** @return Collection<int, PlatformPolicy> */
    private function sharedPolicies(): Collection
    {
        return PlatformPolicy::query()
            ->whereIn('type', self::SHARED_TYPES)
            ->with(['currentVersion' => fn ($query) => $query->where('status', PlatformPolicyVersionStatus::Published)])
            ->get()
            ->sortBy(fn (PlatformPolicy $policy) => array_search($policy->type, self::SHARED_TYPES, true))
            ->values();
    }

    /** @return Collection<string, Collection<int, PolicyAcceptance>> */
    private function acceptancesFor(User $user, Collection $policies): Collection
    {
        $policyIds = $policies->pluck('id');
        if ($policyIds->isEmpty()) {
            return collect();
        }

        return PolicyAcceptance::query()
            ->where('user_id', $user->id)
            ->whereHas('version', fn ($query) => $query->whereIn('platform_policy_id', $policyIds))
            ->with('version')
            ->get()
            ->groupBy(fn (PolicyAcceptance $acceptance) => $acceptance->version->platform_policy_id);
    }

    /** @return array<string, mixed> */
    private function summary(PlatformPolicyVersion $version): array
    {
        return [
            'id' => $version->id,
            'version' => $version->version,
            'title' => $version->title,
            'change_summary' => $version->change_summary,
            'requires_reconsent' => $version->requires_reconsent,
            'published_at' => $version->published_at?->toIso8601String(),
        ];
    }
}
