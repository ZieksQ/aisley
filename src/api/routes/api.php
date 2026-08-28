<?php

use App\Http\Controllers\Admin\AuditLogController;
use App\Http\Controllers\Admin\AuthController;
use App\Http\Controllers\Admin\RegistrationController;
use App\Http\Controllers\Customer\AuthController as CustomerAuthController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1/admin/auth')->name('admin.auth.')->group(function () {
    Route::post('/login', [AuthController::class, 'store'])->name('login');

    Route::middleware(['auth:sanctum', 'admin.active'])->group(function () {
        Route::get('/me', [AuthController::class, 'show'])->name('me');
        Route::post('/logout', [AuthController::class, 'destroy'])->name('logout');
    });
});

Route::prefix('v1/admin')->name('admin.')->middleware(['auth:sanctum', 'admin.active'])->group(function () {
    Route::get('/audit-logs', [AuditLogController::class, 'index'])
        ->middleware('admin.permission:audit-logs.view')
        ->name('audit-logs.index');
    Route::get('/audit-logs/options', [AuditLogController::class, 'options'])
        ->middleware('admin.permission:audit-logs.view')
        ->name('audit-logs.options');
    Route::get('/audit-logs/{auditLog}', [AuditLogController::class, 'show'])
        ->middleware('admin.permission:audit-logs.view')
        ->name('audit-logs.show');

    Route::get('/registrations', [RegistrationController::class, 'index'])
        ->middleware('admin.permission:registrations.view')
        ->name('registrations.index');
    Route::get('/registrations/{registration}', [RegistrationController::class, 'show'])
        ->middleware('admin.permission:registrations.view')
        ->name('registrations.show');
    Route::post('/registrations/{registration}/approve', [RegistrationController::class, 'approve'])
        ->middleware('admin.permission:registrations.review')
        ->name('registrations.approve');
    Route::post('/registrations/{registration}/reject', [RegistrationController::class, 'reject'])
        ->middleware('admin.permission:registrations.review')
        ->name('registrations.reject');
});

Route::prefix('v1/customer/auth')->name('customer.auth.')->group(function () {
    Route::post('/register', [CustomerAuthController::class, 'register'])->name('register');
    Route::post('/login', [CustomerAuthController::class, 'login'])->name('login');
    Route::post('/forgot-password', [CustomerAuthController::class, 'forgotPassword'])->name('password.email');
    Route::post('/reset-password', [CustomerAuthController::class, 'resetPassword'])->name('password.update');

    Route::middleware(['auth:sanctum', 'customer.active'])->group(function () {
        Route::get('/me', [CustomerAuthController::class, 'show'])->name('me');
        Route::post('/logout', [CustomerAuthController::class, 'logout'])->name('logout');
    });
});
