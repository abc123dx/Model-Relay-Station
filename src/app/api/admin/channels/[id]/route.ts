import { NextResponse } from "next/server";
import { updateChannelEnabled } from "@/lib/db";
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
  const body = (await request.json().catch(() => ({}))) as { enabled?: boolean };
  const channel = updateChannelEnabled(id, Boolean(body.enabled));
  if (!channel) return NextResponse.json({ error: "渠道不存在" }, { status: 404 });
  return NextResponse.json({ channel });
}
