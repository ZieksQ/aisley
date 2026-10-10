<?php

namespace Tests\Support;

use App\Enums\ApplicationStatus;
use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Enums\ShopStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\AdminPermission;
use App\Models\Document;
use App\Models\Permission;
use App\Models\RegistrationApplication;
use App\Models\Shop;
use App\Models\User;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

trait SellerApprovalFixtures
{
    private function pendingSeller(): RegistrationApplication
    {
        $seller = User::factory()->create(['role' => UserRole::Seller, 'status' => UserStatus::Pending]);

        return RegistrationApplication::create([
            'user_id' => $seller->id,
            'application_type' => UserRole::Seller,
            'status' => ApplicationStatus::Pending,
            'submitted_at' => now(),
        ]);
    }

    private function reviewer(): User
    {
        $admin = User::factory()->create(['role' => UserRole::Admin, 'status' => UserStatus::Active]);
        $permission = Permission::firstOrCreate(['slug' => 'registrations.review'], ['name' => 'Review registrations']);
        AdminPermission::create(['admin_id' => $admin->id, 'permission_id' => $permission->id]);

        return $admin;
    }

    private function sellerApprovalEvidence(RegistrationApplication $application): Shop
    {
        config()->set('filesystems.disks.seller-approval-evidence', ['driver' => 'local', 'visibility' => 'private']);
        Storage::fake('seller-approval-evidence');
        $shop = Shop::create([
            'seller_id' => $application->user_id,
            'name' => 'Pending Seller Shop',
            'slug' => 'pending-seller-'.Str::uuid(),
            'status' => ShopStatus::Pending,
        ]);
        foreach ([DocumentType::GovernmentId, DocumentType::BusinessRegistration] as $type) {
            $this->approvalDocument($application, $type);
        }

        return $shop;
    }

    private function approvalDocument(RegistrationApplication $application, DocumentType $type, string $extension = 'png'): Document
    {
        $image = imagecreatetruecolor(2, 2);
        ob_start();
        match ($extension) {
            'jpg' => imagejpeg($image),
            'webp' => imagewebp($image),
            default => imagepng($image),
        };
        $bytes = ob_get_clean();
        imagedestroy($image);
        $path = 'registration-evidence/'.$application->user_id.'/'.Str::uuid().'.'.$extension;
        Storage::disk('seller-approval-evidence')->put($path, $bytes);

        return Document::create([
            'user_id' => $application->user_id,
            'registration_application_id' => $application->id,
            'type' => $type,
            'status' => DocumentStatus::Pending,
            'disk' => 'seller-approval-evidence',
            'path' => $path,
            'original_name' => $type->value.'.'.$extension,
            'mime_type' => (new \finfo(FILEINFO_MIME_TYPE))->buffer($bytes),
            'size_bytes' => strlen($bytes),
            'checksum' => hash('sha256', $bytes),
        ]);
    }
}
