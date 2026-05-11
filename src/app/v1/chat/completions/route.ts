import { ensureHealthScheduler } from "@/lib/health";
import { handleChatCompletions } from "@/lib/relay";

export const runtime = "nodejs";

export async function POST(request: Request) {
  ensureHealthScheduler();
  return handleChatCompletions(request);
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      Allow: "POST, OPTIONS"
    }
  });
}
