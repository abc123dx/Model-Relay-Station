import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/auth";
import { runHealthChecks } from "@/lib/health";
import { channelSummaries } from "@/lib/admin-data";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  await runHealthChecks();
  return NextResponse.json({ channels: channelSummaries() });
}
