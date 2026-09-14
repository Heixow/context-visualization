export interface SessionSummary {
  id: string;
  project: string;
  file: string;
  mtime: number;
  size: number;
  title?: string;
  preview?: string;
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
