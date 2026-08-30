<?php

use App\Http\Controllers\Admin\AuditLogController;
use App\Http\Controllers\Admin\AuthController;
use App\Http\Controllers\Admin\DashboardController;
use App\Http\Controllers\Admin\RegistrationController;
use App\Http\Controllers\Customer\AuthController as CustomerAuthController;
use App\Http\Controllers\Customer\CartController;
use App\Http\Controllers\Customer\HomepageController;
use App\Http\Controllers\Customer\ProductDetailController;
use App\Http\Controllers\Customer\ProductSearchController;
use App\Http\Controllers\Seller\AuthController as SellerAuthController;
use App\Http\Controllers\Seller\DashboardController as SellerDashboardController;
use App\Http\Controllers\Seller\InventoryController as SellerInventoryController;
use App\Http\Controllers\Seller\ProductController as SellerProductController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1/admin/auth')->name('admin.auth.')->group(function () {
    Route::post('/login', [AuthController::class, 'store'])->name('login');

    Route::middleware(['auth:sanctum', 'admin.active'])->group(function () {
        Route::get('/me', [AuthController::class, 'show'])->name('me');
        Route::post('/logout', [AuthController::class, 'destroy'])->name('logout');
    });
});

Route::prefix('v1/admin')->name('admin.')->middleware(['auth:sanctum', 'admin.active'])->group(function () {
    Route::get('/dashboard', [DashboardController::class, 'show'])
        ->name('dashboard.show');

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
    Route::get('/registrations/{registration}/documents/{document}', [RegistrationController::class, 'document'])
        ->middleware('admin.permission:registrations.view')
        ->name('registrations.documents.show');
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

Route::prefix('v1/seller/auth')->name('seller.auth.')->group(function () {
    Route::get('/registration-options', [SellerAuthController::class, 'registrationOptions'])
        ->middleware('throttle:60,1')
        ->name('registration-options');
    Route::post('/register', [SellerAuthController::class, 'register'])->name('register');
    Route::post('/login', [SellerAuthController::class, 'login'])->name('login');
    Route::post('/forgot-password', [SellerAuthController::class, 'forgotPassword'])->name('password.email');
    Route::post('/reset-password', [SellerAuthController::class, 'resetPassword'])->name('password.update');

    Route::middleware(['auth:sanctum', 'seller.active'])->group(function () {
        Route::get('/me', [SellerAuthController::class, 'show'])->name('me');
        Route::post('/logout', [SellerAuthController::class, 'logout'])->name('logout');
    });
});

Route::prefix('v1/seller')->name('seller.')->middleware(['auth:sanctum', 'seller.active'])->group(function () {
    Route::get('/dashboard', [SellerDashboardController::class, 'show'])->name('dashboard.show');
    Route::get('/products/options', [SellerProductController::class, 'options'])->name('products.options');
    Route::get('/products', [SellerProductController::class, 'index'])->name('products.index');
    Route::post('/products', [SellerProductController::class, 'store'])->name('products.store');
    Route::get('/products/{product}', [SellerProductController::class, 'show'])->whereUuid('product')->name('products.show');
    Route::patch('/products/{product}', [SellerProductController::class, 'update'])->whereUuid('product')->name('products.update');
    Route::post('/products/{product}/publish', [SellerProductController::class, 'publish'])->whereUuid('product')->name('products.publish');
    Route::post('/products/{product}/archive', [SellerProductController::class, 'archive'])->whereUuid('product')->name('products.archive');
    Route::get('/inventory', [SellerInventoryController::class, 'index'])->name('inventory.index');
    Route::get('/inventory/{inventorySku}', [SellerInventoryController::class, 'show'])->whereUuid('inventorySku')->name('inventory.show');
    Route::get('/inventory/{inventorySku}/movements', [SellerInventoryController::class, 'movements'])->whereUuid('inventorySku')->name('inventory.movements');
    Route::post('/inventory/{inventorySku}/adjustments', [SellerInventoryController::class, 'adjust'])->whereUuid('inventorySku')->name('inventory.adjust');
    Route::patch('/inventory/{inventorySku}/threshold', [SellerInventoryController::class, 'threshold'])->whereUuid('inventorySku')->name('inventory.threshold');
});

Route::prefix('v1/customer')->name('customer.')->middleware('throttle:120,1')->group(function () {
    Route::get('/home', [HomepageController::class, 'show'])->name('home.show');
    Route::get('/home/recommendations', [HomepageController::class, 'recommendations'])
        ->name('home.recommendations');
    Route::get('/products/search', ProductSearchController::class)->name('products.search');

    Route::middleware(['auth:sanctum', 'customer.active'])->group(function () {
        Route::get('/cart', [CartController::class, 'show'])->name('cart.show');
        Route::post('/cart/items', [CartController::class, 'store'])->name('cart.items.store');
        Route::patch('/cart/items/{item}', [CartController::class, 'update'])
            ->whereUuid('item')
            ->name('cart.items.update');
        Route::delete('/cart/items/{item}', [CartController::class, 'destroy'])
            ->whereUuid('item')
            ->name('cart.items.destroy');
    });
});

Route::get('v1/products/{id}', [ProductDetailController::class, 'show'])
    ->whereUuid('id')
    ->middleware('throttle:120,1')
    ->name('products.show');
