import React, { useState, useEffect } from 'react';
import Card from '../../components/Card';
import { API_URL } from '../../config/api';

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
    const [searchTerm, setSearchTerm] = useState('');
    const [eventFilter, setEventFilter] = useState('');
    const [expandedLog, setExpandedLog] = useState<string | null>(null);
    const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 });

    // Fetch hospitals list
    useEffect(() => {
        fetchHospitals();
        fetchPatients();
    }, []);

    // Fetch logs when entity is selected
    useEffect(() => {
        if (selectedEntityId) {
            fetchLogs();
        }
    }, [selectedEntityId, activeTab, eventFilter, pagination.page]);

    const fetchHospitals = async () => {
        try {
            const resp = await fetch(`${API_URL}/superadmin/hospitals`);
            const data = await resp.json();
            if (resp.ok && data.hospitals) {
                setHospitals(data.hospitals);
            }
        } catch (err) {
            console.error('Failed to fetch hospitals:', err);
        }
    };

    const fetchPatients = async () => {
        try {
            const resp = await fetch(`${API_URL}/superadmin/patients`);
            const data = await resp.json();
            if (resp.ok && data.patients) {
                setPatients(data.patients);
            }
        } catch (err) {
            console.error('Failed to fetch patients:', err);
        }
    };

    const fetchLogs = async () => {
        if (!selectedEntityId) return;
        
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

            const resp = await fetch(`${API_URL}${endpoint}?${params}`);
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

    const filteredEntities = activeTab === 'hospital'
        ? hospitals.filter(h => h.name.toLowerCase().includes(searchTerm.toLowerCase()))
        : patients.filter(p => 
            `${p.firstName || ''} ${p.lastName || ''}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.username?.toLowerCase().includes(searchTerm.toLowerCase())
        );

    const selectedEntity = activeTab === 'hospital'
        ? hospitals.find(h => h._id === selectedEntityId)
        : patients.find(p => p._id === selectedEntityId);

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
        a.download = `audit-logs-${activeTab}-${selectedEntityId}-${new Date().toISOString()}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

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

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Entity Selection Sidebar */}
                <Card className="lg:col-span-1">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">
                        Select {activeTab === 'hospital' ? 'Hospital' : 'Patient'}
                    </h3>
                    
                    <input
                        type="text"
                        placeholder={`Search ${activeTab}s...`}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 mb-4"
                    />

                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {filteredEntities.length === 0 ? (
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                No {activeTab}s found
                            </p>
                        ) : (
                            filteredEntities.map((entity: any) => (
                                <button
                                    key={entity._id}
                                    onClick={() => setSelectedEntityId(entity._id)}
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
                </Card>

                {/* Logs Display */}
                <Card className="lg:col-span-3">
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
                            <div className="mb-6">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                    <div>
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
                                    
                                    <div className="flex gap-2">
                                        <select
                                            value={eventFilter}
                                            onChange={(e) => setEventFilter(e.target.value)}
                                            className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-sm"
                                        >
                                            <option value="">All Events</option>
                                            <option value="ACCESS_REQUEST_CREATED">Access Requests</option>
                                            <option value="ACCESS_REQUEST_APPROVED">Approvals</option>
                                            <option value="ACCESS_REQUEST_DENIED">Denials</option>
                                            <option value="PHI_ACCESSED">PHI Access</option>
                                            <option value="RECORD_CREATED">Record Creation</option>
                                            <option value="ACCESS_REVOKED">Revocations</option>
                                        </select>
                                        <button
                                            onClick={exportToCSV}
                                            disabled={logs.length === 0}
                                            className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-secondary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
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
                                            <div
                                                className="p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                                                onClick={() => setExpandedLog(expandedLog === log._id ? null : log._id)}
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
                                            </div>

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

                            {/* Pagination */}
                            {pagination.totalPages > 1 && (
                                <div className="mt-6 flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-4">
                                    <p className="text-sm text-slate-600 dark:text-slate-400">
                                        Page {pagination.page} of {pagination.totalPages}
                                    </p>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                                            disabled={pagination.page === 1}
                                            className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800"
                                        >
                                            Previous
                                        </button>
                                        <button
                                            onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                                            disabled={!pagination.hasMore}
                                            className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800"
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