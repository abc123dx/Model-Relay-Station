import { KeyManager } from "@/components/admin/key-manager";
import { listApiKeys } from "@/lib/db";

export default function KeysPage() {
  const keys = listApiKeys().map(({ key_hash: _keyHash, ...key }) => key);

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-semibold tracking-normal">Key 管理</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          每个 Key 都可以设置余额上限，禁用或删除后立即停止鉴权通过。
        </p>
      </section>
      <KeyManager initialKeys={keys} />
    </div>
  );
}
