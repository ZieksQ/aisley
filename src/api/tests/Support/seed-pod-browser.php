<?php

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Tests\Support\DeliveryReviewFixtures;
use Tests\TestCase;

require dirname(__DIR__, 2).'/vendor/autoload.php';
foreach (simplexml_load_file('phpunit.xml')->php->env as $entry) {
    $key = (string) $entry['name'];
    $value = (string) $entry['value'];
    putenv($key.'='.$value);
    $_ENV[$key] = $value;
    $_SERVER[$key] = $value;
}
$file = dirname(__DIR__, 2).'/storage/framework/testing/pod-browser.sqlite';
if (! is_dir(dirname($file))) {
    mkdir(dirname($file), 0775, true);
}
touch($file);
foreach (['DB_CONNECTION' => 'sqlite', 'DB_URL' => '', 'DB_DATABASE' => $file, 'SESSION_DRIVER' => 'file', 'QUEUE_CONNECTION' => 'database'] as $key => $value) {
    putenv($key.'='.$value);
    $_ENV[$key] = $value;
    $_SERVER[$key] = $value;
}
class PodBrowserFixture extends TestCase
{
    use DeliveryReviewFixtures;

    public function prepare(): void
    {
        $this->setUp();
        Artisan::call('migrate:fresh', ['--force' => true]);
        [$logistics, $courier, $task, $proof] = $this->readyDelivery();
        $this->submitIntent($courier, $task, $proof);
        $logistics->update(['email' => 'pod-logistics@example.test', 'password' => Hash::make('Pod-test-password-123!')]);
        $logistics->logisticsProfile()->create(['first_name' => 'Logistics', 'last_name' => 'Reviewer', 'contact_number' => '09171234567', 'sex' => 'female', 'birth_date' => '1990-01-01']);
        $courier->update(['email' => 'pod-courier@example.test', 'password' => Hash::make('Pod-test-password-123!')]);
        // Keep browser proof bytes outside Storage::fake's root so subsequent tests cannot clear them.
        $bytes = Storage::disk($proof->storage_disk)->get($proof->storage_path);
        $target = storage_path('app/private/'.$proof->storage_path);
        if (! is_dir(dirname($target))) {
            mkdir(dirname($target), 0775, true);
        }
        file_put_contents($target, $bytes);
        $proof->update(['storage_disk' => 'local']);
        file_put_contents(storage_path('framework/testing/pod-browser.json'), json_encode(['task_id' => $task->id, 'proof_id' => $proof->id, 'order_reference' => $task->shipment->parcel->order->reference], JSON_PRETTY_PRINT));
        echo "Seeded isolated COD photo/intention browser fixture.\n";
    }
}
(new PodBrowserFixture('prepare'))->prepare();
