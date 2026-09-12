<?php

namespace App\Http\Requests\Logistics;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class TransitionFulfillmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'reference' => ['required', 'string', 'max:128'],
            'target_state' => ['required', Rule::in([
                'received_at_hub', 'sorted_at_hub', 'dispatched_from_hub',
                'picked_up_from_hub', 'in_transit', 'out_for_delivery', 'delivered',
            ])],
            'expected_revision' => ['required', 'integer', 'min:1'],
            'evidence_id' => ['nullable', 'uuid'],
            'reason' => ['nullable', 'string', 'min:3', 'max:1000'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $input = [];
        if (! $this->has('target_state') && $this->has('target_status')) {
            $input['target_state'] = $this->input('target_status');
        }
        if (! $this->has('target_state') && $this->has('to_state')) {
            $input['target_state'] = $this->input('to_state');
        }
        if (! $this->has('reference') && $this->has('waybill_reference')) {
            $input['reference'] = $this->input('waybill_reference');
        }
        if (! $this->has('expected_revision') && $this->has('revision')) {
            $input['expected_revision'] = $this->input('revision');
        }
        if ($input !== []) {
            $this->merge($input);
        }
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            foreach (array_diff(array_keys($this->all()), ['reference', 'target_state', 'target_status', 'to_state', 'waybill_reference', 'expected_revision', 'revision', 'evidence_id', 'reason']) as $field) {
                $validator->errors()->add($field, 'This field is not accepted for a fulfillment transition.');
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
