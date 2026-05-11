import { NextResponse } from "next/server";
import { deleteApiKey, updateApiKey } from "@/lib/db";
import { isAdminRequest } from "@/lib/auth";

export const runtime = "nodejs";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    status?: "active" | "disabled";
    limit_units?: number;
  };
  const record = updateApiKey(Number(id), {
    name: body.name,
    status: body.status,
    limit_units: body.limit_units
  });

  if (!record) return NextResponse.json({ error: "Key 不存在" }, { status: 404 });
  return NextResponse.json({ key: record });
}

export async function DELETE(request: Request, { params }: Params) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { id } = await params;
  deleteApiKey(Number(id));
  return NextResponse.json({ ok: true });
}
