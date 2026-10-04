<?php

namespace App\Services\Finance\Automation;

use App\Enums\CodInvoiceStatus;
use App\Models\CodInvoice;
use App\Models\LogisticsOrganization;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class FinanceNoticeService
{
    public function dispatchPending(): void
    {
        CodInvoice::query()->whereNotNull('logistics_organization_id')->whereNull('notified_at')->each(function (CodInvoice $invoice) {
            app(FinanceDocumentService::class)->invoice($invoice);
            $recipient = LogisticsOrganization::find($invoice->logistics_organization_id)?->user;
            if ($recipient) {
                $this->notify($recipient, 'invoice:'.$invoice->id, 'cod_invoice_issued', 'COD invoice issued', $invoice->reference.' is due '.$invoice->due_at->timezone('Asia/Manila')->format('M j, Y g:i A').'.', '/finance/remittances/invoices/'.$invoice->id);
                $invoice->update(['notified_at' => now()]);
            }
        });
        CodInvoice::query()->whereIn('status', [CodInvoiceStatus::Outstanding, CodInvoiceStatus::Processing])->where('due_at', '<', now())->whereNull('overdue_notified_at')->each(function (CodInvoice $invoice) {
            $recipient = LogisticsOrganization::find($invoice->logistics_organization_id)?->user;
            if ($recipient) {
                $this->notify($recipient, 'overdue:'.$invoice->id, 'cod_invoice_overdue', 'COD invoice overdue', $invoice->reference.' remains unpaid. Check the payment status or pay now.', '/finance/remittances/invoices/'.$invoice->id);
            }
            foreach (User::query()->where('role', 'admin')->where('status', 'active')->whereHas('permissions', fn ($q) => $q->where('slug', 'finance.view'))->get() as $admin) {
                $this->notify($admin, 'overdue:'.$invoice->id, 'cod_invoice_overdue', 'COD invoice overdue', $invoice->reference.' requires attention.', '/finance/remittances/invoices/'.$invoice->id);
            }
            $invoice->update(['overdue_notified_at' => now()]);
        });
    }

    private function notify(User $user, string $identity, string $type, string $title, string $summary, string $href): void
    {
        $hash = hash('sha256', $identity.':'.$user->id);
        $id = substr($hash, 0, 8).'-'.substr($hash, 8, 4).'-4'.substr($hash, 13, 3).'-a'.substr($hash, 17, 3).'-'.substr($hash, 20, 12);
        DB::table('notifications')->insertOrIgnore([
            'id' => $id, 'type' => $type, 'notifiable_type' => $user->getMorphClass(), 'notifiable_id' => $user->id,
            'data' => json_encode(['title' => $title, 'summary' => $summary, 'body' => $summary, 'invoice_id' => str_contains($href, '/invoices/') ? basename($href) : null, 'destination' => $href, 'resource_type' => 'cod_invoice', 'resource_id' => basename($href), 'action_url' => $href, 'action' => ['label' => 'View invoice', 'href' => $href]], JSON_THROW_ON_ERROR),
            'created_at' => now(), 'updated_at' => now(),
        ]);
    }
}
