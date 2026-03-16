import { API_URL } from '../../config/api';
import React, { useEffect, useState } from 'react';
import Card from '../../components/Card';
import { useAuth } from '../../contexts/AuthContext';
import Loader from '../../components/Loader';
import { useSSE } from '../../hooks/useSSE';
import GlassNotification from '../../components/GlassNotification';

interface HospitalData {
    _id: string;
    name: string;
    username: string;
    regNumber?: string;
    address?: string;
    city?: string;
    state?: string;
    pin?: string;
    license?: string;
    contactEmail?: string;
    phone?: string;
    website?: string;
    adminName?: string;
    adminEmail?: string;
    adminPhone?: string;
    designation?: string;
    active: boolean;
    createdAt: string;
}

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

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    consequences: string[];
    confirmText: string;
    isDeactivate: boolean;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ isOpen, onClose, onConfirm, title, message, consequences, confirmText, isDeactivate }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">{title}</h3>
                    <p className="text-slate-600 dark:text-slate-400 mb-4">{message}</p>
                    
                    <div className={`${isDeactivate ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'} border rounded-lg p-4 mb-4`}>
                        <div className="flex items-start mb-2">
                            <svg className={`w-5 h-5 ${isDeactivate ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'} mt-0.5 mr-2 flex-shrink-0`} fill="currentColor" viewBox="0 0 20 20">
                                {isDeactivate ? (
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                ) : (
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                )}
                            </svg>
                            <p className={`text-sm font-semibold ${isDeactivate ? 'text-red-800 dark:text-red-200' : 'text-green-800 dark:text-green-200'}`}>
                                {isDeactivate ? 'This will have the following effects:' : 'This will restore the following:'}
                            </p>
                        </div>
                        <ul className="space-y-2 ml-7">
                            {consequences.map((consequence, idx) => (
                                <li key={idx} className={`text-sm ${isDeactivate ? 'text-red-700 dark:text-red-300' : 'text-green-700 dark:text-green-300'} flex items-start`}>
                                    <span className="mr-2">•</span>
                                    <span>{consequence}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="flex gap-3 justify-end">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => {
                                onConfirm();
                                onClose();
                            }}
                            className={`px-4 py-2 text-white rounded-lg transition-colors ${isDeactivate ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}
                        >
                            {confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Helper function to get status color classes
const statusColor = (status: string) => {
    switch (status) {
        case 'PENDING':
            return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200';
        case 'APPROVED':
            return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200';
        case 'REJECTED':
            return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200';
        case 'CHANGES_REQUESTED':
            return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-200';
        default:
            return 'bg-slate-100 text-slate-800 dark:bg-slate-900/20 dark:text-slate-200';
    }
};

const HospitalSettingsPage: React.FC = () => {
    const { user } = useAuth();
    const [hospital, setHospital] = useState<HospitalData | null>(null);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [pendingRequest, setPendingRequest] = useState<UpdateRequest | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState<any>({});
    const [submitMessage, setSubmitMessage] = useState('');
    const [replyMessage, setReplyMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [notification, setNotification] = useState<{
        show: boolean;
        title: string;
        message: string;
        type: 'info' | 'success' | 'warning' | 'error';
    }>({ show: false, title: '', message: '', type: 'info' });
    const [modalConfig, setModalConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        consequences: string[];
        confirmText: string;
        isDeactivate: boolean;
        onConfirm: () => void;
    }>({
        isOpen: false,
        title: '',
        message: '',
        consequences: [],
        confirmText: '',
        isDeactivate: false,
        onConfirm: () => {}
    });

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
        setLoading(true);
        try {
            const resp = await fetch(`${API_URL}/superadmin/hospitals/${user.id}`);
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error || 'Failed to fetch hospital data');
            setHospital(data.hospital);
            setFormData(data.hospital);
        } catch (err) {
            console.error('fetch hospital data error:', err);
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
        const editableFields = ['name', 'username', 'regNumber', 'license', 'address', 'city', 'state', 
                               'pin', 'contactEmail', 'phone', 'website', 'adminName', 
                               'adminEmail', 'adminPhone', 'designation'];
        
        for (const field of editableFields) {
            if (formData[field] !== hospital?.[field]) {
                changes[field] = formData[field];
            }
        }
        
        if (Object.keys(changes).length === 0) {
            setNotification({
                show: true,
                title: 'No Changes',
                message: 'No changes detected. Please modify at least one field.',
                type: 'warning'
            });
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
            
            setNotification({
                show: true,
                title: 'Request Submitted',
                message: 'Your update request has been submitted successfully! Waiting for admin approval.',
                type: 'success'
            });
            setIsEditing(false);
            setSubmitMessage('');
            fetchPendingRequest();
        } catch (err: any) {
            setNotification({
                show: true,
                title: 'Submission Failed',
                message: err.message || 'Failed to submit update request. Please try again.',
                type: 'error'
            });
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
            
            setNotification({
                show: true,
                title: 'Message Sent',
                message: 'Your message has been sent to the admin.',
                type: 'success'
            });
            setReplyMessage('');
            fetchPendingRequest();
        } catch (err: any) {
            setNotification({
                show: true,
                title: 'Failed to Send',
                message: err.message || 'Failed to send message. Please try again.',
                type: 'error'
            });
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return <Loader text="Loading hospital settings..." fullScreen />;
    }

    const showDeactivateModal = () => {
        if (!hospital) return;
        setModalConfig({
            isOpen: true,
            title: 'Deactivate Hospital Account',
            message: 'Are you sure you want to deactivate your hospital account?',
            consequences: [
                'You will lose access to most system features immediately',
                'An "Account Inactive" screen will block access to the dashboard',
                'You cannot add new patients',
                'You cannot create or edit medical records',
                'Existing patient and medical data will be preserved but inaccessible',
                'Only this settings page will remain accessible',
                'You will need to reactivate to regain full access'
            ],
            confirmText: 'Deactivate Account',
            isDeactivate: true,
            onConfirm: performToggleActiveStatus
        });
    };

    const showActivateModal = () => {
        if (!hospital) return;
        setModalConfig({
            isOpen: true,
            title: 'Activate Hospital Account',
            message: 'Are you sure you want to activate your hospital account?',
            consequences: [
                'Full access to the system will be restored',
                'You can add and manage patients',
                'You can create and edit medical records',
                'Dashboard and reporting features will be accessible',
                'All form templates will become available'
            ],
            confirmText: 'Activate Account',
            isDeactivate: false,
            onConfirm: performToggleActiveStatus
        });
    };

    const performToggleActiveStatus = async () => {
        if (!hospital || !user?.id) return;
        
        const action = hospital.active ? 'deactivate' : 'activate';
        setUpdating(true);
        try {
            const resp = await fetch(`${API_URL}/superadmin/hospitals/${user.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ active: !hospital.active }),
            });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error || 'Failed to update status');
            
            setNotification({
                show: true,
                title: 'Status Updated',
                message: `Hospital account ${action}d successfully!`,
                type: 'success'
            });
            await fetchHospitalData();

            // Notify layout to re-check account status without full page reload.
            window.dispatchEvent(new CustomEvent('hospital:status-updated'));
        } catch (err: any) {
            console.error('toggle active status error:', err);
            setNotification({
                show: true,
                title: 'Update Failed',
                message: err.message || `Unable to ${action} hospital account`,
                type: 'error'
            });
        } finally {
            setUpdating(false);
        }
    };

    if (loading) {
        return <Loader text="Loading hospital settings..." fullScreen />;
    }

    if (!hospital) {
        return (
            <div className="p-4 text-center">
                <p className="text-slate-600 dark:text-slate-400">Unable to load hospital data.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Notification */}
            {notification.show && (
                <GlassNotification
                    title={notification.title}
                    message={notification.message}
                    type={notification.type}
                    onClose={() => setNotification({ ...notification, show: false })}
                />
            )}

            <ConfirmModal
                isOpen={modalConfig.isOpen}
                onClose={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
                onConfirm={modalConfig.onConfirm}
                title={modalConfig.title}
                message={modalConfig.message}
                consequences={modalConfig.consequences}
                confirmText={modalConfig.confirmText}
                isDeactivate={modalConfig.isDeactivate}
            />

            {/* Page Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Settings</h1>
                <p className="text-slate-600 dark:text-slate-400 mt-1">Manage your hospital account and information</p>
            </div>

            {/* Account Status Section */}
            <Card title="Account Status">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Current Status</p>
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                            hospital.active 
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200' 
                                : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200'
                        }`}>
                            {hospital.active ? 'Active' : 'Inactive'}
                        </span>
                    </div>
                    <button
                        onClick={hospital.active ? showDeactivateModal : showActivateModal}
                        disabled={updating}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                            hospital.active 
                                ? 'bg-red-500 hover:bg-red-600 text-white' 
                                : 'bg-green-500 hover:bg-green-600 text-white'
                        }`}
                    >
                        {updating ? 'Updating...' : hospital.active ? 'Deactivate Account' : 'Activate Account'}
                    </button>
                </div>
                {!hospital.active && (
                    <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                        <p className="text-sm text-amber-800 dark:text-amber-200">
                            Your account is currently inactive. You cannot add patients, manage staff, or access most features until reactivated.
                        </p>
                    </div>
                )}
                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        Account Created: {new Date(hospital.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                </div>
            </Card>

            {/* Pending Update Request */}
            {pendingRequest && (
                <Card className={`border-l-4 ${
                    pendingRequest.status === 'PENDING' ? 'border-yellow-500' :
                    pendingRequest.status === 'CHANGES_REQUESTED' ? 'border-orange-500' : 'border-gray-500'
                }`}>
                    <div className="flex items-start justify-between mb-3">
                        <div>
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Update Request Status</h3>
                            <span className={`inline-block mt-1 px-2 py-1 rounded text-xs font-medium ${statusColor(pendingRequest.status)}`}>
                                {pendingRequest.status.replace('_', ' ')}
                            </span>
                        </div>
                    </div>
                    {pendingRequest.status === 'PENDING' && (
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                            Your update request is pending admin review. Current information will remain active until approved.
                        </p>
                    )}
                    {pendingRequest.status === 'CHANGES_REQUESTED' && pendingRequest.adminRemarks && (
                        <div className="mb-3 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                            <p className="text-sm font-medium text-orange-800 dark:text-orange-200 mb-1">Admin Remarks:</p>
                            <p className="text-sm text-orange-700 dark:text-orange-300">{pendingRequest.adminRemarks}</p>
                        </div>
                    )}
                    
                    {/* Requested Changes */}
                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                        <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Requested Changes:</h4>
                        <div className="space-y-2">
                            {pendingRequest.requestedChanges && Object.entries(pendingRequest.requestedChanges).map(([key, value]) => (
                                <div key={key} className="flex items-center text-sm">
                                    <span className="text-slate-500 dark:text-slate-400 min-w-[150px]">
                                        {key.replace(/([A-Z])/g, ' $1').trim()}:
                                    </span>
                                    <span className="text-red-600 dark:text-red-400 line-through mr-2">
                                        {pendingRequest.originalData?.[key] || 'N/A'}
                                    </span>
                                    <span className="text-slate-400">→</span>
                                    <span className="text-green-600 dark:text-green-400 ml-2 font-medium">
                                        {value as string}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Conversation */}
                    {pendingRequest.conversation && pendingRequest.conversation.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                            <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Conversation:</h4>
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                {pendingRequest.conversation.map((msg, idx) => (
                                    <div key={idx} className={`p-3 rounded-lg text-sm ${
                                        msg.sender === 'ADMIN' 
                                            ? 'bg-blue-50 dark:bg-blue-900/20' 
                                            : 'bg-green-50 dark:bg-green-900/20'
                                    }`}>
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                                {msg.sender === 'ADMIN' ? 'Admin' : 'You'}
                                            </span>
                                            <span className="text-xs text-slate-500">
                                                {new Date(msg.timestamp).toLocaleString()}
                                            </span>
                                        </div>
                                        <p className="text-slate-700 dark:text-slate-300">{msg.message}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Reply Section */}
                    {pendingRequest.status === 'CHANGES_REQUESTED' && (
                        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Send a message or resubmit your request:
                            </label>
                            <textarea
                                value={replyMessage}
                                onChange={(e) => setReplyMessage(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                                rows={3}
                                placeholder="Explain your changes or ask for clarification..."
                            />
                            <div className="flex gap-2 mt-2">
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

            {/* Hospital Information */}
            <Card title={isEditing ? 'Edit Information' : 'Hospital Information'}>
                <div className="flex justify-between items-center mb-4">
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                        {isEditing ? 'Update your hospital information' : 'Current hospital details'}
                    </p>
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
                                setFormData(hospital);
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
                                { key: 'username', label: 'Username (Email)', type: 'email' },
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
                                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-primary focus:border-transparent"
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
                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                                rows={3}
                                placeholder="Add any notes or context for the admin..."
                            />
                        </div>

                        <div className="flex gap-3 pt-4">
                            <button
                                onClick={handleSubmitRequest}
                                disabled={submitting}
                                className="px-6 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-secondary disabled:opacity-50 flex items-center gap-2"
                            >
                                {submitting ? (
                                    <>
                                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Submitting...
                                    </>
                                ) : 'Submit for Approval'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                            { key: 'name', label: 'Hospital Name' },
                            { key: 'username', label: 'Username (Email)' },
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
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{field.label}</p>
                                <p className="text-sm text-slate-800 dark:text-slate-200">
                                    {hospital?.[field.key] || <span className="text-slate-400">Not provided</span>}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    );
};

export default HospitalSettingsPage;
