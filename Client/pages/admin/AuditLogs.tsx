import React, { useState, useEffect } from 'react';
import Card from '../../components/Card';
import { API_URL } from '../../config/api';
import Loader from '../../components/Loader';

interface AuditLog {
    _id: string;
    event: string;
    actor: {
        id: string;
        model: string;
        name?: string;
        email?: string;
        ipAddress?: string;
        userAgent?: string;
    };
    target?: {
        id: string;
        model: string;
        name?: string;
        identifier?: string;
    };
    action: {
        description: string;
        outcome: string;
        reason?: string;
        denialReason?: string;
    };
    changes?: {
        before: any;
        after: any;
    };
    compliance?: {
        hipaaJustification?: string;
        consentBased: boolean;
        consentId?: string;
    };
    metadata?: any;
    severity: string;
    createdAt: string;
}

interface Hospital {
    _id: string;
    name: string;
    city?: string;
    state?: string;
}

interface Patient {
    _id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    username?: string;
}

const AuditLogs: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'hospital' | 'patient'>('hospital');
    const [hospitals, setHospitals] = useState<Hospital[]>([]);
    const [patients, setPatients] = useState<Patient[]>([]);
    const [selectedEntityId, setSelectedEntityId] = useState<string>('');
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingEntities, setLoadingEntities] = useState(false);
    const [entitySearchTerm, setEntitySearchTerm] = useState('');
    const [logSearchTerm, setLogSearchTerm] = useState('');
    const [eventFilter, setEventFilter] = useState('');
    const [exportRangeType, setExportRangeType] = useState<'all' | 'months' | 'years'>('all');
    const [exportRangeValue, setExportRangeValue] = useState(6);
    const [showExportOptions, setShowExportOptions] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [expandedLog, setExpandedLog] = useState<string | null>(null);
    const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
    const [entityPagination, setEntityPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });

    // Lazy load entities only when tab is selected
    useEffect(() => {
        setSelectedEntityId('');
        setLogs([]);
        setEntitySearchTerm('');
        setLogSearchTerm('');
        setShowExportOptions(false);
        setEntityPagination({ page: 1, limit: 10, total: 0, totalPages: 0 });
        setPagination({ page: 1, limit: 10, total: 0, totalPages: 0 });
        
        if (activeTab === 'hospital') {
            fetchHospitals();
        } else {
            fetchPatients();
        }
    }, [activeTab]);

    // Fetch entities when page changes
    useEffect(() => {
        if (activeTab === 'hospital') {
            fetchHospitals();
        } else {
            fetchPatients();
        }
    }, [entityPagination.page, activeTab, entitySearchTerm]);

    // Fetch logs when entity is selected or filters change
    useEffect(() => {
        if (selectedEntityId) {
            fetchLogs();
        } else {
            setLogs([]);
            setShowExportOptions(false);
        }
    }, [selectedEntityId, activeTab, eventFilter, pagination.page, logSearchTerm]);

    useEffect(() => {
        setEntityPagination(prev => ({ ...prev, page: 1 }));
    }, [entitySearchTerm, activeTab]);

    useEffect(() => {
        setPagination(prev => ({ ...prev, page: 1 }));
    }, [eventFilter, logSearchTerm, selectedEntityId, activeTab]);

    const fetchHospitals = async () => {
        setLoadingEntities(true);
        try {
            const params = new URLSearchParams({
                page: entityPagination.page.toString(),
                limit: entityPagination.limit.toString(),
            });
            if (entitySearchTerm.trim()) {
                params.append('search', entitySearchTerm.trim());
            }
            const resp = await fetch(`${API_URL}/superadmin/hospitals?${params.toString()}`);
            const data = await resp.json();
            if (resp.ok && data.hospitals) {
                setHospitals(data.hospitals);
                if (data.pagination) {
                    setEntityPagination(data.pagination);
                }
            }
        } catch (err) {
            console.error('Failed to fetch hospitals:', err);
        } finally {
            setLoadingEntities(false);
        }
    };

    const fetchPatients = async () => {
        setLoadingEntities(true);
        try {
            const params = new URLSearchParams({
                page: entityPagination.page.toString(),
                limit: entityPagination.limit.toString(),
            });
            if (entitySearchTerm.trim()) {
                params.append('search', entitySearchTerm.trim());
            }
            const resp = await fetch(`${API_URL}/superadmin/patients?${params.toString()}`);
            const data = await resp.json();
            if (resp.ok && data.patients) {
                setPatients(data.patients);
                if (data.pagination) {
                    setEntityPagination(data.pagination);
                }
            }
        } catch (err) {
            console.error('Failed to fetch patients:', err);
        } finally {
            setLoadingEntities(false);
        }
    };

    const fetchLogs = async () => {
        if (!selectedEntityId || loading) return; // Prevent duplicate fetches
        
        setLoading(true);
        try {
            const endpoint = activeTab === 'hospital' 
                ? `/audit-logs/hospital/${selectedEntityId}`
                : `/audit-logs/patient/${selectedEntityId}`;
            
            const params = new URLSearchParams({
                page: pagination.page.toString(),
                limit: pagination.limit.toString(),
            });
            
            if (eventFilter) {
                params.append('event', eventFilter);
            }
            if (logSearchTerm.trim()) {
                params.append('search', logSearchTerm.trim());
            }

            const resp = await fetch(`${API_URL}${endpoint}?${params}`);
            const data = await resp.json();
            
            if (resp.ok && data.logs) {
                setLogs(data.logs);
                if (data.pagination) {
                    // Only update total and totalPages, not page to avoid triggering re-fetch
                    setPagination(prev => ({ 
                        ...prev, 
                        total: data.pagination.total,
                        totalPages: data.pagination.totalPages
                    }));
                }
            }
        } catch (err) {
            console.error('Failed to fetch audit logs:', err);
        } finally {
            setLoading(false);
        }
    };

    const getEventBadgeColor = (event: string) => {
        if (event.includes('DENIED') || event.includes('REVOKED') || event.includes('FAILED')) {
            return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
        }
        if (event.includes('APPROVED') || event.includes('GRANTED') || event.includes('SUCCESS')) {
            return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
        }
        if (event.includes('UPGRADE') || event.includes('REQUEST')) {
            return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
        }
        if (event.includes('ACCESSED') || event.includes('VIEWED')) {
            return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
        }
        if (event.includes('CREATED')) {
            return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200';
        }
        return 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200';
    };

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'CRITICAL': return 'text-red-600 dark:text-red-400';
            case 'WARNING': return 'text-yellow-600 dark:text-yellow-400';
            default: return 'text-blue-600 dark:text-blue-400';
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
    };

    // Display current entities (server-side paginated)
    const displayedEntities = activeTab === 'hospital' ? hospitals : patients;

    const selectedEntity = activeTab === 'hospital'
        ? hospitals.find(h => h._id === selectedEntityId)
        : patients.find(p => p._id === selectedEntityId);

    const exportToCSV = async () => {
        if (!selectedEntityId) return;
        setExporting(true);

        const endpoint = activeTab === 'hospital'
            ? `/audit-logs/hospital/${selectedEntityId}`
            : `/audit-logs/patient/${selectedEntityId}`;

        const allLogs: AuditLog[] = [];
        let currentPage = 1;
        const exportPageSize = 200;

        try {
            // Fetch all pages that match current filters/search + export range.
            while (true) {
                const params = new URLSearchParams({
                    page: currentPage.toString(),
                    limit: exportPageSize.toString(),
                });

                if (eventFilter) params.append('event', eventFilter);
                if (logSearchTerm.trim()) params.append('search', logSearchTerm.trim());
                if (exportRangeType === 'months') params.append('months', String(Math.max(1, exportRangeValue)));
                if (exportRangeType === 'years') params.append('years', String(Math.max(1, exportRangeValue)));

                const resp = await fetch(`${API_URL}${endpoint}?${params.toString()}`);
                const data = await resp.json();

                if (!resp.ok) {
                    throw new Error(data?.error || 'Failed to export logs');
                }

                const pageLogs: AuditLog[] = data.logs || [];
                allLogs.push(...pageLogs);

                if (!data.pagination?.hasMore || pageLogs.length === 0) break;
                currentPage += 1;

                // Safety cap for unexpected pagination loops.
                if (currentPage > 500) break;
            }

            if (allLogs.length === 0) {
                notify('No logs found for selected export range');
                return;
            }

            const headers = ['Timestamp', 'Event', 'Actor', 'Action', 'Outcome', 'Severity', 'HIPAA Justification'];
            const rows = allLogs.map(log => [
                formatDate(log.createdAt),
                log.event,
                log.actor.name || log.actor.email || 'Unknown',
                log.action.description,
                log.action.outcome,
                log.severity,
                log.compliance?.hipaaJustification || 'N/A'
            ]);

            const csvContent = [
                headers.join(','),
                ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
            ].join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const rangeLabel = exportRangeType === 'all' ? 'all' : `${Math.max(1, exportRangeValue)}-${exportRangeType}`;
            a.download = `audit-logs-${activeTab}-${selectedEntityId}-${rangeLabel}-${new Date().toISOString()}.csv`;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('export logs error:', err);
            notify('Failed to export logs');
        } finally {
            setExporting(false);
        }
    };

    if (loading && logs.length === 0) {
        return <Loader text="Loading system audit logs..." fullScreen />;
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">HIPAA Audit Logs</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Complete audit trail of all PHI access and system activities
                </p>
            </div>

            {/* Tab Selection */}
            <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700">
                <button
                    onClick={() => {
                        setActiveTab('hospital');
                        setSelectedEntityId('');
                        setLogs([]);
                    }}
                    className={`px-6 py-3 font-medium transition-colors border-b-2 ${
                        activeTab === 'hospital'
                            ? 'border-brand-primary text-brand-primary dark:text-brand-accent'
                            : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                >
                    Hospital Logs
                </button>
                <button
                    onClick={() => {
                        setActiveTab('patient');
                        setSelectedEntityId('');
                        setLogs([]);
                    }}
                    className={`px-6 py-3 font-medium transition-colors border-b-2 ${
                        activeTab === 'patient'
                            ? 'border-brand-primary text-brand-primary dark:text-brand-accent'
                            : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                >
                    Patient Logs
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-6">
                {/* Entity Selection Sidebar */}
                <Card className="h-fit">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">
                        Select {activeTab === 'hospital' ? 'Hospital' : 'Patient'}
                    </h3>

                    <div className="mb-4">
                        <input
                            type="text"
                            value={entitySearchTerm}
                            onChange={(e) => setEntitySearchTerm(e.target.value)}
                            placeholder={`Search ${activeTab}s...`}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    
                    {loadingEntities ? (
                        <div className="text-center py-8">
                            <Loader text={`Loading ${activeTab}s...`} size="small" />
                        </div>
                    ) : (
                        <>
                            <div className="space-y-2 max-h-96 overflow-y-auto mb-4">
                                {displayedEntities.length === 0 ? (
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        No {activeTab}s found
                                    </p>
                                ) : (
                                    displayedEntities.map((entity: any) => (
                                        <button
                                            key={entity._id}
                                            onClick={() => {
                                                setSelectedEntityId(entity._id);
                                                setPagination(prev => ({ ...prev, page: 1 }));
                                            }}
                                            className={`w-full text-left p-3 rounded-lg transition-colors ${
                                                selectedEntityId === entity._id
                                                    ? 'bg-brand-primary text-white'
                                                    : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100'
                                            }`}
                                        >
                                            <div className="font-medium text-sm">
                                                {activeTab === 'hospital' 
                                                    ? entity.name 
                                                    : `${entity.firstName || ''} ${entity.lastName || ''}`.trim() || entity.username || 'Unknown'
                                                }
                                            </div>
                                            {activeTab === 'hospital' && entity.city && (
                                                <div className="text-xs opacity-75 mt-1">
                                                    {entity.city}, {entity.state}
                                                </div>
                                            )}
                                            {activeTab === 'patient' && entity.email && (
                                                <div className="text-xs opacity-75 mt-1">
                                                    {entity.email}
                                                </div>
                                            )}
                                        </button>
                                    ))
                                )}
                            </div>

                            {/* Entity pagination controls */}
                            {entityPagination.totalPages > 1 && (
                                <div className="flex items-center justify-between text-xs border-t border-slate-200 dark:border-slate-700 pt-3">
                                    <span className="text-slate-600 dark:text-slate-400">
                                        Page {entityPagination.page} of {entityPagination.totalPages}
                                    </span>
                                    <div className="flex gap-1">
                                        <button
                                            disabled={entityPagination.page === 1}
                                            onClick={() => setEntityPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                                            className="px-2 py-1 border border-slate-300 dark:border-slate-600 rounded text-xs disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700"
                                        >
                                            Prev
                                        </button>
                                        <button
                                            disabled={entityPagination.page >= entityPagination.totalPages}
                                            onClick={() => setEntityPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                                            className="px-2 py-1 border border-slate-300 dark:border-slate-600 rounded text-xs disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700"
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </Card>

                {/* Logs Display */}
                <Card>
                    {!selectedEntityId ? (
                        <div className="text-center py-12">
                            <svg className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                No {activeTab} Selected
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Select a {activeTab} from the list to view audit logs
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Header */}
                            <div className="mb-6 space-y-3">
                                <div className="flex flex-col gap-1">
                                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                                        {activeTab === 'hospital' 
                                            ? (selectedEntity as Hospital)?.name
                                            : `${(selectedEntity as Patient)?.firstName || ''} ${(selectedEntity as Patient)?.lastName || ''}`.trim() || (selectedEntity as Patient)?.username
                                        }
                                    </h3>
                                    <p className="text-sm text-slate-600 dark:text-slate-400">
                                        {pagination.total} log entries found
                                    </p>
                                </div>

                                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 p-3">
                                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-2">
                                        <div className="lg:col-span-7">
                                            <label className="sr-only" htmlFor="audit-log-search">Search logs</label>
                                            <input
                                                id="audit-log-search"
                                                type="text"
                                                value={logSearchTerm}
                                                onChange={(e) => setLogSearchTerm(e.target.value)}
                                                placeholder="Search logs by actor, target or message"
                                                className="w-full h-10 px-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            />
                                        </div>

                                        <div className="lg:col-span-3">
                                            <label className="sr-only" htmlFor="audit-log-event-filter">Event filter</label>
                                            <select
                                                id="audit-log-event-filter"
                                                value={eventFilter}
                                                onChange={(e) => {
                                                    setEventFilter(e.target.value);
                                                    setPagination(prev => ({ ...prev, page: 1 }));
                                                }}
                                                className="w-full h-10 px-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm"
                                            >
                                                <option value="">All events</option>
                                                <option value="ACCESS_REQUEST_CREATED">Access Requests</option>
                                                <option value="ACCESS_REQUEST_APPROVED">Approvals</option>
                                                <option value="ACCESS_REQUEST_DENIED">Denials</option>
                                                <option value="PHI_ACCESSED">PHI Access</option>
                                                <option value="RECORD_CREATED">Record Creation</option>
                                                <option value="ACCESS_REVOKED">Revocations</option>
                                            </select>
                                        </div>

                                        <div className="lg:col-span-2">
                                            <button
                                                onClick={() => setShowExportOptions(prev => !prev)}
                                                disabled={!selectedEntityId}
                                                className="w-full h-10 px-4 bg-brand-primary text-white rounded-lg hover:bg-brand-secondary text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {showExportOptions ? 'Hide Export Options' : 'Export CSV'}
                                            </button>
                                        </div>
                                    </div>

                                    {showExportOptions && (
                                        <div className="mt-3 border-t border-slate-200 dark:border-slate-700 pt-3">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
                                                Export Options
                                            </p>
                                            <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto_auto] gap-2 items-center">
                                                <select
                                                    id="audit-log-export-range"
                                                    value={exportRangeType}
                                                    onChange={(e) => setExportRangeType(e.target.value as 'all' | 'months' | 'years')}
                                                    className="w-full h-10 px-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm"
                                                >
                                                    <option value="all">All time</option>
                                                    <option value="months">Last N months</option>
                                                    <option value="years">Last N years</option>
                                                </select>

                                                {exportRangeType !== 'all' && (
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        value={exportRangeValue}
                                                        onChange={(e) => setExportRangeValue(Math.max(1, Number(e.target.value) || 1))}
                                                        className="w-20 h-10 px-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm"
                                                        aria-label={`Export ${exportRangeType} value`}
                                                    />
                                                )}

                                                <button
                                                    onClick={exportToCSV}
                                                    disabled={!selectedEntityId || exporting}
                                                    className="h-10 px-4 bg-brand-primary text-white rounded-lg hover:bg-brand-secondary text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {exporting ? 'Exporting...' : 'Download CSV'}
                                                </button>
                                            </div>
                                            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                                Exports all matching logs for the selected hospital/patient.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Logs List */}
                            {loading ? (
                                <div className="text-center py-12">
                                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto"></div>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-4">Loading audit logs...</p>
                                </div>
                            ) : logs.length === 0 ? (
                                <div className="text-center py-12">
                                    <p className="text-slate-500 dark:text-slate-400">No audit logs found</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {logs.map((log) => (
                                        <div
                                            key={log._id}
                                            className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden"
                                        >
                                            <button
                                                type="button"
                                                className="w-full text-left p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                                                onClick={() => setExpandedLog(expandedLog === log._id ? null : log._id)}
                                                aria-expanded={expandedLog === log._id}
                                                aria-label={`Toggle details for ${log.event.replace(/_/g, ' ')}`}
                                            >
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <span className={`px-2 py-1 text-xs font-semibold rounded ${getEventBadgeColor(log.event)}`}>
                                                                {log.event.replace(/_/g, ' ')}
                                                            </span>
                                                            <span className={`text-xs font-medium ${getSeverityColor(log.severity)}`}>
                                                                {log.severity}
                                                            </span>
                                                            <span className={`px-2 py-0.5 text-xs rounded ${
                                                                log.action.outcome === 'SUCCESS' 
                                                                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                                                    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                                            }`}>
                                                                {log.action.outcome}
                                                            </span>
                                                        </div>
                                                        <p className="text-sm text-slate-900 dark:text-slate-100 mb-1">
                                                            {log.action.description}
                                                        </p>
                                                        <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
                                                            <span>
                                                                <strong>Actor:</strong> {log.actor.name || log.actor.email || 'Unknown'}
                                                            </span>
                                                            {log.target && (
                                                                <span>
                                                                    <strong>Target:</strong> {log.target.name || log.target.identifier}
                                                                </span>
                                                            )}
                                                            <span className="ml-auto">
                                                                {formatDate(log.createdAt)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <svg
                                                        className={`w-5 h-5 text-slate-400 transition-transform ${expandedLog === log._id ? 'rotate-180' : ''}`}
                                                        fill="none"
                                                        stroke="currentColor"
                                                        viewBox="0 0 24 24"
                                                    >
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                    </svg>
                                                </div>
                                            </button>

                                            {/* Expanded Details */}
                                            {expandedLog === log._id && (
                                                <div className="border-t border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-800/50 space-y-4">
                                                    {/* Actor Details */}
                                                    <div>
                                                        <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">Actor Information</h4>
                                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                                            <div><strong>Name:</strong> {log.actor.name || 'N/A'}</div>
                                                            <div><strong>Email:</strong> {log.actor.email || 'N/A'}</div>
                                                            <div><strong>Type:</strong> {log.actor.model}</div>
                                                            <div><strong>IP Address:</strong> {log.actor.ipAddress || 'N/A'}</div>
                                                            {log.actor.userAgent && (
                                                                <div className="col-span-2"><strong>User Agent:</strong> {log.actor.userAgent}</div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Action Details */}
                                                    {(log.action.reason || log.action.denialReason) && (
                                                        <div>
                                                            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">Action Details</h4>
                                                            <div className="text-xs space-y-1">
                                                                {log.action.reason && (
                                                                    <div><strong>Reason:</strong> {log.action.reason}</div>
                                                                )}
                                                                {log.action.denialReason && (
                                                                    <div><strong>Denial Reason:</strong> {log.action.denialReason}</div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Changes */}
                                                    {log.changes && (
                                                        <div>
                                                            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">Changes</h4>
                                                            <div className="grid grid-cols-2 gap-4 text-xs">
                                                                <div>
                                                                    <strong className="block mb-1">Before:</strong>
                                                                    <pre className="bg-slate-200 dark:bg-slate-900 p-2 rounded text-xs overflow-auto">
                                                                        {JSON.stringify(log.changes.before, null, 2)}
                                                                    </pre>
                                                                </div>
                                                                <div>
                                                                    <strong className="block mb-1">After:</strong>
                                                                    <pre className="bg-slate-200 dark:bg-slate-900 p-2 rounded text-xs overflow-auto">
                                                                        {JSON.stringify(log.changes.after, null, 2)}
                                                                    </pre>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* HIPAA Compliance */}
                                                    {log.compliance && (
                                                        <div>
                                                            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">HIPAA Compliance</h4>
                                                            <div className="text-xs space-y-1">
                                                                <div><strong>Justification:</strong> {log.compliance.hipaaJustification || 'N/A'}</div>
                                                                <div><strong>Consent Based:</strong> {log.compliance.consentBased ? 'Yes' : 'No'}</div>
                                                                {log.compliance.consentId && (
                                                                    <div><strong>Consent ID:</strong> {log.compliance.consentId}</div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Metadata */}
                                                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                                                        <div>
                                                            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">Additional Metadata</h4>
                                                            <pre className="bg-slate-200 dark:bg-slate-900 p-2 rounded text-xs overflow-auto">
                                                                {JSON.stringify(log.metadata, null, 2)}
                                                            </pre>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Pagination with Page Numbers */}
                            {!loading && logs.length > 0 && (
                                <div className="mt-6 flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-4">
                                    <p className="text-sm text-slate-600 dark:text-slate-400">
                                        Showing {(pagination.page - 1) * pagination.limit + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} results
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                                            disabled={pagination.page === 1}
                                            className="px-3 py-1 border border-slate-300 dark:border-slate-600 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                        >
                                            Previous
                                        </button>
                                        
                                        {/* Page Numbers */}
                                        {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => {
                                            let pageNum;
                                            if (pagination.totalPages <= 5) {
                                                pageNum = i + 1;
                                            } else if (pagination.page <= 3) {
                                                pageNum = i + 1;
                                            } else if (pagination.page >= pagination.totalPages - 2) {
                                                pageNum = pagination.totalPages - 4 + i;
                                            } else {
                                                pageNum = pagination.page - 2 + i;
                                            }
                                            return (
                                                <button
                                                    key={pageNum}
                                                    onClick={() => setPagination(prev => ({ ...prev, page: pageNum }))}
                                                    className={`px-3 py-1 border rounded-lg text-sm transition-colors ${
                                                        pagination.page === pageNum
                                                            ? 'bg-blue-500 text-white border-blue-500'
                                                            : 'border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700'
                                                    }`}
                                                >
                                                    {pageNum}
                                                </button>
                                            );
                                        })}
                                        
                                        <button
                                            onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                                            disabled={pagination.page >= pagination.totalPages}
                                            className="px-3 py-1 border border-slate-300 dark:border-slate-600 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </Card>
            </div>
        </div>
    );
};

export default AuditLogs;