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
