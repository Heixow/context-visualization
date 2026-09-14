import type { Message } from '../lib/types';
import { formatTime, formatTokens, shortUuid } from '../lib/format';
import ContentBlockView from './ContentBlockView';

interface Props {
  message: Message;
  kept: boolean;
  onToggle: (uuid: string) => void;
  query: string;
  showThinking: boolean;
}

export default function MessageCard({ message: m, kept, onToggle, query, showThinking }: Props) {
  const isUser = m.role === 'user';
  const color = isUser ? 'var(--user)' : 'var(--assistant)';

  return (
    <article id={'msg-' + m.uuid} className={'msg-card' + (kept ? '' : ' dropped') + (m.isSidechain ? ' branch' : '')}>
      <header className="msg-head">
        <span className="role-dot" style={{ background: color }} />
        <span className="role">{isUser ? 'User' : 'Assistant'}</span>
        <span className="msg-time">{formatTime(m.timestamp)}</span>
        <span className="msg-id">{shortUuid(m.uuid)}</span>
        {m.isSidechain && <span className="badge branch-badge">sidechain</span>}
        <span className="msg-tokens">{formatTokens(m.tokenEstimate)} tok</span>
        <button
          type="button"
          className={'keep-toggle ' + (kept ? 'kept' : 'dropped')}
          onClick={() => onToggle(m.uuid)}
          title={kept ? '标记为丢弃' : '标记为保留'}
        >
          {kept ? '保留' : '丢弃'}
        </button>
      </header>
      <div className="msg-body">
        {m.blocks.map((b, i) => (
          <ContentBlockView key={i} block={b} query={query} showThinking={showThinking} />
        ))}
        {m.blocks.length === 0 && <p className="muted">（无内容块）</p>}
      </div>
    </article>
  );
}
