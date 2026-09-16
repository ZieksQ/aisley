<?php

namespace App\Http\Requests\Logistics;

class MoveSortingLaneRequest extends OpenSortingSessionRequest
{
    public function rules(): array
    {
        return [
            'lane_id' => ['required', 'uuid'],
            'expected_revision' => ['required', 'integer', 'min:1'],
            'expected_lane_revision' => ['required', 'integer', 'min:1'],
            'reason' => ['required', 'string', 'min:2', 'max:500'],
        ];
    }
}
