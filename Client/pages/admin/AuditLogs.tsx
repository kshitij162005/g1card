import React, { useCallback, useEffect, useState } from 'react';
import { API_URL } from '../../config/api';
import ActivityTimeline from '../../components/ActivityTimeline';
import SearchBox from '../../components/SearchBox';

interface Entity {
    _id: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    username?: string;
    city?: string;
    state?: string;
    suspended?: boolean;
}

type Scope = 'hospital' | 'patient';

const entityName = (e: Entity) => e.name || [e.firstName, e.lastName].filter(Boolean).join(' ') || e.email || e.username || 'Unnamed';
const entitySub = (e: Entity, scope: Scope) => (scope === 'hospital' ? [e.city, e.state].filter(Boolean).join(', ') : e.email || e.username || '');
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || '?';

// Audit trail for any hospital or patient on the platform
const AuditLogs: React.FC = () => {
    const [scope, setScope] = useState<Scope>('hospital');
    const [entities, setEntities] = useState<Entity[]>([]);
    const [page, setPage] = useState(1);
    const [pages, setPages] = useState(1);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState<Entity | null>(null);

    const fetchEntities = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page), limit: '12' });
            if (search) params.set('search', search);
            const resp = await fetch(`${API_URL}/superadmin/${scope === 'hospital' ? 'hospitals' : 'patients'}?${params}`);
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error || 'Failed to load');
            setEntities((scope === 'hospital' ? data.hospitals : data.patients) || []);
            setPages(data.pagination?.pages || data.pagination?.totalPages || 1);
        } catch (err) {
            console.error('audit entities error:', err);
            setEntities([]);
        } finally {
            setLoading(false);
        }
    }, [scope, page, search]);

    useEffect(() => { fetchEntities(); }, [fetchEntities]);

    // Open the first hospital/patient straight away so the timeline is never an empty pane on wide screens
    useEffect(() => {
        if (!selected && entities.length && window.matchMedia('(min-width: 1024px)').matches) setSelected(entities[0]);
    }, [entities, selected]);

    const switchScope = (next: Scope) => {
        setScope(next);
        setSelected(null);
        setPage(1);
        setSearch('');
    };

    return (
        <div className="space-y-6">
            <div>
                <p className="text-[13px] font-semibold text-[var(--app-accent)]">Audit trail</p>
                <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-200 mt-1">Activity across G1Card</h2>
                <p className="mt-1 text-sm text-[var(--app-muted)] max-w-2xl">
                    Pick a hospital or a patient to see every record view, consent change and record update involving them.
                </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
                <aside className="space-y-3 lg:sticky lg:top-24 lg:self-start">
                    <div className="at-tabs w-full" role="tablist" aria-label="Show">
                        {(['hospital', 'patient'] as Scope[]).map(s => (
                            <button key={s} type="button" role="tab" aria-selected={scope === s} className={`flex-1 ${scope === s ? 'is-on' : ''}`} onClick={() => switchScope(s)}>
                                {s === 'hospital' ? 'Hospitals' : 'Patients'}
                            </button>
                        ))}
                    </div>
                    <SearchBox
                        key={scope}
                        className="w-full"
                        placeholder={scope === 'hospital' ? 'Search hospitals' : 'Search patients'}
                        onSearch={q => { setPage(1); setSearch(q); }}
                    />

                    <div className="overflow-hidden rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)]">
                        {loading && entities.length === 0 ? (
                            <div className="at-skeleton p-3">{[0, 1, 2, 3].map(n => <div key={n} style={{ height: 44 }} />)}</div>
                        ) : entities.length === 0 ? (
                            <p className="px-4 py-8 text-center text-sm text-[var(--app-muted)]">{search ? `Nothing matches “${search}”.` : 'Nothing to show yet.'}</p>
                        ) : (
                            <ul className={`divide-y divide-[var(--app-border)] ${loading ? 'opacity-60' : ''}`}>
                                {entities.map(e => {
                                    const name = entityName(e);
                                    const active = selected?._id === e._id;
                                    return (
                                        <li key={e._id}>
                                            <button
                                                type="button"
                                                onClick={() => setSelected(e)}
                                                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${active ? 'bg-[var(--app-accent-soft)]' : 'hover:bg-[var(--app-surface-soft)]'}`}
                                                aria-current={active}
                                            >
                                                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${active ? 'bg-[var(--app-accent)] text-[var(--app-on-accent)]' : 'bg-[var(--app-surface-soft)] text-[var(--app-muted)]'}`}>{initials(name)}</span>
                                                <span className="min-w-0">
                                                    <span className="flex items-center gap-2 truncate text-sm font-semibold text-[var(--app-text)]">
                                                        {name}
                                                        {e.suspended && <span className="app-suspended-badge">Suspended</span>}
                                                    </span>
                                                    <span className="block truncate text-xs text-[var(--app-muted)]">{entitySub(e, scope) || '—'}</span>
                                                </span>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                        {pages > 1 && (
                            <div className="flex items-center justify-between border-t border-[var(--app-border)] px-3 py-2 text-xs text-[var(--app-muted)]">
                                <button type="button" className="at-export !h-8" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</button>
                                <span>{page} / {pages}</span>
                                <button type="button" className="at-export !h-8" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Next</button>
                            </div>
                        )}
                    </div>
                </aside>

                <section className="min-w-0">
                    {selected ? (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--app-accent-soft)] text-sm font-bold text-[var(--app-accent)]">{initials(entityName(selected))}</span>
                                <div>
                                    <p className="font-serif text-2xl font-semibold leading-tight">{entityName(selected)}</p>
                                    <p className="text-sm text-[var(--app-muted)]">{scope === 'hospital' ? 'Hospital' : 'Patient'}{entitySub(selected, scope) ? ` · ${entitySub(selected, scope)}` : ''}</p>
                                </div>
                            </div>
                            <ActivityTimeline key={`${scope}-${selected._id}`} scope={scope} entityId={selected._id} allowExport />
                        </div>
                    ) : (
                        <div className="at-empty h-full flex flex-col items-center justify-center">
                            <p className="at-empty-title">Choose a {scope === 'hospital' ? 'hospital' : 'patient'}</p>
                            <p>Their activity timeline will appear here.</p>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
};

export default AuditLogs;
