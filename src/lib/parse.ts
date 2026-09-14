import type { Attachment, Block, Message, MetaEvent, Transcript } from './types';
import { estimateBlockTokens, estimateTokens } from './tokens';

type Raw = Record<string, any>;

function toMillis(t: unknown): number {
  if (typeof t === 'number' && Number.isFinite(t)) return t;
  if (typeof t === 'string') {
    const n = Date.parse(t);
    if (!Number.isNaN(n)) return n;
  }
  return 0;
}

function normalizeBlock(c: Raw): Block | null {
  switch (c.type) {
    case 'text':
      return { type: 'text', text: typeof c.text === 'string' ? c.text : '' };
    case 'thinking':
      return { type: 'thinking', thinking: typeof c.thinking === 'string' ? c.thinking : '' };
    case 'tool_use':
      return { type: 'tool_use', id: String(c.id ?? ''), name: String(c.name ?? ''), input: c.input ?? null };
    case 'tool_result':
      return {
        type: 'tool_result',
        tool_use_id: String(c.tool_use_id ?? ''),
        content: c.content ?? null,
        is_error: Boolean(c.is_error),
      };
    default:
      return null;
  }
}

function summarizeAttachment(kind: string, snap: Raw): string {
  switch (kind) {
    case 'environment':
      return `cwd: ${snap.workingDirectory ?? '?'}`;
    case 'git':
      return typeof snap.status === 'string' ? snap.status : 'git snapshot';
    case 'terminal':
      return String(snap.preview ?? snap.output ?? '').slice(0, 80) || 'terminal';
    case 'screenshot':
      return 'screenshot';
    default: {
      const s = JSON.stringify(snap);
      return s.length > 80 ? s.slice(0, 80) + '…' : s;
    }
  }
}

export function parseTranscript(raw: string): Transcript {
  const events: Raw[] = [];
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try {
      events.push(JSON.parse(t));
    } catch {
      /* skip malformed line */
    }
  }

  const messages: Message[] = [];
  const attachments: Attachment[] = [];
  const meta: MetaEvent[] = [];
  let sessionId: string | undefined;
  let cwd: string | undefined;
  let gitBranch: string | undefined;
  let title: string | undefined;
  let leafUuid: string | undefined;

  for (const e of events) {
    sessionId ??= typeof e.sessionId === 'string' ? e.sessionId : undefined;
    cwd ??= typeof e.cwd === 'string' ? e.cwd : undefined;
    gitBranch ??= typeof e.gitBranch === 'string' ? e.gitBranch : undefined;

    switch (e.type) {
      case 'user':
      case 'assistant': {
        const content = Array.isArray(e.message?.content) ? e.message.content : [];
        const blocks: Block[] = [];
        for (const c of content) {
          const b = normalizeBlock(c as Raw);
          if (b) blocks.push(b);
        }
        messages.push({
          uuid: String(e.uuid ?? ''),
          parentUuid: typeof e.parentUuid === 'string' ? e.parentUuid : null,
          role: e.type,
          timestamp: toMillis(e.timestamp),
          isSidechain: Boolean(e.isSidechain),
          blocks,
          cwd: typeof e.cwd === 'string' ? e.cwd : undefined,
          sessionId: typeof e.sessionId === 'string' ? e.sessionId : undefined,
          gitBranch: typeof e.gitBranch === 'string' ? e.gitBranch : undefined,
          version: typeof e.version === 'string' ? e.version : undefined,
          slug: typeof e.slug === 'string' ? e.slug : undefined,
          apiBlockIndex: typeof e.apiBlockIndex === 'number' ? e.apiBlockIndex : undefined,
          tokenEstimate: 0,
        });
        break;
      }
      case 'attachment': {
        const kind = typeof e.attachment?.type === 'string' ? e.attachment.type : 'attachment';
        const snap = (e.attachment?.snapshot ?? {}) as Raw;
        attachments.push({
          uuid: String(e.uuid ?? ''),
          parentUuid: typeof e.parentUuid === 'string' ? e.parentUuid : null,
          timestamp: toMillis(e.timestamp),
          kind,
          summary: summarizeAttachment(kind, snap),
          detail: e.attachment,
          tokenEstimate: estimateTokens(JSON.stringify(snap)),
        });
        break;
      }
      case 'ai-title':
        title ??= typeof e.aiTitle === 'string' ? e.aiTitle : undefined;
        meta.push({ kind: 'ai-title', timestamp: toMillis(e.timestamp), summary: String(e.aiTitle ?? '') });
        break;
      case 'last-prompt':
        if (typeof e.leafUuid === 'string') leafUuid = e.leafUuid;
        meta.push({ kind: 'last-prompt', timestamp: toMillis(e.timestamp), summary: '', detail: e });
        break;
      case 'file-history-snapshot':
        meta.push({ kind: 'file-history-snapshot', timestamp: 0, summary: '', detail: e });
        break;
      case 'queue-operation':
        meta.push({ kind: 'queue-operation', timestamp: toMillis(e.timestamp), summary: String(e.operation ?? '') });
        break;
      default:
        meta.push({ kind: 'other', timestamp: toMillis(e.timestamp), summary: String(e.type ?? '') });
    }
  }

  for (const m of messages) {
    let total = 0;
    for (const b of m.blocks) total += estimateBlockTokens(b);
    m.tokenEstimate = total;
  }

  const totalTokens =
    messages.reduce((s, m) => s + m.tokenEstimate, 0) +
    attachments.reduce((s, a) => s + a.tokenEstimate, 0);

  return {
    sessionId,
    cwd,
    gitBranch,
    title,
    messages,
    attachments,
    meta,
    leafUuid,
    totalTokens,
    rawEvents: events,
  };
}
