import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { API_URL } from '../config/api';
import { useAuth } from '../contexts/AuthContext';

interface ChatSessionSummary {
  _id: string;
  title: string;
  updatedAt: string;
  createdAt: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: Array<Record<string, any>>;
  createdAt?: string;
  model?: { provider: string; providerLabel?: string; model: string; preferredUsed?: boolean | null };
  // Client-only flag, never persisted
  local?: 'stopped';
}

interface ProviderModel {
  id: string;
  status: 'available' | 'cooling';
  reason?: string;
  secondsLeft?: number;
}

interface ProviderInfo {
  provider: string;
  label: string;
  configured: boolean;
  models: ProviderModel[];
  probe?: { ok: boolean; model: string; latencyMs: number; error?: string };
}

type ModelPreference = { provider: string; model?: string } | null;

interface IndexStatus {
  lastIndexedAt: string | null;
  totalRecords: number;
  indexedRecords: number;
  running: boolean;
}

interface AdminAiChatProps {
  variant?: 'embedded' | 'modal';
  onClose?: () => void;
}

const MAX_INPUT = 4000;

const SUGGESTIONS = [
  { label: 'New patients this month', prompt: 'How many patients registered in the last 30 days?' },
  { label: 'Common conditions', prompt: 'Which chronic conditions are most common across patients?' },
  { label: 'Most active hospitals', prompt: 'Which hospitals added the most medical records this month?' },
  { label: 'Frequent allergies', prompt: 'What are the most frequently reported allergies?' },
];

/* ----------------------------------------------------------------------------
 * Icons
 * ------------------------------------------------------------------------- */

const Icon: React.FC<{ name: string; size?: number }> = ({ name, size = 20 }) => {
  const common = {
    width: size,
    height: size,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    viewBox: '0 0 24 24',
    'aria-hidden': true,
  };
  switch (name) {
    case 'compose': return <svg {...common}><path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.4 2.6a2 2 0 0 1 2.9 2.9L12 14.8 8 16l1.2-4z" /></svg>;
    case 'send': return <svg {...common} strokeWidth={2.2}><path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" /></svg>;
    case 'stop': return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden><rect x="7" y="7" width="10" height="10" rx="2" /></svg>;
    case 'copy': return <svg {...common}><rect x="8" y="8" width="13" height="13" rx="2.5" /><path d="M16 8V5.5A2.5 2.5 0 0 0 13.5 3h-8A2.5 2.5 0 0 0 3 5.5v8A2.5 2.5 0 0 0 5.5 16H8" /></svg>;
    case 'check': return <svg {...common}><path d="M20 6 9 17l-5-5" /></svg>;
    case 'trash': return <svg {...common}><path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg>;
    case 'close': return <svg {...common}><path d="M18 6 6 18M6 6l12 12" /></svg>;
    case 'sidebar': return <svg {...common}><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M9 4v16" /></svg>;
    case 'down': return <svg {...common}><path d="M12 5v14M18 13l-6 6-6-6" /></svg>;
    case 'retry': return <svg {...common}><path d="M3 12a9 9 0 0 1 15.3-6.4L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.3 6.4L3 16M3 21v-5h5" /></svg>;
    case 'edit': return <svg {...common}><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>;
    case 'lock': return <svg {...common}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>;
    case 'chip': return <svg {...common}><rect x="6" y="6" width="12" height="12" rx="2" /><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" /></svg>;
    case 'db': return <svg {...common}><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" /></svg>;
    default: return null;
  }
};

/* ----------------------------------------------------------------------------
 * Minimal, safe markdown renderer (no HTML injection)
 * ------------------------------------------------------------------------- */

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const token = match[0];
    const key = `${keyPrefix}-${i++}`;
    if (token.startsWith('`')) nodes.push(<code key={key}>{token.slice(1, -1)}</code>);
    else if (token.startsWith('**')) nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    else nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    last = match.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

