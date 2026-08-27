<?php

namespace App\Enums;

enum DocumentType: string
{
    case GovernmentId = 'government_id';
    case BusinessRegistration = 'business_registration';
    case TaxDocument = 'tax_document';
    case DriversLicense = 'drivers_license';
    case VehicleRegistration = 'vehicle_registration';
    case ProofOfAddress = 'proof_of_address';
    case Other = 'other';
}
