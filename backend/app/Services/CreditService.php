<?php

namespace App\Services;

use App\Models\CreditLedger;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Unified monthly credit wallet (2100 credits for Pro).
 *
 * The append-only credits_ledger is the source of truth; users.current_credits
 * is a cached mirror. Annual plans still receive 2100/month (not upfront), and
 * unused credits expire at the monthly reset.
 */
class CreditService
{
    /** Current balance from the ledger (excludes expired grants). */
    public function balance(User $user): int
    {
        return (int) CreditLedger::where('user_id', $user->id)
            ->where(function ($q) {
                $q->whereNull('expires_at')->orWhere('expires_at', '>', now());
            })
            ->sum('delta');
    }

    /** Grant the monthly allowance; previous unused credits expire now. */
    public function grantMonthly(User $user, int $amount): void
    {
        DB::transaction(function () use ($user, $amount) {
            // Expire the old balance by recording the reset, then grant fresh credits.
            $this->record($user, -$this->balance($user), 'monthly_grant', note: 'monthly reset');
            $this->record($user, $amount, 'monthly_grant', expiresAt: now()->addMonth());
            $user->update([
                'credits_reset_at' => now()->addMonth(),
                'current_credits' => $amount,
            ]);
        });
    }

    /** Spend credits for a tool run. Throws if insufficient. */
    public function spend(User $user, int $amount, string $toolCode, ?int $jobId = null): void
    {
        if ($this->balance($user) < $amount) {
            throw new \RuntimeException('INSUFFICIENT_CREDITS');
        }
        $this->record($user, -$amount, 'tool_spend', $toolCode, $jobId);
    }

    /** Admin manual add/remove (reason note optional). */
    public function adjust(User $user, int $delta, ?string $note = null): void
    {
        $this->record($user, $delta, 'admin_adjust', note: $note);
    }

    private function record(
        User $user,
        int $delta,
        string $reason,
        ?string $toolCode = null,
        ?int $jobId = null,
        ?string $note = null,
        $expiresAt = null,
    ): void {
        DB::transaction(function () use ($user, $delta, $reason, $toolCode, $jobId, $note, $expiresAt) {
            $balanceAfter = $this->balance($user) + $delta;
            CreditLedger::create([
                'user_id' => $user->id,
                'delta' => $delta,
                'reason' => $reason,
                'tool_code' => $toolCode,
                'job_id' => $jobId,
                'note' => $note,
                'balance_after' => $balanceAfter,
                'expires_at' => $expiresAt,
            ]);
            $user->update(['current_credits' => $balanceAfter]);
        });
    }
}
