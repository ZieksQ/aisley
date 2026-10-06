<?php

namespace App\Services\Logistics\Sorting;

use App\Exceptions\Fulfillment\FulfillmentException;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SortingMutationService
{
    /** Called inside a hub-locked transaction; stores the original response for uncertain retries. */
    public function run(User $actor, string $key, array $payload, callable $operation): array
    {
        $hash = hash('sha256', json_encode($payload, JSON_THROW_ON_ERROR));
        $prior = DB::table('sorting_mutations')->where('actor_id', $actor->id)->where('client_id', $key)->first();
        if ($prior) {
            if (! hash_equals($prior->request_hash, $hash)) {
                throw FulfillmentException::conflict('IDEMPOTENCY_KEY_REUSED', 'This identifier belongs to another sorting action.');
            }

            return json_decode($prior->result, true, 512, JSON_THROW_ON_ERROR);
        }
        $result = $operation();
        DB::table('sorting_mutations')->insert(['id' => (string) Str::uuid(), 'actor_id' => $actor->id,
            'client_id' => $key, 'request_hash' => $hash, 'result' => json_encode($result, JSON_THROW_ON_ERROR), 'created_at' => now()]);

        return $result;
    }
}
