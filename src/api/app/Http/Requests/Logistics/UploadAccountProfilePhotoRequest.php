<?php

namespace App\Http\Requests\Logistics;

use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\UploadedFile;
use Illuminate\Validation\Rules\File;
use Illuminate\Validation\Validator;

class UploadAccountProfilePhotoRequest extends FormRequest
{
    private const ALLOWED_FIELDS = ['photo'];

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
        ];
    }

    protected function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            foreach (array_diff(array_keys($this->all()), self::ALLOWED_FIELDS) as $field) {
                $validator->errors()->add($field, 'This field is not allowed.');
            }
        });
    }
}
