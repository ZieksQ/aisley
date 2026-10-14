<?php

namespace Tests\Support;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\TransactionalEmail;
use App\Models\User;
use App\Services\Account\PasswordChangeVerification;
use Illuminate\Support\Facades\Hash;

trait VerifiesPasswordChanges
{
    public function test_password_code_endpoint_blocks_bypass_and_updates_only_after_email_verification(): void
    {
        $role = strtolower(str_replace('AccountManagementTest', '', class_basename($this)));
        $user = $role === 'customer' ? $this->customer(['password' => 'CurrentCustomer123']) : $this->{$role}();
        $payload = ['current_password' => 'Current'.ucfirst($role).'123', 'password' => 'UpdatedPassword456', 'password_confirmation' => 'UpdatedPassword456'];
        $path = '/api/v1/'.$role.'/account/password';
        $method = $role === 'customer' ? 'patchJson' : 'putJson';
        $this->actingAs($user)->{$method}($path, $payload)->assertUnprocessable()->assertJsonValidationErrors(['challenge_id', 'verification_code']);
        $this->postJson($path.'/verification-code', [...$payload, 'email' => 'foreign@example.test'])->assertUnprocessable()->assertJsonValidationErrors('email');
        $response = $this->postJson($path.'/verification-code', $payload)->assertStatus(202)->assertHeader('Cache-Control', 'no-store, private');
        $challenge = $response->json('data.challenge_id');
        $email = TransactionalEmail::where('deduplication_key', 'password-change:'.$challenge)->firstOrFail();
        $this->assertTrue(Hash::check($payload['current_password'], $user->fresh()->password));
        $this->assertStringNotContainsString($user->email, json_encode($response->json()));
        $this->{$method}($path, [...$payload, 'challenge_id' => $challenge, 'verification_code' => $email->payload['code']])->assertOk();
        $this->assertTrue(Hash::check($payload['password'], $user->fresh()->password));
    }

    public function test_password_code_endpoint_retains_role_and_approval_boundaries(): void
    {
        $role = strtolower(str_replace('AccountManagementTest', '', class_basename($this)));
        $path = '/api/v1/'.$role.'/account/password/verification-code';
        $payload = ['current_password' => 'Current'.ucfirst($role).'123', 'password' => 'UpdatedPassword456', 'password_confirmation' => 'UpdatedPassword456'];
        $this->postJson($path, $payload)->assertUnauthorized();
        $foreign = User::factory()->create(['role' => $role === 'customer' ? UserRole::Seller : UserRole::Customer, 'status' => UserStatus::Active]);
        $this->actingAs($foreign)->postJson($path, $payload)->assertForbidden();
        $user = $role === 'customer' ? $this->customer(['password' => 'CurrentCustomer123']) : $this->{$role}();
        $user->update(['status' => UserStatus::Pending]);
        $this->actingAs($user)->postJson($path, $payload)->assertForbidden();
        $this->assertDatabaseCount('password_change_challenges', 0);
    }

    private function verifiedPasswordPayload(User $user, array $payload): array
    {
        $challenge = app(PasswordChangeVerification::class)->request($user, $payload['current_password'], $payload['password']);
        $email = TransactionalEmail::query()->where('deduplication_key', 'password-change:'.$challenge['challenge_id'])->firstOrFail();

        return [...$payload, 'challenge_id' => $challenge['challenge_id'], 'verification_code' => $email->payload['code']];
    }
}
