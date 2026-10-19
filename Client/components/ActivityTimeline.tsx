import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { API_URL } from '../config/api';
import SearchBox from './SearchBox';

// Readable activity timeline over the audit log, shared by the admin, hospital and patient portals.

interface AuditLog {
  _id: string;
  event: string;
  actor: { id: string; model: string; name?: string; email?: string; ipAddress?: string };
  target?: { id: string; model: string; name?: string; identifier?: string };
  action: { description: string; outcome: string; reason?: string; denialReason?: string };
  metadata?: Record<string, any>;
  severity: string;
  createdAt: string;
}

type Category = 'all' | 'access' | 'consent' | 'records' | 'auth';

const CATEGORIES: Array<{ key: Category; label: string; events: string[] }> = [
  { key: 'all', label: 'All activity', events: [] },
  { key: 'access', label: 'Record access', events: ['PHI_ACCESSED', 'PHI_VIEWED', 'PHI_DOWNLOADED', 'PHI_EXPORTED'] },
  { key: 'consent', label: 'Consent', events: ['ACCESS_REQUEST_CREATED', 'ACCESS_REQUEST_APPROVED', 'ACCESS_REQUEST_DENIED', 'ACCESS_REQUEST_UPGRADED', 'ACCESS_REVOKED', 'CONSENT_GRANTED', 'CONSENT_WITHDRAWN'] },
  { key: 'records', label: 'Records', events: ['RECORD_CREATED', 'RECORD_UPDATED', 'RECORD_DELETED'] },
  { key: 'auth', label: 'Sign-ins', events: ['LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', 'PASSWORD_CHANGED', 'PASSWORD_RESET'] },
];

const PERIODS = [
  { key: '7d', label: 'Last 7 days', params: { days: 7 } },
  { key: '30d', label: 'Last 30 days', params: { months: 1 } },
  { key: '1y', label: 'Last 12 months', params: { years: 1 } },
  { key: 'all', label: 'All time', params: {} },
] as const;

const PAGE_SIZE = 30;

function categoryOf(event: string): Exclude<Category, 'all'> | 'other' {
  for (const c of CATEGORIES) if (c.events.includes(event)) return c.key as Exclude<Category, 'all'>;
  return 'other';
}

const ICONS: Record<string, React.ReactNode> = {
  access: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  consent: <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6zM9 12l2 2 4-4" />,
  records: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M12 12v6M9 15h6" /></>,
  auth: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  other: <><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></>,
};

function nameOf(party: { id?: string; model?: string; name?: string } | undefined, meta: Record<string, any> | undefined, viewerId: string) {
  if (!party) return 'Someone';
  if (party.id && party.id === viewerId) return 'You';
  if (party.name) return party.name;
  if (party.model === 'HospitalAccess') return meta?.hospitalName || 'a hospital';
  if (party.model === 'Superadmin') return 'A G1Card admin';
  return party.model ? `a ${party.model.toLowerCase()}` : 'Someone';
}

function possessive(name: string) {
  if (name === 'You') return 'your';
  return name.endsWith('s') ? `${name}’` : `${name}’s`;
}

