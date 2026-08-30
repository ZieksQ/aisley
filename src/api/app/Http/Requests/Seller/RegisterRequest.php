<?php

namespace App\Http\Requests\Seller;

use App\Enums\CategoryStatus;
use App\Enums\UserSex;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Enum;
use Illuminate\Validation\Rules\File;
use Illuminate\Validation\Rules\Password;

class RegisterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return [
            'first_name' => ['required', 'string', 'max:255'],
            'last_name' => ['required', 'string', 'max:255'],
            'middle_name' => ['nullable', 'string', 'max:1'],
            'contact_number' => ['required', 'string', 'max:32'],
            'sex' => ['required', new Enum(UserSex::class)],
            'birth_date' => ['required', 'date', 'before:today'],
            'business_name' => ['required', 'string', 'max:255'],
            'shop_category_id' => [
                'required',
                'uuid',
                Rule::exists('shop_categories', 'id')->where('status', CategoryStatus::Active->value),
            ],
            'address.address_line_1' => ['required', 'string', 'max:255'],
            'address.address_line_2' => ['nullable', 'string', 'max:255'],
            'address.barangay' => ['required', 'string', 'max:255'],
            'address.city_municipality' => ['required', 'string', 'max:255'],
            'address.province' => ['required', 'string', 'max:255'],
            'address.region' => ['required', 'string', 'max:255'],
            'address.postal_code' => ['required', 'string', 'max:10'],
            'address.latitude' => ['prohibited'],
            'address.longitude' => ['prohibited'],
            'government_id' => $this->evidenceRules(),
            'business_permit' => $this->evidenceRules(),
            'email' => ['required', 'string', 'email', 'max:255'],
            'password' => [
                'required',
                'string',
                'confirmed',
                Password::min(8)->mixedCase()->numbers(),
            ],
            'role' => ['prohibited'],
            'status' => ['prohibited'],
            'reviewer_id' => ['prohibited'],
            'shop_status' => ['prohibited'],
        ];
    }

    /** @return array<int, mixed> */
    private function evidenceRules(): array
    {
        return [
            'required',
            File::image()->types(['jpg', 'jpeg', 'png', 'webp'])->max(10 * 1024),
            'extensions:jpg,jpeg,png,webp',
            function (string $attribute, mixed $value, \Closure $fail): void {
                if ($value instanceof UploadedFile && $value->getSize() >= 10 * 1024 * 1024) {
                    $fail('The '.$attribute.' must be smaller than 10 MB.');
                }
            },
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'email' => Str::lower(trim((string) $this->input('email'))),
        ]);
    }
}
