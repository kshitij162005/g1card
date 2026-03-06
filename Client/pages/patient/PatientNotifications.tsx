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

    useEffect(() => {
        loadRequests();
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

    return (
        <Card title="Notifications - Hospital Access Requests">
            {loading ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">Loading requests...</p>
            ) : requests.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">No access requests at the moment.</p>
            ) : (
                <div className="space-y-3">
                    {requests.map((req) => (
                        <div
                            key={req.id}
                            className="p-3 border border-slate-200 dark:border-slate-700 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-3"
                        >
                            <div>
                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                    {req.hospitalName || 'Hospital'}{' '}
                                    <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${statusChipClasses(req.status)}`}>
                                        {req.status}
                                        {req.accessLevel && req.status === 'APPROVED' && (
                                            <> – {req.accessLevel === 'COMPLETE' ? 'Complete Info' : 'General Info'}</>
                                        )}
                                    </span>
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    Requested at: {new Date(req.createdAt).toLocaleString()}
                                </p>
                            </div>
                            {req.status === 'PENDING' && (
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
                            )}
                        </div>
                    ))}
                </div>
            )}
        </Card>
    );
};

export default PatientNotifications;

