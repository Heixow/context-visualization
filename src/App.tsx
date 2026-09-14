import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ApiToolDef, Attachment, Block, CapturedContext, Message, Transcript, ViewFilter } from './lib/types';
import { parseTranscript } from './lib/parse';
import { parseCapture } from './lib/request';
import { captureToMarkdown, captureToSeedJson, toFilteredJsonl, toMarkdown } from './lib/export';
import { fetchCapture, fetchSession, type CaptureSummary, type SessionSummary } from './lib/api';
import { messageMatchesQuery } from './lib/search';
import { formatTime, formatTokens } from './lib/format';
import SessionPicker from './components/SessionPicker';
import CapturesPanel from './components/CapturesPanel';
import SystemPanel from './components/SystemPanel';
import OverviewBar from './components/OverviewBar';
import Toolbar from './components/Toolbar';
import TokenChart from './components/TokenChart';
import Timeline from './components/Timeline';

type Source = 'captures' | 'transcript';

interface ViewModel {
  kind: Source;
  title: string;
  meta?: string;
  messages: Message[];
  attachments: Attachment[];
  totalTokens: number;
  exactInputTokens?: number;
  auxTiles: { label: string; value: string }[];
  system?: Block[];
  systemTokens?: number;
  tools?: ApiToolDef[];
  toolsTokens?: number;
  jsonLabel: string;
  jsonFilename: string;
  exportMarkdown: (kept: Set<string>) => string;
  exportJson: (kept: Set<string>) => string;
}

export default function App() {
  const [source, setSource] = useState<Source>('captures');
  const [capture, setCapture] = useState<CapturedContext | null>(null);
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

  // ---- transcript ----
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

  // ---- captures ----
  const openCapture = useCallback(async (c: CaptureSummary) => {
    setLoading(true);
    setError(null);
    try {
      const ctx = parseCapture(await fetchCapture(c.id));
      setCapture(ctx);
      setKept(new Set(ctx.messages.map((m) => m.uuid)));
      setQuery('');
      setViewFilter('all');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const view = useMemo<ViewModel | null>(() => {
    if (source === 'captures' && capture) {
      const msgTokens = capture.messages.reduce((s, m) => s + m.tokenEstimate, 0);
      return {
        kind: 'captures',
        title: 'API 请求捕获',
        meta: `${capture.model ?? 'unknown model'} · ${formatTime(capture.timestamp)} · ${capture.messages.length} 条消息`,
        messages: capture.messages,
        attachments: [],
        totalTokens: msgTokens,
        exactInputTokens: capture.inputTokens,
        auxTiles: [
          { label: 'system', value: formatTokens(capture.systemTokens) },
          { label: 'tools', value: formatTokens(capture.toolsTokens) },
        ],
        system: capture.system,
        systemTokens: capture.systemTokens,
        tools: capture.tools,
        toolsTokens: capture.toolsTokens,
        jsonLabel: '下载 seed.json',
        jsonFilename: 'seed.json',
        exportMarkdown: (k) => captureToMarkdown(capture, k),
        exportJson: (k) => captureToSeedJson(capture, k),
      };
    }
    if (source === 'transcript' && transcript) {
      return {
        kind: 'transcript',
        title: transcript.title ?? 'Transcript',
        meta: transcript.cwd ?? transcript.sessionId ?? transcript.gitBranch,
        messages: transcript.messages,
        attachments: transcript.attachments,
        totalTokens: transcript.totalTokens,
        auxTiles: [],
        jsonLabel: '下载 .jsonl',
        jsonFilename: 'context.jsonl',
        exportMarkdown: (k) => toMarkdown(transcript.messages, k),
        exportJson: (k) => toFilteredJsonl(transcript, k),
      };
    }
    return null;
  }, [source, capture, transcript]);

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
      if (!view) return;
      setKept(keep ? new Set(view.messages.map((m) => m.uuid)) : new Set());
    },
    [view]
  );

  const matchCount = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!view || !q) return 0;
    return view.messages.filter((m) => messageMatchesQuery(m, q)).length;
  }, [view, query]);

  const jumpTo = useCallback((uuid: string) => {
    document.getElementById('msg-' + uuid)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const goBack = useCallback(() => {
    if (source === 'captures') setCapture(null);
    else setTranscript(null);
    setError(null);
  }, [source]);

  const mdExport = useCallback(() => (view ? view.exportMarkdown(kept) : ''), [view, kept]);
  const jsonExport = useCallback(() => (view ? view.exportJson(kept) : ''), [view, kept]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Agent Context Visualizer</h1>
        <div className="seg" role="tablist" aria-label="数据源">
          <button className={source === 'captures' ? 'active' : ''} onClick={() => setSource('captures')}>
            API 捕获
          </button>
          <button className={source === 'transcript' ? 'active' : ''} onClick={() => setSource('transcript')}>
            Transcript
          </button>
        </div>
        <span className="spacer" />
        {view && (
          <button className="btn btn-ghost" onClick={goBack}>
            ← 返回列表
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
      {loading && <div className="loading-bar">正在加载…</div>}

      {!view ? (
        source === 'captures' ? (
          <CapturesPanel onOpen={openCapture} />
        ) : (
          <SessionPicker onOpen={openSession} onLoadText={loadText} />
        )
      ) : (
        <>
          <OverviewBar
            title={view.title}
            meta={view.meta}
            messages={view.messages}
            totalTokens={view.totalTokens}
            kept={kept}
            exactInputTokens={view.exactInputTokens}
            auxTiles={view.auxTiles}
          />
          <Toolbar
            messages={view.messages}
            kept={kept}
            query={query}
            onQuery={setQuery}
            matchCount={matchCount}
            showThinking={showThinking}
            onShowThinking={setShowThinking}
            viewFilter={viewFilter}
            onViewFilter={setViewFilter}
            onSetAll={setAll}
            onExportMarkdown={mdExport}
            onExportJsonl={jsonExport}
            jsonLabel={view.jsonLabel}
            jsonFilename={view.jsonFilename}
          />
          <div className="workspace">
            <div className="main-col">
              {view.system && (
                <SystemPanel
                  system={view.system}
                  systemTokens={view.systemTokens ?? 0}
                  tools={view.tools ?? []}
                  toolsTokens={view.toolsTokens ?? 0}
                  query={query}
                  showThinking={showThinking}
                />
              )}
              <Timeline
                messages={view.messages}
                attachments={view.attachments}
                kept={kept}
                onToggle={toggleKeep}
                query={query}
                showThinking={showThinking}
                viewFilter={viewFilter}
              />
            </div>
            <TokenChart messages={view.messages} kept={kept} onJump={jumpTo} />
          </div>
        </>
      )}
    </div>
  );
}
