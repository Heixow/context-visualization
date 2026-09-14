import { useCallback, useEffect, useState } from 'react';
import { clearCaptures, listCaptures, type CaptureSummary } from '../lib/api';
import { formatTime } from '../lib/format';

interface Props {
  onOpen: (c: CaptureSummary) => void;
}

export default function CapturesPanel({ onOpen }: Props) {
  const [captures, setCaptures] = useState<CaptureSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setCaptures(await listCaptures());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 2000);
    return () => clearInterval(t);
  }, [refresh]);

  async function onClear() {
    setClearing(true);
    try {
      await clearCaptures();
      await refresh();
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="captures-panel">
      <div className="hero">
        <h1>API 上下文捕获</h1>
        <p>通过本地反向代理插桩，看到发给模型「真正的」上下文 —— system + messages + tools 的原始请求体，而非对话记录。</p>
      </div>

      <div className="setup">
        <h2>如何开始</h2>
        <ol>
          <li>
            启动代理：<code>npm run proxy</code>（监听 <code>127.0.0.1:8787</code>）
          </li>
          <li>
            设置环境变量 <code>ANTHROPIC_BASE_URL=http://127.0.0.1:8787</code> 后启动 Claude Code
          </li>
          <li>
            对话一次，请求体会自动落到 <code>captures/</code> 目录并在此列出
          </li>
        </ol>
        <p className="muted">
          安全说明：<code>x-api-key</code> / <code>authorization</code> 仅透传给上游，绝不写入捕获文件或日志。
        </p>
      </div>

      <div className="captures-head">
        <h2>捕获列表</h2>
        <div className="actions">
          <button className="btn" onClick={() => void refresh()} disabled={loading}>
            刷新
          </button>
          <button className="btn" onClick={() => void onClear()} disabled={clearing || captures.length === 0}>
            清空
          </button>
        </div>
      </div>

      {error && <p className="muted">读取捕获失败：{error}（确认已通过 npm run dev 启动）</p>}
      {!loading && !error && captures.length === 0 && (
        <p className="muted empty">还没有捕获。按上面的步骤启动代理并对话一次。</p>
      )}

      <ul className="session-list">
        {captures.map((c) => (
          <li key={c.id}>
            <button type="button" className="session-row" onClick={() => onOpen(c)}>
              <span className="session-title">
                {formatTime(c.timestamp)} · {c.model ?? 'unknown'}
                {c.responseStatus != null && <span className="badge">{c.responseStatus}</span>}
              </span>
              <span className="session-preview">
                {c.messageCount} 条消息 · {c.toolCount} 个工具 · 精确 input{' '}
                {c.inputTokens != null ? c.inputTokens.toLocaleString() : '—'} tokens
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
