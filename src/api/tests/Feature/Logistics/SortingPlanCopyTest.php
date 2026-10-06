<?php

namespace Tests\Feature\Logistics;

use App\Models\SortingPlan;
use App\Models\SortingPlanVersion;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\Support\LocalSortingFixtures;
use Tests\TestCase;

class SortingPlanCopyTest extends TestCase
{
    use LocalSortingFixtures, RefreshDatabase;

    private function source(string $name = 'Daily plan'): array
    {
        [$actor] = $this->logistics();
        $this->actingAs($actor);
        $lane = $this->postJson('/api/v1/logistics/sorting/lanes', ['code' => 'LANE-2', 'name' => 'Lane 2', 'type' => 'standard'])->assertCreated()->json('data');
        $this->postJson('/api/v1/logistics/sorting/lanes', ['code' => 'EX', 'name' => 'Exception', 'type' => 'exception'])->assertCreated();
        $plan = $this->postJson('/api/v1/logistics/sorting/plans', ['name' => $name])->assertCreated()->json('data');
        $this->postJson('/api/v1/logistics/sorting/plans/'.$plan['id'].'/lanes', ['expected_revision' => 1, 'lane_id' => $lane['id'], 'postal_code' => '6000'])->assertOk();

        return [$actor, SortingPlan::findOrFail($plan['id']), $lane];
    }

    private function copy(SortingPlan $plan, array $extra = [], ?string $key = null): array
    {
        return $this->withHeader('Idempotency-Key', $key ?? (string) Str::uuid())
            ->postJson('/api/v1/logistics/sorting/plans/'.$plan->id.'/actions/duplicate', ['expected_revision' => $plan->fresh()->revision, ...$extra])
            ->assertOk()->json('data');
    }

    public function test_numbered_draft_copies_are_independent_and_retry_returns_original_copy(): void
    {
        [, $plan, $lane] = $this->source();
        $key = (string) Str::uuid();
        $copy = $this->copy($plan, key: $key);
        $this->assertSame('Daily plan (1)', $copy['plan_name']);
        $this->assertSame($copy, $this->copy($plan, key: $key));
        $next = $this->copy($plan);
        $this->assertSame('Daily plan (2)', $next['plan_name']);
        $copyPlan = SortingPlan::findOrFail($copy['plan_id']);
        $this->assertFalse($copyPlan->is_active);
        $this->assertTrue($copyPlan->draft_dirty);
        $this->assertSame(0, $copyPlan->versions()->count());
        $this->assertSame($lane['id'], $copyPlan->lanes()->sole()->sorting_lane_id);
        $this->assertNotSame($plan->lanes()->sole()->id, $copyPlan->lanes()->sole()->id);
        $copyPlan->lanes()->delete();
        $this->assertSame(1, $plan->lanes()->count());
        $third = $this->copy(SortingPlan::findOrFail($next['plan_id']));
        $this->assertSame('Daily plan (3)', $third['plan_name']);
    }

    public function test_selected_published_version_is_copied_even_when_draft_has_other_mappings(): void
    {
        [, $plan, $lane] = $this->source();
        $version = $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/sorting/plans/'.$plan->id.'/actions/publish', ['expected_revision' => $plan->fresh()->revision])->assertOk()->json('data.version');
        $plan->lanes()->delete();
        $plan->update(['draft_dirty' => true]);
        $copy = $this->copy($plan, ['version_id' => $version['id']]);
        $this->assertSame($lane['id'], SortingPlan::findOrFail($copy['plan_id'])->lanes()->sole()->sorting_lane_id);
        $this->assertSame($version['mappings'], SortingPlanVersion::findOrFail($version['id'])->mappings);
        $this->assertSame(0, $plan->lanes()->count());
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/sorting/plans/'.$plan->id.'/actions/duplicate', ['expected_revision' => $plan->fresh()->revision, 'version_id' => (string) Str::uuid()])->assertNotFound();
    }

    public function test_numbering_includes_archived_names_and_long_names_but_remains_tenant_scoped(): void
    {
        [$actor, $plan] = $this->source(str_repeat('長', 80));
        $first = $this->copy($plan);
        $this->assertSame(80, mb_strlen($first['plan_name']));
        SortingPlan::findOrFail($first['plan_id'])->update(['archived_at' => now()]);
        $next = $this->copy($plan);
        $this->assertStringEndsWith(' (2)', $next['plan_name']);
        [$other] = $this->logistics();
        $this->actingAs($other)->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/sorting/plans/'.$plan->id.'/actions/duplicate', ['expected_revision' => $plan->fresh()->revision])->assertNotFound();
        $otherPlan = $this->postJson('/api/v1/logistics/sorting/plans', ['name' => $plan->name])->assertCreated()->json('data');
        $otherCopy = $this->copy(SortingPlan::findOrFail($otherPlan['id']));
        $this->assertStringEndsWith(' (1)', $otherCopy['plan_name']);
        $this->actingAs($actor);
        $this->assertSame(3, SortingPlan::where('logistics_hub_id', $plan->logistics_hub_id)->count());
    }
}
