<?php

namespace Tests\Feature\Customer;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\CustomerProfile;
use App\Models\User;
use App\Services\Customer\CustomerAccountService;
use App\Services\Customer\ProfilePhoto\ImageRewriter;
use App\Services\Customer\ProfilePhoto\PhotoProcessor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\DataProvider;
use RuntimeException;
use Symfony\Component\Process\Exception\ProcessTimedOutException;
use Symfony\Component\Process\Process;
use Tests\Support\ProfilePhotoFixtures;
use Tests\TestCase;

class CustomerProfilePhotoTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('customer-photo-test');
        config(['filesystems.default' => 'customer-photo-test']);
    }

    #[DataProvider('invalidImages')]
    public function test_invalid_replacement_preserves_previous_photo(string $name, string $bytes): void
    {
        $customer = $this->customerWithPhoto();
        $before = $customer->customerProfile->fresh()->getAttributes();
        $path = $before['profile_photo_path'];
        $oldBytes = Storage::disk('customer-photo-test')->get($path);

        $this->post('/api/v1/customer/account/profile-photo', [
            'photo' => UploadedFile::fake()->createWithContent($name, $bytes),
        ], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors('photo');

        $this->assertSame($before, $customer->customerProfile->fresh()->getAttributes());
        $this->assertSame($oldBytes, Storage::disk('customer-photo-test')->get($path));
        $this->assertSame([$path], Storage::disk('customer-photo-test')->allFiles());
        $this->assertProcessingClean();
    }

    public static function invalidImages(): array
    {
        return ProfilePhotoFixtures::invalidImages();
    }

    public function test_audit_fixture_passes_header_validation_but_is_rejected_by_upload(): void
    {
        $bytes = ProfilePhotoFixtures::pngHeader();
        $this->assertSame(33, strlen($bytes));
        $this->assertSame(1, getimagesizefromstring($bytes)[0]);
        $this->assertSame('image/png', (new \finfo(FILEINFO_MIME_TYPE))->buffer($bytes));
        $this->test_invalid_replacement_preserves_previous_photo('audit.png', $bytes);
    }

    #[DataProvider('formats')]
    public function test_rewritten_storage_and_metadata_match_the_valid_image(string $extension, string $mime): void
    {
        $customer = $this->customerWithPhoto();
        $oldPath = $customer->customerProfile->fresh()->profile_photo_path;
        $bytes = ProfilePhotoFixtures::image($extension);
        if ($extension === 'png') {
            $bytes .= 'private trailing metadata';
        }
        if ($extension === 'jpg' || $extension === 'jpeg') {
            // A valid JPEG COM segment demonstrates metadata stripping.
            $comment = 'private camera metadata';
            $bytes = substr($bytes, 0, 2)."\xff\xfe".pack('n', strlen($comment) + 2).$comment.substr($bytes, 2);
        }

        $this->post('/api/v1/customer/account/profile-photo', [
            'photo' => UploadedFile::fake()->createWithContent('avatar.'.$extension, $bytes),
        ], ['Accept' => 'application/json'])->assertOk()->assertHeader('Cache-Control', 'no-store, private');

        $profile = $customer->customerProfile->fresh();
        $stored = Storage::disk('customer-photo-test')->get($profile->profile_photo_path);
        $decoded = imagecreatefromstring($stored);
        $this->assertNotFalse($decoded);
        try {
            $this->assertSame($mime, $profile->profile_photo_mime);
            $this->assertSame(strlen($stored), $profile->profile_photo_size);
            $this->assertSame(imagesx($decoded), $profile->profile_photo_width);
            $this->assertSame(imagesy($decoded), $profile->profile_photo_height);
            if (in_array($extension, ['png', 'webp'], true)) {
                $color = imagecolorsforindex($decoded, imagecolorat($decoded, 0, 0));
                $this->assertSame(80, $color['alpha']);
            }
        } finally {
            unset($decoded);
        }
        $this->assertStringNotContainsString('private trailing metadata', $stored);
        $this->assertStringNotContainsString('private camera metadata', $stored);
        Storage::disk('customer-photo-test')->assertMissing($oldPath);
        $this->assertProcessingClean();
    }

    public static function formats(): array
    {
        return [['jpg', 'image/jpeg'], ['jpeg', 'image/jpeg'], ['png', 'image/png'], ['webp', 'image/webp']];
    }

    public function test_exact_size_boundary_preserves_previous_photo(): void
    {
        $bytes = ProfilePhotoFixtures::image('png');
        $bytes .= str_repeat("\0", ImageRewriter::MAX_BYTES - strlen($bytes));
        $this->test_invalid_replacement_preserves_previous_photo('boundary.png', $bytes);
    }

    public function test_failed_database_update_rolls_back_and_removes_new_object(): void
    {
        $customer = $this->customerWithPhoto();
        $before = $customer->customerProfile->fresh()->getAttributes();
        $dispatcher = CustomerProfile::getEventDispatcher();
        CustomerProfile::setEventDispatcher(clone $dispatcher);
        CustomerProfile::updating(function (): never {
            throw new RuntimeException('Simulated database failure.');
        });
        try {
            app(CustomerAccountService::class)->updateProfilePhoto($customer, $this->upload(), []);
            $this->fail('Database failure was ignored.');
        } catch (RuntimeException $exception) {
            $this->assertSame('Simulated database failure.', $exception->getMessage());
        } finally {
            CustomerProfile::setEventDispatcher($dispatcher);
        }

        $this->assertSame($before, $customer->customerProfile->fresh()->getAttributes());
        $this->assertSame([$before['profile_photo_path']], Storage::disk('customer-photo-test')->allFiles());
        $this->assertProcessingClean();
    }

    #[DataProvider('storageFailures')]
    public function test_failed_storage_preserves_previous_photo_and_cleans_partial_object(bool $throws): void
    {
        $customer = $this->customerWithPhoto();
        $before = $customer->customerProfile->fresh()->getAttributes();
        $disk = Storage::disk('customer-photo-test');
        $originalManager = Storage::getFacadeRoot();
        Storage::shouldReceive('disk')->with('customer-photo-test')->andReturn($failing = \Mockery::mock($disk));
        $failing->shouldReceive('put')->once()->andReturnUsing(function (string $path, string $bytes) use ($disk, $throws): bool {
            $disk->put($path, substr($bytes, 0, 10));
            if ($throws) {
                throw new RuntimeException('Simulated storage failure.');
            }

            return false;
        });
        $failing->shouldReceive('delete')->once()->andReturnUsing(fn (string $path) => $disk->delete($path));
        try {
            app(CustomerAccountService::class)->updateProfilePhoto($customer, $this->upload(), []);
            $this->fail('Storage failure was ignored.');
        } catch (RuntimeException $exception) {
            $this->assertStringContainsString($throws ? 'Simulated storage failure' : 'could not be stored', $exception->getMessage());
        } finally {
            Storage::swap($originalManager);
        }

        $this->assertSame($before, $customer->customerProfile->fresh()->getAttributes());
        $this->assertSame([$before['profile_photo_path']], $disk->allFiles());
    }

    public static function storageFailures(): array
    {
        return [[false], [true]];
    }

    public function test_old_object_cleanup_failure_does_not_revert_committed_replacement(): void
    {
        $customer = $this->customerWithPhoto();
        $oldPath = $customer->customerProfile->fresh()->profile_photo_path;
        $disk = Storage::disk('customer-photo-test');
        $originalManager = Storage::getFacadeRoot();
        Storage::shouldReceive('disk')->with('customer-photo-test')->andReturn($failing = \Mockery::mock($disk));
        $failing->shouldReceive('delete')->with($oldPath)->once()->andThrow(new RuntimeException('Simulated cleanup failure.'));
        try {
            app(CustomerAccountService::class)->updateProfilePhoto($customer, $this->upload(), []);
        } finally {
            Storage::swap($originalManager);
        }

        $profile = $customer->customerProfile->fresh();
        $this->assertNotSame($oldPath, $profile->profile_photo_path);
        $this->assertTrue($disk->exists($profile->profile_photo_path));
        $this->assertNotFalse(imagecreatefromstring($disk->get($profile->profile_photo_path)));
        $this->assertProcessingClean();
    }

    public function test_processing_timeout_returns_safe_validation_and_cleans_staging(): void
    {
        $customer = $this->customerWithPhoto();
        $before = $customer->customerProfile->fresh()->getAttributes();
        $process = $this->createMock(Process::class);
        $process->expects($this->once())->method('setTimeout')->with(15)->willReturnSelf();
        $process->expects($this->once())->method('disableOutput')->willReturnSelf();
        $process->expects($this->once())->method('mustRun')->willThrowException(new ProcessTimedOutException(new Process(['php', 'private/path']), ProcessTimedOutException::TYPE_GENERAL));
        $processor = new class($process) extends PhotoProcessor
        {
            public function __construct(private Process $process) {}

            protected function rewriterProcess(string $input, string $output): Process
            {
                return $this->process;
            }
        };
        $this->app->instance(PhotoProcessor::class, $processor);

        $response = $this->post('/api/v1/customer/account/profile-photo', ['photo' => $this->upload()], ['Accept' => 'application/json'])
            ->assertUnprocessable()->assertJsonValidationErrors('photo');
        $this->assertStringNotContainsString('private/path', $response->getContent());
        $this->assertSame($before, $customer->customerProfile->fresh()->getAttributes());
        $this->assertSame([$before['profile_photo_path']], Storage::disk('customer-photo-test')->allFiles());
        $this->assertProcessingClean();
    }

    private function customerWithPhoto(): User
    {
        $customer = User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Active]);
        CustomerProfile::create([
            'user_id' => $customer->id,
            'first_name' => 'Photo',
            'last_name' => 'Owner',
            'contact_number' => '+639171234567',
            'birth_date' => '2000-01-01',
            'sex' => 'prefer_not_to_say',
        ]);
        app(CustomerAccountService::class)->updateProfilePhoto($customer, $this->upload(), []);
        $this->actingAs($customer);

        return $customer;
    }

    private function upload(): UploadedFile
    {
        return UploadedFile::fake()->createWithContent('photo.png', ProfilePhotoFixtures::image('png'));
    }

    private function assertProcessingClean(): void
    {
        $this->assertSame([], glob(storage_path('app/private/customer-photo-processing/*')));
    }
}
