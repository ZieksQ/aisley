<?php

namespace App\Http\Requests\Finance;

class InvoiceIndexRequest extends FinanceReadRequest
{
    public function rules(): array
    {
        return array_merge(parent::rules(), [
            'status' => ['nullable', 'in:outstanding,processing,paid,review,overdue'],
        ]);
    }
}
