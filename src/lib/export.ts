import type { Message, Transcript } from './types';
import { stringifyForTokens } from './tokens';

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + '\n…(截断)';
}

/** 将保留的消息渲染为可读 Markdown（可粘贴回新对话作为上下文）。 */
export function toMarkdown(messages: Message[], keptIds: Set<string>): string {
  const lines: string[] = [];
  for (const m of messages) {
    if (!keptIds.has(m.uuid)) continue;
    const role = m.role === 'assistant' ? 'Assistant' : 'User';
    for (const b of m.blocks) {
      if (b.type === 'text' && b.text.trim()) {
        lines.push(`## ${role}\n\n${b.text}\n`);
      } else if (b.type === 'thinking' && b.thinking.trim()) {
        lines.push(`### ${role} · thinking\n\n${b.thinking}\n`);
      } else if (b.type === 'tool_use') {
        lines.push(`### ${role} · tool_use: ${b.name}\n\n\`\`\`json\n${truncate(stringifyForTokens(b.input), 4000)}\n\`\`\`\n`);
      } else if (b.type === 'tool_result') {
        const flag = b.is_error ? ' ⚠️ error' : '';
        lines.push(`### tool_result${flag}\n\n\`\`\`\n${truncate(stringifyForTokens(b.content), 4000)}\n\`\`\`\n`);
      }
    }
  }
  return lines.join('\n').trim();
}

/** 导出过滤后的 JSONL：保留被标记的消息/附件，结构事件（ai-title 等）恒保留。 */
export function toFilteredJsonl(t: Transcript, keptIds: Set<string>): string {
  const out: unknown[] = [];
  for (const e of t.rawEvents ?? []) {
    const rec = e as { type?: string; uuid?: string };
    if (rec.type === 'user' || rec.type === 'assistant' || rec.type === 'attachment') {
      if (rec.uuid && keptIds.has(String(rec.uuid))) out.push(e);
    } else {
      out.push(e);
    }
  }
  return out.map((o) => JSON.stringify(o)).join('\n') + (out.length ? '\n' : '');
}
