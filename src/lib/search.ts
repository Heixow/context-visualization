import type { Message } from './types';

/** 判断一条消息是否命中搜索词（覆盖 text/thinking/tool_use/tool_result）。 */
export function messageMatchesQuery(m: Message, q: string): boolean {
  const needle = q.toLowerCase();
  return m.blocks.some((b) => {
    if (b.type === 'text') return b.text.toLowerCase().includes(needle);
    if (b.type === 'thinking') return b.thinking.toLowerCase().includes(needle);
    if (b.type === 'tool_use') {
      return b.name.toLowerCase().includes(needle) || JSON.stringify(b.input ?? '').toLowerCase().includes(needle);
    }
    if (b.type === 'tool_result') return JSON.stringify(b.content ?? '').toLowerCase().includes(needle);
    return false;
  });
}
