<?php

namespace Tests\Feature\Logistics;

use App\Models\HubServiceArea;
use App\Models\SortingException;
use App\Models\SortingLane;
use App\Models\SortingPlan;
use App\Models\SortingPlanActivation;
use App\Models\SortingPlanVersion;
use App\Models\SortingSession;
use App\Services\Logistics\Routing\CheckoutRoutePlanner;
use App\Services\Logistics\SortingPlanService;
use App\Services\Logistics\SortingService;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Tests\Support\LocalSortingFixtures;
use Tests\TestCase;

class SortingVersionsTest extends TestCase
{
    use LocalSortingFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['hub-routing.enabled' => false]);
    }

    private function lane(string $code, string $type = 'standard'): array
    {
        return $this->postJson('/api/v1/logistics/sorting/lanes', ['code' => $code, 'name' => 'Original '.$code, 'type' => $type])->assertCreated()->json('data');
    }

    private function plan(array $lane): array
    {
        $plan = $this->postJson('/api/v1/logistics/sorting/plans', ['name' => 'Daily plan'])->assertCreated()->json('data');
        $this->postJson('/api/v1/logistics/sorting/plans/'.$plan['id'].'/lanes', ['expected_revision' => 1, 'lane_id' => $lane['id'], 'postal_code' => '6000'])->assertOk();

        return $plan;
    }

    private function action(array $plan, string $action, array $extra = []): array
    {
        return $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/sorting/plans/'.$plan['id'].'/actions/'.$action,
            ['expected_revision' => SortingPlan::findOrFail($plan['id'])->revision, ...$extra])->assertOk()->json('data');
    }

    private function capture(array $session, int $index, array $extra = []): array
    {
        $item = $session['items'][$index];

        return ['client_id' => (string) Str::uuid(), 'lane_id' => null, 'auto_route' => true, 'reference' => $item['reference'],
            'expected_revision' => $item['expected_revision'], 'source' => 'barcode', 'captured_at' => now()->toISOString(), ...$extra];
    }

    private function scan(array $session, array $capture): TestResponse
    {
        return $this->postJson('/api/v1/logistics/sorting/sessions/'.$session['id'].'/batches', ['captures' => [$capture]])->assertOk();
    }

    private function sortingSession(array $extra = []): array
    {
        return $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/sorting/sessions', $extra)->assertCreated()->json('data');
    }

    public function test_versions_freeze_assignments_and_duplicate_independently_using_shared_lanes(): void
    {
        [, $courier] = $this->receivedParcels(2);
        $one = $this->lane('LANE-1');
        $five = $this->lane('LANE-5');
        $this->lane('EX', 'exception');
        $plan = $this->plan($one);
        $first = $this->action($plan, 'publish', ['activate' => true])['version'];
        $session = $this->sortingSession();
        $capture = $this->capture($session, 0);
        $original = $this->scan($session, $capture)->assertJsonPath('data.0.lane.code', 'LANE-1')->json('data.0');
        $this->action($plan, 'draft', ['version_id' => $first['id']]);
        $mapping = SortingPlan::find($plan['id'])->lanes()->sole();
        $this->deleteJson('/api/v1/logistics/sorting/plans/'.$plan['id'].'/lanes/'.$mapping->id, ['expected_revision' => SortingPlan::find($plan['id'])->revision])->assertOk();
        $this->postJson('/api/v1/logistics/sorting/plans/'.$plan['id'].'/lanes', ['expected_revision' => SortingPlan::find($plan['id'])->revision, 'lane_id' => $five['id'], 'postal_code' => '6000'])->assertOk();
        // Draft changes cannot affect authoritative routing before publication.
        $this->assertSame($one['id'], app(SortingPlanService::class)->routeForContext(SortingPlan::find($plan['id'])->logistics_organization_id, SortingPlan::find($plan['id'])->logistics_hub_id, '6000')['lane']->id);
        $second = $this->action($plan, 'publish', ['activate' => true])['version'];
        $this->assertSame(2, $second['number']);
        $this->scan($session, $this->capture($session, 1))->assertJsonPath('data.0.lane.code', 'LANE-5');
        $this->patchJson('/api/v1/logistics/sorting/lanes/'.$one['id'], ['expected_revision' => 1, 'code' => 'RENAMED-1', 'name' => 'Today label'])->assertOk();
        $this->assertSame($original, $this->scan($session, $capture)->json('data.0'));
        $record = $this->getJson('/api/v1/logistics/update-status/records/'.$capture['reference'])->assertOk()->assertJsonPath('data.sorting_lane.code', 'LANE-1')->assertJsonPath('data.sorting_assignment.version_id', $first['id'])->json('data');
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/dispatch/schedules', ['shipment_ids' => [$record['shipment_id']], 'courier_id' => $courier->id, 'scheduled_for' => now()->addHour()->toISOString(), 'assignments' => [$this->dispatchAssignment($record)]])->assertCreated()->assertJsonPath('data.parcels.0.source_lane.code', 'LANE-1')->assertJsonPath('data.parcels.0.source_lane.sorting_assignment.version_id', $first['id']);
        $copy = $this->action($plan, 'duplicate', ['version_id' => $first['id'], 'name' => 'Separate morning plan']);
        $this->assertSame(3, SortingLane::count());
        $this->assertSame($one['id'], SortingPlan::find($copy['plan_id'])->lanes()->sole()->sorting_lane_id);
        $this->assertSame($five['id'], SortingPlan::find($plan['id'])->lanes()->sole()->sorting_lane_id);
        $this->assertSame($one['id'], SortingPlanVersion::find($first['id'])->mappings[0]['sorting_lane_id']);
        $this->assertNotEmpty($second['differences']['changed']);
    }

    public function test_overdue_activation_and_failure_are_recorded_once_and_schedules_can_be_cancelled(): void
    {
        $this->receivedParcels(1);
        $lane = $this->lane('STD');
        $this->lane('EX', 'exception');
        $plan = $this->plan($lane);
        $first = $this->action($plan, 'publish', ['activate' => true])['version'];
        $copy = $this->action($plan, 'duplicate', ['version_id' => $first['id'], 'name' => 'Night plan']);
        $next = ['id' => $copy['plan_id']];
        $second = $this->action($next, 'publish')['version'];
        $scheduled = $this->action($next, 'schedule', ['version_id' => $second['id'], 'scheduled_for' => now()->addHour()->toISOString()])['activation'];
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/sorting/plans/'.$plan['id'].'/actions/schedule', ['expected_revision' => SortingPlan::find($plan['id'])->revision, 'version_id' => $first['id'], 'scheduled_for' => $scheduled['scheduled_for']])->assertConflict()->assertJsonPath('code', 'SORT_SCHEDULE_TAKEN');
        $this->travel(61)->minutes();
        $current = SortingPlan::findOrFail($plan['id']);
        HubServiceArea::create(['logistics_hub_id' => $current->logistics_hub_id, 'postal_code' => '6000', 'is_active' => true, 'revision' => 1, 'created_by' => $current->created_by_logistics_id]);
        config(['hub-routing.enabled' => true]);
        $quotation = app(CheckoutRoutePlanner::class)->plan($current->hub, '6000');
        $this->assertSame('local', $quotation['status']);
        $this->assertSame($second['id'], $quotation['sort_plans'][0]['version_id']);
        config(['hub-routing.enabled' => false]);
        $session = $this->sortingSession();
        $this->scan($session, $this->capture($session, 0))->assertJsonPath('data.0.version_id', $second['id']);
        $this->artisan('sorting:activate-due')->assertSuccessful();
        $this->assertSame('activated', SortingPlanActivation::find($scheduled['id'])->status->value);
        $this->assertSame(1, SortingPlan::where('is_active', true)->count());
        $failed = $this->action($plan, 'schedule', ['version_id' => $first['id'], 'scheduled_for' => now()->addHour()->toISOString()])['activation'];
        SortingLane::find($lane['id'])->update(['is_active' => false]);
        $this->travel(61)->minutes();
        $this->getJson('/api/v1/logistics/sorting/plans')->assertOk();
        $this->assertSame('failed', SortingPlanActivation::find($failed['id'])->status->value);
        $this->assertSame($second['id'], SortingPlan::find($next['id'])->active_version_id);
        SortingLane::find($lane['id'])->update(['is_active' => true]);
        $future = $this->action($plan, 'schedule', ['version_id' => $first['id'], 'scheduled_for' => now()->addHour()->toISOString()])['activation'];
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/sorting/plans/'.$plan['id'].'/actions/archive', ['expected_revision' => SortingPlan::find($plan['id'])->revision])->assertConflict()->assertJsonPath('code', 'SORT_SCHEDULE_PENDING');
        $this->action($plan, 'cancel', ['activation_id' => $future['id']]);
        $this->action($plan, 'archive');
        $this->assertNotNull(SortingPlan::find($plan['id'])->archived_at);
        $this->assertDatabaseCount('sorting_plan_versions', 2);
    }

    public function test_paused_lane_routes_new_scans_to_exception_blocks_dispatch_and_resumes_without_reassignment(): void
    {
        [, $courier] = $this->receivedParcels(4);
        $lane = $this->lane('STD');
        $other = $this->lane('OTHER');
        $ex = $this->lane('EX', 'exception');
        $plan = $this->plan($lane);
        $this->action($plan, 'publish', ['activate' => true]);
        $session = $this->sortingSession();
        $this->scan($session, $this->capture($session, 0))->assertJsonPath('summary.sorted', 1);
        $key = (string) Str::uuid();
        $input = ['expected_revision' => 1, 'operational_state' => 'paused', 'blocking_reason' => 'Safety inspection'];
        $result = $this->withHeader('Idempotency-Key', $key)->patchJson('/api/v1/logistics/sorting/lanes/'.$lane['id'], $input)->assertOk()->json('data');
        $this->assertSame($result, $this->patchJson('/api/v1/logistics/sorting/lanes/'.$lane['id'], $input)->assertOk()->json('data'));
        $this->assertSame('open', SortingLane::find($other['id'])->operational_state->value);
        $this->scan($session, $this->capture($session, 1))->assertJsonPath('summary.exception', 1)->assertJsonPath('data.0.lane.id', $ex['id']);
        $this->scan($session, $this->capture($session, 2, ['auto_route' => false, 'lane_id' => $lane['id']]))
            ->assertJsonPath('summary.exception', 1)->assertJsonPath('data.0.lane.id', $ex['id']);
        $this->scan($session, $this->capture($session, 3, ['auto_route' => false, 'lane_id' => $other['id']]))
            ->assertJsonPath('summary.sorted', 1)->assertJsonPath('data.0.lane.id', $other['id']);
        $record = $this->getJson('/api/v1/logistics/update-status/records/'.$session['items'][0]['reference'])->json('data');
        $dispatch = ['shipment_ids' => [$record['shipment_id']], 'courier_id' => $courier->id, 'scheduled_for' => now()->addHour()->toISOString(), 'assignments' => [$this->dispatchAssignment($record)]];
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/dispatch/schedules', $dispatch)->assertConflict()->assertJsonPath('code', 'SORT_LANE_BLOCKED');
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->patchJson('/api/v1/logistics/sorting/lanes/'.$lane['id'], ['expected_revision' => 2, 'operational_state' => 'open'])->assertOk();
        $record = $this->getJson('/api/v1/logistics/update-status/records/'.$session['items'][0]['reference'])->json('data');
        $dispatch['assignments'] = [$this->dispatchAssignment($record)];
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/dispatch/schedules', $dispatch)->assertCreated()->assertJsonPath('data.parcels.0.source_lane.code', 'STD');
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->patchJson('/api/v1/logistics/sorting/lanes/'.$ex['id'], ['expected_revision' => 1, 'operational_state' => 'held', 'blocking_reason' => 'Attempt to block fallback'])->assertConflict()->assertJsonPath('code', 'SORT_EXCEPTION_LANE_PROTECTED');
    }

    public function test_damage_release_repeated_exceptions_carry_over_and_recovery_preserve_original_session(): void
    {
        [$actor] = $this->receivedParcels(1);
        $lane = $this->lane('STD');
        $ex = $this->lane('EX', 'exception');
        $plan = $this->plan($lane);
        $this->action($plan, 'publish', ['activate' => true]);
        $session = $this->sortingSession();
        $damaged = $this->capture($session, 0, ['auto_route' => false, 'lane_id' => $ex['id'], 'exception_code' => 'damaged', 'reason' => 'Damaged wrapping']);
        $this->scan($session, $damaged)->assertJsonPath('summary.exception', 1);
        $this->scan($session, $this->capture($session, 0))->assertJsonPath('summary.exception', 1);
        $exception = SortingException::sole();
        $this->assertSame(2, $exception->attempts);
        $this->scan($session, $this->capture($session, 0, ['auto_route' => false, 'lane_id' => $lane['id']]))->assertJsonPath('data.0.code', 'SORT_EXCEPTION_RESCAN_REQUIRED');
        $this->postJson('/api/v1/logistics/sorting/sessions/'.$session['id'].'/close', ['expected_revision' => 1, 'carry_over_exceptions' => true])->assertOk();
        $this->getJson('/api/v1/logistics/sorting')->assertJsonPath('data.waiting_received', 0);
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/sorting/sessions')->assertUnprocessable();
        $this->getJson('/api/v1/logistics/sorting/exceptions')->assertOk()->assertJsonPath('data.0.attempts', 2)->assertJsonPath('data.0.can_recover', false);
        [$foreign] = $this->logistics();
        $this->actingAs($foreign)->getJson('/api/v1/logistics/sorting/exceptions')->assertOk()->assertJsonCount(0, 'data');
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/sorting/exceptions/'.$exception->id.'/release', ['expected_revision' => $exception->revision, 'reason' => 'Checked wrapping and contents'])->assertNotFound();
        $this->actingAs($actor)->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/sorting/exceptions/'.$exception->id.'/release', ['expected_revision' => $exception->revision, 'reason' => 'Checked wrapping and contents'])->assertOk();
        $recovery = $this->sortingSession(['recovery_shipment_ids' => [$session['items'][0]['shipment_id']]]);
        $this->scan($recovery, $this->capture($recovery, 0))->assertJsonPath('summary.sorted', 1);
        $this->assertNotNull($exception->fresh()->resolved_at);
        $this->assertDatabaseHas('sorting_session_items', ['sorting_session_id' => $session['id'], 'status' => 'exception']);
        $history = app(SortingService::class)->sessionProjection(SortingSession::findOrFail($session['id']));
        $this->assertSame($ex['id'], $history['items'][0]['sorting_assignment']['lane']['id']);
        $this->assertDatabaseHas('sorting_session_items', ['sorting_session_id' => $recovery['id'], 'status' => 'sorted']);
        $this->assertDatabaseCount('sorting_scans', 3);
    }

    public function test_version_actions_replay_original_response_and_enforce_ownership_and_immutability(): void
    {
        [$actor] = $this->logistics();
        $this->actingAs($actor);
        $lane = $this->lane('STD');
        $this->lane('EX', 'exception');
        $plan = $this->plan($lane);
        $key = (string) Str::uuid();
        $body = ['expected_revision' => 2, 'activate' => true];
        $path = '/api/v1/logistics/sorting/plans/'.$plan['id'].'/actions/publish';
        $result = $this->withHeader('Idempotency-Key', $key)->postJson($path, $body)->assertOk()->json('data');
        $this->assertSame($result, $this->postJson($path, $body)->assertOk()->json('data'));
        $this->postJson($path, [...$body, 'activate' => false])->assertConflict()->assertJsonPath('code', 'IDEMPOTENCY_KEY_REUSED');
        $this->assertDatabaseCount('sorting_plan_versions', 1);
        [$foreign] = $this->logistics();
        $this->actingAs($foreign)->getJson('/api/v1/logistics/sorting/plans/'.$plan['id'].'/versions')->assertNotFound();
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson($path, $body)->assertNotFound();
        $version = SortingPlanVersion::sole();
        $this->expectException(\LogicException::class);
        $version->update(['name' => 'Changed immutable name']);
    }

    public function test_additive_version_import_preserves_active_selection_and_marks_legacy_evidence(): void
    {
        $this->receivedParcels(2);
        $lane = $this->lane('STD');
        $ex = $this->lane('EX', 'exception');
        $plan = $this->plan($lane);
        $this->action($plan, 'publish', ['activate' => true]);
        $session = $this->sortingSession();
        $this->scan($session, $this->capture($session, 0));
        $this->scan($session, $this->capture($session, 1, ['auto_route' => false, 'lane_id' => $ex['id'], 'exception_code' => 'damaged', 'reason' => 'Legacy damage']));

        $migration = require database_path('migrations/2026_10_06_000004_add_sorting_versions_and_recovery.php');
        $migration->down();
        $migration->up();
        $imported = SortingPlan::findOrFail($plan['id']);
        $this->assertTrue($imported->is_active);
        $this->assertSame(1, $imported->activeVersion->number);
        $this->assertSame($lane['id'], $imported->activeVersion->mappings[0]['sorting_lane_id']);
        $this->assertFalse($imported->draft_dirty);
        $this->assertDatabaseCount('sorting_exceptions', 1);
        $this->getJson('/api/v1/logistics/update-status/records/'.$session['items'][0]['reference'])
            ->assertOk()->assertJsonPath('data.sorting_assignment.legacy_reconstructed', true)
            ->assertJsonPath('data.sorting_lane.code', null);
        $scan = DB::table('sorting_scans')->where('shipment_id', $session['items'][0]['shipment_id'])->first();
        $this->assertTrue(json_decode($scan->result_snapshot, true)['sorting_assignment']['legacy_reconstructed']);
        // Database enforcement also protects versions from query-builder mutations.
        foreach (['update', 'delete'] as $operation) {
            try {
                DB::transaction(function () use ($imported, $operation): void {
                    $query = DB::table('sorting_plan_versions')->where('id', $imported->active_version_id);
                    $operation === 'update' ? $query->update(['name' => 'Rewrite']) : $query->delete();
                });
                $this->fail('Published version mutation was accepted.');
            } catch (QueryException $exception) {
                $this->assertStringContainsString('immutable', $exception->getMessage());
            }
        }
        $this->assertDatabaseCount('sorting_plan_versions', 1);
    }
}
