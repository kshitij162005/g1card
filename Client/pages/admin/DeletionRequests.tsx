import { API_URL } from '../../config/api';
import SearchBox from '../../components/SearchBox';
import React, { useEffect, useMemo, useState } from 'react';
import Card from '../../components/Card';
import Loader from '../../components/Loader';
import { useAuth } from '../../contexts/AuthContext';

type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type RequestType = 'DATA_DELETION' | 'ACCOUNT_DELETION';

interface DeletionRequestItem {
    _id: string;
    patient: {
        _id: string;
        firstName?: string;
        lastName?: string;
        name?: string;
        email?: string;
        username?: string;
        patientId?: string;
    };
    requestType: RequestType;
    status: RequestStatus;
    reason?: string;
    reviewNotes?: string;
    createdAt: string;
    reviewedAt?: string;
}

async function parseApiResponse(resp: Response) {
    const contentType = resp.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
        return resp.json();
    }
    const text = await resp.text();
    return { error: text?.slice(0, 200) || `HTTP ${resp.status}` };
}

const statusPillClass: Record<RequestStatus, string> = {
    PENDING: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
    APPROVED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200',
    REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200',
};

const DeletionRequests: React.FC = () => {
    const { user } = useAuth();
    const [requests, setRequests] = useState<DeletionRequestItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<'ALL' | RequestStatus>('ALL');
    const [search, setSearch] = useState('');
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [reviewModal, setReviewModal] = useState<{ id: string; decision: 'APPROVED' | 'REJECTED'; patientName: string } | null>(null);
    const [reviewNotes, setReviewNotes] = useState('');

    const fetchRequests = async () => {
        setLoading(true);
        try {
            const query = new URLSearchParams();
            if (statusFilter !== 'ALL') query.set('status', statusFilter);
            if (search.trim()) query.set('search', search.trim());

            const resp = await fetch(`${API_URL}/superadmin/deletion-requests?${query.toString()}`);
            const data = await parseApiResponse(resp);
            if (!resp.ok) {
                notify(data?.error || data?.message || 'Unable to load deletion requests');
                setLoading(false);
                return;
            }

            setRequests(Array.isArray(data?.requests) ? data.requests : []);
        } catch (err) {
            console.error('fetch deletion requests error', err);
            notify('Error loading deletion requests');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statusFilter, search]);

    const pendingCount = useMemo(() => requests.filter((r) => r.status === 'PENDING').length, [requests]);

    const formatDate = (value?: string) => {
        if (!value) return 'N/A';
        const d = new Date(value);
        return Number.isNaN(d.getTime()) ? 'N/A' : d.toLocaleString('en-IN');
    };

    const getPatientName = (item: DeletionRequestItem) =>
        `${item.patient?.firstName || ''} ${item.patient?.lastName || ''}`.trim() || item.patient?.name || 'Unknown Patient';

    const reviewRequest = async () => {
        if (!reviewModal) return;
        if (reviewModal.decision === 'REJECTED' && !reviewNotes.trim()) {
            notify('Please provide review notes for rejection');
            return;
        }

        setProcessingId(reviewModal.id);
        try {
            const resp = await fetch(`${API_URL}/superadmin/deletion-requests/${reviewModal.id}/review`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    adminId: user?.id,
                    decision: reviewModal.decision,
                    reviewNotes: reviewNotes.trim(),
                }),
            });
            const data = await parseApiResponse(resp);
            if (!resp.ok) {
                notify(data?.error || data?.message || 'Unable to review request');
                return;
            }

            notify(`Request ${reviewModal.decision === 'APPROVED' ? 'approved' : 'rejected'} successfully`);
            setReviewModal(null);
            setReviewNotes('');
            fetchRequests();
        } catch (err) {
            console.error('review deletion request error', err);
            notify('Error reviewing request');
        } finally {
            setProcessingId(null);
        }
    };

    if (loading) return <Loader text="Loading deletion requests..." fullScreen />;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Deletion Requests</h1>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Review patient data/account deletion requests.</p>
                </div>
                <span className="inline-flex px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200 w-fit">
                    {pendingCount} pending
                </span>
            </div>

            <Card>
                <div className="flex flex-col lg:flex-row gap-3">
                    <SearchBox
                        className="flex-1"
                        placeholder="Search by patient name or email"
                        onSearch={q => setSearch(q)}
                    />
                    <div className="flex gap-2">
                        {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((status) => (
                            <button
                                key={status}
                                type="button"
                                onClick={() => setStatusFilter(status)}
                                className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                                    statusFilter === status
                                        ? 'bg-brand-primary text-white border-brand-primary'
                                        : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                                }`}
                            >
                                {status}
                            </button>
                        ))}
                        <button
                            type="button"
                            onClick={fetchRequests}
                            className="px-4 py-2 bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600"
                        >
                            Refresh
                        </button>
                    </div>
                </div>
            </Card>

            {requests.length === 0 ? (
                <Card>
                    <p className="text-sm text-slate-600 dark:text-slate-400">No deletion requests found for the selected filter.</p>
                </Card>
            ) : (
                <div className="grid gap-4">
                    {requests.map((item) => {
                        const patientName = getPatientName(item);
                        const patientEmail = item.patient?.email || item.patient?.username || 'N/A';
                        return (
                            <Card key={item._id}>
                                <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
                                    <div className="space-y-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{patientName}</h3>
                                            <span className={`px-2 py-1 rounded text-xs font-semibold ${statusPillClass[item.status]}`}>
                                                {item.status}
                                            </span>
                                            <span className="px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200">
                                                {item.requestType === 'ACCOUNT_DELETION' ? 'Account Deletion' : 'Data Deletion'}
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-600 dark:text-slate-400">{patientEmail}</p>
                                        <p className="text-sm text-slate-700 dark:text-slate-300">
                                            <span className="font-semibold">Reason:</span> {item.reason || 'No reason provided'}
                                        </p>
                                        {item.reviewNotes && (
                                            <p className="text-sm text-slate-700 dark:text-slate-300">
                                                <span className="font-semibold">Review Notes:</span> {item.reviewNotes}
                                            </p>
                                        )}
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            Requested: {formatDate(item.createdAt)}
                                            {item.reviewedAt ? ` | Reviewed: ${formatDate(item.reviewedAt)}` : ''}
                                        </p>
                                    </div>

                                    {item.status === 'PENDING' && (
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                disabled={processingId === item._id}
                                                onClick={() => {
                                                    setReviewNotes('');
                                                    setReviewModal({ id: item._id, decision: 'APPROVED', patientName });
                                                }}
                                                className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-60"
                                            >
                                                Approve
                                            </button>
                                            <button
                                                type="button"
                                                disabled={processingId === item._id}
                                                onClick={() => {
                                                    setReviewNotes('');
                                                    setReviewModal({ id: item._id, decision: 'REJECTED', patientName });
                                                }}
                                                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-60"
                                            >
                                                Reject
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}

            {reviewModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60" onClick={() => setReviewModal(null)} />
                    <div className="relative w-full max-w-lg rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl p-5">
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                            {reviewModal.decision === 'APPROVED' ? 'Approve Request' : 'Reject Request'}
                        </h2>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Patient: {reviewModal.patientName}</p>
                        <div className="mt-4">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Review Notes</label>
                            <textarea
                                value={reviewNotes}
                                onChange={(e) => setReviewNotes(e.target.value)}
                                rows={4}
                                placeholder={reviewModal.decision === 'REJECTED' ? 'Reason for rejection (required)' : 'Optional notes for approval'}
                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                            />
                        </div>
                        <div className="mt-5 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setReviewModal(null)}
                                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={reviewRequest}
                                disabled={processingId === reviewModal.id}
                                className={`px-4 py-2 rounded-lg text-white font-medium disabled:opacity-60 ${reviewModal.decision === 'APPROVED' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
                            >
                                {processingId === reviewModal.id ? 'Submitting...' : reviewModal.decision === 'APPROVED' ? 'Approve' : 'Reject'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DeletionRequests;
