<?php

namespace App\Enums;

enum FulfillmentTaskStatus: string
{
    case AwaitingSellerPickup = 'awaiting_seller_pickup';
    case SellerPickupAssigned = 'seller_pickup_assigned';
    case SellerPickupAccepted = 'seller_pickup_accepted';
    case PickedUpFromSeller = 'picked_up_from_seller';
    case DeliveryAssigned = 'delivery_assigned';
    case DeliveryAccepted = 'delivery_accepted';
    case PickedUpFromHub = 'picked_up_from_hub';
    case InTransit = 'in_transit';
    case OutForDelivery = 'out_for_delivery';
    case Delivered = 'delivered';
    case Rejected = 'rejected';

    /** Accepted final-mile states that can report a doorstep delivery. */
    public static function deliverySubmissionValues(): array
    {
        return [self::DeliveryAccepted->value, self::PickedUpFromHub->value, self::InTransit->value, self::OutForDelivery->value];
    }

    public function canSubmitDelivery(): bool
    {
        return in_array($this->value, self::deliverySubmissionValues(), true);
    }
}
