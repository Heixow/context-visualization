import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects');

interface SessionSummary {
  id: string;
  project: string;
  file: string;
  mtime: number;
  size: number;
  title?: string;
  preview?: string;
}

let cache: { at: number; list: SessionSummary[] } | null = null;

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
  if (cache && Date.now() - cache.at < 5000) return cache.list;
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
            id: f.slice(0, -6), // strip ".jsonl"
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
  cache = { at: Date.now(), list: out };
  return out;
}

/** Dev-only middleware：暴露 /api/sessions 和 /api/session?id=...，读取本地 transcript。 */
function transcriptsApi(): Plugin {
  return {
    name: 'transcripts-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        if (url.pathname === '/api/sessions') {
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(listSessions()));
          return;
        }
        if (url.pathname === '/api/session') {
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
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), transcriptsApi()],
  server: { port: 5173 },
});
