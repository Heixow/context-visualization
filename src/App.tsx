import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Transcript, ViewFilter } from './lib/types';
import { parseTranscript } from './lib/parse';
import { fetchSession, type SessionSummary } from './lib/api';
import { messageMatchesQuery } from './lib/search';
import SessionPicker from './components/SessionPicker';
import OverviewBar from './components/OverviewBar';
import Toolbar from './components/Toolbar';
import TokenChart from './components/TokenChart';
import Timeline from './components/Timeline';

export default function App() {
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kept, setKept] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [showThinking, setShowThinking] = useState(true);
  const [viewFilter, setViewFilter] = useState<ViewFilter>('all');
  const [theme, setTheme] = useState<'light' | 'dark' | null>(null);

  useEffect(() => {
    if (theme) document.documentElement.setAttribute('data-theme', theme);
    else document.documentElement.removeAttribute('data-theme');
  }, [theme]);

  const loadText = useCallback((raw: string) => {
    setLoading(true);
    setError(null);
    try {
      const t = parseTranscript(raw);
      setTranscript(t);
      setKept(new Set(t.messages.map((m) => m.uuid)));
      setQuery('');
      setViewFilter('all');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const openSession = useCallback(
    async (s: SessionSummary) => {
      setLoading(true);
      setError(null);
      try {
        loadText(await fetchSession(s.id));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      }
    },
    [loadText]
  );

  const toggleKeep = useCallback((uuid: string) => {
    setKept((prev) => {
      const next = new Set(prev);
      if (next.has(uuid)) next.delete(uuid);
      else next.add(uuid);
      return next;
    });
  }, []);

  const setAll = useCallback(
    (keep: boolean) => {
      if (!transcript) return;
      setKept(keep ? new Set(transcript.messages.map((m) => m.uuid)) : new Set());
    },
    [transcript]
  );

  const matchCount = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!transcript || !q) return 0;
    return transcript.messages.filter((m) => messageMatchesQuery(m, q)).length;
  }, [transcript, query]);

  const jumpTo = useCallback((uuid: string) => {
    document.getElementById('msg-' + uuid)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Agent Context Visualizer</h1>
        <span className="muted">Claude Code transcript 查看与精炼</span>
        <span className="spacer" />
        {transcript && (
          <button
            className="btn btn-ghost"
            onClick={() => {
              setTranscript(null);
              setError(null);
            }}
          >
            ← 选择会话
          </button>
        )}
        <button
          className="btn btn-ghost"
          title="切换主题"
          onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        >
          {theme === 'dark' ? '☀' : '🌙'}
        </button>
      </header>

      {error && <div className="error-banner">⚠ {error}</div>}
      {loading && <div className="loading-bar">正在解析 transcript…</div>}

      {!transcript ? (
        <SessionPicker onOpen={openSession} onLoadText={loadText} />
      ) : (
        <>
          <OverviewBar transcript={transcript} kept={kept} />
          <Toolbar
            transcript={transcript}
            kept={kept}
            query={query}
            onQuery={setQuery}
            matchCount={matchCount}
            showThinking={showThinking}
            onShowThinking={setShowThinking}
            viewFilter={viewFilter}
            onViewFilter={setViewFilter}
            onSetAll={setAll}
          />
          <div className="workspace">
            <Timeline
              transcript={transcript}
              kept={kept}
              onToggle={toggleKeep}
              query={query}
              showThinking={showThinking}
              viewFilter={viewFilter}
            />
            <TokenChart transcript={transcript} kept={kept} onJump={jumpTo} />
          </div>
        </>
      )}
    </div>
  );
}
