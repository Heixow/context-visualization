import type { Transcript } from '../lib/types';
import { formatTokens } from '../lib/format';

interface Props {
  transcript: Transcript;
  kept: Set<string>;
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

export default function OverviewBar({ transcript, kept }: Props) {
  const total = transcript.totalTokens;
  const keptMsgs = transcript.messages.filter((m) => kept.has(m.uuid));
  const keptTokens = keptMsgs.reduce((s, m) => s + m.tokenEstimate, 0);
  const droppedCount = transcript.messages.length - keptMsgs.length;
  const pct = total > 0 ? Math.round((keptTokens / total) * 100) : 0;

  return (
    <div className="overview">
      <div className="overview-title">
        <h1>{transcript.title ?? '（无标题）'}</h1>
        <p className="meta">
          {transcript.cwd ?? '（未知目录）'}
          {transcript.gitBranch ? ` · ${transcript.gitBranch}` : ''}
          {transcript.sessionId ? ` · ${transcript.sessionId.slice(0, 8)}` : ''}
        </p>
      </div>
      <div className="stat-tiles">
        <StatTile label="保留 tokens" value={formatTokens(keptTokens)} delta={`${pct}%`} deltaGood accent />
        <StatTile label="总 tokens" value={formatTokens(total)} />
        <StatTile label="消息数" value={String(transcript.messages.length)} delta={droppedCount ? `已丢弃 ${droppedCount}` : undefined} />
        <StatTile label="保留消息" value={String(keptMsgs.length)} />
      </div>
    </div>
  );
}
