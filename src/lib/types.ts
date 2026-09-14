export type Role = 'user' | 'assistant';

export type Block =
  | { type: 'text'; text: string }
  | { type: 'thinking'; thinking: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: unknown; is_error?: boolean };

export interface Message {
  uuid: string;
  parentUuid: string | null;
  role: Role;
  timestamp: number;
  isSidechain: boolean;
  blocks: Block[];
  cwd?: string;
  sessionId?: string;
  gitBranch?: string;
  version?: string;
  slug?: string;
  apiBlockIndex?: number;
  /** 估算 token 数（启发式，非精确值） */
  tokenEstimate: number;
}

export interface Attachment {
  uuid: string;
  parentUuid: string | null;
  timestamp: number;
  kind: string;
  summary: string;
  detail: unknown;
  tokenEstimate: number;
}

export type MetaKind =
  | 'ai-title'
  | 'last-prompt'
  | 'file-history-snapshot'
  | 'queue-operation'
  | 'other';

export interface MetaEvent {
  kind: MetaKind;
  timestamp: number;
  summary: string;
  detail?: unknown;
}

export interface Transcript {
  sessionId?: string;
  cwd?: string;
  gitBranch?: string;
  title?: string;
  messages: Message[];
  attachments: Attachment[];
  meta: MetaEvent[];
  leafUuid?: string;
  totalTokens: number;
  /** 原始事件（用于导出过滤后的 JSONL） */
  rawEvents?: unknown[];
}

export type ViewFilter = 'all' | 'kept' | 'dropped';

// ---- API 层捕获（真实上下文）----

export interface ApiTextBlock {
  type: 'text';
  text: string;
}
export interface ApiToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: unknown;
}
export interface ApiToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: unknown;
  is_error?: boolean;
}
export interface ApiThinkingBlock {
  type: 'thinking';
  thinking: string;
}
export type ApiBlock =
  | ApiTextBlock
  | ApiToolUseBlock
  | ApiToolResultBlock
  | ApiThinkingBlock
  | { type: string; [k: string]: unknown };

export interface ApiMessage {
  role: 'user' | 'assistant';
  content: ApiBlock[];
}

export interface ApiToolDef {
  name?: string;
  description?: string;
  input_schema?: unknown;
  [k: string]: unknown;
}

/** 代理落盘的原始捕获（一次 /v1/messages 请求）。 */
export interface CapturedCapture {
  id: string;
  timestamp: number;
  model?: string;
  maxTokens?: number;
  system?: string | ApiBlock[];
  messages: ApiMessage[];
  tools?: ApiToolDef[];
  inputTokens?: number;
  responseStatus?: number;
}

/** 解析后的捕获上下文，供 UI 渲染。messages 与 apiMessages 并行（uuid 为 m{i}）。 */
export interface CapturedContext {
  id: string;
  timestamp: number;
  model?: string;
  system: Block[];
  systemText: string;
  systemTokens: number;
  tools: ApiToolDef[];
  toolsTokens: number;
  messages: Message[];
  apiMessages: ApiMessage[];
  inputTokens?: number;
  heuristicTokens: number;
  responseStatus?: number;
}
