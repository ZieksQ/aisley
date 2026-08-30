<?php

namespace App\Enums;

enum OrderStatus: string
{
    case PendingPayment = 'pending_payment';
    case Placed = 'placed';
    case SellerProcessing = 'seller_processing';
    case ReadyForPickup = 'ready_for_pickup';
    case Assigned = 'assigned';
    case PickedUp = 'picked_up';
    case InTransit = 'in_transit';
    case OutForDelivery = 'out_for_delivery';
    case Delivered = 'delivered';
    case Cancelled = 'cancelled';
    case Rejected = 'rejected';
    case DeliveryFailed = 'delivery_failed';
    case ReturnRequested = 'return_requested';
    case Returned = 'returned';
}
