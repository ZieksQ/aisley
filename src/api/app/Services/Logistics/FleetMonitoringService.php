<?php

namespace App\Services\Logistics;

use App\Enums\Logistics\CompanyTruckAvailability;
use App\Exceptions\Fulfillment\FulfillmentException;
use App\Models\CompanyTruck;
use App\Models\LinehaulTrip;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;

class FleetMonitoringService
{
    private const ACTIVE = ['pending_acceptance', 'scheduled', 'in_transfer', 'receiving'];

    public function listing(User $actor, array $input, CarbonInterface $at): array
    {
        $owned = $this->owned($actor);
        $counts = (clone $owned)->selectRaw('availability, COUNT(*) AS total')->groupBy('availability')->pluck('total', 'availability');
        $summary = [];
        foreach (CompanyTruckAvailability::cases() as $state) {
            $summary[$state->value] = (int) ($counts[$state->value] ?? 0);
        }
        $query = $this->withActiveTrip(clone $owned);
        $search = trim($input['search'] ?? '');
        if ($search !== '') {
            // Treat user-entered wildcard characters literally on PostgreSQL and SQLite.
            $like = '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], mb_strtolower($search)).'%';
            $query->where(function (Builder $query) use ($like): void {
                $query->whereRaw("LOWER(plate_number) LIKE ? ESCAPE '!'", [$like])
                    ->orWhereRaw("LOWER(make) LIKE ? ESCAPE '!'", [$like])
                    ->orWhereRaw("LOWER(model) LIKE ? ESCAPE '!'", [$like])
                    ->orWhereHas('trips', function (Builder $trips) use ($like): void {
                        $trips->whereIn('status', self::ACTIVE)->where(function (Builder $trip) use ($like): void {
                            $trip->whereHas('fromHub', fn ($hub) => $hub->whereRaw("LOWER(name) LIKE ? ESCAPE '!'", [$like]))
                                ->orWhereHas('toHub', fn ($hub) => $hub->whereRaw("LOWER(name) LIKE ? ESCAPE '!'", [$like]))
                                ->orWhereHas('driver.courierProfile', fn ($driver) => $driver
                                    ->whereRaw("LOWER(first_name || ' ' || last_name) LIKE ? ESCAPE '!'", [$like]));
                        });
                    });
            });
        }
        if (! empty($input['availability'])) {
            $query->where('availability', $input['availability']);
        }
        if ($input['overdue'] ?? false) {
            $query->whereHas('trips', fn ($trip) => $trip
                ->whereIn('status', ['pending_acceptance', 'scheduled'])->whereNull('departed_at')->where('scheduled_for', '<', $at));
        }

        return [$query->orderBy('plate_number')->orderBy('id')->paginate($input['per_page'] ?? 20), $summary];
    }

    public function truck(User $actor, string $id): CompanyTruck
    {
        $truck = $this->withActiveTrip($this->owned($actor))->whereKey($id)->first();
        if ($truck === null) {
            throw FulfillmentException::notFound('COMPANY_TRUCK_NOT_FOUND', 'This company truck is unavailable.');
        }

        return $truck;
    }

    public function history(User $actor, string $id, array $input): LengthAwarePaginator
    {
        return $this->truck($actor, $id)->trips()->with($this->tripRelations())
            ->when($input['past'] ?? false, fn ($query) => $query->whereIn('status', ['received', 'rejected', 'cancelled']))
            ->orderByDesc('created_at')->orderByDesc('id')->paginate($input['per_page'] ?? 20);
    }

    public function trip(User $actor, string $truck, string $id): LinehaulTrip
    {
        $trip = $this->truck($actor, $truck)->trips()->with($this->tripRelations())->whereKey($id)
            ->whereIn('status', ['received', 'rejected', 'cancelled'])->first();
        if ($trip === null) {
            throw FulfillmentException::notFound('FLEET_TRANSFER_NOT_FOUND', 'This past transfer is unavailable.');
        }

        return $trip;
    }

    private function tripRelations(): array
    {
        return ['driver.courierProfile', 'fromHub.address', 'fromHub.organization:id,business_name',
            'toHub.address', 'toHub.organization:id,business_name'];
    }

    private function owned(User $actor): Builder
    {
        $org = $actor->logisticsOrganization()->with('hub')->first();
        if ($org === null || $org->hub === null) {
            throw FulfillmentException::notFound('LOGISTICS_CONTEXT_NOT_FOUND', 'The Logistics organization or operational hub is unavailable.');
        }

        return CompanyTruck::query()->where('logistics_organization_id', $org->id);
    }

    private function withActiveTrip(Builder $query): Builder
    {
        return $query->with(['homeHub:id,name', 'lastConfirmedHub:id,name', 'trips' => fn ($trip) => $trip
            ->whereIn('status', self::ACTIVE)->orderByDesc('created_at')->orderByDesc('id')
            ->with($this->tripRelations())]);
    }
}
