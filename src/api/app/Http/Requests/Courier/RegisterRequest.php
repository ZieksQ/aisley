<?php

namespace App\Http\Requests\Courier;

use App\Enums\UserSex;
use App\Enums\VehicleType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Enum;
use Illuminate\Validation\Rules\File;
use Illuminate\Validation\Rules\Password;

class RegisterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return ['first_name' => ['required', 'string', 'max:255'], 'last_name' => ['required', 'string', 'max:255'], 'middle_name' => ['nullable', 'string', 'max:1'], 'contact_number' => ['required', 'string', 'max:32'], 'sex' => ['required', new Enum(UserSex::class)], 'birth_date' => ['required', 'date', 'before:today'], 'email' => ['required', 'email', 'max:255'], 'password' => ['required', 'confirmed', Password::min(8)->mixedCase()->numbers()], 'logistics_organization_id' => ['required', 'uuid'], 'vehicle_type' => ['required', new Enum(VehicleType::class)], 'plate_number' => ['required', 'string', 'max:64'], 'address.address_line_1' => ['required', 'string', 'max:255'], 'address.address_line_2' => ['nullable', 'string', 'max:255'], 'address.barangay' => ['required', 'string', 'max:255'], 'address.city_municipality' => ['required', 'string', 'max:255'], 'address.province' => ['required', 'string', 'max:255'], 'address.region' => ['required', 'string', 'max:255'], 'address.postal_code' => ['required', 'string', 'max:10'], 'government_id' => $this->image(), 'vehicle_registration' => $this->image(), 'role' => ['prohibited'], 'status' => ['prohibited'], 'hub_id' => ['prohibited'], 'reviewer_id' => ['prohibited']];
    }

    private function image(): array
    {
        return ['required', File::image()->types(['jpg', 'jpeg', 'png', 'webp'])->max(10240), 'extensions:jpg,jpeg,png,webp', function (string $attribute, mixed $value, \Closure $fail): void {
            if ($value instanceof UploadedFile && $value->getSize() >= 10485760) {
                $fail("The {$attribute} must be smaller than 10 MB.");
            }
        }];
    }

    protected function prepareForValidation(): void
    {
        $this->merge(['email' => Str::lower(trim((string) $this->input('email')))]);
    }
}
