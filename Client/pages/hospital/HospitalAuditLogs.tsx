import React, { useState, useEffect } from 'react';
import Card from '../../components/Card';
import { API_URL } from '../../config/api';
import { useAuth } from '../../contexts/AuthContext';
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

const HospitalAuditLogs: React.FC = () => {
    const { user } = useAuth();
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [eventFilter, setEventFilter] = useState('');
    const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0, hasMore: false });

    useEffect(() => {
        if (user?.id) {
            fetchLogs();
        }
    }, [user?.id, eventFilter, pagination.page]);

    const fetchLogs = async () => {
        if (!user?.id) return;
        
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: pagination.page.toString(),
                limit: pagination.limit.toString(),
            });
            
            if (eventFilter) {
                params.append('event', eventFilter);
            }

            const resp = await fetch(`${API_URL}/audit-logs/hospital/${user.id}?${params}`);
            const data = await resp.json();
            
            if (resp.ok && data.logs) {
                setLogs(data.logs);
                if (data.pagination) {
                    setPagination(prev => ({ ...prev, ...data.pagination }));
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

    const exportToCSV = () => {
        if (logs.length === 0) return;

        const headers = ['Timestamp', 'Event', 'Actor', 'Action', 'Outcome', 'Severity', 'HIPAA Justification'];
        const rows = logs.map(log => [
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
        a.download = `hospital-audit-logs-${new Date().toISOString()}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    if (loading && logs.length === 0) {
        return <Loader text="Loading audit logs..." fullScreen />;
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Activity Log</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Track your hospital's patient access and record activities
                </p>
            </div>

            <Card>
                {/* Header */}
                <div className="mb-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                {pagination.total} activities recorded
                            </p>
                        </div>
                        
                        <div className="flex gap-2">
                            <select
                                value={eventFilter}
                                onChange={(e) => setEventFilter(e.target.value)}
                                className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="">All Activities</option>
                                <option value="ACCESS_REQUEST_CREATED">Access Requests</option>
                                <option value="ACCESS_REQUEST_APPROVED">Patient Approvals</option>
                                <option value="ACCESS_REQUEST_DENIED">Patient Denials</option>
                                <option value="PHI_ACCESSED">Record Access</option>
                                <option value="RECORD_CREATED">Record Creation</option>
                            </select>
                            <button
                                onClick={exportToCSV}
                                disabled={logs.length === 0}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Export CSV
                            </button>
                        </div>
                    </div>
                </div>

                {/* Logs List */}
                {loading ? (
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto"></div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-4">Loading activities...</p>
                    </div>
                ) : logs.length === 0 ? (
                    <div className="text-center py-12">
                        <svg className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p className="text-slate-500 dark:text-slate-400">No activities found</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {logs.map((log) => (
                            <div
                                key={log._id}
                                className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className={`px-2 py-1 text-xs font-semibold rounded ${getEventBadgeColor(log.event)}`}>
                                                {log.event.replace(/_/g, ' ')}
                                            </span>
                                            <span className={`px-2 py-0.5 text-xs rounded ${
                                                log.action.outcome === 'SUCCESS' 
                                                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                                    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                            }`}>
                                                {log.action.outcome}
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-900 dark:text-slate-100 mb-2">
                                            {log.action.description}
                                        </p>
                                        {log.target && (
                                            <p className="text-xs text-slate-600 dark:text-slate-400">
                                                Patient: <span className="font-medium">{log.target.name || log.target.identifier || 'Unknown'}</span>
                                            </p>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            {formatDate(log.createdAt)}
                                        </p>
                                    </div>
                                </div>
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
            </Card>
        </div>
    );
};

export default HospitalAuditLogs;
