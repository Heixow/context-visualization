# Agent Context Visualizer

解析 **Claude Code** 的 transcript（`~/.claude/projects/**/*.jsonl`），可视化一个对话的完整上下文，并让人工参与"哪些内容需要保留"的精炼决策。

## 目标

1. **查看上下文** —— 以时间线展示 user/assistant 消息、thinking、工具调用（tool_use/tool_result）和附件，检查对话中可能遗漏的信息。
2. **人工参与精炼** —— 逐条标记"保留 / 丢弃"，实时看到保留后的 token 占比，并导出为 Markdown 或过滤后的 JSONL。

## 运行

```bash
npm install
npm run dev      # http://localhost:5173
```

dev 服务器自带 `/api/sessions`（列出本机会话）与 `/api/session?id=...`（读取原始 JSONL）。也可以直接把 `.jsonl` 文件拖进页面。

## 架构

```
src/
  lib/
    types.ts    数据模型（Message / Block / Transcript …）
    parse.ts    JSONL → Transcript 的规范化
    tree.ts     由 parentUuid + leafUuid 计算主链路
    tokens.ts   启发式 token 估算（CJK≈1，其余≈4 字符/token）
    export.ts   导出 Markdown / 过滤后 JSONL
    api.ts      前端 API 客户端
  components/   React UI（时间线、消息卡片、token 图、导出面板）
```

## 已知限制与后续方向

- **"上下文 ≠ 对话记录"**：本工具看到的是 transcript，模型真实收到的内容可能已被压缩/摘要。要看真实上下文需在 API 层插桩（另起炉灶）。
- **compaction 会打断 `parentUuid` 链**：长对话被 Claude Code 压缩后，旧消息的父指针会指向已被摘要掉的 uuid（实测一个会话里 16 条消息是 orphan parent）。因此分支识别用 Claude Code 自带的 `isSidechain` 字段，而非自行从 `parentUuid` 推主链路。
- **token 为启发式估算**，仅用于相对分布，不是精确值。
- 尚未处理 `subagents/*.jsonl` 子代理会话、行内编辑文本内容、以及 `--resume` 回灌过滤后的 JSONL（需校验 tool 配对完整性）。

## 关键技术问题（见首条对话分析）

1. 上下文 vs 对话记录的差异
2. 事后分析 vs 实时捕获
3. 编辑的安全性与时机（tool_use/tool_result 配对、引用完整性）
4. token 计量的近似性
5. 长上下文渲染性能与隐私（本工具全程本地，无数据上传）
