<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Http\Requests\Customer\VoucherClaimRequest;
use App\Http\Requests\Customer\VoucherListRequest;
use App\Http\Requests\Customer\VoucherStatusRequest;
use App\Http\Resources\Customer\CustomerVoucherResource;
use App\Models\User;
use App\Services\Customer\ShopBrowseService;
use App\Services\Customer\Vouchers\VoucherCatalogue;
use App\Services\Customer\Vouchers\VoucherCollection;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\JsonResponse;

class CustomerVoucherController extends Controller
{
    public function __construct(private VoucherCatalogue $catalogue, private VoucherCollection $collection, private ShopBrowseService $shops) {}

    public function index(VoucherListRequest $request): JsonResponse
    {
        return $this->page($this->catalogue->listing($request->validated()));
    }

    public function show(string $voucher): JsonResponse
    {
        return $this->response(['data' => new CustomerVoucherResource($this->catalogue->detail($voucher))]);
    }

    public function shop(VoucherListRequest $request, string $slug): JsonResponse
    {
        return $this->page($this->catalogue->listing($request->validated(), $this->shops->findPublicShop($slug)));
    }

    public function mine(VoucherListRequest $request): JsonResponse
    {
        return $this->page($this->catalogue->mine($request->user(), $request->validated()), $request->user());
    }

    public function statuses(VoucherStatusRequest $request): JsonResponse
    {
        return $this->response(['items' => array_map(fn ($voucher) => new CustomerVoucherResource($voucher, $request->user()),
            $this->catalogue->statuses($request->user(), $request->validated('ids')))], true);
    }

    public function claim(VoucherClaimRequest $request, string $voucher): JsonResponse
    {
        return $this->response(['data' => new CustomerVoucherResource($this->collection->collect($request->user(), $voucher), $request->user())], true);
    }

    public function shopClaim(VoucherClaimRequest $request, string $slug, string $voucher): JsonResponse
    {
        $shop = $this->shops->findPublicShop($slug);

        return $this->response(['data' => new CustomerVoucherResource($this->collection->collect($request->user(), $voucher, $shop), $request->user())], true);
    }

    private function page(LengthAwarePaginator $page, ?User $customer = null): JsonResponse
    {
        return $this->response([
            'items' => $page->getCollection()->map(fn ($voucher) => new CustomerVoucherResource($voucher, $customer)),
            'pagination' => ['currentPage' => $page->currentPage(), 'lastPage' => $page->lastPage(), 'perPage' => $page->perPage(), 'total' => $page->total()],
        ], $customer !== null);
    }

    private function response(array $data, bool $private = false): JsonResponse
    {
        return response()->json($data)->withHeaders(['Cache-Control' => $private ? 'private, no-store' : 'public, max-age=60', 'Vary' => 'Accept, Authorization, Cookie']);
    }
}
