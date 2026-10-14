<?php

namespace Tests\Support;

use App\Models\TransactionalEmail;
use App\Services\Mail\TransactionalEmailSender;

trait DeliversTransactionalEmails
{
    protected function deliverTransactionalEmails(): void
    {
        foreach (TransactionalEmail::query()->pluck('id') as $id) {
            app(TransactionalEmailSender::class)->deliver($id);
        }
    }
}
