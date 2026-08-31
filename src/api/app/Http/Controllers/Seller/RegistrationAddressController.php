<?php

namespace App\Http\Controllers\Seller;

use App\Http\Controllers\Controller;
use App\Services\Seller\PsgcAddressService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Throwable;

class RegistrationAddressController extends Controller
{
    public function __construct(private readonly PsgcAddressService $psgc) {}

    public function regions(): JsonResponse
    {
        return $this->respond('regions');
    }

    public function provinces(Request $request): JsonResponse
    {
        $validated = $request->validate(['reg' => ['required', 'regex:/^\d{1,3}$/']]);

        return $this->respond('provinces', ['reg' => $validated['reg']]);
    }

    public function municipalities(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'reg' => ['required', 'regex:/^\d{1,3}$/'],
            'prv' => ['nullable', 'regex:/^\d{1,3}$/'],
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
            'reg' => ['required', 'regex:/^\d{1,3}$/'],
            'prv' => ['nullable', 'regex:/^\d{1,3}$/'],
            'mun' => ['required', 'regex:/^\d{1,3}$/'],
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
            return response()->json(['options' => $this->psgc->options($level, $filters)]);
        } catch (Throwable) {
            return response()->json([
                'code' => 'PSGC_UNAVAILABLE',
                'message' => 'Address options are temporarily unavailable. Enter the address manually or try again later.',
            ], 503);
        }
    }
}
