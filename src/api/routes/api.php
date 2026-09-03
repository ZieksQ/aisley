<?php

use App\Http\Controllers\AddressOptionController;
use App\Http\Controllers\Admin\AccountController;
use App\Http\Controllers\Admin\AuditLogController;
use App\Http\Controllers\Admin\AuthController;
use App\Http\Controllers\Admin\DashboardController;
use App\Http\Controllers\Admin\NotificationController;
use App\Http\Controllers\Admin\PlatformSettingsController;
use App\Http\Controllers\Admin\RegistrationController;
use App\Http\Controllers\Admin\SellerComplianceController;
use App\Http\Controllers\Admin\UserAccountController;
use App\Http\Controllers\Customer\AddressController as CustomerAddressController;
use App\Http\Controllers\Customer\AuthController as CustomerAuthController;
use App\Http\Controllers\Customer\CartController;
use App\Http\Controllers\Customer\CheckoutController;
use App\Http\Controllers\Customer\HomepageController;
use App\Http\Controllers\Customer\OrderController;
use App\Http\Controllers\Customer\ProductDetailController;
use App\Http\Controllers\Customer\ProductSearchController;
use App\Http\Controllers\Customer\ShopBrowseController;
use App\Http\Controllers\Customer\WishlistController;
use App\Http\Controllers\PlatformContentController;
use App\Http\Controllers\ProductDescriptionAssetController;
use App\Http\Controllers\ProductMediaController;
use App\Http\Controllers\Seller\AccountController as SellerAccountController;
use App\Http\Controllers\Seller\AuthController as SellerAuthController;
use App\Http\Controllers\Seller\DashboardController as SellerDashboardController;
use App\Http\Controllers\Seller\InventoryController as SellerInventoryController;
use App\Http\Controllers\Seller\LowStockAlertController as SellerLowStockAlertController;
use App\Http\Controllers\Seller\ProductController as SellerProductController;
use App\Http\Controllers\Seller\ProductUploadController as SellerProductUploadController;
use App\Http\Controllers\Seller\RegistrationAddressController as SellerRegistrationAddressController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1/address-options')->name('address-options.')->middleware('throttle:60,1')->group(function () {
    Route::get('/regions', [AddressOptionController::class, 'regions'])->name('regions');
    Route::get('/provinces', [AddressOptionController::class, 'provinces'])->name('provinces');
    Route::get('/municipalities', [AddressOptionController::class, 'municipalities'])->name('municipalities');
    Route::get('/barangays', [AddressOptionController::class, 'barangays'])->name('barangays');
});

Route::prefix('v1/admin/auth')->name('admin.auth.')->group(function () {
    Route::post('/login', [AuthController::class, 'store'])->name('login');

    Route::middleware(['auth:sanctum', 'admin.active'])->group(function () {
        Route::get('/me', [AuthController::class, 'show'])->name('me');
        Route::post('/logout', [AuthController::class, 'destroy'])->name('logout');
    });
});

