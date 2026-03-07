import { API_URL } from '../../config/api';

import React, { useEffect, useState } from 'react';
import Card from '../../components/Card';
import { useAuth } from '../../contexts/AuthContext';
import Loader from '../../components/Loader';

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

const HospitalSettingsPage: React.FC = () => {
    const { user } = useAuth();
    const [hospital, setHospital] = useState<HospitalData | null>(null);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
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

    useEffect(() => {
        if (user?.id) fetchHospitalData();
    }, [user?.id]);

    const fetchHospitalData = async () => {
        if (!user?.id) return;
        setLoading(true);
        try {
            const resp = await fetch(`${API_URL}/superadmin/hospitals/${user.id}`);
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error || 'Failed to fetch hospital data');
            setHospital(data.hospital);
        } catch (err) {
            console.error('fetch hospital data error:', err);
        } finally {
            setLoading(false);
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
                'You cannot add new patients or staff members',
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
                'Staff management features will be enabled',
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
            
            alert(`Hospital account ${action}d successfully!`);
            await fetchHospitalData();
            
            // If deactivating, reload the page to trigger the inactive screen
            if (hospital.active) {
                window.location.reload();
            }
        } catch (err) {
            console.error('toggle active status error:', err);
            alert(`Error: Unable to ${action} hospital account`);
        } finally {
            setUpdating(false);
        }
    };

    if (loading) {
        return (
            <Card title="Hospital Account Settings">
                <div className="p-4 text-center">
                    <p className="text-slate-600 dark:text-slate-400">Loading settings...</p>
                </div>
            </Card>
        );
    }

    if (!hospital) {
        return (
            <Card title="Hospital Account Settings">
                <div className="p-4 text-center">
                    <p className="text-slate-600 dark:text-slate-400">Unable to load hospital data.</p>
                </div>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
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
            <Card title="Hospital Account Settings">
                <div className="space-y-6">
                    {/* Account Status Section */}
                    <div className="border-b border-slate-200 dark:border-slate-700 pb-6">
                        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">Account Status Management</h3>
                        <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 p-4 rounded-lg">
                            <div>
                                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Current Status</p>
                                <div className="flex items-center mt-2">
                                    <span className={`px-3 py-1 text-sm font-semibold rounded-full ${hospital.active ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>
                                        {hospital.active ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                            </div>
                            <div>
                                <button
                                    onClick={hospital.active ? showDeactivateModal : showActivateModal}
                                    disabled={updating}
                                    className={`px-6 py-2 text-sm font-semibold rounded-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed ${
                                        hospital.active 
                                            ? 'bg-red-500 hover:bg-red-600 text-white' 
                                            : 'bg-green-500 hover:bg-green-600 text-white'
                                    }`}
                                >
                                    {updating ? 'Updating...' : hospital.active ? 'Deactivate Account' : 'Activate Account'}
                                </button>
                            </div>
                        </div>
                        {!hospital.active && (
                            <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                                <div className="flex items-start">
                                    <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                    <div>
                                        <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Account Deactivated</p>
                                        <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                                            Your account is currently inactive. You cannot add patients, manage staff, or access most features until reactivated by the system administrator.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Hospital Information Section */}
                    <div className="border-b border-slate-200 dark:border-slate-700 pb-6">
                        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">Hospital Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Hospital Name</label>
                                <p className="text-slate-800 dark:text-slate-200 mt-1">{hospital.name}</p>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Registration Number</label>
                                <p className="text-slate-800 dark:text-slate-200 mt-1">{hospital.regNumber || 'N/A'}</p>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-600 dark:text-slate-400">License Number</label>
                                <p className="text-slate-800 dark:text-slate-200 mt-1">{hospital.license || 'N/A'}</p>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Contact Email</label>
                                <p className="text-slate-800 dark:text-slate-200 mt-1">{hospital.contactEmail || 'N/A'}</p>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Phone</label>
                                <p className="text-slate-800 dark:text-slate-200 mt-1">{hospital.phone || 'N/A'}</p>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Website</label>
                                <p className="text-slate-800 dark:text-slate-200 mt-1">{hospital.website || 'N/A'}</p>
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Address</label>
                                <p className="text-slate-800 dark:text-slate-200 mt-1">
                                    {[hospital.address, hospital.city, hospital.state, hospital.pin].filter(Boolean).join(', ') || 'N/A'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Administrator Information Section */}
                    <div className="pb-6">
                        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">Administrator Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Admin Name</label>
                                <p className="text-slate-800 dark:text-slate-200 mt-1">{hospital.adminName || 'N/A'}</p>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Admin Email</label>
                                <p className="text-slate-800 dark:text-slate-200 mt-1">{hospital.adminEmail || 'N/A'}</p>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Admin Phone</label>
                                <p className="text-slate-800 dark:text-slate-200 mt-1">{hospital.adminPhone || 'N/A'}</p>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Designation</label>
                                <p className="text-slate-800 dark:text-slate-200 mt-1">{hospital.designation || 'N/A'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Account Details */}
                    <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg">
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            <span className="font-medium">Account Created:</span> {new Date(hospital.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                            To request changes to your account information or to reactivate a deactivated account, please contact the system administrator.
                        </p>
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default HospitalSettingsPage;
