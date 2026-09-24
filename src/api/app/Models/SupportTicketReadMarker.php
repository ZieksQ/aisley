<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class SupportTicketReadMarker extends Model
{
    use HasUuids;

    protected $fillable = ['ticket_id', 'user_id', 'last_read_sequence'];
}
