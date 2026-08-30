<?php

namespace App\Http\Requests\Customer;

use App\Enums\CheckoutMode;
use App\Enums\PaymentMethod;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class CheckoutQuoteRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'mode' => ['required', Rule::enum(CheckoutMode::class)],
            'cart_item_ids' => ['required_if:mode,cart', 'prohibited_if:mode,buy_now', 'array', 'min:1'],
            'cart_item_ids.*' => ['required', 'uuid', 'distinct:strict'],
            'buy_now' => ['required_if:mode,buy_now', 'prohibited_if:mode,cart', 'array'],
            'buy_now.product_id' => ['required_if:mode,buy_now', 'uuid'],
            'buy_now.variant_id' => ['present_if:mode,buy_now', 'nullable', 'uuid'],
            'buy_now.quantity' => ['required_if:mode,buy_now', 'integer', 'min:1', 'max:2147483647'],
            'address_id' => ['required', 'uuid'],
            'payment_method' => ['required', Rule::enum(PaymentMethod::class)],
            'vouchers' => ['sometimes', 'array', 'max:20'],
            'vouchers.*.voucher_id' => ['required', 'uuid', 'distinct:strict'],
            'vouchers.*.target_shop_id' => ['required', 'uuid'],
            'customer_id' => ['prohibited'],
            'shop_id' => ['prohibited'],
            'shipping_fee' => ['prohibited'],
            'subtotal' => ['prohibited'],
            'total' => ['prohibited'],
            'status' => ['prohibited'],
        ];
    }

    /** @return list<callable> */
    public function after(): array
    {
        return [function (Validator $validator): void {
            if ($this->input('mode') === CheckoutMode::Cart->value && $this->exists('buy_now')) {
                $validator->errors()->add('buy_now', 'Buy Now details cannot be combined with Cart checkout.');
            }
            if ($this->input('mode') === CheckoutMode::BuyNow->value && $this->exists('cart_item_ids')) {
                $validator->errors()->add('cart_item_ids', 'Cart items cannot be combined with Buy Now checkout.');
            }
        }];
    }
}
