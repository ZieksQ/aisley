<?php

namespace App\Http\Requests\Vouchers;

use App\Services\Vouchers\VoucherReadService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

abstract class VoucherMutationRequest extends FormRequest
{
    private ?string $publishedCode = null;

    protected function prepareForValidation(): void
    {
        $this->merge(['idempotency_key' => $this->header('Idempotency-Key')]);
        if ($id = $this->route('voucher')) {
            $record = app(VoucherReadService::class)->scope($this->user())->whereKey($id)->firstOrFail();
            $this->publishedCode = $record->lifecycle->value === 'draft' ? null : $record->code;
        }
        if ($this->has('code') && is_string($this->input('code')) && $this->input('code') !== $this->publishedCode) {
            $this->merge(['code' => trim(preg_replace('/[^A-Z0-9-]+/', '-', strtoupper(trim($this->input('code')))), '-')]);
        }
        if ($this->hasTerms()) {
            $this->merge(array_replace([
                'currency' => 'PHP', 'payment_method' => 'cod', 'minimum_spend' => '0.00',
                'per_customer_limit' => 1, 'global_limit' => null, 'maximum_discount' => null, 'stacking' => false,
            ], $this->all()));
        }
    }

    public function authorize(): bool
    {
        // Role, approval, consent and permissions are enforced by middleware/policy.
        return true;
    }

    public function hasTerms(): bool
    {
        return $this->isMethod('PUT') || ($this->isMethod('POST') && ! $this->route('voucher'));
    }

    abstract protected function benefits(): array;

    public function rules(): array
    {
        $rules = ['revision' => ['required', 'integer', 'min:0', 'max:2147483647'], 'idempotency_key' => ['required', 'uuid']];
        if (! $this->hasTerms()) {
            return $rules;
        }

        return [...$rules,
            'code' => ['sometimes', 'nullable', 'string', 'max:64', ...($this->publishedCode !== null && $this->input('code') === $this->publishedCode ? [] : ['regex:/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/'])],
            'currency' => ['required', Rule::in(['PHP'])],
            'payment_method' => ['required', Rule::in(['cod'])],
            'benefit_type' => ['required', Rule::in($this->benefits())],
            'value_type' => ['required', Rule::in(['fixed', 'percent'])],
            'value' => ['required', 'numeric', 'decimal:0,2', 'min:0.01', 'max:9999999999.99'],
            'maximum_discount' => ['nullable', 'numeric', 'decimal:0,2', 'min:0.01', 'max:9999999999.99'],
            'minimum_spend' => ['required', 'numeric', 'decimal:0,2', 'min:0', 'max:9999999999.99'],
            'starts_at' => ['required', 'date', 'regex:/T.*(?:Z|[+-]\d{2}:\d{2})$/'],
            'ends_at' => ['required', 'date', 'after:starts_at', 'regex:/T.*(?:Z|[+-]\d{2}:\d{2})$/'],
            'global_limit' => ['nullable', 'integer', 'min:1', 'max:2147483647'],
            'per_customer_limit' => ['required', 'integer', 'min:1', 'max:2147483647'],
            'stacking' => ['required', 'boolean'],
            'terms_summary' => ['required', 'string', 'max:5000'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            foreach (array_diff(array_keys($this->all()), array_keys($this->rules())) as $field) {
                $validator->errors()->add($field, 'This field cannot be supplied.');
            }
            if ($this->input('value_type') === 'percent' && is_numeric($this->input('value')) && (float) $this->input('value') > 100) {
                $validator->errors()->add('value', 'A percentage cannot exceed 100.');
            }
            if ($this->hasTerms() && is_string($this->input('terms_summary')) && preg_match('/[<>]/', $this->input('terms_summary'))) {
                $validator->errors()->add('terms_summary', 'Use plain text without markup.');
            }
        });
    }
}
