import { useState, type ReactNode } from 'react';
import type { Block } from '../lib/types';
import { truncate } from '../lib/format';
import { stringifyForTokens } from '../lib/tokens';

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlight(text: string, query: string): ReactNode {
  const q = query.trim();
  if (!q) return text;
  const re = new RegExp(`(${escapeRegExp(q)})`, 'gi');
  return text.split(re).map((part, i) => (part.toLowerCase() === q.toLowerCase() ? <mark key={i}>{part}</mark> : part));
}

interface Props {
  block: Block;
  query: string;
  showThinking: boolean;
}

export default function ContentBlockView({ block, query, showThinking }: Props) {
  const [open, setOpen] = useState(false);

  switch (block.type) {
    case 'text':
      return <div className="block block-text">{highlight(block.text, query)}</div>;

    case 'thinking':
      if (!showThinking) return null;
      return (
        <div className="block block-thinking">
          <details>
            <summary>thinking</summary>
            <div className="thinking-body">{highlight(block.thinking, query)}</div>
          </details>
        </div>
      );

    case 'tool_use':
      return (
        <div className="block block-tool">
          <button className="tool-head" onClick={() => setOpen((v) => !v)}>
            <span className="tool-name">⚙ {block.name}</span>
            <span className="tool-id">{block.id}</span>
            <span className="chevron">{open ? '▾' : '▸'}</span>
          </button>
          {open && <pre className="tool-body">{truncate(stringifyForTokens(block.input), 4000)}</pre>}
        </div>
      );

    case 'tool_result': {
      const text = stringifyForTokens(block.content);
      const isErr = Boolean(block.is_error);
      return (
        <div className="block block-result">
          <button className="tool-head" onClick={() => setOpen((v) => !v)}>
            <span className={'result-label' + (isErr ? ' err' : '')}>{isErr ? '⚠ tool_result (error)' : '↩ tool_result'}</span>
            <span className="tool-id">{block.tool_use_id}</span>
            <span className="chevron">{open ? '▾' : '▸'}</span>
          </button>
          {open && <pre className="tool-body">{truncate(text, 4000)}</pre>}
        </div>
      );
    }

    default:
      return null;
  }
}
