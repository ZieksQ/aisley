<?php

namespace App\Http\Controllers\Account;

use App\Http\Controllers\Controller;
use App\Http\Requests\Account\PasswordChangeCodeRequest;
use App\Services\Account\PasswordChangeVerification;
use Illuminate\Http\JsonResponse;

class PasswordChangeCodeController extends Controller
{
    public function __invoke(PasswordChangeCodeRequest $request, PasswordChangeVerification $verification): JsonResponse
    {
        return response()->json([
            'message' => 'A password verification email has been queued.',
            'data' => $verification->request($request->user(), $request->string('current_password')->value(), $request->string('password')->value()),
        ], 202)->header('Cache-Control', 'private, no-store');
    }
}
