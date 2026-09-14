import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects');
const CAPTURES_DIR = process.env.CTX_CAPTURES_DIR || path.join(ROOT, 'captures');

interface SessionSummary {
  id: string;
  project: string;
  file: string;
  mtime: number;
  size: number;
  title?: string;
  preview?: string;
}

let sessionCache: { at: number; list: SessionSummary[] } | null = null;

/** 轻量扫描单个 transcript，提取 ai-title 和第一条用户消息作为列表预览。 */
function scanForMeta(file: string): { title?: string; preview?: string } {
  let title: string | undefined;
  let preview: string | undefined;
  try {
    const text = fs.readFileSync(file, 'utf8');
    for (const line of text.split('\n')) {
      const t = line.trim();
      if (!t) continue;
      let o: any;
      try {
        o = JSON.parse(t);
      } catch {
        continue;
      }
      if (o.type === 'ai-title' && typeof o.aiTitle === 'string' && !title) title = o.aiTitle;
      if (!preview && o.type === 'user' && Array.isArray(o.message?.content)) {
        for (const c of o.message.content) {
          if (c?.type === 'text' && typeof c.text === 'string' && c.text.trim()) {
            preview = c.text.slice(0, 120);
            break;
          }
        }
      }
      if (title && preview) break;
    }
  } catch {
    /* unreadable file -> no meta */
  }
  return { title, preview };
}

function listSessions(): SessionSummary[] {
  if (sessionCache && Date.now() - sessionCache.at < 5000) return sessionCache.list;
  const out: SessionSummary[] = [];
  if (fs.existsSync(PROJECTS_DIR)) {
    for (const proj of fs.readdirSync(PROJECTS_DIR)) {
      const projDir = path.join(PROJECTS_DIR, proj);
      let isDir = false;
      try {
        isDir = fs.statSync(projDir).isDirectory();
      } catch {
        continue;
      }
      if (!isDir) continue;
      for (const f of fs.readdirSync(projDir)) {
        if (!f.endsWith('.jsonl')) continue;
        const full = path.join(projDir, f);
        try {
          const st = fs.statSync(full);
          const { title, preview } = scanForMeta(full);
          out.push({
            id: f.slice(0, -6),
            project: proj,
            file: full,
            mtime: st.mtimeMs,
            size: st.size,
            title,
            preview,
          });
        } catch {
          /* ignore */
        }
      }
    }
  }
  out.sort((a, b) => b.mtime - a.mtime);
  sessionCache = { at: Date.now(), list: out };
  return out;
}

/** 读取代理落盘的捕获（captures/*.json），按时间倒序。 */
function listCaptures(): any[] {
  if (!fs.existsSync(CAPTURES_DIR)) return [];
  const out: any[] = [];
  for (const f of fs.readdirSync(CAPTURES_DIR)) {
    if (!f.endsWith('.json')) continue;
    try {
      out.push(JSON.parse(fs.readFileSync(path.join(CAPTURES_DIR, f), 'utf8')));
    } catch {
      /* ignore */
    }
  }
  out.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
  return out;
}

function summarizeCapture(c: any) {
  const system = c.system;
  const systemChars =
    typeof system === 'string' ? system.length : Array.isArray(system) ? JSON.stringify(system).length : 0;
  return {
    id: c.id,
    timestamp: c.timestamp,
    model: c.model,
    inputTokens: c.inputTokens,
    responseStatus: c.responseStatus,
    messageCount: Array.isArray(c.messages) ? c.messages.length : 0,
    toolCount: Array.isArray(c.tools) ? c.tools.length : 0,
    systemChars,
  };
}

/** Dev-only 中间件：transcript 会话 + 代理捕获。 */
function ctxApi(): Plugin {
  return {
    name: 'ctx-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        const p = url.pathname;

        if (p === '/api/sessions') {
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(listSessions()));
          return;
        }
        if (p === '/api/session') {
          const id = url.searchParams.get('id') ?? '';
          if (!/^[0-9a-fA-F-]+$/.test(id)) {
            res.statusCode = 400;
            res.end('invalid id');
            return;
          }
          const found = listSessions().find((s) => s.id === id);
          if (!found) {
            res.statusCode = 404;
            res.end('session not found');
            return;
          }
          res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
          res.end(fs.readFileSync(found.file, 'utf8'));
          return;
        }

        if (p === '/api/captures') {
          if (req.method === 'DELETE') {
            for (const f of fs.readdirSync(CAPTURES_DIR)) {
              if (f.endsWith('.json')) fs.unlinkSync(path.join(CAPTURES_DIR, f));
            }
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end('{"ok":true}');
            return;
          }
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(listCaptures().map(summarizeCapture)));
          return;
        }
        if (p === '/api/capture') {
          const id = url.searchParams.get('id') ?? '';
          if (!/^[0-9a-fA-F-]+$/.test(id)) {
            res.statusCode = 400;
            res.end('invalid id');
            return;
          }
          const file = path.join(CAPTURES_DIR, id + '.json');
          if (!fs.existsSync(file)) {
            res.statusCode = 404;
            res.end('capture not found');
            return;
          }
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(fs.readFileSync(file, 'utf8'));
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), ctxApi()],
  server: { port: 5173 },
});
