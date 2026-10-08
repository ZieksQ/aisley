<?php

namespace App\Services\Vouchers;

use App\Enums\UserRole;
use App\Models\User;
use App\Models\Voucher;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

class VoucherReadService
{
    public function scope(User $user): Builder
    {
        return $user->role === UserRole::Admin
            ? Voucher::query()->where('issuer_type', 'app')
            : Voucher::query()->where('issuer_type', 'shop')->where('shop_id', $user->shop()->firstOrFail()->id);
    }

    public function status(Voucher $voucher): string
    {
        return match (true) {
            $voucher->lifecycle->value === 'ended' => 'ended',
            $voucher->lifecycle->value === 'draft' => 'draft',
            ! $voucher->is_active => 'paused',
            now()->gte($voucher->ends_at) => 'expired',
            now()->lt($voucher->starts_at) => 'scheduled',
            $voucher->global_limit !== null && $voucher->redeemed_count >= $voucher->global_limit => 'exhausted',
            default => 'active',
        };
    }

    public function data(Voucher $voucher): array
    {
        $terms = app(VoucherTerms::class);
        $draft = $voucher->draftVersion;

        return [
            'id' => $voucher->id, 'code' => $voucher->code, 'issuer_type' => $voucher->issuer_type->value,
            'benefit_type' => $voucher->benefit_type->value, 'currency' => 'PHP', 'lifecycle' => $voucher->lifecycle->value,
            'status' => $this->status($voucher), 'revision' => $voucher->revision, 'version' => $voucher->version,
            'availability_revision' => $voucher->availability_revision, 'is_active' => $voucher->is_active,
            'terms' => $this->safeTerms($terms->snapshot($voucher)), 'draft' => $draft ? ['id' => $draft->id, 'number' => $draft->number, 'terms' => $this->safeTerms($draft->terms)] : null,
            'authoring_supported' => $terms->supported($voucher), 'published_at' => $voucher->published_at?->toISOString(),
            'ended_at' => $voucher->ended_at?->toISOString(), 'redeemed_count' => $voucher->redeemed_count,
            'remaining_capacity' => $voucher->global_limit === null ? null : max(0, $voucher->global_limit - $voucher->redeemed_count),
            'customer_savings' => number_format((float) $voucher->redemptions()->sum('discount_amount'), 2, '.', ''),
        ];
    }

    public function listing(User $user, array $filters): array
    {
        $query = $this->scope($user)->with('draftVersion');
        if ($search = $filters['search'] ?? null) {
            // Codes only: literal search, no client wildcard or arbitrary JSON matching.
            $query->whereRaw('UPPER(code) LIKE ?', ['%'.str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], strtoupper($search)).'%']);
        }
        if ($benefit = $filters['benefit'] ?? null) {
            $query->where('benefit_type', $benefit);
        }
        if ($status = $filters['status'] ?? null) {
            $query->whereRaw($this->statusSql().' = ?', [now(), now(), $status]);
        }
        $page = $query->orderByDesc('created_at')->orderBy('id')->paginate(15);

        return ['data' => $page->getCollection()->map(fn ($voucher) => $this->data($voucher))->all(), 'meta' => $this->meta($page)];
    }

    private function statusSql(): string
    {
        return "CASE WHEN lifecycle = 'ended' THEN 'ended' WHEN lifecycle = 'draft' THEN 'draft' WHEN is_active = false THEN 'paused' WHEN ends_at <= ? THEN 'expired' WHEN starts_at > ? THEN 'scheduled' WHEN global_limit IS NOT NULL AND redeemed_count >= global_limit THEN 'exhausted' ELSE 'active' END";
    }

    public function history(Voucher $voucher, string $kind): array
    {
        if ($kind === 'redemptions') {
            $query = DB::table('voucher_redemptions as r')->join('orders as o', 'o.id', '=', 'r.order_id')
                ->leftJoin('order_vouchers as v', fn ($join) => $join->on('v.order_id', '=', 'r.order_id')->on('v.voucher_id', '=', 'r.voucher_id'))
                ->where('r.voucher_id', $voucher->id)->select(['r.id', 'o.reference as order_reference', 'o.status as order_status', 'r.redeemed_at', 'r.discount_amount', 'r.currency', 'v.rule_version as version'])
                ->orderByDesc('r.redeemed_at')->orderByDesc('r.id');
        } elseif ($kind === 'versions') {
            $query = $voucher->versions()->select(['id', 'number', 'state', 'terms', 'published_at', 'created_at'])->orderByDesc('number');
        } else {
            $query = DB::table('voucher_actions')->where('voucher_id', $voucher->id)
                ->select(['id', 'action', 'revision', 'details', 'created_at'])->orderByDesc('revision')->orderByDesc('id');
        }
        $page = $query->paginate(15);
        $rows = $page->items();
        if ($kind === 'versions') {
            $rows = array_map(function ($row) {
                $data = $row->toArray();
                $data['terms'] = $this->safeTerms($data['terms']);

                return $data;
            }, $rows);
        } else {
            $rows = array_map(function ($row) use ($kind) {
                $dateField = $kind === 'actions' ? 'created_at' : 'redeemed_at';
                $row->{$dateField} = CarbonImmutable::parse($row->{$dateField}, 'UTC')->toISOString();
                if ($kind === 'actions') {
                    $row->details = json_decode($row->details, true);
                }

                return $row;
            }, $rows);
        }

        return ['data' => $rows, 'meta' => $this->meta($page)];
    }

    private function safeTerms(array $terms): array
    {
        $rules = $terms['eligibility_rules'] ?? [];
        $terms['eligibility_scope'] = collect($rules)->contains(fn ($values) => ! empty($values)) ? 'legacy_targeted' : 'unrestricted';
        unset($rules['customer_ids'], $rules['excluded_customer_ids']);
        $terms['eligibility_rules'] = $rules;

        return $terms;
    }

    private function meta($page): array
    {
        return ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'total' => $page->total()];
    }
}
