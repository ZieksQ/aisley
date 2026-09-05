<?php

namespace App\Http\Requests\Admin;

use App\Enums\HomepageAdvertisementLayout;
use App\Services\Admin\HomepageAdvertisementImageService;
use App\Support\SafeHomepageDestination;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreHomepageAdvertisementRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'tag_title' => ['required', 'string', 'max:120'],
            'layout' => ['required', Rule::enum(HomepageAdvertisementLayout::class)],
            'rotation_interval_seconds' => ['required', 'integer', 'between:3,20'],
            'starts_at' => ['nullable', 'date', 'required_with:ends_at'],
            'ends_at' => ['nullable', 'date', 'required_with:starts_at', 'after:starts_at'],
            'ads' => ['required', 'array', 'min:1', 'max:8'],
            'ads.*.id' => ['nullable', 'uuid'],
            'ads.*.slot' => ['required', Rule::in(['primary', 'secondary_top', 'secondary_bottom'])],
            'ads.*.position' => ['required', 'integer', 'min:0', 'max:20'],
            'ads.*.image_desktop_path' => ['required', 'string', 'max:512', function (string $attribute, mixed $value, \Closure $fail): void {
                if (! HomepageAdvertisementImageService::looksLikeStoredPath($value)) {
                    $fail('Insert a JPEG, PNG, or WebP image before saving this advertisement.');
                }
            }],
            'ads.*.image_desktop_filename' => ['nullable', 'string', 'max:255'],
            'ads.*.image_mobile_path' => ['nullable', 'string', 'max:512', function (string $attribute, mixed $value, \Closure $fail): void {
                if ($value !== null && $value !== '' && ! HomepageAdvertisementImageService::looksLikeStoredPath($value)) {
                    $fail('Insert a JPEG, PNG, or WebP image before saving this advertisement.');
                }
            }],
            'ads.*.image_mobile_filename' => ['nullable', 'string', 'max:255'],
            'ads.*.destination_url' => ['nullable', 'string', 'max:2048', function (string $attribute, mixed $value, \Closure $fail): void {
                if (SafeHomepageDestination::sanitize($value) === null) {
                    $fail('The destination must be a relative Customer path or an http/https URL.');
                }
            }],
            'ads.*.is_active' => ['required', 'boolean'],
        ];
    }
}
