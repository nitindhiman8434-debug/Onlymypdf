<?php

namespace Tests\Unit;

use App\Services\LimitService;
use Tests\TestCase;

class LimitServiceTest extends TestCase
{
    public function test_guest_gets_five_daily_tasks_then_blocked(): void
    {
        config(['onlymypdf.daily_limits.guest.tasks' => 5]);
        $service = new LimitService();
        $key = 'iphash-123';

        for ($i = 0; $i < 5; $i++) {
            $this->assertTrue($service->consume($key, 'guest', 'tasks'), "task #$i should be allowed");
        }
        $this->assertFalse($service->consume($key, 'guest', 'tasks'), '6th task should be blocked');
    }

    public function test_pro_is_not_task_limited(): void
    {
        $service = new LimitService();
        $this->assertTrue($service->consume('user-1', 'pro', 'tasks'));
    }

    public function test_guest_file_limit_is_25mb(): void
    {
        config(['onlymypdf.limits.guest.normal' => 25]);
        $service = new LimitService();
        $this->assertSame(25 * 1024 * 1024, $service->maxFileBytes('guest'));
    }
}
