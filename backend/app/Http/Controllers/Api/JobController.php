<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TempFile;
use App\Models\Tool;
use App\Models\ToolJob;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * Server-side job lifecycle. Upload/validation, queueing, status polling,
 * signed downloads and Delete Now. Heavy work is handed to the Python worker
 * via Redis (Phase 3); this controller owns the job record + TTL.
 */
class JobController extends Controller
{
    /** POST /api/jobs/initiate */
    public function initiate(Request $request)
    {
        $data = $request->validate([
            'tool_code' => 'required|string',
            'mode' => 'nullable|in:fast,high_accuracy',
            'options' => 'nullable|array',
            'file_meta' => 'required|array',
            'file_meta.filename' => 'required|string',
            'file_meta.size' => 'required|integer|min:1',
            'file_meta.mime' => 'required|string',
        ]);

        $tool = Tool::enabled()->where('code', $data['tool_code'])->firstOrFail();

        $job = ToolJob::create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $request->user()?->id,
            'session_token' => $request->header('X-Session-Token'),
            'tool_code' => $tool->code,
            'plan_code' => $request->user()?->plan?->code ?? 'guest_free',
            'mode' => $data['mode'] ?? null,
            'status' => 'queued',
            'input_meta' => $data['file_meta'],
            'options' => $data['options'] ?? [],
            'credits_estimated' => $tool->credit_min,
            'queue' => $this->queueFor($tool, $data['mode'] ?? null),
            'expires_at' => now()->addMinutes((int) config('onlymypdf.temp_ttl_minutes')),
        ]);

        return response()->json([
            'job_uuid' => $job->uuid,
            'upload_url' => url("/api/jobs/{$job->uuid}/upload"),
        ], 201);
    }

    /** GET /api/jobs/{uuid}/status — polled by the processing page. */
    public function status(string $uuid)
    {
        $job = ToolJob::where('uuid', $uuid)->firstOrFail();

        return [
            'uuid' => $job->uuid,
            'status' => $job->status,
            'quality_estimate' => $job->quality_score,
            'expires_at' => $job->expires_at,
            'download_ready' => $job->status === 'done',
            'error' => $job->error_code ? ['code' => $job->error_code, 'message' => $job->error_message] : null,
        ];
    }

    /** POST /api/jobs/{uuid}/delete-now — immediate purge. */
    public function deleteNow(string $uuid)
    {
        $job = ToolJob::where('uuid', $uuid)->firstOrFail();
        $this->purge($job);
        return response()->json(['deleted' => true]);
    }

    /** Delete all temp files for a job and mark it deleted. */
    public function purge(ToolJob $job): void
    {
        foreach ($job->tempFiles()->whereNull('deleted_at')->get() as $file) {
            @unlink(storage_path('app/' . $file->path));
            $file->update(['deleted_at' => now()]);
        }
        $job->update(['status' => 'deleted', 'download_token' => null]);
    }

    private function queueFor(Tool $tool, ?string $mode): string
    {
        if ($mode === 'high_accuracy') return 'high_accuracy';
        if ($tool->category === 'ai') return 'ai';
        if ($tool->code === 'pdf-ocr') return 'ocr';
        if ($tool->category === 'convert') return 'conversion';
        return 'standard';
    }
}
