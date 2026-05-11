import { NextResponse } from "next/server";
import { createApiKey, listApiKeys } from "@/lib/db";
import { isAdminRequest } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  return NextResponse.json({ keys: listApiKeys() });
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    limit_units?: number;
  };
  const limit = Math.max(1, Number(body.limit_units ?? 1000000));
  const result = createApiKey(body.name ?? "新 Key", limit);

  return NextResponse.json(result, { status: 201 });
}
