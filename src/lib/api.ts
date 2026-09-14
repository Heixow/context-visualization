import type { CapturedCapture } from './types';

export interface SessionSummary {
  id: string;
  project: string;
  file: string;
  mtime: number;
  size: number;
  title?: string;
  preview?: string;
}

export interface CaptureSummary {
  id: string;
  timestamp: number;
  model?: string;
  inputTokens?: number;
  responseStatus?: number;
  messageCount: number;
  toolCount: number;
  systemChars: number;
}

export async function listSessions(): Promise<SessionSummary[]> {
  const res = await fetch('/api/sessions');
  if (!res.ok) throw new Error(`sessions api failed: ${res.status}`);
  return res.json();
}

export async function fetchSession(id: string): Promise<string> {
  const res = await fetch(`/api/session?id=${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`session api failed: ${res.status}`);
  return res.text();
}

export async function listCaptures(): Promise<CaptureSummary[]> {
  const res = await fetch('/api/captures');
  if (!res.ok) throw new Error(`captures api failed: ${res.status}`);
  return res.json();
}

export async function fetchCapture(id: string): Promise<CapturedCapture> {
  const res = await fetch(`/api/capture?id=${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`capture api failed: ${res.status}`);
  return res.json();
}

export async function clearCaptures(): Promise<void> {
  await fetch('/api/captures', { method: 'DELETE' });
}
