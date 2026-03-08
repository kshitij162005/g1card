import { API_URL } from '../../config/api';
import React, { useEffect, useState } from 'react';
import Card from '../../components/Card';
import { useAuth } from '../../contexts/AuthContext';
import Loader from '../../components/Loader';
import { useSSE } from '../../hooks/useSSE';

interface UpdateRequest {
    _id: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED';
    requestedChanges: any;
    originalData: any;
    adminRemarks?: string;
    conversation: Array<{
        sender: 'HOSPITAL' | 'ADMIN';
        message: string;
        timestamp: string;
    }>;
    createdAt: string;
    resubmittedAt?: string;
    reviewedAt?: string;
}

const HospitalInformationUpdate: React.FC = () => {
    const { user } = useAuth();
    const [hospitalData, setHospitalData] = useState<any>(null);
    const [pendingRequest, setPendingRequest] = useState<UpdateRequest | null>(null);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState<any>({});
    const [submitMessage, setSubmitMessage] = useState('');
    const [replyMessage, setReplyMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Listen for SSE notifications
    useSSE({
        userId: user?.id,
        userType: 'Hospital',
        onEvent: (event) => {
            if (event.type.includes('UPDATE_REQUEST')) {
                fetchPendingRequest();
            }
        }
    });

    useEffect(() => {
        if (user?.id) {
            fetchHospitalData();
            fetchPendingRequest();
        }
    }, [user?.id]);

    const fetchHospitalData = async () => {
        if (!user?.id) return;
        try {
            const resp = await fetch(`${API_URL}/hospitals/${user.id}`);
            const data = await resp.json();
            if (resp.ok && data.hospital) {
                setHospitalData(data.hospital);
                setFormData(data.hospital);
            }
        } catch (err) {
            console.error('fetch hospital error:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchPendingRequest = async () => {
        if (!user?.id) return;
        try {
            const resp = await fetch(`${API_URL}/hospitals/${user.id}/update-request/pending`);
            const data = await resp.json();
            if (resp.ok) {
                setPendingRequest(data.updateRequest);
            }
        } catch (err) {
            console.error('fetch pending request error:', err);
        }
    };

    const handleSubmitRequest = async () => {
        if (!user?.id) return;
        
        const changes: any = {};
        const editableFields = ['name', 'regNumber', 'license', 'address', 'city', 'state', 
                               'pin', 'contactEmail', 'phone', 'website', 'adminName', 
                               'adminEmail', 'adminPhone', 'designation'];
        
        for (const field of editableFields) {
            if (formData[field] !== hospitalData[field]) {
                changes[field] = formData[field];
            }
        }
        
        if (Object.keys(changes).length === 0) {
            notify('No changes detected');
            return;
        }
        
        setSubmitting(true);
        try {
            const resp = await fetch(`${API_URL}/hospitals/${user.id}/update-request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ changes, message: submitMessage })
            });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error);
            
            notify('Update request submitted successfully! Waiting for admin approval.');
            setIsEditing(false);
            setSubmitMessage('');
            fetchPendingRequest();
        } catch (err: any) {
            notify(err.message || 'Failed to submit request');
        } finally {
            setSubmitting(false);
        }
    };

    const handleSendMessage = async () => {
        if (!user?.id || !pendingRequest || !replyMessage.trim()) return;
        
        setSubmitting(true);
        try {
            const resp = await fetch(`${API_URL}/hospitals/${user.id}/update-request/${pendingRequest._id}/message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: replyMessage })
            });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error);
            
            setReplyMessage('');
            fetchPendingRequest();
        } catch (err: any) {
            notify(err.message || 'Failed to send message');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return <Loader text="Loading..." fullScreen />;
    }

    const statusColor = (status: string) => {
        switch (status) {
            case 'PENDING': return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200';
            case 'APPROVED': return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200';
            case 'REJECTED': return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200';
            case 'CHANGES_REQUESTED': return 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200';
            default: return 'bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-200';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Hospital Information</h1>
                    <p className="text-slate-600 dark:text-slate-400 mt-1">Manage your hospital details</p>
                </div>
            </div>

            {/* Pending Request Banner */}
            {pendingRequest && (
                <Card className={`border-2 ${
                    pendingRequest.status === 'PENDING' ? 'border-yellow-400' :
                    pendingRequest.status === 'CHANGES_REQUESTED' ? 'border-orange-400' : 'border-gray-300'
                }`}>
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                                    Update Request Status
                                </h3>
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor(pendingRequest.status)}`}>
                                    {pendingRequest.status.replace('_', ' ')}
                                </span>
                            </div>
                            {pendingRequest.status === 'PENDING' && (
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                    Your update request is pending admin review. Current information will remain active until approved.
                                </p>
                            )}
                            {pendingRequest.status === 'CHANGES_REQUESTED' && (
                                <div className="mt-2 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                                    <p className="text-sm font-medium text-orange-800 dark:text-orange-200 mb-1">
                                        Admin has requested changes:
                                    </p>
                                    <p className="text-sm text-orange-700 dark:text-orange-300">
                                        {pendingRequest.adminRemarks}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    {/* Requested Changes */}
                    <div className="mt-4 pt-4 border-t dark:border-slate-700">
                        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Requested Changes:</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {Object.entries(pendingRequest.requestedChanges).map(([key, value]) => (
                                <div key={key} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                    <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                                        {key.replace(/([A-Z])/g, ' $1').trim()}
                                    </div>
                                    <div className="text-sm">
                                        <span className="text-red-600 dark:text-red-400 line-through">
                                            {pendingRequest.originalData[key] || 'N/A'}
                                        </span>
                                        <span className="mx-2">→</span>
                                        <span className="text-green-600 dark:text-green-400 font-medium">
                                            {value as string}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Conversation */}
                    {pendingRequest.conversation && pendingRequest.conversation.length > 0 && (
                        <div className="mt-4 pt-4 border-t dark:border-slate-700">
                            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Conversation:</h4>
                            <div className="space-y-3 max-h-60 overflow-y-auto">
                                {pendingRequest.conversation.map((msg, idx) => (
                                    <div key={idx} className={`p-3 rounded-lg ${
                                        msg.sender === 'ADMIN' 
                                            ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800' 
                                            : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                                    }`}>
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                                {msg.sender === 'ADMIN' ? 'Admin' : 'You'}
                                            </span>
                                            <span className="text-xs text-slate-500 dark:text-slate-400">
                                                {new Date(msg.timestamp).toLocaleString()}
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-700 dark:text-slate-300">{msg.message}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Reply to changes requested */}
                    {pendingRequest.status === 'CHANGES_REQUESTED' && (
                        <div className="mt-4 pt-4 border-t dark:border-slate-700">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Send a message or resubmit your request:
                            </label>
                            <textarea
                                value={replyMessage}
                                onChange={(e) => setReplyMessage(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 mb-2"
                                rows={3}
                                placeholder="Explain your changes or ask for clarification..."
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={handleSendMessage}
                                    disabled={submitting || !replyMessage.trim()}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
                                >
                                    Send Message
                                </button>
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                                >
                                    Edit & Resubmit
                                </button>
                            </div>
                        </div>
                    )}
                </Card>
            )}

            {/* Current Information / Edit Form */}
            <Card>
                <div className="flex justify-between items-center mb-4 pb-4 border-b dark:border-slate-700">
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                        {isEditing ? 'Edit Information' : 'Current Information'}
                    </h3>
                    {!pendingRequest && !isEditing && (
                        <button
                            onClick={() => setIsEditing(true)}
                            className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-secondary text-sm"
                        >
                            Request Update
                        </button>
                    )}
                    {isEditing && (
                        <button
                            onClick={() => {
                                setIsEditing(false);
                                setFormData(hospitalData);
                            }}
                            className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 text-sm"
                        >
                            Cancel
                        </button>
                    )}
                </div>

                {isEditing ? (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[
                                { key: 'name', label: 'Hospital Name', type: 'text' },
                                { key: 'regNumber', label: 'Registration Number', type: 'text' },
                                { key: 'license', label: 'License Number', type: 'text' },
                                { key: 'address', label: 'Address', type: 'text', fullWidth: true },
                                { key: 'city', label: 'City', type: 'text' },
                                { key: 'state', label: 'State', type: 'text' },
                                { key: 'pin', label: 'PIN Code', type: 'text' },
                                { key: 'contactEmail', label: 'Contact Email', type: 'email' },
                                { key: 'phone', label: 'Phone', type: 'tel' },
                                { key: 'website', label: 'Website', type: 'url' },
                                { key: 'adminName', label: 'Admin Name', type: 'text' },
                                { key: 'adminEmail', label: 'Admin Email', type: 'email' },
                                { key: 'adminPhone', label: 'Admin Phone', type: 'tel' },
                                { key: 'designation', label: 'Admin Designation', type: 'text' }
                            ].map(field => (
                                <div key={field.key} className={field.fullWidth ? 'md:col-span-2' : ''}>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        {field.label}
                                    </label>
                                    <input
                                        type={field.type}
                                        value={formData[field.key] || ''}
                                        onChange={(e) => setFormData({...formData, [field.key]: e.target.value})}
                                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                                    />
                                </div>
                            ))}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Message to Admin (Optional)
                            </label>
                            <textarea
                                value={submitMessage}
                                onChange={(e) => setSubmitMessage(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                                rows={3}
                                placeholder="Add any notes or context for the admin..."
                            />
                        </div>

                        <div className="flex gap-3 pt-4">
                            <button
                                onClick={handleSubmitRequest}
                                disabled={submitting}
                                className="px-6 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-secondary disabled:opacity-50"
                            >
                                {submitting ? 'Submitting...' : 'Submit for Approval'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                            { key: 'name', label: 'Hospital Name' },
                            { key: 'regNumber', label: 'Registration Number' },
                            { key: 'license', label: 'License Number' },
                            { key: 'address', label: 'Address', fullWidth: true },
                            { key: 'city', label: 'City' },
                            { key: 'state', label: 'State' },
                            { key: 'pin', label: 'PIN Code' },
                            { key: 'contactEmail', label: 'Contact Email' },
                            { key: 'phone', label: 'Phone' },
                            { key: 'website', label: 'Website' },
                            { key: 'adminName', label: 'Admin Name' },
                            { key: 'adminEmail', label: 'Admin Email' },
                            { key: 'adminPhone', label: 'Admin Phone' },
                            { key: 'designation', label: 'Admin Designation' }
                        ].map(field => (
                            <div key={field.key} className={field.fullWidth ? 'md:col-span-2' : ''}>
                                <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                                    {field.label}
                                </div>
                                <div className="text-sm text-slate-800 dark:text-slate-200 font-medium">
                                    {hospitalData?.[field.key] || 'N/A'}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    );
};

export default HospitalInformationUpdate;
