<?php

namespace App\Console\Commands;

use App\Http\Controllers\Api\JobController;
use App\Models\ToolJob;
use Illuminate\Console\Command;

/**
 * Auto-delete server-side files past their 1-hour TTL. Runs every minute
 * (see routes/console.php). This is the privacy guarantee enforcer.
 */
class CleanupTempFiles extends Command
{
    protected $signature = 'temp:cleanup';
    protected $description = 'Delete temp input/output files for jobs past their 1-hour TTL';

    public function handle(JobController $jobs): int
    {
        $expired = ToolJob::whereNotIn('status', ['deleted'])
            ->where('expires_at', '<=', now())
            ->limit(500)
            ->get();

        foreach ($expired as $job) {
            $jobs->purge($job);
        }

        $this->info("Cleaned {$expired->count()} expired jobs.");
        return self::SUCCESS;
    }
}
