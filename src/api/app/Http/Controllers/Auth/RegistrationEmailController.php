<?php

namespace App\Http\Controllers\Auth;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\RegistrationEmailRequest;
use App\Services\Auth\RegistrationEmailVerification;
use Illuminate\Http\JsonResponse;

class RegistrationEmailController extends Controller
{
    public function config(RegistrationEmailVerification $verification): JsonResponse
    {
        return response()->json(['email_verification_required' => $verification->isRequired()])
            ->header('Cache-Control', 'no-store');
    }

    public function requestCode(RegistrationEmailRequest $request, RegistrationEmailVerification $verification): JsonResponse
    {
        return response()->json($verification->request(
            UserRole::from($request->route('registration_role')), $request->validated('email'),
        ))->header('Cache-Control', 'no-store');
    }

    public function verify(RegistrationEmailRequest $request, RegistrationEmailVerification $verification): JsonResponse
    {
        return response()->json($verification->verify(
            UserRole::from($request->route('registration_role')), $request->validated('email'),
            $request->validated('challenge_id'), $request->validated('verification_code'),
        ))->header('Cache-Control', 'no-store');
    }
}
