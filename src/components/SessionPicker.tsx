import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { listSessions, type SessionSummary } from '../lib/api';
import { formatBytes, formatTime } from '../lib/format';

interface Props {
  onOpen: (s: SessionSummary) => void;
  onLoadText: (raw: string) => void;
}

export default function SessionPicker({ onOpen, onLoadText }: Props) {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    listSessions()
      .then((s) => {
        if (alive) setSessions(s);
      })
      .catch((e) => {
        if (alive) setSessionsError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (alive) setSessionsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  async function readFile(file: File) {
    onLoadText(await file.text());
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void readFile(f);
  }

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) void readFile(f);
    e.target.value = '';
  }

  return (
    <div className="session-picker">
      <div className="hero">
        <h1>Agent Context Visualizer</h1>
        <p>解析 Claude Code transcript，查看上下文，标记要保留的内容并导出精炼版本。</p>
      </div>

      <div
        className={'dropzone' + (dragOver ? ' drag-over' : '')}
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <p>
          拖入一个 <code>.jsonl</code> 文件，或点击选择
        </p>
        <input ref={fileRef} type="file" accept=".jsonl,.json" hidden onChange={onPick} />
      </div>

      <div className="sessions">
        <h2>本机会话（~/.claude/projects）</h2>
        {sessionsLoading && <p className="muted">正在扫描…</p>}
        {sessionsError && (
          <p className="muted">无法列出会话（{sessionsError}）。可拖入文件，或确认已通过 npm run dev 启动。</p>
        )}
        {!sessionsLoading && !sessionsError && sessions.length === 0 && <p className="muted">未找到 transcript。</p>}
        <ul className="session-list">
          {sessions.map((s) => (
            <li key={s.id}>
              <button type="button" className="session-row" onClick={() => onOpen(s)}>
                <span className="session-title">{s.title ?? s.project}</span>
                <span className="session-preview">{s.preview ?? '—'}</span>
                <span className="session-meta">
                  {formatTime(s.mtime)} · {formatBytes(s.size)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
