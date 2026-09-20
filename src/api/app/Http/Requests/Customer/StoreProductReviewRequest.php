<?php

namespace App\Http\Requests\Customer;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class StoreProductReviewRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $this->merge(['body' => $this->normalize($this->input('body'))]);
    }

    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'rating' => ['required', 'integer', 'min:1', 'max:5'],
            'body' => ['required', 'string', 'max:2000'],
        ];
    }

    /** @return list<callable> */
    public function after(): array
    {
        return [function (Validator $validator): void {
            foreach (array_diff(array_keys($this->all()), ['rating', 'body']) as $field) {
                $validator->errors()->add($field, 'This field is not accepted for a Product review.');
            }

            $body = (string) $this->input('body', '');
            if ($this->containsUnsafeMarkup($body)) {
                $validator->errors()->add('body', 'Reviews must be plain text without HTML, Markdown, or scripts.');
            }
        }];
    }

    private function normalize(mixed $value): string
    {
        $text = trim((string) $value);
        if (class_exists(\Normalizer::class)) {
            $normalized = \Normalizer::normalize($text, \Normalizer::FORM_C);
            if (is_string($normalized)) {
                $text = $normalized;
            }
        }

        return preg_replace('/\R/u', "\n", $text) ?? $text;
    }

    private function containsUnsafeMarkup(string $value): bool
    {
        return preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]|<[^>]*>|!\[[^\]]*\]\([^)]*\)|\[[^\]]+\]\([^)]*\)|`|(?:^|\s)(?:#{1,6}\s|[-*+]\s|\d+\.\s)/u', $value) === 1;
    }
}
