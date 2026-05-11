"use client";

import { useMemo, useState } from "react";
import { Copy, KeyRound, Plus, Power, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { compactKey, formatDateTime, formatNumber } from "@/lib/utils";
import type { ApiKeyRecord } from "@/lib/db";

type SerializableKey = Omit<ApiKeyRecord, "key_hash">;

export function KeyManager({ initialKeys }: { initialKeys: SerializableKey[] }) {
  const [keys, setKeys] = useState(initialKeys);
  const [name, setName] = useState("默认业务");
  const [limitUnits, setLimitUnits] = useState(1000000);
  const [createdKey, setCreatedKey] = useState("");
  const [busy, setBusy] = useState(false);
  const totalLimit = useMemo(
    () => keys.reduce((sum, item) => sum + Number(item.limit_units), 0),
    [keys]
  );

  async function createKey(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const response = await fetch("/api/admin/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, limit_units: limitUnits })
    });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) return;
    setCreatedKey(data.key);
    const { key_hash: _keyHash, ...record } = data.record as ApiKeyRecord;
    setKeys((current) => [record, ...current]);
  }

  async function toggleKey(key: SerializableKey) {
    const nextStatus = key.status === "active" ? "disabled" : "active";
    const response = await fetch(`/api/admin/keys/${key.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus })
    });
    const data = await response.json();
    if (response.ok) {
      const { key_hash: _keyHash, ...record } = data.key as ApiKeyRecord;
      setKeys((current) => current.map((item) => (item.id === key.id ? record : item)));
    }
  }

  async function removeKey(id: number) {
    const response = await fetch(`/api/admin/keys/${id}`, { method: "DELETE" });
    if (response.ok) setKeys((current) => current.filter((item) => item.id !== id));
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            创建 API Key
          </CardTitle>
          <CardDescription>生成 `sk-relay-` 开头的中转站 Key</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={createKey}>
            <div className="space-y-2">
              <Label htmlFor="key-name">名称</Label>
              <Input id="key-name" value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="limit">余额上限</Label>
              <Input
                id="limit"
                type="number"
                min={1}
                value={limitUnits}
                onChange={(event) => setLimitUnits(Number(event.target.value))}
              />
            </div>
            <Button className="w-full" type="submit" disabled={busy}>
              <Plus />
              创建
            </Button>
          </form>

          {createdKey ? (
            <div className="mt-5 rounded-md border bg-secondary p-3">
              <div className="mb-2 text-xs font-medium text-muted-foreground">仅显示一次</div>
              <div className="break-all font-mono text-sm">{createdKey}</div>
              <Button
                className="mt-3"
                type="button"
                size="sm"
                variant="outline"
                onClick={() => navigator.clipboard?.writeText(createdKey)}
              >
                <Copy />
                复制
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle>Key 列表</CardTitle>
            <CardDescription>
              共 {keys.length} 个 Key，累计额度 {formatNumber(totalLimit, 2)}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>用量</TableHead>
                <TableHead>最后调用</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((key) => (
                <TableRow key={key.id}>
                  <TableCell className="font-medium">{key.name}</TableCell>
                  <TableCell className="font-mono text-xs">{compactKey(key.key_prefix)}</TableCell>
                  <TableCell>
                    <Badge variant={key.status === "active" ? "success" : "secondary"}>
                      {key.status === "active" ? "启用" : "禁用"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {formatNumber(key.used_units, 2)} / {formatNumber(key.limit_units, 2)}
                  </TableCell>
                  <TableCell>{formatDateTime(key.last_used_at)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button type="button" size="icon" variant="outline" onClick={() => toggleKey(key)}>
                        <Power />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        onClick={() => removeKey(key.id)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {keys.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    还没有 Key
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
