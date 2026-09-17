import { NextRequest, NextResponse } from "next/server";
import { guardGeneralApiRateLimit } from "@/lib/server/rate-limiter";

export async function POST(request: NextRequest) {
  const limited = await guardGeneralApiRateLimit(request);
  if (limited) return limited;

  await request.arrayBuffer().catch(() => undefined);
  return new NextResponse(null, { status: 204 });
}
