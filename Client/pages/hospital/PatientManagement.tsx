import { API_URL } from '../../config/api';


import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../components/Card';
import { Patient, PatientStatus } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import Loader from '../../components/Loader';

interface ApiPatient {
    _id: string;
    patientId?: string;
    name: string;
    dob?: string;
    status?: string;        // consent status: PENDING / APPROVED / DENIED
    accessLevel?: string;   // GENERAL / COMPLETE
    requestedAt?: string;
}


const PatientManagement: React.FC = () => {
    const [patients, setPatients] = useState<Patient[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [showFilters, setShowFilters] = useState(false);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [dateFrom, setDateFrom] = useState<string>('');
    const [dateTo, setDateTo] = useState<string>('');
    const navigate = useNavigate();
    const { user } = useAuth();

    useEffect(() => { fetchPatients(); }, [page]);

    const fetchPatients = async (q = '') => {
        if (!user) return;
        setLoading(true);
        try {
            const resp = await fetch(`${API_URL}/hospitals/${user.id}/patients?q=${encodeURIComponent(q)}&page=${page}&limit=10`);
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error || 'Failed');
            const items: ApiPatient[] = data.patients || [];
            setTotal(data.total || 0);
            // keep Mongo _id as route id, show patientId as external identifier
            setPatients(items.map(it => {
                const displayName = it.name;
                // Overload status field to show consent status text
                const consentStatus = (it.status || 'PENDING') as any;
                return ({
                    id: it._id,
                    name: displayName || 'Unknown',
                    dob: it.dob || '',
                    status: consentStatus,
                    patientId: it.patientId || it._id,
                    accessLevel: it.accessLevel,
                } as any);
            }));
        } catch (err) {
            console.error('fetch patients', err);
        } finally { setLoading(false); }
    };
    
    const getStatusChip = (status: any) => {
        if (status === 'APPROVED') return 'bg-emerald-200 text-black border border-emerald-300 dark:bg-emerald-900 dark:text-emerald-200 dark:border-emerald-700';
        if (status === 'DENIED') return 'bg-red-200 text-black border border-red-300 dark:bg-red-900 dark:text-red-200 dark:border-red-700';
        if (status === 'REVOKED') return 'bg-orange-200 text-black border border-orange-300 dark:bg-orange-900 dark:text-orange-200 dark:border-orange-700';
        return 'bg-amber-200 text-black border border-amber-300 dark:bg-amber-900 dark:text-amber-200 dark:border-amber-700';
    };

    if (loading && patients.length === 0) {
        return <Loader text="Loading patients..." fullScreen />;
    }

    return (
        <Card title="Patient Management">
            <div className="space-y-4">
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                    <div className="flex items-center gap-2">
                        <button onClick={() => navigate('/hospital/patients/add')} className="px-4 py-2 bg-brand-primary text-white text-sm rounded-lg hover:bg-brand-secondary">+ Add Patient</button>
                    </div>
                    <input 
                        type="text"
                        placeholder="Search by Patient ID/Name..."
                        className="w-full md:w-1/3 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-brand-accent focus:border-brand-accent bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                        value={searchTerm}
                        onChange={e => { setSearchTerm(e.target.value); setPage(1); fetchPatients(e.target.value); }}
                    />
                    <div className="flex items-center gap-2">
                         <button 
                             onClick={() => setShowFilters(!showFilters)}
                             className="text-sm px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                         >
                             {showFilters ? 'Hide Filters ▲' : 'Advanced Filter ▼'}
                         </button>
                         <button
                             type="button"
                             className="text-sm px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
                             aria-label="Export patients list"
                         >
                             Download CSV
                         </button>
                    </div>
                </div>

                {showFilters && (
                    <Card className="bg-slate-50 dark:bg-slate-800/50">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Status</label>
                                <select 
                                    value={statusFilter}
                                    onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-accent focus:border-brand-accent outline-none"
                                >
                                    <option value="all">All Status</option>
                                    <option value={PatientStatus.ACTIVE}>Active</option>
                                    <option value={PatientStatus.INACTIVE}>Inactive</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Date From</label>
                                <input 
                                    type="date"
                                    value={dateFrom}
                                    onChange={e => { setDateFrom(e.target.value); setPage(1); }}
                                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-accent focus:border-brand-accent outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Date To</label>
                                <input 
                                    type="date"
                                    value={dateTo}
                                    onChange={e => { setDateTo(e.target.value); setPage(1); }}
                                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-brand-accent focus:border-brand-accent outline-none"
                                />
                            </div>
                            <div className="flex items-end">
                                <button 
                                    onClick={() => {
                                        setStatusFilter('all');
                                        setDateFrom('');
                                        setDateTo('');
                                        setPage(1);
                                        fetchPatients(searchTerm);
                                    }}
                                    className="w-full px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                                >
                                    Clear Filters
                                </button>
                            </div>
                        </div>
                    </Card>
                )}

                <div className="overflow-x-auto rounded-xl border border-slate-300 dark:border-slate-700">
                    <table className="min-w-full">
                        <thead className="bg-slate-50 dark:bg-slate-700">
                            <tr>
                                <th className="py-3 px-6 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Patient ID</th>
                                <th className="py-3 px-6 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Name</th>
                                <th className="py-3 px-6 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">DOB</th>
                                <th className="py-3 px-6 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Consent Status</th>
                                <th className="py-3 px-6 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            {patients.map(patient => {
                                const consentStatus = String(patient.status || '').toUpperCase();
                                const canInteract = consentStatus === 'APPROVED';
                                return (
                                <tr key={patient.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-slate-800 dark:text-slate-200">
                                    <td className="py-4 px-6 whitespace-nowrap font-mono text-sm">{(patient as any).patientId || patient.id}</td>
                                    <td className="py-4 px-6 whitespace-nowrap">{patient.name}</td>
                                    <td className="py-4 px-6 whitespace-nowrap">{patient.dob}</td>
                                    <td className="py-4 px-6 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-bold rounded-full ${getStatusChip(patient.status)}`}>
                                            {patient.status}{(patient as any).accessLevel ? ` - ${(patient as any).accessLevel === 'COMPLETE' ? 'Complete Info' : 'General Info'}` : ''}
                                        </span>
                                    </td>
                                    <td className="py-4 px-6 whitespace-nowrap text-sm font-medium space-x-2">
                                        <button
                                            onClick={() => navigate(`/hospital/patients/${patient.id}`)}
                                            className={`px-3 py-1 text-sm font-semibold rounded-md border border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-200 bg-blue-50/80 dark:bg-blue-900/20 ${!canInteract ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-100 dark:hover:bg-blue-900/40'}`}
                                            aria-label={`View ${patient.name}`}
                                            disabled={!canInteract}
                                        >
                                            View
                                        </button>

                                        <button
                                            onClick={() => navigate(`/hospital/patients/${patient.id}/add-record`)}
                                            className={`px-3 py-1 text-sm font-medium rounded-md bg-emerald-600 text-white ${!canInteract ? 'opacity-50 cursor-not-allowed' : 'hover:bg-emerald-700'}`}
                                            aria-label={`Add record for ${patient.name}`}
                                            disabled={!canInteract}
                                        >
                                            Add Record
                                        </button>

                                        {((patient as any).status === 'DENIED' || (patient as any).status === 'REVOKED') && (
                                            <button
                                                onClick={async () => {
                                                    try {
                                                        const resp = await fetch(`${API_URL}/hospitals/${user?.id}/patients/${patient.id}/resend-access`, {
                                                            method: 'POST',
                                                        });
                                                        const d = await resp.json();
                                                        if (!resp.ok) throw new Error(d.error || 'Failed to resend request');
                                                        notify(`Access request resent to patient. Status: ${(patient as any).status === 'REVOKED' ? 'Patient revoked your access.' : 'Patient denied your request.'}`);
                                                        fetchPatients(searchTerm);
                                                    } catch (err) {
                                                        console.error(err);
                                                        notify('Error resending access request');
                                                    }
                                                }}
                                                className="px-3 py-1 text-xs font-medium rounded-md bg-amber-500 text-white hover:bg-amber-600"
                                                title={(patient as any).status === 'REVOKED' ? 'Request access again (patient revoked access)' : 'Resend access request'}
                                            >
                                                {(patient as any).status === 'REVOKED' ? 'Request Again' : 'Resend Request'}
                                            </button>
                                        )}

                                        <button
                                            onClick={async () => {
                                                if (!confirm(`Are you sure you want to remove patient ${patient.name} from your hospital records? This will not delete the patient from the system.`)) return;
                                                try {
                                                    const resp = await fetch(`${API_URL}/hospitals/${user?.id}/patients/${patient.id}`, { method: 'DELETE' });
                                                    const d = await resp.json();
                                                    if (!resp.ok) throw new Error(d.error || 'Failed to remove patient');
                                                    notify('Patient unlinked from hospital records');
                                                    fetchPatients(searchTerm);
                                                } catch (err) { console.error(err); notify('Error removing patient'); }
                                            }}
                                            className="px-3 py-1 text-sm font-medium rounded-md bg-rose-600 text-white hover:bg-rose-700"
                                            aria-label={`Remove ${patient.name}`}
                                        >
                                            Remove
                                        </button>
                                    </td>
                                </tr>
                            );})}
                        </tbody>
                    </table>
                </div>

                <div className="flex justify-between items-center pt-4">
                    <p className="text-sm text-slate-600 dark:text-slate-400">Showing {(page-1)*10+1} to {Math.min(page*10, total)} of {total} results</p>
                    <div className="flex items-center gap-2">
                        <button 
                            disabled={page<=1} 
                            onClick={() => setPage(p => Math.max(1,p-1))} 
                            className="px-3 py-1 border dark:border-slate-600 rounded-lg text-sm hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Previous
                        </button>
                        
                        {/* Page Numbers */}
                        {Array.from({ length: Math.min(Math.ceil(total / 10), 5) }, (_, i) => {
                            const totalPages = Math.ceil(total / 10);
                            let pageNum;
                            if (totalPages <= 5) {
                                pageNum = i + 1;
                            } else if (page <= 3) {
                                pageNum = i + 1;
                            } else if (page >= totalPages - 2) {
                                pageNum = totalPages - 4 + i;
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
                            disabled={page*10>=total} 
                            onClick={() => setPage(p => p+1)} 
                            className="px-3 py-1 border dark:border-slate-600 rounded-lg text-sm hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Next
                        </button>
                    </div>
                </div>

            </div>
        </Card>
    );
};

export default PatientManagement;