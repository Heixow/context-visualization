import type { Transcript, ViewFilter } from '../lib/types';
import { toFilteredJsonl, toMarkdown } from '../lib/export';

interface Props {
  transcript: Transcript;
  kept: Set<string>;
  query: string;
  onQuery: (q: string) => void;
  matchCount: number;
  showThinking: boolean;
  onShowThinking: (v: boolean) => void;
  viewFilter: ViewFilter;
  onViewFilter: (v: ViewFilter) => void;
  onSetAll: (keep: boolean) => void;
}

function download(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

const FILTERS: { key: ViewFilter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'kept', label: '保留' },
  { key: 'dropped', label: '丢弃' },
];

export default function Toolbar({
  transcript,
  kept,
  query,
  onQuery,
  matchCount,
  showThinking,
  onShowThinking,
  viewFilter,
  onViewFilter,
  onSetAll,
}: Props) {
  const keptCount = transcript.messages.filter((m) => kept.has(m.uuid)).length;

  return (
    <div className="toolbar">
      <label className="search">
        <input
          type="search"
          placeholder="搜索上下文（text / thinking / 工具调用）…"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
        />
        {matchCount > 0 && <span className="count">{matchCount} 命中</span>}
      </label>

      <label className="check">
        <input type="checkbox" checked={showThinking} onChange={(e) => onShowThinking(e.target.checked)} />
        thinking
      </label>

      <div className="seg" role="tablist" aria-label="视图过滤">
        {FILTERS.map((f) => (
          <button key={f.key} className={viewFilter === f.key ? 'active' : ''} onClick={() => onViewFilter(f.key)}>
            {f.label}
          </button>
        ))}
      </div>

      <span className="divider" />

      <button className="btn" onClick={() => onSetAll(true)}>
        全部保留
      </button>
      <button className="btn" onClick={() => onSetAll(false)}>
        全部丢弃
      </button>

      <span className="divider" />

      <span className="check muted">
        保留 {keptCount}/{transcript.messages.length}
      </span>
      <button className="btn" onClick={() => void navigator.clipboard.writeText(toMarkdown(transcript.messages, kept))}>
        复制 Markdown
      </button>
      <button className="btn" onClick={() => download('context.md', toMarkdown(transcript.messages, kept), 'text/markdown')}>
        下载 .md
      </button>
      <button className="btn" onClick={() => download('context.jsonl', toFilteredJsonl(transcript, kept), 'application/x-ndjson')}>
        下载 .jsonl
      </button>
    </div>
  );
}
