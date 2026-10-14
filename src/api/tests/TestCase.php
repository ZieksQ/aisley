<?php

namespace Tests;

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Bootstrap\LoadEnvironmentVariables;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    public function createApplication()
    {
        if (! defined('AISLEY_ISOLATED_TESTS')) {
            return parent::createApplication();
        }

        $app = require Application::inferBasePath().'/bootstrap/app.php';
        $this->traitsUsedByTest = class_uses_recursive(static::class);
        $app->bind(LoadEnvironmentVariables::class, fn () => new class extends LoadEnvironmentVariables
        {
            public function bootstrap(\Illuminate\Contracts\Foundation\Application $app): void
            {
                // Intentionally skip Dotenv; this run uses synthetic process values only.
            }
        });
        $app->make(Kernel::class)->bootstrap();

        return $app;
    }
}
