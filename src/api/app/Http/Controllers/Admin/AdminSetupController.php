<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AdminSetupRequest;
use App\Http\Resources\Admin\AdminUserResource;
use App\Services\Admin\Provisioning\AdminSetupService;
use Illuminate\Http\Request;

class AdminSetupController extends Controller
{
    public function show(Request $request)
    {
        return response()->json(['admin' => new AdminUserResource($request->user()->load('adminProfile'))]);
    }

    public function code(AdminSetupRequest $request, AdminSetupService $service)
    {
        return response()->json(['data' => $service->request($request->user(), $request->validated())]);
    }

    public function complete(AdminSetupRequest $request, AdminSetupService $service)
    {
        $admin = $service->complete($request->user(), $request->validated());
        $request->session()->regenerate();
        $request->session()->put('admin_session_version', $admin->admin_session_version);

        return response()->json(['admin' => new AdminUserResource($admin->load('adminProfile')), 'message' => 'Account setup complete.']);
    }
}
