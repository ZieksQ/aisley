<?php

namespace App\Support;

use Illuminate\Http\Request;
use Illuminate\Validation\Validator;

class ScalarQueryParameters
{
    /** PHP's parsed query bag drops repeated scalars; inspect raw keys as well. */
    public static function validate(Request $request, Validator $validator, array $allowed, bool $rejectUnknown = true): void
    {
        if ($rejectUnknown) {
            foreach (array_diff(array_keys($request->query()), $allowed) as $key) {
                $validator->errors()->add($key, "The {$key} parameter is not supported.");
            }
        }

        $seen = [];
        foreach (explode('&', (string) $request->server('QUERY_STRING', '')) as $pair) {
            $key = urldecode(explode('=', $pair, 2)[0]);
            if (in_array($key, $allowed, true)) {
                if (isset($seen[$key])) {
                    $validator->errors()->add($key, "The {$key} parameter must occur only once.");
                }
                $seen[$key] = true;
            } elseif ($rejectUnknown && $key !== '') {
                $validator->errors()->add($key, "The {$key} parameter is not supported.");
            }
        }
    }
}
