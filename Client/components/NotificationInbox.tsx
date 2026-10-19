import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SearchBox from './SearchBox';

// One notifications page for all three portals: same layout, tabs, search and grouping.
// Each portal passes its endpoints and, where needed, inline actions and deep links.

export interface InboxNotification {
    id: string;
    type: string;
    title: string;
    message: string;
    metadata?: any;
    isRead: boolean;
    readAt?: string;
    actionUrl?: string;
    relatedAccess?: string;
    sender?: { _id: string; name?: string; firstName?: string; lastName?: string; email?: string };
    createdAt: string;
}

interface Props {
    kicker: string;
    title?: string;
    subtitle: string;
    /** e.g. `${API_URL}/patients/${id}/notifications` — list, `/:nid/read` and `/read-all` hang off it */
    baseUrl: string;
    renderActions?: (n: InboxNotification, reload: () => void) => React.ReactNode;
    linkFor?: (n: InboxNotification) => { label: string; to: string } | null;
    /** Extra attributes for buttons that change data (used by admin simulation mode) */
    mutatingButtonProps?: Record<string, string>;
}

type Tone = 'amber' | 'green' | 'rose' | 'blue' | 'teal' | 'violet' | 'muted';

function toneOf(n: InboxNotification): Tone {
    const t = n.type;
    if (t === 'ACCESS_REQUEST' || t === 'ACCESS_UPGRADE_REQUEST') return 'amber';
    if (t === 'ACCESS_GRANTED' || /APPROVED$/.test(t)) return 'green';
    if (t === 'ACCESS_DENIED' || t === 'ACCESS_REVOKED' || /REJECTED$/.test(t) || n.metadata?.source === 'PATIENT_DELETION_REQUEST') return 'rose';
    if (t === 'MEDICAL_RECORD_CREATED') return 'teal';
    if (t === 'RECORDS_ACCESSED' || t === 'ACCESS_LEVEL_CHANGED') return 'blue';
    if (/UPDATE/.test(t)) return 'violet';
    return 'muted';
}

const ICONS: Record<Tone, React.ReactNode> = {
    amber: <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6zM12 8v4M12 16h.01" />,
    green: <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6zM9 12l2 2 4-4" />,
    rose: <><circle cx="12" cy="12" r="9" /><path d="m15 9-6 6M9 9l6 6" /></>,
    teal: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M12 12v6M9 15h6" /></>,
    blue: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
    violet: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z" /></>,
    muted: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></>,
};

function senderName(n: InboxNotification) {
    const s = n.sender;
    if (!s) return 'G1Card';
    return `${s.firstName || ''} ${s.lastName || ''}`.trim() || s.name || s.email || 'G1Card';
}

function dayLabel(date: Date) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const d = new Date(date); d.setHours(0, 0, 0, 0);
    const diff = Math.round((today.getTime() - d.getTime()) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    if (diff < 7) return date.toLocaleDateString('en-IN', { weekday: 'long' });
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: today.getFullYear() === date.getFullYear() ? undefined : 'numeric' });
}

