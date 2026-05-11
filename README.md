# ai-relay

一个基于 Next.js + TypeScript + SQLite 的 OpenAI API 兼容大模型中转站。

## 快速开始

```bash
npm.cmd install
copy .env.example .env.local
npm.cmd run dev
```

打开 `http://localhost:3000/admin`，使用 `.env.local` 里的 `ADMIN_PASSWORD` 登录。

## OpenAI 兼容入口

```text
POST /v1/chat/completions
Authorization: Bearer sk-relay-...
Content-Type: application/json
```

支持 `stream: true` 的 SSE 响应。客户端只需要把 OpenAI SDK 的 `base_url` 改成本站地址，把 `api_key` 改成后台创建的 `sk-relay-...`。

## 模型

- `deepseek-v4`（上游默认映射到 `deepseek-v4-pro`）
- `glm-5`
- `qwen-plus`
- `auto`

`auto` 会在可用渠道里随机负载均衡。指定单个模型时，如果上游失败，会自动重试其他可用渠道。

## 环境变量

```text
DEEPSEEK_API_KEY=
ZHIPU_API_KEY=
DASHSCOPE_API_KEY=
```

未配置上游 Key 时，后台仍可正常运行；对应渠道会显示未配置或不可用。
