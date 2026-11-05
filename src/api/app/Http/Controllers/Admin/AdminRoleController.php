<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AdminManagementActionRequest;
use App\Http\Requests\Admin\MutateAdminRoleRequest;
use App\Http\Resources\Admin\AdminRoleResource;
use App\Models\AdminRole;
use App\Services\Admin\Provisioning\AdminRoleService;

class AdminRoleController extends Controller
{
    public function index()
    {
        return AdminRoleResource::collection(AdminRole::query()->with('permissions')->withCount('members')->orderBy('name')->get());
    }

    public function store(MutateAdminRoleRequest $request, AdminRoleService $service)
    {
        return (new AdminRoleResource($service->save($request->user(), $request->validated())))->response()->setStatusCode(201);
    }

    public function update(MutateAdminRoleRequest $request, AdminRole $adminRole, AdminRoleService $service): AdminRoleResource
    {
        return new AdminRoleResource($service->save($request->user(), $request->validated(), $adminRole));
    }

    public function destroy(AdminManagementActionRequest $request, AdminRole $adminRole, AdminRoleService $service)
    {
        $service->delete($request->user(), $adminRole, $request->integer('revision'), $request->string('current_password')->value());

        return response()->json(['message' => 'Role deleted.']);
    }
}
