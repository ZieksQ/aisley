<?php

namespace App\Enums;

enum ShipmentStatus: string
{
    case AwaitingSellerPickup = 'awaiting_seller_pickup';
    case SellerPickupAssigned = 'seller_pickup_assigned';
    case SellerPickupAccepted = 'seller_pickup_accepted';
    case PickedUpFromSeller = 'picked_up_from_seller';
    case ReceivedAtHub = 'received_at_hub';
    case SortedAtHub = 'sorted_at_hub';
    case DispatchedFromHub = 'dispatched_from_hub';
    case DeliveryAssigned = 'delivery_assigned';
    case DeliveryAccepted = 'delivery_accepted';
    case PickedUpFromHub = 'picked_up_from_hub';
    case InTransit = 'in_transit';
    case OutForDelivery = 'out_for_delivery';
    case Delivered = 'delivered';
}
