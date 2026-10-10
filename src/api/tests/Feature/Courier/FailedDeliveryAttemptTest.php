<?php

namespace Tests\Feature\Courier;

use App\Enums\UserRole;
use App\Models\FinalMileFailedAttempt;
use App\Models\User;
use App\Services\Courier\FailedDeliveryAttemptService;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\FailedAttemptFixtures;
use Tests\TestCase;

class FailedDeliveryAttemptTest extends TestCase
{
    use FailedAttemptFixtures, RefreshDatabase;

    public function test_exact_and_normalized_retries_return_original_attempt_without_effects(): void
    {
        [$courier, $task] = $this->failedAttemptTask();
        $state = $this->attemptState($task);
        $key = (string) Str::uuid();
        $first = $this->actingAs($courier)->withHeader('Idempotency-Key', $key)
            ->postJson($this->url($task->id), $this->attemptInput())
            ->assertCreated()->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('data.task_id', $task->id)->assertJsonPath('data.retry_allowed', true)->json();
        $attributes = FinalMileFailedAttempt::sole()->getAttributes();
        $this->travel(1)->minutes();
        $this->postJson($this->url($task->id), $this->attemptInput())->assertCreated()->assertExactJson($first);
        $this->postJson($this->url($task->id), [...$this->attemptInput(), 'note' => '  No answer at the door.  '])
            ->assertCreated()->assertExactJson($first);
        $this->assertDatabaseCount('final_mile_failed_attempts', 1);
        $this->assertSame($attributes, FinalMileFailedAttempt::sole()->getAttributes());
        $this->assertSame($state, $this->attemptState($task));
    }

    #[DataProvider('changedInputs')]
    public function test_reused_key_with_changed_payload_is_a_safe_conflict(array $changes): void
    {
        [$courier, $task] = $this->failedAttemptTask();
        $this->actingAs($courier)->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson($this->url($task->id), $this->attemptInput())->assertCreated();
        $state = $this->attemptState($task);
        $attributes = FinalMileFailedAttempt::sole()->getAttributes();
        $this->postJson($this->url($task->id), [...$this->attemptInput(), ...$changes])
            ->assertConflict()->assertJsonPath('code', 'IDEMPOTENCY_KEY_REUSED');
        $this->assertDatabaseCount('final_mile_failed_attempts', 1);
        $this->assertSame($attributes, FinalMileFailedAttempt::sole()->getAttributes());
        $this->assertSame($state, $this->attemptState($task));
    }

    public static function changedInputs(): iterable
    {
        yield 'reason' => [['reason' => 'recipient_refused']];
        yield 'note' => [['note' => 'Different visit.']];
        yield 'revision' => [['expected_revision' => 6]];
    }

    public function test_key_is_scoped_to_courier_and_includes_task_identity(): void
    {
        [$courier, $task] = $this->failedAttemptTask();
        $otherTask = $this->anotherFailedAttemptTask($task);
        $otherCourier = $this->anotherAttemptCourier($courier);
        $foreignTask = $this->anotherFailedAttemptTask($task, $otherCourier);
        $key = (string) Str::uuid();
        $this->actingAs($courier)->withHeader('Idempotency-Key', $key)
            ->postJson($this->url($task->id), $this->attemptInput())->assertCreated();
        $this->postJson($this->url($otherTask->id), $this->attemptInput())
            ->assertConflict()->assertJsonPath('code', 'IDEMPOTENCY_KEY_REUSED');
        $this->actingAs($otherCourier)->postJson($this->url($task->id), $this->attemptInput())->assertNotFound();
        $this->postJson($this->url($foreignTask->id), $this->attemptInput())->assertCreated();
        $this->assertDatabaseCount('final_mile_failed_attempts', 2);
        $this->assertSame(1, FinalMileFailedAttempt::where('courier_id', $courier->id)->count());
        $this->assertSame(1, FinalMileFailedAttempt::where('courier_id', $otherCourier->id)->count());
    }

