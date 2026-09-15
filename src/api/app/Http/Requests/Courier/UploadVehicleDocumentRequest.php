<?php

namespace App\Http\Requests\Courier;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\File;
use Illuminate\Validation\Validator;

class UploadVehicleDocumentRequest extends FormRequest
{
    private const ALLOWED_FIELDS = ['file', 'expected_revision'];

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'file' => [
                'required',
                File::image()->types(['jpg', 'jpeg', 'png', 'webp'])->max(10 * 1024),
                'extensions:jpg,jpeg,png,webp',
                function (string $attribute, mixed $value, \Closure $fail): void {
                    if (! $value instanceof UploadedFile) {
                        return;
                    }
                    if ($value->getSize() >= 10 * 1024 * 1024) {
                        $fail('The document must be smaller than 10 MB.');
                    }
                    $parts = explode('.', basename(str_replace('\\', '/', $value->getClientOriginalName())));
                    if (count($parts) > 2) {
                        $fail('The document filename must not contain multiple extensions.');
                    }
                },
            ],
            'expected_revision' => ['required', 'integer', 'min:1'],
        ];
    }

    protected function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            foreach (array_diff(array_keys($this->all()), self::ALLOWED_FIELDS) as $field) {
                $validator->errors()->add($field, 'This field is not allowed.');
            }
            if (! Str::isUuid((string) $this->header('Idempotency-Key'))) {
                $validator->errors()->add('idempotency_key', 'A UUID Idempotency-Key header is required.');
            }
        });
    }

    public function idempotencyKey(): string
    {
        return (string) $this->header('Idempotency-Key');
    }
}
