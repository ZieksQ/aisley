<?php

namespace App\Http\Requests\Customer;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Validator;

class AskProductQuestionRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $this->merge(['question' => $this->normalize($this->input('question'))]);
    }

    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'question' => ['required', 'string', 'max:1000'],
        ];
    }

    /** @return list<callable> */
    public function after(): array
    {
        return [function (Validator $validator): void {
            foreach (array_diff(array_keys($this->all()), ['question']) as $field) {
                $validator->errors()->add($field, 'This field is not accepted for a Product question.');
            }

            $question = (string) $this->input('question', '');
            if ($this->containsUnsafeMarkup($question)) {
                $validator->errors()->add('question', 'Questions must be plain text without HTML, Markdown, or scripts.');
            }

            $key = $this->header('Idempotency-Key');
            if (! is_string($key) || ! Str::isUuid($key)) {
                $validator->errors()->add('idempotency_key', 'A UUID Idempotency-Key header is required.');
            }
        }];
    }

    public function idempotencyKey(): string
    {
        return (string) $this->header('Idempotency-Key');
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
