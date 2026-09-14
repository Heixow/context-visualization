import { useMemo } from 'react';
import type { Message } from '../lib/types';
import { formatTime, formatTokens } from '../lib/format';
import { estimateBlockTokens } from '../lib/tokens';

interface Props {
  messages: Message[];
  kept: Set<string>;
  onJump: (uuid: string) => void;
}

export default function TokenChart({ messages, kept, onJump }: Props) {
  const max = useMemo(() => Math.max(1, ...messages.map((m) => m.tokenEstimate)), [messages]);

  if (messages.length === 0) return <aside className="token-chart"><p className="muted empty">无消息</p></aside>;

  return (
    <aside className="token-chart">
      <div className="panel-head">
        <h2>Token 分布</h2>
        <span className="muted">条长按估算比例（max {formatTokens(max)}）</span>
      </div>
      <div className="legend">
        <span className="legend-item">
          <i className="dot" style={{ background: 'var(--user)' }} />
          User
        </span>
        <span className="legend-item">
          <i className="dot" style={{ background: 'var(--assistant)' }} />
          Assistant
        </span>
      </div>
      <ul className="bar-list">
        {messages.map((m, i) => {
          const isKept = kept.has(m.uuid);
          const breakdown = m.blocks
            .map((b) => `${b.type.replace('_', ' ')} ${formatTokens(estimateBlockTokens(b))}`)
            .join(' · ');
          const tip = `#${i + 1} ${m.role} ${formatTime(m.timestamp)} — ${formatTokens(m.tokenEstimate)} tokens${
            breakdown ? `\n${breakdown}` : ''
          }`;
          return (
            <li key={m.uuid} className={'bar-row' + (isKept ? '' : ' dropped')} title={tip} onClick={() => onJump(m.uuid)}>
              <span className="bar-label">
                <span className="bar-index">{i + 1}</span>
                <span className={'bar-role ' + m.role}>{m.role === 'user' ? 'U' : 'A'}</span>
              </span>
              <span className="bar-track">
                <span
                  className="bar-fill"
                  style={{
                    width: `${(m.tokenEstimate / max) * 100}%`,
                    background: m.role === 'user' ? 'var(--user)' : 'var(--assistant)',
                  }}
                />
              </span>
              <span className="bar-value">{formatTokens(m.tokenEstimate)}</span>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