const isTableRow = (line: string) => /^\s*\|.*\|\s*$/.test(line);
const isTableDivider = (line: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);
const splitRow = (line: string) => line.trim().replace(/^\||\|$/g, '').split('|').map(cell => cell.trim());
const BULLET = /^\s*[-*•]\s+/;
const NUMBERED = /^\s*\d+[.)]\s+/;
const HEADING = /^(#{1,4})\s+(.*)$/;

function renderMarkdown(source: string): React.ReactNode[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  const startsTable = (n: number) => isTableRow(lines[n]) && n + 1 < lines.length && isTableDivider(lines[n + 1]);

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      blocks.push(<hr key={key++} />);
      i++;
      continue;
    }

    if (line.trim().startsWith('```')) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) body.push(lines[i++]);
      i++;
      blocks.push(<pre key={key++}><code>{body.join('\n')}</code></pre>);
      continue;
    }

    if (startsTable(i)) {
      const header = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && isTableRow(lines[i])) rows.push(splitRow(lines[i++]));
      blocks.push(
        <div key={key++} className="g-table">
          <table>
            <thead><tr>{header.map((cell, c) => <th key={c}>{renderInline(cell, `th${c}`)}</th>)}</tr></thead>
            <tbody>{rows.map((row, r) => <tr key={r}>{row.map((cell, c) => <td key={c}>{renderInline(cell, `td${r}${c}`)}</td>)}</tr>)}</tbody>
          </table>
        </div>
      );
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      const Tag = heading[1].length <= 2 ? 'h3' : 'h4';
      blocks.push(<Tag key={key++}>{renderInline(heading[2], `h${key}`)}</Tag>);
      i++;
      continue;
    }

    if (BULLET.test(line) || NUMBERED.test(line)) {
      const ordered = NUMBERED.test(line);
      const marker = ordered ? NUMBERED : BULLET;
      const items: string[] = [];
      while (i < lines.length && marker.test(lines[i])) items.push(lines[i++].replace(marker, ''));
      const ListTag = ordered ? 'ol' : 'ul';
      blocks.push(
        <ListTag key={key++}>
          {items.map((item, n) => <li key={n}>{renderInline(item, `li${key}-${n}`)}</li>)}
        </ListTag>
      );
      continue;
    }

    const para: string[] = [];
    while (
      i < lines.length && lines[i].trim() && !lines[i].trim().startsWith('```') &&
      !HEADING.test(lines[i]) && !BULLET.test(lines[i]) && !NUMBERED.test(lines[i]) && !startsTable(i)
    ) {
      para.push(lines[i++]);
    }
    blocks.push(
      <p key={key++}>
        {para.map((p, n) => (
          <React.Fragment key={n}>{n > 0 && <br />}{renderInline(p, `p${key}-${n}`)}</React.Fragment>
        ))}
      </p>
    );
  }
  return blocks;
}

