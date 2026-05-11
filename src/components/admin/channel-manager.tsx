"use client";

import { useState } from "react";
import { Activity, RefreshCw, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils";
import type { ChannelRecord } from "@/lib/db";

type ChannelSummary = ChannelRecord & {
  env_configured: boolean;
};

export function ChannelManager({ initialChannels }: { initialChannels: ChannelSummary[] }) {
  const [channels, setChannels] = useState(initialChannels);
  const [checking, setChecking] = useState(false);

  async function toggle(channel: ChannelSummary) {
    const response = await fetch(`/api/admin/channels/${channel.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: channel.enabled !== 1 })
    });
    const data = await response.json();
    if (response.ok) {
      setChannels((current) =>
        current.map((item) =>
          item.id === channel.id
            ? { ...item, ...data.channel, env_configured: item.env_configured }
            : item
        )
      );
    }
  }

  async function refreshHealth() {
    setChecking(true);
    const response = await fetch("/api/admin/health/check", { method: "POST" });
    const data = await response.json();
    setChecking(false);
    if (response.ok) setChannels(data.channels);
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            模型渠道
          </CardTitle>
          <CardDescription>启停渠道、查看环境变量和健康检查结果</CardDescription>
        </div>
        <Button type="button" variant="outline" onClick={refreshHealth} disabled={checking}>
          <RefreshCw className={checking ? "animate-spin" : ""} />
          检测
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>渠道</TableHead>
              <TableHead>模型</TableHead>
              <TableHead>倍率</TableHead>
              <TableHead>Key</TableHead>
              <TableHead>健康</TableHead>
              <TableHead>最近检测</TableHead>
              <TableHead>错误</TableHead>
              <TableHead className="text-right">启停</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {channels.map((channel) => (
              <TableRow key={channel.id}>
                <TableCell>
                  <div className="font-medium">{channel.display_name}</div>
                  <div className="text-xs text-muted-foreground">{channel.base_url}</div>
                </TableCell>
                <TableCell className="font-mono text-xs">{channel.model}</TableCell>
                <TableCell>{channel.rate}x</TableCell>
                <TableCell>
                  <Badge variant={channel.env_configured ? "success" : "warning"}>
                    {channel.env_configured ? "已配置" : channel.api_key_env}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        !channel.env_configured
                          ? "warning"
                          : channel.healthy === 1
                            ? "success"
                            : "destructive"
                      }
                    >
                      {!channel.env_configured
                        ? "未配置"
                        : channel.healthy === 1
                          ? "可用"
                          : "异常"}
                    </Badge>
                    {channel.latency_ms ? (
                      <span className="text-xs text-muted-foreground">{channel.latency_ms}ms</span>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>{formatDateTime(channel.last_checked_at)}</TableCell>
                <TableCell className="max-w-[260px] truncate text-xs text-muted-foreground">
                  {channel.last_error || "-"}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end">
                    <Button type="button" variant="outline" size="sm" onClick={() => toggle(channel)}>
                      {channel.enabled === 1 ? <ToggleRight /> : <ToggleLeft />}
                      {channel.enabled === 1 ? "启用" : "停用"}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
