<?php

namespace App\Services\Admin\RegistrationReview;

use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Enums\ShopStatus;
use App\Enums\UserStatus;
use App\Models\Document;
use App\Models\RegistrationApplication;
use App\Models\Shop;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Validation\ValidationException;

class SellerApprovalValidator
{
    public function __construct(private readonly StoredEvidenceInspector $inspector) {}

    /** @return Collection<int, Document> */
    public function validate(RegistrationApplication $application, ?Shop $shop): Collection
    {
        if ($application->user->status !== UserStatus::Pending) {
            throw ValidationException::withMessages(['shop' => 'Approval requires a pending Seller account.']);
        }
        if ($shop === null || $shop->seller_id !== $application->user_id || $shop->status !== ShopStatus::Pending) {
            throw ValidationException::withMessages(['shop' => 'Approval requires the Seller\'s existing pending Shop.']);
        }

        $documents = $application->documents()->orderBy('id')->lockForUpdate()->get();
        foreach ([DocumentType::GovernmentId->value => 'government_id', DocumentType::BusinessRegistration->value => 'business_permit'] as $type => $field) {
            if (! $documents->contains(fn (Document $document) => $document->getRawOriginal('type') === $type)) {
                throw ValidationException::withMessages([$field => 'Required registration evidence is missing.']);
            }
        }

        foreach ($documents as $document) {
            $field = match ($document->getRawOriginal('type')) {
                DocumentType::GovernmentId->value => 'government_id',
                DocumentType::BusinessRegistration->value => 'business_permit',
                default => 'documents',
            };
            if ($document->user_id !== $application->user_id || $document->registration_application_id !== $application->id
                || DocumentType::tryFrom($document->getRawOriginal('type')) === null
                || ! in_array($document->getRawOriginal('status'), [DocumentStatus::Pending->value, DocumentStatus::Verified->value], true)) {
                throw ValidationException::withMessages([$field => 'Registration evidence must belong to this applicant and application and must not be rejected.']);
            }
            $this->inspector->validate($document, $field);
        }

        return $documents;
    }
}
