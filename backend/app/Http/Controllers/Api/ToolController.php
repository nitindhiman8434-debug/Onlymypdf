<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Tool;

class ToolController extends Controller
{
    /** GET /api/tools — enabled tools for the public site. */
    public function index()
    {
        return Tool::enabled()->orderBy('sort')->get()->map(fn (Tool $t) => $this->present($t));
    }

    /** GET /api/tools/{code} */
    public function show(string $code)
    {
        $tool = Tool::enabled()->where('code', $code)->orWhere('slug', $code)->firstOrFail();
        return $this->present($tool);
    }

    private function present(Tool $t): array
    {
        return [
            'code' => $t->code,
            'slug' => $t->slug,
            'category' => $t->category,
            'processing' => $t->processing,
            'name' => ['en' => $t->name_en, 'hi' => $t->name_hi],
            'credits' => [$t->credit_min, $t->credit_max],
            'high_accuracy' => $t->high_accuracy,
            'ai' => $t->ai,
            'beta' => $t->beta,
        ];
    }
}
