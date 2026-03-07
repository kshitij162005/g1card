import React, { useEffect, useState } from 'react';
import Card from '../../components/Card';
import { API_URL } from '../../config/api';
import { useAuth } from '../../contexts/AuthContext';

interface AccessRequest {
    id: string;
    hospitalId: string;
    hospitalName: string;
    status: string;
    accessLevel?: string;
    createdAt: string;
    updatedAt: string;
}

interface Notification {
    id: string;
    type: string;
    title: string;
    message: string;
    metadata: any;
    isRead: boolean;
    readAt?: string;
    actionUrl?: string;
    relatedAccess?: string;
    sender?: { _id: string; name: string };
    createdAt: string;
    updatedAt: string;
}

const statusChipClasses = (status: string) => {
    switch (status) {
        case 'APPROVED':
            return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
        case 'DENIED':
            return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
        default:
            return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    }
};

const PatientNotifications: React.FC = () => {
    const { user } = useAuth();
    const [requests, setRequests] = useState<AccessRequest[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(false);
    const [choiceById, setChoiceById] = useState<Record<string, 'GENERAL' | 'COMPLETE'>>({});

    const loadRequests = async () => {
        if (!user?.id) return;
        setLoading(true);
        try {
            const resp = await fetch(`${API_URL}/patients/${user.id}/access-requests`);
            const data = await resp.json();
            if (!resp.ok) {
                console.error('load requests error', data);
                return;
            }
            const list: AccessRequest[] = (data.requests || []).slice().sort(
                (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
            setRequests(list);
        } catch (err) {
            console.error('load requests error', err);
        } finally {
            setLoading(false);
        }
    };

    const loadNotifications = async () => {
        if (!user?.id) return;
        try {
            console.log('Loading notifications for patient:', user.id);
            const resp = await fetch(`${API_URL}/patients/${user.id}/notifications`);
            const data = await resp.json();
            console.log('Notifications response:', data);
            if (resp.ok && data.notifications) {
                console.log('Setting notifications:', data.notifications.length);
                setNotifications(data.notifications);
            }
        } catch (err) {
            console.error('load notifications error', err);
        }
    };

    useEffect(() => {
        loadRequests();
        loadNotifications();
    }, [user?.id]);

    const updateChoice = (id: string, value: 'GENERAL' | 'COMPLETE') => {
        setChoiceById(prev => ({ ...prev, [id]: value }));
    };

    const handleDecision = async (req: AccessRequest, approve: boolean) => {
        if (!user?.id) return;
        try {
            const body: any = { decision: approve ? 'APPROVE' : 'DENY' };
            if (approve) {
                body.accessLevel = choiceById[req.id] || 'GENERAL';
            }
            const resp = await fetch(`${API_URL}/patients/${user.id}/access-requests/${req.id}/decision`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await resp.json();
            if (!resp.ok) {
                alert(data?.error || data?.message || 'Failed to update request');
                return;
            }
            await loadRequests();
        } catch (err) {
            console.error('decision error', err);
            alert('Error updating request');
        }
    };

    const handleUpgradeDecision = async (notification: Notification, approve: boolean) => {
        if (!user?.id) return;
        try {
            const resp = await fetch(`${API_URL}/patients/${user.id}/notifications/${notification.id}/upgrade-decision`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ decision: approve ? 'APPROVE' : 'DENY' }),
            });
            const data = await resp.json();
            if (!resp.ok) {
                alert(data?.error || data?.message || 'Failed to process request');
                return;
            }
            alert(data.message);
            await loadNotifications();
            await loadRequests();
        } catch (err) {
            console.error('upgrade decision error', err);
            alert('Error processing request');
        }
    };

    const upgradeNotifications = notifications.filter(n => n.type === 'ACCESS_UPGRADE_REQUEST' && !n.isRead);
    const previousUpgradeNotifications = notifications.filter(n => n.type === 'ACCESS_UPGRADE_REQUEST' && n.isRead);
    const pendingRequests = requests.filter(req => req.status === 'PENDING');
    const otherRequests = requests.filter(req => req.status !== 'PENDING');

    return (
        <Card title="Notifications - Hospital Access Requests">
                {loading ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">Loading requests...</p>
                ) : upgradeNotifications.length === 0 && requests.length === 0 && previousUpgradeNotifications.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">No access requests at the moment.</p>
                ) : (
                    <div className="space-y-3">
                        {/* Upgrade Request Notifications - Shown First */}
                        {upgradeNotifications.map((notif) => (
                            <div
                                key={`notif-${notif.id}`}
                                className="p-4 border-2 border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/20 rounded-lg"
                            >
                                <div className="flex items-start gap-3">
                                    <svg className="w-6 h-6 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="text-sm font-semibold text-orange-800 dark:text-orange-300">
                                                {notif.metadata?.hospitalName || 'Hospital'}
                                            </h3>
                                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-200 text-orange-800 dark:bg-orange-700 dark:text-orange-200">
                                                UPGRADE REQUEST
                                            </span>
                                        </div>
                                        <p className="text-sm text-orange-700 dark:text-orange-400 mt-1">
                                            {notif.message}
                                        </p>
                                        <p className="text-xs text-orange-600 dark:text-orange-500 mt-2">
                                            Requested at: {new Date(notif.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
                                        </p>
                                        <div className="flex items-center gap-2 mt-3">
                                            <button
                                                onClick={() => handleUpgradeDecision(notif, false)}
                                                className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                                            >
                                                Deny
                                            </button>
                                            <button
                                                onClick={() => handleUpgradeDecision(notif, true)}
                                                className="px-3 py-1.5 text-xs rounded-lg bg-orange-600 text-white hover:bg-orange-700 dark:bg-orange-700 dark:hover:bg-orange-800"
                                            >
                                                Grant Complete Access
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                        
                        {/* Pending Initial Access Requests */}
                        {pendingRequests.map((req) => (
                            <div
                                key={req.id}
                                className="p-3 border border-slate-200 dark:border-slate-700 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-3"
                            >
                                <div>
                                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                        {req.hospitalName || 'Hospital'}{' '}
                                        <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${statusChipClasses(req.status)}`}>
                                            {req.status}
                                        </span>
                                    </p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                        Requested at: {new Date(req.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
                                    </p>
                                </div>
                                <div className="flex flex-col md:flex-row items-start md:items-center gap-2">
                                <div className="flex items-center gap-2 text-xs">
                                    <span className="text-slate-600 dark:text-slate-300 font-medium">Access level:</span>
                                    <select
                                        value={choiceById[req.id] || 'GENERAL'}
                                        onChange={(e) =>
                                            updateChoice(req.id, e.target.value === 'COMPLETE' ? 'COMPLETE' : 'GENERAL')
                                        }
                                        className="text-xs border border-slate-300 dark:border-slate-600 rounded px-2 py-1 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                                    >
                                        <option value="GENERAL">General Information Only</option>
                                        <option value="COMPLETE">Complete Information</option>
                                    </select>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleDecision(req, false)}
                                        className="px-3 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                                    >
                                        Deny
                                    </button>
                                    <button
                                        onClick={() => handleDecision(req, true)}
                                        className="px-3 py-1 text-xs rounded-lg bg-brand-primary text-white hover:bg-brand-secondary"
                                    >
                                        Approve
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Previously Approved/Denied Requests */}
                    {(otherRequests.length > 0 || previousUpgradeNotifications.length > 0) && (
                        <>
                            <div className="pt-3 border-t dark:border-slate-700">
                                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3">Previous Requests</p>
                            </div>
                            
                            {/* Previous Upgrade Notifications */}
                            {previousUpgradeNotifications.map((notif) => {
                                // Check metadata.decision first, fallback to checking relatedAccess status
                                const decision = notif.metadata?.decision || (notif.message?.toLowerCase().includes('upgraded') ? 'APPROVED' : notif.message?.toLowerCase().includes('denied') ? 'DENIED' : undefined);
                                const isApproved = decision === 'APPROVED';
                                const isDenied = decision === 'DENIED';
                                return (
                                <div
                                    key={`prev-notif-${notif.id}`}
                                    className="p-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/50"
                                >
                                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                        {notif.metadata?.hospitalName || 'Hospital'}{' '}
                                        <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${
                                            isApproved ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                            isDenied ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                                            'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                        }`}>
                                            {isApproved ? 'UPGRADE APPROVED' : isDenied ? 'UPGRADE DENIED' : 'UPGRADE REQUEST'}
                                        </span>
                                    </p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                        {notif.message}
                                    </p>
                                    <div className="mt-2 space-y-1">
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            <span className="font-medium">Requested:</span> {new Date(notif.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
                                        </p>
                                        {notif.readAt && (
                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                <span className="font-medium">{isApproved ? 'Approved:' : isDenied ? 'Denied:' : 'Processed:'}</span> {new Date(notif.readAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
                                            </p>
                                        )}
                                        {isApproved && (
                                            <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                                                ✓ You granted complete access to all your medical records
                                            </p>
                                        )}
                                        {isDenied && (
                                            <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                                                ✗ You denied the complete access upgrade request
                                            </p>
                                        )}
                                    </div>
                                </div>
                                );
                            })}
                            
                            {/* Previous Access Requests */}
                            {otherRequests.map((req) => (
                                <div
                                    key={req.id}
                                    className="p-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/50"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1">
                                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                                {req.hospitalName || 'Hospital'}{' '}
                                                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${statusChipClasses(req.status)}`}>
                                                    {req.status}
                                                    {req.accessLevel && req.status === 'APPROVED' && (
                                                        <> – {req.accessLevel === 'COMPLETE' ? 'Complete Info' : 'General Info'}</>
                                                    )}
                                                </span>
                                            </p>
                                            <div className="mt-2 space-y-1">
                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                    <span className="font-medium">Requested:</span>{' '}
                                                    {new Date(req.createdAt).toLocaleString('en-IN', { 
                                                        timeZone: 'Asia/Kolkata', 
                                                        day: '2-digit', 
                                                        month: 'short', 
                                                        year: 'numeric', 
                                                        hour: '2-digit', 
                                                        minute: '2-digit', 
                                                        hour12: true 
                                                    })}
                                                </p>
                                                {req.updatedAt && req.updatedAt !== req.createdAt && (
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                                        <span className="font-medium">
                                                            {req.status === 'APPROVED' ? 'Approved:' : req.status === 'DENIED' ? 'Denied:' : 'Updated:'}
                                                        </span>{' '}
                                                        {new Date(req.updatedAt).toLocaleString('en-IN', { 
                                                            timeZone: 'Asia/Kolkata', 
                                                            day: '2-digit', 
                                                            month: 'short', 
                                                            year: 'numeric', 
                                                            hour: '2-digit', 
                                                            minute: '2-digit', 
                                                            hour12: true 
                                                        })}
                                                    </p>
                                                )}
                                                {req.status === 'APPROVED' && req.accessLevel && (
                                                    <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                                                        ✓ You granted {req.accessLevel === 'COMPLETE' ? 'complete access to all your medical records' : 'general access to records from this hospital only'}
                                                    </p>
                                                )}
                                                {req.status === 'DENIED' && (
                                                    <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                                                        ✗ You denied this access request
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </>
                    )}
                </div>
            )}
        </Card>
    );
};

export default PatientNotifications;

