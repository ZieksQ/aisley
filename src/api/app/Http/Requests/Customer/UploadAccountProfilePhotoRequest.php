<?php

namespace App\Http\Requests\Customer;

use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\UploadedFile;
use Illuminate\Validation\Rules\File;

class UploadAccountProfilePhotoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return [
            'photo' => [
                'required',
                File::image()->types(['jpg', 'jpeg', 'png', 'webp'])->max(10 * 1024),
                'extensions:jpg,jpeg,png,webp',
                function (string $attribute, mixed $value, Closure $fail): void {
                    if (! $value instanceof UploadedFile) {
                        return;
                    }

                    if ($value->getSize() >= 10 * 1024 * 1024) {
                        $fail('The profile photo must be smaller than 10 MB.');
                    }

                    $parts = explode('.', basename(str_replace('\\', '/', $value->getClientOriginalName())));
                    if (count($parts) > 2) {
                        $fail('The profile photo filename must not contain multiple extensions.');
                    }
                },
            ],
            'id' => ['prohibited'],
            'user_id' => ['prohibited'],
            'role' => ['prohibited'],
            'status' => ['prohibited'],
            'profile_photo_path' => ['prohibited'],
            'profile_photo_disk' => ['prohibited'],
            'profile_photo_mime' => ['prohibited'],
            'profile_photo_size' => ['prohibited'],
            'profile_photo_width' => ['prohibited'],
            'profile_photo_height' => ['prohibited'],
        ];
    }
}
