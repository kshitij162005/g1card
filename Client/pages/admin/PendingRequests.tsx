import { API_URL } from '../../config/api';
import SearchBox from '../../components/SearchBox';
import React, { useEffect, useState } from 'react';
import Card from '../../components/Card';
import Loader from '../../components/Loader';

interface PendingHospital {
    _id: string;
    name: string;
    username: string;
    regNumber: string;
    address: string;
    city: string;
    state: string;
    pin: string;
    license: string;
    contactEmail: string;
    phone: string;
    website: string;
    adminName: string;
    adminEmail: string;
    adminPhone: string;
    designation: string;
    createdAt: string;
}

const PendingRequests: React.FC = () => {
    const [hospitals, setHospitals] = useState<PendingHospital[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedHospital, setSelectedHospital] = useState<PendingHospital | null>(null);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [showApproveModal, setShowApproveModal] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [approvalChecklist, setApprovalChecklist] = useState({
        regNumberVerified: false,
        licenseVerified: false,
        contactVerified: false,
        adminVerified: false,
        documentsVerified: false,
    });
    const [processing, setProcessing] = useState(false);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ total: 0, pages: 1, limit: 10 });

    useEffect(() => {
        fetchPendingHospitals();
    }, [page, search]);

    const fetchPendingHospitals = async () => {
        setLoading(true);
        try {
            const resp = await fetch(`${API_URL}/superadmin/hospitals/pending?search=${encodeURIComponent(search)}&page=${page}&limit=10`);
            const data = await resp.json();
            if (data.ok) {
                setHospitals(data.hospitals || []);
                if (data.pagination) {
                    setPagination(data.pagination);
                }
            }
        } catch (err) {
            console.error('fetch pending hospitals error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (hospitalId: string) => {
        setProcessing(true);
        try {
            const resp = await fetch(`${API_URL}/superadmin/hospitals/${hospitalId}/approve`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ verificationChecklist: approvalChecklist }),
            });
            const data = await resp.json();
            if (data.ok) {
                notify('Hospital approved successfully!');
                setSelectedHospital(null);
                setShowApproveModal(false);
                setApprovalChecklist({
                    regNumberVerified: false,
                    licenseVerified: false,
                    contactVerified: false,
                    adminVerified: false,
                    documentsVerified: false,
                });
                fetchPendingHospitals();
            } else {
                notify('Failed to approve: ' + (data.error || 'Unknown error'));
            }
        } catch (err) {
            console.error('approve error:', err);
            notify('Error approving hospital');
        } finally {
            setProcessing(false);
        }
    };

    const handleReject = async () => {
        if (!selectedHospital) return;
        setProcessing(true);
        try {
            const resp = await fetch(`${API_URL}/superadmin/hospitals/${selectedHospital._id}/reject`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason: rejectReason }),
            });
            const data = await resp.json();
            if (data.ok) {
                notify('Hospital registration rejected');
                setShowRejectModal(false);
                setSelectedHospital(null);
                setRejectReason('');
                fetchPendingHospitals();
            } else {
                notify('Failed to reject: ' + (data.error || 'Unknown error'));
            }
        } catch (err) {
            console.error('reject error:', err);
            notify('Error rejecting hospital');
        } finally {
            setProcessing(false);
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const resetChecklist = () => setApprovalChecklist({
            regNumberVerified: false,
            licenseVerified: false,
            contactVerified: false,
            adminVerified: false,
            documentsVerified: false,
        });

    const openDetails = (hospital: PendingHospital) => {
        if (selectedHospital?._id !== hospital._id) resetChecklist();
        setSelectedHospital(hospital);
    };

    // Ticks made while reviewing details carry over to the approval step
    const openApproveModal = (hospital: PendingHospital) => {
        if (selectedHospital?._id !== hospital._id) resetChecklist();
        setSelectedHospital(hospital);
        setShowRejectModal(false);
        setShowApproveModal(true);
    };

    const toggleCheck = (key: ChecklistKey, checked: boolean) =>
        setApprovalChecklist((prev) => ({ ...prev, [key]: checked }));

    const canApprove = Object.values(approvalChecklist).every(Boolean);

    if (loading) {
        return <Loader text="Loading pending requests..." fullScreen />;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Pending Registration Requests</h1>
                    <p className="text-slate-600 dark:text-slate-400 mt-1">Review and approve new hospital registrations</p>
                </div>
                <div className="flex items-center space-x-2">
                    <span className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 px-3 py-1 rounded-full text-sm font-medium">
                        {hospitals.length} pending
                    </span>
                </div>
            </div>

            {/* Search */}
            <Card>
                <div className="flex gap-4">
                    <SearchBox
                        className="flex-1"
                        placeholder="Search by hospital name, email or city"
                        onSearch={q => { setPage(1); setSearch(q); }}
                    />
                </div>
            </Card>

            {loading ? (
                <Card>
                    <p className="text-center py-8 text-slate-600 dark:text-slate-400">Loading pending requests...</p>
                </Card>
            ) : hospitals.length === 0 ? (
                <Card>
                    <div className="text-center py-12">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full mb-4">
                            <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">All caught up!</h3>
                        <p className="text-slate-600 dark:text-slate-400 mt-2">No pending hospital registration requests</p>
                    </div>
                </Card>
            ) : (
                <div className="grid gap-4">
                    {hospitals.map((hospital) => (
                        <Card key={hospital._id}>
                            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                                <div className="flex-1 space-y-3">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">{hospital.name}</h3>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                                Submitted on {formatDate(hospital.createdAt)}
                                            </p>
                                        </div>
                                        <span className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 px-2 py-1 rounded text-xs font-medium">
                                            Pending Review
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                                        <div>
                                            <span className="text-slate-500 dark:text-slate-400">Registration No:</span>
                                            <span className="ml-2 text-slate-700 dark:text-slate-300 font-medium">{hospital.regNumber || 'N/A'}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-500 dark:text-slate-400">License:</span>
                                            <span className="ml-2 text-slate-700 dark:text-slate-300 font-medium">{hospital.license || 'N/A'}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-500 dark:text-slate-400">Location:</span>
                                            <span className="ml-2 text-slate-700 dark:text-slate-300 font-medium">{hospital.city}, {hospital.state}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-500 dark:text-slate-400">Contact Email:</span>
                                            <span className="ml-2 text-slate-700 dark:text-slate-300 font-medium">{hospital.contactEmail}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-500 dark:text-slate-400">Phone:</span>
                                            <span className="ml-2 text-slate-700 dark:text-slate-300 font-medium">{hospital.phone || 'N/A'}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-500 dark:text-slate-400">Admin:</span>
                                            <span className="ml-2 text-slate-700 dark:text-slate-300 font-medium">{hospital.adminName || 'N/A'}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-row lg:flex-col gap-2 lg:min-w-[140px]">
                                    <button
                                        onClick={() => openDetails(hospital)}
                                        className="flex-1 lg:flex-none px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors text-sm font-medium"
                                    >
                                        View Details
                                    </button>
                                    <button
                                        onClick={() => openApproveModal(hospital)}
                                        disabled={processing}
                                        className="flex-1 lg:flex-none px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-50"
                                    >
                                        Approve
                                    </button>
                                    <button
                                        onClick={() => {
                                            setSelectedHospital(hospital);
                                            setShowRejectModal(true);
                                        }}
                                        disabled={processing}
                                        className="flex-1 lg:flex-none px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50"
                                    >
                                        Reject
                                    </button>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {/* Pagination Controls */}
            {!loading && hospitals.length > 0 && pagination.pages > 1 && (
                <div className="flex items-center justify-between pt-4">
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                        Showing {((page - 1) * pagination.limit) + 1} to {Math.min(page * pagination.limit, pagination.total)} of {pagination.total} requests
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            disabled={page === 1}
                            onClick={() => setPage(p => p - 1)}
                            className="px-3 py-1 border dark:border-slate-600 rounded-lg text-sm hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Previous
                        </button>
                        
                        {/* Page Numbers */}
                        {Array.from({ length: Math.min(pagination.pages, 5) }, (_, i) => {
                            let pageNum;
                            if (pagination.pages <= 5) {
                                pageNum = i + 1;
                            } else if (page <= 3) {
                                pageNum = i + 1;
                            } else if (page >= pagination.pages - 2) {
                                pageNum = pagination.pages - 4 + i;
                            } else {
                                pageNum = page - 2 + i;
                            }
                            return (
                                <button
                                    key={pageNum}
                                    onClick={() => setPage(pageNum)}
                                    className={`px-3 py-1 border rounded-lg text-sm transition-colors ${
                                        page === pageNum
                                            ? 'bg-blue-500 text-white border-blue-500'
                                            : 'border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700'
                                    }`}
                                >
                                    {pageNum}
                                </button>
                            );
                        })}
                        
                        <button
                            disabled={page === pagination.pages}
                            onClick={() => setPage(p => p + 1)}
                            className="px-3 py-1 border dark:border-slate-600 rounded-lg text-sm hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}

            {/* Detail Modal */}
            {selectedHospital && !showRejectModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-start">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">{selectedHospital.name}</h2>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                    Registration Request Details
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedHospital(null)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Hospital Information */}
                            <div>
                                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3 flex items-center">
                                    <svg className="w-5 h-5 mr-2 text-brand-primary" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 01-1 1h-2v-2a1 1 0 00-1-1H8a1 1 0 00-1 1v2H5a1 1 0 01-1-1V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" />
                                    </svg>
                                    Hospital Information
                                </h3>
                                <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 grid grid-cols-2 gap-4">
                                    <InfoRow label="Hospital Name" value={selectedHospital.name} />
                                    <InfoRow label="Registration Number" value={selectedHospital.regNumber} />
                                    <InfoRow label="License Number" value={selectedHospital.license} />
                                    <InfoRow label="Website" value={selectedHospital.website} />
                                    <InfoRow label="Address" value={selectedHospital.address} fullWidth />
                                    <InfoRow label="City" value={selectedHospital.city} />
                                    <InfoRow label="State" value={selectedHospital.state} />
                                    <InfoRow label="PIN Code" value={selectedHospital.pin} />
                                </div>
                            </div>

                            {/* Contact Information */}
                            <div>
                                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3 flex items-center">
                                    <svg className="w-5 h-5 mr-2 text-brand-primary" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                                    </svg>
                                    Contact Information
                                </h3>
                                <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 grid grid-cols-2 gap-4">
                                    <InfoRow label="Contact Email" value={selectedHospital.contactEmail} />
                                    <InfoRow label="Phone" value={selectedHospital.phone} />
                                </div>
                            </div>

                            {/* Administrator Information */}
                            <div>
                                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3 flex items-center">
                                    <svg className="w-5 h-5 mr-2 text-brand-primary" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                    </svg>
                                    Administrator Details
                                </h3>
                                <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 grid grid-cols-2 gap-4">
                                    <InfoRow label="Admin Name" value={selectedHospital.adminName} />
                                    <InfoRow label="Designation" value={selectedHospital.designation} />
                                    <InfoRow label="Admin Email" value={selectedHospital.adminEmail} />
                                    <InfoRow label="Admin Phone" value={selectedHospital.adminPhone} />
                                </div>
                            </div>

                            {/* Verification Checklist */}
                            <div>
                                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3 flex items-center">
                                    <svg className="w-5 h-5 mr-2 text-brand-primary" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                    Verification Checklist
                                </h3>
                                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                                    <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-3">
                                        Please verify the following before approving:
                                    </p>
                                    <div className="space-y-2">
                                        {APPROVAL_CHECKS.map(({ key, label }) => (
                                            <ChecklistItem key={key} label={label} checked={approvalChecklist[key]} onChange={(checked) => toggleCheck(key, checked)} />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
                            <button
                                onClick={() => setSelectedHospital(null)}
                                className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                            >
                                Close
                            </button>
                            <button
                                onClick={() => setShowRejectModal(true)}
                                disabled={processing}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                            >
                                Reject
                            </button>
                            <button
                                onClick={() => openApproveModal(selectedHospital)}
                                disabled={processing}
                                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                            >
                                Open Approval Verification
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Approve Modal */}
            {showApproveModal && selectedHospital && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Verify Before Approval</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{selectedHospital.name}</p>
                        </div>

                        <div className="p-6 space-y-3">
                            <p className="text-sm text-slate-700 dark:text-slate-300">Complete all checks to approve this hospital.</p>
                            {APPROVAL_CHECKS.map(({ key, label }) => (
                                <ChecklistItem key={key} label={label} checked={approvalChecklist[key]} onChange={(checked) => toggleCheck(key, checked)} />
                            ))}
                        </div>

                        <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
                            <button
                                onClick={() => setShowApproveModal(false)}
                                className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleApprove(selectedHospital._id)}
                                disabled={processing || !canApprove}
                                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                            >
                                {processing ? 'Processing...' : 'Approve Hospital'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reject Modal */}
            {showRejectModal && selectedHospital && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Reject Registration</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                {selectedHospital.name}
                            </p>
                        </div>

                        <div className="p-6">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Reason for rejection (will be visible to the hospital)
                            </label>
                            <textarea
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="Please provide a reason for rejection..."
                                rows={4}
                                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                            />
                        </div>

                        <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setShowRejectModal(false);
                                    setRejectReason('');
                                }}
                                className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleReject}
                                disabled={processing}
                                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                            >
                                {processing ? 'Processing...' : 'Confirm Rejection'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const InfoRow: React.FC<{ label: string; value: string | undefined; fullWidth?: boolean }> = ({ label, value, fullWidth }) => (
    <div className={fullWidth ? 'col-span-2' : ''}>
        <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</span>
        <p className="text-slate-800 dark:text-slate-200 font-medium mt-1">{value || 'N/A'}</p>
    </div>
);

type ChecklistKey = 'regNumberVerified' | 'licenseVerified' | 'contactVerified' | 'adminVerified' | 'documentsVerified';

const APPROVAL_CHECKS: { key: ChecklistKey; label: string }[] = [
    { key: 'regNumberVerified', label: 'Hospital registration number is valid' },
    { key: 'licenseVerified', label: 'License number matches official records' },
    { key: 'contactVerified', label: 'Address and contact details are accurate' },
    { key: 'adminVerified', label: 'Administrator credentials are verified' },
    { key: 'documentsVerified', label: 'All submitted documents are authentic' },
];

const ChecklistItem: React.FC<{ label: string; checked: boolean; onChange: (checked: boolean) => void }> = ({ label, checked, onChange }) => (
    <label className={`app-check-row ${checked ? 'is-checked' : ''}`}>
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span>{label}</span>
    </label>
);

export default PendingRequests;