Route::prefix('v1/admin')->name('admin.')->middleware(['auth:sanctum', 'admin.active'])->group(function () {
    Route::prefix('seller-compliance')->name('seller-compliance.')->middleware('admin.permission:seller_compliance.manage')->group(function () {
        Route::get('/cases', [SellerComplianceController::class, 'index'])->name('index');
        Route::get('/options', [SellerComplianceController::class, 'options'])->name('options');
        Route::post('/cases', [SellerComplianceController::class, 'store'])->name('store');
        Route::get('/cases/{case}', [SellerComplianceController::class, 'show'])->whereUuid('case')->name('show');
        Route::post('/cases/{case}/dismiss', [SellerComplianceController::class, 'dismiss'])->whereUuid('case')->name('dismiss');
        Route::post('/cases/{case}/warn', [SellerComplianceController::class, 'warn'])->whereUuid('case')->name('warn');
        Route::post('/cases/{case}/restrict-product', [SellerComplianceController::class, 'restrictProduct'])->whereUuid('case')->name('restrict-product');
        Route::post('/cases/{case}/revoke-product-restriction', [SellerComplianceController::class, 'revokeProductRestriction'])->whereUuid('case')->name('revoke-product-restriction');
        Route::post('/cases/{case}/suspend-seller', [SellerComplianceController::class, 'suspendSeller'])->whereUuid('case')->name('suspend');
        Route::post('/cases/{case}/close', [SellerComplianceController::class, 'close'])->whereUuid('case')->name('close');
    });

    Route::prefix('users')->name('users.')->group(function () {
        Route::get('/', [UserAccountController::class, 'index'])->middleware('admin.permission:users.view')->name('index');
        Route::get('/{user}', [UserAccountController::class, 'show'])->middleware('admin.permission:users.view')->whereUuid('user')->name('show');
        Route::get('/{user}/history', [UserAccountController::class, 'history'])->middleware('admin.permission:users.view')->whereUuid('user')->name('history');
        Route::post('/{user}/suspend', [UserAccountController::class, 'suspend'])->middleware('admin.permission:users.manage')->whereUuid('user')->name('suspend');
        Route::post('/{user}/restore', [UserAccountController::class, 'restore'])->middleware('admin.permission:users.manage')->whereUuid('user')->name('restore');
        Route::post('/{user}/deactivate', [UserAccountController::class, 'deactivate'])->middleware('admin.permission:users.manage')->whereUuid('user')->name('deactivate');
    });

    Route::prefix('notifications')->name('notifications.')->middleware('admin.permission:notifications.view')->group(function () {
        Route::get('/', [NotificationController::class, 'index'])->name('index');
        Route::get('/unread-count', [NotificationController::class, 'unreadCount'])->name('unread-count');
        Route::post('/read-all', [NotificationController::class, 'markAllRead'])->name('read-all');
        Route::post('/{notification}/read', [NotificationController::class, 'markRead'])->whereUuid('notification')->name('read');
    });

    Route::get('/account', [AccountController::class, 'show'])->name('account.show');
    Route::patch('/account/profile', [AccountController::class, 'updateProfile'])->name('account.profile.update');
    Route::patch('/account/email', [AccountController::class, 'updateEmail'])->name('account.email.update');
    Route::put('/account/password', [AccountController::class, 'updatePassword'])->name('account.password.update');
    Route::post('/account/profile-photo', [AccountController::class, 'uploadProfilePhoto'])->middleware('throttle:10,1')->name('account.photo.store');
    Route::get('/account/profile-photo', [AccountController::class, 'profilePhoto'])->name('account.photo.show');
    Route::delete('/account/profile-photo', [AccountController::class, 'removeProfilePhoto'])->name('account.photo.destroy');

    Route::prefix('platform-settings')->name('platform-settings.')->group(function () {
        Route::get('/announcements', [PlatformSettingsController::class, 'announcements'])->middleware('admin.permission:platform-settings.view')->name('announcements.index');
        Route::post('/announcements', [PlatformSettingsController::class, 'storeAnnouncement'])->middleware('admin.permission:platform-settings.manage')->name('announcements.store');
        Route::patch('/announcements/{announcement}', [PlatformSettingsController::class, 'updateAnnouncement'])->middleware('admin.permission:platform-settings.manage')->whereUuid('announcement')->name('announcements.update');
        Route::post('/announcements/{announcement}/publish', [PlatformSettingsController::class, 'publishAnnouncement'])->middleware('admin.permission:platform-settings.manage')->whereUuid('announcement')->name('announcements.publish');
        Route::post('/announcements/{announcement}/archive', [PlatformSettingsController::class, 'archiveAnnouncement'])->middleware('admin.permission:platform-settings.manage')->whereUuid('announcement')->name('announcements.archive');
        Route::get('/policies', [PlatformSettingsController::class, 'policies'])->middleware('admin.permission:platform-settings.view')->name('policies.index');
        Route::post('/policies/{type}/versions', [PlatformSettingsController::class, 'storePolicyVersion'])->middleware('admin.permission:platform-settings.manage')->name('policies.versions.store');
        Route::post('/policy-versions/{version}/successor', [PlatformSettingsController::class, 'createPolicySuccessor'])->middleware('admin.permission:platform-settings.manage')->whereUuid('version')->name('policies.versions.successor');
        Route::patch('/policy-versions/{version}', [PlatformSettingsController::class, 'updatePolicyVersion'])->middleware('admin.permission:platform-settings.manage')->whereUuid('version')->name('policies.versions.update');
        Route::post('/policy-versions/{version}/publish', [PlatformSettingsController::class, 'publishPolicyVersion'])->middleware('admin.permission:platform-settings.manage')->whereUuid('version')->name('policies.versions.publish');
    });

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
    Route::prefix('address-options')->name('address-options.')->middleware('throttle:60,1')->group(function () {
        Route::get('/regions', [SellerRegistrationAddressController::class, 'regions'])->name('regions');
        Route::get('/provinces', [SellerRegistrationAddressController::class, 'provinces'])->name('provinces');
        Route::get('/municipalities', [SellerRegistrationAddressController::class, 'municipalities'])->name('municipalities');
        Route::get('/barangays', [SellerRegistrationAddressController::class, 'barangays'])->name('barangays');
    });
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
    Route::get('/account', [SellerAccountController::class, 'show'])->name('account.show');
    Route::patch('/account/profile', [SellerAccountController::class, 'updateProfile'])->name('account.profile.update');
    Route::patch('/account/storefront', [SellerAccountController::class, 'updateStorefront'])->name('account.storefront.update');
    Route::patch('/account/email', [SellerAccountController::class, 'updateEmail'])->name('account.email.update');
    Route::put('/account/password', [SellerAccountController::class, 'updatePassword'])->name('account.password.update');
    Route::post('/account/profile-photo', [SellerAccountController::class, 'uploadProfilePhoto'])->middleware('throttle:10,1')->name('account.photo.store');
    Route::get('/account/profile-photo', [SellerAccountController::class, 'profilePhoto'])->name('account.photo.show');
    Route::delete('/account/profile-photo', [SellerAccountController::class, 'removeProfilePhoto'])->name('account.photo.destroy');
    Route::get('/dashboard', [SellerDashboardController::class, 'show'])->name('dashboard.show');
    Route::get('/products/options', [SellerProductController::class, 'options'])->name('products.options');
    Route::post('/product-uploads', [SellerProductUploadController::class, 'store'])->middleware('throttle:30,1')->name('product-uploads.store');
    Route::get('/product-uploads/{productUpload}', [SellerProductUploadController::class, 'show'])->whereUuid('productUpload')->name('product-uploads.show');
    Route::get('/product-description-assets/{asset}', [SellerProductUploadController::class, 'description'])->whereUuid('asset')->name('product-description-assets.show');
    Route::get('/product-media/{media}', [SellerProductUploadController::class, 'media'])->whereUuid('media')->name('product-media.show');
    Route::get('/products', [SellerProductController::class, 'index'])->name('products.index');
    Route::post('/products', [SellerProductController::class, 'store'])->name('products.store');
    Route::get('/products/{product}', [SellerProductController::class, 'show'])->whereUuid('product')->name('products.show');
    Route::patch('/products/{product}', [SellerProductController::class, 'update'])->whereUuid('product')->name('products.update');
    Route::post('/products/{product}/publish', [SellerProductController::class, 'publish'])->whereUuid('product')->name('products.publish');
    Route::post('/products/{product}/archive', [SellerProductController::class, 'archive'])->whereUuid('product')->name('products.archive');
    Route::post('/products/{product}/unarchive', [SellerProductController::class, 'unarchive'])->whereUuid('product')->name('products.unarchive');
    Route::delete('/products/{product}', [SellerProductController::class, 'destroy'])->whereUuid('product')->name('products.destroy');
    Route::get('/inventory', [SellerInventoryController::class, 'index'])->name('inventory.index');
    Route::get('/inventory/{inventorySku}', [SellerInventoryController::class, 'show'])->whereUuid('inventorySku')->name('inventory.show');
    Route::get('/inventory/{inventorySku}/movements', [SellerInventoryController::class, 'movements'])->whereUuid('inventorySku')->name('inventory.movements');
    Route::post('/inventory/{inventorySku}/adjustments', [SellerInventoryController::class, 'adjust'])->whereUuid('inventorySku')->name('inventory.adjust');
    Route::patch('/inventory/{inventorySku}/threshold', [SellerInventoryController::class, 'threshold'])->whereUuid('inventorySku')->name('inventory.threshold');
    Route::get('/low-stock-alerts', [SellerLowStockAlertController::class, 'index'])->middleware('throttle:120,1')->name('low-stock-alerts.index');
    Route::get('/low-stock-alerts/{alert}', [SellerLowStockAlertController::class, 'show'])->middleware('throttle:120,1')->whereUuid('alert')->name('low-stock-alerts.show');
});

