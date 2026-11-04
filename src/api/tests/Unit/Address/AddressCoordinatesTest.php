<?php

namespace Tests\Unit\Address;

use App\Support\AddressCoordinates;
use Illuminate\Support\Facades\Validator;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class AddressCoordinatesTest extends TestCase
{
    #[DataProvider('coordinatePairs')]
    public function test_required_coordinate_rules_and_saved_pair_validation_agree(mixed $latitude, mixed $longitude, bool $valid): void
    {
        $validator = Validator::make(compact('latitude', 'longitude'), [
            'latitude' => AddressCoordinates::rules('latitude'),
            'longitude' => AddressCoordinates::rules('longitude'),
        ]);
        $this->assertSame($valid, $validator->passes());
        $this->assertSame($valid, AddressCoordinates::valid($latitude, $longitude));
    }

    public static function coordinatePairs(): array
    {
        return [
            [null, null, false], [14.55, null, false], [null, 121.02, false],
            ['', '', false], ['bad', 121, false], [INF, 121, false], [NAN, 121, false],
            [14.55, -INF, false], [91, 121, false], [14.55, 181, false],
            [-91, 121, false], [14.55, -181, false],
            [14.55, 121.02, true], ['14.5500000', '121.0200000', true],
            [0, 0, true], [-90, -180, true], [90, 180, true],
        ];
    }
}
