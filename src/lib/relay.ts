import crypto from "node:crypto";
import {
  type ApiKeyRecord,
  type ChannelRecord,
  findApiKeyBySecret,
  insertRequestLog,
  listChannels,
  updateApiKeyUsage,
  updateChannelHealth
} from "@/lib/db";
import { getProviderByModel, providerDefinitions } from "@/lib/provider-config";

type ChatRequest = {
  model?: string;
  messages?: Array<unknown>;
  stream?: boolean;
  stream_options?: Record<string, unknown>;
  [key: string]: unknown;
};

type Usage = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
};

type AttemptResult =
  | {
      ok: true;
      response: Response;
      channel: ChannelRecord;
      startedAt: number;
    }
  | {
      ok: false;
      status: number;
      error: string;
      channel: ChannelRecord | null;
      startedAt: number;
    };

const encoder = new TextEncoder();

function openAiError(message: string, status = 400, code = "relay_error") {
  return Response.json(
    {
      error: {
        message,
        type: "relay_error",
        param: null,
        code
      }
    },
    { status }
  );
}

function extractBearer(header: string | null) {
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

function completionsUrl(channel: ChannelRecord) {
  return `${channel.base_url.replace(/\/$/, "")}/chat/completions`;
}

function configured(channel: ChannelRecord) {
  return Boolean(process.env[channel.api_key_env]);
}

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

function candidatesForModel(model: string) {
  const channels = listChannels().filter(
    (channel) => channel.enabled === 1 && configured(channel)
  );

  const sorted = channels.sort((a, b) => {
    if (a.healthy !== b.healthy) return b.healthy - a.healthy;
    return (a.latency_ms ?? 999999) - (b.latency_ms ?? 999999);
  });

  if (model === "auto") return shuffle(sorted);

  const preferredProvider = getProviderByModel(model);
  if (!preferredProvider) return [];

  const preferred = sorted.filter((channel) => channel.id === preferredProvider.id);
  const fallbacks = sorted.filter((channel) => channel.id !== preferredProvider.id);
  return [...preferred, ...fallbacks];
}

function estimateTokensFromValue(value: unknown) {
  if (!value) return 0;
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return Math.max(1, Math.ceil(text.length / 4));
}

function estimatePromptTokens(body: ChatRequest) {
  return estimateTokensFromValue(body.messages);
}

function estimateCompletionTokens(responseJson: unknown) {
  const maybe = responseJson as {
    choices?: Array<{ message?: { content?: unknown }; delta?: { content?: unknown } }>;
  };
  return estimateTokensFromValue(maybe.choices?.map((choice) => choice.message?.content ?? choice.delta?.content));
}

function normalizeUsage(raw: unknown, fallbackPrompt: number, fallbackCompletion: number): Usage {
  const usage = raw as Partial<Usage> | undefined;
  const prompt = Number(usage?.prompt_tokens ?? fallbackPrompt) || 0;
  const completion = Number(usage?.completion_tokens ?? fallbackCompletion) || 0;
  const total = Number(usage?.total_tokens ?? prompt + completion) || prompt + completion;
  return {
    prompt_tokens: prompt,
    completion_tokens: completion,
    total_tokens: total
  };
}

function billedUnits(usage: Usage, channel: ChannelRecord) {
  return Number((usage.total_tokens * channel.rate).toFixed(4));
}

function requestId() {
  return `relay_${crypto.randomBytes(12).toString("hex")}`;
}

function logRequest(input: {
  id: string;
  key: ApiKeyRecord | null;
  body: ChatRequest;
  channel: ChannelRecord | null;
  status: "success" | "error";
  httpStatus: number;
  usage?: Usage;
  billed?: number;
  latencyMs: number;
  error?: string | null;
}) {
  insertRequestLog({
    request_id: input.id,
    api_key_id: input.key?.id ?? null,
    api_key_prefix: input.key?.key_prefix ?? null,
    requested_model: String(input.body.model ?? "auto"),
    resolved_model: input.channel?.model ?? null,
    provider: input.channel?.provider ?? null,
    channel_id: input.channel?.id ?? null,
    status: input.status,
    http_status: input.httpStatus,
    prompt_tokens: input.usage?.prompt_tokens ?? 0,
    completion_tokens: input.usage?.completion_tokens ?? 0,
    total_tokens: input.usage?.total_tokens ?? 0,
    rate: input.channel?.rate ?? 1,
    billed_units: input.billed ?? 0,
    latency_ms: input.latencyMs,
    error: input.error ?? null
  });
}

async function callUpstream(channel: ChannelRecord, body: ChatRequest): Promise<AttemptResult> {
  const startedAt = Date.now();
  const apiKey = process.env[channel.api_key_env];
  if (!apiKey) {
    return {
      ok: false,
      status: 503,
      error: `未配置 ${channel.api_key_env}`,
      channel,
      startedAt
    };
  }

  const upstreamBody = {
    ...body,
    model: channel.model,
    ...(body.stream
      ? {
          stream_options: {
            ...(typeof body.stream_options === "object" && body.stream_options
              ? body.stream_options
              : {}),
            include_usage: true
          }
        }
      : {})
  };

  try {
    const response = await fetch(completionsUrl(channel), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(upstreamBody)
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      const error = text.slice(0, 500) || `HTTP ${response.status}`;
      updateChannelHealth(channel.id, {
        healthy: 0,
        latency_ms: Date.now() - startedAt,
        last_error: error
      });
      return { ok: false, status: response.status, error, channel, startedAt };
    }

    updateChannelHealth(channel.id, {
      healthy: 1,
      latency_ms: Date.now() - startedAt,
      last_error: null
    });
    return { ok: true, response, channel, startedAt };
  } catch (error) {
    const message = error instanceof Error ? error.message : "上游请求失败";
    updateChannelHealth(channel.id, {
      healthy: 0,
      latency_ms: Date.now() - startedAt,
      last_error: message
    });
    return { ok: false, status: 502, error: message, channel, startedAt };
  }
}

async function tryChannels(channels: ChannelRecord[], body: ChatRequest) {
  let last: AttemptResult | null = null;

  for (const channel of channels) {
    const result = await callUpstream(channel, body);
    if (result.ok) return result;
    last = result;
  }

  return (
    last ?? {
      ok: false,
      status: 503,
      error: "没有可用模型渠道",
      channel: null,
      startedAt: Date.now()
    }
  );
}

function createStreamingResponse(
  upstream: Response,
  body: ChatRequest,
  apiKey: ApiKeyRecord,
  channel: ChannelRecord,
  id: string,
  startedAt: number
) {
  const decoder = new TextDecoder();
  let buffer = "";
  let usage: Usage | null = null;
  let completionText = "";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.body?.getReader();
      if (!reader) {
        const message = "上游未返回可读流";
        controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: message })}\n\n`));
        controller.close();
        logRequest({
          id,
          key: apiKey,
          body,
          channel,
          status: "error",
          httpStatus: 502,
          latencyMs: Date.now() - startedAt,
          error: message
        });
        return;
      }

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);

          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split(/\r?\n\r?\n/);
          buffer = events.pop() ?? "";

          for (const event of events) {
            const data = event
              .split(/\r?\n/)
              .filter((line) => line.startsWith("data:"))
              .map((line) => line.slice(5).trim())
              .join("\n");

            if (!data || data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data) as {
                usage?: Usage;
                choices?: Array<{ delta?: { content?: string } }>;
              };
              if (parsed.usage) usage = parsed.usage;
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) completionText += delta;
            } catch {
              // Ignore provider-specific non-JSON SSE frames.
            }
          }
        }

        const finalUsage = normalizeUsage(
          usage,
          estimatePromptTokens(body),
          estimateTokensFromValue(completionText)
        );
        const billed = billedUnits(finalUsage, channel);
        updateApiKeyUsage(apiKey.id, billed);
        logRequest({
          id,
          key: apiKey,
          body,
          channel,
          status: "success",
          httpStatus: 200,
          usage: finalUsage,
          billed,
          latencyMs: Date.now() - startedAt
        });
        controller.close();
      } catch (error) {
        const message = error instanceof Error ? error.message : "流式响应中断";
        controller.enqueue(
          encoder.encode(`event: error\ndata: ${JSON.stringify({ error: { message } })}\n\n`)
        );
        logRequest({
          id,
          key: apiKey,
          body,
          channel,
          status: "error",
          httpStatus: 502,
          latencyMs: Date.now() - startedAt,
          error: message
        });
        controller.close();
      }
    }
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Relay-Request-Id": id,
      "X-Relay-Provider": channel.id
    }
  });
}

export async function handleChatCompletions(request: Request) {
  const id = requestId();
  const startedAt = Date.now();
  const secret = extractBearer(request.headers.get("authorization"));

  if (!secret || !secret.startsWith("sk-relay-")) {
    return openAiError("缺少有效的中转站 API Key", 401, "invalid_api_key");
  }

  const apiKey = findApiKeyBySecret(secret);
  if (!apiKey || apiKey.status !== "active") {
    return openAiError("API Key 不存在或已禁用", 401, "invalid_api_key");
  }

  if (apiKey.used_units >= apiKey.limit_units) {
    return openAiError("API Key 余额已用完", 402, "insufficient_quota");
  }

  let body: ChatRequest;
  try {
    body = (await request.json()) as ChatRequest;
  } catch {
    return openAiError("请求体不是合法 JSON", 400, "invalid_json");
  }

  const requestedModel = String(body.model ?? "auto");
  if (requestedModel !== "auto" && !getProviderByModel(requestedModel)) {
    return openAiError(
      `不支持的 model：${requestedModel}。可用模型：${providerDefinitions
        .map((provider) => provider.model)
        .concat("auto")
        .join(", ")}`,
      400,
      "model_not_found"
    );
  }

  const channels = candidatesForModel(requestedModel);
  if (channels.length === 0) {
    logRequest({
      id,
      key: apiKey,
      body,
      channel: null,
      status: "error",
      httpStatus: 503,
      latencyMs: Date.now() - startedAt,
      error: "没有可用模型渠道"
    });
    return openAiError("没有可用模型渠道，请检查环境变量和渠道状态", 503, "no_available_channel");
  }

  const result = await tryChannels(channels, body);
  if (!result.ok) {
    logRequest({
      id,
      key: apiKey,
      body,
      channel: result.channel,
      status: "error",
      httpStatus: result.status,
      latencyMs: Date.now() - startedAt,
      error: result.error
    });
    return openAiError(`所有上游渠道均调用失败：${result.error}`, 502, "upstream_error");
  }

  if (body.stream) {
    return createStreamingResponse(result.response, body, apiKey, result.channel, id, result.startedAt);
  }

  const responseJson = await result.response.json().catch(async () => {
    const text = await result.response.text().catch(() => "");
    return { raw: text };
  });
  const rawUsage = (responseJson as { usage?: Usage }).usage;
  const usage = normalizeUsage(
    rawUsage,
    estimatePromptTokens(body),
    estimateCompletionTokens(responseJson)
  );
  const billed = billedUnits(usage, result.channel);
  updateApiKeyUsage(apiKey.id, billed);
  logRequest({
    id,
    key: apiKey,
    body,
    channel: result.channel,
    status: "success",
    httpStatus: 200,
    usage,
    billed,
    latencyMs: Date.now() - startedAt
  });

  return Response.json(responseJson, {
    status: 200,
    headers: {
      "X-Relay-Request-Id": id,
      "X-Relay-Provider": result.channel.id
    }
  });
}
