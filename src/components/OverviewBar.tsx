import type { Message } from '../lib/types';
import { formatTokens } from '../lib/format';

interface Props {
  title: string;
  meta?: string;
  messages: Message[];
  totalTokens: number;
  kept: Set<string>;
  /** API 层真实 input_tokens（捕获模式才有） */
  exactInputTokens?: number;
  /** 额外统计块（system / tools 等） */
  auxTiles?: { label: string; value: string }[];
}

function StatTile({
  label,
  value,
  delta,
  deltaGood,
  accent,
}: {
  label: string;
  value: string;
  delta?: string;
  deltaGood?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="stat-tile">
      <div className="stat-label">{label}</div>
      <div className={'stat-value' + (accent ? ' accent' : '')}>{value}</div>
      {delta && <div className={'stat-delta' + (deltaGood ? ' good' : '')}>{delta}</div>}
    </div>
  );
}

export default function OverviewBar({ title, meta, messages, totalTokens, kept, exactInputTokens, auxTiles }: Props) {
  const keptMsgs = messages.filter((m) => kept.has(m.uuid));
  const keptTokens = keptMsgs.reduce((s, m) => s + m.tokenEstimate, 0);
  const droppedCount = messages.length - keptMsgs.length;
  const pct = totalTokens > 0 ? Math.round((keptTokens / totalTokens) * 100) : 0;

  return (
    <div className="overview">
      <div className="overview-title">
        <h1>{title}</h1>
        {meta && <p className="meta">{meta}</p>}
      </div>
      <div className="stat-tiles">
        {exactInputTokens != null && (
          <StatTile label="精确输入 tokens" value={formatTokens(exactInputTokens)} delta="API usage" accent />
        )}
        <StatTile label="保留 tokens" value={formatTokens(keptTokens)} delta={`${pct}%`} deltaGood accent />
        <StatTile label="消息 tokens" value={formatTokens(totalTokens)} delta={exactInputTokens == null ? '估算' : undefined} />
        <StatTile label="消息数" value={String(messages.length)} delta={droppedCount ? `已丢弃 ${droppedCount}` : undefined} />
        <StatTile label="保留消息" value={String(keptMsgs.length)} />
        {(auxTiles ?? []).map((t) => (
          <StatTile key={t.label} label={t.label} value={t.value} />
        ))}
      </div>
    </div>
  );
}
