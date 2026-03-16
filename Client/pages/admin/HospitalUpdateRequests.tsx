import { API_URL } from '../../config/api';
import React, { useEffect, useState } from 'react';
import Card from '../../components/Card';
import Loader from '../../components/Loader';
import GlassNotification from '../../components/GlassNotification';
import { useAuth } from '../../contexts/AuthContext';
import { useSSE } from '../../hooks/useSSE';

interface UpdateRequest {
    _id: string;
    hospital: {
        _id: string;
        name: string;
        contactEmail: string;
        city: string;
        state: string;
    };
    requestedChanges: any;
    originalData: any;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED';
    adminRemarks?: string;
    conversation: Array<{
        sender: 'HOSPITAL' | 'ADMIN';
        message: string;
        timestamp: string;
    }>;
    createdAt: string;
    reviewedAt?: string;
    resubmittedAt?: string;
}

const HospitalUpdateRequestsAdmin: React.FC = () => {
    const { user } = useAuth();
    const [requests, setRequests] = useState<UpdateRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedRequest, setSelectedRequest] = useState<UpdateRequest | null>(null);
    const [actionMessage, setActionMessage] = useState('');
    const [processing, setProcessing] = useState(false);
    const [filterStatus, setFilterStatus] = useState('PENDING');
    const [pagination, setPagination] = useState({ total: 0, pages: 1, page: 1, limit: 10 });
    const [counts, setCounts] = useState<{ PENDING: number; CHANGES_REQUESTED: number; APPROVED: number; REJECTED: number; ALL: number }>({
        PENDING: 0,
        CHANGES_REQUESTED: 0,
        APPROVED: 0,
        REJECTED: 0,
        ALL: 0
    });
    const [notification, setNotification] = useState<{ show: boolean; title: string; message: string; type: 'info' | 'success' | 'warning' | 'error' }>({ 
        show: false, 
        title: '', 
        message: '', 
        type: 'info' 
    });

    // Listen for SSE notifications
    useSSE({
        userId: user?.id,
        userType: 'Superadmin',
        onEvent: (event) => {
            if (event.type.includes('UPDATE_REQUEST')) {
                fetchRequests();
                fetchCounts();
            }
        }
    });

    useEffect(() => {
        if (user?.id) {
            fetchRequests();
        }
    }, [filterStatus, pagination.page]);

    useEffect(() => {
        if (user?.id) {
            fetchCounts();
        }
    }, []);

    const fetchRequests = async () => {
        setLoading(true);
        try {
            const resp = await fetch(`${API_URL}/superadmin/update-requests?status=${filterStatus}&page=${pagination.page}&limit=${pagination.limit}`);
            const data = await resp.json();
            if (resp.ok) {
                setRequests(data.requests || []);
                setPagination(data.pagination || { total: 0, pages: 1, page: 1, limit: 10 });
            }
        } catch (err) {
            console.error('fetch requests error:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchCounts = async () => {
        try {
            const statuses = ['PENDING', 'CHANGES_REQUESTED', 'APPROVED', 'REJECTED', 'ALL'];
            const countsData: any = {};
            
            await Promise.all(
                statuses.map(async (status) => {
                    try {
                        const resp = await fetch(`${API_URL}/superadmin/update-requests?status=${status}&page=1&limit=1`);
                        const data = await resp.json();
                        if (resp.ok) {
                            countsData[status] = data.pagination?.total || 0;
                        }
                    } catch (err) {
                        console.error(`fetch count for ${status} error:`, err);
                        countsData[status] = 0;
                    }
                })
            );
            
            setCounts(countsData);
        } catch (err) {
            console.error('fetch counts error:', err);
        }
    };

    const handleApprove = async () => {
        if (!selectedRequest || !user?.id) return;
        
        setProcessing(true);
        try {
            const resp = await fetch(`${API_URL}/superadmin/update-requests/${selectedRequest._id}/approve`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ adminId: user.id, remarks: actionMessage })
            });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error);
            
            setNotification({ show: true, title: 'Request Approved', message: 'Update request approved successfully!', type: 'success' });
            setSelectedRequest(null);
            setActionMessage('');
            fetchRequests();
            fetchCounts();
        } catch (err: any) {
            setNotification({ show: true, title: 'Approval Failed', message: err.message || 'Failed to approve request', type: 'error' });
        } finally {
            setProcessing(false);
        }
    };

    const handleReject = async () => {
        if (!selectedRequest || !user?.id || !actionMessage.trim()) {
            setNotification({ show: true, title: 'Rejection Reason Required', message: 'Please provide a rejection reason', type: 'warning' });
            return;
        }
        
        setProcessing(true);
        try {
            const resp = await fetch(`${API_URL}/superadmin/update-requests/${selectedRequest._id}/reject`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ adminId: user.id, reason: actionMessage })
            });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error);
            
            setNotification({ show: true, title: 'Request Rejected', message: 'Update request has been rejected and hospital notified', type: 'success' });
            setSelectedRequest(null);
            setActionMessage('');
            fetchRequests();
            fetchCounts();
        } catch (err: any) {
            setNotification({ show: true, title: 'Rejection Failed', message: err.message || 'Failed to reject request', type: 'error' });
        } finally {
            setProcessing(false);
        }
    };

    const handleRequestChanges = async () => {
        if (!selectedRequest || !user?.id || !actionMessage.trim()) {
            setNotification({ show: true, title: 'Message Required', message: 'Please provide details about what needs to be changed', type: 'warning' });
            return;
        }
        
        setProcessing(true);
        try {
            const resp = await fetch(`${API_URL}/superadmin/update-requests/${selectedRequest._id}/request-changes`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ adminId: user.id, message: actionMessage })
            });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error);
            
            setNotification({ show: true, title: 'Changes Requested', message: 'Hospital has been notified to make changes', type: 'success' });
            setSelectedRequest(null);
            setActionMessage('');
            fetchRequests();
            fetchCounts();
        } catch (err: any) {
            setNotification({ show: true, title: 'Request Failed', message: err.message || 'Failed to request changes', type: 'error' });
        } finally {
            setProcessing(false);
        }
    };

    const handleOpenRequest = async (requestId: string) => {
        try {
            const resp = await fetch(`${API_URL}/superadmin/update-requests/${requestId}`);
            const data = await resp.json();
            if (resp.ok) {
                setSelectedRequest(data.request);
            } else {
                setNotification({ show: true, title: 'Failed to Load', message: 'Could not load request details', type: 'error' });
            }
        } catch (err: any) {
            setNotification({ show: true, title: 'Failed to Load', message: err.message || 'Could not load request details', type: 'error' });
        }
    };

    const handleSendMessage = async () => {
        if (!selectedRequest || !user?.id || !actionMessage.trim()) return;
        
        setProcessing(true);
        try {
            const resp = await fetch(`${API_URL}/superadmin/update-requests/${selectedRequest._id}/message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ adminId: user.id, message: actionMessage })
            });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error);
            
            setActionMessage('');
            // Refresh the selected request
            const refreshResp = await fetch(`${API_URL}/superadmin/update-requests/${selectedRequest._id}`);
            const refreshData = await refreshResp.json();
            if (refreshResp.ok) {
                setSelectedRequest(refreshData.request);
            }
        } catch (err: any) {
            setNotification({ show: true, title: 'Message Failed', message: err.message || 'Failed to send message', type: 'error' });
        } finally {
            setProcessing(false);
        }
    };

    const statusColor = (status: string) => {
        switch (status) {
            case 'PENDING': return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200';
            case 'APPROVED': return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200';
            case 'REJECTED': return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200';
            case 'CHANGES_REQUESTED': return 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200';
            default: return 'bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-200';
        }
    };

    if (loading && requests.length === 0) {
        return <Loader text="Loading update requests..." fullScreen />;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Hospital Update Requests</h1>
                    <p className="text-slate-600 dark:text-slate-400 mt-1">Review and manage hospital information update requests</p>
                </div>
            </div>

            {/* Filters */}
            <Card>
                <div className="flex flex-wrap gap-2">
                    {['PENDING', 'CHANGES_REQUESTED', 'APPROVED', 'REJECTED', 'ALL'].map(status => (
                        <button
                            key={status}
                            onClick={() => {
                                setFilterStatus(status);
                                setPagination(prev => ({ ...prev, page: 1 }));
                            }}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                filterStatus === status
                                    ? 'bg-brand-primary text-white'
                                    : 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600'
                            }`}
                        >
                            <span className="flex items-center gap-2">
                                {status.replace('_', ' ')}
                                <span className={`px-2 py-0.5 rounded-full text-xs ${
                                    filterStatus === status
                                        ? 'bg-white/20'
                                        : 'bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-100'
                                }`}>
                                    {counts[status as keyof typeof counts]}
                                </span>
                            </span>
                        </button>
                    ))}
                </div>
            </Card>

            {/* Requests List */}
            {loading ? (
                <p className="text-center py-8 text-slate-600 dark:text-slate-400">Loading...</p>
            ) : requests.length === 0 ? (
                <Card>
                    <div className="py-12 text-center">
                        <p className="text-slate-800 dark:text-slate-200 font-semibold">No matching update requests</p>
                        <p className="text-slate-600 dark:text-slate-400 mt-1">No {filterStatus === 'ALL' ? '' : filterStatus.toLowerCase()} update requests found.</p>
                    </div>
                </Card>
            ) : (
                <div className="grid gap-4">
                    {requests.map(request => (
                        <Card key={request._id} className="hover:shadow-lg transition-shadow border border-slate-200 dark:border-slate-700">
                            <div className="flex justify-between items-start gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                                            {request.hospital.name}
                                        </h3>
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor(request.status)}`}>
                                            {request.status.replace('_', ' ')}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-700 dark:text-slate-400 mb-3">
                                        {request.hospital.city}, {request.hospital.state} • {request.hospital.contactEmail}
                                    </p>
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        <span className="text-xs text-slate-600 dark:text-slate-400">
                                            Submitted: {new Date(request.createdAt).toLocaleString()}
                                        </span>
                                        {request.resubmittedAt && (
                                            <span className="text-xs text-orange-600 dark:text-orange-400">
                                                Resubmitted: {new Date(request.resubmittedAt).toLocaleString()}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-sm text-slate-700 dark:text-slate-300">
                                        <strong className="text-slate-900 dark:text-slate-200">Fields to update:</strong> {request.requestedChanges ? Object.keys(request.requestedChanges).join(', ') : 'N/A'}
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleOpenRequest(request._id)}
                                    className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-secondary text-sm font-medium"
                                >
                                    Review
                                </button>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {/* Pagination */}
            {pagination.pages > 1 && (
                <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                        Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                    </p>
                    <div className="flex gap-2">
                        <button
                            disabled={pagination.page === 1}
                            onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                            className="px-3 py-1 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-lg text-sm disabled:opacity-50"
                        >
                            Previous
                        </button>
                        <span className="px-3 py-1 text-sm">
                            Page {pagination.page} of {pagination.pages}
                        </span>
                        <button
                            disabled={pagination.page === pagination.pages}
                            onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                            className="px-3 py-1 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-lg text-sm disabled:opacity-50"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}

            {/* Review Modal */}
            {selectedRequest && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-start">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">{selectedRequest.hospital.name}</h2>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Update Request Review</p>
                            </div>
                            <button
                                onClick={() => setSelectedRequest(null)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Requested Changes */}
                            <div>
                                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3">Requested Changes</h3>
                                {selectedRequest.requestedChanges && Object.keys(selectedRequest.requestedChanges).length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {Object.entries(selectedRequest.requestedChanges).map(([key, value]) => (
                                            <div key={key} className="p-4 bg-slate-100 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                                                <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                                                    {key.replace(/([A-Z])/g, ' $1').trim()}
                                                </div>
                                                <div className="space-y-1">
                                                    <div className="text-sm text-slate-700 dark:text-slate-300">
                                                        <span className="text-xs text-slate-500">Old:</span>{' '}
                                                        <span className="text-red-600 dark:text-red-400">
                                                            {selectedRequest.originalData?.[key] || 'N/A'}
                                                        </span>
                                                    </div>
                                                    <div className="text-sm text-slate-700 dark:text-slate-300">
                                                        <span className="text-xs text-slate-500">New:</span>{' '}
                                                        <span className="text-green-600 dark:text-green-400 font-medium">
                                                            {value as string}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-slate-500 dark:text-slate-400 text-sm">No changes requested.</p>
                                )}
                            </div>

                            {/* Conversation */}
                            {selectedRequest.conversation && selectedRequest.conversation.length > 0 && (
                                <div>
                                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3">Conversation</h3>
                                    <div className="space-y-3 max-h-60 overflow-y-auto p-4 bg-slate-100 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                                        {selectedRequest.conversation.map((msg, idx) => (
                                            <div key={idx} className={`p-3 rounded-lg ${
                                                msg.sender === 'ADMIN'
                                                    ? 'bg-blue-100 dark:bg-blue-900/30'
                                                    : 'bg-green-100 dark:bg-green-900/30'
                                            }`}>
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className="text-xs font-semibold">
                                                        {msg.sender === 'ADMIN' ? 'Admin' : 'Hospital'}
                                                    </span>
                                                    <span className="text-xs text-slate-500">
                                                        {new Date(msg.timestamp).toLocaleString()}
                                                    </span>
                                                </div>
                                                <p className="text-sm">{msg.message}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Action Section */}
                            {selectedRequest.status !== 'APPROVED' && selectedRequest.status !== 'REJECTED' && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Message / Remarks:
                                    </label>
                                    <textarea
                                        value={actionMessage}
                                        onChange={(e) => setActionMessage(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-500"
                                        rows={4}
                                        placeholder="Add your comments, ask questions, or provide rejection reason..."
                                    />
                                </div>
                            )}
                        </div>

                        <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
                            <button
                                onClick={() => setSelectedRequest(null)}
                                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-300"
                            >
                                Close
                            </button>
                            {selectedRequest.status !== 'APPROVED' && selectedRequest.status !== 'REJECTED' && (
                                <>
                                    <button
                                        onClick={handleSendMessage}
                                        disabled={processing || !actionMessage.trim()}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                    >
                                        Send Message
                                    </button>
                                    <button
                                        onClick={handleRequestChanges}
                                        disabled={processing}
                                        className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
                                    >
                                        Request Changes
                                    </button>
                                    <button
                                        onClick={handleReject}
                                        disabled={processing}
                                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                                    >
                                        Reject
                                    </button>
                                    <button
                                        onClick={handleApprove}
                                        disabled={processing}
                                        className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                                    >
                                        {processing ? 'Processing...' : 'Approve & Apply'}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
            
            {notification.show && (
                <GlassNotification
                    title={notification.title}
                    message={notification.message}
                    type={notification.type}
                    onClose={() => setNotification({ show: false, title: '', message: '', type: 'info' })}
                />
            )}
        </div>
    );
};

export default HospitalUpdateRequestsAdmin;
