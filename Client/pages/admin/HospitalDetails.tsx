import { API_URL } from '../../config/api';

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Card from '../../components/Card';
import Loader from '../../components/Loader';

interface Hospital {
    _id: string;
    name: string;
    city?: string;
    state?: string;
    address?: string;
    contactEmail?: string;
    phone?: string;
    regNumber?: string;
    license?: string;
    adminName?: string;
    adminEmail?: string;
    adminPhone?: string;
    active: boolean;
    createdAt: string;
    patientCount?: number;
    staffCount?: number;
    recordsCount?: number;
}

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    consequences: string[];
    confirmText: string;
    confirmColor: 'red' | 'yellow' | 'green';
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ isOpen, onClose, onConfirm, title, message, consequences, confirmText, confirmColor }) => {
    if (!isOpen) return null;

    const colorClasses = {
        red: 'bg-red-500 hover:bg-red-600',
        yellow: 'bg-yellow-500 hover:bg-yellow-600',
        green: 'bg-green-500 hover:bg-green-600'
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">{title}</h3>
                    <p className="text-slate-600 dark:text-slate-400 mb-4">{message}</p>
                    
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-4">
                        <div className="flex items-start mb-2">
                            <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">This action will have the following effects:</p>
                        </div>
                        <ul className="space-y-2 ml-7">
                            {consequences.map((consequence, idx) => (
                                <li key={idx} className="text-sm text-amber-700 dark:text-amber-300 flex items-start">
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
                            className={`px-4 py-2 text-white rounded-lg transition-colors ${colorClasses[confirmColor]}`}
                        >
                            {confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

const DetailItem: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
    <div className="grid grid-cols-3 gap-4 py-2">
        <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</dt>
        <dd className="text-sm text-slate-800 dark:text-slate-200 col-span-2">{value || 'N/A'}</dd>
    </div>
);

const VerificationItem: React.FC<{ name: string; status: 'Verified' | 'Pending' }> = ({ name, status }) => (
     <li className="flex items-center justify-between py-2">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{name}</p>
        <div className="flex items-center">
            {status === 'Verified' ? 
                <svg className="w-5 h-5 text-status-green" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg> :
                <svg className="w-5 h-5 text-status-yellow" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 102 0V6zM10 15a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>
            }
            <span className={`ml-2 text-sm font-semibold ${status === 'Verified' ? 'text-status-green' : 'text-status-yellow'}`}>{status}</span>
        </div>
    </li>
);


const HospitalDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [hospital, setHospital] = useState<Hospital | null>(null);
    const [loading, setLoading] = useState(true);
    const [modalConfig, setModalConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        consequences: string[];
        confirmText: string;
        confirmColor: 'red' | 'yellow' | 'green';
        onConfirm: () => void;
    }>({
        isOpen: false,
        title: '',
        message: '',
        consequences: [],
        confirmText: '',
        confirmColor: 'red',
        onConfirm: () => {}
    });

    useEffect(() => {
        if (id) fetchHospital();
    }, [id]);

    const fetchHospital = async () => {
        if (!id) return;
        setLoading(true);
        try {
            const resp = await fetch(`${API_URL}/superadmin/hospitals/${id}`);
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error || 'Failed');
            setHospital(data.hospital);
        } catch (err) {
            console.error('fetch hospital error:', err);
        } finally {
            setLoading(false);
        }
    };

    const showActivateModal = () => {
        if (!hospital) return;
        setModalConfig({
            isOpen: true,
            title: 'Activate Hospital',
            message: `Are you sure you want to activate "${hospital.name}"?`,
            consequences: [
                'Hospital account will regain full access to the system',
                'They can add and manage patients',
                'They can create and edit medical records',
                'All form templates will become accessible',
                'Dashboard and reporting features will be restored'
            ],
            confirmText: 'Activate Hospital',
            confirmColor: 'green',
            onConfirm: performToggleActiveStatus
        });
    };

    const showSuspendModal = () => {
        if (!hospital) return;
        setModalConfig({
            isOpen: true,
            title: 'Suspend Hospital',
            message: `Are you sure you want to suspend "${hospital.name}"?`,
            consequences: [
                'Hospital account will lose access to most features',
                'They will see an "Account Inactive" blocking screen',
                'Cannot add new patients',
                'Cannot create or edit medical records',
                'Existing data will be preserved but inaccessible',
                'Only account settings page will be accessible',
                `Affects ${hospital.patientCount || 0} patients`
            ],
            confirmText: 'Suspend Hospital',
            confirmColor: 'yellow',
            onConfirm: performToggleActiveStatus
        });
    };

    const performToggleActiveStatus = async () => {
        if (!hospital) return;
        try {
            const resp = await fetch(`${API_URL}/superadmin/hospitals/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ active: !hospital.active }),
            });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error || 'Failed');
            notify(`Hospital ${hospital.active ? 'suspended' : 'activated'} successfully`);
            fetchHospital();
        } catch (err) {
            console.error('toggle active status error:', err);
            notify('Error updating status');
        }
    };

    const showDeleteModal = () => {
        if (!hospital) return;
        setModalConfig({
            isOpen: true,
            title: 'Delete Hospital - Permanent Action',
            message: `Are you sure you want to permanently delete "${hospital.name}"?`,
            consequences: [
                'THIS ACTION CANNOT BE UNDONE',
                `All hospital data will be permanently deleted`,
                `${hospital.patientCount || 0} patient records will be removed`,
                `${hospital.recordsCount || 0} medical records will be deleted`,
                'All form templates will be removed',
                'Hospital cannot be recovered after deletion',
                'Consider suspending instead if you might need this data later'
            ],
            confirmText: 'Delete Permanently',
            confirmColor: 'red',
            onConfirm: performDelete
        });
    };

    const performDelete = async () => {
        if (!hospital) return;
        try {
            const resp = await fetch(`${API_URL}/superadmin/hospitals/${id}`, { method: 'DELETE' });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error || 'Failed');
            notify('Hospital deleted successfully');
            navigate('/admin/hospitals');
        } catch (err) {
            console.error('delete hospital error:', err);
            notify('Error deleting hospital');
        }
    };

    if (loading) {
        return <Loader text="Loading hospital details..." fullScreen />;
    }

    if (!hospital) {
        return <div className="text-center p-8 text-slate-700 dark:text-slate-300">Hospital not found.</div>
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
                confirmColor={modalConfig.confirmColor}
            />
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Hospital Details</h2>
                <button onClick={() => navigate(-1)} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm rounded-md hover:bg-slate-300 dark:hover:bg-slate-600">
                    &larr; Back
                </button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <Card title="Hospital Information">
                        <dl className="divide-y divide-slate-200 dark:divide-slate-700">
                           <DetailItem label="Name" value={hospital.name} />
                           <DetailItem label="Location" value={`${hospital.city || ''}, ${hospital.state || ''}`.trim() || 'N/A'} />
                           <DetailItem label="Address" value={hospital.address} />
                           <DetailItem label="Email" value={hospital.contactEmail} />
                           <DetailItem label="Phone" value={hospital.phone} />
                           <DetailItem label="Registration Date" value={new Date(hospital.createdAt).toLocaleDateString()} />
                           <DetailItem label="License No" value={hospital.license} />
                           <DetailItem label="Reg Number" value={hospital.regNumber} />
                           <DetailItem label="Status" value={hospital.active ? 'Active' : 'Inactive'} />
                        </dl>
                    </Card>
                     <Card title="Administrator">
                        <dl className="divide-y divide-slate-200 dark:divide-slate-700">
                           <DetailItem label="Name" value={hospital.adminName} />
                           <DetailItem label="Email" value={hospital.adminEmail} />
                           <DetailItem label="Phone" value={hospital.adminPhone} />
                        </dl>
                    </Card>
                </div>
                <div className="space-y-6">
                    <Card title="Statistics">
                         <dl className="divide-y divide-slate-200 dark:divide-slate-700">
                           <DetailItem label="Total Patients" value={hospital.patientCount || 0} />
                           <DetailItem label="Total Staff" value={hospital.staffCount || 0} />
                           <DetailItem label="Medical Records" value={hospital.recordsCount || 0} />
                           <DetailItem label="Last Activity" value={new Date(hospital.createdAt).toLocaleDateString()} />
                        </dl>
                    </Card>
                    <Card title="Verification Documents">
                        <ul className="divide-y divide-slate-200 dark:divide-slate-700">
                            <VerificationItem name="License" status={hospital.license ? 'Verified' : 'Pending'} />
                            <VerificationItem name="Registration" status={hospital.regNumber ? 'Verified' : 'Pending'} />
                            <VerificationItem name="Active Status" status={hospital.active ? 'Verified' : 'Pending'} />
                        </ul>
                    </Card>
                    <Card title="Admin Controls">
                         <div className="flex flex-wrap gap-2">
                             <button onClick={() => navigate(`/admin/hospitals/${id}`)} className="flex-grow px-3 py-2 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600">Edit</button>
                             <button onClick={hospital.active ? showSuspendModal : showActivateModal} className={`flex-grow px-3 py-2 text-white text-sm rounded-md ${hospital.active ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-green-500 hover:bg-green-600'}`}>
                                 {hospital.active ? 'Suspend' : 'Activate'}
                             </button>
                             <button onClick={showDeleteModal} className="flex-grow px-3 py-2 bg-red-500 text-white text-sm rounded-md hover:bg-red-600">Delete</button>
                         </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default HospitalDetails;
