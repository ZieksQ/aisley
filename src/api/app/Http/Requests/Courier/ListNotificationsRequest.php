<?php

namespace App\Http\Requests\Courier;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class ListNotificationsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return [
            'status' => ['sometimes', 'in:all,unread,read'],
            'limit' => ['sometimes', 'integer', 'min:1', 'max:20'],
            'cursor' => ['sometimes', 'string', 'max:1024'],
        ];
    }

    /** @return list<callable> */
    public function after(): array
    {
        return [function (Validator $validator): void {
            foreach (array_diff(array_keys($this->query()), ['status', 'limit', 'cursor']) as $field) {
                $validator->errors()->add($field, "The {$field} notification filter is not supported.");
            }
            foreach (array_keys($this->request->all()) as $field) {
                $validator->errors()->add($field, "The {$field} field is not supported.");
            }
        }];
    }

    public function status(): string
    {
        return (string) $this->validated('status', 'all');
    }

    public function limit(): int
    {
        return (int) $this->validated('limit', 20);
    }

    public function cursor(): ?string
    {
        $cursor = $this->validated('cursor');

        return is_string($cursor) && $cursor !== '' ? $cursor : null;
    }
}
