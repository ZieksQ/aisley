<?php

namespace App\Enums;

enum ShipmentEvidencePurpose: string
{
    case HubPickup = 'hub_pickup';
    case DeliveryProof = 'delivery_proof';
}
