<?php

namespace App\Http\Requests\Customer;

use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\UploadedFile;
use Illuminate\Validation\Rules\File;

class UploadAccountIdImageRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return [
            'id_image' => [
                'required',
                File::image()->types(['jpg', 'jpeg', 'png', 'webp'])->max(10 * 1024),
                'extensions:jpg,jpeg,png,webp',
                function (string $attribute, mixed $value, Closure $fail): void {
                    if (! $value instanceof UploadedFile) {
                        return;
                    }

                    if ($value->getSize() >= 10 * 1024 * 1024) {
                        $fail('The ID image must be smaller than 10 MB.');
                    }

                    $parts = explode('.', basename(str_replace('\\', '/', $value->getClientOriginalName())));
                    if (count($parts) > 2) {
                        $fail('The ID image filename must not contain multiple extensions.');
                    }
                },
            ],
            'id' => ['prohibited'],
            'user_id' => ['prohibited'],
            'role' => ['prohibited'],
            'status' => ['prohibited'],
            'id_number' => ['prohibited'],
            'id_type' => ['prohibited'],
            'verification_status' => ['prohibited'],
            'review_status' => ['prohibited'],
            'id_image_path' => ['prohibited'],
            'id_image_disk' => ['prohibited'],
            'id_image_mime' => ['prohibited'],
            'id_image_size' => ['prohibited'],
            'id_image_width' => ['prohibited'],
            'id_image_height' => ['prohibited'],
        ];
    }
}
