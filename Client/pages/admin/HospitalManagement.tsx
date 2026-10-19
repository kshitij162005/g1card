import { API_URL } from '../../config/api';
import SearchBox from '../../components/SearchBox';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../components/Card';
import Loader from '../../components/Loader';

interface Hospital {
    _id: string;
    name: string;
    city?: string;
    state?: string;
    contactEmail?: string;
    active: boolean;
    createdAt: string;
}

interface DeleteModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    hospitalName: string;
}

const DeleteModal: React.FC<DeleteModalProps> = ({ isOpen, onClose, onConfirm, hospitalName }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full">
                <div className="p-6">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">Delete Hospital - Permanent Action</h3>
                    <p className="text-slate-600 dark:text-slate-400 mb-4">Are you sure you want to permanently delete "{hospitalName}"?</p>
                    
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
                        <div className="flex items-start mb-2">
                            <svg className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                            <p className="text-sm font-semibold text-red-800 dark:text-red-200">Warning: This action cannot be undone</p>
                        </div>
                        <ul className="space-y-2 ml-7">
                            <li className="text-sm text-red-700 dark:text-red-300">• All hospital data will be permanently deleted</li>
                            <li className="text-sm text-red-700 dark:text-red-300">• All patient records will be removed</li>
                            <li className="text-sm text-red-700 dark:text-red-300">• All medical records will be deleted</li>
                            <li className="text-sm text-red-700 dark:text-red-300">• Hospital cannot be recovered after deletion</li>
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
                            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                        >
                            Delete Permanently
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

const HospitalManagement: React.FC = () => {
    const [hospitals, setHospitals] = useState<Hospital[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState<'All' | 'Active' | 'Inactive'>('All');
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ total: 0, pages: 1, limit: 10 });
    const navigate = useNavigate();
    const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; hospitalId: string; hospitalName: string }>({
        isOpen: false,
        hospitalId: '',
        hospitalName: ''
    });

    // Re-fetch whenever the page or the submitted search changes
    useEffect(() => {
        fetchHospitals();
    }, [page, searchTerm]);

    const fetchHospitals = async () => {
        setLoading(true);
        try {
            const resp = await fetch(`${API_URL}/superadmin/hospitals?search=${encodeURIComponent(searchTerm)}&page=${page}&limit=10`);
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error || 'Failed');
            setHospitals(data.hospitals || []);
            setPagination(data.pagination || { total: 0, pages: 1, limit: 10 });
        } catch (err) {
            console.error('fetch hospitals error:', err);
        } finally {
            setLoading(false);
        }
    };

    const filteredHospitals = hospitals.filter(h => {
        if (filter === 'Active') return h.active;
        if (filter === 'Inactive') return !h.active;
        return true;
    });

    const getStatusChip = (active: boolean) => {
        return active 
            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    };

    const showDeleteModal = (id: string, name: string) => {
        setDeleteModal({ isOpen: true, hospitalId: id, hospitalName: name });
    };

    const performDelete = async () => {
        try {
            const resp = await fetch(`${API_URL}/superadmin/hospitals/${deleteModal.hospitalId}`, { method: 'DELETE' });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error || 'Failed');
            notify('Hospital deleted successfully');
            fetchHospitals();
        } catch (err) {
            console.error('delete hospital error:', err);
            notify('Error deleting hospital');
        }
    };
    
    if (loading && hospitals.length === 0) {
        return <Loader text="Loading hospitals..." fullScreen />;
    }

    return (
        <Card title="Hospitals Directory">
            <DeleteModal
                isOpen={deleteModal.isOpen}
                onClose={() => setDeleteModal({ isOpen: false, hospitalId: '', hospitalName: '' })}
                onConfirm={performDelete}
                hospitalName={deleteModal.hospitalName}
            />
            <div className="space-y-4">
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                    <SearchBox
                        className="w-full md:w-96"
                        placeholder="Search hospitals by name, city or email"
                        onSearch={q => { setPage(1); setSearchTerm(q); }}
                    />
                     <select 
                        className="w-full md:w-1/4 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-brand-accent focus:border-brand-accent"
                        value={filter}
                        onChange={e => setFilter(e.target.value as 'All' | 'Active' | 'Inactive')}
                    >
                        <option value="All">All Statuses</option>
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                    </select>
                    <button onClick={() => navigate('/admin/hospitals/add')} className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-secondary transition-transform transform hover:scale-105">+ Register New Hospital</button>
                </div>
                {loading ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">Loading hospitals...</p>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="min-w-full">
                                <thead className="bg-slate-50 dark:bg-slate-700">
                                    <tr>
                                        <th className="py-3 px-6 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Hospital Name</th>
                                        <th className="py-3 px-6 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Location</th>
                                        <th className="py-3 px-6 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Status</th>
                                        <th className="py-3 px-6 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                    {filteredHospitals.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="py-4 px-6 text-center text-slate-500 dark:text-slate-400">No hospitals found.</td>
                                        </tr>
                                    ) : (
                                        filteredHospitals.map(hospital => (
                                            <tr key={hospital._id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                                <td className="py-4 px-6 whitespace-nowrap text-slate-800 dark:text-slate-200">{hospital.name}</td>
                                                <td className="py-4 px-6 whitespace-nowrap text-slate-700 dark:text-slate-300">{hospital.city}, {hospital.state}</td>
                                                <td className="py-4 px-6 whitespace-nowrap">
                                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusChip(hospital.active)}`}>
                                                        {hospital.active ? 'Active' : 'Inactive'}
                                                    </span>
                                                </td>
                                                <td className="py-4 px-6 whitespace-nowrap text-sm font-medium space-x-4">
                                                    <button onClick={() => navigate(`/admin/hospitals/${hospital._id}`)} className="text-brand-accent dark:text-brand-primary hover:underline">View</button>
                                                    <button onClick={() => navigate(`/admin/hospitals/${hospital._id}`)} className="text-blue-500 dark:text-blue-400 hover:underline">Edit</button>
                                                    <button onClick={() => showDeleteModal(hospital._id, hospital.name)} className="text-red-500 dark:text-red-400 hover:underline">Delete</button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {/* Pagination with Page Numbers */}
                        {!loading && filteredHospitals.length > 0 && (
                            <div className="flex items-center justify-between pt-4">
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                    Showing {(page - 1) * pagination.limit + 1} to {Math.min(page * pagination.limit, pagination.total)} of {pagination.total} results
                                </p>
                                <div className="flex items-center gap-2">
                                    <button
                                        disabled={page === 1}
                                        onClick={() => setPage(p => p - 1)}
                                        className="px-3 py-1 border border-slate-300 dark:border-slate-600 rounded-lg text-sm hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                                        disabled={page >= pagination.pages}
                                        onClick={() => setPage(p => p + 1)}
                                        className="px-3 py-1 border border-slate-300 dark:border-slate-600 rounded-lg text-sm hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </Card>
    );
};

export default HospitalManagement;