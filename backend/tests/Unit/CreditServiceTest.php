<?php

namespace Tests\Unit;

use App\Models\Plan;
use App\Models\User;
use App\Services\CreditService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CreditServiceTest extends TestCase
{
    use RefreshDatabase;

    private function proUser(): User
    {
        $plan = Plan::create([
            'code' => 'pro_monthly_in', 'name' => 'Pro', 'region' => 'in', 'interval' => 'monthly',
            'price_minor' => 29900, 'currency' => 'INR', 'monthly_credits' => 2100,
        ]);
        return User::create([
            'name' => 'Test', 'email' => 't@t.com', 'password' => 'x', 'plan_id' => $plan->id,
        ]);
    }

    public function test_monthly_grant_sets_balance_to_2100(): void
    {
        $user = $this->proUser();
        $service = new CreditService();

        $service->grantMonthly($user, 2100);

        $this->assertSame(2100, $service->balance($user));
    }

    public function test_spending_reduces_balance(): void
    {
        $user = $this->proUser();
        $service = new CreditService();
        $service->grantMonthly($user, 2100);

        $service->spend($user, 15, 'pdf-to-word');

        $this->assertSame(2085, $service->balance($user));
    }

    public function test_spending_more_than_balance_throws(): void
    {
        $user = $this->proUser();
        $service = new CreditService();
        $service->grantMonthly($user, 10);

        $this->expectExceptionMessage('INSUFFICIENT_CREDITS');
        $service->spend($user, 50, 'pdf-to-excel');
    }

    public function test_admin_adjust_changes_balance(): void
    {
        $user = $this->proUser();
        $service = new CreditService();
        $service->grantMonthly($user, 100);

        $service->adjust($user, 50, 'goodwill');

        $this->assertSame(150, $service->balance($user));
    }
}