/* ----------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

function groupSessions(sessions: ChatSessionSummary[]) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const today = startOfToday.getTime();
  const day = 24 * 60 * 60 * 1000;
  const groups: Array<{ label: string; items: ChatSessionSummary[] }> = [
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'Previous 7 days', items: [] },
    { label: 'Older', items: [] },
  ];
  for (const s of sessions) {
    const t = new Date(s.updatedAt).getTime();
    if (t >= today) groups[0].items.push(s);
    else if (t >= today - day) groups[1].items.push(s);
    else if (t >= today - 7 * day) groups[2].items.push(s);
    else groups[3].items.push(s);
  }
  return groups.filter(g => g.items.length > 0);
}

async function readError(resp: Response, fallback: string) {
  const data = await resp.json().catch(() => null);
  if (data?.error) return String(data.error);
  if (resp.status === 404) return `${fallback}: the server does not support this yet. Restart the backend.`;
  return `${fallback} (HTTP ${resp.status})`;
}

const PREFERENCE_KEY = 'golu.modelPreference';

function loadPreference(): ModelPreference {
  try {
    const raw = localStorage.getItem(PREFERENCE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.provider ? parsed : null;
  } catch {
    return null;
  }
}

function savePreference(value: ModelPreference) {
  try {
    if (value) localStorage.setItem(PREFERENCE_KEY, JSON.stringify(value));
    else localStorage.removeItem(PREFERENCE_KEY);
  } catch {
    // Storage unavailable (private mode); the choice just won't persist
  }
}

function timeAgo(iso: string | null, now: number) {
  if (!iso) return 'never';
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function shortModel(id: string) {
  return id.replace(/^(openai|google|qwen|nvidia|meta-llama|mistralai)\//, '').replace(/:free$/, '');
}

function initials(name?: string) {
  if (!name) return 'A';
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || 'A';
}

/* ----------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const AdminAiChat: React.FC<AdminAiChatProps> = ({ variant = 'embedded', onClose }) => {
  const { user } = useAuth();
  const adminId = user?.id;

  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');

  const [listLoading, setListLoading] = useState(true);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [failedPrompt, setFailedPrompt] = useState<{ text: string; error: string } | null>(null);
  const [toast, setToast] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);

  const [reindexing, setReindexing] = useState(false);
  const [indexStatus, setIndexStatus] = useState<IndexStatus | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [preference, setPreference] = useState<ModelPreference>(() => loadPreference());
  // Model the open chat was started with (fixed for that chat)
  const [chatPreference, setChatPreference] = useState<ModelPreference>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [checkingLive, setCheckingLive] = useState(false);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  // Progressive reveal of the newest assistant reply
  const [revealIndex, setRevealIndex] = useState<number | null>(null);
  const [revealLength, setRevealLength] = useState(0);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const stickToBottomRef = useRef(true);

  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [sessions]
  );
  const groupedSessions = useMemo(() => groupSessions(sortedSessions), [sortedSessions]);
  const isRevealing = revealIndex !== null;
  const busy = sending || isRevealing;
  // A chat's model is chosen before the first message and stays fixed afterwards
  const chatLocked = Boolean(activeSessionId) || messages.length > 0 || sending;
  const lastAssistantIndex = useMemo(() => {
    for (let n = messages.length - 1; n >= 0; n--) if (messages[n].role === 'assistant') return n;
    return -1;
  }, [messages]);

  const showToast = (text: string, tone: 'ok' | 'error' = 'ok') => {
    setToast({ text, tone });
    window.setTimeout(() => setToast(current => (current?.text === text ? null : current)), 3500);
  };

  /* ---------------------------- Data loading ---------------------------- */

  const fetchSession = useCallback(async (sessionId: string) => {
    if (!adminId) return;
    setSessionLoading(true);
    setFailedPrompt(null);
    setRevealIndex(null);
    try {
      const resp = await fetch(`${API_URL}/superadmin/chat/sessions/${sessionId}?adminId=${adminId}`);
      if (!resp.ok) throw new Error(await readError(resp, 'Failed to load chat'));
      const data = await resp.json();
      stickToBottomRef.current = true;
      setMessages(data.session?.messages || []);
      setChatPreference(data.session?.preference?.provider ? data.session.preference : null);
    } catch (err: any) {
      showToast(err?.message || 'Failed to load chat', 'error');
    } finally {
      setSessionLoading(false);
    }
  }, [adminId]);

  const fetchSessions = useCallback(async (selectFirst = false) => {
    if (!adminId) return;
    try {
      const resp = await fetch(`${API_URL}/superadmin/chat/sessions?adminId=${adminId}`);
      if (!resp.ok) throw new Error(await readError(resp, 'Failed to load chats'));
      const data = await resp.json();
      const list: ChatSessionSummary[] = data.sessions || [];
      setSessions(list);
      if (selectFirst && list.length) {
        setActiveSessionId(list[0]._id);
        fetchSession(list[0]._id);
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to load chats', 'error');
    } finally {
      setListLoading(false);
    }
  }, [adminId, fetchSession]);

  useEffect(() => {
    if (!adminId) return;
    fetchSessions();
  }, [adminId, fetchSessions]);

  useEffect(() => {
    textareaRef.current?.focus();
    return () => abortRef.current?.abort();
  }, []);


  // Keep relative times ("3 min ago") fresh
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!pickerOpen) return;
    const onPointer = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) setPickerOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.stopPropagation(); setPickerOpen(false); }
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [pickerOpen]);

  /* ------------------------------ Effects ------------------------------- */

  useEffect(() => {
    if (revealIndex === null) return;
    const full = messages[revealIndex]?.content || '';
    if (revealLength >= full.length) { setRevealIndex(null); return; }
    const step = Math.max(3, Math.ceil(full.length / 90));
    const frame = requestAnimationFrame(() => setRevealLength(len => Math.min(full.length, len + step)));
    return () => cancelAnimationFrame(frame);
  }, [revealIndex, revealLength, messages]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [messages, revealLength, sending, failedPrompt]);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 208)}px`;
  }, [input, messages.length]);

  useEffect(() => {
    if (!pendingDeleteId) return;
    const id = window.setTimeout(() => setPendingDeleteId(null), 3000);
    return () => window.clearTimeout(id);
  }, [pendingDeleteId]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distance < 80;
    setShowScrollButton(distance > 200);
  };

  const scrollToBottom = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottomRef.current = true;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  };

  /* ------------------------------ Actions ------------------------------- */

  const startNewChat = () => {
    setChatPreference(null);
    abortRef.current?.abort();
    setActiveSessionId(null);
    setMessages([]);
    setInput('');
    setFailedPrompt(null);
    setRevealIndex(null);
    setSidebarOpen(false);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const openSession = (sessionId: string) => {
    setSidebarOpen(false);
    if (sessionId === activeSessionId) return;
    abortRef.current?.abort();
    setActiveSessionId(sessionId);
    fetchSession(sessionId);
  };

  const deleteSession = async (sessionId: string) => {
    if (pendingDeleteId !== sessionId) { setPendingDeleteId(sessionId); return; }
    setPendingDeleteId(null);
    const previous = sessions;
    setSessions(list => list.filter(s => s._id !== sessionId));
    if (sessionId === activeSessionId) startNewChat();
    try {
      const resp = await fetch(`${API_URL}/superadmin/chat/sessions/${sessionId}?adminId=${adminId}`, { method: 'DELETE' });
      if (!resp.ok) throw new Error(await readError(resp, 'Could not delete chat'));
      showToast('Chat deleted');
    } catch (err: any) {
      setSessions(previous);
      showToast(err?.message || 'Could not delete chat', 'error');
    }
  };

  const reindexEmbeddings = useCallback(async ({ full = false, quiet = false } = {}) => {
    if (!adminId) return;
    setReindexing(true);
    try {
      const resp = await fetch(`${API_URL}/superadmin/chat/reindex`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId, limit: 500, full }),
      });
      if (!resp.ok) throw new Error(await readError(resp, 'Failed to reindex records'));
      const data = await resp.json();
      setIndexStatus({ lastIndexedAt: data.lastIndexedAt, totalRecords: data.totalRecords, indexedRecords: data.indexedRecords, running: false });
      if (!quiet) showToast(data.indexed ? `Indexed ${data.indexed} record${data.indexed === 1 ? '' : 's'}` : 'All records are already indexed');
    } catch (err: any) {
      if (!quiet) showToast(err?.message || 'Failed to reindex records', 'error');
    } finally {
      setReindexing(false);
    }
  }, [adminId]);

  const fetchProviders = useCallback(async (probe = false) => {
    if (!adminId) return;
    if (probe) setCheckingLive(true);
    try {
      const resp = await fetch(`${API_URL}/superadmin/chat/models?adminId=${adminId}${probe ? '&probe=1' : ''}`);
      if (!resp.ok) throw new Error(await readError(resp, 'Could not load AI models'));
      const data = await resp.json();
      setProviders(data.providers || []);
      if (probe) setCheckedAt(data.checkedAt);
    } catch (err: any) {
      if (probe) showToast(err?.message || 'Could not check AI providers', 'error');
    } finally {
      if (probe) setCheckingLive(false);
    }
  }, [adminId]);

  const preferenceLabel = (value: ModelPreference) => {
    if (!value) return 'Auto';
    const label = providers.find(p => p.provider === value.provider)?.label || value.provider;
    return value.model ? `${label} · ${shortModel(value.model)}` : label;
  };

  const choosePreference = (value: ModelPreference) => {
    setPreference(value);
    savePreference(value);
    setPickerOpen(false);
  };

  // Opening the assistant: index new/changed records in the background and load the model list
  useEffect(() => {
    if (!adminId) return;
    fetch(`${API_URL}/superadmin/chat/index-status?adminId=${adminId}`)
      .then(resp => (resp.ok ? resp.json() : null))
      .then(data => data && setIndexStatus(data))
      .catch(() => {});
    reindexEmbeddings({ quiet: true });
    fetchProviders();
  }, [adminId, reindexEmbeddings, fetchProviders]);

  const sendMessage = async (override?: string) => {
    const text = (override ?? input).trim().slice(0, MAX_INPUT);
    if (!text || !adminId || busy) return;

    setFailedPrompt(null);
    setMessages(prev => [...prev, { role: 'user', content: text, createdAt: new Date().toISOString() }]);
    if (override === undefined) setInput('');
    setSending(true);
    stickToBottomRef.current = true;

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const resp = await fetch(`${API_URL}/superadmin/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId, message: text, sessionId: activeSessionId, prefer: activeSessionId ? undefined : preference }),
        signal: controller.signal,
      });
      if (!resp.ok) throw new Error(await readError(resp, 'Golu could not answer right now'));
      const data = await resp.json();

      const nextMessages: ChatMessage[] = data.messages || [];
      setActiveSessionId(data.sessionId);
      // Older servers don't echo the chat's model; fall back to the one this chat was started with
      const fixed = data.preference !== undefined ? data.preference : (activeSessionId ? chatPreference : preference);
      setChatPreference(fixed?.provider ? fixed : null);
      setMessages(nextMessages);
      const lastIndex = nextMessages.length - 1;
      if (lastIndex >= 0 && nextMessages[lastIndex].role === 'assistant') {
        setRevealLength(0);
        setRevealIndex(lastIndex);
      }
      fetchSessions();
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        setMessages(prev => [...prev, { role: 'assistant', content: 'You stopped this response.', local: 'stopped' }]);
      } else {
        // Drop the optimistic message; "Try again" sends it again
        setMessages(prev => prev.slice(0, -1));
        setFailedPrompt({ text, error: err?.message || 'Something went wrong' });
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setSending(false);
      textareaRef.current?.focus();
    }
  };

  const stop = () => {
    if (sending) abortRef.current?.abort();
    else if (isRevealing) setRevealIndex(null);
  };

  const copyText = async (content: string, key: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(current => (current === key ? null : current)), 1500);
    } catch {
      showToast('Could not copy to clipboard', 'error');
    }
  };

  const editMessage = (content: string) => {
    setInput(content);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(content.length, content.length);
    });
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      sendMessage();
    }
  };

  /* ------------------------------- Render ------------------------------- */

  const tooLong = input.length > MAX_INPUT;
  const canSend = input.trim().length > 0 && !tooLong && !busy;
  const isEmpty = !sessionLoading && messages.length === 0 && !sending && !failedPrompt;

  const sidebar = (
    <aside className="g-sidebar">
      <div className="g-sidebar-top">
        <span className="g-brand">Golu</span>
        <button type="button" className="g-icon-btn" onClick={startNewChat} title="New chat">
          <Icon name="compose" />
          <span className="sr-only">New chat</span>
        </button>
      </div>

      <button type="button" className="g-nav-item g-nav-item--primary" onClick={startNewChat}>
        <Icon name="compose" size={18} />
        New chat
      </button>

      <nav className="g-history">
        {listLoading ? (
          <div className="g-history-loading">
            {[78, 62, 85, 54, 70].map((w, n) => <div key={n} className="g-skeleton" style={{ width: `${w}%` }} />)}
          </div>
        ) : groupedSessions.length === 0 ? (
          <p className="g-history-empty">Your chats will show up here.</p>
        ) : (
          groupedSessions.map(group => (
            <div key={group.label} className="g-history-group">
              <h5>{group.label}</h5>
              {group.items.map(session => {
                const active = session._id === activeSessionId;
                const confirming = pendingDeleteId === session._id;
                return (
                  <div key={session._id} className={`g-history-row ${active ? 'is-active' : ''} ${confirming ? 'is-confirming' : ''}`}>
                    <button type="button" className="g-history-link" onClick={() => openSession(session._id)} title={session.title}>
                      {session.title || 'New chat'}
                    </button>
                    <button
                      type="button"
                      className="g-history-delete"
                      onClick={() => deleteSession(session._id)}
                      title={confirming ? 'Click again to delete' : 'Delete'}
                    >
                      {confirming ? 'Delete?' : <Icon name="trash" size={16} />}
                    </button>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </nav>

      <div className="g-sidebar-bottom">
        <button
          type="button"
          className="g-nav-item g-reindex"
          onClick={() => reindexEmbeddings({ full: true })}
          disabled={reindexing}
          title="Re-embed all records for Golu's search. New and changed records are indexed automatically when the assistant opens."
        >
          {reindexing ? <span className="g-spinner" /> : <Icon name="db" size={18} />}
          <span className="g-reindex-text">
            <span>{reindexing ? 'Indexing records…' : 'Reindex records'}</span>
            <span className="g-reindex-meta">
              {reindexing
                ? 'Checking for new records'
                : indexStatus
                  ? `Last indexed ${timeAgo(indexStatus.lastIndexedAt, now)} · ${indexStatus.indexedRecords}/${indexStatus.totalRecords}`
                  : 'Loading status…'}
            </span>
          </span>
        </button>
        <div className="g-profile">
          <span className="g-avatar">{initials(user?.name)}</span>
          <span className="g-profile-text">
            <span className="g-profile-name">{user?.name || 'Admin'}</span>
            <span className="g-profile-role">Super admin</span>
          </span>
        </div>
      </div>
    </aside>
  );

  const modelPicker = chatLocked ? (
    <span
      className="g-picker-locked"
      title="The model is fixed for this chat. Start a new chat to use a different one."
    >
      <Icon name="lock" size={13} />
      {preferenceLabel(chatPreference)}
    </span>
  ) : (
        <div className="g-picker" ref={pickerRef}>
          <button
              type="button"
              className="g-picker-btn"
              onClick={() => {
                if (pickerOpen) { setPickerOpen(false); return; }
                setPickerOpen(true);
                // Opening the menu checks which models are actually answering (reused for a minute)
                const stale = !checkedAt || Date.now() - new Date(checkedAt).getTime() > 60000;
                if (stale && !checkingLive) fetchProviders(true);
              }}
              aria-expanded={pickerOpen}
              aria-haspopup="menu"
              title="Choose the AI model for this chat. It can't be changed once the chat starts."
            >
              <Icon name="chip" size={15} />
              <span className="g-picker-current">{preferenceLabel(preference)}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m6 9 6 6 6-6" /></svg>
            </button>

          {pickerOpen && (() => {
            const configured = providers.filter(p => p.configured);
            const probed = configured.some(p => p.probe);
            const live = configured.filter(p => p.probe?.ok);
            const down = configured.filter(p => p.probe && !p.probe.ok);
            const cooldownLabel = (m: ProviderModel) => `${m.reason}${m.secondsLeft ? ` · ${m.secondsLeft < 120 ? `${m.secondsLeft}s` : `${Math.round(m.secondsLeft / 60)}m`}` : ''}`;
            return (
              <div className={`g-picker-menu ${isEmpty ? "g-picker-menu--down" : "g-picker-menu--up"}`} role="menu" aria-busy={checkingLive}>
                <button type="button" role="menuitemradio" aria-checked={!preference} className={`g-picker-item ${!preference ? 'is-selected' : ''}`} onClick={() => choosePreference(null)}>
                  <span className="g-picker-item-main">
                    <span className="g-picker-item-title">Auto</span>
                    <span className="g-picker-item-sub">Best available model, switches automatically if one fails</span>
                  </span>
                  {!preference && <Icon name="check" size={16} />}
                </button>

                {checkingLive && !probed ? (
                  <div className="g-picker-checking" role="status">
                    <span className="g-spinner" /> Checking which models are online…
                    <div className="g-picker-skeleton"><span /><span /><span /></div>
                  </div>
                ) : (
                  <>
                    {live.map(p => (
                      <div key={p.provider} className="g-picker-group">
                        <div className="g-picker-group-head">
                          <span className="g-dot g-dot--ok" />
                          <span className="g-picker-group-label">{p.label}</span>
                          <span className="g-picker-group-status">Online · {p.probe?.latencyMs} ms</span>
                        </div>
                        <button
                          type="button"
                          role="menuitemradio"
                          aria-checked={preference?.provider === p.provider && !preference?.model}
                          className={`g-picker-item g-picker-item--model ${preference?.provider === p.provider && !preference?.model ? 'is-selected' : ''}`}
                          onClick={() => choosePreference({ provider: p.provider })}
                        >
                          <span className="g-picker-item-title">Any {p.label} model</span>
                          {preference?.provider === p.provider && !preference?.model && <Icon name="check" size={16} />}
                        </button>
                        {p.models.map(m => {
                          const selected = preference?.provider === p.provider && preference?.model === m.id;
                          const unavailable = m.status === 'cooling';
                          return (
                            <button
                              key={m.id}
                              type="button"
                              role="menuitemradio"
                              aria-checked={selected}
                              aria-disabled={unavailable}
                              disabled={unavailable}
                              className={`g-picker-item g-picker-item--model ${selected ? 'is-selected' : ''}`}
                              onClick={() => choosePreference({ provider: p.provider, model: m.id })}
                              title={unavailable ? `${m.id}: ${cooldownLabel(m)}` : m.id}
                            >
                              <span className="g-picker-item-title">{shortModel(m.id)}</span>
                              {unavailable && <span className="g-picker-item-badge">{cooldownLabel(m)}</span>}
                              {selected && <Icon name="check" size={16} />}
                            </button>
                          );
                        })}
                      </div>
                    ))}

                    {probed && live.length === 0 && (
                      <p className="g-picker-note">No provider is answering right now. Auto will keep retrying in the background.</p>
                    )}

                    {down.length > 0 && (
                      <div className="g-picker-group g-picker-group--down">
                        <p className="g-picker-down-title">Unavailable right now</p>
                        {down.map(p => (
                          <div key={p.provider} className="g-picker-down-row" title={p.probe?.error || ''}>
                            <span className="g-dot g-dot--down" />
                            <span>{p.label}</span>
                            <span className="g-picker-down-reason">{(p.probe?.error || 'Not responding').replace(/\.$/, '')}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                <div className="g-picker-foot">
                  <span>{checkingLive ? 'Checking…' : checkedAt ? `Checked ${timeAgo(checkedAt, now)}` : ''}</span>
                  <button type="button" className="g-picker-refresh" onClick={() => fetchProviders(true)} disabled={checkingLive}>
                    {checkingLive ? <span className="g-spinner" /> : <Icon name="retry" size={13} />}
                    Refresh
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
  );

  const composer = (
    <div className="g-composer-wrap">
      <div className={`g-composer ${tooLong ? 'is-invalid' : ''}`}>
        <label htmlFor="golu-input" className="sr-only">Message Golu</label>
        <textarea
          id="golu-input"
          ref={textareaRef}
          value={input}
          onChange={event => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="Ask anything"
        />
        <div className="g-composer-bar">
          {modelPicker}
          <span className={`g-counter ${tooLong ? 'is-invalid' : ''}`}>
            {input.length > MAX_INPUT * 0.8 ? `${input.length.toLocaleString()} / ${MAX_INPUT.toLocaleString()}` : ''}
          </span>
          {busy ? (
            <button type="button" className="g-send" onClick={stop} title={sending ? 'Stop' : 'Show full response'}>
              <Icon name="stop" size={16} />
              <span className="sr-only">{sending ? 'Stop generating' : 'Show full response'}</span>
            </button>
          ) : (
            <button type="button" className="g-send" onClick={() => sendMessage()} disabled={!canSend} title="Send">
              <Icon name="send" size={18} />
              <span className="sr-only">Send message</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );

  const thread = (
    <div className="g-thread">
      {messages.map((message, index) => {
        if (message.role === 'user') {
          const key = `u-${index}`;
          return (
            <div key={key} className="g-turn g-turn--user">
              <div className="g-user-bubble">{message.content}</div>
              <div className="g-actions g-actions--user">
                <button type="button" className="g-icon-btn g-icon-btn--sm" onClick={() => copyText(message.content, key)} title={copiedKey === key ? 'Copied' : 'Copy'}>
                  <Icon name={copiedKey === key ? 'check' : 'copy'} size={16} />
                  <span className="sr-only">Copy message</span>
                </button>
                <button type="button" className="g-icon-btn g-icon-btn--sm" onClick={() => editMessage(message.content)} title="Edit">
                  <Icon name="edit" size={16} />
                  <span className="sr-only">Edit message</span>
                </button>
              </div>
            </div>
          );
        }

        if (message.local === 'stopped') {
          return <div key={`a-${index}`} className="g-turn g-turn--assistant"><p className="g-muted-note">{message.content}</p></div>;
        }

        const key = `a-${index}`;
        const revealing = revealIndex === index;
        const content = revealing ? message.content.slice(0, revealLength) : message.content;
        return (
          <div key={key} className={`g-turn g-turn--assistant ${index === lastAssistantIndex ? 'is-latest' : ''}`}>
            <div className="g-markdown">{renderMarkdown(content)}</div>
            {!revealing && (
              <div className="g-actions">
                <button type="button" className="g-icon-btn g-icon-btn--sm" onClick={() => copyText(message.content, key)} title={copiedKey === key ? 'Copied' : 'Copy'}>
                  <Icon name={copiedKey === key ? 'check' : 'copy'} size={16} />
                  <span className="sr-only">Copy response</span>
                </button>
                {(() => {
                  const cited = (message.sources || []).reduce((n, src) => n + (Array.isArray(src?.refs) ? src.refs.length : 0), 0);
                  return cited > 0 ? <span className="g-sources">Cites {cited} record{cited === 1 ? '' : 's'}</span> : null;
                })()}
                {message.model && (
                  <span
                    className="g-model-tag"
                    title={message.model.preferredUsed === false ? 'Your selected model was unavailable, so Golu fell back to this one' : `Answered by ${message.model.providerLabel || message.model.provider} · ${message.model.model}`}
                  >
                    {message.model.providerLabel || message.model.provider} · {shortModel(message.model.model)}
                    {message.model.preferredUsed === false && <span className="g-model-tag-note"> · fallback</span>}
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}

      {sending && (
        <div className="g-turn g-turn--assistant" role="status">
          <span className="g-thinking" />
          <span className="sr-only">Golu is responding</span>
        </div>
      )}

      {failedPrompt && (
        <div className="g-turn g-turn--assistant">
          <div className="g-error">
            <p>{failedPrompt.error}</p>
            <div className="g-error-actions">
              <button type="button" className="g-btn g-btn--outline" onClick={() => sendMessage(failedPrompt.text)}>
                <Icon name="retry" size={16} /> Try again
              </button>
              <button type="button" className="g-btn g-btn--ghost" onClick={() => { editMessage(failedPrompt.text); setFailedPrompt(null); }}>
                Edit message
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const sessionSkeleton = (
    <div className="g-thread">
      {[0, 1].map(n => (
        <React.Fragment key={n}>
          <div className="g-turn g-turn--user"><div className="g-skeleton g-skeleton--bubble" /></div>
          <div className="g-turn g-turn--assistant">
            <div className="g-skeleton" style={{ width: '92%' }} />
            <div className="g-skeleton" style={{ width: '84%' }} />
            <div className="g-skeleton" style={{ width: '58%' }} />
          </div>
        </React.Fragment>
      ))}
    </div>
  );

  return (
    <div className={`golu-root ${variant === 'embedded' ? 'golu-root--embedded' : ''}`}>
      <div className="g-sidebar-desktop">{sidebar}</div>

      {sidebarOpen && (
        <div className="g-drawer">
          <div className="g-drawer-panel">{sidebar}</div>
          <button type="button" className="g-drawer-scrim" onClick={() => setSidebarOpen(false)}>
            <span className="sr-only">Close chat list</span>
          </button>
        </div>
      )}

      <main className="g-main">
        <header className="g-header">
          <div className="g-header-left">
            <button type="button" className="g-icon-btn g-mobile-only" onClick={() => setSidebarOpen(true)} title="Chats">
              <Icon name="sidebar" />
              <span className="sr-only">Open chat list</span>
            </button>
            <span className="g-title">Golu</span>
          </div>
          <div className="g-header-right">
            <button type="button" className="g-icon-btn g-mobile-only" onClick={startNewChat} title="New chat">
              <Icon name="compose" />
              <span className="sr-only">New chat</span>
            </button>
            {onClose && (
              <button type="button" className="g-icon-btn" onClick={onClose} title="Close (Esc)">
                <Icon name="close" />
                <span className="sr-only">Close assistant</span>
              </button>
            )}
          </div>
        </header>

        {isEmpty ? (
          <div className="g-welcome">
            <h1>What can I help with?</h1>
            {composer}
            <div className="g-suggestions">
              {SUGGESTIONS.map(s => (
                <button key={s.label} type="button" className="g-chip" onClick={() => sendMessage(s.prompt)}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div ref={scrollRef} onScroll={handleScroll} className="g-scroll">
              {sessionLoading ? sessionSkeleton : thread}
            </div>
            <div className="g-bottom">
              {showScrollButton && (
                <button type="button" className="g-scroll-btn" onClick={scrollToBottom} title="Scroll to bottom">
                  <Icon name="down" size={18} />
                  <span className="sr-only">Scroll to latest message</span>
                </button>
              )}
              {composer}
              <p className="g-disclaimer">Golu can make mistakes. Check important clinical info.</p>
            </div>
          </>
        )}
      </main>

      {toast && (
        <div className={`g-toast ${toast.tone === 'error' ? 'is-error' : ''}`} role="status">{toast.text}</div>
      )}
    </div>
  );
};

export default AdminAiChat;
