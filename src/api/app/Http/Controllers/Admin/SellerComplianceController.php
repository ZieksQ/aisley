<?php

namespace App\Http\Controllers\Admin;

use App\Enums\PlatformPolicyVersionStatus;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ListSellerComplianceCasesRequest;
use App\Http\Requests\Admin\SellerComplianceActionRequest;
use App\Http\Requests\Admin\StoreSellerComplianceCaseRequest;
use App\Http\Resources\Admin\SellerComplianceCaseDetailResource;
use App\Http\Resources\Admin\SellerComplianceCaseSummaryResource;
use App\Models\PlatformPolicyVersion;
use App\Models\Product;
use App\Models\SellerComplianceCase;
use App\Models\User;
use App\Services\Admin\SellerComplianceService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

class SellerComplianceController extends Controller
{
    public function __construct(private readonly SellerComplianceService $service) {}

    public function index(ListSellerComplianceCasesRequest $request): AnonymousResourceCollection
    {
        $query = SellerComplianceCase::query()->with($this->summaryRelations());
        $query
            ->when($request->filled('status'), fn (Builder $query) => $query->where('status', $request->string('status')->value()))
            ->when($request->filled('seller_id'), fn (Builder $query) => $query->where('seller_id', $request->string('seller_id')->value()))
            ->when($request->filled('product_id'), fn (Builder $query) => $query->where('product_id', $request->string('product_id')->value()))
            ->when($request->filled('policy_version_id'), fn (Builder $query) => $query->where('policy_version_id', $request->string('policy_version_id')->value()))
            ->when($request->filled('from'), fn (Builder $query) => $query->where('created_at', '>=', Carbon::parse($request->string('from')->value())->startOfDay()))
            ->when($request->filled('to'), fn (Builder $query) => $query->where('created_at', '<=', Carbon::parse($request->string('to')->value())->endOfDay()));

        if ($request->filled('search')) {
            $term = '%'.mb_strtolower(trim($request->string('search')->value())).'%';
            $query->where(function (Builder $query) use ($term): void {
                $query->whereRaw('LOWER(CAST(seller_compliance_cases.id AS VARCHAR)) LIKE ?', [$term])
                    ->orWhereRaw('LOWER(reason) LIKE ?', [$term])
                    ->orWhereHas('seller', fn (Builder $seller) => $seller->whereRaw('LOWER(email) LIKE ?', [$term])
                        ->orWhereHas('sellerProfile', fn (Builder $profile) => $profile->whereRaw('LOWER(first_name) LIKE ?', [$term])->orWhereRaw('LOWER(last_name) LIKE ?', [$term])))
                    ->orWhereHas('product', fn (Builder $product) => $product->whereRaw('LOWER(name) LIKE ?', [$term]));
            });
        }

        $direction = $request->input('sort', 'newest') === 'oldest' ? 'asc' : 'desc';

        return SellerComplianceCaseSummaryResource::collection(
            $query->orderBy('created_at', $direction)->orderBy('id', $direction)
                ->paginate((int) $request->input('per_page', 20))->withQueryString(),
        );
    }

