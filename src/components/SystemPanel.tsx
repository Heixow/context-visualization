import { useState } from 'react';
import type { ApiToolDef, Block } from '../lib/types';
import { formatTokens, truncate } from '../lib/format';
import { stringifyForTokens } from '../lib/tokens';
import ContentBlockView from './ContentBlockView';

interface Props {
  system: Block[];
  systemTokens: number;
  tools: ApiToolDef[];
  toolsTokens: number;
  query: string;
  showThinking: boolean;
}

function ToolRow({ tool }: { tool: ApiToolDef }) {
  const [open, setOpen] = useState(false);
  const name = tool.name ?? '(unnamed)';
  const desc = typeof tool.description === 'string' ? tool.description : '';
  return (
    <div className="tool-row">
      <button className="tool-head" onClick={() => setOpen((v) => !v)}>
        <span className="tool-name">🔧 {name}</span>
        <span className="tool-id">{truncate(desc, 120)}</span>
        <span className="chevron">{open ? '▾' : '▸'}</span>
      </button>
      {open && <pre className="tool-body">{truncate(stringifyForTokens(tool.input_schema ?? tool), 4000)}</pre>}
    </div>
  );
}

export default function SystemPanel({ system, systemTokens, tools, toolsTokens, query, showThinking }: Props) {
  return (
    <section className="system-panel">
      <div className="panel-head">
        <h2>System &amp; Tools</h2>
        <span className="muted">
          system {formatTokens(systemTokens)} · tools {tools.length}（{formatTokens(toolsTokens)}）
        </span>
      </div>

      {system.length === 0 ? (
        <p className="muted">（无 system 提示）</p>
      ) : (
        <div className="system-blocks">
          {system.map((b, i) => (
            <ContentBlockView key={i} block={b} query={query} showThinking={showThinking} />
          ))}
        </div>
      )}

      {tools.length > 0 && (
        <div className="tools-list">
          <h3>Tools</h3>
          {tools.map((t, i) => (
            <ToolRow key={i} tool={t} />
          ))}
        </div>
      )}
    </section>
  );
}
