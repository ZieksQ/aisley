<?php

namespace Tests\Feature\Admin;

use App\Enums\ApplicationStatus;
use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Enums\ShopStatus;
use App\Enums\UserStatus;
use App\Models\Document;
use App\Notifications\Admin\RegistrationDecisionNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\SellerApprovalFixtures;
use Tests\TestCase;

class SellerRegistrationApprovalTest extends TestCase
{
    use RefreshDatabase, SellerApprovalFixtures;

    #[DataProvider('invalidApplications')]
    public function test_invalid_application_is_not_partially_approved(string $defect, string $field): void
    {
        Notification::fake();
        $admin = $this->reviewer();
        $application = $this->pendingSeller();
        $shop = $this->sellerApprovalEvidence($application);
        $id = $application->documents()->where('type', DocumentType::GovernmentId)->firstOrFail();
        $permit = $application->documents()->where('type', DocumentType::BusinessRegistration)->firstOrFail();

        switch ($defect) {
            case 'no_shop':
                $shop->delete();
                break;
            case 'foreign_shop':
                $shop->update(['seller_id' => $this->pendingSeller()->user_id]);
                break;
            case 'active_shop':
                $shop->update(['status' => ShopStatus::Active]);
                break;
            case 'suspended_seller':
                $application->user->update(['status' => UserStatus::Suspended]);
                break;
            case 'no_id':
                $id->delete();
                break;
            case 'no_permit':
                $permit->delete();
                break;
            case 'no_evidence':
                $application->documents()->delete();
                break;
            case 'invalid_permit':
                $this->replaceBytes($permit, $this->pngHeader(2, 2));
                break;
            case 'foreign_owner':
                $id->update(['user_id' => $this->pendingSeller()->user_id]);
                break;
            case 'foreign_application':
                $id->update(['registration_application_id' => $this->pendingSeller()->id]);
                break;
            case 'foreign_extra':
                $extra = $this->approvalDocument($application, DocumentType::Other);
                $extra->update(['user_id' => $this->pendingSeller()->user_id]);
                break;
            case 'rejected':
                $id->update(['status' => DocumentStatus::Rejected]);
                break;
            case 'invalid_type':
                DB::table('documents')->where('id', $this->approvalDocument($application, DocumentType::Other)->id)->update(['type' => 'invalid']);
                break;
            case 'invalid_status':
                DB::table('documents')->where('id', $id->id)->update(['status' => 'invalid']);
                break;
            case 'missing_file':
                Storage::disk($id->disk)->delete($id->path);
                break;
            case 'missing_disk':
                $id->update(['disk' => 'not-configured']);
                break;
            case 'storage_error':
                Storage::shouldReceive('disk')->with($id->disk)->andThrow(new \RuntimeException('secret storage details'));
                break;
            case 'public_disk':
                $id->update(['disk' => 'public']);
                break;
            case 'path_traversal':
                $id->update(['path' => '../secret.png']);
                break;
            case 'absolute_path':
                $id->update(['path' => '/secret.png']);
                break;
            case 'size_mismatch':
                $id->update(['size_bytes' => $id->size_bytes + 1]);
                break;
            case 'mime_mismatch':
                $id->update(['mime_type' => 'image/jpeg']);
                break;
            case 'extension_mismatch':
                $id->update(['original_name' => 'id.jpg']);
                break;
            case 'double_extension':
                $id->update(['original_name' => 'id.png.php']);
                break;
            case 'checksum_mismatch':
                $id->update(['checksum' => str_repeat('0', 64)]);
                break;
            case 'empty':
                $this->replaceBytes($id, '');
                break;
            case 'spoofed':
                $this->replaceBytes($id, 'not an image');
                break;
            case 'truncated_png':
                $this->replaceBytes($id, $this->pngHeader(2, 2));
                break;
            case 'truncated_jpeg':
            case 'truncated_webp':
                $id->delete();
                $id = $this->approvalDocument($application, DocumentType::GovernmentId, $defect === 'truncated_jpeg' ? 'jpg' : 'webp');
                $this->replaceBytes($id, substr(Storage::disk($id->disk)->get($id->path), 0, -10));
                break;
            case 'edge_limit':
                $this->replaceBytes($id, $this->pngHeader(8001, 1));
                break;
            case 'pixel_limit':
                $this->replaceBytes($id, $this->pngHeader(8000, 5001));
                break;
            case 'exact_byte_limit':
            case 'over_byte_limit':
                $bytes = Storage::disk($id->disk)->get($id->path);
                $this->replaceBytes($id, str_pad($bytes, 10 * 1024 * 1024 + ($defect === 'over_byte_limit' ? 1 : 0), "\0"));
                break;
        }

        $beforeApplication = $application->fresh()->getAttributes();
        $beforeUser = $application->user->fresh()->getAttributes();
        $beforeShop = $shop->fresh()?->getAttributes();
        $beforeDocuments = Document::query()->orderBy('id')->get()->map->getAttributes()->all();

        $response = $this->actingAs($admin)->postJson("/api/v1/admin/registrations/{$application->id}/approve")
            ->assertUnprocessable()->assertJsonValidationErrors($field);
        $this->assertStringNotContainsString('secret storage details', $response->getContent());
        $this->assertStringNotContainsString('registration-evidence/', $response->getContent());
        $this->assertSame($beforeApplication, $application->fresh()->getAttributes());
        $this->assertSame($beforeUser, $application->user->fresh()->getAttributes());
        $this->assertSame($beforeShop, $shop->fresh()?->getAttributes());
        $this->assertSame($beforeDocuments, Document::query()->orderBy('id')->get()->map->getAttributes()->all());
        $this->assertDatabaseCount('audit_logs', 0);
        $this->assertDatabaseCount('audit_outbox', 0);
        Notification::assertNothingSent();
    }

