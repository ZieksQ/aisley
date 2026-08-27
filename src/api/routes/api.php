<?php

use App\Http\Controllers\Admin\AuthController;
use App\Http\Controllers\Customer\AuthController as CustomerAuthController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1/admin/auth')->name('admin.auth.')->group(function () {
    Route::post('/login', [AuthController::class, 'store'])->name('login');

    Route::middleware(['auth:sanctum', 'admin.active'])->group(function () {
        Route::get('/me', [AuthController::class, 'show'])->name('me');
        Route::post('/logout', [AuthController::class, 'destroy'])->name('logout');
    });
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