Route::get('v1/product-description-assets/{asset}', ProductDescriptionAssetController::class)
    ->whereUuid('asset')
    ->middleware('throttle:120,1')
    ->name('product-description-assets.show');
Route::get('v1/product-media/{media}', ProductMediaController::class)
    ->whereUuid('media')
    ->middleware('throttle:120,1')
    ->name('product-media.show');

Route::prefix('v1/customer')->name('customer.')->middleware('throttle:120,1')->group(function () {
    Route::get('/home', [HomepageController::class, 'show'])->name('home.show');
    Route::get('/home/recommendations', [HomepageController::class, 'recommendations'])
        ->name('home.recommendations');
    Route::get('/products/search', ProductSearchController::class)->name('products.search');
    Route::get('/shops', [ShopBrowseController::class, 'index'])->name('shops.index');
    Route::get('/shops/{slug}', [ShopBrowseController::class, 'show'])->name('shops.show');
    Route::get('/shops/{slug}/products', [ShopBrowseController::class, 'products'])->name('shops.products.index');

    Route::middleware(['auth:sanctum', 'customer.active'])->group(function () {
        Route::get('/addresses', [CustomerAddressController::class, 'index'])->name('addresses.index');
        Route::post('/addresses', [CustomerAddressController::class, 'store'])->name('addresses.store');
        Route::patch('/addresses/{address}', [CustomerAddressController::class, 'update'])
            ->whereUuid('address')
            ->name('addresses.update');
        Route::delete('/addresses/{address}', [CustomerAddressController::class, 'destroy'])
            ->whereUuid('address')
            ->name('addresses.destroy');
        Route::get('/cart', [CartController::class, 'show'])->name('cart.show');
        Route::post('/cart/items', [CartController::class, 'store'])->name('cart.items.store');
        Route::patch('/cart/items/{item}', [CartController::class, 'update'])
            ->whereUuid('item')
            ->name('cart.items.update');
        Route::delete('/cart/items/{item}', [CartController::class, 'destroy'])
            ->whereUuid('item')
            ->name('cart.items.destroy');
        Route::get('/wishlist/status', [WishlistController::class, 'status'])->name('wishlist.status');
        Route::get('/wishlist', [WishlistController::class, 'index'])->name('wishlist.index');
        Route::put('/wishlist/{product}', [WishlistController::class, 'store'])->whereUuid('product')->name('wishlist.store');
        Route::delete('/wishlist/{product}', [WishlistController::class, 'destroy'])->whereUuid('product')->name('wishlist.destroy');
        Route::post('/checkout/quote', [CheckoutController::class, 'quote'])->name('checkout.quote');
        Route::post('/checkout/place', [CheckoutController::class, 'place'])->name('checkout.place');
        Route::get('/checkout/{batch}', [CheckoutController::class, 'show'])
            ->whereUuid('batch')
            ->name('checkout.show');
        Route::get('/orders', [OrderController::class, 'index'])->name('orders.index');
        Route::get('/orders/{order}', [OrderController::class, 'show'])
            ->whereUuid('order')
            ->name('orders.show');
        Route::get('/orders/{order}/tracking', [OrderController::class, 'tracking'])
            ->whereUuid('order')
            ->name('orders.tracking');
    });
});

Route::get('v1/products/{id}', [ProductDetailController::class, 'show'])
    ->whereUuid('id')
    ->middleware('throttle:120,1')
    ->name('products.show');

Route::prefix('v1/platform')->name('platform.')->middleware('throttle:120,1')->group(function () {
    Route::get('/announcements', [PlatformContentController::class, 'announcements'])->name('announcements.index');
    Route::get('/policies/{type}/history/{version}', [PlatformContentController::class, 'policyHistoryVersion'])->whereNumber('version')->name('policies.history.show');
    Route::get('/policies/{type}/history', [PlatformContentController::class, 'policyHistory'])->name('policies.history.index');
    Route::get('/policies/{type}', [PlatformContentController::class, 'policy'])->name('policies.show');
});
