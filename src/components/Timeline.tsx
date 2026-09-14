import type { Attachment, Message, Transcript, ViewFilter } from '../lib/types';
import { messageMatchesQuery } from '../lib/search';
import { formatTokens } from '../lib/format';
import MessageCard from './MessageCard';

interface Props {
  transcript: Transcript;
  kept: Set<string>;
  onToggle: (uuid: string) => void;
  query: string;
  showThinking: boolean;
  viewFilter: ViewFilter;
}

type Item = { kind: 'msg'; msg: Message } | { kind: 'att'; att: Attachment };

function AttachmentChip({ att }: { att: Attachment }) {
  return (
    <div className="att-chip">
      <span className="att-kind">{att.kind}</span>
      <span className="att-summary">{att.summary}</span>
      <span className="att-tok">{formatTokens(att.tokenEstimate)}</span>
    </div>
  );
}

export default function Timeline({ transcript, kept, onToggle, query, showThinking, viewFilter }: Props) {
  const q = query.trim().toLowerCase();

  const items: Item[] = [
    ...transcript.messages.map((msg): Item => ({ kind: 'msg', msg })),
    ...transcript.attachments.map((att): Item => ({ kind: 'att', att })),
  ].sort((a, b) => {
    const ta = a.kind === 'msg' ? a.msg.timestamp : a.att.timestamp;
    const tb = b.kind === 'msg' ? b.msg.timestamp : b.att.timestamp;
    return ta - tb;
  });

  const visible = items.filter((it) => {
    if (it.kind === 'att') return viewFilter === 'all' && !q;
    const isKept = kept.has(it.msg.uuid);
    if (viewFilter === 'kept' && !isKept) return false;
    if (viewFilter === 'dropped' && isKept) return false;
    if (q && !messageMatchesQuery(it.msg, q)) return false;
    return true;
  });

  if (visible.length === 0) return <p className="empty muted">没有匹配的消息。</p>;

  return (
    <div className="timeline">
      {visible.map((it) =>
        it.kind === 'msg' ? (
          <MessageCard
            key={it.msg.uuid}
            message={it.msg}
            kept={kept.has(it.msg.uuid)}
            onToggle={onToggle}
            query={query}
            showThinking={showThinking}
          />
        ) : (
          <AttachmentChip key={it.att.uuid} att={it.att} />
        )
      )}
    </div>
  );
}
