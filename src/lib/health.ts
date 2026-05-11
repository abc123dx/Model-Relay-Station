import {
  type ChannelRecord,
  listChannels,
  updateChannelHealth
} from "@/lib/db";

declare global {
  // eslint-disable-next-line no-var
  var __aiRelayHealthTimer: NodeJS.Timeout | undefined;
  // eslint-disable-next-line no-var
  var __aiRelayHealthRunning: boolean | undefined;
}

function completionsUrl(channel: ChannelRecord) {
  return `${channel.base_url.replace(/\/$/, "")}/chat/completions`;
}

function getProviderKey(channel: ChannelRecord) {
  return process.env[channel.api_key_env];
}

export async function checkChannelHealth(channel: ChannelRecord) {
  const apiKey = getProviderKey(channel);
  if (!apiKey) {
    return updateChannelHealth(channel.id, {
      healthy: 0,
      latency_ms: null,
      last_error: `未配置 ${channel.api_key_env}`
    });
  }

  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(completionsUrl(channel), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: channel.model,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
        stream: false
      }),
      signal: controller.signal
    });

    const latency = Date.now() - startedAt;
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return updateChannelHealth(channel.id, {
        healthy: 0,
        latency_ms: latency,
        last_error: text.slice(0, 240) || `HTTP ${response.status}`
      });
    }

    await response.arrayBuffer().catch(() => undefined);
    return updateChannelHealth(channel.id, {
      healthy: 1,
      latency_ms: latency,
      last_error: null
    });
  } catch (error) {
    return updateChannelHealth(channel.id, {
      healthy: 0,
      latency_ms: Date.now() - startedAt,
      last_error: error instanceof Error ? error.message : "健康检查失败"
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function runHealthChecks() {
  if (globalThis.__aiRelayHealthRunning) return listChannels();
  globalThis.__aiRelayHealthRunning = true;
  try {
    const channels = listChannels().filter((channel) => channel.enabled === 1);
    await Promise.all(channels.map((channel) => checkChannelHealth(channel)));
    return listChannels();
  } finally {
    globalThis.__aiRelayHealthRunning = false;
  }
}

export function ensureHealthScheduler() {
  if (process.env.ENABLE_HEALTH_SCHEDULER === "false") return;
  if (globalThis.__aiRelayHealthTimer) return;

  const interval = Number(process.env.HEALTH_CHECK_INTERVAL_MS ?? 300000);
  globalThis.__aiRelayHealthTimer = setInterval(() => {
    runHealthChecks().catch(() => undefined);
  }, Math.max(interval, 60000));
  globalThis.__aiRelayHealthTimer.unref?.();
}