/** One plain-English sentence per event */
function describe(log: AuditLog, viewerId: string): React.ReactNode {
  const actor = nameOf(log.actor, log.metadata, viewerId);
  const target = nameOf(log.target, log.metadata, viewerId);
  const b = (s: string) => <b>{s}</b>;
  const level = /COMPLETE/.test(log.action?.description || '') ? 'complete' : /GENERAL/.test(log.action?.description || '') ? 'partial' : '';
  switch (log.event) {
    case 'PHI_ACCESSED':
    case 'PHI_VIEWED': return <>{b(actor)} opened {b(possessive(target))} medical records</>;
    case 'PHI_DOWNLOADED': return <>{b(actor)} downloaded {log.target?.model === 'Record' ? <>the record {b(target)}</> : <>{b(possessive(target))} records</>}</>;
    case 'PHI_EXPORTED': return <>{b(actor)} exported {b(possessive(target))} records</>;
    case 'ACCESS_REQUEST_CREATED': return <>{b(actor)} asked to see {b(possessive(target))} records</>;
    case 'ACCESS_REQUEST_APPROVED': return <>{b(actor)} gave {b(target)} {level ? `${level} ` : ''}access</>;
    case 'ACCESS_REQUEST_DENIED': return <>{b(actor)} turned down {b(possessive(target))} access request</>;
    case 'ACCESS_REQUEST_UPGRADED': return <>{b(actor)} changed {b(possessive(target))} access level{level ? ` to ${level}` : ''}</>;
    case 'ACCESS_REVOKED': return <>{b(actor)} revoked {log.metadata?.hospitalName ? b(possessive(log.metadata.hospitalName)) : 'a hospital’s'} access</>;
    case 'CONSENT_GRANTED': return <>{b(actor)} granted consent to {b(target)}</>;
    case 'CONSENT_WITHDRAWN': return <>{b(actor)} withdrew consent from {b(target)}</>;
    case 'RECORD_CREATED': return <>{b(actor)} added a record{log.target?.name ? <>: {b(log.target.name)}</> : ''}{log.metadata?.patientName ? <> for {b(log.metadata.patientName)}</> : ''}</>;
    case 'RECORD_UPDATED': return <>{b(actor)} updated {log.target?.name ? b(log.target.name) : 'a record'}</>;
    case 'RECORD_DELETED': return <>{b(actor)} deleted {log.target?.name ? b(log.target.name) : 'a record'}</>;
    case 'LOGIN_SUCCESS': return <>{b(actor)} signed in</>;
    case 'LOGIN_FAILED': return <>Failed sign-in attempt for {b(actor === 'You' ? 'your account' : actor)}</>;
    case 'LOGOUT': return <>{b(actor)} signed out</>;
    case 'PASSWORD_CHANGED': return <>{b(actor)} changed {actor === 'You' ? 'your' : 'their'} password</>;
    case 'PASSWORD_RESET': return <>{b(actor)} reset {actor === 'You' ? 'your' : 'their'} password</>;
    case 'NOTIFICATION_SENT': return <>A notification was sent to {b(target)}</>;
    case 'NOTIFICATION_READ': return <>{b(actor)} read a notification</>;
    default: return log.action?.description || log.event;
  }
}

function dayLabel(date: Date) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(date); d.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: today.getFullYear() === date.getFullYear() ? undefined : 'numeric' });
}

