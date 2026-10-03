<?php

namespace Tests\Support;

use App\Enums\AddressType;
use App\Enums\CategoryStatus;
use App\Enums\CourierAffiliationStatus;
use App\Enums\FulfillmentOfferStatus;
use App\Enums\FulfillmentTaskLeg;
use App\Enums\FulfillmentTaskStatus;
use App\Enums\OrderStatus;
use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Enums\ShopStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\CheckoutBatch;
use App\Models\CheckoutQuote;
use App\Models\DeliveryTask;
use App\Models\Order;
use App\Models\Parcel;
use App\Models\SellerPickupRequest;
use App\Models\Shipment;
use App\Models\Shop;
use App\Models\ShopCategory;
use App\Models\User;
use App\Models\Waybill;
use Illuminate\Support\Str;

trait CreatesOperationalMessagingContext
{
    /** @return array{User, User, DeliveryTask} */
    private function finalTask(): array
    {
        $logistics = $this->logistics();
        $organization = $logistics->logisticsOrganization;
        $hub = $organization->hub;
        $courier = User::factory()->create(['role' => UserRole::Courier, 'status' => UserStatus::Active]);
        $courier->courierProfile()->create(['first_name' => 'Cora', 'last_name' => 'Rider', 'contact_number' => '09173333333', 'sex' => 'female', 'birth_date' => '1994-01-01']);
        $courier->courierLogisticsAffiliation()->create([
            'logistics_organization_id' => $organization->id, 'logistics_hub_id' => $hub->id,
            'status' => CourierAffiliationStatus::Approved,
        ]);
        $seller = User::factory()->create(['role' => UserRole::Seller, 'status' => UserStatus::Active]);
        $category = ShopCategory::create(['name' => 'General', 'slug' => 'general', 'status' => CategoryStatus::Active]);
        $shop = Shop::create(['seller_id' => $seller->id, 'shop_category_id' => $category->id, 'name' => 'Seller Shop', 'slug' => 'seller-shop', 'status' => ShopStatus::Active]);
        $customer = User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Active]);
        $quote = CheckoutQuote::create(['customer_id' => $customer->id, 'input_payload' => [], 'request_hash' => str_repeat('a', 64), 'state_hash' => str_repeat('b', 64), 'expires_at' => now()->addHour()]);
        $batch = CheckoutBatch::create(['customer_id' => $customer->id, 'checkout_quote_id' => $quote->id, 'idempotency_key' => (string) Str::uuid(), 'request_hash' => str_repeat('c', 64), 'currency' => 'PHP', 'placed_at' => now()]);
        $order = Order::create(['checkout_batch_id' => $batch->id, 'customer_id' => $customer->id, 'shop_id' => $shop->id,
            'reference' => 'MSG-'.Str::upper(Str::random(8)), 'status' => OrderStatus::Placed,
            'payment_method' => PaymentMethod::CashOnDelivery, 'payment_status' => PaymentStatus::Pending,
            'currency' => 'PHP', 'merchandise_subtotal' => '100.00', 'shipping_fee' => '0.00', 'payable_total' => '100.00', 'placed_at' => now()]);
        $request = SellerPickupRequest::create(['shop_id' => $shop->id, 'seller_id' => $seller->id,
            'logistics_organization_id' => $organization->id, 'logistics_hub_id' => $hub->id,
            'status' => 'scheduled', 'idempotency_key' => (string) Str::uuid()]);
        $waybill = Waybill::create(['order_id' => $order->id, 'seller_pickup_request_id' => $request->id,
            'shop_id' => $shop->id, 'logistics_organization_id' => $organization->id, 'logistics_hub_id' => $hub->id,
            'reference' => 'WB-'.Str::upper(Str::random(8)), 'qr_token_hash' => str_repeat('d', 64), 'content_checksum' => str_repeat('e', 64)]);
        $parcel = Parcel::create(['order_id' => $order->id, 'waybill_id' => $waybill->id,
            'reference' => 'P-'.Str::upper(Str::random(8)), 'snapshot' => []]);
        $shipment = Shipment::create(['parcel_id' => $parcel->id, 'logistics_organization_id' => $organization->id,
            'logistics_hub_id' => $hub->id, 'status' => 'delivery_assigned']);
        $task = DeliveryTask::create(['shipment_id' => $shipment->id, 'leg' => FulfillmentTaskLeg::FinalMile,
            'status' => FulfillmentTaskStatus::DeliveryAssigned, 'courier_id' => $courier->id]);
        $task->offers()->create(['courier_id' => $courier->id, 'logistics_organization_id' => $organization->id,
            'offered_by_logistics_id' => $logistics->id, 'sequence' => 1, 'status' => FulfillmentOfferStatus::Offered,
            'idempotency_key' => (string) Str::uuid(), 'request_hash' => str_repeat('f', 64), 'offered_at' => now()]);

        return [$logistics, $courier, $task];
    }

    private function logistics(): User
    {
        $user = User::factory()->create(['role' => UserRole::Logistics, 'status' => UserStatus::Active]);
        $address = $user->addresses()->create(['type' => AddressType::Both, 'label' => 'Hub', 'recipient_name' => 'Operator',
            'contact_number' => '09172222222', 'address_line_1' => '1 Hub Road', 'barangay' => 'Poblacion',
            'city_municipality' => 'Manila', 'province' => 'Metro Manila', 'region' => 'NCR',
            'postal_code' => '1000', 'country' => 'PH', 'is_default' => true]);
        $organization = $user->logisticsOrganization()->create(['business_name' => 'Aisley Logistics']);
        $organization->hub()->create(['address_id' => $address->id, 'name' => 'Aisley Hub']);

        return $user;
    }
}