    public function test_distinct_keys_record_distinct_visits_without_advancing_delivery(): void
    {
        [$courier, $task] = $this->failedAttemptTask();
        $state = $this->attemptState($task);
        $this->actingAs($courier);
        foreach (range(1, 2) as $visit) {
            $this->withHeader('Idempotency-Key', (string) Str::uuid())
                ->postJson($this->url($task->id), $this->attemptInput())->assertCreated();
        }
        $this->assertDatabaseCount('final_mile_failed_attempts', 2);
        $this->assertSame($state, $this->attemptState($task));
    }

    public function test_committed_replay_survives_state_changes_but_new_visits_are_rejected(): void
    {
        [$courier, $task] = $this->failedAttemptTask();
        $first = $this->actingAs($courier)->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson($this->url($task->id), $this->attemptInput())->assertCreated()->json();
        $task->update(['status' => 'delivered', 'revision' => 6]);
        $state = $this->attemptState($task);
        $this->postJson($this->url($task->id), $this->attemptInput())->assertCreated()->assertExactJson($first);
        $this->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson($this->url($task->id), [...$this->attemptInput(), 'expected_revision' => 6])
            ->assertConflict()->assertJsonPath('code', 'TASK_STATE_CONFLICT');
        $this->assertDatabaseCount('final_mile_failed_attempts', 1);
        $this->assertSame($state, $this->attemptState($task));
    }

    public function test_stale_revision_and_pending_completion_block_new_attempts(): void
    {
        [, $courier, $task, $proof] = $this->readyDelivery();
        $this->actingAs($courier)->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson($this->url($task->id), [...$this->attemptInput(), 'expected_revision' => 4])
            ->assertConflict()->assertJsonPath('code', 'TASK_STATE_CONFLICT');
        $this->submitIntent($courier, $task, $proof);
        $state = $this->attemptState($task);
        $this->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson($this->url($task->id), $this->attemptInput())
            ->assertConflict()->assertJsonPath('code', 'COMPLETION_PENDING');
        $this->assertDatabaseCount('final_mile_failed_attempts', 0);
        $this->assertSame($state, $this->attemptState($task));
    }

    public function test_authentication_role_and_approval_gates_apply_to_replay(): void
    {
        [$courier, $task] = $this->failedAttemptTask();
        $key = (string) Str::uuid();
        $this->withHeader('Idempotency-Key', $key)->postJson($this->url($task->id), $this->attemptInput())->assertUnauthorized();
        $this->actingAs(User::factory()->create(['role' => UserRole::Customer]))
            ->postJson($this->url($task->id), $this->attemptInput())->assertForbidden();
        $this->actingAs($courier)->postJson($this->url($task->id), $this->attemptInput())->assertCreated();
        $courier->courierLogisticsAffiliation->update(['status' => 'pending']);
        $this->postJson($this->url($task->id), $this->attemptInput())->assertForbidden();
        $this->assertDatabaseCount('final_mile_failed_attempts', 1);
    }

    public function test_unrelated_unique_failure_is_rethrown_and_transaction_remains_usable(): void
    {
        [$courier, $task] = $this->failedAttemptTask();
        $service = app(FailedDeliveryAttemptService::class);
        $prior = $service->record($courier, $task->id, $this->attemptInput(), (string) Str::uuid());
        FinalMileFailedAttempt::creating(function (FinalMileFailedAttempt $attempt) use ($prior): void {
            $attempt->id = $prior->id;
        });
        try {
            $service->record($courier, $task->id, $this->attemptInput(), (string) Str::uuid());
            $this->fail('A primary-key conflict must not become a replay.');
        } catch (UniqueConstraintViolationException $error) {
            $this->assertNotSame('final_mile_failed_attempts_courier_id_idempotency_key_unique', $error->index);
        }
        $this->assertDatabaseCount('final_mile_failed_attempts', 1);
    }

    private function url(string $taskId): string
    {
        return '/api/v1/courier/final-mile-tasks/'.$taskId.'/failed-attempts';
    }
}
