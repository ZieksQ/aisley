<?php

namespace App\Http\Requests\Finance;

final class DateRangeRules
{
    public static function rules(): array
    {
        $today = now('Asia/Manila')->toDateString();

        return [
            'date_from' => ['nullable', 'filled', 'required_with:date_to', 'date_format:Y-m-d', 'before_or_equal:'.$today],
            'date_to' => ['nullable', 'filled', 'required_with:date_from', 'date_format:Y-m-d', 'after_or_equal:date_from', 'before_or_equal:'.$today],
            'all_time' => ['sometimes', 'boolean', 'prohibits:date_from,date_to'],
        ];
    }
}