    public function options(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'seller_search' => ['nullable', 'string', 'max:120'],
            'seller_id' => ['nullable', 'uuid'],
        ]);
        $term = isset($validated['seller_search']) ? '%'.mb_strtolower(trim($validated['seller_search'])).'%' : null;
        $sellers = User::query()->where('role', UserRole::Seller)->with(['sellerProfile', 'shop:id,seller_id,name'])
            ->when($term, fn (Builder $query) => $query->where(function (Builder $query) use ($term): void {
                $query->whereRaw('LOWER(email) LIKE ?', [$term])
                    ->orWhereHas('sellerProfile', fn (Builder $profile) => $profile->whereRaw('LOWER(first_name) LIKE ?', [$term])->orWhereRaw('LOWER(last_name) LIKE ?', [$term]))
                    ->orWhereHas('shop', fn (Builder $shop) => $shop->whereRaw('LOWER(name) LIKE ?', [$term]));
            }))
            ->latest()->limit(20)->get();

        $products = collect();
        if (! empty($validated['seller_id'])) {
            $seller = User::query()->whereKey($validated['seller_id'])->where('role', UserRole::Seller)->with('shop')->firstOrFail();
            $products = Product::query()->where('shop_id', $seller->shop?->id)->with('activeComplianceRestriction:id,product_id')->orderBy('name')->limit(100)->get();
        }

        $policies = PlatformPolicyVersion::query()->where('status', PlatformPolicyVersionStatus::Published)->with('policy')->orderByDesc('published_at')->get();

        return response()->json(['data' => [
            'sellers' => $sellers->map(fn (User $seller) => [
                'id' => $seller->id,
                'email' => $seller->email,
                'name' => trim(($seller->sellerProfile?->first_name ?? '').' '.($seller->sellerProfile?->last_name ?? '')) ?: $seller->email,
                'status' => $seller->status->value,
                'shop_name' => $seller->shop?->name,
            ]),
            'products' => $products->map(fn (Product $product) => [
                'id' => $product->id,
                'name' => $product->name,
                'status' => $product->status->value,
                'is_restricted' => $product->activeComplianceRestriction !== null,
            ]),
            'policies' => $policies->map(fn (PlatformPolicyVersion $version) => [
                'id' => $version->id,
                'title' => $version->title,
                'version' => $version->version,
                'type' => $version->policy->type->value,
            ]),
        ]]);
    }

    public function store(StoreSellerComplianceCaseRequest $request): JsonResource
    {
        return $this->detail($this->service->create($this->admin($request), $request->validated(), $this->context($request)), $request);
    }

    public function show(Request $request, SellerComplianceCase $case): JsonResource
    {
        return $this->detail($case, $request);
    }

    public function dismiss(SellerComplianceActionRequest $request, SellerComplianceCase $case): JsonResource
    {
        [$revision, $key, $reason] = $this->actionArguments($request);

        return $this->detail($this->service->dismiss($this->admin($request), $case, $revision, $key, $reason, $this->context($request)), $request);
    }

    public function warn(SellerComplianceActionRequest $request, SellerComplianceCase $case): JsonResource
    {
        [$revision, $key, $reason] = $this->actionArguments($request);

        return $this->detail($this->service->warn($this->admin($request), $case, $revision, $key, $reason, $this->context($request)), $request);
    }

    public function restrictProduct(SellerComplianceActionRequest $request, SellerComplianceCase $case): JsonResource
    {
        [$revision, $key, $reason] = $this->actionArguments($request);

        return $this->detail($this->service->restrictProduct($this->admin($request), $case, $revision, $key, $reason, $this->context($request)), $request);
    }

    public function revokeProductRestriction(SellerComplianceActionRequest $request, SellerComplianceCase $case): JsonResource
    {
        [$revision, $key, $reason] = $this->actionArguments($request);

        return $this->detail($this->service->revokeProductRestriction($this->admin($request), $case, $revision, $key, $reason, $this->context($request)), $request);
    }

    public function suspendSeller(SellerComplianceActionRequest $request, SellerComplianceCase $case): JsonResource
    {
        [$revision, $key, $reason] = $this->actionArguments($request);

        return $this->detail($this->service->suspendSeller($this->admin($request), $case, $revision, $key, $reason, (string) $request->input('confirmation'), $this->context($request)), $request);
    }

    public function close(SellerComplianceActionRequest $request, SellerComplianceCase $case): JsonResource
    {
        [$revision, $key, $reason] = $this->actionArguments($request);

        return $this->detail($this->service->close($this->admin($request), $case, $revision, $key, $reason, $this->context($request)), $request);
    }

    private function detail(SellerComplianceCase $case, Request $request): JsonResource
    {
        $case->load([...$this->summaryRelations(), 'actions.actor:id,email', 'restrictions']);

        return (new SellerComplianceCaseDetailResource($case))->additional(['meta' => ['request_id' => $this->requestId($request)]]);
    }

    private function summaryRelations(): array
    {
        return ['seller.sellerProfile', 'seller.shop', 'product.activeComplianceRestriction', 'policyVersion.policy', 'creator:id,email'];
    }

    private function admin(Request $request): User
    {
        /** @var User $admin */ $admin = $request->user();

        return $admin;
    }

    private function actionArguments(SellerComplianceActionRequest $request): array
    {
        return [(int) $request->input('expected_revision'), (string) $request->input('idempotency_key'), (string) $request->input('reason')];
    }

    private function context(Request $request): array
    {
        return ['ip_address' => $request->ip(), 'user_agent' => $request->userAgent(), 'request_id' => $this->requestId($request)];
    }

    private function requestId(Request $request): string
    {
        if (! $request->attributes->has('seller_compliance_request_id')) {
            $request->attributes->set('seller_compliance_request_id', Str::limit($request->header('X-Request-ID') ?: (string) Str::uuid7(), 64, ''));
        }

        return $request->attributes->get('seller_compliance_request_id');
    }
}
