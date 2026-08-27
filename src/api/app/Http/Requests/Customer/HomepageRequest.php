<?php

namespace App\Http\Requests\Customer;

use Illuminate\Foundation\Http\FormRequest;

class HomepageRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $minimum = max(1, min(50, (int) config('homepage.discovery.min_page_size', 8)));
        $maximum = max($minimum, min(50, (int) config('homepage.discovery.max_page_size', 50)));

        return [
            'limit' => [
                'sometimes',
                'integer',
                'min:'.$minimum,
                'max:'.$maximum,
            ],
        ];
    }

    public function recommendationLimit(): int
    {
        $minimum = max(1, min(50, (int) config('homepage.discovery.min_page_size', 8)));
        $maximum = max($minimum, min(50, (int) config('homepage.discovery.max_page_size', 50)));
        $default = (int) config('homepage.discovery.default_page_size', 20);

        return max($minimum, min($maximum, (int) $this->input('limit', $default)));
    }
}
