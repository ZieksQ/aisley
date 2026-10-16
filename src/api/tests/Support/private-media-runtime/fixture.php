<?php

// Test setup only. Refuse the real application before loading its bootstrap.
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\ChatAttachment;
use App\Models\DeliveryTask;
use App\Models\Order;
use App\Models\User;
use App\Services\Messaging\OperationalConversationService;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Str;
use Symfony\Component\Process\Process;

$root = realpath(getcwd());
$database = $root.'/storage/framework/testing/chat-browser/fixture.sqlite';
if (PHP_SAPI !== 'cli' || ! is_file($root.'/.g26-isolated') || is_file($root.'/.env')
    || getenv('DB_CONNECTION') !== 'sqlite' || getenv('DB_DATABASE') !== $database) {
    throw new RuntimeException('Only the disposable G26 application is allowed.');
}
define('AISLEY_ISOLATED_TESTS', true);
$command = $argv[1] ?? '';
if ($command === 'seed') {
    require $root.'/tests/Support/seed-chat-media-browser.php';
} else {
    require $root.'/vendor/autoload.php';
    $app = require $root.'/bootstrap/app.php';
    $app->make(Kernel::class)->bootstrap();
}
if (config('database.default') !== 'sqlite' || config('database.connections.sqlite.database') !== $database) {
    throw new RuntimeException('Disposable database configuration changed.');
}
$manifest = dirname($database).'/fixture.json';
$data = json_decode(file_get_contents($manifest), true, flags: JSON_THROW_ON_ERROR);
$task = DeliveryTask::findOrFail($data['task_id']);
$order = Order::findOrFail($data['order_id']);

switch ($command) {
    case 'seed':
        // A longer generated clip allows native controls/lifecycle checks without
        // racing the two-second browser smoke fixture's end-of-playback event.
        (new Process(['ffmpeg', '-v', 'error', '-f', 'lavfi', '-i',
            'color=size=120x60:rate=2', '-t', '8', '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
            '-y', dirname($database).'/clip.mp4']))->mustRun();
        $users = ['customer' => $order->customer, 'seller' => $order->shop->seller,
            'logistics' => User::where('email', 'chat-logistics@example.test')->firstOrFail(),
            'courier' => User::findOrFail($task->courier_id)];
        $users['foreign'] = User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Active]);
        $users['admin'] = User::factory()->create(['role' => UserRole::Admin, 'status' => UserStatus::Active]);
        $replacement = User::factory()->create(['role' => UserRole::Courier, 'status' => UserStatus::Active]);
        $replacement->courierProfile()->create(['first_name' => 'Fixture', 'last_name' => 'Replacement',
            'contact_number' => '09170000000', 'sex' => 'female', 'birth_date' => '1990-01-01']);
        $affiliation = $users['courier']->courierLogisticsAffiliation;
        $replacement->courierLogisticsAffiliation()->create([
            'logistics_organization_id' => $affiliation->logistics_organization_id,
            'logistics_hub_id' => $affiliation->logistics_hub_id, 'status' => 'approved']);
        $users['replacement'] = $replacement;
        foreach ($users as $role => $user) {
            $data['tokens'][$role] = $user->createToken('g26-runtime', [$user->role->value])->plainTextToken;
            $data['users'][$role] = $user->id;
        }
        $firstOrder = Order::where('reference', 'CHAT-FIRST-ORDER')->firstOrFail();
        $firstTask = DeliveryTask::whereHas('shipment.parcel', fn ($q) => $q->where('order_id', $firstOrder->id))->firstOrFail();
        $data['first_task_id'] = $firstTask->id;
        $data['first_operational'] = app(OperationalConversationService::class)->start($users['logistics'], 'logistics',
            ['leg' => 'first_mile', 'task_id' => $firstTask->id, 'body' => 'Runtime fixture'], (string) Str::uuid())['conversation']->id;
        file_put_contents($manifest, json_encode($data, JSON_THROW_ON_ERROR));
        chmod($manifest, 0600);
        break;
    case 'end':
        // Fixture transitions intentionally bypass commerce effects; no delivery is performed.
        $order->update(['status' => 'delivered']);
        $task->update(['status' => 'delivered']);
        break;
    case 'reassign':
        $order->update(['status' => 'out_for_delivery']);
        $task->update(['status' => 'out_for_delivery', 'courier_id' => $data['users']['replacement']]);
        $task->offers()->update(['courier_id' => $data['users']['replacement'], 'status' => 'accepted']);
        break;
    case 'restore':
        $order->update(['status' => 'out_for_delivery']);
        $task->update(['status' => 'out_for_delivery', 'courier_id' => $data['users']['courier']]);
        $task->offers()->update(['courier_id' => $data['users']['courier'], 'status' => 'accepted']);
        $organization = User::findOrFail($data['users']['logistics'])->logisticsOrganization;
        $task->shipment->update(['current_logistics_organization_id' => $organization->id,
            'current_hub_id' => $organization->hub->id]);
        break;
    case 'custody':
        if (! isset($data['users']['replacement_logistics'])) {
            $user = User::factory()->create(['role' => UserRole::Logistics, 'status' => UserStatus::Active]);
            $original = User::findOrFail($data['users']['logistics'])->logisticsOrganization;
            $address = $original->hub->address->replicate();
            $address->user_id = $user->id;
            $address->save();
            $organization = $user->logisticsOrganization()->create(['business_name' => 'Fixture replacement Logistics']);
            $organization->hub()->create(['address_id' => $address->id, 'name' => 'Fixture hub']);
            $data['users']['replacement_logistics'] = $user->id;
            $data['tokens']['replacement_logistics'] = $user->createToken('g26-runtime', ['logistics'])->plainTextToken;
            file_put_contents($manifest, json_encode($data, JSON_THROW_ON_ERROR));
        }
        $organization = User::findOrFail($data['users']['replacement_logistics'])->logisticsOrganization;
        $task->shipment->update(['current_logistics_organization_id' => $organization->id,
            'current_hub_id' => $organization->hub->id]);
        break;
    case 'expire':
        ChatAttachment::whereNull('message_id')->update(['expires_at' => now()->subDay()]);
        break;
    case 'renew':
        foreach (['customer', 'courier'] as $role) {
            $user = User::findOrFail($data['users'][$role]);
            $data['tokens'][$role] = $user->createToken('g26-runtime', [$role])->plainTextToken;
            $sessionFile = dirname($root).'/'.$role.'-session.json';
            if (is_file($sessionFile)) {
                $session = json_decode(file_get_contents($sessionFile), true, flags: JSON_THROW_ON_ERROR);
                $session['token'] = $data['tokens'][$role];
                file_put_contents($sessionFile, json_encode($session, JSON_THROW_ON_ERROR));
            }
        }
        file_put_contents($manifest, json_encode($data, JSON_THROW_ON_ERROR));
        break;
    case 'cleanup':
        foreach ($data['users'] as $id) {
            User::findOrFail($id)->tokens()->delete();
        }
        unlink($manifest);
        break;
    default:
        throw new RuntimeException('Unknown fixture operation.');
}
echo "Disposable fixture operation complete.\n";