function timeLabel(date: Date) {
    const mins = Math.round((Date.now() - date.getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    if (mins < 6 * 60 && dayLabel(date) === 'Today') return `${Math.floor(mins / 60)} h ago`;
    return date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

const PAGE_SIZE = 15;

const NotificationInbox: React.FC<Props> = ({ kicker, title = 'Notifications', subtitle, baseUrl, renderActions, linkFor, mutatingButtonProps = {} }) => {
    const navigate = useNavigate();
    const [items, setItems] = useState<InboxNotification[]>([]);
    const [filter, setFilter] = useState<'unread' | 'all'>('unread');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [pages, setPages] = useState(1);
    const [counts, setCounts] = useState({ total: 0, unread: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [markingAll, setMarkingAll] = useState(false);

    const load = useCallback(async (pageNumber: number) => {
        setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams({ page: String(pageNumber), limit: String(PAGE_SIZE), filter, search });
            const resp = await fetch(`${baseUrl}?${params}`);
            const data = await resp.json();
            if (!resp.ok) throw new Error(data?.error || 'Could not load notifications');
            const list: InboxNotification[] = data.notifications || [];
            setItems(prev => (pageNumber === 1 ? list : [...prev, ...list]));
            setPages(data.pagination?.pages || 1);
            setCounts({ total: data.totalCount ?? 0, unread: data.unreadCount ?? 0 });
            setPage(pageNumber);
        } catch (err: any) {
            setError(err?.message || 'Could not load notifications');
        } finally {
            setLoading(false);
        }
    }, [baseUrl, filter, search]);

    useEffect(() => { load(1); }, [load]);

    // Other parts of the app (live updates, the header bell) can ask the inbox to refresh
    useEffect(() => {
        const refresh = () => load(1);
        window.addEventListener('g1card:notifications-changed', refresh);
        return () => window.removeEventListener('g1card:notifications-changed', refresh);
    }, [load]);

    const reload = useCallback(() => {
        load(1);
        window.dispatchEvent(new CustomEvent('g1card:notifications-updated'));
    }, [load]);

    const markRead = async (n: InboxNotification) => {
        if (n.isRead) return;
        try {
            const resp = await fetch(`${baseUrl}/${n.id}/read`, { method: 'PATCH' });
            if (!resp.ok) return;
            setItems(prev => (filter === 'unread' ? prev.filter(x => x.id !== n.id) : prev.map(x => (x.id === n.id ? { ...x, isRead: true } : x))));
            setCounts(c => ({ ...c, unread: Math.max(0, c.unread - 1) }));
            window.dispatchEvent(new CustomEvent('g1card:notifications-updated'));
        } catch { /* leave it unread */ }
    };

    const markAllRead = async () => {
        setMarkingAll(true);
        try {
            const resp = await fetch(`${baseUrl}/read-all`, { method: 'PATCH' });
            if (!resp.ok) throw new Error('failed');
            reload();
        } catch {
            notify('Could not mark notifications as read. Try again.');
        } finally {
            setMarkingAll(false);
        }
    };

    const groups = useMemo(() => {
        const map = new Map<string, InboxNotification[]>();
        for (const n of items) {
            const key = dayLabel(new Date(n.createdAt));
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(n);
        }
        return [...map.entries()];
    }, [items]);

    return (
        <div className="nt">
            <header className="nt-head">
                <div>
                    <p className="nt-kicker">{kicker}</p>
                    <h1 className="app-title nt-title">{title}</h1>
                    <p className="nt-sub">{subtitle}</p>
                </div>
                <button type="button" className="nt-btn" onClick={markAllRead} disabled={markingAll || counts.unread === 0} {...mutatingButtonProps}>
                    {markingAll ? 'Marking…' : 'Mark all as read'}
                </button>
            </header>

            <div className="nt-toolbar">
                <div className="at-tabs" role="tablist" aria-label="Show">
                    <button type="button" role="tab" aria-selected={filter === 'unread'} className={filter === 'unread' ? 'is-on' : ''} onClick={() => setFilter('unread')}>
                        Unread<i>{counts.unread}</i>
                    </button>
                    <button type="button" role="tab" aria-selected={filter === 'all'} className={filter === 'all' ? 'is-on' : ''} onClick={() => setFilter('all')}>
                        All<i>{counts.total}</i>
                    </button>
                </div>
                <SearchBox className="nt-search" placeholder="Search notifications" onSearch={setSearch} />
            </div>

            {error ? (
                <div className="at-empty"><p>{error}</p><button type="button" className="nt-btn" onClick={() => load(1)}>Try again</button></div>
            ) : loading && items.length === 0 ? (
                <div className="at-skeleton">{[0, 1, 2, 3].map(k => <div key={k} style={{ height: 76 }} />)}</div>
            ) : items.length === 0 ? (
                <div className="at-empty">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{ICONS.muted}</svg>
                    <p className="at-empty-title">{search ? 'No matches' : filter === 'unread' ? 'You’re all caught up' : 'No notifications yet'}</p>
                    <p>{search ? `Nothing matches “${search}”.` : filter === 'unread' ? 'New notifications will show up here.' : 'Updates about access, records and requests will appear here.'}</p>
                    {filter === 'unread' && !search && counts.total > 0 && (
                        <button type="button" className="nt-btn" onClick={() => setFilter('all')}>See all {counts.total}</button>
                    )}
                </div>
            ) : (
                <div className="at-days">
                    {groups.map(([day, list]) => (
                        <section key={day} className="at-day">
                            <h4><span>{day}</span><small>{list.length}</small></h4>
                            <ol className="nt-list">
                                {list.map(n => {
                                    const tone = toneOf(n);
                                    const link = linkFor?.(n) || null;
                                    const when = new Date(n.createdAt);
                                    const actions = renderActions?.(n, reload);
                                    return (
                                        <li key={n.id} className={`nt-item ${n.isRead ? '' : 'is-unread'}`}>
                                            <span className={`nt-icon nt-tone--${tone}`} aria-hidden>
                                                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{ICONS[tone]}</svg>
                                            </span>
                                            <div className="nt-body">
                                                <div className="nt-row">
                                                    <p className="nt-item-title">{!n.isRead && <span className="nt-dot" aria-label="Unread" />}{n.title}</p>
                                                    <time dateTime={n.createdAt} title={when.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}>{timeLabel(when)}</time>
                                                </div>
                                                <p className="nt-msg">{n.message}</p>
                                                <div className="nt-foot">
                                                    <span className="nt-from">From {senderName(n)}</span>
                                                    {link && <button type="button" className="nt-link" onClick={() => { markRead(n); navigate(link.to); }}>{link.label} →</button>}
                                                    {!n.isRead && <button type="button" className="nt-link nt-link--quiet" onClick={() => markRead(n)} {...mutatingButtonProps}>Mark read</button>}
                                                </div>
                                                {actions && <div className="nt-actions">{actions}</div>}
                                            </div>
                                        </li>
                                    );
                                })}
                            </ol>
                        </section>
                    ))}
                    {page < pages && (
                        <button type="button" className="at-more" onClick={() => load(page + 1)} disabled={loading}>{loading ? 'Loading…' : 'Show older notifications'}</button>
                    )}
                </div>
            )}
        </div>
    );
};

export default NotificationInbox;
