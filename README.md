# Agent Context Visualizer

通过**本地反向代理插桩**，查看发给模型「真正的」上下文 —— `system + messages + tools` 的原始请求体（而非对话记录），并让人工参与「哪些内容需要保留」的精炼决策。

## 目标

1. **查看真实上下文** —— 捕获 `POST /v1/messages` 的请求体，展示 system 提示、每条消息、工具定义，以及**精确的** `input_tokens`。
2. **人工参与精炼** —— 逐条标记「保留 / 丢弃」，实时看到保留后的 token 占比，导出为 Markdown 或可直接喂给下一次请求的 `seed.json`。

## 运行

```bash
npm install
npm run proxy     # 终端 1：本地反向代理，监听 127.0.0.1:8787
npm run dev       # 终端 2：Web UI，http://localhost:5173
```

然后把 Claude Code（或任意 Anthropic 客户端）指向代理：

```bash
# Windows PowerShell
$env:ANTHROPIC_BASE_URL = "http://127.0.0.1:8787"
claude
```

```bash
# bash / zsh
export ANTHROPIC_BASE_URL=http://127.0.0.1:8787
claude
```

之后每次对话都会在 `captures/` 落一个 `<uuid>.json`，Web UI 的「API 捕获」页会实时列出并可点开查看。

> 安全：`x-api-key` / `authorization` 仅透传给上游 `api.anthropic.com`，**绝不写入捕获文件或日志**。

## 两个数据源

- **API 捕获**（默认）—— 反向代理拿到的真实请求体，包含 system + messages + tools 与精确 `input_tokens`。
- **Transcript**（回退）—— 解析 `~/.claude/projects/**/*.jsonl` 对话记录，用于在不跑代理时快速查看。注意它看到的是对话记录，可能已被压缩/摘要，**不是**模型真实收到的上下文。

## 架构

```
server/
  proxy.mjs     本地反向代理：捕获 /v1/messages，SSE 流式透传，抽取 input_tokens
src/
  lib/
    types.ts    数据模型（Message / Block / Transcript / CapturedCapture / CapturedContext）
    parse.ts    JSONL → Transcript 的规范化
    request.ts  API 请求体 → CapturedContext 的规范化
    tokens.ts   启发式 token 估算（CJK≈1，其余≈4 字符/token）
    export.ts   导出 Markdown / 过滤后 JSONL / seed.json
    api.ts      前端 API 客户端（sessions / captures）
  components/   React UI（捕获列表、system/tools、时间线、消息卡片、token 图、工具栏）
```

代理的环境变量：

| 变量 | 默认值 | 说明 |
|---|---|---|
| `CTX_PROXY_PORT` | `8787` | 代理监听端口 |
| `ANTHROPIC_UPSTREAM_URL` | `https://api.anthropic.com` | 上游地址 |
| `CTX_CAPTURES_DIR` | `<repo>/captures` | 捕获落盘目录 |
| `CTX_MAX_CAPTURES` | `200` | 最多保留的捕获数（超出按时间淘汰） |

## 已知限制与后续方向

- **先观察 + 事后编辑**：当前不做实时请求改写。你看到并标记的内容，通过「下载 seed.json」导出为新对话种子，再由人手动回灌到下一次对话。
- **system / tools 恒保留**：标记保留/丢弃只作用于 messages；system 与 tools 视为基础上下文，在导出时始终带上。
- **`parentUuid` 链会被 compaction 打断**（实测一个会话里 16 条消息是 orphan parent），因此 transcript 模式的分支识别用 Claude Code 自带的 `isSidechain` 字段。
- **token 估算**：messages 的逐条 token 用启发式（CJK≈1 字符/token，其余≈4 字符/token），仅用于相对分布；精确值以 API 返回的 `input_tokens` 为准。
- 尚未处理 `subagents/*.jsonl` 子代理会话、`--resume` 回灌（需校验 tool_use/tool_result 配对完整性）、以及实时改写请求体的「干预」模式。

## 关键技术问题（见首条对话分析）

1. 上下文 vs 对话记录的差异（本工具已改为 API 层插桩解决）
2. 事后分析 vs 实时捕获（当前为事后观察，实时改写留待后续）
3. 编辑的安全性与时机（tool_use/tool_result 配对、引用完整性）
4. token 计量的近似性（启发式 + API 精确值并存）
5. 长上下文渲染性能与隐私（全程本地，无数据上传）
