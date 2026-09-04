<?php

namespace App\Http\Requests\Admin;

use App\Enums\HomepageAdvertisementLayout;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreHomepageAdvertisementRequest extends FormRequest
{
    public function authorize(): bool { return true; }
    public function rules(): array
    {
        return [
            'layout' => ['required', Rule::enum(HomepageAdvertisementLayout::class)],
            'rotation_interval_seconds' => ['required', 'integer', 'between:3,20'],
            'ads' => ['required', 'array', 'min:1', 'max:8'],
            'ads.*.id' => ['nullable', 'uuid'],
            'ads.*.slot' => ['required', Rule::in(['primary', 'secondary_top', 'secondary_bottom'])],
            'ads.*.position' => ['required', 'integer', 'min:0', 'max:20'],
            'ads.*.title' => ['required', 'string', 'max:120'],
            'ads.*.description' => ['nullable', 'string', 'max:320'],
            'ads.*.image_desktop_path' => ['required', 'string', 'max:2048', 'url'],
            'ads.*.image_mobile_path' => ['nullable', 'string', 'max:2048', 'url'],
            'ads.*.alt_text' => ['required', 'string', 'max:160'],
            'ads.*.destination_url' => ['nullable', 'string', 'max:2048'],
            'ads.*.starts_at' => ['nullable', 'date'],
            'ads.*.ends_at' => ['nullable', 'date', 'after:ads.*.starts_at'],
            'ads.*.is_active' => ['required', 'boolean'],
        ];
    }
}
