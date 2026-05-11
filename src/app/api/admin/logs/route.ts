import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/auth";
import { clearLogsOlderThan, usageLogsData } from "@/lib/admin-data";

export const runtime = "nodejs";

function parseFilters(url: URL) {
  return {
    page: Number(url.searchParams.get("page") ?? 1),
    pageSize: Number(url.searchParams.get("pageSize") ?? 20),
    status: url.searchParams.get("status") ?? "all",
    model: url.searchParams.get("model") ?? "all",
    channel: url.searchParams.get("channel") ?? "all",
    key: url.searchParams.get("key") ?? "all",
    q: url.searchParams.get("q") ?? "",
    from: url.searchParams.get("from") ?? "",
    to: url.searchParams.get("to") ?? ""
  };
}

export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const url = new URL(request.url);
  return NextResponse.json(usageLogsData(parseFilters(url)));
}

export async function DELETE(request: Request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const url = new URL(request.url);
  const days = Number(url.searchParams.get("days") ?? 30);
  const result = clearLogsOlderThan(days);
  return NextResponse.json({ ok: true, deleted: result.changes });
}
