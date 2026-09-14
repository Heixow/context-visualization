import type { ApiBlock, ApiMessage, Block, CapturedCapture, CapturedContext, Message } from './types';
import { estimateBlockTokens, estimateTokens, stringifyForTokens } from './tokens';

function mapBlock(b: ApiBlock): Block | null {
  switch (b.type) {
    case 'text':
      return { type: 'text', text: typeof b.text === 'string' ? b.text : '' };
    case 'thinking':
      return { type: 'thinking', thinking: typeof b.thinking === 'string' ? b.thinking : '' };
    case 'tool_use':
      return { type: 'tool_use', id: String(b.id ?? ''), name: String(b.name ?? ''), input: b.input ?? null };
    case 'tool_result':
      return {
        type: 'tool_result',
        tool_use_id: String(b.tool_use_id ?? ''),
        content: b.content ?? null,
        is_error: Boolean(b.is_error),
      };
    default:
      // 未知块（image 等）降级为文本 dump
      return { type: 'text', text: stringifyForTokens(b) };
  }
}

function mapSystem(system: string | ApiBlock[] | undefined): { blocks: Block[]; text: string } {
  if (system == null) return { blocks: [], text: '' };
  const blocks: Block[] = [];
  const texts: string[] = [];
  const list: ApiBlock[] = typeof system === 'string' ? [{ type: 'text', text: system }] : system;
  for (const s of list) {
    const b = mapBlock(s);
    if (!b) continue;
    blocks.push(b);
    if (b.type === 'text') texts.push(b.text);
  }
  return { blocks, text: texts.join('\n\n') };
}

/** 把一次捕获的原始请求体解析成 UI 模型。 */
export function parseCapture(cap: CapturedCapture): CapturedContext {
  const system = mapSystem(cap.system);
  const systemTokens = system.blocks.reduce((s, b) => s + estimateBlockTokens(b), 0);

  const messages: Message[] = [];
  for (let i = 0; i < (cap.messages?.length ?? 0); i++) {
    const am: ApiMessage = cap.messages[i];
    const blocks: Block[] = [];
    for (const c of am.content ?? []) {
      const b = mapBlock(c);
      if (b) blocks.push(b);
    }
    messages.push({
      uuid: 'm' + i,
      parentUuid: null,
      role: am.role,
      timestamp: cap.timestamp + i,
      isSidechain: false,
      blocks,
      tokenEstimate: blocks.reduce((s, b) => s + estimateBlockTokens(b), 0),
    });
  }

  const tools = cap.tools ?? [];
  const toolsTokens = tools.reduce((s, t) => s + estimateTokens(stringifyForTokens(t)), 0);
  const heuristicTokens = systemTokens + toolsTokens + messages.reduce((s, m) => s + m.tokenEstimate, 0);

  return {
    id: cap.id,
    timestamp: cap.timestamp,
    model: cap.model,
    system: system.blocks,
    systemText: system.text,
    systemTokens,
    tools,
    toolsTokens,
    messages,
    apiMessages: cap.messages ?? [],
    inputTokens: cap.inputTokens,
    heuristicTokens,
    responseStatus: cap.responseStatus,
  };
}