    public static function invalidApplications(): iterable
    {
        foreach (['no_shop', 'foreign_shop', 'active_shop', 'suspended_seller'] as $defect) {
            yield $defect => [$defect, 'shop'];
        }
        foreach (['no_id', 'foreign_owner', 'foreign_application', 'rejected', 'invalid_status', 'missing_file', 'missing_disk', 'storage_error', 'public_disk', 'path_traversal', 'absolute_path', 'size_mismatch', 'mime_mismatch', 'extension_mismatch', 'double_extension', 'checksum_mismatch', 'empty', 'spoofed', 'truncated_png', 'truncated_jpeg', 'truncated_webp', 'edge_limit', 'pixel_limit', 'exact_byte_limit', 'over_byte_limit'] as $defect) {
            yield $defect => [$defect, 'government_id'];
        }
        yield 'no_permit' => ['no_permit', 'business_permit'];
        yield 'no_evidence' => ['no_evidence', 'government_id'];
        yield 'invalid_permit' => ['invalid_permit', 'business_permit'];
        yield 'foreign_extra' => ['foreign_extra', 'documents'];
        yield 'invalid_type' => ['invalid_type', 'documents'];
    }

    #[DataProvider('validEvidence')]
    public function test_valid_stored_evidence_can_be_approved_once(string $extension, bool $legacyChecksum, bool $nearByteLimit): void
    {
        Notification::fake();
        $admin = $this->reviewer();
        $application = $this->pendingSeller();
        $shop = $this->sellerApprovalEvidence($application);
        $application->documents()->delete();
        foreach ([DocumentType::GovernmentId, DocumentType::BusinessRegistration] as $type) {
            $document = $this->approvalDocument($application, $type, $extension);
            if ($nearByteLimit) {
                $this->replaceBytes($document, str_pad(Storage::disk($document->disk)->get($document->path), 10 * 1024 * 1024 - 1, "\0"));
            }
            if ($legacyChecksum) {
                $document->update(['checksum' => null]);
            }
        }
        $beforeBlobs = $application->documents()->get()->mapWithKeys(fn (Document $doc) => [$doc->id => Storage::disk($doc->disk)->get($doc->path)]);

        $this->actingAs($admin)->postJson("/api/v1/admin/registrations/{$application->id}/approve")->assertOk();
        $this->assertSame(ApplicationStatus::Approved, $application->fresh()->status);
        $this->assertSame(UserStatus::Active, $application->user->fresh()->status);
        $this->assertSame(ShopStatus::Active, $shop->fresh()->status);
        $this->assertDatabaseCount('shops', 1);
        foreach ($application->documents()->get() as $doc) {
            $this->assertSame(DocumentStatus::Verified, $doc->status);
            $this->assertSame($admin->id, $doc->reviewer_id);
            $this->assertNotNull($doc->reviewed_at);
            $this->assertSame($beforeBlobs[$doc->id], Storage::disk($doc->disk)->get($doc->path));
        }
        $this->actingAs($this->reviewer())->postJson("/api/v1/admin/registrations/{$application->id}/approve")->assertConflict();
        $this->postJson("/api/v1/admin/registrations/{$application->id}/reject")->assertConflict();
        $this->assertDatabaseCount('audit_logs', 1);
        $this->assertDatabaseCount('audit_outbox', 1);
        Notification::assertSentToTimes($application->user, RegistrationDecisionNotification::class, 1);
    }

    public static function validEvidence(): iterable
    {
        yield 'PNG' => ['png', false, false];
        yield 'JPEG' => ['jpg', false, false];
        yield 'WebP' => ['webp', false, false];
        yield 'legacy without checksum' => ['png', true, false];
        yield 'strictly under byte limit' => ['png', false, true];
    }

    public function test_incomplete_seller_can_be_rejected_and_cannot_later_be_approved(): void
    {
        Notification::fake();
        $application = $this->pendingSeller();
        $this->actingAs($this->reviewer())->postJson("/api/v1/admin/registrations/{$application->id}/reject", ['reason' => 'Required evidence is missing.'])->assertOk();
        $this->postJson("/api/v1/admin/registrations/{$application->id}/approve")->assertConflict();
        $this->assertSame(ApplicationStatus::Rejected, $application->fresh()->status);
        $this->assertSame(UserStatus::Rejected, $application->user->fresh()->status);
        Notification::assertSentToTimes($application->user, RegistrationDecisionNotification::class, 1);
    }

    private function replaceBytes(Document $document, string $bytes): void
    {
        Storage::disk($document->disk)->put($document->path, $bytes);
        $document->update(['size_bytes' => strlen($bytes), 'checksum' => hash('sha256', $bytes)]);
    }

    private function pngHeader(int $width, int $height): string
    {
        $chunk = 'IHDR'.pack('NNCCCCC', $width, $height, 8, 2, 0, 0, 0);

        return "\x89PNG\r\n\x1a\n".pack('N', 13).$chunk.pack('N', crc32($chunk));
    }
}
