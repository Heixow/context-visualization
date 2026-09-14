import type { Block } from './types';

// 粗略的启发式：CJK 字符约 1 token/字，其余约 4 字符/token。
// 仅用于相对分布判断，不是精确计数。
const CJK_RE = /[　-〿぀-ヿ一-鿿가-힯＀-￯]/;

export function estimateTokens(text: string): number {
  if (!text) return 0;
  let cjk = 0;
  let other = 0;
  for (const ch of text) {
    if (CJK_RE.test(ch)) cjk++;
    else other++;
  }
  return Math.max(1, Math.ceil(cjk + other / 4));
}

export function stringifyForTokens(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v);
  } catch {
    return '';
  }
}

export function estimateBlockTokens(b: Block): number {
  switch (b.type) {
    case 'text':
      return estimateTokens(b.text);
    case 'thinking':
      return estimateTokens(b.thinking);
    case 'tool_use':
      return estimateTokens(stringifyForTokens(b.input));
    case 'tool_result':
      return estimateTokens(stringifyForTokens(b.content));
  }
}
