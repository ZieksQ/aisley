<?php

namespace App\Http\Controllers\Vouchers;

use App\Http\Controllers\Controller;
use App\Http\Requests\Vouchers\VoucherMutationRequest;
use App\Models\Voucher;
use App\Services\Vouchers\VoucherMutationService;
use App\Services\Vouchers\VoucherReadService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

abstract class AbstractVoucherController extends Controller
{
    abstract protected function resource(): string;

    public function index(Request $request, VoucherReadService $reads): JsonResponse
    {
        Gate::authorize('viewAny', Voucher::class);
        $filters = $request->validate([
            'search' => ['sometimes', 'nullable', 'string', 'max:64'],
            'benefit' => ['sometimes', 'nullable', Rule::in(['discount', 'shipping'])],
            'status' => ['sometimes', 'nullable', Rule::in(['draft', 'scheduled', 'active', 'paused', 'expired', 'exhausted', 'ended'])],
            'page' => ['sometimes', 'integer', 'min:1', 'max:100000'],
        ]);

        return $this->reply($reads->listing($request->user(), $filters));
    }

    public function show(Request $request, string $voucher, VoucherReadService $reads): JsonResponse
    {
        $record = $reads->scope($request->user())->whereKey($voucher)->firstOrFail();
        Gate::authorize('view', $record);
        $class = $this->resource();

        return $this->reply(['data' => (new $class($record))->resolve($request)]);
    }

    public function history(Request $request, string $voucher, string $kind, VoucherReadService $reads): JsonResponse
    {
        $request->validate(['page' => ['sometimes', 'integer', 'min:1', 'max:100000']]);
        $record = $reads->scope($request->user())->whereKey($voucher)->firstOrFail();
        Gate::authorize('view', $record);

        return $this->reply($reads->history($record, $kind));
    }

    protected function mutation(VoucherMutationRequest $request, string $action, ?string $voucher): JsonResponse
    {
        return $this->reply(app(VoucherMutationService::class)->execute($request->user(), $action, $voucher, $request->validated()), $action === 'create' || $action === 'duplicate' ? 201 : 200);
    }

    private function reply(array $data, int $status = 200): JsonResponse
    {
        return response()->json($data, $status)->header('Cache-Control', 'no-store, private');
    }
}
