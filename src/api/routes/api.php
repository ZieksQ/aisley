<?php

use App\Http\Controllers\Admin\AuthController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1/admin/auth')->name('admin.auth.')->group(function () {
    Route::post('/login', [AuthController::class, 'store'])->name('login');

    Route::middleware(['auth:sanctum', 'admin.active'])->group(function () {
        Route::get('/me', [AuthController::class, 'show'])->name('me');
        Route::post('/logout', [AuthController::class, 'destroy'])->name('logout');
    });
});
