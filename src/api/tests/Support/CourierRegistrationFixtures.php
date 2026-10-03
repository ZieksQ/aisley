<?php

namespace Tests\Support;

use App\Enums\AddressType;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\LogisticsOrganization;
use App\Models\User;
use Illuminate\Http\UploadedFile;

trait CourierRegistrationFixtures
{
    private function registrationOrganization(): LogisticsOrganization
    {
        $logistics = User::factory()->create(['role' => UserRole::Logistics, 'status' => UserStatus::Active]);
        $address = $logistics->addresses()->create([
            'type' => AddressType::Both, 'label' => 'Hub', 'recipient_name' => 'Logistics Operator',
            'contact_number' => '09171234567', 'address_line_1' => '1 Hub Road', 'barangay' => 'Poblacion',
            'city_municipality' => 'Makati City', 'province' => 'Metro Manila', 'region' => 'National Capital Region',
            'postal_code' => '1200', 'country' => 'Philippines', 'is_default' => true,
        ]);
        $organization = $logistics->logisticsOrganization()->create(['business_name' => 'Test Logistics']);
        $organization->hub()->create(['address_id' => $address->id, 'name' => 'Test hub']);

        return $organization;
    }

    private function registrationPayload(string $organizationId, string $email = 'courier@example.com'): array
    {
        return [
            'first_name' => 'Cora', 'last_name' => 'Rider', 'contact_number' => '09171234568',
            'sex' => 'female', 'birth_date' => '1994-06-15', 'email' => $email,
            'password' => 'CourierPassword123', 'password_confirmation' => 'CourierPassword123',
            'logistics_organization_id' => $organizationId, 'vehicle_type' => 'motorcycle', 'plate_number' => 'TEST-123',
            'address' => [
                'address_line_1' => '2 Courier Road', 'barangay' => 'Poblacion', 'city_municipality' => 'Makati City',
                'province' => 'Metro Manila', 'region' => 'National Capital Region', 'postal_code' => '1200',
            ],
            'government_id' => UploadedFile::fake()->image('government-id.jpg'),
            'vehicle_registration' => UploadedFile::fake()->image('vehicle-registration.jpg'),
        ];
    }

    private function duplicateRegistrationResponse(): array
    {
        return [
            'code' => 'EMAIL_ALREADY_REGISTERED',
            'message' => 'A Courier account with this email already exists.',
            'errors' => ['email' => ['A Courier account with this email already exists.']],
        ];
    }
}
