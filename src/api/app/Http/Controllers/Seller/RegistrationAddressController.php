<?php

namespace App\Http\Controllers\Seller;

use App\Http\Controllers\Controller;
use App\Services\Seller\RegistrationAddressService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Throwable;

class RegistrationAddressController extends Controller
{
    public function __construct(private readonly RegistrationAddressService $addresses) {}

    public function regions(): JsonResponse
    {
        return $this->respond('regions');
    }

    public function provinces(Request $request): JsonResponse
    {
        $validated = $request->validate(['reg' => ['required', 'regex:/^\d{10}$/']]);

        return $this->respond('provinces', ['reg' => $validated['reg']]);
    }

    public function municipalities(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'reg' => ['required', 'regex:/^\d{10}$/'],
            'prv' => ['nullable', 'regex:/^\d{10}$/'],
        ]);
        $filters = ['reg' => $validated['reg']];

        if (! empty($validated['prv'])) {
            $filters['prv'] = $validated['prv'];
        }

        return $this->respond('municipalities', $filters);
    }

    public function barangays(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'reg' => ['required', 'regex:/^\d{10}$/'],
            'prv' => ['nullable', 'regex:/^\d{10}$/'],
            'mun' => ['required', 'regex:/^\d{10}$/'],
        ]);
        $filters = ['reg' => $validated['reg'], 'mun' => $validated['mun']];

        if (! empty($validated['prv'])) {
            $filters['prv'] = $validated['prv'];
        }

        return $this->respond('barangays', $filters);
    }

    /** @param array<string, string> $filters */
    private function respond(string $level, array $filters = []): JsonResponse
    {
        try {
            return response()->json(['options' => $this->addresses->options($level, $filters)]);
        } catch (Throwable) {
            return response()->json([
                'code' => 'ADDRESS_DATA_UNAVAILABLE',
                'message' => 'Address options are temporarily unavailable. Enter the address manually or try again later.',
            ], 503);
        }
    }
}
