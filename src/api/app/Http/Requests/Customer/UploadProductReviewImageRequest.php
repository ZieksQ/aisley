<?php

namespace App\Http\Requests\Customer;

use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\UploadedFile;
use Illuminate\Validation\Rules\File;
use Illuminate\Validation\Validator;

class UploadProductReviewImageRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return [
            'image' => [
                'required',
                File::image()->types(['jpg', 'jpeg', 'png', 'webp'])->max(10 * 1024),
                'extensions:jpg,jpeg,png,webp',
                function (string $attribute, mixed $value, Closure $fail): void {
                    if (! $value instanceof UploadedFile) {
                        return;
                    }

                    if ($value->getSize() >= (int) config('customer.reviews.image_max_bytes')) {
                        $fail('The image must be smaller than 10 MiB.');
                    }

                    $parts = explode('.', basename(str_replace('\\', '/', $value->getClientOriginalName())));
                    if (count($parts) !== 2) {
                        $fail('The image filename must have one valid extension.');
                    }
                },
            ],
        ];
    }

    /** @return list<callable> */
    public function after(): array
    {
        return [function (Validator $validator): void {
            foreach (array_diff(array_keys($this->all()), ['image']) as $field) {
                $validator->errors()->add($field, 'This field is not accepted for a Product review image.');
            }
        }];
    }

    protected function prepareForValidation(): void
    {
        foreach (array_diff(array_keys($this->all()), ['image']) as $field) {
            $this->merge([$field => $this->input($field)]);
        }
    }
}
