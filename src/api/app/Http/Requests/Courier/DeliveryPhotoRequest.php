<?php

namespace App\Http\Requests\Courier;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\File;
use Illuminate\Validation\Validator;

class DeliveryPhotoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'photo' => [
                'required',
                File::image()->types(['jpg', 'jpeg', 'png', 'webp'])->max(10 * 1024),
                'extensions:jpg,jpeg,png,webp',
                function (string $attribute, mixed $value, \Closure $fail): void {
                    if (! $value instanceof UploadedFile) {
                        return;
                    }
                    if ($value->getSize() >= 10 * 1024 * 1024) {
                        $fail('The photo must be smaller than 10 MB.');
                    }
                    if (count(explode('.', basename(str_replace('\\', '/', $value->getClientOriginalName())))) > 2) {
                        $fail('The photo filename must not contain multiple extensions.');
                    }
                },
            ],
            'expected_revision' => ['required', 'integer', 'min:1'],
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            foreach (array_diff(array_keys($this->all()), ['photo', 'expected_revision']) as $field) {
                $validator->errors()->add($field, 'This field is not accepted for delivery proof.');
            }
            if (! Str::isUuid((string) $this->header('Idempotency-Key'))) {
                $validator->errors()->add('idempotency_key', 'A UUID Idempotency-Key header is required.');
            }
        }];
    }

    public function idempotencyKey(): string
    {
        return (string) $this->header('Idempotency-Key');
    }
}
