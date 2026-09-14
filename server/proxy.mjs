// 本地反向代理：捕获发给 Anthropic API 的真实上下文（system + messages + tools），
// 流式透传响应。用法：
//   1) node server/proxy.mjs
//   2) 设置 ANTHROPIC_BASE_URL=http://127.0.0.1:8787 再启动 Claude Code / 任何 Anthropic 客户端
//
// 安全：x-api-key / authorization 仅透传，绝不写入捕获文件或日志。

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const CAPTURES_DIR = process.env.CTX_CAPTURES_DIR || path.join(ROOT, 'captures');
const PORT = Number(process.env.CTX_PROXY_PORT || 8787);
const UPSTREAM = process.env.ANTHROPIC_UPSTREAM_URL || 'https://api.anthropic.com';
const MAX_CAPTURES = Number(process.env.CTX_MAX_CAPTURES || 200);

// hop-by-hop 头不能原样透传（node 自行管理）
const HOP_BY_HOP = new Set([
  'host', 'content-length', 'connection', 'keep-alive', 'transfer-encoding',
  'te', 'upgrade', 'proxy-authorization', 'proxy-authenticate', 'trailer',
]);

fs.mkdirSync(CAPTURES_DIR, { recursive: true });

function capturePath(id) {
  return path.join(CAPTURES_DIR, id + '.json');
}

function writeCapture(id, cap) {
  try {
    fs.writeFileSync(capturePath(id), JSON.stringify(cap));
    prune();
  } catch (e) {
    console.error('[ctx-proxy] 写捕获失败:', e.message);
  }
}

function prune() {
  try {
    const files = fs.readdirSync(CAPTURES_DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => ({ f, t: fs.statSync(path.join(CAPTURES_DIR, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    for (const { f } of files.slice(MAX_CAPTURES)) {
      fs.unlinkSync(path.join(CAPTURES_DIR, f));
    }
  } catch {
    /* ignore */
  }
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}

/** 透传到上游并流式回传。返回 { status, inputTokens }（inputTokens 来自 message_start / usage）。 */
async function forward(req, res, pathname, search, bodyText) {
  const headers = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (HOP_BY_HOP.has(k.toLowerCase())) continue;
    if (v === undefined) continue;
    headers[k] = Array.isArray(v) ? v.join(', ') : v;
  }
  headers.host = new URL(UPSTREAM).host;

  const upstream = await fetch(UPSTREAM + pathname + search, {
    method: req.method,
    headers,
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : bodyText,
  });

  const outHeaders = {};
  for (const [k, v] of upstream.headers) {
    const lk = k.toLowerCase();
    if (HOP_BY_HOP.has(lk) || lk === 'content-length') continue;
    outHeaders[k] = v;
  }
  res.writeHead(upstream.status, outHeaders);

  if (!upstream.body) {
    res.end();
    return { status: upstream.status, inputTokens: undefined };
  }

  const isStream = (upstream.headers.get('content-type') || '').includes('text/event-stream');
  const reader = upstream.body.getReader();
  let buf = '';
  let inputTokens;
  let capped = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
      if (!capped) {
        buf += Buffer.from(value).toString('utf8');
        if (inputTokens === undefined) {
          const m = buf.match(/"input_tokens"\s*:\s*(\d+)/);
          if (m) inputTokens = Number(m[1]);
        }
        if (buf.length > 256 * 1024 && inputTokens !== undefined) {
          buf = '';
          capped = true;
        }
      }
    }
  } finally {
    res.end();
  }

  if (inputTokens === undefined && !isStream) {
    try {
      const j = JSON.parse(buf);
      inputTokens = j?.usage?.input_tokens;
    } catch {
      /* ignore */
    }
  }

  return { status: upstream.status, inputTokens };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const pathname = url.pathname;
  const search = url.search;

  // 捕获 /v1/messages（真实上下文）
  if (req.method === 'POST' && pathname === '/v1/messages') {
    let bodyText = '';
    try {
      bodyText = await readBody(req);
    } catch {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ type: 'error', error: { type: 'bad_request', message: 'read body failed' } }));
      return;
    }

    let parsed = null;
    try {
      parsed = JSON.parse(bodyText);
    } catch {
      /* body 可能非 JSON，仍透传 */
    }

    const id = crypto.randomUUID();
    const cap = {
      id,
      timestamp: Date.now(),
      model: parsed?.model,
      maxTokens: parsed?.max_tokens,
      system: parsed?.system,
      messages: parsed?.messages ?? [],
      tools: parsed?.tools,
      inputTokens: undefined,
      responseStatus: undefined,
    };
    // 先落盘（即使转发失败也保留"客户端尝试发送了什么"）
    writeCapture(id, cap);

    try {
      const r = await forward(req, res, pathname, search, bodyText);
      cap.inputTokens = r.inputTokens;
      cap.responseStatus = r.status;
      writeCapture(id, cap);
    } catch (e) {
      if (!res.headersSent) {
        res.writeHead(502, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ type: 'error', error: { type: 'proxy_error', message: String(e?.message || e) } }));
      } else {
        res.end();
      }
      cap.responseStatus = 502;
      writeCapture(id, cap);
    }
    return;
  }

  // 其它路径（count_tokens、models 等）：透明透传，不捕获
  try {
    let bodyText;
    if (req.method !== 'GET' && req.method !== 'HEAD') bodyText = await readBody(req);
    await forward(req, res, pathname, search, bodyText);
  } catch (e) {
    if (!res.headersSent) {
      res.writeHead(502, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ type: 'error', error: { type: 'proxy_error', message: String(e?.message || e) } }));
    } else {
      res.end();
    }
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[ctx-proxy] 监听 http://127.0.0.1:${PORT}  ->  ${UPSTREAM}`);
  console.log(`[ctx-proxy] 捕获目录: ${CAPTURES_DIR}`);
  console.log(`[ctx-proxy] 在客户端设置 ANTHROPIC_BASE_URL=http://127.0.0.1:${PORT}`);
});
