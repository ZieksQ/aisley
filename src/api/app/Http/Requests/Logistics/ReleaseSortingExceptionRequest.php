<?php

namespace App\Http\Requests\Logistics;

class ReleaseSortingExceptionRequest extends OpenSortingSessionRequest
{
    public function rules(): array
    {
        return ['expected_revision' => ['required', 'integer', 'min:1'], 'reason' => ['required', 'string', 'min:3', 'max:1000']];
    }
}