function clock(date: Date) {
  return date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

/** "just now", "12 min ago", "3 h ago" for today; plain clock time otherwise */
function whenLabel(date: Date) {
  const mins = Math.round((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  if (mins < 6 * 60 && dayLabel(date) === 'Today') return `${Math.floor(mins / 60)} h ago`;
  return clock(date);
}

/** Same thing, same people, back to back: shown once with a count */
interface LogGroup { key: string; log: AuditLog; all: AuditLog[] }

function collapseRepeats(items: AuditLog[]): LogGroup[] {
  const out: LogGroup[] = [];
  for (const log of items) {
    const prev = out[out.length - 1];
    const sameAsPrev = prev
      && prev.log.event === log.event
      && String(prev.log.actor?.id || '') === String(log.actor?.id || '')
      && String(prev.log.target?.id || '') === String(log.target?.id || '')
      && prev.log.action?.outcome === log.action?.outcome
      && (prev.log.action?.reason || prev.log.action?.denialReason || '') === (log.action?.reason || log.action?.denialReason || '');
    if (sameAsPrev) prev.all.push(log);
    else out.push({ key: log._id, log, all: [log] });
  }
  return out;
}

interface Summary { total: number; access: number; consent: number; records: number; auth: number; warnings: number }

interface ActivityTimelineProps {
  scope: 'hospital' | 'patient';
  entityId: string;
  /** Who is looking: used to say "You" instead of their name */
  viewerId?: string;
  allowExport?: boolean;
  emptyHint?: string;
}

const ActivityTimeline: React.FC<ActivityTimelineProps> = ({ scope, entityId, viewerId = '', allowExport = false, emptyHint }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [category, setCategory] = useState<Category>('all');
  const [period, setPeriod] = useState<(typeof PERIODS)[number]['key']>('30d');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const buildParams = useCallback((pageNumber: number, limit = PAGE_SIZE) => {
    const params = new URLSearchParams({ page: String(pageNumber), limit: String(limit) });
    const cat = CATEGORIES.find(c => c.key === category);
    if (cat && cat.events.length) params.set('events', cat.events.join(','));
    if (search) params.set('search', search);
    const p = PERIODS.find(x => x.key === period)?.params as Record<string, number>;
    if (p?.days) params.set('days', String(p.days));
    if (p?.months) params.set('months', String(p.months));
    if (p?.years) params.set('years', String(p.years));
    return params;
  }, [category, search, period]);

  const load = useCallback(async (pageNumber: number) => {
    if (!entityId) return;
    setLoading(true);
    setError('');
    try {
      const resp = await fetch(`${API_URL}/audit-logs/${scope}/${entityId}?${buildParams(pageNumber)}`);
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Could not load activity');
      const items: AuditLog[] = data.logs || [];
      setLogs(prev => (pageNumber === 1 ? items : [...prev, ...items]));
      setTotal(data.pagination?.total || 0);
      if (pageNumber === 1 && data.summary) setSummary(data.summary);
      setHasMore(Boolean(data.pagination?.hasMore));
      setPage(pageNumber);
    } catch (err: any) {
      setError(err?.message || 'Could not load activity');
    } finally {
      setLoading(false);
    }
  }, [entityId, scope, buildParams, period]);

  useEffect(() => { load(1); }, [load]);

  const groups = useMemo(() => {
    const map = new Map<string, AuditLog[]>();
    for (const log of logs) {
      const key = dayLabel(new Date(log.createdAt));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(log);
    }
    return [...map.entries()].map(([day, items]) => ({ day, count: items.length, rows: collapseRepeats(items) }));
  }, [logs]);

  const periodLabel = PERIODS.find(p => p.key === period)?.label.toLowerCase() || '';
  const tiles: Array<{ key: Category | 'warnings'; label: string; value: number; tone: string }> = [
    { key: 'all', label: 'All activity', value: summary?.total ?? total, tone: 'blue' },
    { key: 'access', label: 'Record views', value: summary?.access ?? 0, tone: 'teal' },
    { key: 'consent', label: 'Consent changes', value: summary?.consent ?? 0, tone: 'violet' },
    { key: 'warnings', label: summary?.warnings ? 'Warnings' : 'No warnings', value: summary?.warnings ?? 0, tone: summary?.warnings ? 'rose' : 'green' },
  ];

  const exportCsv = async () => {
    setExporting(true);
    try {
      const resp = await fetch(`${API_URL}/audit-logs/${scope}/${entityId}?${buildParams(1, 1000)}`);
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Export failed');
      const rows: AuditLog[] = data.logs || [];
      const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const csv = [
        ['When', 'Event', 'By', 'By type', 'On', 'On type', 'Description', 'Outcome', 'Severity'].join(','),
        ...rows.map(l => [l.createdAt, l.event, l.actor?.name, l.actor?.model, l.target?.name, l.target?.model, l.action?.description, l.action?.outcome, l.severity].map(esc).join(',')),
      ].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `g1card-activity-${scope}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      notify(err?.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="at">
      <div className="at-stats">
        {tiles.map(t => {
          // Tiles are shortcuts to the tabs below; only the tabs show what's selected
          const clickable = t.key !== 'warnings';
          return (
            <button
              key={t.key}
              type="button"
              className={`at-stat app-tone--${t.tone}`}
              onClick={clickable ? () => setCategory(t.key as Category) : undefined}
              disabled={!clickable}
              title={clickable ? `Show ${t.label.toLowerCase()}` : undefined}
            >
              <small>{t.label}</small>
              <span>{summary || t.key === 'all' ? t.value.toLocaleString() : '–'}</span>
              <em>{period === 'all' ? 'all time' : periodLabel}{search ? ' · filtered' : ''}</em>
            </button>
          );
        })}
      </div>

      <div className="at-toolbar">
        <div className="at-tabs" role="tablist" aria-label="Activity type">
          {CATEGORIES.map(c => (
            <button key={c.key} type="button" role="tab" aria-selected={category === c.key} className={category === c.key ? 'is-on' : ''} onClick={() => setCategory(c.key)}>
              {c.label}
              {summary && c.key !== 'all' && <i>{(summary as any)[c.key] ?? 0}</i>}
            </button>
          ))}
        </div>
        <div className="at-controls">
          <SearchBox className="at-searchbox" placeholder="Search activity" ariaLabel="Search activity" onSearch={q => setSearch(q)} />
          <select value={period} onChange={e => setPeriod(e.target.value as any)} aria-label="Time period" className="at-select">
            {PERIODS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
          <button type="button" className="at-icon-btn" onClick={() => load(1)} disabled={loading} title="Refresh" aria-label="Refresh activity">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={loading ? 'at-spin' : ''}><path d="M21 12a9 9 0 1 1-2.6-6.4M21 4v5h-5" /></svg>
          </button>
          {allowExport && (
            <button type="button" className="at-export" onClick={exportCsv} disabled={exporting || !total}>{exporting ? 'Exporting…' : 'Export CSV'}</button>
          )}
        </div>
      </div>

      {error ? (
        <div className="at-empty"><p>{error}</p><button type="button" className="at-export" onClick={() => load(1)}>Try again</button></div>
      ) : loading && logs.length === 0 ? (
        <div className="at-skeleton">{[0, 1, 2, 3, 4].map(n => <div key={n} />)}</div>
      ) : logs.length === 0 ? (
        <div className="at-empty">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
          <p className="at-empty-title">{search || category !== 'all' ? 'No matching activity' : 'Nothing here yet'}</p>
          <p>{search ? `No activity matches “${search}”.` : emptyHint || 'Activity will appear here as it happens.'}</p>
        </div>
      ) : (
        <div className="at-days">
          {groups.map(({ day, count, rows }) => (
            <section key={day} className="at-day">
              <h4><span>{day}</span><small>{count} {count === 1 ? 'event' : 'events'}</small></h4>
              <ol>
                {rows.map(({ key, log, all }) => {
                  const cat = categoryOf(log.event);
                  const warn = log.severity === 'WARNING' || log.severity === 'CRITICAL';
                  const failed = log.action?.outcome === 'FAILURE';
                  const open = expanded === key;
                  const when = new Date(log.createdAt);
                  const earliest = new Date(all[all.length - 1].createdAt);
                  const reason = log.action?.reason || log.action?.denialReason;
                  return (
                    <li key={key} className={`at-item at-cat--${cat} ${warn || failed ? 'is-warn' : ''} ${open ? 'is-open' : ''}`}>
                      <span className="at-icon" aria-hidden>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{ICONS[cat]}</svg>
                      </span>
                      <button type="button" className="at-body" onClick={() => setExpanded(open ? null : key)} aria-expanded={open}>
                        <span className="at-main">
                          <span className="at-text">
                            {describe(log, viewerId)}
                            {all.length > 1 && <span className="at-repeat" title={`${all.length} times`}>×{all.length}</span>}
                          </span>
                          {reason && <span className="at-sub">“{reason}”</span>}
                          {all.length > 1 && <span className="at-sub">{clock(earliest)} – {clock(when)}</span>}
                        </span>
                        <span className="at-meta">
                          {failed && <em className="at-badge at-badge--bad">Failed</em>}
                          {warn && !failed && <em className="at-badge">{log.severity === 'CRITICAL' ? 'Critical' : 'Warning'}</em>}
                          <time dateTime={log.createdAt} title={when.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'medium' })}>{whenLabel(when)}</time>
                          <svg className="at-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="m6 9 6 6 6-6" /></svg>
                        </span>
                      </button>
                      {open && (
                        <dl className="at-details">
                          <div><dt>What happened</dt><dd>{log.action?.description || '—'}</dd></div>
                          {reason && <div><dt>Reason</dt><dd>{reason}</dd></div>}
                          <div><dt>By</dt><dd>{log.actor?.name || '—'} <small>{log.actor?.model}</small></dd></div>
                          {log.target && <div><dt>On</dt><dd>{log.target.name || log.target.identifier || '—'} <small>{log.target.model}</small></dd></div>}
                          <div><dt>{all.length > 1 ? 'Last time' : 'When'}</dt><dd>{when.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'medium' })}</dd></div>
                          <div><dt>Event code</dt><dd><code>{log.event}</code></dd></div>
                          {all.length > 1 && (
                            <div className="at-times"><dt>All {all.length} times</dt><dd>{all.map(l => clock(new Date(l.createdAt))).join(' · ')}</dd></div>
                          )}
                        </dl>
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
          {hasMore && (
            <button type="button" className="at-more" onClick={() => load(page + 1)} disabled={loading}>{loading ? 'Loading…' : `Show older activity (${(total - logs.length).toLocaleString()} more)`}</button>
          )}
        </div>
      )}
    </div>
  );
};

export default ActivityTimeline;
