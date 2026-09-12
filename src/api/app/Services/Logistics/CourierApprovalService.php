<?php

namespace App\Services\Logistics;

use App\Enums\ApplicationStatus;
use App\Enums\CourierAffiliationStatus;
use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Exceptions\Logistics\CourierApprovalException;
use App\Models\CourierLogisticsAffiliation;
use App\Models\RegistrationApplication;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class CourierApprovalService
{
    /** @var array<int, DocumentType> */
    private const REQUIRED_DOCUMENT_TYPES = [
        DocumentType::VehicleRegistration,
    ];

    /** @var array<int, DocumentType> */
    private const IDENTITY_DOCUMENT_TYPES = [
        DocumentType::GovernmentId,
        DocumentType::DriversLicense,
    ];

    public function decide(
        CourierLogisticsAffiliation $affiliation,
        User $reviewer,
        bool $approve,
        ?string $reason,
    ): CourierLogisticsAffiliation {
        $result = DB::transaction(function () use ($affiliation, $reviewer, $approve, $reason): CourierLogisticsAffiliation {
            $locked = CourierLogisticsAffiliation::query()
                ->whereKey($affiliation->id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($locked->status !== CourierAffiliationStatus::Pending) {
                throw CourierApprovalException::conflict(
                    'COURIER_APPLICATION_REVIEWED',
                    'This Courier application has already been reviewed. Refresh to see the recorded decision.',
                );
            }

            $organization = $locked->organization()->with('hub')->lockForUpdate()->first();
            $owner = $organization?->user()->lockForUpdate()->first();
            if (! $organization || ! $organization->hub || $owner?->status !== UserStatus::Active) {
                throw CourierApprovalException::conflict(
                    'LOGISTICS_ORGANIZATION_UNAVAILABLE',
                    'The Logistics organization or its operational hub is no longer available.',
                );
            }

            if ($organization->hub->id !== $locked->logistics_hub_id) {
                throw CourierApprovalException::conflict(
                    'LOGISTICS_HUB_CONFLICT',
                    'The Courier affiliation no longer points to the organization\'s current hub.',
                );
            }

            $courier = User::query()->whereKey($locked->courier_id)->lockForUpdate()->firstOrFail();
            if ($courier->role !== UserRole::Courier) {
                throw CourierApprovalException::conflict(
                    'COURIER_ACCOUNT_CONFLICT',
                    'The linked account is no longer a Courier account.',
                );
            }

            $application = RegistrationApplication::query()
                ->where('user_id', $courier->id)
                ->where('application_type', UserRole::Courier)
                ->lockForUpdate()
                ->first();
            if (! $application || $application->status !== ApplicationStatus::Pending) {
                throw CourierApprovalException::conflict(
                    'COURIER_APPLICATION_REVIEWED',
                    'This Courier application has already been reviewed. Refresh to see the recorded decision.',
                );
            }

            if ($approve) {
                $missing = $this->missingRequirements($courier, $application);
                if ($missing !== []) {
                    throw CourierApprovalException::conflict(
                        'COURIER_APPLICATION_INCOMPLETE',
                        'The Courier application is missing required registration information or evidence.',
                        ['missing' => $missing],
                    );
                }

                if (in_array($courier->status, [UserStatus::Suspended, UserStatus::Deactivated, UserStatus::Rejected], true)) {
                    throw CourierApprovalException::conflict(
                        'COURIER_ACCOUNT_STATE_CONFLICT',
                        'The Courier account lifecycle status must be resolved before approval.',
                        ['account_status' => $courier->status->value],
                    );
                }
            }

            $reviewedAt = now();
            $nextAffiliationStatus = $approve ? CourierAffiliationStatus::Approved : CourierAffiliationStatus::Rejected;
            $rejectionReason = $approve ? null : $reason;
            $locked->update([
                'status' => $nextAffiliationStatus,
                'reviewer_id' => $reviewer->id,
                'reviewed_at' => $reviewedAt,
                'rejection_reason' => $rejectionReason,
            ]);
            $application->update([
                'status' => $approve ? ApplicationStatus::Approved : ApplicationStatus::Rejected,
                'reviewer_id' => $reviewer->id,
                'reviewed_at' => $reviewedAt,
                'rejection_reason' => $rejectionReason,
            ]);

            // An independent Admin suspension/deactivation must never be
            // silently overwritten by a Logistics decision.
            if ($approve) {
                $courier->update(['status' => UserStatus::Active]);
            } elseif (! in_array($courier->status, [UserStatus::Suspended, UserStatus::Deactivated], true)) {
                $courier->update(['status' => UserStatus::Rejected]);
                $courier->tokens()->delete();
            }

            $application->documents()->update([
                'status' => $approve ? DocumentStatus::Verified : DocumentStatus::Rejected,
                'reviewer_id' => $reviewer->id,
                'reviewed_at' => $reviewedAt,
                'rejection_reason' => $rejectionReason,
            ]);

            return $locked;
        }, 3);

        return $result->fresh([
            'organization',
            'hub',
            'reviewer.logisticsProfile',
            'courier.courierProfile.vehicles',
            'courier.addresses',
            'courier.registrationApplications.documents',
        ]);
    }

    /** @return array<int, string> */
    public function missingRequirements(User $courier, RegistrationApplication $application): array
    {
        $missing = [];
        $profile = $courier->courierProfile()->first();
        if (! $profile || blank($profile->first_name) || blank($profile->last_name) || blank($profile->contact_number) || ! $profile->birth_date) {
            $missing[] = 'courier_profile';
        }

        $address = $courier->addresses()
            ->orderByDesc('is_default')
            ->orderByDesc('created_at')
            ->first();
        if (! $address || blank($address->address_line_1) || blank($address->barangay) || blank($address->city_municipality) || blank($address->province) || blank($address->region) || blank($address->postal_code)) {
            $missing[] = 'address';
        }

        if (! $profile || ! $profile->vehicles()->where('status', 'active')->exists()) {
            $missing[] = 'vehicle';
        }

        $documents = $application->documents()
            ->whereIn('type', array_map(static fn (DocumentType $type): string => $type->value, [...self::IDENTITY_DOCUMENT_TYPES, ...self::REQUIRED_DOCUMENT_TYPES]))
            ->get();
        $identityDocument = $documents->first(fn ($document): bool => in_array($document->type, self::IDENTITY_DOCUMENT_TYPES, true)
            && $document->status !== DocumentStatus::Rejected
            && filled($document->path));
        if (! $identityDocument) {
            $missing[] = 'identity_document';
        }
        foreach (self::REQUIRED_DOCUMENT_TYPES as $type) {
            $document = $documents->first(fn ($item): bool => $item->type === $type);
            if (! $document || $document->status === DocumentStatus::Rejected || blank($document->path)) {
                $missing[] = $type->value;
            }
        }

        return array_values(array_unique($missing));
    }
}
