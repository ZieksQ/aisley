<?php

namespace App\Http\Controllers\Admin;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AdminManagementActionRequest;
use App\Http\Requests\Admin\ProvisionAdminRequest;
use App\Http\Resources\Admin\ManagedAdminResource;
use App\Models\Permission;
use App\Models\User;
use App\Services\Admin\Provisioning\AdminProvisioningService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdminProvisioningController extends Controller
{
    public function index(Request $request)
    {
        $data = $request->validate(['search' => ['nullable', 'string', 'max:255'], 'status' => ['nullable', Rule::in(['active', 'suspended', 'archived', 'all'])], 'page' => ['nullable', 'integer', 'min:1']]);
        $status = $data['status'] ?? 'active';
        $query = User::query()->where('role', UserRole::Admin)->with('adminProfile');
        if ($status === 'archived') {
            $query->whereNotNull('admin_archived_at');
        } elseif ($status !== 'all') {
            $query->whereNull('admin_archived_at')->where('status', $status);
        }
        if ($search = $data['search'] ?? '') {
            $query->where(fn ($q) => $q->whereRaw('lower(email) like ?', ['%'.mb_strtolower($search).'%'])
                ->orWhereHas('adminProfile', fn ($p) => $p->whereRaw('lower(first_name) like ?', ['%'.mb_strtolower($search).'%'])->orWhereRaw('lower(last_name) like ?', ['%'.mb_strtolower($search).'%'])));
        }

        return ManagedAdminResource::collection($query->orderBy('created_at')->orderBy('id')->paginate(20));
    }

    public function show(User $adminAccount): ManagedAdminResource
    {
        abort_unless($adminAccount->role === UserRole::Admin, 404);

        return new ManagedAdminResource($adminAccount);
    }

    public function store(ProvisionAdminRequest $request, AdminProvisioningService $service)
    {
        return (new ManagedAdminResource($service->create($request->user(), $request->validated())))->response()->setStatusCode(201);
    }

    public function update(ProvisionAdminRequest $request, User $adminAccount, AdminProvisioningService $service): ManagedAdminResource
    {
        return new ManagedAdminResource($service->update($request->user(), $adminAccount, $request->validated()));
    }

    public function action(AdminManagementActionRequest $request, User $adminAccount, string $operation, AdminProvisioningService $service): ManagedAdminResource
    {
        return new ManagedAdminResource($service->status($request->user(), $adminAccount, $operation, $request->integer('revision'), $request->string('current_password')->value()));
    }

    public function permissions()
    {
        return response()->json(['data' => Permission::query()->orderBy('slug')->get(['slug', 'name', 'description'])]);
    }
}
